import DSA5_Utility from "../system/utility-dsa5.js";

export default function() {
    Handlebars.registerHelper('concat', function(a, b) {
        return a + b;
    });
    Handlebars.registerHelper('concatUp', function(a, b) {
        return a + b.toUpperCase();
    });
    Handlebars.registerHelper('mod', function(a, b) {
        return a % b;
    });
    Handlebars.registerHelper('roman', function(a) {
        let roman = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX']
        return roman[a - 1]
    });
    Handlebars.registerHelper('join', function(a, b) {
        return b.join(a)
    })
    Handlebars.registerHelper("when", function(operand_1, operator, operand_2, options) {
        let operators = {
            'eq': function(l, r) { return l == r; },
            'noteq': function(l, r) { return l != r; },
            'gt': function(l, r) { return Number(l) > Number(r); },
            'or': function(l, r) { return l || r; },
            'and': function(l, r) { return l && r; },
            '%': function(l, r) { return (l % r) === 0; }
        }
        let result = operators[operator](operand_1, operand_2);

        if (result) return options.fn(this);
        else return options.inverse(this);
    });
    Handlebars.registerHelper("diceThingsUp", function(a) {
        return DSA5_Utility.replaceDies(a)
    })
    Handlebars.registerHelper("replaceConditions", function(a) {
        return DSA5_Utility.replaceConditions(a)
    })
    Handlebars.registerHelper("floor", function(a) {
        return Math.floor(Number(a))
    })
    Handlebars.registerHelper('grouped_each', function(every, context, options) {
        var out = "",
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
    });
}