import DSA5 from "./config-dsa5.js";
import DSA5_Utility from "./utility-dsa5.js"

export default class ItemRulesDSA5 {
    static getTalentBonus(actor, talent, types) {
        let modifier = []
        let selected = game.settings.get("dsa5", "talentModifierEnabled")
        for (let k of actor.items.filter(x => { return types.includes(x.type) && x.data.effect.value.includes(talent) })) {
            for (let m of k.data.effect.value.split(";")) {
                if (m.includes(talent)) {
                    let parsed = DSA5_Utility.parseAbilityString(m.trim())
                    if (parsed.name == talent) {
                        modifier.push({
                            name: k.name,
                            value: parsed.step * (k.data.step ? k.data.step.value : 1),
                            type: parsed.type,
                            selected: selected
                        })
                    }
                }
            }
        }
        return modifier
    }

    static reverseAdoptionCalculation(actor, parsed, item) {
        let adoption
        if (DSA5.vantagesNeedingAdaption[parsed.name])
            adoption = actor.items.find(x => DSA5.vantagesNeedingAdaption[parsed.name].items.includes(x.type) && x.name == parsed.special)
        else if (DSA5.AbilitiesNeedingAdaption[parsed.name])
            adoption = actor.items.find(x => DSA5.AbilitiesNeedingAdaption[parsed.name].items.includes(x.type) && x.name == parsed.special)

        if (adoption)
            item.data.APValue.value = item.data.APValue.value.split("/")[adoption.data.data.StF.value.charCodeAt(0) - 65]

        return item
    }

    static hasItem(actor, name, types) {
        return actor.items.find(x => types.includes(x.type) && x.name == name) != undefined
    }

    static itemStep(actor, name, types) {
        let item = actor.items.find(x => types.includes(x.type) && x.name == name)
        if (item) {
            return Number(item.data.data == undefined ? item.data.step.value : item.data.data.step.value)
        } else {
            return 0
        }
    }

    static itemAsModifier(actor, name, factor, types) {
        let res = []
        let item = actor.items.find(x => types.includes(x.type) && x.name == name)
        if (item) {
            res.push({
                name: item.name,
                value: item.data.step.value * factor
            })
        }
        return res
    }
}