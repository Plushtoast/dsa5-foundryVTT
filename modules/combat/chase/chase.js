import Actordsa5 from '../../actor/actor-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { ActorDialogBuilder } from '../../actor/actor-dialog-builder.js';
import ChaseSkillDialog from './chase-skill-dialog.js';

export const CHASE_TERRAIN_IDS = ['open', 'passable', 'normal', 'difficult', 'severe'];

export const CHASE_TERRAIN_MULTIPLIERS = {
  open: 2,
  passable: 1.5,
  normal: 1,
  difficult: 0.75,
  severe: 0.5,
};

export const DEFAULT_CHASE_MAX_ROUNDS = 5;

/** Fortbewegungsarten — LocalizedIDs keys for chase locomotion skills. */
export const CHASE_LOCOMOTION_SKILL_KEYS = [
  'bodyControl',
  'riding',
  'driving',
  'swimming',
  'flying',
  'boatsAndShips',
];

/**
 * Basis Verfolgungsjagd (Fokusregel Stufe I).
 * Vehicle / ship chase extends this via VehicleChase.
 */
export default class Chase {
  static TERRAIN_IDS = CHASE_TERRAIN_IDS;

  static DEFAULT_MAX_ROUNDS = DEFAULT_CHASE_MAX_ROUNDS;

  static MODE = 'chase';

  static #assignFleerNotification = null;

  static register() {
    this.#patchSetupSkill();
    if (game.dsa5) game.dsa5.chase = this;
    Hooks.on('deleteCombat', () => this.clearAssignFleerHint());
  }

  static isChaseMode(mode) {
    return mode === 'chase' || mode === 'vehicleChase';
  }

  static isChaseActive(combat = game.combat) {
    return this.isChaseMode(combat?.system?.combatMode);
  }

  static isVehicleChase(combat = game.combat) {
    return combat?.system?.combatMode === 'vehicleChase';
  }

  static isBasisChase(combat = game.combat) {
    return combat?.system?.combatMode === 'chase';
  }

  static hasFleer(combat = game.combat) {
    return [...(combat?.combatants ?? [])].some((c) => this.getRole(c) === 'fleeing');
  }

  /** Permanent GM hint until a Flüchtende is assigned or the chase ends. */
  static showAssignFleerHint(combat = game.combat) {
    if (!game.user.isGM) return;
    if (!this.isChaseActive(combat) || this.hasFleer(combat)) {
      this.clearAssignFleerHint();
      return;
    }
    if (this.#assignFleerNotification) return;
    this.#assignFleerNotification = ui.notifications.warn('CHASE.assignFleerHint', {
      localize: true,
      permanent: true,
    });
  }

  static clearAssignFleerHint() {
    this.#assignFleerNotification?.remove?.();
    this.#assignFleerNotification = null;
  }

  /** Active chase implementation for the current combat mode. */
  static handlerFor(combat = game.combat) {
    if (combat?.system?.combatMode === 'vehicleChase') {
      return Chase.Vehicle ?? this;
    }
    return this;
  }

  static terrainChoices() {
    return Object.fromEntries(
      this.TERRAIN_IDS.map((id) => [id, `CHASE.terrain.${id}`]),
    );
  }

  static getTerrainLabel(terrainId) {
    return _loc(`CHASE.terrain.${terrainId || 'normal'}`);
  }

  static getTerrainMultiplier(_actor, terrainId = 'normal') {
    return CHASE_TERRAIN_MULTIPLIERS[terrainId] ?? 1;
  }

  /**
   * Prefer a live Actor document (prepared derived GS). Plain actor data objects lack max/airMax/waterMax.
   * @param {Actordsa5|Combatant|{actor?: Actordsa5}|null} actorLike
   * @returns {Actordsa5|null}
   */
  static resolveActor(actorLike) {
    if (!actorLike) return null;
    if (actorLike instanceof Actordsa5) return actorLike;
    if (actorLike.actor instanceof Actordsa5) return actorLike.actor;
    return null;
  }

  /**
   * Actor GS for chase movement (Geschwindigkeit).
   * Uses derived speed from Actor.speedByMovementType (set in ActorDataModel.calcSpeed).
   */
  static getBaseSpeed(actorLike, skillKey = null) {
    const actor = this.resolveActor(actorLike);
    if (!actor?.speedByMovementType) return 0;

    const movementType = skillKey === 'swimming' ? 'swim'
      : skillKey === 'flying' ? 'fly'
        : 'land';

    return Number(actor.speedByMovementType(movementType)) || 0;
  }

  /** Effective GS = actor GS × current chase terrain factor. */
  static getEffectiveSpeed(actorLike, combat = game.combat, terrainId = null, skillKey = null) {
    const actor = this.resolveActor(actorLike);
    const id = terrainId || combat?.system?.chaseTerrain || 'normal';
    const multiplier = this.getTerrainMultiplier(actor, id);
    const base = this.getBaseSpeed(actor, skillKey);
    return Math.round(base * multiplier * 10) / 10;
  }

  /** Options for the temporary Gelände dropdown on Verfolgungsaktion (labels include [×factor]). */
  static dialogTerrainOptions(actorLike, combat = game.combat) {
    const actor = this.resolveActor(actorLike);
    const current = combat?.system?.chaseTerrain || 'normal';
    return this.TERRAIN_IDS.map((id) => {
      const mult = this.getTerrainMultiplier(actor, id);
      const multLabel = mult === 0
        ? _loc('CHASE.multiplierBlocked')
        : `×${mult}`;
      return {
        id,
        label: `${this.getTerrainLabel(id)} [${multLabel}]`,
        selected: id === current,
        multiplier: mult,
      };
    });
  }

  static getChaseSummary(actorLike, combat = game.combat) {
    const actor = this.resolveActor(actorLike);
    const terrainId = combat?.system?.chaseTerrain ?? 'normal';
    const multiplier = this.getTerrainMultiplier(actor, terrainId);
    const base = this.getBaseSpeed(actor);
    const effective = Math.round(base * multiplier * 10) / 10;

    return {
      terrainId,
      multiplier,
      terrainLabel: this.getTerrainLabel(terrainId),
      baseSpeed: base,
      effectiveSpeed: effective,
      multiplierLabel: multiplier === 0
        ? _loc('CHASE.multiplierBlocked')
        : `× ${multiplier}`,
      distanceUnit: this.distanceUnitKey(),
    };
  }

  static distanceUnitKey() {
    return 'CHASE.distanceUnit.step';
  }

  static distanceUnitLabel() {
    return _loc(this.distanceUnitKey());
  }

  /** LocalizedIDs keys for Fortbewegungsarten skill choices. */
  static locomotionSkillKeys(actor = null, combat = game.combat) {
    if (actor?.type === 'vehicle') return ['boatsAndShips'];
    const keys = [...CHASE_LOCOMOTION_SKILL_KEYS];
    if (this.isVehicleChase(combat)) {
      return ['boatsAndShips', ...keys.filter((k) => k !== 'boatsAndShips')];
    }
    return keys;
  }

  /**
   * Resolve a chase locomotion skill on the actor by LocalizedIDs name.
   * @param {Actor} actor
   * @param {string} key LocalizedIDs key
   */
  static skillFor(actor, key) {
    if (!actor || !key) return null;
    const name = _loc(`LocalizedIDs.${key}`);
    return actor.items.find((i) => i.type === 'skill' && i.name === name) ?? null;
  }

  /** Entries for the Verfolgungsaktion skill picker. */
  static chaseSkillsFor(actor, combat = game.combat) {
    if (!actor) return [];
    return this.locomotionSkillKeys(actor, combat).flatMap((key) => {
      const item = this.skillFor(actor, key);
      if (!item) return [];
      return [{
        key,
        name: item.name,
        value: Number(item.system?.talentValue?.value) || 0,
        item,
      }];
    });
  }

  /** Mode-preferred default LocalizedIDs skill key. */
  static modeDefaultSkillKey(combat = game.combat) {
    return this.isVehicleChase(combat) ? 'boatsAndShips' : 'bodyControl';
  }

  /** Combat (or mode) default LocalizedIDs skill key. */
  static defaultSkillKey(combat = game.combat) {
    const keys = this.locomotionSkillKeys(null, combat);
    const stored = combat?.system?.chaseDefaultSkill;
    if (stored && keys.includes(stored)) return stored;
    return this.modeDefaultSkillKey(combat);
  }

  /** Dropdown options for the GM default skill picker. */
  static defaultSkillOptions(combat = game.combat) {
    const current = this.defaultSkillKey(combat);
    return this.locomotionSkillKeys(null, combat).map((key) => ({
      key,
      label: `LocalizedIDs.${key}`,
      selected: key === current,
    }));
  }

  /** Ask which Fortbewegungsart skill to roll. */
  static async pickChaseSkill(actor, combat = game.combat) {
    const skills = this.chaseSkillsFor(actor, combat);
    if (!skills.length) {
      ui.notifications.warn('CHASE.noSkill', { localize: true });
      return null;
    }
    if (skills.length === 1) return skills[0].item;

    return ChaseSkillDialog.prompt(actor, skills, this.defaultSkillKey(combat));
  }

  /** Default chase skill item for an actor (combat default / mode default). */
  static defaultSkillFor(actor, combat = game.combat) {
    return this.skillFor(actor, this.defaultSkillKey(combat))
      ?? this.skillFor(actor, this.modeDefaultSkillKey(combat));
  }

  /**
   * While chase is active, Körperbeherrschung rolls can be substituted by the chase default.
   * Basis: same skill. VehicleChase overrides to Boote & Schiffe when that is the default.
   */
  static maybeSubstituteChaseSkill(actor, skill) {
    if (!this.isChaseActive()) return skill;
    if (skill?.type !== 'skill') return skill;

    const bodyControl = _loc('LocalizedIDs.bodyControl');
    if (skill.name !== bodyControl) return skill;

    return this.defaultSkillFor(actor) ?? skill;
  }

  static getDistance(combatant) {
    const raw = combatant?.system?.chaseDistance;
    if (raw === null || raw === undefined || raw === '') return null;
    return Math.max(0, Number(raw) || 0);
  }

  /** Highest set chaser distance in the combat, or null if none are set. */
  static maxChaseDistance(combat = game.combat) {
    let max = null;
    for (const c of combat?.combatants ?? []) {
      if (this.getRole(c) === 'fleeing') continue;
      const d = this.getDistance(c);
      if (d === null) continue;
      if (max === null || d > max) max = d;
    }
    return max;
  }

  static getRole(combatant) {
    return combatant?.system?.chaseRole === 'fleeing' ? 'fleeing' : 'chasing';
  }

  /**
   * After the first fleer is assigned, ask the GM for a shared starting distance
   * and apply it to every chaser (distance to the fleer).
   */
  static async promptAndApplyInitialDistances(combat, fleer) {
    if (!game.user.isGM || !combat || !fleer) return;

    const Handler = this.handlerFor(combat);
    const unit = Handler.distanceUnitLabel();
    const value = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'CHASE.initialDistanceTitle' },
      content: `<p>${_loc('CHASE.initialDistanceHint', { name: fleer.name, unit })}</p>
        <p><label>${_loc('CHASE.distance')} (${unit})</label></p>
        <input type="number" name="distance" min="0" step="1" value="25" autofocus>`,
      ok: {
        label: 'Confirm',
        callback: (_event, button) => Number(button.form.elements.distance.value),
      },
    });

    if (value === null || value === undefined || Number.isNaN(value)) return;

    const distance = Math.max(0, Math.floor(Number(value) || 0));
    const updates = [...combat.combatants]
      .filter((c) => c.id !== fleer.id && this.getRole(c) === 'chasing')
      .map((c) => ({ _id: c.id, 'system.chaseDistance': distance }));

    if (updates.length) await combat.applyChaseDistanceUpdates(updates);
  }

  static prepareTrackerGroups(combat = game.combat) {
    const fleeing = [];
    const chasing = [];

    for (const combatant of combat?.combatants ?? []) {
      if (this.getRole(combatant) === 'fleeing') fleeing.push(combatant);
      else chasing.push(combatant);
    }

    chasing.sort((a, b) => {
      const da = this.getDistance(a);
      const db = this.getDistance(b);
      return (da ?? Number.POSITIVE_INFINITY) - (db ?? Number.POSITIVE_INFINITY);
    });

    return { fleeing, chasing };
  }

  /** Ordered combatant ids for tracker display: fleers, then chasers by distance. */
  static orderedCombatantIds(combat = game.combat) {
    const { fleeing, chasing } = this.prepareTrackerGroups(combat);
    return [...fleeing, ...chasing].map((c) => c.id);
  }

  static isCaught(combatant) {
    if (this.getRole(combatant) !== 'chasing') return false;
    const distance = this.getDistance(combatant);
    // null = GM has not set an initial distance yet (not a catch).
    return distance !== null && distance <= 0;
  }

  static hasRolled(combatant) {
    return !!combatant?.system?.chaseRolled;
  }

  /**
   * Roll the chase skill (Körperbeherrschung / Boote & Schiffe / …),
   * apply movement to distances, and mark the combatant as rolled this KR.
   * Fate points / roll edits re-run distance via postFunction (like falling damage).
   * @param {Actor} actor
   * @param {string} [tokenId]
   * @param {{ skill?: Item, skipPicker?: boolean }} [options]
   *   skipPicker — roll the combat default skill without opening the picker
   */
  static async rollAction(actor, tokenId, { skill = null, skipPicker = false } = {}) {
    if (!actor || !this.isChaseActive()) return;

    const Handler = this.handlerFor();
    if (!skill) {
      skill = skipPicker
        ? Handler.defaultSkillFor(actor)
        : await Handler.pickChaseSkill(actor);
    }
    if (!skill) {
      if (skipPicker) ui.notifications.warn('CHASE.noSkill', { localize: true });
      return;
    }

    const postFunction = {
      functionName: 'game.dsa5.chase.updateDistanceFromRoll',
      tokenId,
      speaker: ActorDialogBuilder.buildSpeaker(actor, tokenId),
      combatantId: game.combat?.combatants.find((c) => (
        (tokenId && c.tokenId === tokenId) || c.actorId === actor.id
      ))?.id,
      chaseTerrainOverride: game.combat?.system?.chaseTerrain || 'normal',
    };

    const combat = game.combat;
    const setupData = await actor.setupSkill(skill, {
      subtitle: ` (${_loc('CHASE.action')})`,
      postFunction,
      additionalOptions: {
        data: {
          chaseTerrainOptions: Handler.dialogTerrainOptions(actor, combat),
        },
        callback: (html, testData) => {
          const chaseTerrain = html.find('[name="chaseTerrain"]').val();
          if (!chaseTerrain) return;
          testData.extra.options.chaseTerrainOverride = chaseTerrain;
          if (testData.extra.options.postFunction) {
            testData.extra.options.postFunction.chaseTerrainOverride = chaseTerrain;
          }
        },
      },
    }, tokenId);
    if (!setupData) return;
    if (setupData?.testData) setupData.testData.opposable = false;

    const rolled = await actor.basicTest(setupData);
    if (!rolled?.result) return;

    await this.updateDistanceFromRoll(postFunction, { result: rolled.result });
  }

  /**
   * Apply or re-apply chase movement from a roll result.
   * Called after the initial Verfolgungsaktion and again on fate/edit rerenders.
   * @param {object} postFunction
   * @param {{ result: object }} payload  postData/testData or basicTest.result
   */
  static async updateDistanceFromRoll(postFunction, payload) {
    const combat = game.combat;
    if (!this.isChaseActive(combat)) return;

    const rollResult = this.#normalizeRollPayload(payload);
    if (!rollResult) return;

    const speakerActor = DSA5_Utility.getSpeaker(postFunction.speaker)
      ?? ChatMessage.getSpeakerActor({ actor: postFunction.speaker?.actor, token: postFunction.tokenId });
    const combatant = combat.combatants.get(postFunction.combatantId)
      ?? combat.combatants.find((c) => (
        (postFunction.tokenId && c.tokenId === postFunction.tokenId) || c.actorId === speakerActor?.id
      ));
    if (!combatant) return;

    // Derived GS (speed.max / airMax / waterMax) exists only on prepared Actor instances.
    const actor = this.resolveActor(combatant) ?? this.resolveActor(speakerActor);
    if (!actor) return;

    if (!combatant.system.chaseRolled) await combat.markChaseRolled(combatant.id);

    const Handler = this.handlerFor(combat);
    const outcome = this.outcomeFromRollResult(rollResult);
    const terrainId = postFunction.chaseTerrainOverride
      || rollResult?.preData?.extra?.options?.chaseTerrainOverride
      || rollResult?.preData?.extra?.options?.postFunction?.chaseTerrainOverride
      || combat.system.chaseTerrain
      || 'normal';
    const skillKey = this.#skillKeyFromRoll(actor, rollResult)
      || Handler.defaultSkillKey(combat);
    // Rules: movement = effective GS (+ FP on success). Fleer adds to all chasers; chaser subtracts from self.
    const gs = Handler.getEffectiveSpeed(actor, combat, terrainId, skillKey);
    const fp = outcome.success && !outcome.botch ? outcome.fp : 0;
    const delta = outcome.botch ? 0 : gs + fp;
    await Handler.reapplyMovementDelta(combat, combatant, delta, { ...outcome, gs, fp });
  }

  static #skillKeyFromRoll(actor, rollResult) {
    const name = rollResult?.preData?.source?.name || rollResult?.source?.name;
    if (!actor || !name) return null;
    for (const key of this.locomotionSkillKeys(actor)) {
      if (_loc(`LocalizedIDs.${key}`) === name) return key;
    }
    return null;
  }

  static #normalizeRollPayload(payload) {
    const data = payload?.result;
    if (!data) return null;
    if (data.successLevel !== undefined) return data;
    if (data.result?.successLevel !== undefined) return data.result;
    return null;
  }

  /** Map a DSA skill roll result to chase movement inputs. */
  static outcomeFromRollResult(result) {
    const successLevel = Number(result?.successLevel) || 0;
    const success = successLevel > 0;
    return {
      success,
      botch: successLevel <= -2,
      fp: success ? Math.max(0, Number(result?.result) || 0) : 0,
      successLevel,
    };
  }

  static actionEntryFor(actor) {
    if (!actor || !this.isChaseActive()) return null;
    const Handler = this.handlerFor();
    const skill = Handler.defaultSkillFor(actor);
    if (!skill) return null;

    return {
      name: _loc('CHASE.action'),
      id: 'chaseAction',
      special: 'chaseAction',
      img: skill.img || 'systems/dsa5/icons/categories/Skill.webp',
      value: Number(skill.system?.talentValue?.value) || 0,
      skillName: skill.name,
    };
  }

  static anyCaught(combat = game.combat) {
    return (combat?.combatants ?? []).some((c) => this.isCaught(c));
  }

  /**
   * Chat reminder for catch consequences (Sturmangriff / Passierschlag / PA −2).
   * @param {Combat} combat
   * @param {Combatant} chaser
   */
  static async announceCatch(combat, chaser) {
    if (!combat || !chaser) return;

    const fleers = [...combat.combatants]
      .filter((c) => this.getRole(c) === 'fleeing')
      .map((c) => c.name)
      .filter(Boolean);
    const fleer = fleers.length ? fleers.join(', ') : _loc('CHASE.role.fleeing');

    await ChatMessage.create(DSA5_Utility.chatDataSetup(_loc('CHASE.caughtConsequences', {
      chaser: chaser.name,
      fleer,
    })));
  }

  static chaseRoundsElapsed(combat = game.combat) {
    if (!combat) return 0;
    const start = combat.system.chaseStartRound ?? combat.round ?? 1;
    return Math.max(0, (combat.round || 0) - start);
  }

  /** 1-based chase KR for display (KR 1…max while the chase is ongoing). */
  static chaseRoundNumber(combat = game.combat) {
    const max = combat?.system?.chaseMaxRounds || this.DEFAULT_MAX_ROUNDS;
    return Math.min(this.chaseRoundsElapsed(combat) + 1, max);
  }

  static hasEscaped(combat = game.combat) {
    if (!this.isChaseActive(combat)) return false;
    if (this.anyCaught(combat)) return false;
    const max = combat.system.chaseMaxRounds || this.DEFAULT_MAX_ROUNDS;
    // Escape after max full chase rounds have been completed (not during the last one).
    return this.chaseRoundsElapsed(combat) >= max;
  }

  static getProgress(combat = game.combat) {
    if (!this.isChaseActive(combat)) return null;

    const max = combat.system.chaseMaxRounds || this.DEFAULT_MAX_ROUNDS;
    const elapsed = this.chaseRoundNumber(combat);
    const terrainId = combat.system.chaseTerrain ?? 'normal';
    const Handler = this.handlerFor(combat);

    const defaultSkillKey = Handler.defaultSkillKey(combat);
    return {
      mode: combat.system.combatMode,
      terrainId,
      terrainLabel: Handler.getTerrainLabel(terrainId),
      terrainOptions: Handler.TERRAIN_IDS.map((id) => ({
        id,
        label: Handler.terrainChoices()[id],
      })),
      defaultSkillKey,
      defaultSkillLabel: _loc(`LocalizedIDs.${defaultSkillKey}`),
      defaultSkillOptions: Handler.defaultSkillOptions(combat),
      elapsed,
      maxRounds: max,
      escaped: Handler.hasEscaped(combat),
      caught: Handler.anyCaught(combat),
      distanceUnit: Handler.distanceUnitLabel(),
    };
  }

  /**
   * Movement this round from a chase skill result.
   * Success: effective GS + FP; fail: effective GS; botch: 0 (caller tracks skip next).
   */
  static movementFromRoll(actorLike, { success = true, botch = false, fp = 0 } = {}, combat = game.combat, terrainId = null, skillKey = null) {
    if (botch) return 0;
    const gs = this.getEffectiveSpeed(actorLike, combat, terrainId, skillKey);
    if (!success) return gs;
    return gs + Math.max(0, Number(fp) || 0);
  }

  /**
   * Re-apply movement after fate/edit: undo the previous Verfolgungsaktion delta, then apply the new one.
   */
  static async reapplyMovementDelta(combat, combatant, delta, outcome = {}) {
    if (!combat || !combatant) return;

    const role = this.getRole(combatant);
    const unit = this.distanceUnitLabel();
    const amount = Math.max(0, Number(delta) || 0);
    const previous = Math.max(0, Number(combatant.system.chaseLastMove) || 0);
    const updates = [];

    if (role === 'fleeing') {
      for (const c of combat.combatants) {
        if (this.getRole(c) !== 'chasing') continue;
        const current = this.getDistance(c);
        if (current === null) continue;
        const restored = Math.max(0, current - previous);
        updates.push({
          _id: c.id,
          'system.chaseDistance': restored + amount,
        });
      }

      updates.push({
        _id: combatant.id,
        'system.chaseLastMove': amount,
        'system.chaseDistanceBefore': null,
      });

      if (outcome.botch) {
        ui.notifications.info(_loc('CHASE.botchNoMove', { name: combatant.name }));
      } else if (amount > 0 && updates.length > 1) {
        ui.notifications.info(_loc('CHASE.movedFleeing', {
          name: combatant.name,
          delta: amount,
          gs: outcome.gs ?? '—',
          fp: outcome.fp ?? 0,
          unit,
        }));
      } else if (amount > 0 && updates.length <= 1) {
        ui.notifications.warn('CHASE.noChaserDistance', { localize: true });
      }
    } else if (role === 'chasing') {
      const current = this.getDistance(combatant);
      if (current === null && combatant.system.chaseDistanceBefore == null) {
        ui.notifications.warn('CHASE.distanceUnset', { localize: true });
        return;
      }

      const before = combatant.system.chaseDistanceBefore != null
        ? Number(combatant.system.chaseDistanceBefore)
        : Math.max(0, (current ?? 0) + previous);
      const next = Math.max(0, before - amount);
      const newlyCaught = next <= 0 && current !== null && current > 0;
      updates.push({
        _id: combatant.id,
        'system.chaseDistance': next,
        'system.chaseLastMove': amount,
        'system.chaseDistanceBefore': before,
      });

      if (outcome.botch) {
        ui.notifications.info(_loc('CHASE.botchNoMove', { name: combatant.name }));
      } else {
        ui.notifications.info(_loc('CHASE.movedChasing', {
          name: combatant.name,
          delta: amount,
          gs: outcome.gs ?? '—',
          fp: outcome.fp ?? 0,
          distance: next,
          unit,
        }));
      }

      if (updates.length) await combat.applyChaseDistanceUpdates(updates);
      if (newlyCaught) await this.announceCatch(combat, combatant);
      return;
    }

    if (updates.length) await combat.applyChaseDistanceUpdates(updates);
  }

  /** @deprecated use reapplyMovementDelta — kept for batch helpers */
  static async applyMovementDelta(combat, combatant, delta, outcome = {}) {
    return this.reapplyMovementDelta(combat, combatant, delta, outcome);
  }

  /**
   * Apply fleer + chaser movement for one KR.
   * Distance for each chaser: distance + fleerDelta - chaserDelta (min 0).
   */
  static async applyRoundMovement(combat, { fleerId, fleerDelta = 0, chaserMoves = [] } = {}) {
    if (!combat) return;

    const updates = [];
    const newlyCaught = [];
    for (const { combatantId, delta } of chaserMoves) {
      const combatant = combat.combatants.get(combatantId);
      if (!combatant || this.getRole(combatant) !== 'chasing') continue;
      const current = this.getDistance(combatant) ?? 0;
      const next = Math.max(0, current + fleerDelta - (Number(delta) || 0));
      updates.push({ _id: combatantId, 'system.chaseDistance': next });
      if (next <= 0 && current > 0) newlyCaught.push(combatant);
    }

    if (fleerId && !chaserMoves.length) {
      const fleer = combat.combatants.get(fleerId);
      if (fleer && this.getRole(fleer) === 'fleeing') {
        await this.reapplyMovementDelta(combat, fleer, fleerDelta);
        return;
      }
    }

    if (updates.length) await combat.applyChaseDistanceUpdates(updates);
    for (const chaser of newlyCaught) await this.announceCatch(combat, chaser);
  }

  static #patchSetupSkill() {
    const proto = Actordsa5.prototype;
    if (proto.setupSkill.__dsaChasePatched) return;

    const original = proto.setupSkill;
    proto.setupSkill = function patchedSetupSkill(skill, options = {}, tokenId) {
      const Handler = Chase.handlerFor(game.combat);
      const swapped = Handler.maybeSubstituteChaseSkill(this, skill);
      if (swapped !== skill) {
        options = {
          ...options,
          subtitle: `${options.subtitle ?? ''} (${_loc('CHASE.skillSubstitute')})`,
        };
      }
      return original.call(this, swapped, options, tokenId);
    };
    proto.setupSkill.__dsaChasePatched = true;
  }
}
