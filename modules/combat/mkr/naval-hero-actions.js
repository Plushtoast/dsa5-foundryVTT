import NavalCombat from './naval-combat.js';
import NavalCombatDamage from './naval-combat-damage.js';
import RollRequestService from '../../system/queries/roll-request.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { duplicate } = foundry.utils;

export default class NavalHeroActionHandler {
  static register() {
    Hooks.on('updateChatMessage', this.#onRollRequestFinalized.bind(this));
  }

  static async execute(vehicle, action) {
    if (!NavalCombat.canUseHeroActions()) {
      ui.notifications.warn('VEHICLE.mkr.heroActionsOnlyTooltip', { localize: true });
      return;
    }

    const character = game.user.character;
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
      guns: action === 'commands' && success ? guns : undefined,
      healed: action === 'repair' && success ? healed : undefined,
      maneuver: maneuverType ? _loc(`VEHICLE.mkr.maneuver${maneuverType === 'evade' ? 'Evade' : 'Attack'}`) : (action === 'sail' || action === 'drive') && success ? '—' : undefined,
      saved: action === 'heal' && success ? saved : undefined,
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
