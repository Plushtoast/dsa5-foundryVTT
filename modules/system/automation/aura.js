import DSAActiveEffectDataModel from '../../data/activeeffect/dsaeffect.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

export class DSAAura {

  /**
   * Ensure emanation regions exist for all aura effects on a token.
   * Creates missing emanation regions and removes orphaned ones.
   * @param {Token} token - The token placeable
   */
  static async ensureEmanations(token, options = {}) {
    if (!token.actor) return;
    if (!DSA5_Utility.isActiveGM()) return;

    const deletedAuraEffects = DSAAura.deletedAuraEffectMap(options.deletedEffects);

    const expectedAuras = token.actor.auras || [];
    const existingRegions = canvas.scene.regions.filter(
      r => r.flags?.dsa5?.auraEffectUuid &&
           r.attachment?.token === token.document &&
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
    for (const region of existingByUuid.values()) {
      const effect = deletedAuraEffects.get(region.flags.dsa5.auraEffectUuid);
      if (effect) await DSAAura.cleanupRegionTargets(region, effect);
    }

    const toDelete = Array.from(existingByUuid.values()).map(r => r.id);
    if (toDelete.length) {
      await canvas.scene.deleteEmbeddedDocuments('Region', toDelete);
    }
  }

  static deletedAuraEffectMap(effects = []) {
    return new Map(
      effects
        .filter(effect => effect?.system?.aura?.isAura && effect.uuid)
        .map(effect => [effect.uuid, effect])
    );
  }

  static async cleanupRegionTargets(region, effect) {
    const user = game.user;
    for (const behavior of region.behaviors) {
      if (behavior.disabled || behavior.type !== 'DSAAura') continue;
      if (behavior.system?.effectUuid !== effect.uuid) continue;

      for (const token of region.tokens) {
        const deleted = !region.parent.tokens.has(token.id);
        if (deleted) continue;

        await behavior._handleRegionEvent({
          name: CONST.REGION_EVENTS.TOKEN_EXIT,
          data: { token, movement: null, effect },
          region,
          user,
        });
      }
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
                   r.attachment?.token === tokenDoc &&
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
