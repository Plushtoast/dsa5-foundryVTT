import { DSARegionBehaviorBase } from './base.js';
import NavalChase from '../../combat/mkr/naval-chase.js';

const { StringField } = foundry.data.fields;

/**
 * Naval chase / water terrain zone. Works alongside Foundry's modifyMovementCost
 * (terrain modifier) on the same region or independently.
 */
export class DSANavalWaterTerrainRegionBehavior extends DSARegionBehaviorBase {
  static REGION_TYPE = 'DSANavalWaterTerrain';
  static LOCALIZATION_PREFIXES = ['REGIONBEHAVIOR_DSANavalWaterTerrain'];

  static defineSchema() {
    return {
      waterTerrain: new StringField({
        initial: 'normal',
        choices: NavalChase.terrainChoices(),
        label: 'REGIONBEHAVIOR_DSANavalWaterTerrain.FIELDS.waterTerrain.label',
      }),
    };
  }

  /** @override */
  _getTerrainEffects(token, segment, options) {
    const difficulty = NavalChase.movementDifficultyForTerrain(token?.actor, this.waterTerrain);
    if (!difficulty || difficulty === 1) return [];
    return [{ name: 'difficulty', difficulty }];
  }
}
