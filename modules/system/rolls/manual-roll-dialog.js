import DSA5Dialog from '../../dialog/dialog-dsa5.js';
import { renderApplication } from '../../mixins/detached-window-mixin.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';

const { renderTemplate } = foundry.applications.handlebars;
const { ATTACK, PARRY, DAMAGE, DODGE } = ITEM_CONSTANTS.COMBAT_MODES;
const { ROLL_TYPES } = DICE_CONSTANTS;

export class ManualRollDialog {
  /**
   * Apply cheat or physical-dice input to a roll.
   * @param {Roll} roll
   * @param {string} description - Localization key or label for the dialog
   * @param {Object} options
   * @returns {Promise<Roll>}
   */
  static async apply(roll, description = '', options = {}) {
    const { cheat, predefinedResult } = options;
    const shouldShowDialog = this.#shouldShow(cheat, predefinedResult, description);

    if (!shouldShowDialog) {
      return roll;
    }

    if (predefinedResult) {
      roll.editRollAtIndex(predefinedResult);
      return roll;
    }

    const diceInfo = this.#extractDiceInfo(roll);
    const userInput = await this.#show(diceInfo, description, cheat, options);

    if (userInput.confirmed) {
      roll.editRollAtIndex(userInput.changes);
    }

    return roll;
  }

  /**
   * Build a descriptive label for the manual/cheat roll dialog.
   * The template appends a localized "probe" suffix, so return the roll subject here.
   * @param {Object} testData
   * @returns {string}
   */
  static getRollDescription(testData) {
    const { source } = testData;
    const { type } = source;
    const { mode } = testData;

    if (type === ROLL_TYPES.REGENERATE) {
      return 'regenerationTest';
    }

    const combatTypes = new Set([
      ROLL_TYPES.TRAIT,
      ROLL_TYPES.MELEEWEAPON,
      ROLL_TYPES.RANGEWEAPON,
      ROLL_TYPES.WEAPONLESS,
      ROLL_TYPES.COMBATSKILL,
      ROLL_TYPES.DODGE,
    ]);

    if (combatTypes.has(type)) {
      const modeLabels = {
        [ATTACK]: 'CHAR.ATTACK',
        [PARRY]: 'CHAR.PARRY',
        [DAMAGE]: 'CHAR.DAMAGE',
      };
      const modeKey = modeLabels[mode] || (type === ROLL_TYPES.DODGE ? 'CHAR.DODGE' : null);
      if (source.name && modeKey) {
        return `${source.name} (${_loc(modeKey)})`;
      }
      if (source.name) return source.name;
      if (modeKey) return _loc(modeKey);
    }

    if (source.name) return source.name;

    const typeKey = `TYPES.Item.${type}`;
    if (game.i18n.has(typeKey)) return typeKey;

    return type;
  }

  static #shouldShow(cheat, predefinedResult, description) {
    const allowPhysicalDice = game.settings.get('dsa5', 'allowPhysicalDice');
    const isDamageRoll = description === 'CHAR.DAMAGE';

    if (predefinedResult && isDamageRoll && !cheat) {
      return false;
    }

    return cheat || allowPhysicalDice;
  }

  static #extractDiceInfo(roll) {
    const dice = [];

    roll.terms.forEach((term) => {
      if (term instanceof foundry.dice.terms.Die || term.class === 'Die') {
        term.results.forEach((result) => {
          dice.push({
            faces: term.faces,
            val: result.result,
          });
        });
      }
    });

    return dice;
  }

  static async #show(diceInfo, description, isCheat, options = {}) {
    const content = await renderTemplate(DICE_CONSTANTS.TEMPLATES.MANUAL_ROLL, {
      dice: diceInfo,
      description,
    });

    const titleKey = isCheat ? 'DIALOG.cheat' : 'DSASETTINGS.allowPhysicalDice';

    return new Promise((resolve) => {
      const dlg = new DSA5Dialog({
        window: { title: titleKey },
        content,
        buttons: [
          {
            action: 'ok',
            icon: 'fa fa-check',
            label: 'yes',
            callback: (event, button, dlg) => {
              const changes = this.#extractChangesFromForm($(button.form));
              resolve({ confirmed: true, changes });
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => resolve({ confirmed: false, changes: [] }),
          },
        ],
      });
      renderApplication(dlg, { parent: options._rollParentApp });
    });
  }

  static #extractChangesFromForm(form) {
    const changes = [];

    form.find('.dieInput').each(function (index) {
      const value = Number($(this).val());
      if (value > 0) {
        changes.push({ val: value, index });
      }
    });

    return changes;
  }
}
