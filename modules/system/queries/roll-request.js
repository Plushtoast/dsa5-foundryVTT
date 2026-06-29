import QueryOrchestrator from './query-orchestrator.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import RegenerationHelper from '../rolls/regeneration-helper.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';

const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class RollRequestService {
  static QUERY_TYPE = 'dsa5.rollRequest';
  static FLAG_KEY = 'rollRequest';
  static TEMPLATE = 'systems/dsa5/templates/chat/roll/roll-request.hbs';
  static REGEN_TEMPLATE = 'systems/dsa5/templates/chat/roll/roll-request-regeneration.hbs';
  static DIALOG_TEMPLATE = 'systems/dsa5/templates/dialog/roll-request-dialog.hbs';
  static PUBLIC_MESSAGE_MODES = new Set([DICE_CONSTANTS.CHAT_MODES.PUBLIC, DICE_CONSTANTS.CHAT_MODES.IC]);

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: this.handleQuery.bind(this),
    });
  }

  static async requestRoll(name, modifier = 0, label = undefined) {
    const skill = DSA5ChatAutoCompletion.skills.find((s) => s.name === name);
    const category = skill?.type || 'skill';
    if (game.user.isGM) {
      this.openRequestDialog({ name, category, modifier, label });
    } else {
      const { default: ChatCommandService } = await import('../sidebar/chat_command_service.js');
      ChatCommandService.speakerAbilityRoll(name, category, { modifier });
    }
  }

  static async openRequestDialog({ category = 'skill', name = '', modifier = 0, label = undefined } = {}) {
    const skillOptions = DSA5ChatAutoCompletion.skills
      .filter((s) => ['skill', 'attribute', 'regeneration'].includes(s.type))
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({
        value: `${s.name}|${s.type}`,
        label: s.name,
        selected: s.name === name && s.type === category,
      }));

    const actorData = ActorPickerDialog.buildActorPickerData()
      .filter((a) => a.isPlayerOwned || a.isActiveCharacter)
      .map((a) => ({ ...a, preselected: true }));

    const header = await renderTemplate(this.DIALOG_TEMPLATE, {
      skills: skillOptions,
      modifier,
      messageMode: game.settings.get('core', 'messageMode'),
    });

    ActorPickerDialog.open({
      actors: actorData,
      title: 'ROLLREQUEST.dialogTitle',
      header,
      showSourceToggle: true,
      callback: ({ actorIds, form }) => {
        const $form = $(form);
        const skillValue = $form.find('[name="skill"]').val();
        const [selectedName, selectedType] = skillValue.split('|');
        const selectedModifier = Number($form.find('[name="modifier"]').val()) || 0;
        const messageMode = $form.find('[name="messageMode"]:checked').val() || DICE_CONSTANTS.CHAT_MODES.PUBLIC;

        const actors = actorIds.map((id) => game.actors.get(id)).filter(Boolean);
        this.createRequest({
          category: selectedType,
          name: selectedName,
          modifier: selectedModifier,
          messageMode,
          actors,
          label: selectedName !== name ? undefined : label,
        });
      },
    });
  }

  static buildTokenWhisper(token) {
    const whisper = game.users.reduce((acc, user) => {
      if (!user.isGM && user.active && token.actor?.testUserPermission(user, 'OWNER')) acc.push(user.id);
      return acc;
    }, []);
    if (whisper.length === 0) whisper.push(game.user.id);
    return whisper;
  }

  static async createTrapRequest({ trapMessage, token, name, modifier = 0, label = undefined, mode, headerHtml = undefined }) {
    const actor = token?.actor;
    if (!actor) return;

    return this.createRequest({
      category: 'skill',
      name,
      modifier,
      label,
      messageMode: DICE_CONSTANTS.CHAT_MODES.ROLL,
      actors: [actor],
      whisper: this.buildTokenWhisper(token),
      trapContext: {
        trapMessageUuid: trapMessage.uuid,
        mode,
        headerHtml,
      },
    });
  }

  static async createRequest({
    category,
    name,
    modifier = 0,
    messageMode = DICE_CONSTANTS.CHAT_MODES.PUBLIC,
    actors = [],
    label = undefined,
    trapContext = undefined,
    whisper = undefined,
    situationalModifiers = undefined,
    subtitle = undefined,
    opposable = undefined,
    flowContext = undefined,
  }) {
    const recipients = await QueryOrchestrator.buildRecipients(actors);

    const state = {
      category,
      name,
      label,
      modifier,
      messageMode,
      finalized: false,
      recipients,
      ...(trapContext ? { trapContext } : {}),
      ...(situationalModifiers ? { situationalModifiers } : {}),
      ...(subtitle ? { subtitle } : {}),
      ...(opposable !== undefined ? { opposable } : {}),
      ...(flowContext ? { flowContext } : {}),
    };

    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
      whisper,
    });

    await this.dispatch(message.id);
    return message;
  }

  static #buildQueryPayload(state, { messageId, actorId, byGM = false } = {}) {
    return {
      messageId,
      actorId,
      category: state.category,
      name: state.name,
      modifier: state.modifier,
      messageMode: state.messageMode,
      situationalModifiers: state.situationalModifiers,
      subtitle: state.subtitle,
      opposable: state.opposable,
      ...(byGM ? { byGM: true } : {}),
    };
  }

  static async renderMessage(state) {
    const template = state.category === 'regeneration' ? this.REGEN_TEMPLATE : this.TEMPLATE;
    return await renderTemplate(template, this.getTemplateData(state));
  }

  static getActorPortrait(actor) {
    if (!actor) return 'icons/svg/mystery-man.svg';
    return actor.prototypeToken?.texture?.src || actor.img || 'icons/svg/mystery-man.svg';
  }

  static getTemplateData(state) {
    const finalized = state.finalized;
    const modifierLabel = state.modifier > 0 ? `+${state.modifier}` : state.modifier < 0 ? `${state.modifier}` : '';
    const skillIcon = this.getRequestedIcon(state.category, state.name);

    const isRegeneration = state.category === 'regeneration';

    const recipients = state.recipients.map((entry) => {
      const resultLabel = isRegeneration ? '' : this.buildResultLabel(entry, state.category);
      const regenResults = isRegeneration && ['success', 'critical'].includes(entry.status)
        ? RegenerationHelper.formatResultRows(entry.resultDetails)
        : [];
      const statusStyle = QueryOrchestrator.statusStyle(entry.status);
      const regenApplied = isRegeneration && entry.status === 'success' && RegenerationHelper.isRollRequestEntryApplied(entry);
      const resultRowClass = isRegeneration ? '' : this.getResultRowClass(entry.status);
      const resultTooltip = !isRegeneration && ['success', 'critical', 'failure', 'botch'].includes(entry.status)
        ? statusStyle.label
        : '';
      const actor = game.actors.get(entry.actorId);
      return {
        ...entry,
        actorName: actor?.name || entry.actorId,
        actorImg: this.getActorPortrait(actor),
        designatedUserName: game.users.get(entry.designatedUserId)?.name || '',
        resultLabel,
        regenResults,
        regenApplied,
        resultRowClass,
        resultTooltip,
        canRoll: !finalized && entry.status === 'pending',
        canGMRoll: !finalized && !QueryOrchestrator.TERMINAL_STATES.has(entry.status) && !entry.designatedUserId,
        canGMAction: !finalized && !QueryOrchestrator.TERMINAL_STATES.has(entry.status),
      };
    });

    return {
      isGM: game.user.isGM,
      finalized,
      isRegeneration,
      skillName: state.label || state.name,
      skillIcon,
      category: state.category,
      modifierLabel,
      headerHtml: state.trapContext?.headerHtml,
      recipients,
    };
  }

  static async #submitResult(messageId, actorId, result) {
    await QueryOrchestrator.handleResult({ messageId, actorId, result });
    if (!game.user.isGM) return;

    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});

    if (QueryOrchestrator.TERMINAL_STATES.has(result.status)) {
      Hooks.callAll('dsa5.rollRequestResult', { messageId, actorId, result, state });
    }

    const trapContext = state.trapContext;
    if (!trapContext || !QueryOrchestrator.TERMINAL_STATES.has(result.status)) return;

    const { DSATrapRegionBehavior } = await import('../../data/regionbehaviors/trap.js');
    await DSATrapRegionBehavior.handleTrapRollResult({
      trapMessageUuid: trapContext.trapMessageUuid,
      mode: trapContext.mode,
      actorId,
      status: result.status,
      resultDetails: result.resultDetails,
    });
  }

  static resultMessageMode(entry, state = {}) {
    return entry.resultDetails?.messageMode || state.messageMode || DICE_CONSTANTS.CHAT_MODES.PUBLIC;
  }

  static canUserSeeResult(entry, state = {}) {
    if (!entry.resultDetails) return false;
    if (game.user.isGM) return true;

    const messageMode = this.resultMessageMode(entry, state);
    if (this.PUBLIC_MESSAGE_MODES.has(messageMode)) return true;
    if ([DICE_CONSTANTS.CHAT_MODES.GM, DICE_CONSTANTS.CHAT_MODES.SELF].includes(messageMode)) return game.actors.get(entry.actorId)?.isOwner;
    return false;
  }

  static getRequestedIcon(category, name) {
    if (category !== 'skill') return undefined;
    return DSA5ChatAutoCompletion.skills.find((entry) => entry.type === 'skill' && entry.name === name)?.img;
  }

  static getResultRowClass(status) {
    if (['success', 'critical'].includes(status)) return 'roll-request-row-success';
    if (['failure', 'botch'].includes(status)) return 'roll-request-row-failure';
    return '';
  }

  static buildResultLabel(entry, category) {
    const data = entry.resultDetails;
    const qs = data?.qualityStep || 0;
    switch (entry.status) {
      case 'success':
      case 'critical':
        if (category === 'regeneration') return RegenerationHelper.formatTooltip(data);
        return `${_loc('CHARAbbrev.QS')} ${qs}`;
      case 'failure':
        return _loc('DSAQUERIES.STATUS.failure');
      case 'botch':
        return _loc('DSAQUERIES.STATUS.botch');
      default:
        return '';
    }
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
    try {
      const result = await QueryOrchestrator.dispatchToRecipient(
        userId,
        this.QUERY_TYPE,
        this.#buildQueryPayload(state, { messageId, actorId }),
      );

      if (!result) return;
      await this.#submitResult(messageId, actorId, result);
    } catch (error) {
      console.error(`Failed to query roll request recipient ${actorId}`, error);
      await this.#submitResult(messageId, actorId, {
        userId,
        status: 'error',
      });
    }
  }

  static async handleQuery(payload) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) {
      return {
        userId: game.user.id,
        status: 'error',
      };
    }

    try {
      const options = { modifier: payload.modifier, messageMode: payload.messageMode };
      if (payload.situationalModifiers?.length) {
        options.situationalModifiers = payload.situationalModifiers;
      }
      if (payload.subtitle) {
        options.subtitle = payload.subtitle;
      }
      if (payload.messageId) {
        options.postFunction = {
          functionName: 'game.dsa5.queries.RollRequestService.postRollRequestResult',
          requestMessageId: payload.messageId,
          actorId: payload.actorId,
          category: payload.category,
          messageMode: payload.messageMode,
          ...(payload.byGM ? { byGM: true } : {}),
        };
      }
      let setupData;

      switch (payload.category) {
        case 'attribute': {
          const characteristic = Object.keys(game.dsa5.config.characteristics).find(
            (key) => _loc(game.dsa5.config.characteristics[key]) === payload.name,
          );
          if (!characteristic) {
            return { userId: game.user.id, status: 'error' };
          }
          setupData = await actor.setupCharacteristic(characteristic, options, undefined);
          break;
        }
        case 'regeneration':
          setupData = await actor.setupRegeneration('regenerate', options, undefined);
          break;
        default: {
          const skill = actor.items.find((i) => i.name === payload.name && i.type === 'skill');
          if (!skill) {
            return { userId: game.user.id, status: 'error' };
          }
          setupData = await actor.setupSkill(skill, options, undefined);
          break;
        }
      }

      if (!setupData) {
        return { userId: game.user.id, status: 'cancelled' };
      }

      if (payload.opposable === false) {
        setupData.testData.opposable = false;
      }

      const result = await actor.basicTest(setupData);
      if (!result) {
        return { userId: game.user.id, status: 'cancelled' };
      }

      return this.buildResultPayload(payload.category, result, payload.messageMode);
    } catch {
      return { userId: game.user.id, status: 'cancelled' };
    }
  }

  static buildResultPayload(category, result, messageMode = undefined) {
    const successLevel = result.result?.successLevel || 0;
    const isCrit = successLevel > 1;
    const isBotch = successLevel < -1;
    const isSuccess = successLevel > 0;

    const status = category === 'regeneration' ? 'success' : isCrit ? 'critical' : isBotch ? 'botch' : isSuccess ? 'success' : 'failure';

    const resultMessageMode = result.cardOptions?.messageMode || result.result?.messageMode || messageMode || DICE_CONSTANTS.CHAT_MODES.PUBLIC;

    return {
      userId: game.user.id,
      status,
      resultDetails: {
        qualityStep: result.result?.qualityStep || 0,
        successLevel,
        messageId: result.result?.messageId,
        messageMode: resultMessageMode,
        LeP: result.result?.LeP,
        AsP: result.result?.AsP,
        KaP: result.result?.KaP,
      },
    };
  }

  static async postRollRequestResult(postFunction, payload) {
    if (!postFunction?.requestMessageId) return;

    const result = RollRequestService.buildResultPayload(postFunction.category, payload, postFunction.messageMode);
    if (postFunction.byGM) result.resultDetails = { ...result.resultDetails, byGM: true };

    await RollRequestService.#submitResult(postFunction.requestMessageId, postFunction.actorId, result);
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

  static async rollOnBehalf(messageId, actorId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (!state?.category) return;

    const result = await this.handleQuery({
      ...this.#buildQueryPayload(state, { messageId, actorId, byGM: true }),
    });

    await this.#submitResult(messageId, actorId, {
      ...result,
      resultDetails: { ...result.resultDetails, byGM: true },
    });
  }

  static async skipActor(messageId, actorId) {
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      const recipient = state.recipients.find((entry) => entry.actorId === actorId);
      if (!recipient || state.finalized) return state;

      recipient.status = 'skipped';

      if (QueryOrchestrator.canAutoFinalize(state)) state.finalized = true;
      return state;
    });
  }

  static async finalizeRequest(messageId) {
    await QueryOrchestrator.finalizeRequest(messageId);
  }

  static async triggerRollFromCard(messageId, actorId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (!state?.category) return;

    const result = await this.handleQuery(this.#buildQueryPayload(state, { messageId, actorId }));

    await this.#submitResult(messageId, actorId, result);
  }

  static handleRenderMessage(msg, html) {
    const rollRequest = foundry.utils.getProperty(msg.message, 'flags.dsa5.rollRequest');
    if (!rollRequest) return;

    if (!game.user.isGM) {
      html.find('.roll-request-gm').remove();
    }

    html.find('.roll-request-row').each((_, element) => {
      const row = $(element);
      const entry = rollRequest.recipients?.find((recipient) => recipient.actorId === row.attr('data-actor-id'));
      if (!entry?.resultDetails) return;

      if (this.canUserSeeResult(entry, rollRequest)) {
        this.revealPrivateResult(row, entry, rollRequest.category);
        this.updateRegenAppliedRow(row, entry, rollRequest);
        return;
      }

      this.hidePrivateResult(row, rollRequest.category);
    });

    if (!game.user.isGM) {
      html.find('.roll-request-row').each(function () {
        const row = $(this);
        const actorId = row.attr('data-actor-id');
        if (!game.actors.get(actorId)?.isOwner) {
          row.find('.roll-request-action[data-action="roll"]').remove();
        }
      });
    }
  }

  static hidePrivateResult(row, category) {
    if (category === 'regeneration') {
      let stats = row.find('.roll-request-regen-stats');
      if (!stats.length) {
        stats = $('<div class="roll-request-regen-stats"></div>');
        row.find('.roll-request-row-side').prepend(stats);
      }
      stats.html('<div class="roll-request-regen-stat very-small">?</div>');
      return;
    }

    row.removeClass('roll-request-row-success roll-request-row-failure');

    let label = row.find('.roll-request-result-label');
    if (!label.length) {
      label = $('<b class="roll-request-result-label flexrow flex0 flexAlignRight"></b>');
      row.find('.roll-request-row-side').before(label);
    }
    label.text('?');
    row.attr('data-tooltip', _loc('DSAQUERIES.STATUS.accepted')).attr('aria-label', _loc('DSAQUERIES.STATUS.accepted'));
  }

  static revealPrivateResult(row, entry, category) {
    if (category === 'regeneration') {
      const regenRows = RegenerationHelper.formatResultRows(entry.resultDetails);
      if (!regenRows.length) return;

      let stats = row.find('.roll-request-regen-stats');
      if (!stats.length) {
        stats = $('<div class="roll-request-regen-stats"></div>');
        row.find('.roll-request-row-side').prepend(stats);
      }
      stats.empty();
      for (const regenRow of regenRows) {
        stats.append($(`<div class="roll-request-regen-stat very-small"><span>${regenRow.label}</span>: ${regenRow.value}</div>`));
      }
      return;
    }

    this.applyStandardResultRowState(row, entry, category);
  }

  static applyStandardResultRowState(row, entry, category) {
    row.removeClass('roll-request-row-success roll-request-row-failure');
    const rowClass = this.getResultRowClass(entry.status);
    if (rowClass) row.addClass(rowClass);

    const statusStyle = QueryOrchestrator.statusStyle(entry.status);
    const resultLabel = this.buildResultLabel(entry, category);

    if (resultLabel) {
      let label = row.find('.roll-request-result-label');
      if (!label.length) {
        label = $('<b class="roll-request-result-label flexrow flex0 flexAlignRight"></b>');
        row.find('.roll-request-row-side').before(label);
      }
      label.text(resultLabel);
    }

    if (['success', 'critical', 'failure', 'botch'].includes(entry.status)) {
      row.attr('data-tooltip', statusStyle.label).attr('aria-label', statusStyle.label);
    }
  }

  static updateRegenAppliedRow(row, entry, rollRequest) {
    if (rollRequest.category !== 'regeneration' || entry.status !== 'success') return;
    if (!RegenerationHelper.isRollRequestEntryApplied(entry)) return;

    row.addClass('regen-applied');
    row.attr('data-tooltip', _loc('ROLLREQUEST.regenApplied'));
    row.attr('aria-label', _loc('ROLLREQUEST.regenApplied'));
  }

  static chatListeners(html) {
    html.on('click', '.roll-request-action', async (event) => {
      const button = event.currentTarget;
      const action = button.dataset.action;
      const actorId = button.dataset.actorId;
      const messageId = $(button).closest('.message').attr('data-message-id');
      if (!messageId) return;

      switch (action) {
        case 'roll':
          await this.triggerRollFromCard(messageId, actorId);
          break;
        case 'rollOnBehalf':
          if (!game.user.isGM) return;
          await this.rollOnBehalf(messageId, actorId);
          break;
        case 'finalize':
          if (!game.user.isGM) return;
          await this.finalizeRequest(messageId);
          break;
      }
    });

    if (game.user.isGM) {
      QueryOrchestrator.attachRowEllipsisMenu(html, '.roll-request-menu', '.roll-request-row[data-actor-id]', (messageId, actorId, status) => {
        if (QueryOrchestrator.TERMINAL_STATES.has(status)) return [];

        return [
          { label: _loc('DSAQUERIES.COMMANDS.resend'), icon: '<i class="fas fa-rotate-right"></i>', onClick: () => this.resendToActor(messageId, actorId) },
          { label: _loc('DSAQUERIES.COMMANDS.rollOnBehalf'), icon: '<i class="fas fa-dice"></i>', onClick: () => this.rollOnBehalf(messageId, actorId) },
          { label: _loc('DSAQUERIES.COMMANDS.skip'), icon: '<i class="fas fa-forward"></i>', onClick: () => this.skipActor(messageId, actorId) },
        ];
      });
    }
  }
}
