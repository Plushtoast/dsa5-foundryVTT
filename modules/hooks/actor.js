import DSAActiveEffectConfig from "../status/active_effects.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import Riding from "../system/riding.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import RuleChaos from "../system/rule_chaos.js";

export default function() {
    Hooks.on("preDeleteActiveEffect", (effect, options, user_id) => {
        if(options.noHook) return

        const actor = effect.parent
        if (actor && actor.documentName == "Actor") {
            if(getProperty(effect, "flags.dsa5.maintain")){
                const effectsToRemove = [effect._id]
                const searchEffect = effect.name.replace('(' + game.i18n.localize('maintainCost') +')', "").trim()
                const relatedEffects = actor.effects.filter(x => x.name.startsWith(searchEffect) && !x.origin && x.id != effect._id)
                let content = game.i18n.format('DIALOG.updateMaintainSpell',  {actor: actor.name})
                if(relatedEffects){
                    content += `<p>${game.i18n.localize("DIALOG.dependentMaintainEffects")}</p>`
                    content +=  relatedEffects.map(x => `<p><label for="rel${x.id}">${x.name}</label><input class="effectRemoveSelector" checked type="checkbox" value="${x.id}" name="rel${x.id}"/></p>` ).join("")
                }
                new Dialog({
                    title: effect.name,
                    content,
                    default: 'yes',
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("HELP.pay"),
                            callback: async() => {
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
                                for(let it of dlg.find(".effectRemoveSelector:checked")){
                                    effectsToRemove.push($(it).val())
                                }
                                actor.deleteEmbeddedDocuments("ActiveEffect", effectsToRemove, {noHook: true})
                            }
                        }
                    }
                }).render(true)
                return false
            }
        }
    })

    Hooks.on("updateActor",(actor, updates) => {
        if(!game.user.isGM && actor.limited && hasProperty(updates, "system.merchant.hidePlayer")) ui.sidebar.render(true)
    })

    Hooks.on("deleteActiveEffect", (effect, options) => {
        if(!DSA5_Utility.isActiveGM() || options.noHook) return

        const actor = effect.parent
        notifyFadingEffect(effect, options)

        if (actor && actor.documentName == "Actor") {
            const statusesId = [...effect.statuses][0]
            if (statusesId == "bloodrush") {
                actor.addCondition("stunned", 2, false, false)
                return false
            } else if (statusesId == "dead" && game.combat) {
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
        if(!DSA5_Utility.isActiveGM()) return

        checkIniChange(effect)
        createEffects(effect)
    })

    Hooks.on("deleteActiveEffect", (effect, options, user) => {
        if(!DSA5_Utility.isActiveGM()) return

        checkIniChange(effect)
    })

    Hooks.on("updateActiveEffect", (effect, options, user) => {
        if(!DSA5_Utility.isActiveGM()) return

        checkIniChange(effect)
        countableDependentEffects(effect)
    })

    function checkIniChange(effect){
        if(game.combat && effect.changes.some(x => /(system\.status\.initiative|system\.characteristics.mu|system\.characteristics\.ge)/.test(x.key))){
            const actorId = effect.parent.id
            const combatant = game.combat.combatants.find(x => x.actor.id == actorId)
            if(combatant) combatant.recalcInitiative()
        }
    }

    const notifyFadingEffect = async(effect, options) => {
        if(!effect.parent) return

        const target = getProperty(effect, "flags.dsa5.removeMessage")

        if(!((game.settings.get("dsa5","notifyOnFadingEffects") && effect.parent.documentName == "Actor") || target))  return

        let forceWhisperIDs = []
        switch(target) {
            case "player":
                forceWhisperIDs = game.users.filter(u => !u.isGM && effect.parent.testUserPermission(u, "OWNER"))
                break
            case "playergm": 
                forceWhisperIDs = game.users.filter(u => effect.parent.testUserPermission(u, "OWNER"))
                break
            case "players":
                forceWhisperIDs = undefined
                break
            default:
                forceWhisperIDs = game.users.filter(x => x.isGM)
        }

        forceWhisperIDs = forceWhisperIDs?.map(x => x.id)

        ChatMessage.create(DSA5_Utility.chatDataSetup(game.i18n.format("CHATNOTIFICATION.fadingEffect", {effect: effect.name, actor: effect.parent.link}), undefined, undefined, forceWhisperIDs))
    }

    const createEffects = async(effect) => {
        const actor = effect.parent
        if(!actor) return

        await countableDependentEffects(effect, {}, actor)
        const statusesId = [...effect.statuses][0]

        if (statusesId == "dead" && game.combat) await actor.markDead(true);
        else if (statusesId == "unconscious") await actor.addCondition("prone");
    }

    const countableDependentEffects = async(effect, toCheck = {}, actor) => {
        if(!actor) actor = effect.parent
        if(!actor || actor.documentName != "Actor") return

        const efKeys = /^system\.condition\./
        for(let ef of effect.changes || []){
          if(efKeys.test(ef.key) && ef.mode == 2){
            toCheck[ef.key.split(".")[2]] = Number(ef.value)
          }
        }

        for(let key of Object.keys(toCheck)){
          if (actor.system.condition[key] >= 4) {
            if (key == "inpain")
              await actor.initResistPainRoll(effect)
            else if (["encumbered", "stunned", "feared", "confused", "trance"].includes(key))
              await actor.addCondition("incapacitated");
            else if (key == "paralysed")
              await actor.addCondition("rooted");
            else if (["drunken", "exhaustion"].includes(key)) {
              await actor.addCondition("stunned");
              await actor.removeCondition(key);
            }
          }
          if (
            ((Number(toCheck.inpain) || 0) > 0) &&
            !actor.hasCondition("bloodrush") &&
            actor.system.condition.inpain > 0 &&
            AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize("LocalizedIDs.frenzy"))
          ) {
            await actor.addCondition("bloodrush");
            const msg = DSA5_Utility.replaceConditions(
              `${game.i18n.format("CHATNOTIFICATION.gainsBloodrush", {
                character: "<b>" + actor.name + "</b>",
              })}`
            );
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
          }
        }
    }

    const askForName = async (tokenObject, setting) => {
        const dialogConstructor = game.dsa5.apps.AskForNameDialog || AskForNameDialog
        dialogConstructor.getDialog(tokenObject, setting)
    }

   const randomWeaponSelection = async (token) => {
        if(!DSA5_Utility.isActiveGM()) return

        if(game.settings.get("dsa5", "randomWeaponSelection") && token.actor.type != "character") {

            const meleeweapons = []
            const shields = []
            const rangeweapons = []
            for(let itm of token.actor.items){
                if(itm.type == "meleeweapon"  && itm.system.worn.value)
                    RuleChaos.isShield(itm) ? shields.push(itm) : meleeweapons.push(itm)

                else if(itm.type == "rangeweapon" && itm.system.worn.value)
                    rangeweapons.push(itm)
            }
            const updates = []
            if(meleeweapons.length){
                const weapon = meleeweapons[Math.floor(Math.random()*meleeweapons.length)]
                const wornId = weapon._id
                let shieldId
                if(!(RuleChaos.regex2h.test(weapon.name)) && shields.length){
                    shieldId = shields[Math.floor(Math.random()*shields.length)]._id
                }
                for(let itm of meleeweapons){
                    if(itm._id == wornId) continue

                    updates.push({_id: itm._id, system: {worn: {value: false}}})
                }
                for(let itm of shields){
                    if(itm._id == shieldId) continue

                    updates.push({_id: itm._id, system: {worn: {value: false}}})
                }
            }
            if(rangeweapons.length){
                const weaponid = rangeweapons[Math.floor(Math.random()*rangeweapons.length)]._id
                for(let itm of rangeweapons){
                    if(itm._id == weaponid) continue

                    updates.push({_id: itm._id, system: {worn: {value: false}}})
                }
            }

            if(updates.length)
                 token.actor.updateEmbeddedDocuments("Item", updates)
        }
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
            let max = sameActorTokens.length
            for(let x of sameActorTokens){
                const match = x.name.match(/\d+$/)
                if(match && Number(match[0]) > max)
                    max = Number(match[0])
            }
            name = `${sameActorTokens[0].name.replace(/ \d{1,}$/,'')} ${max + 1}`
        }
        update["name"] = name
    }

    Hooks.on("updateToken", (token, data, options) => {
        Riding.updateTokenHook(token, data, options)
    })

    Hooks.on("deleteToken", (token) => {
        Riding.deleteTokenHook(token)
        TokenHoverHud.hide(token)
    })

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
        randomWeaponSelection(token)
        Riding.createTokenHook(token, options, id)
    })

    Hooks.on('hoverToken', (token, hovered) => {
        if(!game.settings.get("dsa5", "showWeaponsOnHover")) return

        if(hovered) {
            TokenHoverHud.show(token)
        } else {
            TokenHoverHud.hide(token)
        }
    })

}


export class TokenHoverHud {
    static show(token){
        if(!game.combat || canvas.hud?.token?.rendered) return

        const weapons = token.actor.items.filter(x => {
            if(x.type == "meleeweapon" || x.type == "rangeweapon"){
                return x.system.worn.value
            }
            return false
        })

        if(weapons.length){
            const icons = weapons.map(x => `<img src="${x.img}" class="tinyHudIcons" title="${x.name}"/>`).join(" ")

            const elem = $(`<div id="hoverhud_${token.id}" style="position:absolute;">${icons}</div>`)
            $("#hud").append(elem)
            this.position(elem, token, weapons.length)
        }
    }

    static position(elem, token, count){
        const td = token.document;
        const ratio = canvas.dimensions.size / 100;

        const width = count * 43;
        const position = {
          width,
          height: 42,
          left: token.center.x - width / 2 * ratio,
          top: token.y + td.height * canvas.dimensions.size + 32,
        };
        if ( ratio !== 1 ) position.transform = `scale(${ratio})`;

        elem.css(position);
    }

    static hide(token){
       $(`#hoverhud_${token.id}`).remove()
    }
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
                                let max = sameActorTokens.length
                                for(let x of sameActorTokens){
                                    const match = x.name.match(/\d+$/)
                                    if(match && Number(match[0]) > max)
                                        max = Number(match[0])
                                }
                                name = `${sameActorTokens[0].name.replace(/ \d{1,}$/,'')} ${max + 1}`
                            }
                        }
                        const token = canvas.scene.tokens.get(tokenId)
                        await token.update({ name })
                    }
                },
                unknown: {
                    icon: '<i class="fa fa-question"></i>',
                    label: game.i18n.localize("unknown"),
                    callback: async() => {
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