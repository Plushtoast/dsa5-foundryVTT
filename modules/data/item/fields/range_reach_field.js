import ScopableStringField from './scopable_stringfield.js';

/**
 * Ranged reach bands ("5/25/40"). ActiveEffect ADD/SUBTRACT is a relative
 * delta (0.1 = +10%) applied as ×(1 ± delta) on each numeric segment.
 */
export default class RangeReachField extends ScopableStringField {
  /** @override */
  _applyChangeAdd(value, delta) {
    return RangeReachField.scaleBands(value, 1 + (Number(delta) || 0));
  }

  /** @override */
  _applyChangeSubtract(value, delta) {
    return RangeReachField.scaleBands(value, 1 - (Number(delta) || 0));
  }

  /**
   * @param {string} value
   * @param {number} multiplier
   * @returns {string}
   */
  static scaleBands(value, multiplier) {
    if (multiplier === 1) return value || '';
    return `${value ?? ''}`.split('/').map((part) => {
      const trimmed = part.trim();
      const num = Number(trimmed);
      return Number.isNaN(num) ? trimmed : String(Math.round(num * multiplier));
    }).join('/');
  }
}
