import QueryOrchestrator from './query-orchestrator.js';
import DSA5Payment from '../payment/payment.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';

const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class PaymentRequestService {
  static QUERY_TYPE = 'dsa5.paymentRequest';
  static FLAG_KEY = 'paymentRequest';
  static TEMPLATE = 'systems/dsa5/templates/chat/payment/batch-request.hbs';

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: this.handleQuery.bind(this),
    });
  }

  static async createRequest({ mode, amount, description = '', actors = QueryOrchestrator.activeCharacterActors() }) {
    const normalizedAmount = DSA5Payment.parsePaymentAmount(amount, mode, true);
    if (!normalizedAmount) return;

    const recipients = await QueryOrchestrator.buildRecipients(actors);

    const state = {
      mode,
      amount: normalizedAmount,
      description,
      finalized: false,
      recipients,
    };

    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
    });

    await this.dispatch(message.id);
    return message;
  }

  static async renderMessage(state) {
    return await renderTemplate(this.TEMPLATE, await this.getTemplateData(state));
  }

  static async getTemplateData(state) {
    const amountString = await DSA5Payment._moneyToString(state.amount);
    const finalized = !!state.finalized;
    const recipients = state.recipients.map((entry) => {
      return {
        ...entry,
        actorName: game.actors.get(entry.actorId)?.name || entry.actorId,
        designatedUserName: game.users.get(entry.designatedUserId)?.name || '',
        ...QueryOrchestrator.statusStyle(entry.status),
        canGMExecute: !finalized && !QueryOrchestrator.TERMINAL_STATES.has(entry.status) && !entry.designatedUserId,
      };
    });

    return {
      isGM: game.user.isGM,
      finalized,
      title: _loc(state.mode === 'pay' ? 'PAYMENT.requestTitlePay' : 'PAYMENT.requestTitleGetPaid'),
      amount: amountString,
      description: state.description,
      recipients,
    };
  }

  static async dispatch(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (!state?.recipients) return;

    await Promise.all(state.recipients.map(async (recipient) => {
      if (!recipient.designatedUserId || recipient.status !== 'pending') return;

      await this.dispatchRecipientQuery(messageId, recipient.actorId, recipient.designatedUserId, state);
    }));
  }

  static async dispatchRecipientQuery(messageId, actorId, userId, state) {
    await QueryOrchestrator.dispatchRecipientQuery({
      userId,
      queryType: this.QUERY_TYPE,
      payload: {
        messageId,
        actorId,
        mode: state.mode,
        amount: state.amount,
        description: state.description,
      },
      label: `payment recipient ${actorId}`,
      onResult: (result) => QueryOrchestrator.handleResult({ messageId, actorId, result }),
      onHardError: () => QueryOrchestrator.handleResult({
        messageId,
        actorId,
        result: {
          userId,
          status: 'failed',
          resultDetails: _loc('DSAQUERIES.NOTIFICATIONS.queryFailed'),
        },
      }),
    });
  }

  static async handleQuery(payload, queryContext = {}) {
    return QueryOrchestrator.runWithClientExpiry(
      (signal) => this.#executePaymentQuery(payload, signal),
      queryContext,
    );
  }

  static async #executePaymentQuery(payload, signal) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) {
      return {
        userId: game.user.id,
        status: 'failed',
        resultDetails: _loc('PAYMENT.noActor'),
      };
    }

    const confirmed = await this.promptRecipient(actor, payload.mode, payload.amount, payload.description, { signal });
    if (signal?.aborted) return null;
    if (!confirmed) {
      return {
        userId: game.user.id,
        status: 'rejected',
        resultDetails: _loc('DSAQUERIES.NOTIFICATIONS.declined'),
      };
    }

    const result = await DSA5Payment.executePayment(actor, payload.mode, payload.amount, {
      silent: true,
      render: true,
      showChatMessage: false,
      notifyOnFailure: payload.mode === 'pay',
      track: true,
    });

    return {
      userId: game.user.id,
      status: result.success ? 'accepted' : 'rejected',
      resultDetails: result.msg,
    };
  }

  static async promptRecipient(actor, mode, amount, description, { signal } = {}) {
    const amountString = await DSA5Payment._moneyToString(amount);
    const content = `
      <p>${_loc(mode === 'pay' ? 'PAYMENT.requestPromptPay' : 'PAYMENT.requestPromptGetPaid', { actor: actor.name, amount: amountString })}</p>
      ${description ? `<p><i>${description}</i></p>` : ''}
    `;

    try {
      return await QueryOrchestrator.waitDialog({
        window: {
          title: _loc(mode === 'pay' ? 'PAYMENT.requestTitlePay' : 'PAYMENT.requestTitleGetPaid'),
        },
        content,
        buttons: [
          {
            action: 'confirm',
            icon: 'fa fa-check',
            label: mode === 'pay' ? 'PAYMENT.payButton' : 'PAYMENT.getPaidButton',
            default: true,
            callback: () => true,
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => false,
          },
        ],
      }, { signal });
    } catch {
      return false;
    }
  }

  static async executeForActor(messageId, actorId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const actor = game.actors.get(actorId);
    if (!actor || !state?.mode) return;

    const result = await DSA5Payment.executePayment(actor, state.mode, state.amount, {
      silent: true,
      render: true,
      showChatMessage: false,
      notifyOnFailure: false,
      track: true,
    });

    await QueryOrchestrator.handleResult({
      messageId,
      actorId,
      result: {
        userId: game.user.id,
        status: result.success ? 'accepted' : 'rejected',
        resultDetails: result.success ? _loc('DSAQUERIES.NOTIFICATIONS.executedByGM') : result.msg,
      },
    });
  }

  static async resendToActor(messageId, actorId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const { designatedUser, status } = QueryOrchestrator.resolveDesignatedUser(actor);

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => {
      const currentRecipient = currentState.recipients.find((entry) => entry.actorId === actorId);
      if (!currentRecipient || currentState.finalized) return currentState;

      currentRecipient.designatedUserId = designatedUser?.id || null;
      currentRecipient.status = status;
      currentRecipient.resultDetails = null;
      return currentState;
    });

    if (designatedUser) {
      await this.dispatchRecipientQuery(messageId, actorId, designatedUser.id, state);
    }
  }

  static async removeActor(messageId, actorId) {
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      if (state.finalized) return state;
      state.recipients = state.recipients.filter((entry) => entry.actorId !== actorId);
      if (!state.recipients.length) state.finalized = true;
      return state;
    });
  }

  static async finalizeRequest(messageId) {
    await QueryOrchestrator.finalizeRequest(messageId);
  }

  static async addActors(messageId, actorIds) {
    const actors = actorIds.map((id) => game.actors.get(id)).filter(Boolean);
    if (!actors.length) return;

    const newRecipients = await QueryOrchestrator.buildRecipients(actors);
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      if (!state.recipients) state.recipients = [];
      const existingIds = new Set(state.recipients.map((entry) => entry.actorId));
      for (const recipient of newRecipients) {
        if (!existingIds.has(recipient.actorId)) state.recipients.push(recipient);
      }
      state.finalized = false;
      return state;
    });

    const message = game.messages.get(messageId);
    const updatedState = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    await Promise.all(updatedState.recipients.filter((entry) => actorIds.includes(entry.actorId) && entry.designatedUserId && entry.status === 'pending').map(async (recipient) => {
      await this.dispatchRecipientQuery(messageId, recipient.actorId, recipient.designatedUserId, updatedState);
    }));
  }

  static async openAddActorDialog(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const existingIds = new Set((state.recipients || []).map((entry) => entry.actorId));
    const actors = ActorPickerDialog.buildActorPickerData({ existingIds });

    const actorIds = await ActorPickerDialog.open({ actors });
    if (actorIds?.length) await this.addActors(messageId, actorIds);
  }

  static chatListeners(html) {
    html.on('click', '.payment-request-action', async (event) => {
      if (!game.user.isGM) return;

      const button = event.currentTarget;
      const action = button.dataset.action;
      const actorId = button.dataset.actorId;
      const messageId = $(button).closest('.message').attr('data-message-id');
      if (!messageId) return;

      switch (action) {
        case 'add':
          await this.openAddActorDialog(messageId);
          break;
        case 'execute':
          if (actorId) await this.executeForActor(messageId, actorId);
          break;
        case 'finalize':
          await this.finalizeRequest(messageId);
          break;
      }
    });

    if (game.user.isGM) {
      QueryOrchestrator.attachRowContextMenu(html, '.payment-request-row[data-actor-id]', (messageId, actorId, status) => {
        const message = game.messages.get(messageId);
        const state = message?.getFlag('dsa5', this.FLAG_KEY);
        if (state?.finalized) return [];

        const recipient = state?.recipients?.find((r) => r.actorId === actorId);
        const items = [];

        if (status !== 'accepted') {
          items.push({ label: _loc('DSAQUERIES.COMMANDS.execute'), icon: 'fas fa-coins', onClick: () => this.executeForActor(messageId, actorId) });
        }
        if (recipient?.designatedUserId && status !== 'accepted') {
          items.push({ label: _loc('DSAQUERIES.COMMANDS.resend'), icon: 'fas fa-rotate-right', onClick: () => this.resendToActor(messageId, actorId) });
        }
        items.push({ label: _loc('DSAQUERIES.COMMANDS.remove'), icon: 'fas fa-trash', onClick: () => this.removeActor(messageId, actorId) });

        return items;
      });
    }
  }
}