import Actordsa5 from '../../actor/actor-dsa5.js';
import NavalCombat from './naval-combat.js';

export const WATER_TERRAIN_IDS = [
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
const NAVAL_WATER_TERRAIN_BEHAVIOR = 'DSANavalWaterTerrain';
const TERRAIN_MODIFIER_BEHAVIOR = 'modifyMovementCost';

const TERRAIN_ROW_SAIL = {
  open: { row: 2, sail: 0 },
  passable: { row: 1.5, sail: 1.25 },
  normal: { row: 0.75, sail: 1.5 },
  difficultSeas: { row: 0.5, sail: 1 },
};

export default class NavalChase {
  static register() {
    this.#patchSetupSkill();
  }

  static terrainChoices() {
    return Object.fromEntries(
      WATER_TERRAIN_IDS.map((id) => [id, `VEHICLE.mkr.chase.terrain.${id}`]),
    );
  }

  static getTerrainLabel(terrainId) {
    return _loc(`VEHICLE.mkr.chase.terrain.${terrainId || 'normal'}`);
  }

  static movementDifficultyForTerrain(actor, terrainId) {
    const multiplier = actor?.type === 'vehicle'
      ? this.getTerrainMultiplier(actor, terrainId)
      : this.#averageTerrainMultiplier(terrainId);
    if (multiplier <= 0) return Infinity;
    if (multiplier === 1) return 1;
    return 1 / multiplier;
  }

  static getTerrainMultiplier(vehicle, terrainId = 'normal') {
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

  static resolveTerrainContext(vehicle, tokenDoc = null) {
    const token = this.#resolveTokenDocument(vehicle, tokenDoc);
    const navalTerrainIds = this.#collectNavalWaterTerrainIds(token);

    if (navalTerrainIds.length) {
      let terrainId = navalTerrainIds[0];
      let multiplier = this.getTerrainMultiplier(vehicle, terrainId);

      for (const id of navalTerrainIds.slice(1)) {
        const mult = this.getTerrainMultiplier(vehicle, id);
        if (mult < multiplier) {
          multiplier = mult;
          terrainId = id;
        }
      }

      return {
        terrainId,
        multiplier,
        source: 'navalRegion',
        terrainLabel: this.getTerrainLabel(terrainId),
        regionNames: this.#regionNamesForBehaviors(token, NAVAL_WATER_TERRAIN_BEHAVIOR),
      };
    }

    const difficulty = this.#combinedMovementDifficulty(token);
    if (difficulty !== 1) {
      const multiplier = difficulty > 0 ? 1 / difficulty : 0;
      return {
        terrainId: null,
        multiplier,
        source: 'terrainModifier',
        difficulty,
        terrainLabel: _loc('VEHICLE.mkr.chase.terrainModifierLabel', { difficulty }),
        regionNames: this.#regionNamesForBehaviors(token, TERRAIN_MODIFIER_BEHAVIOR),
      };
    }

    const terrainId = game.combat?.system?.waterTerrain ?? 'normal';
    return {
      terrainId,
      multiplier: this.getTerrainMultiplier(vehicle, terrainId),
      source: 'combatDefault',
      terrainLabel: this.getTerrainLabel(terrainId),
      regionNames: [],
    };
  }

  static getEffectiveSpeed(vehicle, tokenDoc = null) {
    const { multiplier } = this.resolveTerrainContext(vehicle, tokenDoc);
    const base = Number(vehicle.system.status.speed.initial) || 0;
    return Math.round(base * multiplier * 10) / 10;
  }

  static getChaseSummary(vehicle, tokenDoc = null) {
    const context = this.resolveTerrainContext(vehicle, tokenDoc);
    const base = Number(vehicle.system.status.speed.initial) || 0;
    const effective = Math.round(base * context.multiplier * 10) / 10;

    const sourceLabel = {
      navalRegion: _loc('VEHICLE.mkr.chase.sourceNavalRegion'),
      terrainModifier: _loc('VEHICLE.mkr.chase.sourceTerrainModifier'),
      combatDefault: _loc('VEHICLE.mkr.chase.sourceCombatDefault'),
    }[context.source] ?? '';

    const regionHint = context.regionNames?.length
      ? context.regionNames.join(', ')
      : null;

    return {
      ...context,
      baseSpeed: base,
      effectiveSpeed: effective,
      multiplierLabel: context.multiplier === 0
        ? _loc('VEHICLE.mkr.chase.multiplierBlocked')
        : `× ${context.multiplier}`,
      sourceLabel,
      regionHint,
    };
  }

  static listSceneNavalRegions(scene = canvas.scene) {
    if (!scene?.regions) return [];

    return scene.regions.contents
      .filter((region) => region.behaviors.some((behavior) => (
        behavior.type === NAVAL_WATER_TERRAIN_BEHAVIOR
        || behavior.type === TERRAIN_MODIFIER_BEHAVIOR
      )))
      .map((region) => {
        const naval = region.behaviors.find((b) => b.type === NAVAL_WATER_TERRAIN_BEHAVIOR);
        const modifier = region.behaviors.find((b) => b.type === TERRAIN_MODIFIER_BEHAVIOR);
        const walkDifficulty = modifier?.system?.difficulties?.walk ?? null;

        return {
          id: region.id,
          name: region.name,
          navalTerrain: naval?.system?.waterTerrain ?? null,
          navalTerrainLabel: naval?.system?.waterTerrain
            ? this.getTerrainLabel(naval.system.waterTerrain)
            : null,
          walkDifficulty,
        };
      });
  }

  static maybeSubstituteChaseSkill(actor, skill) {
    if (!NavalCombat.isNavalMkrActive()) return skill;
    if (skill?.type !== 'skill') return skill;

    const bodyControl = _loc('LocalizedIDs.bodyControl');
    if (skill.name !== bodyControl) return skill;

    const boats = NavalCombat.boatsSkillFor(actor);
    return boats ?? skill;
  }

  static #averageTerrainMultiplier(terrainId) {
    const factors = TERRAIN_ROW_SAIL[terrainId];
    if (!factors) return 1;
    return (factors.row + factors.sail) / 2;
  }

  static #propulsionMultiplier(propulsion, factors) {
    if (propulsion === 'row') return factors.row;
    if (propulsion === 'sail') return factors.sail;
    if (propulsion === 'mixed') return Math.max(factors.row, factors.sail);
    return factors.sail;
  }

  static #resolveTokenDocument(vehicle, tokenDoc) {
    if (tokenDoc) return tokenDoc.document ?? tokenDoc;
    return canvas.tokens?.placeables?.find((t) => t.actor?.id === vehicle.id)?.document ?? null;
  }

  static #iterateTokenRegions(tokenDoc) {
    if (!tokenDoc?.regions) return [];
    return Array.from(tokenDoc.regions);
  }

  static #collectNavalWaterTerrainIds(tokenDoc) {
    const ids = [];
    for (const region of this.#iterateTokenRegions(tokenDoc)) {
      for (const behavior of region.behaviors) {
        if (behavior.type !== NAVAL_WATER_TERRAIN_BEHAVIOR) continue;
        const id = behavior.system?.waterTerrain;
        if (id && WATER_TERRAIN_IDS.includes(id)) ids.push(id);
      }
    }
    return ids;
  }

  static #combinedMovementDifficulty(tokenDoc, action = 'walk') {
    let difficulty = 1;
    for (const region of this.#iterateTokenRegions(tokenDoc)) {
      for (const behavior of region.behaviors) {
        if (behavior.type !== TERRAIN_MODIFIER_BEHAVIOR) continue;
        const value = Number(behavior.system?.difficulties?.[action] ?? 1);
        if (value > 0) difficulty *= value;
      }
    }
    return difficulty;
  }

  static #regionNamesForBehaviors(tokenDoc, behaviorType) {
    return this.#iterateTokenRegions(tokenDoc)
      .filter((region) => region.behaviors.some((behavior) => behavior.type === behaviorType))
      .map((region) => region.name);
  }

  static #patchSetupSkill() {
    const proto = Actordsa5.prototype;
    const original = proto.setupSkill;

    proto.setupSkill = function patchedSetupSkill(skill, options = {}, tokenId) {
      const swapped = NavalChase.maybeSubstituteChaseSkill(this, skill);
      if (swapped !== skill) {
        options = {
          ...options,
          subtitle: `${options.subtitle ?? ''} (${_loc('VEHICLE.mkr.chase.skillSubstitute')})`,
        };
      }
      return original.call(this, swapped, options, tokenId);
    };
  }
}
