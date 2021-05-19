import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("preCreateActor", (createData, data, options, userId) => {
        let update = {}

        mergeObject(update, {
            token: {
                bar1: { attribute: "status.wounds" },
                displayName: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                displayBars: CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                disposition: CONST.TOKEN_DISPOSITIONS.NEUTRAL,
                name: createData.name
            }
        })

        if (!createData.data.img)
            update.img = "systems/dsa5/tokens/unknown.webp"

        if (createData.data.type == "character") {
            mergeObject(update, {
                token: {
                    vision: true,
                    brightSight: game.settings.get('dsa5', 'defaultBrightVision'),
                    dimSight: game.settings.get('dsa5', 'defaultDimVision'),
                    actorLink: true
                }
            })
        }
        createData.data.update(update)
    })

    Hooks.on("deleteActorActiveEffect", (actor, effect) => {
        if (effect.data.flags.dsa5 && effect.data.flags.core && effect.data.flags.core.statusId == "bloodrush") {
            actor.addCondition("stunned", 2, false, false)
            return false
        }
    })

    Hooks.on("preUpdateActor", (actor, updatedData, options, userId) => {
        let update = {}
        if (getProperty(actor.data, "data.config.autoBar")) {
            if (actor.data.isMage) {
                mergeObject(update, {
                    "token.bar2": { "attribute": "status.astralenergy" }
                });
            } else if (actor.data.isPriest) {
                mergeObject(update, {
                    "token.bar2": { "attribute": "status.karmaenergy" }
                });
            } else {
                mergeObject(update, {
                    "token.bar2": {}
                });
            }
        }
        actor.data.update(update)
    })

    Hooks.on('preCreateToken', (token, data, options, userId) => {
        const actor = game.actors.get(data.actorId);
        if (!actor || data.actorLink)
            return;

        if (actor.data.type == "creature" && getProperty(actor.data, "data.config.autoSize")) {
            DSA5_Utility.calcTokenSize(duplicate(actor), data)
        }
    })
}