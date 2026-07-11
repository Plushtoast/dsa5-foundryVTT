const RAM_COOLDOWN_MKR = 6;

export default class VehicleRamWeapon {
  static COOLDOWN_MKR = RAM_COOLDOWN_MKR;

  static isRamWeapon(item) {
    return item?.type === 'meleeweapon' && !!item.system?.vehicleRam;
  }

  static isRamCapable(vehicle) {
    return Number(vehicle?.system?.status?.speed?.ram ?? 0) > 0;
  }

  static isRamReady(vehicle) {
    return (vehicle?.system?.combatState?.ramCooldownMKR ?? 0) <= 0;
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
        damage: { value: '0', stp: '2d6+4' },
        worn: { value: true },
        reach: { value: 'short' },
        guidevalue: { value: 'kk' },
        atmod: { value: 0 },
        pamod: { value: 0 },
      },
    };
  }

  static async ensureEmbedded(vehicle) {
    if (vehicle.type !== 'vehicle') return null;
    const existing = vehicle.items.find((item) => this.isRamWeapon(item));
    if (existing) return existing;

    const [created] = await vehicle.createEmbeddedDocuments('Item', [this.buildItemData()]);
    return created ?? null;
  }
}
