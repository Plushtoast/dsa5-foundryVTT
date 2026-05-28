import DSA5Dialog from '../../dialog/dialog-dsa5.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
const { mergeObject, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class GroupCheck {
  static #updateSemaphore = new foundry.utils.Semaphore(1);

  static async requestGC(category, name, messageId, modifier = 0) {
    const { actor, tokenId } = DSA5ChatAutoCompletion._getActor();
    if (!actor) return;

    if (game.canvas.ready) game.user._onUpdateTokenTargets([]);

    const options = {
      modifier,
      postFunction: {
        cummulative: messageId,
        functionName: 'game.dsa5.apps.GroupCheck.autoEditGroupCheckRoll',
      },
    };
    switch (category) {
      case 'attribute':
        break;
      default:
        const skill = actor.items.find((i) => i.name == name && i.type == category);
        actor.setupSkill(skill, options, tokenId).then(async (setupData) => {
          const result = await actor.basicTest(setupData);
          await GroupCheck.editGroupCheckRoll(messageId, result, name, category);
        });
    }
  }

  static async autoEditGroupCheckRoll(postFunction, result, source) {
    await GroupCheck.editGroupCheckRoll(postFunction.cummulative, result, source.name, source.type);
  }

  static async editGroupCheckRoll(messageId, result, target, type) {
    const isCrit = result.result.successLevel > 1;
    const critMultiplier = isCrit ? 2 : 1;
    const actor = DSA5_Utility.getSpeaker(result.result.speaker);
    const update = {
      messageId: result.result.messageId,
      actor: actor.name,
      qs: (result.result.qualityStep || 0) * critMultiplier,
      success: result.result.successLevel,
      target,
      type,
      botched: result.result.successLevel < -1,
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
      const content = await renderTemplate('systems/dsa5/templates/chat/roll/groupcheck.hbs', data);
      await message.update({ content, flags: { gc: data } });
    } else {
      game.socket.emit('system.dsa5', {
        type: 'updateGroupCheck',
        payload: {
          messageId: message.id,
          data,
        },
      });
    }
    $('#chat-log').find(`[data-message-id="${message.id}"`).appendTo('#chat-log');
  }

  static showRQMessage(target, modifier = 0, customLabel = undefined, { datasetOptions = {}, otherMessage = undefined, modeOverride = false, forceWhisperIDs = false } = {}) {
    const mod = modifier < 0 ? ` ${modifier}` : modifier > 0 ? ` +${modifier}` : '';
    const skill = DSA5ChatAutoCompletion.skills.find((x) => x.name == target)
    if (!skill) return ui.notifications.error('DSAError.elementNotFound', { format: { element: target }, localize: true });

    const moreDataSet = [
      `data-type="${skill.type}"`,
      `data-name="${target}"`,
      `data-modifier="${modifier}"`,
      'data-tooltip="TT.requestRoll"',
    ]
    for (const key of Object.keys(datasetOptions)) {
      moreDataSet.push(`data-options-${key}="${datasetOptions[key]}"`)
    }
    let msg = _loc('CHATNOTIFICATION.requestRoll', {
      user: game.user.name,
      item: `<a class="roll-button request-roll" ${moreDataSet.join(' ')}><i class="fas fa-dice"></i> ${customLabel || target}${mod}</a>`,
    });
    if(otherMessage) {
      msg = `<div>${otherMessage}</div><div>${msg}</div>`;
    }

    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, modeOverride, undefined, forceWhisperIDs));
  }

  static async showGCMessage(target, modifier = 0, configuration = {}, { datasetOptions = {}, otherMessage = undefined, modeOverride = false, forceWhisperIDs = false } = {}) {
    await DSA5ChatAutoCompletion.ensureSkills();
    const type = DSA5ChatAutoCompletion.skills.find((x) => x.name == target)?.type || 'skill';
    const data = {
      results: [],
      qs: 0,
      failed: 0,
      modifier,
      name: game.user.name,
      maxRolls: 7,
      openRolls: 7,
      doneRolls: 0,
      targetQs: 10,
      rollOptions: [{ type, modifier, calculatedModifier: modifier, target }],
    };
    mergeObject(data, configuration);
    const content = await renderTemplate('systems/dsa5/templates/chat/roll/groupcheck.hbs', data);
    const chatData = DSA5_Utility.chatDataSetup(content, modeOverride, undefined, forceWhisperIDs);
    chatData.flags = { gc: data };
    if (datasetOptions) {
      chatData.flags.gc.datasetOptions = datasetOptions;
    }
    ChatMessage.create(chatData);
  }

  static async addSkillToGC(ev) {
    const messageID = $(ev.currentTarget).parents('.message').attr('data-message-id');
    const content = await renderTemplate('systems/dsa5/templates/dialog/addgroupcheckskill.hbs', {
      skills: DSA5ChatAutoCompletion.skills.filter((x) => x.type == 'skill').sort((x, y) => x.name.localeCompare(y.name)),
    });
    const data = {
      window: { title: 'HELP.groupcheck' },
      content,
      buttons: [
        {
          action: 'ok',
          icon: "fa fa-check",
          label: 'ok',
          callback: async (event, button, dialog) => {
            const dlg = $(button.form)
            const message = game.messages.get(messageID);
            const data = message.flags.gc;
            data.rollOptions.push({
              type: 'skill',
              modifier: dlg.find('[name="modifier"]').val(),
              target: dlg.find('[name="skill"]').val(),
            });
            GroupCheck.rerenderGC(message, data);
          },
        },
        {
          action: 'cancel',
          icon: "fas fa-times",
          label: 'cancel',
        },
      ],
    };
    new DSA5Dialog(data).render(true);
  }

  static async removeGCEntry(ev) {
    const elem = $(ev.currentTarget);
    const index = Number(ev.currentTarget.dataset.index);
    const message = game.messages.get(elem.parents('.message').attr('data-message-id'));
    const data = message.flags.gc;
    data.results.splice(index, 1);
    GroupCheck.rerenderGC(message, data);
  }

  static removeSkillFromGC(ev) {
    const elem = $(ev.currentTarget);
    const message = game.messages.get(elem.parents('.message').attr('data-message-id'));
    const data = message.flags.gc;
    data.rollOptions = data.rollOptions.filter((x) => !(x.type == ev.currentTarget.dataset.type && x.target == ev.currentTarget.dataset.name));
    data.results = data.results.filter((x) => !(x.type == ev.currentTarget.dataset.type && x.target == ev.currentTarget.dataset.name));
    GroupCheck.rerenderGC(message, data);
  }

  static async editGC(ev) {
    const elem = $(ev.currentTarget);
    const index = Number(ev.currentTarget.dataset.index);
    const message = game.messages.get(elem.parents('.message').attr('data-message-id'));
    const data = message.flags.gc;
    if (index) {
      data.results[index].qs = Number(elem.val());
    } else if (ev.currentTarget.dataset.name) {
      const dataElem = data.rollOptions.find((x) => x.target == ev.currentTarget.dataset.name && ev.currentTarget.dataset.type == x.type);
      dataElem[ev.currentTarget.dataset.field] = Number(elem.val());
    } else {
      data[ev.currentTarget.dataset.field] = Number(elem.val());
    }
    GroupCheck.rerenderGC(message, data);
  }

  static chatListeners(html) {
    html.on('change', '.editGC', (ev) => GroupCheck.editGC(ev));
    html.on('click', '.request-gc', (ev) => {
      const elem = ev.currentTarget.dataset;
      GroupCheck.requestGC(elem.type, elem.name, $(ev.currentTarget).parents('.message').attr('data-message-id'), Number(elem.modifier) || 0);
    });
    html.on('click', '.removeGC', (ev) => GroupCheck.removeGCEntry(ev));
    html.on('click', '.removeSkillFromGC', (ev) => GroupCheck.removeSkillFromGC(ev));
    html.on('click', '.addSkillToGC', (ev) => GroupCheck.addSkillToGC(ev));
  }
}
