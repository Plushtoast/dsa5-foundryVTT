import DSA5 from "./config-dsa5.js";
import DSA5_Utility from "./utility-dsa5.js"

export default class ItemRulesDSA5 {
    static children = {}

    static getTalentBonus(actor, talent, types) {
        let modifier = []
        let selected = game.settings.get("dsa5", "talentModifierEnabled")
        for (let k of actor.items.filter(x => { return types.includes(x.type) && x.data.data.effect.value.includes(talent) })) {
            for (let m of k.data.data.effect.value.split(/;|,/)) {
                if (m.includes(talent)) {
                    let parsed = DSA5_Utility.parseAbilityString(m.trim())
                    if (parsed.name == talent) {
                        modifier.push({
                            name: k.name,
                            value: parsed.step * (k.data.data.step ? k.data.data.step.value : 1),
                            type: parsed.type,
                            selected: selected
                        })
                    }
                }
            }
        }
        return modifier
    }


    static simpleAdoption(item, adoption, name, source) {
        if (source[name].effect) {
            item.data.effect.value = `${adoption.name} ${source[name].effect}`
        }
        if (source[name].activeEffect) {
            const change = duplicate(source[name].activeEffect)
            change.value = `${adoption.name} ${change.value}`
            const activeEffect = {
                "changes": [change],
                "duration": {},
                "icon": "icons/svg/aura.svg",
                "label": `${name} (${adoption.name})`,
                "transfer": true,
                "flags": {
                    "dsa5": {
                        "value": null,
                        "editable": true,
                        "description": `${name} (${adoption.name})`,
                        "custom": true,
                        "auto": null,
                        "manual": 0,
                        "hideOnToken": true,
                        "hidePlayers": false
                    }
                },
                "tint": ""
            }
            item.effects.push(activeEffect)
        }
    }

    static reverseAdoptionCalculation(actor, parsed, item) {
        const elems = [DSA5.vantagesNeedingAdaption, DSA5.AbilitiesNeedingAdaption]
        for (let elem of elems) {
            if (elem[parsed.name]) {
                let adoption = actor.items.find(x => elem[parsed.name].items.includes(x.type) && x.name == parsed.special)
                if (adoption) {
                    item.data.APValue.value = item.data.APValue.value.split("/")[adoption.data.data.StF.value.charCodeAt(0) - 65]
                    ItemRulesDSA5.simpleAdoption(item, adoption, parsed.name, elem)
                }
                break
            }
        }
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

    static itemAsModifier(actor, name, factor, types, startsWith = false, selected = false) {
            let res = []
            const regex = startsWith ? new RegExp(`^${DSA5_Utility.escapeRegex(`${name} (`)}`) : new RegExp(`^${DSA5_Utility.escapeRegex(name)}$`)
        const item = actor.items.find(x => types.includes(x.type) && regex.test(x.name))
        if (item) {
            res.push({
                name: item.name,
                value: Number(item.data.data == undefined ? item.data.step.value : item.data.data.step.value) * factor,
                selected
            })
        }
        return res
    }
}