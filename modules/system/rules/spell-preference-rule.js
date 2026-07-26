import { ITEM_CONSTANTS } from '../../config/item-constants.js';

const { SPELL, RITUAL } = ITEM_CONSTANTS.TEST_TYPES;
const APPLICABLE_TYPES = new Set([SPELL, RITUAL]);

export default class SpellPreferenceRule {
  static SETTING = 'enableWitchSpellPreferences';

  static isEnabled() {
    return game.settings.get('dsa5', this.SETTING);
  }

  static isApplicable(source) {
    return APPLICABLE_TYPES.has(source?.type);
  }

  static preferenceNames(actor) {
    const value = foundry.utils.getProperty(actor, 'system.spellpreferences.value') || foundry.utils.getProperty(actor, 'overrides.system.spellpreferences.value') || '';

    return String(value)
      .split(',')
      .map((name) => name.trim())
      .filter(Boolean);
  }

  static hasPreferences(actor) {
    return this.preferenceNames(actor).length > 0;
  }

  static hasPreference(actor, source) {
    if (!this.isEnabled() || !this.isApplicable(source)) return false;

    return this.preferenceNames(actor).includes(String(source?.name || '').trim());
  }
}