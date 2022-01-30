import DSA5Tutorial from "../system/tutorial.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import MerchantSheetDSA5 from "../actor/merchant-sheet.js";
import Itemdsa5 from "../item/item-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";
import PlayerMenu from "../wizards/player_menu.js";
import { DiceSoNiceCustomization } from "./dicesonice.js";
import OnUseEffect from "../system/onUseEffects.js";

export default function() {
    Hooks.on("ready", async() => {
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
                        DiceDSA5._applyEffect(data.payload.id, data.payload.mode, data.payload.actors)
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
                        DiceDSA5._rerenderGC(game.messages.get(data.payload.messageId), data.payload.data)
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
                            onUse.socketedConditionAddActor(payload.actors.map(x => game.actors.get(x)), payload.data)
                        })
                        break
                    case "socketedConditionAdd":
                        fromUuid(data.payload.id).then(item => {
                            const onUse = new OnUseEffect(item)
                            onUse.socketedConditionAdd(payload.targets, payload.data)
                        })
                        break
                    case "socketedRemoveCondition":
                        fromUuid(data.payload.id).then(item => {
                            const onUse = new OnUseEffect(item)
                            onUse.socketedRemoveCondition(payload.targets, payload.coreId)
                        })
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

        if (game.modules.get("vtta-tokenizer") && game.modules.get("vtta-tokenizer").active && !(await game.settings.get("dsa5", "tokenizerSetup")) && game.user.isGM) {
            await game.settings.set("vtta-tokenizer", "default-frame-pc", "systems/dsa5/icons/backgrounds/token_green.webp")
            await game.settings.set("vtta-tokenizer", "default-frame-npc", "systems/dsa5/icons/backgrounds/token_black.webp")
            await game.settings.set("dsa5", "tokenizerSetup", true)
        }
        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active && !(await game.settings.get("dsa5", "diceSetup")) && game.user.isGM) {
            await game.settings.set("dice-so-nice", "immediatelyDisplayChatMessages", true)
            await game.settings.set("dsa5", "diceSetup", true)
        }

        await DSA5Tutorial.firstTimeMessage()

        Itemdsa5.setupSubClasses()
    });
}