import DSA5 from "./config-dsa5.js";
import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class SpecialabilityRulesDSA5 extends ItemRulesDSA5 {

    static async setupFunctions() {
        mergeObject(DSA5.addAbilityRules, {})
        mergeObject(DSA5.removeAbilityRules, {})
        mergeObject(DSA5.AbilitiesNeedingAdaption, {
            "Fertigkeitsspezialisierung ()": { items: ["text"] },
            "Geländekunde ()": { items: ["text"] },
            "Ortskenntnis ()": { items: ["text"] }
        })
    }

    static async abilityAdded(actor, item) {
        if (DSA5.addAbilityRules[item.name]) {
            DSA5.addAbilityRules[item.name](actor, item)
        }
    }
    static async abilityRemoved(actor, item) {
        if (DSA5.removeAbilityRules[item.name]) {
            DSA5.removeAbilityRules[item.name](actor, item)
        }
    }


    static async _specialabilityReturnFunction(actor, item, typeClass, adoption) {
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
            if (vantage.data.step.value + 1 <= vantage.data.maxRank.value && actor.checkEnoughXP(vantage.data.APValue.value)) {
                vantage.data.step.value += 1
                await actor._updateAPs(vantage.data.APValue.value)
                await actor.updateEmbeddedEntity("OwnedItem", vantage);
                await SpecialabilityRulesDSA5.abilityAdded(actor, vantage)
            }
        } else if (actor.checkEnoughXP(item.data.APValue.value)) {
            await SpecialabilityRulesDSA5.abilityAdded(actor, item)
            await actor._updateAPs(item.data.APValue.value)
            await actor.createEmbeddedEntity("OwnedItem", item);
        }
    }

    static async needsAdoption(actor, item, typeClass) {
        if (DSA5.AbilitiesNeedingAdaption[item.name]) {
            let template
            let callback
            if (DSA5.AbilitiesNeedingAdaption[item.name].items == "text") {
                template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-string-dialog.html', { original: item })
                callback = function(dlg) {
                    let adoption = { name: dlg.find('[name="entryselection"]').val() }
                    SpecialabilityRulesDSA5._specialabilityReturnFunction(actor, item, typeClass, adoption)
                }
            } else {
                let items = actor.items.filter(x => DSA5.AbilitiesNeedingAdaption[item.name].items.includes(x.type))
                template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-dialog.html', { items: items, original: item })
                callback = function(dlg) {
                    let adoption = items.find(x => x.name == dlg.find('[name="entryselection"]').val())
                    SpecialabilityRulesDSA5._specialabilityReturnFunction(actor, item, typeClass, adoption)
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
            SpecialabilityRulesDSA5._specialabilityReturnFunction(actor, item, typeClass, null)
        }
    }

    static hasAbility(actor, talent) {
        return super.hasItem(actor, talent, ["specialability"])
    }

    static abilityStep(actor, talent) {
        return super.itemStep(actor, talent, ["specialability"])
    }

    static abilityAsModifier(actor, talent, factor = 1) {
        return super.itemAsModifier(actor, talent, factor, ["specialability"])
    }

    static getTalentBonus(actor, talent) {
        return super.getTalentBonus(actor, talent, ["specialability"])
    }
}