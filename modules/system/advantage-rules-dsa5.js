import DSA5 from "./config-dsa5.js";
import ItemRulesDSA5 from "./item-rules-dsa5.js";

export default class AdvantageRulesDSA5 extends ItemRulesDSA5 {
    static async setupFunctions() {
        mergeObject(DSA5.addvantageRules, {
            Geweihter: async function(actor, item) { await actor.update({ "data.status.karmaenergy.initial": actor.data.data.status.karmaenergy.initial + 20 }); },
            Flink: async function(actor, item) { await actor.update({ "data.status.speed.initial": actor.data.data.status.speed.initial + 1 }); },
            Zauberer: async function(actor, item) { await actor.update({ "data.status.astralenergy.initial": actor.data.data.status.astralenergy.initial + 20 }); },
            Glück: async function(actor, item) { await actor.update({ "data.status.fatePoints.current": 3 + item.data.step.value }); },
            "Hohe Astralkraft": async function(actor, item) { await actor.update({ "data.status.astralenergy.initial": actor.data.data.status.astralenergy.initial + 1 }); },
            "Hohe Karmalkraft": async function(actor, item) { await actor.update({ "data.status.karmaenergy.initial": actor.data.data.status.karmaenergy.initial + 1 }); },
            "Hohe Lebenskraft": async function(actor, item) { await actor.update({ "data.status.wounds.initial": actor.data.data.status.wounds.initial + 1 }); },
            "Hohe Seelenkraft": async function(actor, item) { await actor.update({ "data.status.soulpower.initial": actor.data.data.status.soulpower.initial + 1 }); },
            "Hohe Zähigkeit": async function(actor, item) { await actor.update({ "data.status.toughness.initial": actor.data.data.status.toughness.initial + 1 }); },
            "Hohe Reich": async function(actor, item) {
                let money = duplicate(actor.items.find(x => x.type == "money" && x.name == "Money-S"))
                money.data.quantity.value += 250
                await actor.updateEmbeddedEntity("OwnedItem", money)
            },
            "Arm": async function(actor, item) {
                let money = duplicate(actor.items.find(x => x.type == "money" && x.name == "Money-S"))
                money.data.quantity.value -= 250
                await actor.updateEmbeddedEntity("OwnedItem", money)
            },
            "Behäbig": async function(actor, item) { await actor.update({ "data.status.speed.initial": actor.data.data.status.speed.initial - 1 }); },
            "Niedrige Astralkraft": async function(actor, item) { await actor.update({ "data.status.astralenergy.initial": actor.data.data.status.astralenergy.initial - 1 }); },
            "Niedrige Karmalkraft": async function(actor, item) { await actor.update({ "data.status.karmaenergy.initial": actor.data.data.status.karmaenergy.initial - 1 }); },
            "Niedrige Lebenskraft": async function(actor, item) { await actor.update({ "data.status.wounds.initial": actor.data.data.status.wounds.initial - 1 }); },
            "Niedrige Seelenkraft": async function(actor, item) { await actor.update({ "data.status.soulpower.initial": actor.data.data.status.soulpower.initial - 1 }); },
            "Niedrige Zähigkeit": async function(actor, item) { await actor.update({ "data.status.toughness.initial": actor.data.data.status.toughness.initial - 1 }); },
            Pech: async function(actor, item) { await actor.update({ "data.status.fatePoints.current": 3 - item.data.step.value }); },
        })
        mergeObject(DSA5.removevantageRules, {
            Geweihter: async function(actor, item) { await actor.update({ "data.status.karmaenergy.initial": actor.data.data.status.karmaenergy.initial - 20 }); },
            Flink: async function(actor, item) { await actor.update({ "data.status.speed.initial": actor.data.data.status.speed.initial - 1 }); },
            Zauberer: async function(actor, item) { await actor.update({ "data.status.astralenergy.initial": actor.data.data.status.astralenergy.initial - 20 }); },
            Glück: async function(actor, item) { await actor.update({ "data.status.fatePoints.current": 3 }); },
            "Hohe Astralkraft": async function(actor, item) { await actor.update({ "data.status.astralenergy.initial": actor.data.data.status.astralenergy.initial - item.data.step.value }); },
            "Hohe Karmalkraft": async function(actor, item) { await actor.update({ "data.status.karmaenergy.initial": actor.data.data.status.karmaenergy.initial - item.data.step.value }); },
            "Hohe Lebenskraft": async function(actor, item) { await actor.update({ "data.status.wounds.initial": actor.data.data.status.wounds.initial - item.data.step.value }); },
            "Hohe Seelenkraft": async function(actor, item) { await actor.update({ "data.status.soulpower.initial": actor.data.data.status.soulpower.initial - item.data.step.value }); },
            "Hohe Zähigkeit": async function(actor, item) { await actor.update({ "data.status.toughness.initial": actor.data.data.status.toughness.initial - item.data.step.value }); },
            "Hohe Reich": async function(actor, item) {
                let money = duplicate(actor.items.find(x => x.type == "money" && x.name == "Money-S"))
                money.data.quantity.value -= item.data.step.value * 250
                await actor.updateEmbeddedEntity("OwnedItem", money)
            },
            "Arm": async function(actor, item) {
                let money = duplicate(actor.items.find(x => x.type == "money" && x.name == "Money-S"))
                money.data.quantity.value += item.data.step.value * 250
                await actor.updateEmbeddedEntity("OwnedItem", money)
            },
            "Behäbig": async function(actor, item) { await actor.update({ "data.status.speed.initial": actor.data.data.status.speed.initial + 1 }); },
            "Niedrige Astralkraft": async function(actor, item) { await actor.update({ "data.status.astralenergy.initial": actor.data.data.status.astralenergy.initial + item.data.step.value }); },
            "Niedrige Karmalkraft": async function(actor, item) { await actor.update({ "data.status.karmaenergy.initial": actor.data.data.status.karmaenergy.initial + item.data.step.value }); },
            "Niedrige Lebenskraft": async function(actor, item) { await actor.update({ "data.status.wounds.initial": actor.data.data.status.wounds.initial + item.data.step.value }); },
            "Niedrige Seelenkraft": async function(actor, item) { await actor.update({ "data.status.soulpower.initial": actor.data.data.status.soulpower.initial + item.data.step.value }); },
            "Niedrige Zähigkeit": async function(actor, item) { await actor.update({ "data.status.toughness.initial": actor.data.data.status.toughness.initial + item.data.step.value }); },
            Pech: async function(actor, item) { await actor.update({ "data.status.fatePoints.current": 3 }); },
        })
        mergeObject(DSA5.vantagesNeedingAdaption, {
            "Unfähig ()": { items: ["skill"] },
            "Begabung ()": { items: ["skill"] },
            "Herausragende Fertigkeit ()": { items: ["skill", "liturgy", "spell", "ritual", "ceremony"] },
            "Herausragende Kampftechnik ()": { items: ["combatskill"] },
            "Waffenbegabung ()": { items: ["combatskill"] },
            "Begabung ()": { items: ["skill"] },
            "Verpflichtungen ()": { items: "text" },
            "Angst vor ()": { items: "text" },
            "Artefaktgebunden ()": { items: "text" },
            "Magische Einstimmung ()": { items: "text" }
        })
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
            if (vantage.data.step.value + 1 <= vantage.data.max.value) {
                vantage.data.step.value += 1
                await actor._updateAPs(vantage.data.APValue.value)
                await actor.updateEmbeddedEntity("OwnedItem", vantage);
                await AdvantageRulesDSA5.vantageAdded(actor, vantage)
            }
        } else {
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