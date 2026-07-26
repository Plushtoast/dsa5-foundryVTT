import NavalCombat from './naval-combat.js';
import NavalCombatDamage from './naval-combat-damage.js';
import RollRequestService from '../../system/queries/roll-request.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import VehicleData from '../../data/actor/vehicle.js';

const { duplicate } = foundry.utils;

export default class NavalHeroActionHandler {
  static register() {
    Hooks.on('updateChatMessage', this.#onRollRequestFinalized.bind(this));
  }

  /** ActAttackDialog entries during MKR hero-actions phase. */
  static dialogEntries() {
    if (!NavalCombat.isNavalMkrActive()) return null;
    if (game.combat?.system?.mkrPhase !== 'heroActions') return null;

    return [
      {
        name: _loc('VEHICLE.mkr.action.repair'),
        id: 'naval-repair',
        special: 'navalHeroAction',
        heroAction: 'repair',
        img: 'icons/tools/smithing/hammer-sledge.webp',
        icon: 'fas fa-hammer',
        tooltip: 'VEHICLE.mkr.repairTooltip',
      },
      {
        name: _loc('VEHICLE.mkr.action.maneuver'),
        id: 'naval-maneuver',
        special: 'navalHeroAction',
        heroAction: 'maneuver',
        img: 'icons/tools/nautical/anchor.webp',
        icon: 'fas fa-wind',
        tooltip: 'VEHICLE.mkr.sailTooltip',
      },
      {
        name: _loc('VEHICLE.mkr.action.commands'),
        id: 'naval-commands',
        special: 'navalHeroAction',
        heroAction: 'commands',
        img: 'icons/sundries/flags/banner-flag-red.webp',
        icon: 'fas fa-flag',
        tooltip: 'VEHICLE.mkr.commandsTooltip',
      },
      {
        name: _loc('VEHICLE.mkr.action.heal'),
        id: 'naval-heal',
        special: 'navalHeroAction',
        heroAction: 'heal',
        img: 'icons/commodities/biological/organ-heart-red.webp',
        icon: 'fas fa-kit-medical',
        tooltip: 'VEHICLE.mkr.healTooltip',
      },
    ];
  }

  /**
   * From init tracker / ActAttackDialog: pick ship, resolve maneuver type, roll as actor.
   * @param {Actor} actor
   * @param {string} action  repair|maneuver|sail|drive|commands|heal
   */
  static async executeFromActor(actor, action) {
    if (!actor || !action) return;

    if (!NavalCombat.canUseHeroActions()) {
      ui.notifications.warn('VEHICLE.mkr.heroActionsOnlyTooltip', { localize: true });
      return;
    }

    const vehicle = await this.pickVehicle(game.combat, { actor });
    if (!vehicle) return;

    let resolved = action;
    if (action === 'maneuver') {
      resolved = this.resolveManeuverAction(vehicle);
      if (!resolved) {
        ui.notifications.warn('VEHICLE.mkr.maneuverUnavailable', { localize: true });
        return;
      }
    }

    await this.execute(vehicle, resolved, { actor });
  }

  static vehiclesInCombat(combat = game.combat) {
    if (!combat) return [];
    const seen = new Set();
    const vehicles = [];
    for (const c of combat.combatants) {
      const actor = c.actor;
      if (!actor || actor.type !== 'vehicle' || seen.has(actor.id)) continue;
      seen.add(actor.id);
      vehicles.push(actor);
    }
    return vehicles;
  }

  /**
   * Prefer the vehicle this actor crews; otherwise pick from combat vehicles.
   * @param {Combat} [combat]
   * @param {{ actor?: Actor }} [options]
   */
  static async pickVehicle(combat = game.combat, { actor } = {}) {
    if (actor) {
      const crewed = VehicleData.findVehicleForActor(actor);
      if (crewed) return crewed;
    }

    const vehicles = this.vehiclesInCombat(combat);
    if (!vehicles.length) {
      // Still allow crewed vehicle even if not in combat tracker yet
      if (actor) {
        ui.notifications.warn('VEHICLE.mkr.noVehicleForHero', { localize: true });
      } else {
        ui.notifications.warn('VEHICLE.mkr.noVehicleInCombat', { localize: true });
      }
      return null;
    }
    if (vehicles.length === 1) return vehicles[0];

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: _loc('VEHICLE.mkr.pickVehicle') },
      content: `<p>${_loc('VEHICLE.mkr.pickVehicleText')}</p>`,
      buttons: vehicles
        .map((v) => ({
          action: v.id,
          label: v.name,
          icon: 'fas fa-ship',
        }))
        .concat([{ action: 'cancel', label: _loc('cancel'), icon: 'fas fa-times' }]),
    });

    if (!choice || choice === 'cancel') return null;
    return vehicles.find((v) => v.id === choice) ?? null;
  }

  static resolveManeuverAction(vehicle) {
    if (!vehicle) return null;
    const propulsion = vehicle.system.details?.propulsion;
    const travelModes = vehicle.system.details?.travelModes ?? [];
    const showDrive = propulsion === 'land' || travelModes.includes('land') || travelModes.includes('vehicle');
    const showSail = (
      (['row', 'sail', 'mixed'].includes(propulsion) && travelModes.includes('sea'))
      || travelModes.includes('air')
    );
    if (showDrive && !showSail) return 'drive';
    if (showSail) return 'sail';
    if (travelModes.includes('sea') || travelModes.includes('air') || ['row', 'sail', 'mixed'].includes(propulsion)) return 'sail';
    if (showDrive) return 'drive';
    return 'sail';
  }

  /**
   * @param {Actor} vehicle
   * @param {string} action
   * @param {{ actor?: Actor }} [options]
   */
  static async execute(vehicle, action, { actor } = {}) {
    if (!NavalCombat.canUseHeroActions()) {
      ui.notifications.warn('VEHICLE.mkr.heroActionsOnlyTooltip', { localize: true });
      return;
    }

    const character = actor ?? game.user.character;
    if (character) {
      await this.#rollAsPlayer(vehicle, action, character);
      return;
    }

    if (game.user.isGM) {
      await this.#requestRollAsGM(vehicle, action);
      return;
    }

    ui.notifications.warn('VEHICLE.mkr.noCharacter', { localize: true });
  }

  static async #rollAsPlayer(vehicle, action, actor) {
    const config = await this.#resolveActionConfig(action, actor);
    if (!config) return;

    const skill = NavalCombat.resolveSkill(actor, config.skillName);
    if (!skill) {
      ui.notifications.warn('VEHICLE.mkr.missingSkill', { localize: true, skill: config.skillName });
      return;
    }

    const options = {
      modifier: config.modifier,
      subtitle: ` (${vehicle.name})`,
      postFunction: {
        functionName: 'game.dsa5.combat.NavalHeroActionHandler.postPlayerRollResult',
        vehicleId: vehicle.id,
        action,
      },
    };

    const setupData = await actor.setupSkill(skill, options, undefined);
    if (!setupData) return;

    await actor.basicTest(setupData);
  }

  static async postPlayerRollResult(postFunction, payload) {
    const vehicle = game.actors.get(postFunction.vehicleId);
    if (!vehicle) return;
    await this.applyResult(payload, { vehicle, action: postFunction.action });
  }

  static async #requestRollAsGM(vehicle, action) {
    const config = await this.#resolveActionConfig(action);
    if (!config) return;

    const [actorId] = await ActorPickerDialog.open({
      title: 'VEHICLE.mkr.pickHero',
      selectionMode: 'single',
      showSourceToggle: true,
    });
    if (!actorId) return;

    const actor = game.actors.get(actorId);
    if (!actor) return;

    await RollRequestService.createRequest({
      category: 'skill',
      name: config.skillName,
      modifier: config.modifier,
      subtitle: ` (${vehicle.name})`,
      label: _loc(`VEHICLE.mkr.action.${action}`),
      actors: [actor],
      flowContext: {
        handler: 'navalHeroAction',
        vehicleId: vehicle.id,
        action,
      },
    });
  }

  static async #resolveActionConfig(action, actor = null) {
    const names = NavalCombat.skillNames();

    switch (action) {
      case 'repair':
        return this.#resolveRepairConfig(names, actor);
      case 'sail':
      case 'drive':
        return { skillName: names.boats, modifier: -1 };
      case 'commands':
        return { skillName: names.warfare, modifier: 0 };
      case 'heal':
        return { skillName: names.wounds, modifier: 0 };
      default:
        return null;
    }
  }

  static async #resolveRepairConfig(names, actor) {
    const candidates = [];
    if (actor) {
      if (actor.items.find((i) => i.type === 'skill' && i.name === names.wood)) candidates.push({ skillName: names.wood, modifier: 2 });
      if (actor.items.find((i) => i.type === 'skill' && i.name === names.cloth)) candidates.push({ skillName: names.cloth, modifier: 2 });
    } else {
      candidates.push({ skillName: names.wood, modifier: 2 }, { skillName: names.cloth, modifier: 2 });
    }

    if (!candidates.length) {
      ui.notifications.warn('VEHICLE.mkr.missingRepairSkill', { localize: true });
      return null;
    }

    if (candidates.length === 1) return candidates[0];

    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: _loc('VEHICLE.mkr.repairPickTitle') },
      content: `<p>${_loc('VEHICLE.mkr.repairPickText')}</p>`,
      buttons: candidates.map((c) => ({
        action: c.skillName,
        label: c.skillName,
        icon: 'fas fa-hammer',
      })).concat([{ action: 'cancel', label: _loc('cancel'), icon: 'fas fa-times' }]),
    });

    if (!choice || choice === 'cancel') return null;
    return candidates.find((c) => c.skillName === choice) ?? null;
  }

  static async applyResult(payload, { vehicle, action }) {
    const rollResult = payload?.result?.result ?? payload?.result ?? payload;
    const qs = rollResult?.qualityStep ?? 0;
    const successLevel = rollResult?.successLevel ?? 0;
    const success = successLevel > 0;

    const combat = game.combat;
    let healed = 0;
    let saved = 0;
    let maneuverType = null;
    let guns = 0;

    if (combat && NavalCombat.isNavalMkrActive(combat)) {
      const updates = {};

      if (action === 'repair' && success) {
        healed = await NavalCombatDamage.applyRepair(vehicle, qs);
      }

      if ((action === 'sail' || action === 'drive') && success) {
        maneuverType = await NavalCombatDamage.pickManeuverType(vehicle, action);
        if (maneuverType) {
          const pending = duplicate(combat.system.maneuverModifiers ?? {});
          pending[vehicle.id] = {
            ...(pending[vehicle.id] ?? {}),
            maneuverQS: qs,
            maneuverAction: action,
            maneuverType,
          };
          updates['system.maneuverModifiers'] = pending;
        }
      }

      if (action === 'commands' && success) {
        guns = Math.floor(qs / 2);
        if (guns > 0) {
          const commanded = [...(combat.system.commandedGuns ?? []), { vehicleId: vehicle.id, count: guns }];
          updates['system.commandedGuns'] = commanded;
        }
      }

      if (action === 'heal' && success) {
        saved = await NavalCombatDamage.applyHeal(vehicle, true);
      }

      if (Object.keys(updates).length) await combat.update(updates);
    }

    const msg = _loc(`VEHICLE.mkr.result.${action}`, {
      vehicle: vehicle.name,
      qs: success ? qs : '—',
      guns: success ? guns : '—',
      healed: success ? healed : '—',
      maneuver: maneuverType
        ? _loc(`VEHICLE.mkr.maneuver${maneuverType === 'evade' ? 'Evade' : 'Attack'}`)
        : (success ? '—' : _loc('Failure')),
      saved: success ? saved : '—',
    });
    ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
  }

  static async #onRollRequestFinalized(message, changes) {
    if (!changes.flags) return;

    const state = message.getFlag('dsa5', RollRequestService.FLAG_KEY);
    if (!state?.finalized || state._navalHeroHandled) return;

    const ctx = state.flowContext;
    if (ctx?.handler !== 'navalHeroAction') return;

    const vehicle = game.actors.get(ctx.vehicleId);
    if (!vehicle) return;

    for (const recipient of state.recipients ?? []) {
      if (!['success', 'critical'].includes(recipient.status) && recipient.status !== 'failure' && recipient.status !== 'botch') continue;
      if (!recipient.resultDetails) continue;

      await this.applyResult(
        { result: { qualityStep: recipient.resultDetails.qualityStep, successLevel: recipient.status === 'success' || recipient.status === 'critical' ? 1 : -1 } },
        { vehicle, action: ctx.action },
      );
    }

    await message.setFlag('dsa5', RollRequestService.FLAG_KEY, { ...state, _navalHeroHandled: true });
  }
}
