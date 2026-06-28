import QueryOrchestrator from './query-orchestrator.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import MagicAnalysisQueryService from './magic-analysis-query.js';
import MagicAnalysisContentResolver from '../magic-analysis/magic-analysis-content-resolver.js';

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
    return await renderTemplate(this.TEMPLATE, state);
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

  static async handleQuery(payload) {
    const item = await fromUuid(payload.itemUuid);
    if (!item && !payload.virtualInfo) {
      return { status: 'rejected' };
    }

    const infoSystem = await this._resolveInfoSystem(item, payload);
    const infoName = this._getInfoName(item, payload);

    const qsEntries = [];
    for (let i = 1; i <= 6; i++) {
      const text = infoSystem[`qs${i}`];
      if (text) {
        const enriched = await TextEditor.enrichHTML(text, {});
        qsEntries.push({
          qs: i,
          text: enriched,
          included: i <= payload.rolledQS,
        });
      }
    }

    let critText = null;
    let botchText = null;
    let failText = null;
    let critIncluded = false;
    let botchIncluded = false;
    let failIncluded = false;

    if (infoSystem.crit) {
      critText = await TextEditor.enrichHTML(infoSystem.crit, {});
      critIncluded = payload.successLevel > 1;
    }
    if (infoSystem.botch) {
      botchText = await TextEditor.enrichHTML(infoSystem.botch, {});
      botchIncluded = payload.successLevel < -1;
    }
    if (infoSystem.fail && !payload.rolledQS) {
      failText = await TextEditor.enrichHTML(infoSystem.fail, {});
      failIncluded = true;
    }

    const itemLink = item
      ? await item.toAnchor().outerHTML
      : `<span>${infoName}</span>`;

    const dialogData = {
      actorName: payload.actorName,
      playerName: payload.playerName,
      itemLink,
      skillName: payload.skillName,
      rolledQS: payload.rolledQS,
      qsEntries,
      critText,
      botchText,
      failText,
      critIncluded,
      botchIncluded,
      failIncluded,
    };

    const content = await renderTemplate(this.APPROVAL_TEMPLATE, dialogData);

    try {
      const result = await foundry.applications.api.DialogV2.wait({
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
      });

      if (result?.action === 'approve') {
        await this.postApprovedResult(item, payload, result.selected);
        return { status: 'approved' };
      }

      return { status: 'rejected' };
    } catch {
      return { status: 'rejected' };
    }
  }

  static async postApprovedResult(item, payload, selected) {
    const infoSystem = await this._resolveInfoSystem(item, payload);
    const infoName = this._getInfoName(item, payload);
    const msg = [];

    for (let i = 1; i <= 6; i++) {
      if (selected[`qs${i}`] && infoSystem[`qs${i}`]) {
        const enriched = await TextEditor.enrichHTML(infoSystem[`qs${i}`], {});
        msg.push(enriched);
      }
    }

    if (selected.crit && infoSystem.crit) {
      msg.push(await TextEditor.enrichHTML(infoSystem.crit, {}));
    }
    if (selected.botch && infoSystem.botch) {
      msg.push(await TextEditor.enrichHTML(infoSystem.botch, {}));
    }
    if (selected.fail && infoSystem.fail) {
      msg.push(await TextEditor.enrichHTML(infoSystem.fail, {}));
    }

    if (msg.length > 0) {
      msg.unshift(`<p><b>${infoName}</b></p>`);

      const whisperTargets = game.users.filter((user) => user.isGM).map((x) => x.id);
      if (!whisperTargets.includes(payload.playerId)) {
        whisperTargets.push(payload.playerId);
      }

      const chatData = DSA5_Utility.chatDataSetup(msg.join(''));
      chatData.whisper = whisperTargets;
      await ChatMessage.create(chatData);
    }
  }

  static async createInformationQuery(result, uuid, item, { actor, skill, virtualInfo, parentUuid } = {}) {
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
    };

    const state = {
      ...payload,
      status: 'pending',
    };

    const whisperTargets = game.users.filter((user) => user.isGM).map((x) => x.id);
    whisperTargets.push(game.user.id);

    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
      whisper: whisperTargets,
    });

    try {
      const queryResult = await QueryOrchestrator.dispatchToRecipient(
        gmUser.id,
        this.QUERY_TYPE,
        payload,
      );

      if (queryResult) {
        await QueryOrchestrator.enqueueMessageUpdate(message.id, async (currentState) => {
          currentState.status = queryResult.status || 'rejected';
          return currentState;
        });
      }
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

    const setupData = await actor.setupSkill(skill, { modifier }, tokenId);
    setupData.testData.opposable = false;
    const result = await actor.basicTest(setupData);

    await this.createInformationQuery(result, uuid, item, { actor, skill });
  }

  static async informationRequestRoll(ev) {
    const modifier = ev.currentTarget.dataset.mod;
    const uuid = ev.currentTarget.dataset.uuid;
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    const recipientsTarget = game.settings.get('dsa5', 'informationDistribution');
    let recipients = [];
    if (recipientsTarget == 1) {
      recipients = game.users.filter((user) => user.isGM).map((x) => x.id);
      recipients.push(game.user.id);
    } else if (recipientsTarget == 2) {
      recipients = game.users.filter((user) => user.isGM).map((x) => x.id);
    }
    const optns = {
      modifier,
      postFunction: {
        functionName: 'game.dsa5.queries.InformationQueryService.postInformationRoll',
        uuid,
        recipients,
      },
    };
    const skill = actor.items.find((i) => i.name == ev.currentTarget.dataset.skill && i.type == 'skill');
    actor.setupSkill(skill, optns, tokenId).then(async (setupData) => {
      setupData.testData.opposable = false;
      const res = await actor.basicTest(setupData);
      this.postInformationRoll(optns.postFunction, res);
    });
  }

  static async postInformationRoll(postFunction, result, source) {
    const msg = [];
    const item = await fromUuid(postFunction.uuid);
    if (!item) return;

    const infoSystem = item.system.subType === 'magicalAnalysis'
      ? await MagicAnalysisContentResolver.resolveRollContent(
        { ...item.system.toObject(), name: item.name },
        { parentItem: postFunction.parentUuid ? await fromUuid(postFunction.parentUuid) : null },
      )
      : item.system;

    const availableQs = result.result.qualityStep || 0;

    for (let i = 1; i <= availableQs; i++) {
      const qs = `qs${i}`;
      if (infoSystem[qs]) msg.push(infoSystem[qs]);
    }

    if (result.result.successLevel > 1 && infoSystem.crit) {
      msg.push(infoSystem.crit);
    } else if (result.result.successLevel < -1 && infoSystem.botch) {
      msg.push(infoSystem.botch);
    } else if (infoSystem.fail && !availableQs) {
      msg.push(infoSystem.fail);
    }

    if (msg.length > 0) {
      const enriched = await Promise.all(msg.map((x) => TextEditor.enrichHTML(x, {})));
      enriched.unshift(`<p><b>${item.name}</b></p>`);

      const chatData = DSA5_Utility.chatDataSetup(enriched.join(''));
      if (postFunction.recipients.length) chatData['whisper'] = postFunction.recipients;

      ChatMessage.create(chatData);
    }
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
