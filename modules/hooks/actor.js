import DSAActiveEffectConfig from "../status/active_effects.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("deleteActiveEffect", (effect) => {
        const actor = effect.parent
        if (actor && actor.documentName == "Actor") {
            const statusId = getProperty(effect.data, "flags.core.statusId")
            if (statusId == "bloodrush") {
                actor.addCondition("stunned", 2, false, false)
                return false
            } else if (statusId == "dead" && game.combat) {
                actor.markDead(false)
                return false
            }
            DSAActiveEffectConfig.onEffectRemove(actor, effect)
            const result = Hooks.call("deleteActorActiveEffect", actor, effect)
            if (result === false) return false
        }
    })

    const askForName = (actor) => {
        new Dialog({
            title: game.i18n.localize("DSASETTINGS.obfuscateTokenNames"),
            content: `<label for="name">${game.i18n.localize('DSASETTINGS.rename')}</label> <input dtype="string" name="name" type="text" value="${actor.name}"/>`,
            default: 'Yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: async(html) => {
                        const name = html.find('[name="name"]').val()
                        const token = canvas.scene.data.tokens.find((x) => x.actor.id === actor.id)
                        await token.update({ name })
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    const obfuscateName = async(actor, update) => {
        const setting = game.settings.get("dsa5", "obfuscateTokenNames")
        if (setting == "0" || getProperty(actor, "data.data.merchant.merchantType") == "loot") return

        for (let u of game.users) {
            if (u.isGM) continue;
            if (actor.testUserPermission(u, "LIMITED")) return;
        }
        const sameActorTokens = canvas.scene.data.tokens.filter((x) => x.actor && x.actor.id === actor.id);
        let name = game.i18n.localize("unknown")
        if (sameActorTokens.length > 0) {
            name = `${sameActorTokens[0].name.replace(/ \d{1,}$/)} ${sameActorTokens.length + 1}`
        }

        if (setting == "2" && sameActorTokens == 0) {
            askForName(actor)
        } else {
            update["name"] = name
        }
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