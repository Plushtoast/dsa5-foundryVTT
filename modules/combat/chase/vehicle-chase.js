import Chase from './chase.js';
import NavalCombat from '../mkr/naval-combat.js';

export const VEHICLE_CHASE_TERRAIN_IDS = [
  'open',
  'passable',
  'normal',
  'difficultSeas',
  'difficultShoals',
  'severeStorm',
  'severeShoals',
];

const OTTA_STP_THRESHOLD = 100;
const LARGE_SHIP_STP = 1200;

const TERRAIN_ROW_SAIL = {
  open: { row: 2, sail: 0 },
  passable: { row: 1.5, sail: 1.25 },
  normal: { row: 0.75, sail: 1.5 },
  difficultSeas: { row: 0.5, sail: 1 },
};

/**
 * Ship / vehicle Verfolgungsjagd — extends basis Chase with water terrain GS table,
 * RE distance units, and Boote & Schiffe skill substitution.
 */
export default class VehicleChase extends Chase {
  static TERRAIN_IDS = VEHICLE_CHASE_TERRAIN_IDS;

  static MODE = 'vehicleChase';

  static WATER_TERRAIN_IDS = VEHICLE_CHASE_TERRAIN_IDS;

  static register() {
    Chase.Vehicle = this;
    Chase.register();
  }

  static terrainChoices() {
    return Object.fromEntries(
      this.TERRAIN_IDS.map((id) => [id, `CHASE.vehicle.terrain.${id}`]),
    );
  }

  static getTerrainLabel(terrainId) {
    return _loc(`CHASE.vehicle.terrain.${terrainId || 'normal'}`);
  }

  /**
   * Ship SGS from prepared vehicle Actor (speed.max via speedByMovementType).
   * Heroes fall back to basis locomotion speeds.
   */
  static getBaseSpeed(actorLike, skillKey = null) {
    const actor = this.resolveActor(actorLike);
    if (!actor) return 0;

    if (actor.type === 'vehicle') {
      return Number(actor.speedByMovementType?.('land')) || 0;
    }

    return super.getBaseSpeed(actor, skillKey);
  }

  /**
   * Water Geländetypen always — never fall back to land chase multipliers.
   * Uses ship propulsion/StP when the actor is a vehicle; otherwise sail defaults.
   */
  static getTerrainMultiplier(actorLike, terrainId = 'normal') {
    const actor = this.resolveActor(actorLike);
    const isVehicle = actor?.type === 'vehicle';
    const propulsion = isVehicle
      ? (actor.system.details.propulsion || 'sail')
      : 'sail';
    const stp = isVehicle
      ? (actor.system.status.structurePoints.initial
        || actor.system.status.structurePoints.max
        || 0)
      : 0;
    const isOtta = propulsion === 'row' && stp <= OTTA_STP_THRESHOLD;

    switch (terrainId) {
      case 'open':
      case 'passable':
      case 'normal':
      case 'difficultSeas':
        return this.#propulsionMultiplier(propulsion, TERRAIN_ROW_SAIL[terrainId]);
      case 'difficultShoals':
        return stp >= LARGE_SHIP_STP ? 0.5 : 1;
      case 'severeStorm':
        if (propulsion === 'row') return isOtta ? 0.25 : 0;
        return 0.5;
      case 'severeShoals':
        return stp >= LARGE_SHIP_STP ? 0.25 : 0.5;
      default:
        return 1;
    }
  }

  static distanceUnitKey() {
    return 'CHASE.distanceUnit.re';
  }

  /** Effective GS summary for the vehicle sheet (SGS × water terrain). */
  static getChaseSummary(actorLike, combat = game.combat) {
    const actor = this.resolveActor(actorLike);
    const terrainId = combat?.system?.chaseTerrain ?? 'normal';
    const multiplier = this.getTerrainMultiplier(actor, terrainId);
    const base = this.getBaseSpeed(actor, 'boatsAndShips');
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
      distanceUnitLabel: this.distanceUnitLabel(),
    };
  }

  static getProgress(combat = game.combat) {
    const progress = super.getProgress(combat);
    if (!progress) return null;

    return {
      ...progress,
      terrainOptions: this.TERRAIN_IDS.map((id) => ({
        id,
        label: `CHASE.vehicle.terrain.${id}`,
      })),
      terrainLabel: this.getTerrainLabel(combat.system.chaseTerrain ?? 'normal'),
    };
  }

  /** Boote & Schiffe at TaW 0 when missing (heroes); vehicles use embedded skill only. */
  static skillFor(actor, key) {
    if (!actor || !key) return null;
    if (key === 'boatsAndShips') {
      if (actor.type === 'vehicle') {
        const name = _loc('LocalizedIDs.boatsAndShips');
        return actor.items.find((i) => i.type === 'skill' && i.name === name) ?? null;
      }
      return NavalCombat.boatsSkillFor(actor);
    }
    return super.skillFor(actor, key);
  }

  static locomotionSkillKeys(actor = null, combat = game.combat) {
    if (actor?.type === 'vehicle') return ['boatsAndShips', 'driving'];
    return super.locomotionSkillKeys(actor, combat);
  }

  static #propulsionMultiplier(propulsion, factors) {
    if (!factors) return 1;
    if (propulsion === 'row') return factors.row;
    if (propulsion === 'sail') return factors.sail;
    if (propulsion === 'mixed') return Math.max(factors.row, factors.sail);
    return factors.sail;
  }
}
