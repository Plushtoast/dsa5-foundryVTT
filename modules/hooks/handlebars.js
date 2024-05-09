import DSA5 from "../system/config-dsa5.js";
import DSA5_Utility from "../system/utility-dsa5.js";
const { getProperty } = foundry.utils

const modifierTypes = {
    "": "Modifier",
    "defenseMalus": "MODS.defenseMalus",
    "FW": "MODS.FW",
    "KaPCost": "CHAR.KaPCost",
    "AsPCost": "CHAR.AsPCost",
    "FP": "MODS.FP",
    "QL": "MODS.QS",
    "dmg": "MODS.damage",
    "damageBonus": "MODS.damage",
    "armorPen": "MODS.armorPen",
    "TPM": "MODS.partChecks"
}

function clickableAbilities(a, b){
    return `<span class=\"searchableAbility\" data-category="${b}">` + a.split(",").map(x => {
        return `<a>${x}</a>`
    }).join(", ") + "<span>"
}

function clickableActorItems(actor, list, rankPath, maxPath) {
    if(maxPath) {
        return list.map(item => {
            return `<span class="actorEmbeddedAbility" data-actor="${actor.uuid}" data-id="${item._id}"><a>${item.name}${roman(getProperty(item.system, rankPath), getProperty(item.system, maxPath))}</a></span>`
        }).join(", ")
    } else if(rankPath) {
        const res = []
        for(let item of list){
            const level = getProperty(item.system, rankPath)
            if(level) {
                res.push(`<span class="actorEmbeddedAbility" data-actor="${actor.uuid}" data-id="${item._id}"><a>${item.name} ${level}</a></span>`)
                continue
            }
        }
        return res.join(", ")
    } else {
        return list.map(item => {
            return `<span class="actorEmbeddedAbility" data-actor="${actor.uuid}" data-id="${item._id}"><a>${item.name}</a></span>`
        }).join(", ")
    }
}

function clickableSection(actor, section, rankPath, maxPath) {
    const res = []
    for(const list of Object.values(section)){
        if(list.length == 0) continue

        const items = clickableActorItems(actor, list, rankPath, maxPath)
        if(items) res.push(items)
    }
    return res.join(", ")
}

function roman(a, max) {
    if (max != undefined && Number(max) < 2) return ''

    const roman = [' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X']
    return roman[a - 1]
}


export default function() {
    Handlebars.registerHelper({
        concatUp: (a, b) => a + b.toUpperCase(),
        mod: (a, b) => a % b,
        roman: (a, max) => roman(a, max),
        isWEBM: (a) => /.webm$/.test(a),
        itemCategory: (a) => {
            return DSA5_Utility.categoryLocalization(a)
        },
        joinStr: (a, b) => b.join(a),
        attrName: (a) => DSA5_Utility.attributeLocalization(a),
        attrAbbr: (a) => DSA5_Utility.attributeAbbrLocalization(a),
        diceThingsUp: (a, b) => DSA5_Utility.replaceDies(a, false),
        clickableAbilities: (a, b) => clickableAbilities(a, b),
        traitName: (a) => game.i18n.localize(DSA5.traitCategories[a]),
        consumableQL: (a) => a.system.QLList.split("\n")[Number(a.system.QL) - 1],
        clickableActorItems: (a, b, c, d) => clickableActorItems(a, b, c, d),
        clickableSection: (a, b, c, d) => clickableSection(a, b, c, d),
        hasLocalization: (a, b) => {
            const val = a.string || a
            return  game.i18n.has(val) ? game.i18n.localize(val) : ( b || "")
        },
        successEffect: (a) => {
            const sucEf = getProperty(a, "flags.dsa5.successEffect")
            if(sucEf == 2) return ` (${game.i18n.localize("ActiveEffects.onSuccess")})`
            if(sucEf == 1) return ` (${game.i18n.localize("ActiveEffects.onFailure")})`
            return ""
        },
        replaceConditions: DSA5_Utility.replaceConditions,
        floor: (a) => Math.floor(Number(a)),
        sum: (a, b) => {
            return a + b
        },
        br: (a) => a.replace(/\n/g, "<br/>"),
        getAttr: (a, b, c) => { return a.system.characteristics[b][c] },
        hasElem: (a, b) => a.some(x => b == x),
        situationalTooltip: (mod) => {
            const key = game.i18n.localize(modifierTypes[mod.type] || "Modifier")
            let res = `${mod.name}<br/>${key}: ${mod.value}`
            if(mod.source){
                res += `<br/>${game.i18n.localize('source')}: ${mod.source}`
            }
            return res
        },
        grouped_each: (every, context, options) => {
            let out = "",
                subcontext = [],
                i;
            if (context && context.length > 0) {
                for (i = 0; i < context.length; i++) {
                    if (i > 0 && i % every === 0) {
                        out += options.fn(subcontext);
                        subcontext = [];
                    }
                    subcontext.push(context[i]);
                }
                out += options.fn(subcontext);
            }
            return out;
        },
        plantify: (a) => { return game.i18n.localize(`PLANT.avLevels.${a || 0}`) },
        oddLength: (x) => { return (x.length % 2) == 1 },
        //Deprecated by foundry
        select: (selected, options) => {
            const escapedValue = RegExp.escape(Handlebars.escapeExpression(selected));
            const rgx = new RegExp(` value=[\"']${escapedValue}[\"\']`);
            const html = options.fn(options.data.root);
            return html.replace(rgx, "$& selected");
        }
    })
}