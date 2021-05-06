import DSA5Tutorial from "../system/tutorial.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import MerchantSheetDSA5 from "../actor/merchant-sheet.js";
import Itemdsa5 from "../item/item-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";

export default function() {
    Hooks.on("ready", async() => {
        if (game.user.isGM) {
            game.socket.on("system.dsa5", data => {
                switch (data.type) {
                    case "target":
                        {
                            let scene = game.scenes.get(data.payload.scene)
                            let token = new Token(scene.getEmbeddedEntity("Token", data.payload.target))
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
                    case "trade":
                        {
                            let source = data.payload.source.token ? game.actors.tokens[data.payload.source.token] : game.actors.get(data.payload.source.actor)
                            let target = data.payload.target.token ? game.actors.tokens[data.payload.target.token] : game.actors.get(data.payload.target.actor)
                            MerchantSheetDSA5.finishTransaction(source, target, data.payload.price, data.payload.itemId, data.payload.buy, data.payload.amount)
                        }
                        break
                    default:
                        console.warn(`Unhandled socket data type ${data.type}`)
                }
            })
        }

        if (game.modules.get("vtta-tokenizer") && game.modules.get("vtta-tokenizer").active && !game.settings.get("dsa5", "tokenizerSetup") && game.user.isGM) {
            game.settings.set("vtta-tokenizer", "default-frame-pc", "systems/dsa5/icons/backgrounds/token_green.webp")
            game.settings.set("vtta-tokenizer", "default-frame-npc", "systems/dsa5/icons/backgrounds/token_black.webp")
            game.settings.set("dsa5", "tokenizerSetup", true)
        }
        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active && !game.settings.get("dsa5", "diceSetup") && game.user.isGM) {
            game.settings.set("dice-so-nice", "immediatelyDisplayChatMessages", true)
            game.settings.set("dsa5", "diceSetup", true)
        }

        DSA5Tutorial.firstTimeMessage()

        Itemdsa5.setupSubClasses()
    });
}