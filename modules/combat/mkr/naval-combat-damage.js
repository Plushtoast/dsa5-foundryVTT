import Actordsa5 from '../../actor/actor-dsa5.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import NavalCombat from './naval-combat.js';
import NavalBoardWeapons from './naval-board-weapons.js';
import VehicleRamWeapon from '../../data/actor/vehicle-ram-weapon.js';

const { duplicate, randomID } = foundry.utils;

const STRUCTURE_ATTACK_SIZES = new Set(['big', 'giant']);

export default class NavalCombatDamage {
  static register() {
    DSA5.asyncHooks.postProcessOpposedResult.push(this.postProcessOpposedResult.bind(this));
    DSA5.asyncHooks.preApplyDamage.push(this.preApplyDamage.bind(this));
    Hooks.on('dsa5.prepareRollSituationalModifiers', this.prepareRollSituationalModifiers.bind(this));
    Hooks.on('renderChatMessageHTML', this.onRenderChatMessage.bind(this));
  }

  static getManeuver(combat, vehicleId) {
    return combat?.system?.maneuverModifiers?.[vehicleId];
  }

  static async applyRepair(vehicle, qs) {
    if (!qs || qs <= 0) return 0;

    const status = vehicle.system.status.structurePoints;
    const healed = Math.min(qs, status.max - status.value);
    if (healed <= 0) return 0;

    await vehicle.update({ 'system.status.structurePoints.value': status.value + healed });
    return healed;
  }

  static async pickManeuverType(vehicle, action) {
    const choice = await foundry.applications.api.DialogV2.wait({
      window: { title: _loc(`VEHICLE.mkr.maneuverPickTitle.${action}`) },
      content: `<p>${_loc('VEHICLE.mkr.maneuverPickText')}</p>`,
      buttons: [
        { action: 'evade', label: _loc('VEHICLE.mkr.maneuverEvade'), icon: 'fas fa-shield-alt', default: true },
        { action: 'attack', label: _loc('VEHICLE.mkr.maneuverAttack'), icon: 'fas fa-crosshairs' },
        { action: 'cancel', label: _loc('cancel'), icon: 'fas fa-times' },
      ],
    });

    if (!choice || choice === 'cancel') return null;
    return choice;
  }

  static async applyHeal(vehicle, success) {
    if (!success) return 0;

    const wounded = vehicle.system.combatState?.woundedCrew ?? 0;
    if (wounded <= 0) return 0;

    await vehicle.update({ 'system.combatState.woundedCrew': wounded - 1 });
    return 1;
  }

  static async postProcessOpposedResult(attacker, defender, opposedResult) {
    if (!NavalCombat.isNavalMkrActive()) return;
    if (game.combat.system.mkrPhase !== 'attacks') return;

    const defActor = DSA5_Utility.getSpeaker(defender.speaker);
    if (!defActor || defActor.type !== 'vehicle') return;

    const maneuver = this.getManeuver(game.combat, defActor.id);
    if (maneuver?.maneuverType === 'evade' && opposedResult.winner === 'attacker') {
      const penalty = Math.min(6, maneuver.maneuverQS || 0);
      const attSL = attacker.testResult?.successLevel ?? 0;
      const defSL = defender.testResult?.successLevel ?? -5;

      if (attSL - penalty <= defSL) {
        opposedResult.winner = 'defender';
        delete opposedResult.damage;
        opposedResult.other ??= [];
        opposedResult.other.push(`<p>${_loc('VEHICLE.mkr.maneuverEvadeBlocked', { penalty })}</p>`);
        return;
      }
    }

    if (opposedResult.winner !== 'attacker' || !opposedResult.damage) return;

    const stpFormula = this.#resolveStpFormula(attacker, defActor);
    if (!stpFormula) return;

    // Defer StP + crew until Schadensbericht — initiative order does not matter.
    delete opposedResult.damage;
    opposedResult.other ??= [];
    opposedResult.other.push(`<p>${_loc('VEHICLE.mkr.hitQueued')}</p>`);

    await this.#queueHit(defActor, attacker, stpFormula);

    const source = attacker?.testResult?.source;
    if (source && VehicleRamWeapon.isRamWeapon(source)) {
      await NavalBoardWeapons.applyRamCooldown(attacker);
      const attackingVehicle = NavalBoardWeapons.resolveAttackingVehicle(attacker);
      if (attackingVehicle) {
        await this.#queueHit(attackingVehicle, attacker, VehicleRamWeapon.SELF_DAMAGE);
        opposedResult.other.push(`<p>${_loc('VEHICLE.ramSelfDamageQueued', { formula: VehicleRamWeapon.SELF_DAMAGE })}</p>`);
      }
    }
  }

  static async preApplyDamage(actor, hookOptions) {
    if (actor.type !== 'vehicle' || !NavalCombat.isNavalMkrActive()) return;
    if (hookOptions.heal) return;

    // Structure hits are applied only in Schadensbericht via processDamageReport.
    hookOptions.amount = 0;
    hookOptions.updateData = {};
    hookOptions.afterApply = null;
  }

  /** Apply all queued hits for the current MKR (StP + crew). Order is irrelevant. */
  static async processDamageReport(combat = game.combat) {
    if (!game.user.isGM || !NavalCombat.isNavalMkrActive(combat)) return;

    const pending = duplicate(combat.system.pendingHits ?? []);
    if (!pending.length) {
      ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${_loc('VEHICLE.mkr.damageReportEmpty')}</p>`));
      return;
    }

    const messages = [];
    const updateMap = new Map();

    for (const hit of pending) {
      const vehicle = game.actors.get(hit.vehicleId);
      if (!vehicle) continue;

      const existing = updateMap.get(vehicle.id) ?? { _id: vehicle.id };

      const stpRoll = await new Roll(hit.stpFormula).evaluate();
      const stpDamage = stpRoll.total;
      const status = vehicle.system.status.structurePoints;
      const currentStp = existing['system.status.structurePoints.value'] ?? status.value;
      existing['system.status.structurePoints.value'] = Math.max(0, currentStp - stpDamage);

      const crewRoll = await new Roll('1d3 - 1').evaluate();
      const wounded = Math.max(0, crewRoll.total);
      const prevWounded = existing['system.combatState.woundedCrew']
        ?? vehicle.system.combatState?.woundedCrew
        ?? 0;
      existing['system.combatState.woundedCrew'] = prevWounded + wounded;
      updateMap.set(vehicle.id, existing);

      messages.push(_loc('VEHICLE.mkr.damageReportHit', {
        vehicle: vehicle.name,
        attacker: hit.attackerName,
        stp: stpDamage,
        crew: wounded,
      }));
    }

    const actorUpdates = [...updateMap.values()];
    if (actorUpdates.length) await Actordsa5.updateDocuments(actorUpdates);
    await combat.update({ 'system.pendingHits': [] });

    const content = `<p><b>${_loc('VEHICLE.mkr.damageReportTitle')}</b></p>${messages.map((m) => `<p>${m}</p>`).join('')}`;
    ChatMessage.create(DSA5_Utility.chatDataSetup(content));
  }

  static prepareRollSituationalModifiers(actor, situationalModifiers, context) {
    if (!NavalCombat.isNavalMkrActive()) return;
    if (game.combat.system.mkrPhase !== 'attacks') return;
    if (context.mode !== 'attack') return;

    const sourceType = context.source?.type ?? context.rollType;
    if (!['rangeweapon', 'meleeweapon', 'weapon'].includes(sourceType)) return;

    const vehicleId = this.#resolveAttackerVehicleId(context);
    if (!vehicleId) return;

    const maneuver = this.getManeuver(game.combat, vehicleId);
    if (maneuver?.maneuverType !== 'attack') return;

    const bonus = Math.min(6, maneuver.maneuverQS || 0);
    if (bonus <= 0) return;

    situationalModifiers.push({
      name: _loc('VEHICLE.mkr.maneuverAttackBonus'),
      value: bonus,
      selected: true,
    });
  }

  static async promptCommandedGuns(combat = game.combat) {
    if (!game.user.isGM || !NavalCombat.isNavalMkrActive(combat)) return;

    const batches = this.#normalizeCommandedGuns(combat.system.commandedGuns ?? []);
    if (!batches.length) return;

    const totalGuns = batches.reduce((sum, batch) => sum + batch.count, 0);
    const content = `<p>${_loc('VEHICLE.mkr.commandedGunsPrompt', { count: totalGuns })}</p>
      <div class="center" style="margin-top:8px">
        <button type="button" class="dsadesignbutton naval-fire-commanded-guns" data-combat-id="${combat.id}">
          <i class="fas fa-bullseye"></i> ${_loc('VEHICLE.mkr.fireCommandedGuns')}
        </button>
      </div>`;

    ChatMessage.create(DSA5_Utility.chatDataSetup(content));
  }

  static async executeCommandedGuns(combat = game.combat) {
    if (!game.user.isGM || !NavalCombat.isNavalMkrActive(combat)) return;

    const batches = this.#normalizeCommandedGuns(combat.system.commandedGuns ?? []);
    if (!batches.length) {
      ui.notifications.warn('VEHICLE.mkr.noCommandedGuns', { localize: true });
      return;
    }

    if (!game.user.targets.size) {
      ui.notifications.warn('VEHICLE.mkr.pickTargetFirst', { localize: true });
      return;
    }

    let fired = 0;

    for (const batch of batches) {
      const vehicle = game.actors.get(batch.vehicleId);
      if (!vehicle) continue;

      const token = canvas.tokens.placeables.find((t) => t.actor?.id === vehicle.id);
      const tokenId = token?.document?.id;
      const uncrewed = this.#uncrewedSiegeWeapons(vehicle);

      for (let i = 0; i < batch.count && i < uncrewed.length; i++) {
        const weapon = uncrewed[i];
        const setup = await NavalBoardWeapons.resolveFireSetup(vehicle, weapon, 'attack', { tokenId });
        if (!setup) continue;

        const setupData = await setup.rollingActor.setupWeapon(weapon, 'attack', setup.options, tokenId);
        if (!setupData) continue;

        await setup.rollingActor.basicTest(setupData);
        fired++;
      }
    }

    if (fired > 0) {
      ChatMessage.create(DSA5_Utility.chatDataSetup(
        `<p>${_loc('VEHICLE.mkr.commandedGunsFired', { count: fired })}</p>`,
      ));
    } else {
      ui.notifications.warn('VEHICLE.mkr.noUncrewedGuns', { localize: true });
    }
  }

  static async initiateBoarding() {
    if (!NavalCombat.isNavalMkrActive() || game.combat.system.mkrPhase !== 'attacks') {
      ui.notifications.warn('VEHICLE.mkr.boardingPhaseOnly', { localize: true });
      return;
    }
    if (!game.user.isGM) {
      ui.notifications.warn('DSAError.requiresGM', { localize: true });
      return;
    }

    const selected = canvas.tokens.controlled.filter((t) => t.actor);
    if (selected.length < 2) {
      ui.notifications.warn('VEHICLE.mkr.boardingSelectTwo', { localize: true });
      return;
    }

    const pairs = [];
    for (let i = 0; i < selected.length; i++) {
      for (let j = i + 1; j < selected.length; j++) {
        const distance = canvas.grid.measurePath([
          { x: selected[i].document.x, y: selected[i].document.y },
          { x: selected[j].document.x, y: selected[j].document.y },
        ]).distance;

        if (NavalCombat.stepsToRE(distance) <= 1) {
          pairs.push({ a: selected[i], b: selected[j], distance });
        }
      }
    }

    if (!pairs.length) {
      ui.notifications.warn('VEHICLE.mkr.boardingTooFar', { localize: true });
      return;
    }

    const lines = pairs.map((pair) => _loc('VEHICLE.mkr.boardingPair', {
      a: pair.a.document.name,
      b: pair.b.document.name,
      steps: Math.round(pair.distance),
    }));

    const content = `<p><b>${_loc('VEHICLE.mkr.boardingTitle')}</b></p>
      ${lines.map((line) => `<p>${line}</p>`).join('')}
      <p>${_loc('VEHICLE.mkr.boardingHandoff')}</p>`;

    ChatMessage.create(DSA5_Utility.chatDataSetup(content));
  }

  static onRenderChatMessage(_app, html, _msg) {
    const $html = $(html);
    $html.on('click', '.naval-fire-commanded-guns', async (ev) => {
      ev.preventDefault();
      if (!game.user.isGM) return;
      await this.executeCommandedGuns(game.combat);
    });
  }

  static async #queueHit(vehicle, attacker, stpFormula) {
    const combat = game.combat;
    if (!combat) return;

    const pending = duplicate(combat.system.pendingHits ?? []);
    const attActor = DSA5_Utility.getSpeaker(attacker.speaker);

    pending.push({
      id: randomID(),
      vehicleId: vehicle.id,
      stpFormula,
      attackerName: attActor?.name ?? '—',
    });

    await combat.update({ 'system.pendingHits': pending });
  }

  static #resolveStpFormula(attacker, defenderVehicle) {
    const source = attacker?.testResult?.source;
    if (!source) return null;

    if (source.type === 'rangeweapon') {
      const stp = source.system?.damage?.stp;
      if (stp) return stp;
      if (source.system?.siegeRules) return source.system.damage?.value || null;
    }

    if (source.type === 'meleeweapon') {
      if (VehicleRamWeapon.isRamWeapon(source)) {
        const attackingVehicle = NavalBoardWeapons.resolveAttackingVehicle(attacker);
        if (!attackingVehicle) return null;
        return VehicleRamWeapon.targetStpFormula(attackingVehicle);
      }

      const msg = game.messages.get(attacker.messageId);
      const vehicleSpeaker = msg?.flags?.data?.extra?.options?.vehicleSpeaker;
      if (vehicleSpeaker) {
        const stp = source.system?.damage?.stp;
        return stp || null;
      }
    }

    const attActor = DSA5_Utility.getSpeaker(attacker.speaker);
    if (attActor && STRUCTURE_ATTACK_SIZES.has(attActor.system?.status?.size?.value)) {
      if (attacker.testResult?.damage) return String(attacker.testResult.damage);
      return source.system?.damage?.value || null;
    }

    const msg = game.messages.get(attacker.messageId);
    const vehicleSpeaker = msg?.flags?.data?.extra?.options?.vehicleSpeaker;
    if (vehicleSpeaker) {
      const stp = source.system?.damage?.stp;
      return stp || (source.system?.siegeRules ? source.system.damage?.value : null);
    }

    return null;
  }

  static #resolveAttackerVehicleId(context) {
    const vehicleSpeaker = context.testData?.extra?.options?.vehicleSpeaker;
    if (vehicleSpeaker?.actor) return vehicleSpeaker.actor;
    return null;
  }

  static #normalizeCommandedGuns(raw) {
    return raw.map((entry) => {
      if (typeof entry === 'string') return this.#parseLegacyCommandedGun(entry);
      if (entry?.vehicleId && entry.count > 0) return entry;
      return null;
    }).filter(Boolean);
  }

  static #parseLegacyCommandedGun(entry) {
    const match = entry.match(/^(.+):(\d+)$/);
    if (!match) return null;

    const vehicle = game.actors.find((a) => a.type === 'vehicle' && a.name === match[1]);
    if (!vehicle) return null;

    return { vehicleId: vehicle.id, count: Number(match[2]) };
  }

  static #uncrewedSiegeWeapons(vehicle) {
    const operators = vehicle.system.weaponOperators ?? {};

    return vehicle.items.filter((item) => {
      if (item.type !== 'rangeweapon' || !item.system?.siegeRules) return false;
      if (!item.system?.worn?.value) return false;
      return !operators[item.id];
    });
  }
}
