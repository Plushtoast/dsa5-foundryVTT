/**
 * @typedef {Object} SituationalModifierRef
 * @property {string|null} uuid - Foundry UUID for fromUuid resolution
 * @property {string|null} id - Actor-local _id for items.get / effects.get
 */

/**
 * @typedef {Object} SituationalModifierData
 * @property {string} [name] - Display name (localization key or literal)
 * @property {number|string} [value] - Modifier value (number or roll formula)
 * @property {string} [type] - Modifier type constant ('' | 'dmg' | 'FW' | 'QL' | 'FP' | …)
 * @property {boolean} [selected] - Whether the modifier is active
 * @property {SituationalModifierRef} [ref] - Canonical reference to originating document
 * @property {number|string} [damageBonus] - Damage bonus for dmg-type modifiers
 * @property {number} [dmmalus] - Defense malus
 * @property {number} [armorPen] - Armor penetration
 * @property {number} [step] - Step value from special abilities
 * @property {Object} [flatValues] - Flat modifier values from ModifierCalculator
 * @property {boolean} [extension] - True when modifier is a spell extension
 * @property {string} [source] - Human-readable origin description
 */

export class SituationalModifier {
  /** @type {string[]} Optional data keys copied from input when present. */
  static #OPTIONAL_KEYS = ['damageBonus', 'dmmalus', 'armorPen', 'step', 'flatValues', 'extension', 'source', 'consumableId'];

  /** @param {SituationalModifierData} data */
  constructor(data = {}) {
    /** @type {SituationalModifierRef|null} */
    this.ref = SituationalModifier.buildRef(data);
    /** @type {string} */
    this.name = data.name ?? '';
    /** @type {number|string} */
    this.value = SituationalModifier.#coerceValue(data);
    /** @type {string} */
    this.type = data.type ?? '';
    /** @type {boolean} */
    this.selected = data.selected !== false;
    /** @type {boolean} */
    this._defaultSelected = data._defaultSelected ?? this.selected;
    /** @type {string} Stable identity for tooltip caching during widget lifecycle. */
    this.cacheId = foundry.utils.randomID();

    for (const key of SituationalModifier.#OPTIONAL_KEYS) {
      if (data[key] !== undefined) this[key] = data[key];
    }
  }

  /**
   * @param {SituationalModifierData|SituationalModifier} data
   * @returns {SituationalModifier}
   */
  static from(data) {
    if (data instanceof SituationalModifier) return data;
    return new SituationalModifier(data);
  }

  /** @param {SituationalModifierData[]} arr */
  static fromArray(arr = []) {
    return arr.map(d => SituationalModifier.from(d));
  }

  /**
   * Build a ref from new-style `{ ref }` or legacy fields.
   * @param {SituationalModifierData} data
   * @returns {SituationalModifierRef|null}
   */
  static buildRef(data) {
    if (data.ref) {
      const uuid = data.ref.uuid || null;
      const id = data.ref.id || null;
      return (uuid || id) ? { uuid, id } : null;
    }
    // Legacy field promotion
    const uuid = data.effectUuid || null;
    const id = data.specAbId || data.effectId || data.sourceId || data.itemId || data._id || null;
    return (uuid || id) ? { uuid, id } : null;
  }

  /** @type {boolean} */
  get hasRef() {
    return this.ref !== null;
  }

  /**
   * Resolve the ref to a live Document (item or effect).
   * @param {Actor|null} actor
   * @returns {Document|null}
   */
  resolve(actor) {
    if (!this.ref) return null;

    if (this.ref.uuid) {
      const doc = fromUuidSync(this.ref.uuid);
      if (doc) return doc;
    }

    if (this.ref.id && actor) {
      return actor.items.get(this.ref.id)
        ?? actor.effects.get(this.ref.id)
        ?? null;
    }

    return null;
  }

  /**
   * Derive display name: stored name first, then resolve from ref.
   * @param {Actor|null} actor
   * @returns {string}
   */
  displayName(actor) {
    if (this.name) {
      return game.i18n.has(this.name) ? game.i18n.localize(this.name) : this.name;
    }
    const doc = this.resolve(actor);
    return doc?.name ?? '';
  }

  /**
   * Plain-object snapshot safe for JSON / duplicate / flags.
   * @returns {SituationalModifierData}
   */
  toObject() {
    const obj = {
      name: this.name,
      value: this.value,
      type: this.type,
      selected: this.selected,
    };
    if (this.ref) obj.ref = { ...this.ref };
    for (const key of SituationalModifier.#OPTIONAL_KEYS) {
      if (this[key] !== undefined) obj[key] = this[key];
    }
    return obj;
  }

  /**
   * @param {SituationalModifierData} data
   * @returns {number|string}
   */
  static #coerceValue(data) {
    let value = data.value;
    if (data.type === 'dmg' && data.damageBonus !== undefined
      && (value === undefined || Number(value) === 0)) {
      value = data.damageBonus;
    }
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed !== '' && /^-?\d+$/.test(trimmed)) return Number(trimmed);
    }
    return value ?? 0;
  }
}
