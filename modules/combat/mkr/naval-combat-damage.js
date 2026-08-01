import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../../system/rolls/dice-dsa5.js';
import NavalCombat from './naval-combat.js';
import NavalBoardWeapons from './naval-board-weapons.js';
import NavalHouseRules from './naval-house-rules.js';
import VehicleRamWeapon from '../../data/actor/vehicle-ram-weapon.js';

const { duplicate, randomID } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

const DAMAGE_REPORT_TEMPLATE = 'systems/dsa5/templates/chat/roll/naval-damage-report-card.hbs';

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

    const crew = Number(vehicle.system.status.crew?.value ?? 0);
    const crewMax = Number(vehicle.system.status.crew?.max ?? vehicle.system.status.crew?.initial ?? crew);
    await vehicle.update({
      'system.combatState.woundedCrew': wounded - 1,
      'system.status.crew.value': Math.min(crewMax, crew + 1),
    });
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

    const isRam = this.#isRamAttack(attacker);
    if (opposedResult.winner !== 'attacker') return;
    if (!opposedResult.damage && !isRam) return;

    const stpFormula = this.resolveStpFormula(attacker, defActor);
    if (!this.hasStpValue(stpFormula)) return;

    // Defer StP + crew until Schadensbericht — initiative order does not matter.
    delete opposedResult.damage;
    opposedResult.other ??= [];
    opposedResult.other.push(`<p>${_loc('VEHICLE.mkr.hitQueued')}</p>`);

    await this.queueHitFromAttacker(defActor, attacker, stpFormula);

    if (isRam) {
      await NavalBoardWeapons.applyRamCooldown(attacker);
      const attackingVehicle = NavalBoardWeapons.resolveAttackingVehicle(attacker);
      if (attackingVehicle) {
        await this.queueHitFromAttacker(attackingVehicle, attacker, VehicleRamWeapon.SELF_DAMAGE);
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

  /** True when a weapon StP field is present, including explicit 0. */
  static hasStpValue(stp) {
    return stp !== undefined && stp !== null && stp !== '';
  }

  /**
   * Evaluate a StP formula (supports localized W/w dice).
   * @param {string|number} formula
   * @returns {Promise<number|null>}
   */
  static async evaluateStpFormula(formula) {
    if (!this.hasStpValue(formula)) return null;
    const trimmed = String(formula).trim();
    const asNumber = Number(trimmed);
    if (Number.isFinite(asNumber) && trimmed === String(asNumber)) return Math.max(0, asNumber);
    try {
      const normalized = DiceDSA5.replaceDieLocalization(trimmed);
      const roll = await new Roll(normalized).evaluate();
      return Math.max(0, roll.total);
    } catch {
      return null;
    }
  }

  /**
   * Crew casualties for a hit: prefer queued crewDamage; else 0 StP → 1, otherwise 1W3−1.
   * @param {number} stpDamage
   * @param {object} [hit]
   * @returns {Promise<number>}
   */
  static async resolveCrewCasualties(stpDamage, hit = {}) {
    if (hit.crewDamage != null && hit.crewDamage !== '') {
      const fixed = Number(hit.crewDamage);
      if (Number.isFinite(fixed)) return Math.max(0, Math.floor(fixed));
    }
    if (stpDamage <= 0) return 1;
    const formula = DiceDSA5.replaceDieLocalization('1W3 - 1');
    const crewRoll = await new Roll(formula).evaluate();
    return Math.max(0, crewRoll.total);
  }

  /** Apply all queued hits for the current MKR (StP + crew). Order is irrelevant. */
  static async processDamageReport(combat = game.combat) {
    if (!game.user.isGM || !NavalCombat.isNavalMkrActive(combat)) return;

    const pending = duplicate(combat.system.pendingHits ?? []);
    if (!pending.length) {
      ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${_loc('VEHICLE.mkr.damageReportEmpty')}</p>`));
      return;
    }

    /** @type {Map<string, { vehicle: Actor, stpTotal: number, crewTotal: number, hits: object[] }>} */
    const aggregates = new Map();

    for (const hit of pending) {
      const vehicle = this.#resolveVehicle(hit.vehicleId, combat);
      if (!vehicle) continue;

      const stpDamage = (await this.evaluateStpFormula(hit.stpFormula ?? '0')) ?? 0;
      const wounded = await this.resolveCrewCasualties(stpDamage, hit);

      let agg = aggregates.get(vehicle.id);
      if (!agg) {
        agg = { vehicle, stpTotal: 0, crewTotal: 0, hits: [] };
        aggregates.set(vehicle.id, agg);
      }
      agg.stpTotal += stpDamage;
      agg.crewTotal += wounded;
      agg.hits.push({
        attackerName: hit.attackerName || '—',
        attackerVehicleId: hit.attackerVehicleId || null,
        stp: stpDamage,
        crew: wounded,
      });
    }

    const resolved = [];
    for (const agg of aggregates.values()) {
      const { vehicle, stpTotal, crewTotal, hits } = agg;
      const currentStp = Number(vehicle.system.status.structurePoints?.value ?? 0);
      const crewHeadcount = Number(vehicle.system.status.crew?.value ?? 0);
      const prevWounded = Number(vehicle.system.combatState?.woundedCrew ?? 0);
      // crew.value is the able-bodied pool; woundedCrew tracks healable casualties.
      const crewLoss = Math.min(Math.max(0, crewTotal), Math.max(0, crewHeadcount));

      await vehicle.update({
        'system.status.structurePoints.value': Math.max(0, currentStp - stpTotal),
        'system.status.crew.value': Math.max(0, crewHeadcount - crewLoss),
        'system.combatState.woundedCrew': prevWounded + crewLoss,
      });

      for (const hit of hits) {
        resolved.push({
          vehicleId: vehicle.id,
          vehicleName: vehicle.name,
          attackerName: hit.attackerName,
          attackerVehicleId: hit.attackerVehicleId,
          stp: hit.stp,
          crew: hit.crew,
        });
      }
    }

    await combat.update({ 'system.pendingHits': [] });

    const vehicles = this.#groupDamageReport(resolved);
    const content = await renderTemplate(DAMAGE_REPORT_TEMPLATE, { vehicles });
    ChatMessage.create(DSA5_Utility.chatDataSetup(content));
  }

  static #resolveVehicle(vehicleId, combat = game.combat) {
    if (!vehicleId) return null;
    const fromWorld = game.actors.get(vehicleId);
    if (fromWorld) return fromWorld;

    const fromCombat = combat?.combatants.find((c) => (
      c.actorId === vehicleId || c.actor?.id === vehicleId
    ))?.actor;
    if (fromCombat) return fromCombat;

    return canvas.tokens?.placeables.find((t) => t.actor?.id === vehicleId)?.actor ?? null;
  }

  /** Group applied hits by defender, then by attacking ship. */
  static #groupDamageReport(resolved) {
    const byVehicle = new Map();

    for (const hit of resolved) {
      let group = byVehicle.get(hit.vehicleId);
      if (!group) {
        group = {
          vehicleId: hit.vehicleId,
          vehicleName: hit.vehicleName,
          stpTotal: 0,
          crewTotal: 0,
          hitCount: 0,
          attackers: new Map(),
        };
        byVehicle.set(hit.vehicleId, group);
      }

      group.stpTotal += hit.stp;
      group.crewTotal += hit.crew;
      group.hitCount += 1;

      const attackerKey = hit.attackerVehicleId || hit.attackerName;
      let attacker = group.attackers.get(attackerKey);
      if (!attacker) {
        attacker = {
          attackerName: hit.attackerName,
          stpTotal: 0,
          crewTotal: 0,
          hitCount: 0,
        };
        group.attackers.set(attackerKey, attacker);
      }
      attacker.stpTotal += hit.stp;
      attacker.crewTotal += hit.crew;
      attacker.hitCount += 1;
    }

    return [...byVehicle.values()].map((group) => ({
      vehicleId: group.vehicleId,
      vehicleName: group.vehicleName,
      stpTotal: group.stpTotal,
      crewTotal: group.crewTotal,
      hitCount: group.hitCount,
      attackers: [...group.attackers.values()],
    }));
  }

  static prepareRollSituationalModifiers(actor, situationalModifiers, context) {
    if (!NavalCombat.isNavalMkrActive()) return;
    if (game.combat.system.mkrPhase !== 'attacks') return;

    const isRam = !!context.testData?.extra?.options?.vehicleRam;
    const sourceType = context.source?.type ?? context.rollType;
    const isWeaponAttack = context.mode === 'attack'
      && ['rangeweapon', 'meleeweapon', 'weapon'].includes(sourceType);
    if (!isRam && !isWeaponAttack) return;

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

  static onRenderChatMessage(_message, html) {
    const root = html?.jquery ? html[0] : html;
    if (!root) return;

    root.querySelectorAll('.naval-fire-commanded-guns').forEach((el) => {
      el.addEventListener('click', async (ev) => {
        ev.preventDefault();
        if (!game.user.isGM) return;
        await this.executeCommandedGuns(game.combat);
      });
    });

    root.querySelectorAll('.naval-damage-report-expand').forEach((el) => {
      el.addEventListener('click', (ev) => this.#onExpandDamageReport(ev));
    });
  }

  static #onExpandDamageReport(event) {
    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget;
    const vehicleEl = row.closest('.naval-damage-report-vehicle');
    const details = vehicleEl?.querySelector('.naval-damage-report-attackers');
    if (!details) return;

    const icon = row.querySelector('.naval-damage-report-expand-icon');
    const expanded = details.classList.toggle('expanded');
    icon?.classList.toggle('fa-plus', !expanded);
    icon?.classList.toggle('fa-minus', expanded);
  }

  /** Queue StP for Schadensbericht. Prefer during naval MKR attacks phase. */
  static async queueHit(vehicle, stpFormula, attackerName = '—', extras = {}) {
    const hits = await this.queueHits(vehicle, [{ stpFormula, attackerName, ...extras }]);
    return hits[0] ?? null;
  }

  /** Queue many StP hits in one combat update (Volle Breitseite). */
  static async queueHits(vehicle, entries = []) {
    const combat = game.combat;
    if (!combat || !vehicle || !entries.length) return [];

    const pending = duplicate(combat.system.pendingHits ?? []);
    const created = [];
    for (const entry of entries) {
      if (!this.hasStpValue(entry?.stpFormula)) continue;
      const hit = {
        id: randomID(),
        vehicleId: vehicle.id,
        stpFormula: String(entry.stpFormula),
        attackerName: entry.attackerName ?? '—',
        attackerVehicleId: entry.attackerVehicleId ?? null,
      };
      if (entry.crewDamage != null) hit.crewDamage = entry.crewDamage;
      pending.push(hit);
      created.push(hit);
    }
    if (created.length) await combat.update({ 'system.pendingHits': pending });
    return created;
  }

  static async queueHitFromAttacker(vehicle, attacker, stpFormula) {
    const attackingVehicle = NavalBoardWeapons.resolveAttackingVehicle(attacker);
    const attActor = DSA5_Utility.getSpeaker(attacker.speaker);
    return this.queueHit(vehicle, stpFormula, attackingVehicle?.name ?? attActor?.name ?? '—', {
      attackerVehicleId: attackingVehicle?.id ?? null,
    });
  }

  static resolveStpFormula(attacker, defenderVehicle) {
    if (this.#isRamAttack(attacker)) {
      const attackingVehicle = NavalBoardWeapons.resolveAttackingVehicle(attacker);
      if (!attackingVehicle) return null;
      return VehicleRamWeapon.targetStpFormula(attackingVehicle);
    }

    const source = attacker?.testResult?.source;
    if (!source) return null;

    const mulStatic = (formula) => NavalHouseRules.applyMultiplierToFormula(formula);

    if (source.type === 'rangeweapon') {
      const stp = source.system?.damage?.stp;
      if (this.hasStpValue(stp)) return mulStatic(stp);
      if (source.system?.siegeRules) return mulStatic(source.system.damage?.value || null);
    }

    if (source.type === 'meleeweapon') {
      const msg = game.messages.get(attacker.messageId);
      const vehicleSpeaker = msg?.flags?.data?.preData?.extra?.options?.vehicleSpeaker
        ?? msg?.flags?.data?.extra?.options?.vehicleSpeaker
        ?? attacker?.options?.vehicleSpeaker;
      if (vehicleSpeaker) {
        const stp = source.system?.damage?.stp;
        return this.hasStpValue(stp) ? mulStatic(stp) : null;
      }
    }

    // House rule: creature melee/range traits deal StP to vehicles (rolled damage already includes mul).
    if (
      source.type === 'trait'
      && NavalHouseRules.enabled('structureDamageMul')
      && NavalHouseRules.isStructureDamageSource(source)
    ) {
      if (attacker.testResult?.damage != null) return String(attacker.testResult.damage);
      return mulStatic(source.system?.damage?.value || null);
    }

    const attActor = DSA5_Utility.getSpeaker(attacker.speaker);
    if (attActor && STRUCTURE_ATTACK_SIZES.has(attActor.system?.status?.size?.value)) {
      if (attacker.testResult?.damage) return String(attacker.testResult.damage);
      return source.system?.damage?.value || null;
    }

    const msg = game.messages.get(attacker.messageId);
    const vehicleSpeaker = msg?.flags?.data?.preData?.extra?.options?.vehicleSpeaker
      ?? msg?.flags?.data?.extra?.options?.vehicleSpeaker
      ?? attacker?.options?.vehicleSpeaker;
    if (vehicleSpeaker) {
      const stp = source.system?.damage?.stp;
      if (this.hasStpValue(stp)) return mulStatic(stp);
      if (source.system?.siegeRules) return mulStatic(source.system.damage?.value || null);
    }

    return null;
  }

  static #isRamAttack(attacker) {
    const msg = game.messages.get(attacker?.messageId);
    const options = msg?.flags?.data?.preData?.extra?.options
      ?? msg?.flags?.data?.extra?.options
      ?? attacker?.testResult?.options
      ?? attacker?.options;
    if (options?.vehicleRam) return true;

    // Legacy: older embeds used a ram meleeweapon as the roll source.
    const source = attacker?.testResult?.source;
    return !!(source && VehicleRamWeapon.isRamWeapon(source));
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
