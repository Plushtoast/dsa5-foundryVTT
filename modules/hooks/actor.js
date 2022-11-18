import DSAActiveEffectConfig from "../status/active_effects.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Hooks.on("preDeleteActiveEffect", (effect, options, user_id) => {
        if(options.noHook) return
        
        const actor = effect.parent
        if (actor && actor.documentName == "Actor") {
            if(getProperty(effect, "flags.dsa5.maintain")){
                new Dialog({
                    title: effect.label,
                    content: game.i18n.format('DIALOG.updateMaintainSpell',  {actor: actor.name}),
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

    Hooks.on("deleteActiveEffect", (effect, options) => {
        if(options.noHook) return

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

    Hooks.on("dropActorSheetData", (actor, sheet, data) => {
        switch(data.data?.type){
            case "condition":
                actor.addCondition(data.data.payload.id, 1, false, false)
                return false
            case "lookup":
                sheet._handleLookup(data.data)
                return false
            case "fullpack": 
                sheet._addFullPack(data.data)
                return false
        }
    }) 


    Hooks.on("createActiveEffect", (effect, options, user) => {
        checkIniChange(effect)
    })

    Hooks.on("deleteActiveEffect", (effect, options, user) => {
        checkIniChange(effect)
    })

    Hooks.on("updateActiveEffect", (effect, options, user) => {
        checkIniChange(effect)
    })

    function checkIniChange(effect){
        if(!game.user.isGM) return

        if(game.combat && effect.changes.some(x => /(system\.status\.initiative|system\.characteristics.mu|system\.characteristics\.ge)/.test(x.key))){
            const actorId = effect.parent.id
            const combatant = game.combat.combatants.find(x => x.actor.id == actorId)
            if(combatant) combatant.recalcInitiative()
        }
    }

    const askForName = async (tokenObject, setting) => {
        const dialogConstructor = game.dsa5.apps.AskForNameDialog || AskForNameDialog
        dialogConstructor.getDialog(tokenObject, setting)
    }

    const obfuscateName = async(token, update) => {
        if(!DSA5_Utility.isActiveGM()) return

        const actor = token.actor
        if(actor.hasPlayerOwner) return

        const setting = Number(game.settings.get("dsa5", "obfuscateTokenNames"))
        if (setting == 0 || getProperty(actor, "merchant.merchantType") == "loot") return

        let sameActorTokens = canvas.scene.tokens.filter((x) => x.actor && x.actor.id === actor.id);
        let name = game.i18n.localize("unknown")
        if ([2,4].includes(setting)) {
            const tokenId = token.id || token._id
            if(!tokenId) return
            
            askForName(token, setting)
            return
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
        
        obfuscateName(token, modify)
        token.updateSource(modify)
    })

    Hooks.on('createToken', (token, options, id) => {
        if(options.noHook) return
        
        obfuscateName(token, {})
    })
}

class AskForNameDialog extends Dialog{
    static async getDialog(tokenObject, setting){
        new Dialog({
            title: game.i18n.localize("DSASETTINGS.obfuscateTokenNames"),
            content: `<label for="name">${game.i18n.localize('DSASETTINGS.rename')}</label> <input dtype="string" name="name" type="text" value="${tokenObject.actor.name}"/>`,
            default: 'Yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: async(html) => {
                        const tokenId = tokenObject.id || tokenObject._id
                        let name = html.find('[name="name"]').val()
                        if(setting == 2){
                            let sameActorTokens = canvas.scene.tokens.filter((x) => x.name === name);
                            if (sameActorTokens.length > 0) {
                                name = `${name.replace(/ \d{1,}$/)} ${sameActorTokens.length + 1}`
                            }
                        }
                        const token = canvas.scene.tokens.get(tokenId)
                        await token.update({ name })
                    }
                },
                unknown: {
                    icon: '<i class="fa fa-question"></i>',
                    label: game.i18n.localize("unknown"),
                    callback: async(html) => {
                        const tokenId = tokenObject.id || tokenObject._id
                        const token = canvas.scene.tokens.get(tokenId)
                        await token.update({ name: game.i18n.localize("unknown") })
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }
}