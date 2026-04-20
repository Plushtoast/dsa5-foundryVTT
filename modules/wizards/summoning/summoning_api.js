import { SummoningTarget } from './summoning_target.js';
import { SummoningExecutor } from './summoning_executor.js';

export class SummoningAPI {
  /**
   * @param {object} options
   * @param {Actor}          options.summoner           – the actor performing the summon
   * @param {string}         [options.creatureName]     – creature name to look up in world actors / packs
   * @param {string}         [options.creatureUuid]     – compendium UUID for direct lookup
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
   */
  static async summon(options) {
    const {
      summoner,
      creatureName,
      creatureUuid,
      count = 1,
      preset = "default",
      overrides,
      placement = "caster",
      delay,
      linkToSummoner,
      linkEffectData,
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
      count,
      position,
      preset,
      overrides,
      linkToSummoner,
      linkEffectData,
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

  /**
   * Create a delayed effect on the summoner. When the effect expires,
   * its onRemove macro re-calls `SummoningAPI.summon()` without the delay.
   */
  static async _createDelayedSummon(options) {
    const { summoner, creatureName, creatureUuid, count, preset, overrides, placement, delay, linkToSummoner, linkEffectData } = options;
    const label = delay.label || `${game.i18n.localize("PLAYER.conjuration")}: ${creatureName || creatureUuid}`;

    const summonOpts = JSON.stringify({
      creatureName,
      creatureUuid,
      count,
      preset,
      overrides,
      placement,
      linkToSummoner,
      linkEffectData,
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
