/**
 * Compact ammunition icon picker used by actor and vehicle combat sheets.
 */
export default class AmmoPicker {
  static CLEAR = 'clear';

  /**
   * @param {object|null} ammo
   * @param {{ selected?: boolean, emptyTooltip?: string }} [opts]
   */
  static displayData(ammo, { selected = false, emptyTooltip } = {}) {
    if (!ammo) {
      return {
        pickId: this.CLEAR,
        img: '',
        tooltip: emptyTooltip || _loc('VEHICLE.pickAmmo'),
        count: '',
        selected,
      };
    }

    return {
      pickId: ammo._id || ammo.id,
      img: ammo.img,
      tooltip: ammo.name,
      count: String(Number(ammo.system?.quantity?.value) || 0),
      selected,
    };
  }

  static enrichWeapon(weapon) {
    const selectedId = weapon.system?.currentAmmo?.value;
    const currentAmmo = weapon.ammo?.find((ammo) => ammo._id === selectedId || ammo.id === selectedId);
    weapon.selectedAmmo = this.displayData(currentAmmo);
    weapon.clearAmmo = this.displayData(null, {
      selected: !selectedId,
      emptyTooltip: _loc('VEHICLE.clearAmmo'),
    });
    if (!weapon.ammo) return;

    for (const ammo of weapon.ammo) {
      Object.assign(ammo, this.displayData(ammo, { selected: ammo._id === selectedId || ammo.id === selectedId }));
    }
  }

  static matchingAmmo(actor, weapon) {
    const group = weapon?.system?.ammunitiongroup?.value;
    if (!group || group === '-') return [];
    return actor.items.filter((item) => item.type === 'ammunition' && item.system.ammunitiongroup?.value === group);
  }

  static async assign(actor, weaponId, ammoId) {
    await actor.updateEmbeddedDocuments('Item', [{
      _id: weaponId,
      'system.currentAmmo.value': ammoId ?? '',
    }]);
  }
}
