import DSA5 from "./config-dsa5.js";
import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class AdvantageRulesDSA5 extends ItemRulesDSA5 {
    static async setupFunctions() {

    }
    static async vantageAdded(actor, item) {
        if (DSA5.addvantageRules[item.name]) {
            DSA5.addvantageRules[item.name](actor, item)
        }
    }
    static async vantageRemoved(actor, item) {
        if (DSA5.removevantageRules[item.name]) {
            DSA5.removevantageRules[item.name](actor, item)
        }
    }

    static async _vantageReturnFunction(actor, item, typeClass, adoption) {
        if (item == null)
            return
        item = duplicate(item)
        if (adoption != null) {
            item.name = `${item.name.replace(' ()', '')} (${adoption.name})`
            if (adoption.data)
                item.data.APValue.value = item.data.APValue.value.split("/")[adoption.data.data.StF.value.charCodeAt(0) - 65]
        }
        let res = actor.data.items.find(i => {
            return i.type == typeClass && i.name == item.name
        });
        if (res) {
            let vantage = duplicate(res)
            if (vantage.data.step.value + 1 <= vantage.data.max.value && actor.checkEnoughXP(vantage.data.APValue.value)) {
                vantage.data.step.value += 1
                await actor._updateAPs(vantage.data.APValue.value)
                await actor.updateEmbeddedEntity("OwnedItem", vantage);
                await AdvantageRulesDSA5.vantageAdded(actor, vantage)
            }
        } else if (actor.checkEnoughXP(item.data.APValue.value)) {
            await AdvantageRulesDSA5.vantageAdded(actor, item)
            await actor._updateAPs(item.data.APValue.value)
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
                title: game.i18n.localize("ItemRequiresAdoption"),
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

    static getTalentBonus(actor, talent) {
        return super.getTalentBonus(actor, talent, ["advantage", "disadvantage"])
    }
}