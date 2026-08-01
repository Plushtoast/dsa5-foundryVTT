import NavalCombat from './naval-combat.js';
import Chase from '../chase/chase.js';

/**
 * When tokens that include vehicles join combat outside naval MKR / vehicle chase,
 * ask the GM which vehicle combat mode to start, then proceed.
 */
export default class VehicleCombatJoinPrompt {
  /**
   * @param {TokenDocument[]} tokens
   * @param {{ combat?: Combat }} [options]
   * @returns {Promise<Combat|null>} Combat ready for vehicles, or null if cancelled
   */
  static async ensureVehicleCombatMode(tokens, { combat } = {}) {
    const vehicles = tokens.filter((t) => t.actor?.type === 'vehicle');
    if (!vehicles.length) return combat ?? game.combats.viewed ?? null;

    combat ??= game.combats.viewed;
    if (this.#modeAllowsVehicles(combat)) return combat;

    if (!game.user.isGM) {
      ui.notifications.warn('VEHICLE.combat.mkrOnly', { localize: true });
      return null;
    }

    const mode = await this.#promptMode(vehicles);
    if (!mode) return null;

    if (!combat) {
      const cls = foundry.utils.getDocumentClass('Combat');
      combat = await cls.create({ active: true }, { render: false });
    }

    await combat.setCombatMode(mode);
    return combat;
  }

  static #modeAllowsVehicles(combat) {
    return NavalCombat.isNavalMkrActive(combat) || Chase.isVehicleChase(combat);
  }

  /**
   * Prefer Seegefecht when any vehicle has sea/river travel; still offer both modes.
   * @param {TokenDocument[]} vehicles
   * @returns {Promise<'navalMkr'|'vehicleChase'|null>}
   */
  static async #promptMode(vehicles) {
    const preferNaval = vehicles.some((t) => {
      const modes = t.actor?.system?.details?.travelModes ?? [];
      return modes.includes('sea') || modes.includes('river');
    });

    const action = await foundry.applications.api.DialogV2.wait({
      window: { title: 'VEHICLE.combat.startTitle' },
      content: `<p>${_loc('VEHICLE.combat.startHint')}</p>`,
      rejectClose: false,
      modal: true,
      buttons: [
        {
          action: 'navalMkr',
          icon: 'fas fa-ship',
          label: 'COMBAT.MODE.navalMkr',
          default: preferNaval,
        },
        {
          action: 'vehicleChase',
          icon: 'fas fa-sailboat',
          label: 'COMBAT.MODE.vehicleChase',
          default: !preferNaval,
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    });

    if (!action || action === 'cancel') return null;
    return action;
  }
}
