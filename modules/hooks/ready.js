export default function() {
    Hooks.on("ready", async() => {
        game.socket.on("system.dsa5", data => {

            if (data.type == "target" && game.user.isGM) {
                let scene = game.scenes.get(data.payload.scene)
                let token = new Token(scene.getEmbeddedEntity("Token", data.payload.target))
                token.actor.update({
                    "flags.oppose": data.payload.opposeFlag
                })
            }
            /* else if (data.type == "updateMsg" && game.user.isGM) {
                            game.messages.get(data.payload.id).update(data.payload.updateData)
                        } else if (data.type == "deleteMsg" && game.user.isGM) {
                            game.messages.get(data.payload.id).delete()
                        }*/
        })

    });
}