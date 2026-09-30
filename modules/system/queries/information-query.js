import QueryOrchestrator from './query-orchestrator.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import MagicAnalysisQueryService from './magic-analysis-query.js';
import MagicAnalysisContentResolver from '../magic-analysis/magic-analysis-content-resolver.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';

const { duplicate } = foundry.utils;

const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class InformationQueryService {
  static QUERY_TYPE = 'dsa5.informationQuery';
  static FLAG_KEY = 'informationQuery';
  static TEMPLATE = 'systems/dsa5/templates/chat/information/query-result.hbs';
  static APPROVAL_TEMPLATE = 'systems/dsa5/templates/chat/information/query-approval.hbs';

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: this.handleQuery.bind(this),
    });
  }

  static async renderMessage(state) {
    return await renderTemplate(this.TEMPLATE, {
      ...state,
      ...this.#outcomeDisplay(state.successLevel),
    });
  }

  static #outcomeDisplay(successLevel = 0) {
    const outcome = QueryOrchestrator.outcomeDisplay({ successLevel });
    if (!['critical', 'botch'].includes(outcome.status)) {
      return { resultRowClass: '', resultTooltip: '', resultSubLabel: '' };
    }
    return {
      resultRowClass: outcome.resultRowClass,
      resultTooltip: outcome.resultTooltip,
      resultSubLabel: outcome.resultSubLabel,
    };
  }

  static _getInfoSystem(item, payload) {
    if (payload.virtualInfo) return payload.virtualInfo;
    return item?.system || {};
  }

  static async _resolveInfoSystem(item, payload) {
    if (payload.virtualInfo) return payload.virtualInfo;

    const infoSystem = item?.system?.toObject?.() ?? duplicate(item?.system || {});
    if (infoSystem.subType !== 'magicalAnalysis') return infoSystem;

    let parentItem = null;
    if (payload.parentUuid) parentItem = await fromUuid(payload.parentUuid);

    return MagicAnalysisContentResolver.resolveRollContent(
      { ...infoSystem, name: item?.name },
      { parentItem },
    );
  }

  static _getInfoName(item, payload) {
    if (payload.virtualInfo?.name) return payload.virtualInfo.name;
    return item?.name || '';
  }

  static #fieldSources(infoSystem, key) {
    const custom = infoSystem[key]?.trim() || '';
    const rules = infoSystem.rulesSummary?.[key]?.trim() || '';
    return { custom, rules };
  }

  static async #enrichCombined(custom, rules) {
    const parts = [];
    if (custom) parts.push(await TextEditor.enrichHTML(custom, {}));
    if (rules) parts.push(await TextEditor.enrichHTML(rules, {}));
    return parts.join('') || null;
  }

  static #listItemHtml(html) {
    const trimmed = (html || '').trim();
    const match = trimmed.match(/^<p>([\s\S]*)<\/p>$/i);
    if (match && !/<p[\s>]/i.test(match[1])) return match[1];
    return trimmed;
  }

  static async buildApprovalData(infoSystem, { rolledQS, successLevel }) {
    const qsEntries = [];
    for (let i = 1; i <= 6; i++) {
      const { custom, rules } = this.#fieldSources(infoSystem, `qs${i}`);
      if (!custom && !rules) continue;
      qsEntries.push({
        qs: i,
        text: await this.#enrichCombined(custom, rules),
        included: i <= rolledQS,
      });
    }

    let critText = null;
    let botchText = null;
    let failText = null;
    let critIncluded = false;
    let botchIncluded = false;
    let failIncluded = false;

    const crit = this.#fieldSources(infoSystem, 'crit');
    if (crit.custom || crit.rules) {
      critText = await this.#enrichCombined(crit.custom, crit.rules);
      critIncluded = successLevel > 1;
    }
    const botch = this.#fieldSources(infoSystem, 'botch');
    if (botch.custom || botch.rules) {
      botchText = await this.#enrichCombined(botch.custom, botch.rules);
      botchIncluded = successLevel < -1;
    }
    const fail = this.#fieldSources(infoSystem, 'fail');
    if ((fail.custom || fail.rules) && !rolledQS) {
      failText = await this.#enrichCombined(fail.custom, fail.rules);
      failIncluded = true;
    }

    return {
      qsEntries,
      critText,
      botchText,
      failText,
      critIncluded,
      botchIncluded,
      failIncluded,
      rolledQS,
      successLevel,
    };
  }

  static async buildApprovedResultHtml(infoSystem, selected, infoName) {
    const customParts = [];
    const rulesParts = [];
    const keys = [];

    for (let i = 1; i <= 6; i++) {
      if (selected[`qs${i}`]) keys.push(`qs${i}`);
    }
    if (selected.crit) keys.push('crit');
    if (selected.botch) keys.push('botch');
    if (selected.fail) keys.push('fail');

    for (const key of keys) {
      const { custom, rules } = this.#fieldSources(infoSystem, key);
      if (custom) customParts.push(await TextEditor.enrichHTML(custom, {}));
      if (rules) rulesParts.push(await TextEditor.enrichHTML(rules, {}));
    }

    if (!customParts.length && !rulesParts.length) return '';

    let html = `<p><b>${infoName}</b></p>${customParts.join('')}`;
    if (rulesParts.length) {
      html += `<p><b>${_loc('MAGICANALYSIS.rulesSummary')}</b></p>`;
      html += `<ul class="dsalist">${rulesParts.map((part) => `<li>${this.#listItemHtml(part)}</li>`).join('')}</ul>`;
    }
    return html;
  }

  static async promptApprovalDialog({ dialogData, infoName, approvalData, signal } = {}) {
    const content = await renderTemplate(this.APPROVAL_TEMPLATE, dialogData);
    const { qsEntries, critText, botchText, failText } = approvalData;

    try {
      const result = await QueryOrchestrator.waitDialog({
        window: {
          title: `${_loc('DSAQUERIES.INFORMATIONREQUEST.knowledgeCheck')}: ${infoName}`,
          resizable: true,
        },
        content,
        position: {
          width: 600,
        },
        buttons: [
          {
            action: 'approve',
            icon: 'fa fa-check',
            label: 'DSAQUERIES.COMMANDS.approve',
            default: true,
            callback: (_event, button) => {
              const form = button.form || button.closest('form');
              const selected = {};
              for (const entry of qsEntries) {
                selected[`qs${entry.qs}`] = form.querySelector(`[name="qs${entry.qs}"]`)?.checked || false;
              }
              if (critText) selected.crit = form.querySelector('[name="crit"]')?.checked || false;
              if (botchText) selected.botch = form.querySelector('[name="botch"]')?.checked || false;
              if (failText) selected.fail = form.querySelector('[name="fail"]')?.checked || false;
              return { action: 'approve', selected };
            },
          },
          {
            action: 'reject',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => ({ action: 'reject' }),
          },
        ],
      }, { signal });

      if (signal?.aborted || result == null) return { status: 'expired' };

      if (result?.action === 'approve') {
        return { status: 'approved', selected: result.selected };
      }

      return { status: 'rejected' };
    } catch {
      return { status: 'rejected' };
    }
  }

  static async handleQuery(payload, queryContext = {}) {
    return QueryOrchestrator.runWithClientExpiry(
      (signal) => this.#executeInformationQuery(payload, signal),
      queryContext,
    );
  }

  static async #executeInformationQuery(payload, signal) {
    const item = await fromUuid(payload.itemUuid);
    if (!item && !payload.virtualInfo) {
      return { status: 'rejected' };
    }

    const infoSystem = await this._resolveInfoSystem(item, payload);
    const infoName = this._getInfoName(item, payload);

    const approvalData = await this.buildApprovalData(infoSystem, {
      rolledQS: payload.rolledQS,
      successLevel: payload.successLevel,
    });

    const itemLink = item
      ? await item.toAnchor().outerHTML
      : `<span>${infoName}</span>`;

    const dialogData = {
      actorName: payload.actorName,
      playerName: payload.playerName,
      itemLink,
      skillName: payload.skillName,
      ...approvalData,
      ...this.#outcomeDisplay(payload.successLevel),
    };

    const result = await this.promptApprovalDialog({ dialogData, infoName, approvalData, signal });
    if (result.status === 'expired' || signal?.aborted) return null;

    if (result.status === 'approved') {
      await this.postApprovedResult(item, payload, result.selected);
      return { status: 'approved' };
    }

    return { status: 'rejected' };
  }

  static PUBLIC_MESSAGE_MODES = new Set([DICE_CONSTANTS.CHAT_MODES.PUBLIC, DICE_CONSTANTS.CHAT_MODES.IC]);
  static RESULT_MESSAGE_FLAG = 'informationResultMessageId';
  static QUERY_MESSAGE_FLAG = 'informationQueryMessageId';

  /**
   * QS / success / roll message id from a basicTest return or a fate/edit postFunction payload.
   * `payload.result.result` may be leftover FW (a number) and must not replace qualityStep.
   */
  static rollOutcome(payload) {
    const rollResult = payload?.result && typeof payload.result === 'object' ? payload.result : (payload ?? {});
    return {
      messageId: rollResult.messageId || null,
      qualityStep: Number(rollResult.qualityStep) || 0,
      successLevel: Number(rollResult.successLevel) || 0,
    };
  }

  static autoSelectedInfoKeys(rolledQS, successLevel) {
    const selected = {};
    const qs = Number(rolledQS) || 0;
    const level = Number(successLevel) || 0;
    for (let i = 1; i <= qs; i++) selected[`qs${i}`] = true;
    if (level > 1) selected.crit = true;
    else if (level < -1) selected.botch = true;
    else if (!qs) selected.fail = true;
    return selected;
  }

  static informationPostFunction({ uuid, parentUuid, messageMode, playerId } = {}) {
    return {
      functionName: 'game.dsa5.queries.InformationQueryService.postInformationRoll',
      uuid,
      parentUuid: parentUuid || null,
      messageMode,
      recipients: InformationQueryService.getInformationResultRecipients(playerId || game.user.id, messageMode),
    };
  }

  static async persistRollLink(rollMessageId, patch = {}) {
    const message = game.messages.get(rollMessageId);
    if (!message) return;

    const current = foundry.utils.getProperty(message, 'flags.data.preData.extra.options.postFunction') || {};
    const update = {
      'flags.data.preData.extra.options.postFunction': { ...current, ...patch },
    };
    if (patch.resultMessageId) update[`flags.dsa5.${InformationQueryService.RESULT_MESSAGE_FLAG}`] = patch.resultMessageId;
    if (patch.queryMessageId) update[`flags.dsa5.${InformationQueryService.QUERY_MESSAGE_FLAG}`] = patch.queryMessageId;
    await message.update(update);
  }

  static resolveLinkedIds(postFunction, rollMessageId) {
    const roll = game.messages.get(rollMessageId);
    return {
      resultMessageId: postFunction?.resultMessageId || roll?.getFlag('dsa5', InformationQueryService.RESULT_MESSAGE_FLAG),
      queryMessageId: postFunction?.queryMessageId || roll?.getFlag('dsa5', InformationQueryService.QUERY_MESSAGE_FLAG),
    };
  }

  static async upsertResultMessage(postFunction, resultHtml, rollMessageId) {
    if (!resultHtml) return null;

    const existing = postFunction?.resultMessageId && game.messages.get(postFunction.resultMessageId);
    if (existing) {
      await existing.update({ content: resultHtml });
      return existing;
    }

    const chatData = DSA5_Utility.chatDataSetup(resultHtml, postFunction.messageMode);
    if (postFunction.recipients?.length) chatData.whisper = [...postFunction.recipients];
    const created = await ChatMessage.create(chatData);
    if (rollMessageId && created?.id) {
      await InformationQueryService.persistRollLink(rollMessageId, { resultMessageId: created.id });
    }
    return created;
  }

  static readMessageMode(form, fallback = DICE_CONSTANTS.CHAT_MODES.PUBLIC) {
    return form?.querySelector?.('[name="messageMode"]:checked')?.value || fallback;
  }

  static async renderMessageModeHeader(messageMode = game.settings.get('core', 'messageMode')) {
    return renderTemplate('systems/dsa5/templates/dialog/parts/message-mode-row.hbs', { messageMode });
  }

  static #gmIds() {
    return game.users.filter((user) => user.isGM).map((user) => user.id);
  }

  static #withPlayer(playerId, ids) {
    if (playerId && !ids.includes(playerId)) ids.push(playerId);
    return ids;
  }

  /**
   * World `informationDistribution` audience.
   * @returns {string[]|null} `null` = unrestricted (everyone)
   */
  static #distributionRecipients(playerId) {
    const mode = String(game.settings.get('dsa5', 'informationDistribution'));
    if (mode === '1') return this.#withPlayer(playerId, this.#gmIds());
    if (mode === '2') return this.#gmIds();
    return null;
  }

  /**
   * Extra restriction from the roll / GM start dialog.
   * Public / IC / roll do not widen the world setting.
   * @returns {string[]|null} `null` = no extra restriction
   */
  static #messageModeRecipients(playerId, messageMode) {
    if (!messageMode) return null;
    const modes = DICE_CONSTANTS.CHAT_MODES;
    if (this.PUBLIC_MESSAGE_MODES.has(messageMode) || messageMode === modes.ROLL) return null;
    if (messageMode === modes.BLIND) return this.#gmIds();
    if (messageMode === modes.SELF) return [playerId || game.user.id];
    if (messageMode === modes.GM) return this.#withPlayer(playerId, this.#gmIds());
    return null;
  }

  /**
   * Recipients for information result messages.
   * World `informationDistribution` is the maximum audience.
   * Per-request `messageMode` may further restrict that audience, never expand it.
   * Empty array = public (everyone). Otherwise whisper to those user ids.
   * @param {string} [playerId] Rolling / designated player user id
   * @param {string} [messageMode] Foundry chat mode from the GM start dialog / roll
   * @returns {string[]}
   */
  static getInformationResultRecipients(playerId, messageMode) {
    const distribution = this.#distributionRecipients(playerId);
    const fromMode = this.#messageModeRecipients(playerId, messageMode);
    if (fromMode == null) return distribution ?? [];
    if (distribution == null) return fromMode;
    const intersected = fromMode.filter((id) => distribution.includes(id));
    return intersected.length ? intersected : distribution;
  }

  /**
   * Whether the given user may see an information / magical-analysis result.
   * @param {string} [playerId] Rolling / designated player user id
   * @param {User} [user]
   * @param {string} [messageMode]
   */
  static canViewInformationResult(playerId, user = game.user, messageMode) {
    if (user.isGM) return true;
    const recipients = this.getInformationResultRecipients(playerId, messageMode);
    if (!recipients.length) return true;
    return recipients.includes(user.id);
  }

  static messageModeFromEvent(ev) {
    const button = ev.currentTarget;
    if (button.dataset.messageMode) return button.dataset.messageMode;
    const messageId = button.closest('.message')?.dataset.messageId;
    return game.messages.get(messageId)?.getFlag('dsa5', 'informationRequest')?.messageMode;
  }

  static async postApprovedResult(item, payload, selected) {
    const infoSystem = await this._resolveInfoSystem(item, payload);
    const infoName = this._getInfoName(item, payload);
    const resultHtml = await this.buildApprovedResultHtml(infoSystem, selected, infoName);
    if (!resultHtml) return;

    await this.upsertResultMessage({
      resultMessageId: payload.resultMessageId,
      messageMode: payload.messageMode,
      recipients: this.getInformationResultRecipients(payload.playerId, payload.messageMode),
    }, resultHtml, payload.rollMessageId);
  }

  static async createInformationQuery(result, uuid, item, { actor, skill, virtualInfo, parentUuid, messageMode } = {}) {
    const gmUser = game.users.find((user) => user.active && user.isGM);
    if (!gmUser) {
      ui.notifications.warn(_loc('DSAQUERIES.NOTIFICATIONS.noGMOnline'));
      return;
    }

    const infoName = virtualInfo?.name || item?.name || '';
    const payload = {
      itemUuid: uuid,
      itemName: infoName,
      skillName: skill?.name || virtualInfo?.skill || item?.system?.skill || '',
      rolledQS: result.result.qualityStep || 0,
      successLevel: result.result.successLevel || 0,
      playerId: game.user.id,
      playerName: game.user.name,
      actorName: actor?.name || result.result.speaker?.alias || '',
      virtualInfo,
      parentUuid: parentUuid || null,
      messageMode: messageMode || result.cardOptions?.messageMode,
      rollMessageId: result.result?.messageId || null,
    };

    const state = {
      ...payload,
      status: 'pending',
    };

    const whisperTargets = game.users.filter((user) => user.isGM).map((x) => x.id);
    if (payload.messageMode !== DICE_CONSTANTS.CHAT_MODES.BLIND) {
      whisperTargets.push(game.user.id);
    }

    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
      whisper: whisperTargets,
    });
    payload.queryMessageId = message?.id;
    if (payload.rollMessageId && message?.id) {
      await this.persistRollLink(payload.rollMessageId, {
        queryMessageId: message.id,
        uuid,
        parentUuid: parentUuid || null,
        virtualInfo,
        messageMode: payload.messageMode,
        recipients: this.getInformationResultRecipients(payload.playerId, payload.messageMode),
      });
    }

    try {
      await QueryOrchestrator.dispatchRecipientQuery({
        userId: gmUser.id,
        queryType: this.QUERY_TYPE,
        payload,
        label: 'Information query',
        onResult: async (queryResult) => {
          await QueryOrchestrator.enqueueMessageUpdate(message.id, async (currentState) => {
            currentState.status = queryResult.status || 'rejected';
            return currentState;
          });
        },
        onHardError: async () => {
          await QueryOrchestrator.enqueueMessageUpdate(message.id, async (currentState) => {
            currentState.status = 'rejected';
            return currentState;
          });
        },
      });
      // Soft expiry leaves status pending so the GM can still resolve via chat / resend later.
    } catch (error) {
      console.error('Information query dispatch failed', error);
      await QueryOrchestrator.enqueueMessageUpdate(message.id, async (currentState) => {
        currentState.status = 'rejected';
        return currentState;
      });
    }
  }

  static async informationEnricherRoll(ev) {
    const uuid = ev.currentTarget.dataset.uuid;
    const subType = ev.currentTarget.dataset.subtype;

    if (subType === 'magicalAnalysis') {
      const gmOnline = game.users.some((user) => user.active && user.isGM);
      if (!gmOnline) {
        ui.notifications.warn(_loc('DSAQUERIES.NOTIFICATIONS.noGMOnline'));
        return;
      }
      const parentUuid = ev.currentTarget.dataset.parentUuid;
      await MagicAnalysisQueryService.openStartDialog({
        informationUuid: uuid,
        parentUuid: parentUuid || undefined,
      });
      return;
    }

    const modifier = Number(ev.currentTarget.dataset.mod) || 0;
    const skillName = ev.currentTarget.dataset.skill;

    const gmOnline = game.users.some((user) => user.active && user.isGM);
    if (!gmOnline) {
      ui.notifications.warn(_loc('DSAQUERIES.NOTIFICATIONS.noGMOnline'));
      return;
    }

    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const item = await fromUuid(uuid);
    if (!item) return;

    const skill = actor.items.find((i) => i.name == skillName && i.type == 'skill');
    if (!skill) {
      ui.notifications.error('DSAError.elementNotFound', { format: { element: skillName }, localize: true });
      return;
    }

    const setupData = await actor.setupSkill(skill, {
      modifier,
      postFunction: this.informationPostFunction({ uuid }),
    }, tokenId);
    if (!setupData) return;
    setupData.testData.opposable = false;
    const result = await actor.basicTest(setupData);
    if (!result) return;

    await this.createInformationQuery(result, uuid, item, {
      actor,
      skill,
      messageMode: result.cardOptions?.messageMode,
    });
  }

  static async informationRequestRoll(ev) {
    const modifier = ev.currentTarget.dataset.mod;
    const uuid = ev.currentTarget.dataset.uuid;
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const messageMode = this.messageModeFromEvent(ev);
    const optns = {
      modifier,
      ...(messageMode ? { messageMode } : {}),
      postFunction: this.informationPostFunction({ uuid, messageMode }),
    };
    const skill = actor.items.find((i) => i.name == ev.currentTarget.dataset.skill && i.type == 'skill');
    actor.setupSkill(skill, optns, tokenId).then(async (setupData) => {
      if (!setupData) return;
      setupData.testData.opposable = false;
      const res = await actor.basicTest(setupData);
      if (!res) return;
      InformationQueryService.postInformationRoll(optns.postFunction, res);
    });
  }

  static async postInformationRoll(postFunction, payload, _source) {
    if (!postFunction?.uuid && !postFunction?.virtualInfo) return;

    // Unbound: DiceDSA5.invokeRerenderPostFunction calls this without a receiver.
    // Resolve through the same global path as functionName so this is never required.
    const Service = game.dsa5.queries.InformationQueryService;
    const outcome = Service.rollOutcome(payload);
    const linked = Service.resolveLinkedIds(postFunction, outcome.messageId);
    const next = { ...postFunction, ...linked };

    if (next.queryMessageId) {
      await Service.refreshInformationQuery(next, outcome);
      return;
    }

    await Service.publishInformationResult(next, outcome);
  }

  static async refreshInformationQuery(postFunction, outcome) {
    const queryMessage = game.messages.get(postFunction.queryMessageId);
    const state = queryMessage?.getFlag('dsa5', InformationQueryService.FLAG_KEY);

    if (state?.status === 'pending') {
      await QueryOrchestrator.enqueueMessageUpdate(postFunction.queryMessageId, async (currentState) => {
        currentState.rolledQS = outcome.qualityStep;
        currentState.successLevel = outcome.successLevel;
        return currentState;
      });
      return;
    }

    if (state && state.status !== 'approved') return;

    await InformationQueryService.publishInformationResult(postFunction, outcome);
  }

  static async publishInformationResult(postFunction, outcome) {
    const item = postFunction.uuid ? await fromUuid(postFunction.uuid) : null;
    if (!item && !postFunction.virtualInfo) return;

    const infoSystem = await InformationQueryService._resolveInfoSystem(item, {
      parentUuid: postFunction.parentUuid,
      virtualInfo: postFunction.virtualInfo,
    });
    const infoName = InformationQueryService._getInfoName(item, { virtualInfo: postFunction.virtualInfo || infoSystem });
    const selected = InformationQueryService.autoSelectedInfoKeys(outcome.qualityStep, outcome.successLevel);
    const resultHtml = await InformationQueryService.buildApprovedResultHtml(infoSystem, selected, infoName);
    if (!resultHtml) return;

    await InformationQueryService.upsertResultMessage(postFunction, resultHtml, outcome.messageId);
  }

  static chatListeners(html) {
    html.on('click', '.informationRequestRoll', (ev) => this.informationRequestRoll(ev));
  }

  static handlePreviewClick(ev, root) {
    const requestRoll = ev.target.closest('.informationRequestRoll');
    if (requestRoll && root.contains(requestRoll)) {
      void this.informationRequestRoll(ev);
      return true;
    }

    const enricherRoll = ev.target.closest('.informationEnricherRoll');
    if (enricherRoll && root.contains(enricherRoll)) {
      void this.informationEnricherRoll(ev);
      return true;
    }

    return false;
  }
}
