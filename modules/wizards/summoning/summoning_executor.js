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
    * @param {object} [payload.creatureData]   – actor data to create if no named/UUID creature exists
   * @param {number} payload.count
   * @param {{x: number, y: number, sceneId: string}} payload.position
   * @param {string} [payload.preset="default"]
   * @param {object} [payload.overrides]
   * @param {boolean} [payload.linkToSummoner]  – create tracking effect; removing it despawns tokens
   * @param {object}  [payload.linkEffectData]  – override name/icon for the tracking effect
   * @param {object}  [payload.summonedActorUpdates]
   * @param {object[]} [payload.summonedItems]
   * @param {object[]} [payload.summonedEffects]
   * @param {object[]} [payload.summonedEmbeddedUpdates]
   * @param {object[]} [payload.summonerEffectUpdates]
   * @param {string[]} [payload.summonerItemDeletes]
   * @param {boolean} [payload.restoreSummonedWounds]
   * @param {string} [payload.summonedLight]
   * @param {string} [payload.summonerLight]
   */
  static async execute(payload) {
    const { summonerUuid, creatureName, creatureUuid, creatureData, count, position, preset = "default", overrides, linkToSummoner, linkEffectData, summonedActorUpdates, summonedItems, summonedEffects, summonedEmbeddedUpdates, summonerEffectUpdates, summonerItemDeletes, restoreSummonedWounds, summonedLight, summonerLight } = payload;
    const config = mergeObject(
      foundry.utils.deepClone(SUMMONING_PRESETS[preset] || SUMMONING_PRESETS.default),
      overrides || {},
    );
    const summoner = await fromUuid(summonerUuid);
    const scene = game.scenes.get(position.sceneId);
    if (!scene) return;

    const creature = await this._resolveCreature(creatureName, creatureUuid, creatureData, config);
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

    await this._customizeSummonedTokens(createdTokens, {
      summonedActorUpdates,
      summonedItems,
      summonedEffects,
      summonedEmbeddedUpdates,
      restoreSummonedWounds,
    });

    await this._applyLight(createdTokens.map((token) => token.object).filter(Boolean), summonedLight);

    if (linkToSummoner && summoner) {
      await this._createTrackingEffect(summoner, createdTokens, scene, creature, linkEffectData);
    }

    if (summoner) {
      await this._updateSummonerEffects(summoner, createdTokens, scene, summonerEffectUpdates);
      await this._deleteSummonerItems(summoner, summonerItemDeletes);
      await this._applyLight(summoner.token ? [summoner.token] : summoner.getActiveTokens(), summonerLight);
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

  static async _resolveCreature(creatureName, creatureUuid, creatureData, config) {
    if (creatureUuid) {
      try {
        const doc = await fromUuid(creatureUuid);
        if (doc?.documentName === "Actor") return this._ensureWorldActor(doc, config);
      } catch { /* fall through to name search */ }
    }

    if (!creatureName && !creatureData) return null;

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

    if (creatureData) {
      const folder = await DSA5_Utility.getFolderForType("Actor", null, game.i18n.localize(config.folderKey));
      const obj = mergeObject(foundry.utils.deepClone(creatureData), { folder: folder.id }, { inplace: false });
      return await Actor.create(obj);
    }

    return null;
  }

  static async _ensureWorldActor(actor, config) {
    if (!actor.inCompendium && !actor.pack) return actor;

    const existing = game.actors.find(x => x.getFlag('core', 'sourceId') === actor.uuid) || game.actors.find(x => x.name === actor.name);
    if (existing) return existing;

    const folder = await DSA5_Utility.getFolderForType("Actor", null, game.i18n.localize(config.folderKey));
    const obj = actor.toObject();
    obj.folder = folder.id;
    obj.flags ??= {};
    obj.flags.core ??= {};
    obj.flags.core.sourceId ??= actor.uuid;
    return Actor.create(obj);
  }

  static async _buildTokenDocument(creature, summoner, position, config, scene) {
    const tokenDocument = await creature.getTokenDocument({
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

    const tokenData = tokenDocument.toObject?.() ?? tokenDocument;
    return mergeObject(tokenData, config.tokenOverrides || {}, { inplace: false });
  }

  static async _customizeSummonedTokens(tokens, options) {
    const { summonedActorUpdates, summonedItems, summonedEffects, summonedEmbeddedUpdates, restoreSummonedWounds } = options;
    for (const token of tokens) {
      const actor = token.actor;
      if (!actor) continue;

      if (summonedActorUpdates) await actor.update(foundry.utils.deepClone(summonedActorUpdates));

      if (summonedItems?.length) {
        await actor.createEmbeddedDocuments("Item", foundry.utils.deepClone(summonedItems));
      }

      if (summonedEffects?.length) {
        await actor.createEmbeddedDocuments("ActiveEffect", foundry.utils.deepClone(summonedEffects));
      }

      if (summonedEmbeddedUpdates?.length) {
        await this._updateEmbeddedDocuments(actor, summonedEmbeddedUpdates, token, null);
      }

      if (restoreSummonedWounds) {
        await actor.update({ "system.status.wounds.value": actor.system?.status?.wounds?.max ?? actor.system?.status?.wounds?.value ?? 0 });
      }
    }
  }

  static async _updateEmbeddedDocuments(actor, updates, token, scene) {
    for (const entry of updates) {
      const collectionName = entry.collection || "Item";
      const collection = actor.getEmbeddedCollection?.(collectionName);
      if (!collection) continue;

      const documents = Array.from(collection);
      const document = documents.find((doc) => this._matchesDocument(doc, entry.match));
      if (!document) continue;

      await document.update(this._resolvePlaceholders(entry.update || {}, token, scene));
    }
  }

  static async _updateSummonerEffects(summoner, tokens, scene, updates = []) {
    if (!updates?.length) return;
    const token = tokens[0];
    if (!token) return;

    for (const entry of updates) {
      const effect = summoner.effects.find((doc) => this._matchesDocument(doc, entry.match));
      if (!effect) continue;

      await effect.update(this._resolvePlaceholders(entry.update || {}, token, scene));
    }
  }

  static async _deleteSummonerItems(summoner, itemIds = []) {
    const ids = itemIds.filter((id) => summoner.items.has(id));
    if (ids.length) await summoner.deleteEmbeddedDocuments("Item", ids);
  }

  static async _applyLight(tokens, lightKey) {
    if (!lightKey || !tokens?.length || !game.dsa5.apps.LightDialog) return;
    await game.dsa5.apps.LightDialog.applyVisionOrLight(true, lightKey, tokens);
  }

  static _matchesDocument(document, match = {}) {
    return Object.entries(match).every(([key, value]) => foundry.utils.getProperty(document, key) === value);
  }

  static _resolvePlaceholders(data, token, scene) {
    const cloned = foundry.utils.deepClone(data);
    const replace = (value) => {
      if (value === "__TOKEN_UUID__") return token.uuid;
      if (value === "__TOKEN_ID__") return token.id;
      if (value === "__SCENE_ID__") return scene?.id;
      return value;
    };

    const walk = (value) => {
      if (Array.isArray(value)) return value.map(walk);
      if (value && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) value[key] = walk(child);
        return value;
      }
      return replace(value);
    };

    return walk(cloned);
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
    let effectData = {
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
            await game.dsa5.apps.SummoningAPI.despawn(
              ${JSON.stringify(tokenIds)},
              "${sceneId}"
            );
          `,
        },
      },
    };

    effectData = mergeObject(effectData, overrideData || {}, { inplace: false });
    await summoner.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}
