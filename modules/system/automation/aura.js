import DSAActiveEffectDataModel from '../../data/activeeffect/dsaeffect.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

export class DSAAura {

  /**
   * Ensure emanation regions exist for all aura effects on a token.
   * Creates missing emanation regions and removes orphaned ones.
   * @param {Token} token - The token placeable
   */
  static async ensureEmanations(token) {
    if (!token.actor) return;
    if (!DSA5_Utility.isActiveGM()) return;

    const expectedAuras = token.actor.auras || [];
    const existingRegions = canvas.scene.regions.filter(
      r => r.flags?.dsa5?.auraEffectUuid &&
           r.attachment?.token === token.document?.id &&
           r.shapes?.some(s => s.type === 'emanation')
    );

    const existingByUuid = new Map();
    for (const region of existingRegions) {
      existingByUuid.set(region.flags.dsa5.auraEffectUuid, region);
    }

    // Create missing emanations
    for (const auraUuid of expectedAuras) {
      if (existingByUuid.has(auraUuid)) {
        existingByUuid.delete(auraUuid);
        continue;
      }

      const effect = await fromUuid(auraUuid);
      if (!effect) continue;

      const radius = Number(effect.system?.aura?.auraRadius);
      if (!radius) continue;

      await foundry.documents.RegionDocument.createTokenEmanation(
        token.document,
        radius,
        {
          name: `${effect.name} (Aura)`,
          color: effect.system.aura.borderColor || game.user.color,
          visibility: effect.system.aura.hidden ? CONST.REGION_VISIBILITY.NONE : CONST.REGION_VISIBILITY.ALWAYS,
          restriction: { enabled: !effect.system.aura.ignoreWalls },
          behaviors: [{
            type: 'DSAAura',
            system: {
              effectUuid: auraUuid,
              disposition: effect.system.aura.disposition ?? DSAActiveEffectDataModel.DISPOSITION_ALL,
              ignoreWalls: !!effect.system.aura.ignoreWalls,
            },
          }],
          flags: { dsa5: { auraEffectUuid: auraUuid } },
        },
        { gridBased: false, excludeToken: !!effect.system.aura.excludeSelf }
      );
    }

    // Remove orphaned emanation regions
    const toDelete = Array.from(existingByUuid.values()).map(r => r.id);
    if (toDelete.length) {
      await canvas.scene.deleteEmbeddedDocuments('Region', toDelete);
    }
  }

  /**
   * Remove all emanation regions for a token.
   * @param {TokenDocument} tokenDoc
   */
  static async removeEmanations(tokenDoc) {
    if (!DSA5_Utility.isActiveGM()) return;

    const toDelete = canvas.scene.regions
      .filter(r => r.flags?.dsa5?.auraEffectUuid &&
                   r.attachment?.token === tokenDoc.id &&
                   r.shapes?.some(s => s.type === 'emanation'))
      .map(r => r.id);

    if (toDelete.length) {
      await canvas.scene.deleteEmbeddedDocuments('Region', toDelete);
    }
  }

  static refreshAnimations(token) {
    // TODO: Autoanimations integration deferred. Revisit when module publishes v14 region support.
  }
}
