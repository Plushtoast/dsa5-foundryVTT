import PlayerMenu from "../wizards/player_menu.js";
import OnUseEffect from "../system/onUseEffects.js";
import RequestRoll from "../system/request-roll.js";
import DSAActiveEffectConfig from "../status/active_effects.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import MerchantSheetDSA5 from "../actor/merchant-sheet.js";
import { dropToGround } from "./itemDrop.js";
import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import { Trade } from "../actor/trade.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { DSA5Combat } from "./combat_tracker.js";
import APTracker from "../system/ap-tracker.js";

export function connectSocket() {
    game.socket.on("system.dsa5", data => {
        switch (data.type) {
            case "brawlStart":
                DSA5Combat.brawlStart(2000, false)
                return
            case "hideDeletedSheet":
                let target = data.payload.target.token ? game.actors.tokens[data.payload.target.token] : game.actors.get(data.payload.target.actor)
                MerchantSheetDSA5.hideDeletedSheet(target)
                return
            default:
                if(Trade.socketListeners(data)) return
        }

        if(!DSA5_Utility.isActiveGM()) return

        switch (data.type) {
            case "updateKeepField":
                {
                    if(DSA5.allowedforeignfields.includes(data.payload.field)){
                        const actor = game.actors.get(data.payload.actorId)
                        actor.update({ [data.payload.field]: data.payload.updateData })
                    }
                }
                break
            case "target":
                {
                    let scene = game.scenes.get(data.payload.scene)
                    let token = new Token(scene.getEmbeddedDocument("Token", data.payload.target))
                    token.actor.update({ "flags.oppose": data.payload.opposeFlag })
                }
                break
            case "addEffect":
                DSAActiveEffectConfig.applyEffect(data.payload.id, data.payload.mode, data.payload.actors)
                break
            case "updateMsg":
                game.messages.get(data.payload.id).update(data.payload.updateData)
                break
            case "deleteMsg":
                game.messages.get(data.payload.id).delete()
                break
            case "showDamage":
                OpposedDsa5.showDamage(game.messages.get(data.payload.id), data.payload.hide)
                break
            case "hideQueryButton":
                OpposedDsa5.hideReactionButton(data.payload.id)
                break
            case "updateGroupCheck":
                RequestRoll.rerenderGC(game.messages.get(data.payload.messageId), data.payload.data)
                break
            case "apTracker":
                APTracker.receiveSocketEvent(data)
                break
            case "updateAttackMessage":
                game.messages.get(data.payload.messageId).update({ "flags.data.unopposedStartMessage": data.payload.startMessageId });
                break
            case "clearCombat":
                if (game.combat) game.combat.nextRound()
                break
            case "clearOpposed":
                OpposedDsa5.clearOpposed(game.actors.get(data.payload.actorId))
                break
            case "updateDefenseCount":
                if (game.combat) game.combat.updateDefenseCount(data.payload.speaker)
                break
            case "trade":
                {
                    let source = data.payload.source.token ? game.actors.tokens[data.payload.source.token] : game.actors.get(data.payload.source.actor)
                    let target = data.payload.target.token ? game.actors.tokens[data.payload.target.token] : game.actors.get(data.payload.target.actor)
                    MerchantSheetDSA5.finishTransaction(source, target, data.payload.price, data.payload.itemId, data.payload.buy, data.payload.amount)
                }
                break
            case "playWhisperSound":
                if (data.payload.whisper.includes(game.user.id))
                    foundry.audio.AudioHelper.play({ src: data.payload.soundPath, volume: 0.8, loop: false }, false);

                break
            case "socketedConditionAddActor":
                fromUuid(data.payload.id).then(item => {
                    const onUse = new OnUseEffect(item)
                    onUse.socketedConditionAddActor(data.payload.actors.map(x => game.actors.get(x)), data.payload.data)
                })
                break
            case "socketedConditionAdd":
                fromUuid(data.payload.id).then(item => {
                    const onUse = new OnUseEffect(item)
                    onUse.socketedConditionAdd(data.payload.targets, data.payload.data)
                })
                break
            case "socketedRemoveCondition":
                fromUuid(data.payload.id).then(item => {
                    const onUse = new OnUseEffect(item)
                    onUse.socketedRemoveCondition(data.payload.targets, data.payload.coreId)
                })
                break
            case "socketedActorTransformation":
                fromUuid(data.payload.id).then(item => {
                    const onUse = new OnUseEffect(item)
                    onUse.socketedActorTransformation(data.payload.targets, data.payload.update)
                })
                break
            case "itemDrop":
                {
                    let sourceActor = data.payload.sourceActorId ? game.actors.get(data.payload.sourceActorId) : undefined
                    fromUuid(data.payload.itemId).then(item => {
                        dropToGround(sourceActor, item, data.payload.data, data.payload.amount)
                    })
                }
                break
            case "finalizeFoodContribution":
            case "finalizeidentification":
            case "updateHits":
            case "hideResistButton":
                break
            case "reduceGroupSchip":
                Actordsa5.reduceGroupSchip()
                break
            case "summonCreature":
                PlayerMenu.createConjuration(data.payload)
                break
            default:
                console.warn(`Unhandled socket data type ${data.type}`)
        }
    })

}

