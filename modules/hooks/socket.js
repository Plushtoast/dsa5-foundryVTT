import PlayerMenu from '../wizards/player_menu.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import RequestRoll from '../system/rolls/request-roll.js';
import DSAActiveEffectConfig from '../status/active_effect_config.js';
import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import MerchantSheetDSA5 from '../actor/merchant-sheet.js';
import { dropToGround } from './itemDrop.js';
import DSA5 from '../config/config-dsa5.js';
import { Trade } from '../actor/trade.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5Combat from '../combat/combat.js';
import APTracker from '../system/orwell/ap-tracker.js';
import MoneyTracker from '../system/orwell/money-tracker.js';
import { FateRolls } from '../actor/concerns/faterolls.js';
import { PersonaeDramatis } from '../system/calendar/personaedramatis.js';

export function connectSocket() {
  game.socket.on('system.dsa5', (data) => {
    switch (data.type) {
      case 'brawlStart':
        DSA5Combat.brawlStart(2000, false);
        return;
      case 'hideDeletedSheet':
        const target = data.payload.target.token ? game.actors.tokens[data.payload.target.token] : game.actors.get(data.payload.target.actor);
        MerchantSheetDSA5.hideDeletedSheet(target);
        return;
      case 'refreshSheets':
        for (const app of Object.values(ui.windows)) {
          if (data.payload.sheets.find((x) => app?.options?.baseApplication == x.type && x.id == app.object?.id)) app.render(true);
        }
        for (const sheet of data.payload.sheets) {
          if (!sheet.sheetId) continue;
          const app = foundry.applications.instances.get(sheet.sheetId);
          if (app && app.rendered) {
            app.render(true);
          }
        }
        return;
      case "invalidateCache":
        game.dsa5.apps.CalendarPicker.constructor.clearCache();
        return;
      default:
        if (Trade.socketListeners(data)) return;
    }

    if (!DSA5_Utility.isActiveGM()) return;

    switch (data.type) {
      case 'consumeEffectCharges':
        {
          const effectUuids = data.payload?.effectUuids || [];
          const amount = data.payload?.amount ?? 1;
          Promise.all(effectUuids.map(async (uuid) => {
            try {
              const effect = await fromUuid(uuid);
              const charges = effect?.getFlag?.('dsa5', 'charges');
              const value = Number(charges?.value);
              if (!effect?.consumeCharges || !charges || !Number.isFinite(value) || value <= 0) return;
              if (effect.disabled) return;
              await effect.consumeCharges(amount);
            } catch (e) {
              console.error('GM socket consumeEffectCharges failed', uuid, e);
            }
          }));
        }
        break;
      case 'updateKeepField':
        {
          if (DSA5.allowedforeignfields.includes(data.payload.field)) {
            const actor = game.actors.get(data.payload.actorId);
            actor.update({ [data.payload.field]: data.payload.updateData });
          }
        }
        break;
      case 'target':
        {
          const scene = game.scenes.get(data.payload.scene);
          const token = new foundry.canvas.placeables.Token(scene.getEmbeddedDocument('Token', data.payload.target));
          token.actor.update({ 'flags.oppose': data.payload.opposeFlag });
        }
        break;
      case 'addEffect':
        DSAActiveEffectConfig.applyEffect(data.payload.id, data.payload.mode, data.payload.actors, data.payload.options);
        break;
      case 'updateMsg':
        game.messages.get(data.payload.id).update(data.payload.updateData);
        break;
      case 'deleteMsg':
        game.messages.get(data.payload.id).delete();
        break;
      case 'showDamage':
        OpposedDsa5.showDamage(game.messages.get(data.payload.id), data.payload.hide);
        break;
      case 'hideQueryButton':
        OpposedDsa5.hideReactionButton(data.payload.id);
        break;
      case 'updateGroupCheck':
        RequestRoll.rerenderGC(game.messages.get(data.payload.messageId), data.payload.data);
        break;
      case 'apTrackerId':
        APTracker.receiveSocketEvent(data);
        break;
      case 'moneyTrackerId':
        MoneyTracker.receiveSocketEvent(data);
        break;
      case 'updateAttackMessage':
        game.messages.get(data.payload.messageId).update({
          'flags.data.unopposedStartMessage': data.payload.startMessageId,
        });
        break;
      case 'clearCombat':
        if (game.combat) game.combat.nextRound();
        break;
      case 'clearOpposed':
        OpposedDsa5.clearOpposed(game.actors.get(data.payload.actorId));
        break;
      case 'updateDefenseCount':
        if (game.combat) game.combat.updateDefenseCount(data.payload.speaker);
        break;
      case 'updateActionCount':
        if (game.combat) game.combat.updateActionCount(data.payload.speaker, data.payload.cost);
        break;
      case 'toggleFreeAction':
        if (game.combat) game.combat.toggleFreeAction(data.payload.speaker);
        break;
      case 'handleMovementCost':
        if (game.combat) {
          const movTokenDoc = canvas.scene?.tokens?.get(data.payload.tokenId);
          if (movTokenDoc) game.combat.handleMovementCost(movTokenDoc);
        }
        break;
      case 'trade':
        {
          const source = data.payload.source.token ? game.actors.tokens[data.payload.source.token] : game.actors.get(data.payload.source.actor);
          const target = data.payload.target.token ? game.actors.tokens[data.payload.target.token] : game.actors.get(data.payload.target.actor);
          MerchantSheetDSA5.finishTransaction(source, target, data.payload.price, data.payload.itemId, data.payload.buy, data.payload.amount);
        }
        break;
      case 'playWhisperSound':
        if (data.payload.whisper.includes(game.user.id)) foundry.audio.AudioHelper.play({ src: data.payload.soundPath, volume: 0.8, loop: false }, false);

        break;
      case 'socketedConditionAddActor':
        fromUuid(data.payload.id).then((item) => {
          const onUse = new OnUseEffect(item);
          onUse.socketedConditionAddActor(
            data.payload.actors.map((x) => game.actors.get(x)),
            data.payload.data,
          );
        });
        break;
      case 'personaNotesChanged':
        PersonaeDramatis.updateNotes(data.payload);
        break;
      case 'socketedConditionAdd':
        fromUuid(data.payload.id).then((item) => {
          const onUse = new OnUseEffect(item);
          onUse.socketedConditionAdd(data.payload.targets, data.payload.data);
        });
        break;
      case 'socketedRemoveCondition':
        fromUuid(data.payload.id).then((item) => {
          const onUse = new OnUseEffect(item);
          onUse.socketedRemoveCondition(data.payload.targets, data.payload.coreId);
        });
        break;
      case 'socketedActorTransformation':
        fromUuid(data.payload.id).then((item) => {
          const onUse = new OnUseEffect(item);
          onUse.socketedActorTransformation(data.payload.targets, data.payload.update);
        });
        break;
      case 'itemDrop':
        {
          const sourceActor = data.payload.sourceActorId ? game.actors.get(data.payload.sourceActorId) : undefined;
          fromUuid(data.payload.itemId).then((item) => {
            dropToGround(sourceActor, item, data.payload.data, { count: { value: data.payload.amount }, isBag: { value: data.payload.dropBag } });
          });
        }
        break;
      case 'finalizeFoodContribution':
      case 'finalizeidentification':
      case 'updateHits':
      case 'hideResistButton':
        break;
      case 'requestShapeshift':
        game.dsa5.config.hooks.shapeshift.constructor.onRequestShapeshift(data.payload);
        break
      case 'requestRestoreShape':
        game.dsa5.config.hooks.shapeshift.constructor.onRestoreShape(data.payload);
        break
      case 'reduceGroupSchip':
        FateRolls.reduceGroupSchip();
        break;
      case 'summonCreature':
        PlayerMenu.createConjuration(data.payload);
        break;
      default:
        console.warn(`Unhandled socket data type ${data.type}`);
    }
  });
}
