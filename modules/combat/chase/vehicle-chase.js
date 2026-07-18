import Chase from './chase.js';

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

  static getTerrainMultiplier(vehicle, terrainId = 'normal') {
    if (vehicle?.type !== 'vehicle') {
      return super.getTerrainMultiplier(vehicle, terrainId);
    }

    const propulsion = vehicle.system.details.propulsion || 'sail';
    const stp = vehicle.system.status.structurePoints.initial
      || vehicle.system.status.structurePoints.max
      || 0;
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

  static #propulsionMultiplier(propulsion, factors) {
    if (!factors) return 1;
    if (propulsion === 'row') return factors.row;
    if (propulsion === 'sail') return factors.sail;
    if (propulsion === 'mixed') return Math.max(factors.row, factors.sail);
    return factors.sail;
  }
}
