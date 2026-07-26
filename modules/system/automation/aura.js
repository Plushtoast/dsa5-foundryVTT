import DSAActiveEffectDataModel from '../../data/activeeffect/dsaeffect.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

export class DSAAura {

  /**
   * Ensure emanation regions exist for all aura effects on a token.
   * Creates missing emanation regions, refreshes existing ones, and removes orphaned ones.
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

    for (const auraUuid of expectedAuras) {
      const effect = await fromUuid(auraUuid);
      if (!effect) continue;

      const radius = Number(effect.system?.aura?.auraRadius);
      if (!radius) continue;

      const existingRegion = existingByUuid.get(auraUuid);
      if (existingRegion) {
        existingByUuid.delete(auraUuid);
        await DSAAura.updateEmanation(existingRegion, effect);
        continue;
      }

      await foundry.documents.RegionDocument.createTokenEmanation(
        token.document,
        radius,
        DSAAura.regionData(effect, auraUuid),
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

  static regionData(effect, auraUuid) {
    const configuredBehaviors = effect.system.aura.regionBehaviors;
    const behaviors = [
      ...Object.values(configuredBehaviors ?? {}).filter(foundry.utils.isPlainObject),
      {
        type: 'DSAAura',
        system: {
          effectUuid: auraUuid,
          disposition: effect.system.aura.disposition ?? DSAActiveEffectDataModel.DISPOSITION_ALL,
          ignoreWalls: !!effect.system.aura.ignoreWalls,
        },
      },
    ];

    return {
      name: `${effect.name} (Aura)`,
      color: effect.system.aura.borderColor || game.user.color,
      visibility: effect.system.aura.hidden ? CONST.REGION_VISIBILITY.NONE : CONST.REGION_VISIBILITY.ALWAYS,
      restriction: { enabled: !effect.system.aura.ignoreWalls },
      behaviors,
      flags: { dsa5: { auraEffectUuid: auraUuid } },
    };
  }

  static async updateEmanation(region, effect) {
    const regionData = DSAAura.regionData(effect, effect.uuid);
    const updateData = {};

    if (region.name !== regionData.name) updateData.name = regionData.name;
    if (region.color !== regionData.color) updateData.color = regionData.color;
    if (region.visibility !== regionData.visibility) updateData.visibility = regionData.visibility;
    if (!!region.restriction?.enabled !== regionData.restriction.enabled) updateData.restriction = regionData.restriction;

    if (Object.keys(updateData).length) await region.update(updateData);
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
