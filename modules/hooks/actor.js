import DSAActiveEffectConfig from "../status/active_effects.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("preDeleteActiveEffect", (effect, options, user_id) => {
        const actor = effect.parent
        if (actor && actor.documentName == "Actor") {
            if(getProperty(effect, "flags.dsa5.maintain")){
                new Dialog({
                    title: effect.label,
                    content: game.i18n.localize('DIALOG.updateMaintainSpell'),
                    default: 'yes',
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("HELP.pay"),
                            callback: async(dlg) => {
                                const paid = await actor.applyMana(Number(getProperty(effect, "flags.dsa5.maintain")), getProperty(effect, "flags.dsa5.payType"))
                                if(paid){
                                    const duration = {
                                        startTime: game.time.worldTime
                                    }
                                    if(game.combat){
                                        duration.startRound = game.combat.round
                                        duration.startTurn = game.combat.turn
                                    }
                                    actor.updateEmbeddedDocuments("ActiveEffect", [{_id: effect._id, duration}])
                                }
                            }
                        },
                        delete: {
                            icon: '<i class="fas fa-trash"></i>',
                            label: game.i18n.localize("delete"),
                            callback: dlg => {
                                actor.deleteEmbeddedDocuments("ActiveEffect", [effect._id], {noHook: true})
                            }
                        }
                    }
                }).render(true)
                return false
            }
        }
    })

    Hooks.on("deleteActiveEffect", (effect) => {
        const actor = effect.parent
        if (actor && actor.documentName == "Actor") {
            const statusId = getProperty(effect, "flags.core.statusId")
            if (statusId == "bloodrush") {
                actor.addCondition("stunned", 2, false, false)
                return false
            } else if (statusId == "dead" && game.combat) {
                actor.markDead(false)
                return false
            }
            DSAActiveEffectConfig.onEffectRemove(actor, effect)

            //todo this might need to go to predelete
            const result = Hooks.call("deleteActorActiveEffect", actor, effect)
            if (result === false) return false
        }
    })

    const askForName = async (actor) => {
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
                        const token = canvas.scene.tokens.find((x) => x.actor?.id === actor.id)
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
        const setting = Number(game.settings.get("dsa5", "obfuscateTokenNames"))
        if (setting == 0 || getProperty(actor, "merchant.merchantType") == "loot") return

        for (let u of game.users) {
            if (u.isGM) continue;
            if (actor.testUserPermission(u, "LIMITED")) return;
        }
        let sameActorTokens = canvas.scene.tokens.filter((x) => x.actor && x.actor.id === actor.id);
        let name = game.i18n.localize("unknown")
        if ([2,4].includes(setting)) {
            sameActorTokens = sameActorTokens.filter(x => x.name == actor.name)
            if(sameActorTokens.length == 0) {
                askForName(actor)
                return
            }
        }
        if (sameActorTokens.length > 0 && setting < 3) {
            name = `${sameActorTokens[0].name.replace(/ \d{1,}$/)} ${sameActorTokens.length + 1}`
        }
        update["name"] = name
    }

    Hooks.on('preCreateToken', (token, data, options, userId) => {
        const actor = token.actor
        if (!actor) return;

        let modify = {} 
        if (getProperty(actor, "system.merchant.merchantType") == "loot") {
            mergeObject(modify, { displayBars: 0 })
        } else if (getProperty(actor, "system.config.autoBar")) {
            mergeObject(modify, { bar1: { attribute: "status.wounds" } })
            
            if (actor.system.isMage) {
                mergeObject(modify, { bar2: { attribute: "status.astralenergy" } })
            } else if (actor.system.isPriest) {
                mergeObject(modify, { bar2: { attribute: "status.karmaenergy" } })
            } else {
                mergeObject(modify, { bar2: { attribute: "tbd" } })
            }
        }
        
        if (getProperty(actor, "system.config.autoSize")) {
            DSA5_Utility.calcTokenSize(actor, modify)
        }

        obfuscateName(actor, modify)
        token.updateSource(modify)
    })
}

