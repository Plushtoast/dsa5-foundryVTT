import QueryOrchestrator from './query-orchestrator.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';

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

  static async handleQuery(payload) {
    const item = await fromUuid(payload.itemUuid);
    if (!item) {
      return { status: 'rejected' };
    }

    const qsEntries = [];
    for (let i = 1; i <= 6; i++) {
      const text = item.system[`qs${i}`];
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

    if (item.system.crit) {
      critText = await TextEditor.enrichHTML(item.system.crit, {});
      critIncluded = payload.successLevel > 1;
    }
    if (item.system.botch) {
      botchText = await TextEditor.enrichHTML(item.system.botch, {});
      botchIncluded = payload.successLevel < -1;
    }
    if (item.system.fail && !payload.rolledQS) {
      failText = await TextEditor.enrichHTML(item.system.fail, {});
      failIncluded = true;
    }

    const dialogData = {
      actorName: payload.actorName,
      playerName: payload.playerName,
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
          title: `${_loc('DSAQUERIES.knowledgeCheck')}: ${item.name}`,
        },
        content,
        buttons: [
          {
            action: 'approve',
            icon: 'fa fa-check',
            label: 'DSAQUERIES.approve',
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
    const msg = [];

    for (let i = 1; i <= 6; i++) {
      if (selected[`qs${i}`] && item.system[`qs${i}`]) {
        const enriched = await TextEditor.enrichHTML(item.system[`qs${i}`], {});
        msg.push(enriched);
      }
    }

    if (selected.crit && item.system.crit) {
      msg.push(await TextEditor.enrichHTML(item.system.crit, {}));
    }
    if (selected.botch && item.system.botch) {
      msg.push(await TextEditor.enrichHTML(item.system.botch, {}));
    }
    if (selected.fail && item.system.fail) {
      msg.push(await TextEditor.enrichHTML(item.system.fail, {}));
    }

    if (msg.length > 0) {
      msg.unshift(`<p><b>${item.name}</b></p>`);

      const whisperTargets = game.users.filter((user) => user.isGM).map((x) => x.id);
      if (!whisperTargets.includes(payload.playerId)) {
        whisperTargets.push(payload.playerId);
      }

      const chatData = DSA5_Utility.chatDataSetup(msg.join(''));
      chatData.whisper = whisperTargets;
      await ChatMessage.create(chatData);
    }
  }

  static async createInformationQuery(result, uuid, item) {
    const gmUser = game.users.find((user) => user.active && user.isGM);
    if (!gmUser) {
      ui.notifications.warn(_loc('DSAQUERIES.noGMOnline'));
      return;
    }

    const payload = {
      itemUuid: uuid,
      itemName: item.name,
      skillName: result.result.speaker ? result.source?.name || '' : '',
      rolledQS: result.result.qualityStep || 0,
      successLevel: result.result.successLevel || 0,
      playerId: game.user.id,
      playerName: game.user.name,
      actorName: result.result.speaker?.alias || '',
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
    const modifier = Number(ev.currentTarget.dataset.mod) || 0;
    const skillName = ev.currentTarget.dataset.skill;

    const gmOnline = game.users.some((user) => user.active && user.isGM);
    if (!gmOnline) {
      ui.notifications.warn(_loc('DSAQUERIES.noGMOnline'));
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

    await this.createInformationQuery(result, uuid, item);
  }
}
