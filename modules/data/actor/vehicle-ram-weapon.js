const RAM_COOLDOWN_MKR = 6;
const RAM_SELF_DAMAGE = '30d6';
const RAM_SKILL_MODIFIER = -4;
/** Synthetic key in system.weaponOperators (not an Item id). */
const RAM_OPERATOR_KEY = 'ram';

/**
 * Vehicle ram attack rules — not an Item.
 * Rolls Boote & Schiffe / Fahrzeuge with a default −4 modifier.
 */
export default class VehicleRamWeapon {
  static COOLDOWN_MKR = RAM_COOLDOWN_MKR;
  static SELF_DAMAGE = RAM_SELF_DAMAGE;
  static SKILL_MODIFIER = RAM_SKILL_MODIFIER;
  static OPERATOR_KEY = RAM_OPERATOR_KEY;

  /** Legacy embedded ram meleeweapons (remove on sheet prepare). */
  static isRamWeapon(item) {
    return item?.type === 'meleeweapon' && !!item.system?.vehicleRam;
  }

  static isRamCapable(vehicle) {
    return Number(vehicle?.system?.status?.speed?.ram ?? 0) > 0;
  }

  static isRamReady(vehicle) {
    return (vehicle?.system?.combatState?.ramCooldownMKR ?? 0) <= 0;
  }

  /** Target StP damage = half of the attacking ship's current structure points. */
  static targetStpDamage(vehicle) {
    const current = Number(vehicle?.system?.status?.structurePoints?.value ?? 0);
    return Math.floor(current / 2);
  }

  static targetStpFormula(vehicle) {
    return String(this.targetStpDamage(vehicle));
  }

  /** Delete leftover ram meleeweapons from older vehicles. */
  static async removeLegacyEmbedded(vehicle) {
    if (vehicle?.type !== 'vehicle') return;
    const ids = vehicle.items.filter((item) => this.isRamWeapon(item)).map((item) => item.id);
    if (!ids.length) return;
    await vehicle.deleteEmbeddedDocuments('Item', ids);
  }
}
