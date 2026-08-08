import ReloadTimeField from '../../data/item/fields/reload_time_field.js';

export const MKR_PHASES = ['heroActions', 'movement', 'attacks', 'damageReport'];
export const RE_PER_STEP = 16;
export const DEFAULT_KR_PER_MKR = 60;

export default class NavalCombat {
  static DEFAULT_KR_PER_MKR = DEFAULT_KR_PER_MKR;

  static isNavalMkrActive(combat = game.combat) {
    return combat?.system?.combatMode === 'navalMkr';
  }

  /** Shots per MKR from reload time (KR), rounded to 1 decimal (e.g. LZ 120 → 0.5). */
  static shotsPerMkr(reloadTimeValue, krPerMkr = DEFAULT_KR_PER_MKR) {
    const reloadKr = ReloadTimeField.evaluateSegment(reloadTimeValue);
    if (reloadKr <= 0) return Infinity;
    return Math.round((krPerMkr / reloadKr) * 10) / 10;
  }

  static resolveCombatMode(combat = game.combat) {
    if (!combat) return 'standard';
    if (combat.system?.combatMode) return combat.system.combatMode;
    return combat.isBrawling ? 'brawling' : 'standard';
  }

  static normalizePhase(phase) {
    return MKR_PHASES.includes(phase) ? phase : MKR_PHASES[0];
  }

  static getMkrProgress(combat = game.combat) {
    if (!this.isNavalMkrActive(combat)) {
      return null;
    }

    const krPerMkr = combat.system.krPerMkr || DEFAULT_KR_PER_MKR;
    const mkrKrStart = combat.system.mkrKrStart ?? 0;
    const krElapsed = Math.max(0, (combat.round || 0) - mkrKrStart);
    const phase = this.normalizePhase(combat.system.mkrPhase || MKR_PHASES[0]);
    const phaseIndex = Math.max(0, MKR_PHASES.indexOf(phase));

    return {
      mkrRound: combat.system.mkrRound || 1,
      krPerMkr,
      krElapsed,
      progress: Math.clamp(krElapsed / krPerMkr, 0, 1),
      progressPercent: Math.round(Math.clamp(krElapsed / krPerMkr, 0, 1) * 100),
      phase,
      phaseIndex,
      phaseRoman: ['I', 'II', 'III', 'IV'][phaseIndex] ?? 'I',
      phaseLabel: _loc(`VEHICLE.mkr.phase.${phase}`),
      phaseTooltip: _loc(`VEHICLE.mkr.phase.${phase}Tooltip`),
      canAdvancePhase: phaseIndex < MKR_PHASES.length - 1,
      canRetreatPhase: phaseIndex > 0,
    };
  }

  static stepsToRE(distance) {
    return Math.floor(distance / RE_PER_STEP);
  }

  static formatREAnnotation(distance) {
    const re = this.stepsToRE(distance);
    return _loc('VEHICLE.mkr.reDistanceLabel', { steps: Math.round(distance), re });
  }

  /** Next phase, or null if already at the last phase. */
  static nextPhase(current) {
    const phase = this.normalizePhase(current);
    const idx = MKR_PHASES.indexOf(phase);
    if (idx >= MKR_PHASES.length - 1) return null;
    return MKR_PHASES[idx + 1];
  }

  /** Previous phase, or null if already at the first phase. */
  static previousPhase(current) {
    const phase = this.normalizePhase(current);
    const idx = MKR_PHASES.indexOf(phase);
    if (idx <= 0) return null;
    return MKR_PHASES[idx - 1];
  }

  static skillNames() {
    return {
      wood: _loc('LocalizedIDs.woodworking'),
      cloth: _loc('LocalizedIDs.clothworking'),
      boats: _loc('LocalizedIDs.boatsAndShips'),
      driving: _loc('LocalizedIDs.driving'),
      warfare: _loc('LocalizedIDs.warfare'),
      wounds: _loc('LocalizedIDs.treatWounds'),
    };
  }

  /** Every actor is assumed to have Boote & Schiffe at least at TaW 0. */
  static boatsSkillFor(actor) {
    return this.#ephemeralSkillFor(actor, this.skillNames().boats);
  }

  /** Fahrzeuge at TaW 0 when missing from the sheet. */
  static drivingSkillFor(actor) {
    return this.#ephemeralSkillFor(actor, this.skillNames().driving);
  }

  static #ephemeralSkillFor(actor, name) {
    if (!actor || !name) return null;

    const existing = actor.items.find((i) => i.type === 'skill' && i.name === name);
    if (existing) return existing;

    // Ephemeral item only — not embedded. setupSkill() needs an Item; TaW 0 when missing from sheet.
    const ItemClass = getDocumentClass('Item');
    return new ItemClass({
      name,
      type: 'skill',
      system: {
        talentValue: { value: 0 },
        characteristic1: { value: 'in' },
        characteristic2: { value: 'ge' },
        characteristic3: { value: 'kk' },
        StF: { value: 'B' },
        characteristicCount: { value: 3 },
        replaceDate: { value: '-' },
        distributePoints: { value: 0 },
      },
    }, { parent: actor, noHook: true });
  }

  static resolveSkill(actor, skillName) {
    if (!actor) return null;
    const names = this.skillNames();
    if (skillName === names.boats) return this.boatsSkillFor(actor);
    if (skillName === names.driving) return this.drivingSkillFor(actor);
    return actor.items.find((i) => i.type === 'skill' && i.name === skillName) ?? null;
  }

  static canUseHeroActions(combat = game.combat) {
    if (!this.isNavalMkrActive(combat)) return false;
    if (game.user.isGM) return true;
    return combat.system.mkrPhase === 'heroActions';
  }

  /**
   * Whether a combatant is the focus of the current MKR phase.
   * heroActions → non-vehicles; movement → vehicles; attacks/damageReport → all.
   */
  static isCombatantRelevantToPhase(combatant, phase) {
    const isVehicle = combatant?.actor?.type === 'vehicle';
    switch (this.normalizePhase(phase)) {
      case 'heroActions':
        return !isVehicle;
      case 'movement':
        return isVehicle;
      case 'attacks':
      case 'damageReport':
      default:
        return true;
    }
  }

  /** Combatants that act in the given phase (respects skipDefeated). */
  static phaseRelevantCombatants(combat, phase = combat?.system?.mkrPhase) {
    if (!combat) return [];
    const skipDefeated = combat.settings?.skipDefeated;
    const normalized = this.normalizePhase(phase);
    return combat.turns.filter((c) => {
      if (skipDefeated && c.isDefeated) return false;
      return this.isCombatantRelevantToPhase(c, normalized);
    });
  }

  /** Index in combat.turns of the first phase-relevant combatant, or null. */
  static firstRelevantTurnIndex(combat, phase = combat?.system?.mkrPhase) {
    const relevant = this.phaseRelevantCombatants(combat, phase);
    if (!relevant.length) return null;
    const idx = combat.turns.findIndex((c) => c.id === relevant[0].id);
    return idx >= 0 ? idx : null;
  }

  /** True when the current combatant is last in the phase loop (or no active turn). */
  static isLastRelevantTurn(combat) {
    if (!combat || !this.isNavalMkrActive(combat)) return false;
    const phase = this.normalizePhase(combat.system.mkrPhase);
    if (phase === 'damageReport') return true;
    const relevant = this.phaseRelevantCombatants(combat, phase);
    if (!relevant.length) return true;
    const currentId = combat.combatant?.id;
    if (!currentId) return true;
    const idx = relevant.findIndex((c) => c.id === currentId);
    return idx < 0 || idx >= relevant.length - 1;
  }
}
