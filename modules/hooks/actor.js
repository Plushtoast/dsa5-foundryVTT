export default function() {
    Hooks.on("deleteActorActiveEffect", (actor, effect) => {
        if (effect.data.flags.dsa5 && effect.data.flags.core && effect.data.flags.core.statusId == "bloodrush") {
            actor.addCondition("stunned", 2, false, false)
            return false
        }
    })

    Hooks.on('preCreateToken', (token, data, options, userId) => {
        const actor = game.actors.get(data.actorId);
        if (!actor) return;

        let update = {}
        if (getProperty(actor.data, "data.config.autoBar")) {
            if (actor.data.isMage) {
                mergeObject(update, {
                    bar2: { attribute: "status.astralenergy" }
                });
            } else if (actor.data.isPriest) {
                mergeObject(update, {
                     bar2: { attribute: "status.karmaenergy" }
                });
            } else {
                mergeObject(update, {
                     bar2: { attribute: "" }
                });
            }
        }

        if (!data.actorLink){
            if (actor.data.type == "creature" && getProperty(actor.data, "data.config.autoSize")) {
                let tokenSize = game.dsa5.config.tokenSizeCategories[actor.data.data.status.size.value]
                if (tokenSize) {

                    if (tokenSize < 1) {
                        update.scale = tokenSize;
                        update.width = update.height = 1;
                    } else {
                        const int = Math.floor(tokenSize);
                        update.width = update.height = int;
                        update.scale = Math.max(tokenSize / int, 0.25);
                    }

                }
            }
        }
        token.data.update(update)
    })

}