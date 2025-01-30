import { DSADataModel } from "../../abstract.js";
import DSA5 from "../../../system/config-dsa5.js";
import DSA5_Utility from "../../../system/utility-dsa5.js";

const { SchemaField, StringField } = foundry.data.fields;


export default class SkillTemplate extends DSADataModel {
    static defineSchema() {
        return {
            StF: new SchemaField({
                value: new StringField({ initial: 'A', label: 'StF', required: true, choices: DSA5.StFs }),
            })
        }
    }

    static _perpareItemAdvancementCost(item, actor) {
        const category = actor.system.isPet || actor.system.isFamiliar ? 'C' : item.system.StF.value;
        item.cost = game.i18n.format('advancementCost', {
            cost: DSA5_Utility._calculateAdvCost(item.system.talentValue.value, category),
        });
        item.refund = game.i18n.format('refundCost', {
            cost: DSA5_Utility._calculateAdvCost(item.system.talentValue.value, category, 0),
        });
        return item;
    }
}