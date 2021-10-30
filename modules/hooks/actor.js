import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("deleteActorActiveEffect", (actor, effect) => {
        if (effect.data.flags.dsa5 && effect.data.flags.core && effect.data.flags.core.statusId == "bloodrush") {
            actor.addCondition("stunned", 2, false, false)
            return false
        }
    })

    const askForName = (name, actor) => {
        return new Promise((resolve, reject) => {
            new Dialog({
                title: game.i18n.localize("DSASETTINGS.obfuscateTokenNames"),
                content: `<label for="name">${actor.name} ${game.i18n.localize('DSASETTINGS.rename')}</label> <input name="name" value="${name}"/>`,
                default: 'cancel',
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: dlg => {
                            resolve(dlg)
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel"),
                        callback: () => {
                            resolve(undefined)
                        }
                    }
                }
            }).render(true)

        })
    }

    const obfuscateName = async(actor, update) => {
        const setting = game.settings.get("dsa5", "obfuscateTokenNames")
        if(setting == "0") return

        for (let u of game.users) {
            if (u.isGM) continue;
            if (actor.testUserPermission(u, "LIMITED")) return;
        }
        const sameActorTokens = canvas.scene.data.tokens.filter((x) => x.actor.id === actor.id);
        let name
        if(sameActorTokens.length == 0){
            name = game.i18n.localize("unknown")
        }else{
            name = `${sameActorTokens[0].name.replace(/ \d{1,}$/)} ${sameActorTokens.length + 1}`
        }

        if (setting == "2" && sameActorTokens == 0){
            askForName(name, actor).then(async(html) => {
                if (html) name = html.find('[name="name"]').val()
                const token = canvas.scene.data.tokens.find((x) => x.actor.id === actor.id)
                await token.update({name})
            });
        }
        update["name"] = name
    }

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

        obfuscateName(actor, update)
        token.data.update(update)

    })
}