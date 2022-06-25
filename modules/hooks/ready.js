import DSA5Tutorial from "../system/tutorial.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import MerchantSheetDSA5 from "../actor/merchant-sheet.js";
import Itemdsa5 from "../item/item-dsa5.js";
import PlayerMenu from "../wizards/player_menu.js";
import OnUseEffect from "../system/onUseEffects.js";
import RequestRoll from "../system/request-roll.js";
import DSAActiveEffectConfig from "../status/active_effects.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { dropToGround } from "./itemDrop.js";

export default function() {
    Hooks.on("ready", async() => {
        game.socket.on("system.dsa5", data => {
            switch (data.type) {
                case "hideDeletedSheet":
                    let target = data.payload.target.token ? game.actors.tokens[data.payload.target.token] : game.actors.get(data.payload.target.actor)
                    MerchantSheetDSA5.hideDeletedSheet(target)
                    break
            }
        })
        if (game.user.isGM) {
            game.socket.on("system.dsa5", data => {
                switch (data.type) {
                    case "target":
                        {
                            let scene = game.scenes.get(data.payload.scene)
                            let token = new Token(scene.getEmbeddedDocument("Token", data.payload.target))
                            token.actor.update({
                                "flags.oppose": data.payload.opposeFlag
                            })
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
                            AudioHelper.play({ src: data.payload.soundPath, volume: 0.8, loop: false }, false);

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
                    case "hideDeletedSheet":
                    case "finalizeidentification":
                        break
                    case "updateHits":
                    case "hideResistButton":
                        break
                    case "summonCreature":
                        PlayerMenu.createConjuration(data.payload)
                        break
                    default:
                        console.warn(`Unhandled socket data type ${data.type}`)
                }
            })
        }

        if (DSA5_Utility.moduleEnabled("vtta-tokenizer") && !(await game.settings.get("dsa5", "tokenizerSetup")) && game.user.isGM) {
            await game.settings.set("vtta-tokenizer", "default-frame-pc", "[data] systems/dsa5/icons/backgrounds/token_green.webp")
            await game.settings.set("vtta-tokenizer", "default-frame-npc", "[data] systems/dsa5/icons/backgrounds/token_black.webp")
            await game.settings.set("vtta-tokenizer", "default-frame-neutral", "[data] systems/dsa5/icons/backgrounds/token_blue.webp")
            await game.settings.set("dsa5", "tokenizerSetup", true)
        }
        if (DSA5_Utility.moduleEnabled("dice-so-nice") && !(await game.settings.get("dsa5", "diceSetup")) && game.user.isGM) {
            await game.settings.set("dice-so-nice", "immediatelyDisplayChatMessages", true)
            await game.settings.set("dsa5", "diceSetup", true)
        }

        await DSA5Tutorial.firstTimeMessage()

        Itemdsa5.setupSubClasses()
    });
}