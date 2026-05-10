import { SummoningTarget } from './summoning_target.js';
import { SummoningExecutor } from './summoning_executor.js';

export class SummoningAPI {
  /**
   * @param {object} options
   * @param {Actor}          options.summoner           – the actor performing the summon
   * @param {string}         [options.creatureName]     – creature name to look up in world actors / packs
   * @param {string}         [options.creatureUuid]     – compendium UUID for direct lookup
    * @param {object}         [options.creatureData]     – actor data to create if no named/UUID creature exists
   * @param {number}         [options.count=1]          – number of creatures (or swarm count)
   * @param {string}         [options.preset="default"] – preset key from SUMMONING_PRESETS
   * @param {object}         [options.overrides]        – per-call overrides merged onto preset
   * @param {"target"|"caster"} [options.placement="caster"] – "target" = click to place; "caster" = spawn at summoner token
   * @param {object}         [options.delay]            – if set, create a delayed effect instead of immediate summoning
   * @param {number}         [options.delay.rounds]     – number of rounds to delay
   * @param {string}         [options.delay.label]      – optional label for the delay effect
   * @param {string}         [options.delay.icon]       – optional icon for the delay effect
   * @param {boolean}        [options.linkToSummoner]   – create tracking effect; removing it despawns tokens
   * @param {object}         [options.linkEffectData]   – override name/icon/duration for the tracking effect
   * @param {object}         [options.summonedActorUpdates] – updates applied to each summoned token actor
   * @param {object[]}       [options.summonedItems]     – item data created on each summoned token actor
   * @param {object[]}       [options.summonedEffects]   – active effects created on each summoned token actor
   * @param {object[]}       [options.summonedEmbeddedUpdates] – embedded document updates on each summoned token actor
   * @param {object[]}       [options.summonerEffectUpdates] – summoner active effect updates with token placeholders
   * @param {string[]}       [options.summonerItemDeletes] – item ids to delete from the summoner after a successful summon
   * @param {boolean}        [options.restoreSummonedWounds] – fill summoned token actors to their wound maximum after effects
    * @param {string}         [options.summonedLight]    – optional LightDialog key applied to created tokens
    * @param {string}         [options.summonerLight]    – optional LightDialog key applied to summoner tokens
   */
  static async summon(options) {
    const {
      summoner,
      creatureName,
      creatureUuid,
      creatureData,
      count = 1,
      preset = "default",
      overrides,
      placement = "caster",
      delay,
      linkToSummoner,
      linkEffectData,
      summonedActorUpdates,
      summonedItems,
      summonedEffects,
      summonedEmbeddedUpdates,
      summonerEffectUpdates,
      summonerItemDeletes,
      restoreSummonedWounds,
      summonedLight,
      summonerLight,
    } = options;

    if (!summoner) {
      ui.notifications.error('CONJURATION.noSummoner', { localize: true });
      return;
    }

    if (delay?.rounds > 0) {
      return this._createDelayedSummon(options);
    }

    const position = await SummoningTarget.acquirePosition(summoner, placement);
    if (!position) {
      ui.notifications.warn('CONJURATION.noPlacementPosition', { localize: true });
      return;
    }

    const payload = {
      summonerUuid: summoner.uuid,
      creatureName,
      creatureUuid,
      creatureData,
      count,
      position,
      preset,
      overrides,
      linkToSummoner,
      linkEffectData,
      summonedActorUpdates,
      summonedItems,
      summonedEffects,
      summonedEmbeddedUpdates,
      summonerEffectUpdates,
      summonerItemDeletes,
      restoreSummonedWounds,
      summonedLight,
      summonerLight,
    };

    if (game.user.isGM) {
      return SummoningExecutor.execute(payload);
    }

    game.socket.emit('system.dsa5', {
      type: 'summonCreatureMacro',
      payload,
    });
    ui.notifications.info('CONJURATION.requestSend', { localize: true });
  }

  static async despawn(tokenIds, sceneId) {
    if (game.user.isGM) return SummoningExecutor.despawn(tokenIds, sceneId);

    game.socket.emit('system.dsa5', {
      type: 'despawnSummonedTokens',
      payload: { tokenIds, sceneId },
    });
  }

  /**
   * Create a delayed effect on the summoner. When the effect expires,
   * its onRemove macro re-calls `SummoningAPI.summon()` without the delay.
   */
  static async _createDelayedSummon(options) {
    const { summoner, creatureName, creatureUuid, creatureData, count, preset, overrides, placement, delay, linkToSummoner, linkEffectData, summonedActorUpdates, summonedItems, summonedEffects, summonedEmbeddedUpdates, summonerEffectUpdates, summonerItemDeletes, restoreSummonedWounds, summonedLight, summonerLight } = options;
    const label = delay.label || `${game.i18n.localize("PLAYER.conjuration")}: ${creatureName || creatureUuid}`;

    const summonOpts = JSON.stringify({
      creatureName,
      creatureUuid,
      creatureData,
      count,
      preset,
      overrides,
      placement,
      linkToSummoner,
      linkEffectData,
      summonedActorUpdates,
      summonedItems,
      summonedEffects,
      summonedEmbeddedUpdates,
      summonerEffectUpdates,
      summonerItemDeletes,
      restoreSummonedWounds,
      summonedLight,
      summonerLight,
    });

    const effectData = {
      name: label,
      icon: delay.icon || "icons/svg/aura.svg",
      changes: [],
      duration: { rounds: delay.rounds },
      description: label,
      system: {
        macroArgs: {
          onRemove: `
            await game.dsa5.apps.SummoningAPI.summon({ summoner: actor, ...${summonOpts} });
          `,
        },
      }
    };

    await summoner.createEmbeddedDocuments("ActiveEffect", [effectData]);
  }
}
