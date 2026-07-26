export const MKR_PHASES = ['heroActions', 'movement', 'attacks', 'damageReport'];
export const RE_PER_STEP = 16;
export const DEFAULT_KR_PER_MKR = 60;

export default class NavalCombat {
  static DEFAULT_KR_PER_MKR = DEFAULT_KR_PER_MKR;

  static isNavalMkrActive(combat = game.combat) {
    return combat?.system?.combatMode === 'navalMkr';
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
    };
  }

  static stepsToRE(distance) {
    return Math.floor(distance / RE_PER_STEP);
  }

  static formatREAnnotation(distance) {
    const re = this.stepsToRE(distance);
    return _loc('VEHICLE.mkr.reDistanceLabel', { steps: Math.round(distance), re });
  }

  static nextPhase(current) {
    const phase = this.normalizePhase(current);
    const idx = MKR_PHASES.indexOf(phase);
    return MKR_PHASES[(idx + 1) % MKR_PHASES.length];
  }

  static skillNames() {
    return {
      wood: _loc('LocalizedIDs.woodworking'),
      cloth: _loc('LocalizedIDs.clothworking'),
      boats: _loc('LocalizedIDs.boatsAndShips'),
      warfare: _loc('LocalizedIDs.warfare'),
      wounds: _loc('LocalizedIDs.treatWounds'),
    };
  }

  /** Every actor is assumed to have Boote & Schiffe at least at TaW 0. */
  static boatsSkillFor(actor) {
    if (!actor) return null;

    const name = this.skillNames().boats;
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
    if (skillName === this.skillNames().boats) return this.boatsSkillFor(actor);
    return actor.items.find((i) => i.type === 'skill' && i.name === skillName) ?? null;
  }

  static canUseHeroActions(combat = game.combat) {
    if (!this.isNavalMkrActive(combat)) return false;
    if (game.user.isGM) return true;
    return combat.system.mkrPhase === 'heroActions';
  }
}
