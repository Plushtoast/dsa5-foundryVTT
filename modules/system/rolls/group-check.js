import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import GroupCheckConfigDialog from '../../dialog/group-check-dialog.js';
import { RollDialogBuilder } from '../../dialog/dialog-builder.js';
import QueryOrchestrator from '../queries/query-orchestrator.js';

const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export default class GroupCheck {
  static #updateSemaphore = new foundry.utils.Semaphore(1);
  static DIALOG_TEMPLATE = 'systems/dsa5/templates/dialog/group-check-dialog.hbs';
  static SKILL_ROW_TEMPLATE = 'systems/dsa5/templates/dialog/parts/group-check-skill-row.hbs';

  static #dialogId(messageId) {
    return messageId ? `dsa-group-check-config-${messageId}` : 'dsa-group-check-config';
  }

  static #enrichResultsForDisplay(results = []) {
    return results.map((item) => {
      const detail = `${item.qs} ${_loc('CHARAbbrev.QS')} ${item.target}`;
      const outcome = QueryOrchestrator.outcomeDisplay({ successLevel: item.success });
      const resultTooltip = ['critical', 'botch'].includes(outcome.status)
        ? `${outcome.resultTooltip} — ${detail}`
        : detail;
      return {
        ...item,
        resultRowClass: outcome.resultRowClass,
        resultTooltip,
        resultSubLabel: outcome.resultSubLabel,
      };
    });
  }

  static async requestGC(category, name, messageId, modifier = 0) {
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    if (game.canvas.ready) game.user._onUpdateTokenTargets([]);

    const options = {
      modifier,
      postFunction: {
        cummulative: messageId,
        functionName: 'game.dsa5.apps.GroupCheck.autoEditGroupCheckRoll',
        speaker: RollDialogBuilder.buildSpeaker(actor, tokenId),
      },
    };
    switch (category) {
      case 'attribute':
        break;
      default:
        const skill = actor.items.find((i) => i.name == name && i.type == category);
        if (!skill) return ui.notifications.error('DSAError.elementNotFound', { format: { element: name }, localize: true });

        actor.setupSkill(skill, options, tokenId).then(async (setupData) => {
          const result = await actor.basicTest(setupData);
          await GroupCheck.editGroupCheckRoll(messageId, result, name, category, options.postFunction);
        });
    }
  }

  static async autoEditGroupCheckRoll(postFunction, result, source) {
    await GroupCheck.editGroupCheckRoll(postFunction.cummulative, result, source.name, source.type, postFunction);
  }

  static async editGroupCheckRoll(messageId, result, target, type, postFunction) {
    const rollResult = result.result;
    const isCrit = rollResult.successLevel > 1;
    const critMultiplier = isCrit ? 2 : 1;
    const actor = DSA5_Utility.getSpeaker(postFunction?.speaker ?? rollResult.speaker);
    if (!actor) return;

    const update = {
      messageId: rollResult.messageId,
      actor: actor.name,
      qs: (rollResult.qualityStep || 0) * critMultiplier,
      success: rollResult.successLevel,
      target,
      type,
      botched: rollResult.successLevel < -1,
    };

    await GroupCheck.updateGCResult(messageId, update);
  }

  static async updateGCResult(messageId, update) {
    if (!game.user.isGM) {
      game.socket.emit('system.dsa5', {
        type: 'updateGroupCheck',
        payload: {
          messageId,
          update,
        },
      });
      return;
    }

    return this.#updateSemaphore.add(async () => {
      const message = game.messages.get(messageId);
      if (!message) return;

      const data = duplicate(message.flags.gc);
      data.botched = data.botched || update.botched;
      delete update.botched;

      const index = data.results.findIndex((x) => x.messageId == update.messageId);
      if (index >= 0) {
        data.results[index] = update;
      } else {
        data.results.push(update);
      }
      await GroupCheck.rerenderGC(message, data);
    });
  }

  static async rerenderGC(message, data) {
    if (game.user.isGM) {
      let failed = 0;
      data.qs = data.results.reduce((a, b) => {
        failed += b.success < 0 ? 1 : 0;
        if (b.success > 1) failed = 0;
        return a + b.qs;
      }, 0);
      data.failed = failed;
      for (const optn of data.rollOptions) {
        optn.calculatedModifier = optn.modifier - failed;
      }
      data.openRolls = data.maxRolls - data.results.length;
      data.doneRolls = data.results.length;
      data.results = this.#enrichResultsForDisplay(data.results);
      const content = await renderTemplate('systems/dsa5/templates/chat/roll/groupcheck.hbs', data);
      await message.update({ content, flags: { gc: data }, timestamp: Date.now() });
    } else {
      game.socket.emit('system.dsa5', {
        type: 'updateGroupCheck',
        payload: {
          messageId: message.id,
          data,
        },
      });
    }
  }

  static showRQMessage(target, modifier = 0, customLabel = undefined, { datasetOptions = {}, otherMessage = undefined, modeOverride = false, forceWhisperIDs = false } = {}) {
    const mod = modifier < 0 ? ` ${modifier}` : modifier > 0 ? ` +${modifier}` : '';
    const skill = DSA5ChatAutoCompletion.skills.find((x) => x.name == target);
    if (!skill) return ui.notifications.error('DSAError.elementNotFound', { format: { element: target }, localize: true });

    const moreDataSet = [
      `data-type="${skill.type}"`,
      `data-name="${target}"`,
      `data-modifier="${modifier}"`,
      'data-tooltip="TT.requestRoll"',
    ];
    for (const key of Object.keys(datasetOptions)) {
      moreDataSet.push(`data-options-${key}="${datasetOptions[key]}"`);
    }
    let msg = _loc('CHATNOTIFICATION.requestRoll', {
      user: game.user.name,
      item: `<a class="roll-button request-roll" ${moreDataSet.join(' ')}><i class="fas fa-dice"></i> ${customLabel || target}${mod}</a>`,
    });
    if (otherMessage) {
      msg = `<div>${otherMessage}</div><div>${msg}</div>`;
    }

    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, modeOverride, undefined, forceWhisperIDs));
  }

  static async openDialog({
    messageId,
    name,
    modifier = 0,
    configuration = {},
    datasetOptions = {},
    otherMessage = undefined,
    modeOverride = false,
    forceWhisperIDs = false,
  } = {}) {
    if (!game.user.isGM) {
      if (!name || messageId) return;
      return this.#createDirectGCMessage(name, modifier, configuration, { datasetOptions, otherMessage, modeOverride, forceWhisperIDs });
    }

    await DSA5ChatAutoCompletion.ensureSkills();
    const skills = this.#buildSkillOptions();
    const isEdit = Boolean(messageId);
    const dialogId = this.#dialogId(messageId);
    const existingDialog = foundry.applications.instances.get(dialogId);
    if (existingDialog) {
      existingDialog.bringToTop();
      return;
    }
    let dialogData;

    if (isEdit) {
      const message = game.messages.get(messageId);
      if (!message?.flags?.gc) return;
      const data = duplicate(message.flags.gc);
      dialogData = {
        isEdit: true,
        showOutcomes: Boolean(data.enrichedsuccess || data.enrichedpartsuccess || configuration.success || configuration.partsuccess),
        rollOptions: data.rollOptions.map((optn) => ({
          ...optn,
          selectedValue: `${optn.target}|${optn.type}`,
        })),
        maxRolls: data.maxRolls,
        targetQs: data.targetQs,
        failed: data.failed,
        results: data.results,
        partsuccess: configuration.partsuccess ?? '',
        success: configuration.success ?? '',
        messageMode: game.settings.get('core', 'messageMode'),
        skills,
      };
    } else {
      const defaultSkill = skills[0]?.value?.split('|') || ['', 'skill'];
      const type = name
        ? DSA5ChatAutoCompletion.skills.find((x) => x.name == name)?.type || 'skill'
        : defaultSkill[1] || 'skill';
      const rollOptions = configuration.rollOptions?.length
        ? configuration.rollOptions
        : [{ type, modifier, target: name || defaultSkill[0] }];
      dialogData = {
        isEdit: false,
        showOutcomes: Boolean(configuration.success || configuration.partsuccess || configuration.enrichedsuccess || configuration.enrichedpartsuccess),
        rollOptions: rollOptions.map((optn) => ({
          ...optn,
          selectedValue: `${optn.target}|${optn.type}`,
        })),
        maxRolls: configuration.maxRolls ?? 7,
        targetQs: configuration.targetQs ?? 10,
        failed: 0,
        results: [],
        partsuccess: configuration.partsuccess ?? '',
        success: configuration.success ?? '',
        messageMode: game.settings.get('core', 'messageMode'),
        skills,
      };
    }

    const content = await renderTemplate(this.DIALOG_TEMPLATE, dialogData);
    const postOptions = { datasetOptions, otherMessage, modeOverride, forceWhisperIDs };

    new GroupCheckConfigDialog(
      {
        id: dialogId,
        window: { title: isEdit ? 'GROUPCHECK.editTitle' : 'GROUPCHECK.dialogTitle', resizable: true },
        content,
        classes: ['dsa5', 'group-check-config-dialog'],
        position: { width: 560 },
        buttons: [
          {
            action: 'ok',
            icon: 'fa fa-check',
            label: isEdit ? 'Save' : 'ok',
            default: true,
            callback: async (_event, button) => {
              const form = button.form || button.closest('form');
              const parsed = this.#parseDialogForm(form, isEdit ? game.messages.get(messageId)?.flags?.gc : null);
              if (!parsed.rollOptions.length) {
                ui.notifications.warn('GROUPCHECK.noSkills', { localize: true });
                return false;
              }

              if (isEdit) {
                const message = game.messages.get(messageId);
                if (!message) return;
                const existing = duplicate(message.flags.gc);
                const merged = {
                  ...existing,
                  rollOptions: parsed.rollOptions,
                  maxRolls: parsed.maxRolls,
                  targetQs: parsed.targetQs,
                  results: parsed.results,
                };
                if (parsed.partsuccess) {
                  merged.enrichedpartsuccess = await TextEditor.enrichHTML(parsed.partsuccess, { secrets: game.user.isGM });
                }
                if (parsed.success) {
                  merged.enrichedsuccess = await TextEditor.enrichHTML(parsed.success, { secrets: game.user.isGM });
                }
                await this.rerenderGC(message, merged);
              } else {
                await this.#createFromDialog(parsed, postOptions);
              }
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
          },
        ],
      },
      {
        onRender: (element) => this.#bindConfigDialog(element, skills),
      },
    ).render(true);
  }

  static #buildSkillOptions() {
    return DSA5ChatAutoCompletion.skills
      .filter((s) => s.type === 'skill')
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((s) => ({ value: `${s.name}|${s.type}`, label: s.name }));
  }

  static #bindConfigDialog(element, skills) {
    const root = element.querySelector('.group-check-dialog');
    if (!root || root.dataset.bound === 'true') return;
    root.dataset.bound = 'true';

    root.querySelectorAll('.tabelement').forEach((tab) => {
      tab.addEventListener('click', (event) => {
        event.preventDefault();
        const tabName = tab.dataset.tab;
        root.querySelectorAll('.tabelement').forEach((el) => el.classList.toggle('active', el.dataset.tab === tabName));
        root.querySelectorAll('.gc-tab-panel').forEach((panel) => panel.classList.toggle('active', panel.dataset.tab === tabName));
      });
    });

    root.querySelector('.gc-add-skill')?.addEventListener('click', async () => {
      const list = root.querySelector('.gc-skills-list');
      const html = await renderTemplate(this.SKILL_ROW_TEMPLATE, {
        skills,
        modifier: 0,
        selectedValue: skills[0]?.value || '',
      });
      list.insertAdjacentHTML('beforeend', html);
      const row = list.querySelector('.gc-skill-row:last-child');
      if (row) GroupCheckConfigDialog.initSelect2(row);
    });

    root.addEventListener('click', (event) => {
      const removeSkill = event.target.closest('.gc-remove-skill');
      if (removeSkill) {
        const rows = root.querySelectorAll('.gc-skill-row');
        if (rows.length <= 1) return ui.notifications.warn('GROUPCHECK.minOneSkill', { localize: true });
        removeSkill.closest('.gc-skill-row')?.remove();
        return;
      }
      const removeResult = event.target.closest('.gc-remove-result');
      if (removeResult) removeResult.closest('.gc-result-row')?.remove();
    });
  }

  static #parseDialogForm(form, existingData = null) {
    const rollOptions = [];
    for (const row of form.querySelectorAll('.gc-skill-row')) {
      const skillValue = row.querySelector('[name="skill"]')?.value;
      if (!skillValue) continue;
      const [target, type] = skillValue.split('|');
      rollOptions.push({
        type: type || 'skill',
        target,
        modifier: Number(row.querySelector('[name="modifier"]')?.value) || 0,
      });
    }

    const maxRolls = Number(form.querySelector('[name="maxRolls"]')?.value) || 7;
    const targetQs = Number(form.querySelector('[name="targetQs"]')?.value) || 10;

    const skillKeys = new Set(rollOptions.map((o) => `${o.type}|${o.target}`));
    let results = [];

    for (const row of form.querySelectorAll('.gc-result-row')) {
      results.push({
        messageId: row.dataset.messageId,
        actor: row.dataset.actor,
        target: row.dataset.target,
        type: row.dataset.type,
        success: Number(row.dataset.success),
        botched: row.dataset.botched === 'true',
        qs: Number(row.querySelector('[name="resultQs"]')?.value) || 0,
      });
    }

    if (!results.length && existingData?.results?.length) {
      results = existingData.results.filter((r) => skillKeys.has(`${r.type}|${r.target}`));
    } else {
      results = results.filter((r) => skillKeys.has(`${r.type}|${r.target}`));
    }

    const partsuccess = form.querySelector('[name="partsuccess"]')?.value || '';
    const success = form.querySelector('[name="success"]')?.value || '';

    return {
      rollOptions,
      maxRolls,
      targetQs,
      results,
      partsuccess,
      success,
      messageMode: form.querySelector('[name="messageMode"]:checked')?.value,
    };
  }

  static async #createFromDialog(parsed, postOptions = {}) {
    const rollOptions = parsed.rollOptions.map((optn) => ({
      ...optn,
      calculatedModifier: optn.modifier,
    }));

    const data = {
      results: [],
      qs: 0,
      failed: 0,
      name: game.user.name,
      maxRolls: parsed.maxRolls,
      openRolls: parsed.maxRolls,
      doneRolls: 0,
      targetQs: parsed.targetQs,
      rollOptions,
    };

    if (parsed.partsuccess) {
      data.enrichedpartsuccess = await TextEditor.enrichHTML(parsed.partsuccess, { secrets: game.user.isGM });
    }
    if (parsed.success) {
      data.enrichedsuccess = await TextEditor.enrichHTML(parsed.success, { secrets: game.user.isGM });
    }

    const content = await renderTemplate('systems/dsa5/templates/chat/roll/groupcheck.hbs', data);
    const chatData = DSA5_Utility.chatDataSetup(
      content,
      postOptions.modeOverride,
      parsed.messageMode || game.settings.get('core', 'messageMode'),
      postOptions.forceWhisperIDs,
    );
    chatData.flags = { gc: data };
    if (postOptions.datasetOptions) chatData.flags.gc.datasetOptions = postOptions.datasetOptions;
    if (postOptions.otherMessage) {
      chatData.content = `<div>${postOptions.otherMessage}</div><div>${chatData.content}</div>`;
    }
    ChatMessage.create(chatData);
  }

  static async #createDirectGCMessage(target, modifier = 0, configuration = {}, { datasetOptions = {}, otherMessage = undefined, modeOverride = false, forceWhisperIDs = false } = {}) {
    await DSA5ChatAutoCompletion.ensureSkills();
    const type = DSA5ChatAutoCompletion.skills.find((x) => x.name == target)?.type || 'skill';
    const data = {
      results: [],
      qs: 0,
      failed: 0,
      modifier,
      name: game.user.name,
      maxRolls: configuration.maxRolls ?? 7,
      openRolls: configuration.maxRolls ?? 7,
      doneRolls: 0,
      targetQs: configuration.targetQs ?? 10,
      rollOptions: configuration.rollOptions?.length
        ? configuration.rollOptions.map((optn) => ({ ...optn, calculatedModifier: optn.modifier }))
        : [{ type, modifier, calculatedModifier: modifier, target }],
    };
    if (configuration.enrichedsuccess) data.enrichedsuccess = configuration.enrichedsuccess;
    if (configuration.enrichedpartsuccess) data.enrichedpartsuccess = configuration.enrichedpartsuccess;
    const content = await renderTemplate('systems/dsa5/templates/chat/roll/groupcheck.hbs', data);
    const chatData = DSA5_Utility.chatDataSetup(content, modeOverride, undefined, forceWhisperIDs);
    chatData.flags = { gc: data };
    if (datasetOptions) chatData.flags.gc.datasetOptions = datasetOptions;
    if (otherMessage) chatData.content = `<div>${otherMessage}</div><div>${chatData.content}</div>`;
    ChatMessage.create(chatData);
  }

  static async showGCMessage(target, modifier = 0, configuration = {}, { datasetOptions = {}, otherMessage = undefined, modeOverride = false, forceWhisperIDs = false } = {}) {
    return this.openDialog({
      name: target,
      modifier,
      configuration,
      datasetOptions,
      otherMessage,
      modeOverride,
      forceWhisperIDs,
    });
  }

  static async chatListeners(html) {
    html.on('click', '.request-gc', (ev) => {
      const elem = ev.currentTarget.dataset;
      GroupCheck.requestGC(elem.type, elem.name, $(ev.currentTarget).parents('.message').attr('data-message-id'), Number(elem.modifier) || 0);
    });
    html.on('click', '.edit-gc-config', (ev) => {
      ev.preventDefault();
      ev.stopImmediatePropagation();
      if (!game.user.isGM) return;
      const messageId = $(ev.currentTarget).closest('.message').attr('data-message-id');
      GroupCheck.openDialog({ messageId });
    });
  }
}
