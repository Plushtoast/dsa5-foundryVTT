import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import AdvantageRulesDSA5 from '../../system/rules/advantage-rules-dsa5.js';
import DiceDSA5 from '../../system/rolls/dice-dsa5.js';
import Actordsa5 from '../../actor/actor-dsa5.js';
import { ModifierCalculator } from './modifier-calculator.js';
import { RollDialogBuilder } from '../../dialog/dialog-builder.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';

const { mergeObject } = foundry.utils;

/**
 * Handles resistance test functionality for diseases and poisons
 */
export class ResistanceTests {
  /**
   * Get situational modifiers for resistance tests
   * @param {Array<Object>} situationalModifiers - Array to push modifiers to
   * @param {Object} actor - Acting character
   * @param {Object} data - Test data object
   * @param {Object} source - Source item
   * @param {string} resistanceVantageKey - Localization key for resistance advantage
   * @returns {void}
   */
  static #getSituationalModifiers(situationalModifiers, actor, data, source, resistanceVantageKey) {
    source = DSA5_Utility.toObjectIfPossible(source);
    
    if (game.user.targets.size) {
      game.user.targets.forEach((target) => {
        if (target.actor) {
          situationalModifiers.push(
            ...AdvantageRulesDSA5.getVantageAsModifier(
              target.actor, 
              resistanceVantageKey, 
              -1, 
              false, 
              true
            )
          );
        }
      });
    }
    
    ModifierCalculator.getSkZkModifier(data, source);
    mergeObject(data, {
      hasSKModifier: source.system.resistance.value === 'SK',
      hasZKModifier: source.system.resistance.value === 'ZK',
    });
  }

  /**
   * Setup dialog for resistance tests
   * @param {Event} ev - DOM event
   * @param {Object} options - Dialog options
   * @param {Object} item - Item being tested
   * @param {Object} actor - Acting character
   * @param {string} tokenId - Token identifier
   * @param {string} resistanceVantageKey - Localization key for resistance advantage
   * @returns {Object} Dialog configuration
   */
  static setupDialog(ev, options, item, actor, tokenId, resistanceVantageKey) {
    const title = item.name + ' ' + DSA5_Utility.categoryLocalization(item.type) + ' ' + game.i18n.localize('Test');

    const testData = {
      opposable: false,
      source: item,
      extra: {
        options,
        speaker: RollDialogBuilder.buildSpeaker(actor, tokenId),
      },
    };

    const data = {
      rollMode: options.rollMode,
    };
    
    const situationalModifiers = [];
    this.#getSituationalModifiers(situationalModifiers, actor, data, item, resistanceVantageKey);
    data.situationalModifiers = situationalModifiers;

    if (options.manualResistance) {
      mergeObject(data, options.manualResistance);
    }

    const dialogOptions = {
      title,
      template: ITEM_CONSTANTS.TEMPLATE_PATHS.POISON_DIALOG,
      data,
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.situationalModifiers = ModifierCalculator._parseModifiers(html);
        testData.situationalModifiers.push(
          {
            name: game.i18n.localize('zkModifier'),
            value: html.find('[name="zkModifier"]').val() || 0,
          },
          {
            name: game.i18n.localize('skModifier'),
            value: html.find('[name="skModifier"]').val() || 0,
          },
        );
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = RollDialogBuilder._setupItemCardOptions(
      `systems/dsa5/templates/chat/roll/${item.type}-card.hbs`, 
      title, 
      tokenId
    );

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}
