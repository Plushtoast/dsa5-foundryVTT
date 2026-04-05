import { SUMMONING_PRESETS } from './summoning_presets.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import TokenScatter from '../../animation/token-scatter.js';

const { mergeObject } = foundry.utils;

export class SummoningExecutor {
  /**
   * GM-side execution: resolve creature, create tokens, scatter.
   * @param {object} payload
   * @param {string} payload.summonerUuid
   * @param {string} [payload.creatureName]   – lookup by name in world actors / packs
   * @param {string} [payload.creatureUuid]   – lookup by compendium UUID directly
   * @param {number} payload.count
   * @param {{x: number, y: number, sceneId: string}} payload.position
   * @param {string} [payload.preset="default"]
   * @param {object} [payload.overrides]
   * @param {boolean} [payload.linkToSummoner]  – create tracking effect; removing it despawns tokens
   * @param {object}  [payload.linkEffectData]  – override name/icon for the tracking effect
   */
  static async execute(payload) {
    const { summonerUuid, creatureName, creatureUuid, count, position, preset = "default", overrides, linkToSummoner, linkEffectData } = payload;
    const config = mergeObject(
      foundry.utils.deepClone(SUMMONING_PRESETS[preset] || SUMMONING_PRESETS.default),
      overrides || {},
    );
    const summoner = await fromUuid(summonerUuid);
    const scene = game.scenes.get(position.sceneId);
    if (!scene) return;

    const creature = await this._resolveCreature(creatureName, creatureUuid, config);
    if (!creature) {
      ui.notifications.error(game.i18n.format('CONJURATION.creatureNotFound', { creature: creatureName || creatureUuid }));
      return;
    }

    const swarmGG = Number(foundry.utils.getProperty(creature, "system.swarm.gg")) || 0;
    const tokenCount = swarmGG > 1 ? 1 : count;

    const tokens = [];
    for (let i = 0; i < tokenCount; i++) {
      const tokenData = await this._buildTokenDocument(creature, summoner, position, config, scene);
      tokens.push(tokenData);
    }

    const createdTokens = await scene.createEmbeddedDocuments("Token", tokens);

    if (config.scatter && createdTokens.length > 0) {
      await this._scatterTokens(createdTokens, position, scene, config.scatterRange);
    }

    if (swarmGG > 1) {
      for (const token of createdTokens) {
        await token.actor.update({ "system.swarm.count": count });
      }
    }

    if (linkToSummoner && summoner) {
      await this._createTrackingEffect(summoner, createdTokens, scene, creature, linkEffectData);
    }

    return createdTokens;
  }

  /**
   * Delete summoned tokens from a scene.
   * @param {string[]} tokenIds
   * @param {string} sceneId
   */
  static async despawn(tokenIds, sceneId) {
    const scene = game.scenes.get(sceneId);
    if (!scene) return;

    const existing = tokenIds.filter(id => scene.tokens.has(id));
    if (existing.length) {
      await scene.deleteEmbeddedDocuments("Token", existing);
    }
  }

  static async _resolveCreature(creatureName, creatureUuid, config) {
    if (creatureUuid) {
      try {
        const doc = await fromUuid(creatureUuid);
        if (doc) return doc;
      } catch { /* fall through to name search */ }
    }

    if (!creatureName) return null;

    let creature = game.actors.find(x => x.name === creatureName);
    if (creature) return creature;

    for (const pack of game.packs) {
      if (pack.metadata.type !== "Actor") continue;

      const index = await pack.getIndex();
      const entry = index.find(e => e.name === creatureName);
      if (entry) {
        const folder = await DSA5_Utility.getFolderForType("Actor", null, game.i18n.localize(config.folderKey));
        const obj = (await pack.getDocument(entry._id)).toObject();
        obj.folder = folder.id;
        creature = await Actor.create(obj);
        return creature;
      }
    }

    return null;
  }

  static async _buildTokenDocument(creature, summoner, position, config, scene) {
    const tokenData = await creature.getTokenDocument({
      name: creature.name,
      x: position.x,
      y: position.y,
      actorLink: config.actorLink,
      texture: {
        src: creature.prototypeToken.texture.src,
      },
      delta: {
        ownership: summoner?.ownership ?? {},
      },
    }, { parent: scene });

    return tokenData;
  }

  static async _scatterTokens(tokens, position, scene, range) {
    const gridSize = scene.grid.size;
    const positions = TokenScatter.scatterPositions(position.x, position.y, tokens.length, gridSize * range);
    const updates = [];

    for (let i = 0; i < tokens.length; i++) {
      const snapped = scene.grid.getSnappedPoint(positions[i], { mode: CONST.GRID_SNAPPING_MODES.TOP_LEFT_VERTEX });
      updates.push({
        _id: tokens[i].id,
        x: snapped.x,
        y: snapped.y,
      });
    }

    if (updates.length) {
      await scene.updateEmbeddedDocuments("Token", updates);
    }
  }

  static async _createTrackingEffect(summoner, tokens, scene, creature, overrideData = {}) {
    const tokenIds = tokens.map(t => t.id);
    const sceneId = scene.id;
    const effectData = {
      name: overrideData.name || `${game.i18n.localize("PLAYER.conjuration")}: ${creature.name}`,
      icon: overrideData.icon || creature.img || "icons/svg/pawprint.svg",
      description: overrideData.name || `${game.i18n.localize("PLAYER.conjuration")}: ${creature.name}`,
      flags: {
        dsa5: {
          summonedTokenIds: tokenIds,
          summonedSceneId: sceneId,
        },
      },
      system: {
        macroArgs: {
          onRemove: `
            const { SummoningExecutor } = await import("../wizards/summoning/summoning_executor.js");
            await SummoningExecutor.despawn(
              ${JSON.stringify(tokenIds)},
              "${sceneId}"
            );
          `,
        },
      },
    };
    if (overrideData.duration) {
      effectData.duration = overrideData.duration;
    }
    await summoner.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}
