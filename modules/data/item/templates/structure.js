import { DSADataModel } from '../../abstract.js';
import DSA5 from '../../../config/config-dsa5.js';

const { SchemaField, NumberField } = foundry.data.fields;

export default class StructureTemplate extends DSADataModel {
  static defineSchema() {
    return {
      structure: new SchemaField({
        value: new NumberField({ initial: 4, min: 0 }),
        max: new NumberField({ initial: 4, min: 0 }),
        breakPointRating: new NumberField({ label: 'WEAR.value' }),
      }),
    };
  }

  /**
   * Category-table Bruchfaktor when the item field is unset.
   * Empty BF intentionally inherits combat skill / armor subcategory defaults.
   * @returns {number|undefined}
   */
  get defaultBreakPointRating() {
    const type = this.parent?.type;
    if (type === 'armor') return DSA5.armorSubcategories[this.subcategory];
    if (type === 'meleeweapon' || type === 'rangeweapon') {
      const skill = this.combatskill?.value;
      if (!skill) return undefined;
      return DSA5.weaponStabilities[_loc(`LocalizedCTs.${skill}`)];
    }
    return undefined;
  }

  /**
   * Explicit BF, or category default when the field is unset.
   * @returns {number|undefined}
   */
  get effectiveBreakPointRating() {
    const current = this.structure?.breakPointRating;
    if (Number.isFinite(current)) return current;
    return this.defaultBreakPointRating;
  }

  /**
   * Seed `structure.breakPointRating` in memory so Foundry ADD does not start from undefined.
   * Does not persist; source stays empty so category inheritance remains.
   * @returns {number|undefined}
   */
  ensureBreakPointRating() {
    if (!this.structure) return undefined;
    const current = this.structure.breakPointRating;
    if (Number.isFinite(current)) return current;
    const fallback = this.defaultBreakPointRating;
    if (!Number.isFinite(fallback)) return current;
    this.structure.breakPointRating = fallback;
    return fallback;
  }
}
