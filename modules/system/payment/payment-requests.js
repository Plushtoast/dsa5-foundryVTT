import QueryOrchestrator from '../queries/query-orchestrator.js';
import DSA5Payment from './payment.js';

const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class PaymentRequestService {
  static QUERY_TYPE = 'dsa5.paymentRequest';
  static FLAG_KEY = 'paymentRequest';
  static TEMPLATE = 'systems/dsa5/templates/chat/payment/batch-request.hbs';
  static QUERY_TIMEOUT_MS = 120_000;
  static TERMINAL_STATES = new Set(['accepted', 'failed', 'rejected', 'skipped']);
  static STATUS_ICONS = {
    pending: 'fa-spinner fa-spin',
    accepted: 'fa-check',
    rejected: 'fa-times',
    failed: 'fa-exclamation-triangle',
    skipped: 'fa-forward',
    offline: 'fa-power-off',
    unowned: 'fa-hand-paper',
  };

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: this.handleQuery.bind(this),
    });
  }

  static activeCharacterActors() {
    const actors = new Map();
    for (const user of game.users.filter((entry) => entry.active && entry.character)) {
      actors.set(user.character.id, user.character);
    }
    return Array.from(actors.values());
  }

  static userCharacterIds() {
    return new Set(game.users.map((user) => user.character?.id).filter(Boolean));
  }

  static selectableActors(existingIds = new Set()) {
    const userCharacterIds = this.userCharacterIds();

    return game.actors.contents
      .filter((actor) => !existingIds.has(actor.id))
      .sort((left, right) => {
        const leftPriority = userCharacterIds.has(left.id) ? 2 : left.hasPlayerOwner ? 1 : 0;
        const rightPriority = userCharacterIds.has(right.id) ? 2 : right.hasPlayerOwner ? 1 : 0;

        if (leftPriority !== rightPriority) return rightPriority - leftPriority;
        return left.name.localeCompare(right.name, game.i18n.lang);
      });
  }

  static addActorDialogData(actors) {
    const userCharacterIds = this.userCharacterIds();

    return actors.map((actor) => {
      const characterUsers = game.users.filter((user) => user.character?.id === actor.id).map((user) => user.name);
      const ownerUsers = game.users.filter((user) => !user.isGM && actor.testUserPermission(user, 'OWNER')).map((user) => user.name);
      const actorTypeKey = `TYPES.Actor.${actor.type}`;
      const actorType = game.i18n.has(actorTypeKey) ? _loc(actorTypeKey) : actor.type;
      const metaParts = [];

      if (characterUsers.length) metaParts.push(characterUsers.join(', '));
      else if (ownerUsers.length) metaParts.push(ownerUsers.join(', '));
      if (actorType) metaParts.push(actorType);

      return {
        id: actor.id,
        name: actor.name,
        img: actor.img,
        meta: metaParts.join(' - '),
        isUserCharacter: userCharacterIds.has(actor.id),
      };
    });
  }

  static onActorSearchFilter(_event, query, rgx, html) {
    for (const row of html.querySelectorAll('.payment-actor-row')) {
      if (!query) {
        row.hidden = false;
        continue;
      }

      const searchable = [row.dataset.actorName || '', row.dataset.actorMeta || ''];
      row.hidden = !searchable.some((value) => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(value)));
    }
  }

  static async createRequest({ mode, amount, description = '', actors = [], source = 'generic' }) {
    const normalizedAmount = DSA5Payment.parsePaymentAmount(amount, mode, true);
    if (!normalizedAmount) return;

    const recipients = await this.buildRecipients(actors);

    const state = {
      mode,
      amount: normalizedAmount,
      description,
      source,
      requesterId: game.user.id,
      createdAt: Date.now(),
      finalizedAt: null,
      recipients,
    };

    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
    });

    await this.dispatch(message.id);
    return message;
  }

  static async buildRecipients(actors) {
    const recipients = [];
    const seen = new Set();

    for (const actor of actors.filter(Boolean)) {
      if (seen.has(actor.id)) continue;
      seen.add(actor.id);

      const { designatedUser, status } = QueryOrchestrator.resolveDesignatedUser(actor);
      recipients.push({
        actorId: actor.id,
        actorName: actor.name,
        designatedUserId: designatedUser?.id || null,
        designatedUserName: designatedUser?.name || '',
        status,
        resultMessage: status === 'offline' ? _loc('PAYMENT.statusOfflineInfo') : status === 'unowned' ? _loc('PAYMENT.statusUnownedInfo') : '',
        respondedAt: null,
      });
    }

    return recipients;
  }

  static async renderMessage(state) {
    return await renderTemplate(this.TEMPLATE, await this.getTemplateData(state));
  }

  static async getTemplateData(state) {
    const amountString = await DSA5Payment._moneyToString(state.amount);
    const finalized = !!state.finalizedAt;
    const recipients = state.recipients.map((entry) => ({
      ...entry,
      statusLabel: _loc(`PAYMENT.status${entry.status[0].toUpperCase()}${entry.status.slice(1)}`),
      statusIcon: this.getStatusIcon(entry),
      statusIconClass: this.getStatusIconClass(entry),
      statusTooltip: _loc(`PAYMENT.status${entry.status[0].toUpperCase()}${entry.status.slice(1)}`),
      resultTooltip: this.asPlainTooltip(entry.resultMessage),
      resultTooltipHtml: entry.resultMessage || '',
      hasResultDetails: !!(entry.resultMessage || '').trim(),
      canResend: !finalized && !!entry.designatedUserId && entry.status !== 'accepted',
      canExecute: !finalized && entry.status !== 'accepted',
      canRemove: !finalized,
    }));

    return {
      isGM: game.user.isGM,
      finalized,
      title: _loc(state.mode === 'pay' ? 'PAYMENT.requestTitlePay' : 'PAYMENT.requestTitleGetPaid'),
      amount: amountString,
      description: state.description,
      recipients,
    };
  }

  static asPlainTooltip(value) {
    if (!value) return '';

    const rawValue = String(value);
    if (!rawValue.trim()) return '';

    if (globalThis.document?.createElement) {
      const element = document.createElement('div');
      element.innerHTML = rawValue;
      return element.textContent?.replace(/\s+/g, ' ').trim() || '';
    }

    return rawValue.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  static getStatusIcon(entry) {
    if (entry.status === 'failed') {
      return entry.resultKind === 'unpaid' ? 'fa-times' : 'fa-exclamation-triangle';
    }

    return this.STATUS_ICONS[entry.status] || 'fa-circle-question';
  }

  static getStatusIconClass(entry) {
    switch (entry.status) {
      case 'accepted':
        return 'icon-green';
      case 'rejected':
        return 'icon-red';
      case 'failed':
        return entry.resultKind === 'unpaid' ? 'icon-red' : 'icon-yellow';
      case 'offline':
      case 'unowned':
      case 'skipped':
        return 'icon-yellow';
      case 'pending':
      default:
        return 'icon-gray';
    }
  }

  static classifyExecutionResult(result) {
    if (result?.success) return 'success';
    if (result?.money && result?.actorsMoney) return 'unpaid';
    return 'issue';
  }

  static async dispatch(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (!state?.recipients) return;

    for (const recipient of state.recipients) {
      if (!recipient.designatedUserId || recipient.status !== 'pending') continue;

      await this.dispatchRecipientQuery(messageId, recipient.actorId, recipient.designatedUserId, state);
    }
  }

  static async dispatchRecipientQuery(messageId, actorId, userId, state) {
    try {
      const result = await QueryOrchestrator.dispatchToRecipient(
        userId,
        this.QUERY_TYPE,
        {
          messageId,
          actorId,
          mode: state.mode,
          amount: state.amount,
          description: state.description,
        },
        {
          timeout: this.QUERY_TIMEOUT_MS,
        },
      );

      if (!result) return;
      await this.handleResult({ messageId, actorId, result });
    } catch (error) {
      console.error(`Failed to query payment recipient ${actorId}`, error);
      await this.handleResult({
        messageId,
        actorId,
        result: {
          userId,
          status: 'failed',
          resultKind: 'issue',
          reason: _loc('PAYMENT.requestQueryFailed'),
          respondedAt: Date.now(),
        },
      });
    }
  }

  static async handleQuery(payload) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) {
      return {
        userId: game.user.id,
        status: 'failed',
        resultKind: 'issue',
        reason: _loc('PAYMENT.noActor'),
        respondedAt: Date.now(),
      };
    }

    const confirmed = await this.promptRecipient(actor, payload.mode, payload.amount, payload.description);
    if (!confirmed) {
      return {
        userId: game.user.id,
        status: 'rejected',
        resultKind: 'unpaid',
        reason: _loc('PAYMENT.requestDeclined'),
        respondedAt: Date.now(),
      };
    }

    const result = await DSA5Payment.executePayment(actor, payload.mode, payload.amount, {
      silent: true,
      render: true,
      showChatMessage: false,
      notifyOnFailure: payload.mode === 'pay',
    });

    return {
      userId: game.user.id,
      status: result.success ? 'accepted' : 'failed',
      resultKind: this.classifyExecutionResult(result),
      reason: result.msg,
      respondedAt: Date.now(),
    };
  }

  static async promptRecipient(actor, mode, amount, description) {
    const amountString = await DSA5Payment._moneyToString(amount);
    const content = `
      <p>${_loc(mode === 'pay' ? 'PAYMENT.requestPromptPay' : 'PAYMENT.requestPromptGetPaid', { actor: actor.name, amount: amountString })}</p>
      ${description ? `<p><i>${description}</i></p>` : ''}
    `;

    try {
      return await foundry.applications.api.DialogV2.wait({
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
      });
    } catch {
      return false;
    }
  }

  static async handleResult({ messageId, actorId, result }) {
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      const recipient = state.recipients.find((entry) => entry.actorId === actorId);
      if (!recipient || state.finalizedAt) return state;

      recipient.status = result.status;
      recipient.resultKind = result.resultKind || null;
      recipient.resultMessage = result.reason || '';
      recipient.respondedAt = result.respondedAt || Date.now();
      recipient.designatedUserId = recipient.designatedUserId || result.userId || null;
      recipient.designatedUserName = recipient.designatedUserName || game.users.get(result.userId)?.name || recipient.designatedUserName;

      if (this.canAutoFinalize(state)) state.finalizedAt = Date.now();
      return state;
    });
  }

  static canAutoFinalize(state) {
    return state.recipients.every((entry) => this.TERMINAL_STATES.has(entry.status));
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
    });

    await this.handleResult({
      messageId,
      actorId,
      result: {
        userId: game.user.id,
        status: result.success ? 'accepted' : 'failed',
        resultKind: this.classifyExecutionResult(result),
        reason: result.success ? _loc('PAYMENT.requestExecutedByGM') : result.msg,
        respondedAt: Date.now(),
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
      if (!currentRecipient || currentState.finalizedAt) return currentState;

      currentRecipient.designatedUserId = designatedUser?.id || null;
      currentRecipient.designatedUserName = designatedUser?.name || '';
      currentRecipient.status = status;
      currentRecipient.resultKind = null;
      currentRecipient.resultMessage = status === 'pending' ? '' : status === 'offline' ? _loc('PAYMENT.statusOfflineInfo') : _loc('PAYMENT.statusUnownedInfo');
      currentRecipient.respondedAt = null;
      return currentState;
    });

    if (designatedUser) {
      await this.dispatchRecipientQuery(messageId, actorId, designatedUser.id, state);
    }
  }

  static async removeActor(messageId, actorId) {
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      if (state.finalizedAt) return state;
      state.recipients = state.recipients.filter((entry) => entry.actorId !== actorId);
      if (!state.recipients.length) state.finalizedAt = Date.now();
      return state;
    });
  }

  static async finalizeRequest(messageId) {
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      state.finalizedAt = state.finalizedAt || Date.now();
      return state;
    });
  }

  static async addActors(messageId, actorIds) {
    const actors = actorIds.map((id) => game.actors.get(id)).filter(Boolean);
    if (!actors.length) return;

    const newRecipients = await this.buildRecipients(actors);
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      if (!state.recipients) state.recipients = [];
      const existingIds = new Set(state.recipients.map((entry) => entry.actorId));
      for (const recipient of newRecipients) {
        if (!existingIds.has(recipient.actorId)) state.recipients.push(recipient);
      }
      state.finalizedAt = null;
      return state;
    });

    const message = game.messages.get(messageId);
    const updatedState = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    for (const recipient of updatedState.recipients.filter((entry) => actorIds.includes(entry.actorId) && entry.designatedUserId && entry.status === 'pending')) {
      await this.dispatchRecipientQuery(messageId, recipient.actorId, recipient.designatedUserId, updatedState);
    }
  }

  static async openAddActorDialog(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const existingIds = new Set((state.recipients || []).map((entry) => entry.actorId));
    const candidates = this.selectableActors(existingIds);
    if (!candidates.length) {
      ui.notifications.info('PAYMENT.requestNoAvailableActors', { localize: true });
      return;
    }

    const content = document.createElement('div');
    content.innerHTML = await renderTemplate('systems/dsa5/templates/dialog/payment-add-actor-dialog.hbs', {
      actors: this.addActorDialogData(candidates),
    });

    let actorIds = [];
    try {
      actorIds = (await foundry.applications.api.DialogV2.wait({
        window: {
          title: 'PAYMENT.requestAddActor',
        },
        content,
        render: (_event, dialog) => {
          const searchFilter = new foundry.applications.ux.SearchFilter({
            inputSelector: 'input.actorsearch[type=search]',
            contentSelector: '.payment-actor-list',
            callback: this.onActorSearchFilter.bind(this),
          });
          searchFilter.bind(dialog.element);

          dialog.element.querySelectorAll('.payment-actor-row').forEach((row) => {
            row.addEventListener('click', (event) => {
              if (event.target.closest('.payment-actor-selector')) return;

              const checkbox = row.querySelector('.payment-actor-selector');
              if (checkbox) checkbox.checked = !checkbox.checked;
            });
          });
        },
        buttons: [
          {
            action: 'confirm',
            icon: 'fa fa-check',
            label: 'yes',
            default: true,
            callback: (_event, button, dialog) => {
              const form = button.form || dialog.form || dialog.element;
              return Array.from(form.querySelectorAll('input[name="paymentActor"]:checked')).map((entry) => entry.value);
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => [],
          },
        ],
      })) || [];
    } catch {
      actorIds = [];
    }

    if (Array.isArray(actorIds) && actorIds.length) await this.addActors(messageId, actorIds);
  }

  static async chatListeners(html) {
    html.on('click', '.payment-request-action', async (event) => {
      event.preventDefault();
      if (!game.user.isGM) return;

      const button = event.currentTarget;
      const action = button.dataset.action;
      const actorId = button.dataset.actorId;
      const messageId = $(button).closest('.message').attr('data-message-id');
      if (!messageId) return;

      switch (action) {
        case 'execute':
          await this.executeForActor(messageId, actorId);
          break;
        case 'resend':
          await this.resendToActor(messageId, actorId);
          break;
        case 'remove':
          await this.removeActor(messageId, actorId);
          break;
        case 'add':
          await this.openAddActorDialog(messageId);
          break;
        case 'finalize':
          await this.finalizeRequest(messageId);
          break;
      }
    });
  }
}