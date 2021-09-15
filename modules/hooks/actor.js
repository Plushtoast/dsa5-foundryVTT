import DSA5_Utility from "../system/utility-dsa5.js";

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

        if (getProperty(actor.data, "data.merchant.merchantType") == "loot") {
            mergeObject(update, { displayBars: 0 })
        } else if (getProperty(actor.data, "data.config.autoBar")) {
            mergeObject(update, { bar1: { attribute: "status.wounds" } })
            if (actor.data.isMage) {
                mergeObject(update, { bar2: { attribute: "status.astralenergy" } });
            } else if (actor.data.isPriest) {
                mergeObject(update, { bar2: { attribute: "status.karmaenergy" } });
            } else {
                mergeObject(update, { bar2: { attribute: "" } });
            }
        }

        if (actor.data.type == "creature" && getProperty(actor.data, "data.config.autoSize")) {
            DSA5_Utility.calcTokenSize(actor.data, update)
        }

        token.data.update(update)
    })
}