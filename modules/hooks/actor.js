import DSA5 from "../system/config-dsa5.js"

export default function() {
    Hooks.on("preCreateActor", (createData) => {

        if (!createData.token)
            mergeObject(createData, {
                "token.bar1": { "attribute": "status.wounds" },
                "token.displayName": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                "token.displayBars": CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER,
                "token.disposition": CONST.TOKEN_DISPOSITIONS.NEUTRAL,
                "token.name": createData.name
            })

        if (!createData.img)
            createData.img = "systems/dsa5/tokens/unknown.webp"

        if (createData.type == "character") {
            createData.token.vision = true;
            createData.token.brightSight = game.settings.get('dsa5', 'defaultBrightVision');
            createData.token.dimSight = game.settings.get('dsa5', 'defaultDimVision');
            createData.token.actorLink = true;
        }

    })

    Hooks.on("preUpdateActor", (actor, updatedData) => {

        if (actor.data.isMage) {
            mergeObject(updatedData, {
                "token.bar2": { "attribute": "status.astralenergy" }
            });
        } else if (actor.data.isPriest) {
            mergeObject(updatedData, {
                "token.bar2": { "attribute": "status.karmaenergy" }
            });
        } else {
            mergeObject(updatedData, {
                "token.bar2": {}
            });
        }
    })

    Hooks.on('preCreateToken', (scene, data, options, userId) => {
        const actor = game.actors.get(data.actorId);
        if (!actor || data.actorLink)
            return;

        if (actor.data.type == "creature") {
            let tokenSize = DSA5.tokenSizeCategories[actor.data.data.status.size.value]
            if (tokenSize) {
                if (tokenSize < 1) {
                    data.scale = tokenSize;
                    data.width = data.height = 1;
                } else {
                    const int = Math.floor(tokenSize);
                    data.width = data.height = int;
                    data.scale = tokenSize / int;
                    data.scale = Math.max(data.scale, 0.25);
                }
            }
        }
    })
}