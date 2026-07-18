import Chase from './chase.js';

/**
 * Combat / ini tracker helpers for Verfolgungsjagd modes.
 */
export default class ChaseCombatTracker {
  static SECTION_KEYS = ['fleeing', 'chasing'];

  static prepareCombatContext(context, combat) {
    const Handler = Chase.handlerFor(combat);
    const isChase = Chase.isChaseActive(combat);
    const isVehicleChase = Chase.isVehicleChase(combat);

    context.isChase = isChase;
    context.isVehicleChase = isVehicleChase;
    context.isBasisChase = Chase.isBasisChase(combat);

    if (!isChase) {
      context.chase = null;
      Chase.clearAssignFleerHint();
      return;
    }

    Chase.showAssignFleerHint(combat);

    context.chase = Handler.getProgress(combat);
    context.chaseTerrain = combat.system.chaseTerrain ?? 'normal';
    context.chaseTerrainLabel = Handler.getTerrainLabel(context.chaseTerrain);
    context.chaseTerrainOptions = (context.chase?.terrainOptions ?? []).map((o) => ({
      ...o,
      selected: o.id === context.chaseTerrain,
    }));
    context.chaseDefaultSkill = context.chase.defaultSkillKey;
    context.chaseDefaultSkillLabel = context.chase.defaultSkillLabel;
    context.chaseDefaultSkillOptions = context.chase.defaultSkillOptions;
    context.chaseDistanceUnit = Handler.distanceUnitLabel();
  }

  static enrichTurn(turn, combatant, combat) {
    if (!Chase.isChaseActive(combat) || !combatant) return turn;

    const Handler = Chase.handlerFor(combat);
    const role = Handler.getRole(combatant);
    turn.chaseRole = role;
    turn.chaseDistance = Handler.getDistance(combatant);
    turn.chaseDistanceUnit = Handler.distanceUnitLabel();
    turn.chaseDistanceLabel = role === 'chasing'
      ? (turn.chaseDistance === null
        ? _loc('CHASE.setDistance')
        : `${turn.chaseDistance} ${turn.chaseDistanceUnit}`)
      : _loc('CHASE.role.fleeing');
    turn.chaseCaught = Handler.isCaught(combatant);
    turn.chaseRolled = Handler.hasRolled(combatant);
    turn.css = `${turn.css || ''} chase-${role}${turn.chaseRolled ? ' chase-rolled' : ''}`.trim();
    return turn;
  }

  /**
   * Reorder prepared turns: fleeing → chasing (by distance).
   * When `sections` is true, always inject section header rows (even if empty)
   * so the tracker has drag/drop targets for roles.
   */
  static reorderTurns(turns, combat, { sections = true } = {}) {
    if (!Chase.isChaseActive(combat)) return turns;

    // Combat tracker context may already contain section rows; strip them before regrouping.
    const list = (turns ?? []).filter((t) => t && !t.isChaseSection);
    const byId = new Map(list.map((t) => [t.id, t]));
    const ordered = [];
    const groups = Chase.handlerFor(combat).prepareTrackerGroups(combat);

    const pushGroup = (sectionKey, combatants) => {
      const members = [];
      for (const c of combatants) {
        const turn = byId.get(c.id);
        if (!turn) continue;
        turn.chaseSection = null;
        members.push(turn);
        byId.delete(c.id);
      }

      if (sections) {
        ordered.push({
          id: `chase-section-${sectionKey}`,
          isChaseSection: true,
          chaseSection: sectionKey,
          chaseRole: sectionKey,
          isEmpty: members.length === 0,
        });
      }

      ordered.push(...members);
    };

    pushGroup('fleeing', groups.fleeing);
    pushGroup('chasing', groups.chasing);

    for (const turn of byId.values()) ordered.push(turn);
    return ordered;
  }

  static prepareIniTurns(turns, combat) {
    return this.reorderTurns(turns, combat, { sections: false });
  }
}
