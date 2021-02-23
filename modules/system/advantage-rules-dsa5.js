import DSA5 from "./config-dsa5.js";
import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class AdvantageRulesDSA5 extends ItemRulesDSA5 {
    static setupFunctions() {}
    static async vantageAdded(actor, item) {
        if (game.dsa5.config.addvantageRules[item.name])
            game.dsa5.config.addvantageRules[item.name](actor, item)
    }
    static async vantageRemoved(actor, item) {
        if (game.dsa5.config.removevantageRules[item.name])
            game.dsa5.config.removevantageRules[item.name](actor, item)
    }


    /** APValue formatting: / for Stf steps starting with A         */
    /** APValue formatting: , for first, second .. variant of element  */
    /** APValue formatting: ; for first second .. step */
    /**  */

    static async _vantageReturnFunction(actor, item, typeClass, adoption) {
        if (item == null)
            return
        item = duplicate(item)

        //Different Apval for multiple same vantages
        if (/,/.test(item.data.APValue.value)) {
            let name = item.name.replace(' ()', '')
            item.data.APValue.value = item.data.APValue.value.split(",")[actor.items.filter(x => x.type == item.type && x.name.includes(name)).length].trim()
        }

        if (adoption != null) {
            if (DSA5.vantagesNeedingAdaption[item.name].effect) {
                item.data.effect.value = `${adoption.name} ${DSA5.vantagesNeedingAdaption[item.name].effect}`
            }
            item.name = `${item.name.replace(' ()', '')} (${adoption.name})`
            if (adoption.data)
                item.data.APValue.value = item.data.APValue.value.split("/")[adoption.data.data.StF.value.charCodeAt(0) - 65].trim()
        }
        let res = actor.data.items.find(i => {
            return i.type == typeClass && i.name == item.name
        });
        if (res) {
            let vantage = duplicate(res)
            let xpCost = /;/.test(vantage.data.APValue.value) ? vantage.data.APValue.value.split(';').map(x => Number(x.trim()))[vantage.data.step.value] : vantage.data.APValue.value

            if (vantage.data.step.value + 1 <= vantage.data.max.value && await actor.checkEnoughXP(xpCost)) {
                vantage.data.step.value += 1
                await actor._updateAPs(xpCost)
                await actor.updateEmbeddedEntity("OwnedItem", vantage);
                await AdvantageRulesDSA5.vantageAdded(actor, vantage)
            }
        } else if (await actor.checkEnoughXP(item.data.APValue.value.split(';').map(x => x.trim())[0])) {
            await AdvantageRulesDSA5.vantageAdded(actor, item)
            await actor._updateAPs(item.data.APValue.value.split(';').map(x => x.trim())[0])
            await actor.createEmbeddedEntity("OwnedItem", item);
        }
    }

    static async needsAdoption(actor, item, typeClass) {
        if (DSA5.vantagesNeedingAdaption[item.name]) {
            let template
            let callback
            if (DSA5.vantagesNeedingAdaption[item.name].items == "text") {
                template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-string-dialog.html', { original: item })
                callback = function(dlg) {
                    let adoption = { name: dlg.find('[name="entryselection"]').val() }
                    AdvantageRulesDSA5._vantageReturnFunction(actor, item, typeClass, adoption)
                }
            } else {
                let items = actor.items.filter(x => DSA5.vantagesNeedingAdaption[item.name].items.includes(x.type))
                template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-dialog.html', { items: items, original: item })
                callback = function(dlg) {
                    let adoption = items.find(x => x.name == dlg.find('[name="entryselection"]').val())
                    AdvantageRulesDSA5._vantageReturnFunction(actor, item, typeClass, adoption)
                }
            }
            await new Dialog({
                title: game.i18n.localize("DIALOG.ItemRequiresAdoption"),
                content: template,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: callback
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    },
                },
                default: 'Yes'
            }).render(true)
        } else {
            AdvantageRulesDSA5._vantageReturnFunction(actor, item, typeClass, null)
        }
    }

    static hasVantage(actor, talent) {
        return super.hasItem(actor, talent, ["advantage", "disadvantage"])
    }

    static vantageStep(actor, talent) {
        return super.itemStep(actor, talent, ["advantage", "disadvantage"])
    }

    static getVantageAsModifier(actor, talent, factor = 1) {
        return super.itemAsModifier(actor, talent, factor, ["advantage", "disadvantage"])
    }
}