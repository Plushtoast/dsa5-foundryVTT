const RAM_COOLDOWN_MKR = 6;
const RAM_AT_MODIFIER = -4;
const RAM_SELF_DAMAGE = '30d6';

export default class VehicleRamWeapon {
  static COOLDOWN_MKR = RAM_COOLDOWN_MKR;
  static AT_MODIFIER = RAM_AT_MODIFIER;
  static SELF_DAMAGE = RAM_SELF_DAMAGE;

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

  static buildItemData() {
    const impactName = game.i18n.lang === 'de' ? 'Hiebwaffen' : 'Impact Weapons';

    return {
      name: _loc('VEHICLE.ramWeapon'),
      type: 'meleeweapon',
      img: 'icons/skills/melee/unarmed-punch-fist.webp',
      system: {
        vehicleRam: true,
        combatskill: { value: impactName },
        damage: { value: '0', stp: '½ StP' },
        worn: { value: true },
        reach: { value: 'short' },
        guidevalue: { value: '-' },
        atmod: { value: this.AT_MODIFIER },
        pamod: { value: 0 },
      },
    };
  }

  static async ensureEmbedded(vehicle) {
    if (vehicle.type !== 'vehicle') return null;
    const existing = vehicle.items.find((item) => this.isRamWeapon(item));
    if (existing) {
      await this.#syncEmbedded(existing);
      return existing;
    }

    const [created] = await vehicle.createEmbeddedDocuments('Item', [this.buildItemData()]);
    return created ?? null;
  }

  /** Keep older ram items on the new AT / damage display contract. */
  static async #syncEmbedded(item) {
    const updates = {};
    if (Number(item.system.atmod?.value) !== this.AT_MODIFIER) {
      updates['system.atmod.value'] = this.AT_MODIFIER;
    }
    if (item.system.damage?.stp === '2d6+4' || !item.system.damage?.stp) {
      updates['system.damage.stp'] = '½ StP';
    }
    if (Object.keys(updates).length) await item.update(updates);
  }
}
