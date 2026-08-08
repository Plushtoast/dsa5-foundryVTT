import ScopableStringField from './scopable_stringfield.js';

/**
 * LZ / mag-swap string field ("8", "4/6", or override token "half/6").
 * ActiveEffect ADD/SUBTRACT uses Roll.safeEval on the first segment so signed
 * deltas ("-2", "+1") work through stock applyChange.
 */
export default class ReloadTimeField extends ScopableStringField {
  static HALF_OVERRIDE = /^half(?:\+(\d+))?\/(\d+)$/;

  /** @param {string|number} value Full reloadTime value or a single segment. */
  static evaluateSegment(value) {
    const segment = `${value ?? '0'}`.split('/')[0].trim() || '0';
    try {
      const n = Roll.safeEval(segment);
      return Number.isFinite(n) ? n : (Number(segment) || 0);
    } catch {
      return Number(segment) || 0;
    }
  }

  /** @override */
  _applyChangeAdd(value, delta) {
    return this.#applySegmentDelta(value, delta, 'add');
  }

  /** @override */
  _applyChangeSubtract(value, delta) {
    return this.#applySegmentDelta(value, delta, 'subtract');
  }

  /** @override */
  _applyChangeOverride(value, delta) {
    const token = `${delta ?? ''}`.trim();
    const halfMatch = token.match(ReloadTimeField.HALF_OVERRIDE);
    if (!halfMatch) return delta;

    const base = Math.max(1, Math.round(ReloadTimeField.evaluateSegment(value)) || 1);
    const loaded = Math.max(1, Math.ceil(base / 2) + (Number(halfMatch[1]) || 0));
    const empty = Number(halfMatch[2]) || 6;
    return `${loaded}/${empty}`;
  }

  #applySegmentDelta(value, delta, mode) {
    const parts = `${value ?? '0'}`.split('/');
    const first = parts[0].trim() || '0';
    const raw = `${delta ?? ''}`.trim();
    if (!raw) return value;

    let expression;
    if (mode === 'subtract') {
      const magnitude = Math.abs(Number(raw.replace(/^\+/, '')) || 0);
      expression = `${first}-${magnitude}`;
    } else if (/^[+-]/.test(raw)) {
      expression = `${first}${raw}`;
    } else {
      expression = `${first}+${raw}`;
    }

    try {
      parts[0] = String(Math.max(0, Math.round(Roll.safeEval(expression) || 0)));
    } catch {
      return value;
    }
    return parts.join('/');
  }
}
