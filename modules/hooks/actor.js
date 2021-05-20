export default function() {
    Hooks.on("deleteActorActiveEffect", (actor, effect) => {
        if (effect.data.flags.dsa5 && effect.data.flags.core && effect.data.flags.core.statusId == "bloodrush") {
            actor.addCondition("stunned", 2, false, false)
            return false
        }
    })

    Hooks.on('preCreateToken', (token, data, options, userId) => {
        const actor = game.actors.get(data.actorId);
        if (!actor || data.actorLink)
            return;

        if (actor.data.type == "creature" && getProperty(actor.data, "data.config.autoSize")) {
            let tokenSize = game.dsa5.config.tokenSizeCategories[actor.data.data.status.size.value]
            if (tokenSize) {
                let update = {}
                if (tokenSize < 1) {
                    update.scale = tokenSize;
                    update.width = update.height = 1;
                } else {
                    const int = Math.floor(tokenSize);
                    update.width = update.height = int;
                    update.scale = Math.max(tokenSize / int, 0.25);
                }
                token.data.update(update)
            }
        }
    })

}