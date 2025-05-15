import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5Dialog from './dialog-dsa5.js';
import DialogShared from './dialog-shared.js';
import DSA5 from '../system/config-dsa5.js';
import Actordsa5 from '../actor/actor-dsa5.js';
import DiceDSA5 from '../system/dice-dsa5.js';
import DPS from '../system/derepositioningsystem.js';
const { mergeObject } = foundry.utils;

export default class DSA5SkillDialog extends DialogShared {
  static getRollButtons(testData, dialogOptions, resolve, reject) {
    const buttons = DSA5Dialog.getRollButtons(testData, dialogOptions, resolve, reject);
    buttons.find(x => x.action == 'rollButton').label = 'Opposed';
    buttons.unshift(
      {
        action: 'nonOpposedButton',
        label: 'Roll',
        callback: (event, button, dialog) => {
          const html = $(button.form);
          game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html);
          testData.opposable = false;
          resolve(dialogOptions.callback(html));
        },
      },
      {
        action: 'routineRoll',
        label: 'ROLL.routine',
        callback: (event, button, dialog) => {
          const html = $(button.form);
          game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html);
          testData.routine = true;
          mergeObject(testData.extra.options, {
            cheat: true,
            predefinedResult: [
              { val: 2, index: 0 },
              { val: 2, index: 1 },
              { val: 2, index: 2 },
            ],
          });
          resolve(dialogOptions.callback(html));
        },
      
      });
    return buttons;
  }

  async prepareFormRecall(html) {
      await super.prepareFormRecall(html);
      const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
      DPS.lightLevel(actor, html);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)

    html.on('change', 'input,select', (ev) => this.rememberFormData(ev));

    let targets = this.readTargets();
    // not great
    const that = this;
    this.checkTargets = setInterval(function () {
      targets = that.compareTargets(html, targets);
    }, 500);

    this.rememberFormData();
    html.on('mousedown', '.quantity-click', (ev) => this.rememberFormData(ev));

    html.find('.modifiers option').on('mousedown', (ev) => {
      this.rememberFormData(ev);
    });
  }

  rememberFormData(ev) {
    const html = $(this.element);
    const data = new foundry.applications.ux.FormDataExtended(html.find('form')[0]).object;
    data.situationalModifiers = Actordsa5._parseModifiers(html);
    this.calculateRoutine(data);
  }

  async calculateRoutine(data) {
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    const routineButton = $(this.element).find('.routineRoll');
    if (!actor) return routineButton.prop('disabled', true);

    let routineAllowed = true;
    for (let i = 0; i < 3; i++) {
      if (actor.system.characteristics[data[`characteristics${i}`]].max * data[`ch${i}`].max < 13) {
        routineAllowed = false;
        break;
      }
    }

    const fw = Number(this.dialogData.source.system.talentValue.value) + data.fw + (await DiceDSA5._situationalModifiers(data, 'FW'));
    const mod = DSA5.skillDifficultyModifiers[data.testDifficulty] + (await DiceDSA5._situationalModifiers(data));
    const requiredFw = Math.clamp(10 - mod * 3, 1, 19);
    const enoughFw = fw >= requiredFw;
    const canRoutine = routineAllowed && enoughFw;
    const routine = game.i18n.localize('ROLL.routine');
    routineButton.prop('disabled', !canRoutine);
    routineButton.html(canRoutine ? `${routine} (${game.i18n.localize('CHARAbbrev.FW')} ${Math.round(fw / 2)})` : routine);

    this.calculateProbability(actor, this.dialogData.source, mod, fw);
  }

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true,
    },
    position: {
      width: 700,
    },
  };
}
