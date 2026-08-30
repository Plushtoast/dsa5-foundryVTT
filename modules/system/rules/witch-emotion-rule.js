import { ITEM_CONSTANTS } from '../../config/item-constants.js';
import DSA5 from '../../config/config-dsa5.js';
import SpecialabilityRulesDSA5 from './specialability-rules-dsa5.js';

const { SPELL, RITUAL } = ITEM_CONSTANTS.TEST_TYPES;
const APPLICABLE_TYPES = new Set([SPELL, RITUAL]);

export default class WitchEmotionRule {
  static ABILITY_KEY = 'LocalizedIDs.traditionWitch';

  static isWitch(actor) {
    return SpecialabilityRulesDSA5.hasAbility(actor, this.ABILITY_KEY);
  }

  static isApplicable(source) {
    return APPLICABLE_TYPES.has(source?.type);
  }

  static shouldShow(actor, source) {
    return !!actor && this.isApplicable(source) && this.isWitch(actor);
  }

  static modifierName() {
    return _loc('WITCHEMOTION.label');
  }

  static modifierFromValue(value) {
    const numeric = Number(value) || 0;
    if (!numeric) return null;

    return {
      name: this.modifierName(),
      value: numeric,
      selected: true,
      source: _loc(this.ABILITY_KEY),
    };
  }

  static prepareDialogData(data, actor, source) {
    if (!this.shouldShow(actor, source)) return;

    Object.assign(data, {
      showWitchEmotion: true,
      witchEmotion: 0,
      witchEmotionModifiers: DSA5.witchEmotionModifiers,
    });
  }

  static applyFromForm(testData, html) {
    const input = html.find('[name="witchEmotion"]');
    if (!input.length) return;

    const name = this.modifierName();
    testData.situationalModifiers = (testData.situationalModifiers || []).filter((entry) => entry.name !== name);

    const modifier = this.modifierFromValue(input.val());
    if (modifier) testData.situationalModifiers.push(modifier);
  }
}
