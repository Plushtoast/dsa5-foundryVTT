import DSA5Tutorial from "../system/tutorial.js";

export default function() {
    Hooks.on("ready", async() => {
        game.socket.on("system.dsa5", data => {
            if (data.type == "target" && game.user.isGM) {
                let scene = game.scenes.get(data.payload.scene)
                let token = new Token(scene.getEmbeddedEntity("Token", data.payload.target))
                token.actor.update({
                    "flags.oppose": data.payload.opposeFlag
                })
            } else if (data.type == "updateMsg" && game.user.isGM) {
                game.messages.get(data.payload.id).update(data.payload.updateData)
            } else if (data.type == "deleteMsg" && game.user.isGM) {
                game.messages.get(data.payload.id).delete()
            } else if (game.user.isGM) {
                console.warn(`Unhandled socket data type ${data.type}`)
            }
        })

        DSA5Tutorial.firstTimeMessage()

        if (game.modules.get("vtta-tokenizer") && game.modules.get("vtta-tokenizer").active && !game.settings.get("dsa5", "tokenizerSetup")) {
            game.settings.set("vtta-tokenizer", "default-frame-pc", "systems/dsa5/icons/backgrounds/token_green.webp")
            game.settings.set("vtta-tokenizer", "default-frame-npc", "systems/dsa5/icons/backgrounds/token_black.webp")
            game.settings.set("dsa5", "tokenizerSetup", true)
        }
    });
}