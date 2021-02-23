import DSA5 from "./config-dsa5.js";
import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class SpecialabilityRulesDSA5 extends ItemRulesDSA5 {

    static setupFunctions() {

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
        let xpCost = item.data.APValue.value * item.data.step.value
        if (/;/.test(item.data.APValue.value)) {
            let steps = item.data.APValue.value.split(";").map(x => Number(x.trim()))
            xpCost = 0
            for (let i = 0; i < item.data.step.value; i++)
                xpCost += steps[i]
        }
        xpCost = await SpecialabilityRulesDSA5.refundFreelanguage(item, actor, xpCost)
        await actor._updateAPs(-1 * xpCost)
    }


    static async _specialabilityReturnFunction(actor, item, typeClass, adoption) {
        if (item == null)
            return
        item = duplicate(item)



        if (adoption != null) {

            //Different Apval for multiple same vantages
            if (/,/.test(item.data.APValue.value)) {
                let name = `${item.name.replace(' ()', '')} (${adoption.name}`
                item.data.APValue.value = item.data.APValue.value.split(",")[actor.items.filter(x => x.type == item.type && x.name.includes(name)).length].trim()
            }

            if (DSA5.AbilitiesNeedingAdaption[item.name].effect) {
                item.data.effect.value = `${adoption.name} ${DSA5.AbilitiesNeedingAdaption[item.name].effect}`
            }
            item.name = `${item.name.replace(' ()', '')} (${adoption.name}${adoption.customEntry ? ", " + adoption.customEntry : ''})`
            if (adoption.data)
                item.data.APValue.value = item.data.APValue.value.split("/")[adoption.data.data.StF.value.charCodeAt(0) - 65].trim()
        }
        let res = actor.data.items.find(i => {
            return i.type == typeClass && i.name == item.name
        });

        if (res) {
            let vantage = duplicate(res)
            let xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(item, actor, /;/.test(vantage.data.APValue.value) ? vantage.data.APValue.value.split(';').map(x => Number(x.trim()))[vantage.data.step.value] : vantage.data.APValue.value)
            if (vantage.data.step.value + 1 <= vantage.data.maxRank.value && await actor.checkEnoughXP(xpCost)) {
                vantage.data.step.value += 1
                await actor._updateAPs(xpCost)
                await actor.updateEmbeddedEntity("OwnedItem", vantage);
                await SpecialabilityRulesDSA5.abilityAdded(actor, vantage)
            }
        } else {
            let xpCost = await SpecialabilityRulesDSA5.isFreeLanguage(item, actor, item.data.APValue.value.split(';').map(x => x.trim())[0])
            if (await actor.checkEnoughXP(xpCost)) {
                await SpecialabilityRulesDSA5.abilityAdded(actor, item)
                await actor._updateAPs(xpCost)
                await actor.createEmbeddedEntity("OwnedItem", item);
            }
        }
    }

    static async refundFreelanguage(item, actor, xpCost) {
        if (item.data.category.value == "language" && actor.data.data.freeLanguagePoints) {
            let freePoints = Number(actor.data.data.freeLanguagePoints.value)
            let languageCost = actor.data.items.filter(x => x.type == "specialability" && x.data.category.value == "language").reduce((a, b) => { return a + Number(b.data.step.value) * Number(b.data.APValue.value) }, 0)
            let usedPoints = Math.min(freePoints, languageCost - Number(xpCost))
            let remainingFreepoints = Math.max(0, freePoints - usedPoints)
            await actor.update({ "data.freeLanguagePoints.used": Math.min(freePoints, Number(usedPoints)) })
            xpCost = Math.max(0, xpCost - remainingFreepoints)
        }
        return xpCost
    }

    static async isFreeLanguage(item, actor, xpCost) {
        if (item.data.category.value == "language" && actor.data.data.freeLanguagePoints) {
            let freePoints = Number(actor.data.data.freeLanguagePoints.value)
            let languageCost = actor.data.items.filter(x => x.type == "specialability" && x.data.category.value == "language").reduce((a, b) => { return a + Number(b.data.step.value) * Number(b.data.APValue.value) }, 0)
            let usedPoints = Math.min(freePoints, languageCost)
            let remainingFreepoints = Math.max(0, freePoints - usedPoints)
            await actor.update({ "data.freeLanguagePoints.used": Math.min(freePoints, Number(usedPoints) + Number(xpCost)) })
            xpCost = Math.max(0, xpCost - remainingFreepoints)
        }
        return xpCost
    }

    static async needsAdoption(actor, item, typeClass) {
        let rule = DSA5.AbilitiesNeedingAdaption[item.name]
        if (rule) {
            let template
            let callback
            if (rule.items == "text") {
                template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-string-dialog.html', { original: item })
                callback = function(dlg) {
                    let adoption = { name: dlg.find('[name="entryselection"]').val() }
                    SpecialabilityRulesDSA5._specialabilityReturnFunction(actor, item, typeClass, adoption)
                }
            } else {
                let items = actor.items.filter(x => rule.items.includes(x.type))
                template = await renderTemplate('systems/dsa5/templates/dialog/requires-adoption-dialog.html', { items: items, original: item, area: rule.area })
                callback = function(dlg) {
                    let adoption = items.find(x => x.name == dlg.find('[name="entryselection"]').val())
                    adoption.customEntry = dlg.find('[name="custom"]').val()
                    SpecialabilityRulesDSA5._specialabilityReturnFunction(actor, item, typeClass, adoption)
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

}