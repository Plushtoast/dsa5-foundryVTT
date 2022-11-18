import DSA5_Utility from "../system/utility-dsa5.js";

const modifierTypes = {
    "": "Modifier",
    "defenseMalus": "MODS.defenseMalus",
    "FW": "MODS.FW",
    "KaPCost": "CHAR.AsPCost",
    "AsPCost": "CHAR.KapCost",
    "FP": "MODS.FP",
    "QL": "MODS.QS",
    "dmg": "MODS.damage",
    "damageBonus": "MODS.damage",
    "armorPen": "MODS.armorPen",
    "TPM": "MODS.partChecks"
}

export default function() {
    Handlebars.registerHelper({
        //DSA concat conflict with v9 concat helper
        concat: (...values) => { return HandlebarsHelpers.concat(...values).string },
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
        diceThingsUp: (a, b) => DSA5_Utility.replaceDies(a, false),
        replaceConditions: DSA5_Utility.replaceConditions,
        floor: (a) => Math.floor(Number(a)),
        hasElem: (a, b) => a.includes(b),
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
        plantify: (a) => { return game.i18n.localize(`PLANT.avLevels.${a || 0}`) }
    })
}