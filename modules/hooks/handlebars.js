import DSA5_Utility from "../system/utility-dsa5.js";

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

export default function() {
    Handlebars.registerHelper({
        concatUp: (a, b) => a + b.toUpperCase(),
        mod: (a, b) => a % b,
        roman: (a, max) => {
            if (max != undefined && Number(max) < 2) return ''

            const roman = [' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X']
            return roman[a - 1]
        },
        isWEBM: (a) => /.webm$/.test(a),
        itemCategory: (a) => {
            return DSA5_Utility.categoryLocalization(a)
        },
        joinStr: (a, b) => b.join(a),
        attrName: (a) => DSA5_Utility.attributeLocalization(a),
        attrAbbr: (a) => DSA5_Utility.attributeAbbrLocalization(a),
        diceThingsUp: (a, b) => DSA5_Utility.replaceDies(a, false),
        clickableAbilities: (a, b) => clickableAbilities(a, b),
        hasLocalization: (a, b) => { 
            const val = a.string || a
            return  game.i18n.has(val) ? game.i18n.localize(val) : ( b || "") 
        },
        replaceConditions: DSA5_Utility.replaceConditions,
        floor: (a) => Math.floor(Number(a)),
        br: (a) => a.replace(/\n/g, "<br/>"),
        getAttr: (a, b, c) => { return a.system.characteristics[b][c] },
        hasElem: (a, b) => a.filter(x => b == x).length,
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
        oddLength: (x) => { return (x.length % 2) == 1 }
    })
}