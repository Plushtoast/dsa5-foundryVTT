import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5Dialog from './dialog-dsa5.js';
import DialogShared from './dialog-shared.js';
import DSA5 from '../config/config-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import DPS from '../system/automation/derepositioningsystem.js';
import { PersonaeSocialContactService } from '../system/helpers/personae-social-contact.js';
import { SituationalModifiersWidget } from '../system/helpers/situational-modifiers-widget.js';
const { mergeObject } = foundry.utils;

export default class DSA5SkillDialog extends DialogShared {
  #toggleSection(ev, target) {
    const section = target.dataset.toggle;
    this.element.querySelector(`[data-section='${section}']`).classList.toggle('dsahidden');
  }

  async refreshPersonaeSocialContactModifier(root = this.element) {
    const widget = this.getSituationalModifiersWidget(root);
    if (!widget) return;

    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    const changed = await PersonaeSocialContactService.refreshWidget(widget, {
      skill: this.dialogData.source,
      actor,
    });

    if (changed) this.rememberFormData();
  }

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

    const html = $(this.element);

    html.on('change', 'input,select', (ev) => this.rememberFormData(ev));

    await this.refreshPersonaeSocialContactModifier(html);
    this.rememberFormData();
    html.on('mousedown', '.quantity-click', (ev) => this.rememberFormData(ev));

    html.find('[data-action="toggleSection"]').on('click', (ev) => {
      this.#toggleSection(ev, ev.currentTarget);
    });
  }

  async onTargetTokenChange(html) {
    await this.refreshPersonaeSocialContactModifier(html);
  }

  rememberFormData(ev) {
    const html = $(this.element);
    const data = new foundry.applications.ux.FormDataExtended(html.find('form')[0]).object;
    data.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);
    this.calculateRoutine(data);
  }

  async calculateRoutine(data) {
    const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker);
    const routineButton = $(this.element).find('[data-action="routineRoll"]');
    if (!actor) {
      routineButton.prop('disabled', true);
      return;
    }

    const routineAllowed = [0, 1, 2].every(i => {
      const charKey = data[`characteristics${i}`];
      const chKey = data[`ch${i}`];
      return actor.system.characteristics[charKey].value + chKey >= 13;
    });

    const fwBase = Number(this.dialogData.source.system.talentValue.value);
    const fwMod = data.fw + (await DiceDSA5._situationalModifiers(data, 'FW'));
    const fw = fwBase + fwMod;

    const modBase = DSA5.skillDifficultyModifiers[data.testDifficulty];
    const mod = modBase + (await DiceDSA5._situationalModifiers(data));

    const requiredFw = Math.clamp(10 - mod * 3, 1, 19);
    const enoughFw = fw >= requiredFw;
    const canRoutine = routineAllowed && enoughFw;

    const routineLabel = _loc('ROLL.routine');
    routineButton.prop('disabled', !canRoutine);
    routineButton.html(
      canRoutine
        ? `${routineLabel} (${_loc('CHARAbbrev.FW')} ${Math.round(fw / 2)})`
        : routineLabel
    );

    await this.calculateProbability(actor, this.dialogData.source, mod, fw, data);
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
