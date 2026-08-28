import ScopableStringField from './scopable_stringfield.js';

/**
 * Combat damage formula ("1d6", "1d6+4"). ActiveEffect ADD/SUBTRACT adjusts the
 * trailing integer modifier so stock applyChange records overrides.
 */
export default class DamageFormulaField extends ScopableStringField {
  /** @override */
  _applyChangeAdd(value, delta) {
    return DamageFormulaField.applyBonus(value, Number(delta) || 0);
  }

  /** @override */
  _applyChangeSubtract(value, delta) {
    return DamageFormulaField.applyBonus(value, -(Number(delta) || 0));
  }

  /**
   * @param {string} formula
   * @param {number} bonus
   * @returns {string}
   */
  static applyBonus(formula, bonus) {
    const base = formula || '1d6';
    if (!bonus) return base;

    if (/[+-]\d+$/.test(base)) {
      const match = base.match(/([+-])(\d+)$/);
      const newNumber = parseInt(match[0], 10) + bonus;
      return base.replace(match[0], '') + (newNumber >= 0 ? '+' : '-') + Math.abs(newNumber);
    }
    return base + (bonus >= 0 ? '+' : '-') + Math.abs(bonus);
  }
}
