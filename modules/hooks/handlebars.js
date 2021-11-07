import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Handlebars.registerHelper({
        concat: (a, b) => a + b,
        concatUp: (a, b) => a + b.toUpperCase(),
        mod: (a, b) => a % b,
        roman: (a, max) => {
            if (max != undefined && Number(max) < 2) return ''

            const roman = [' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX']
            return roman[a - 1]
        },
        isWEBM: (a) => /.webm$/.test(a),
        joinStr: (a, b) => b.join(a),
        diceThingsUp: DSA5_Utility.replaceDies,
        replaceConditions: DSA5_Utility.replaceConditions,
        floor: (a) => Math.floor(Number(a)),
        hasElem: (a, b) => a.includes(b),
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
        }
    })
}