import { DSADataModel } from "../../abstract.js";
import DSA5 from "../../../config/config-dsa5.js";
import DSA5_Utility from "../../../system/helpers/utility-dsa5.js";

const { SchemaField, StringField } = foundry.data.fields;


export default class SkillTemplate extends DSADataModel {
    static defineSchema() {
        return {
            StF: new SchemaField({
                value: new StringField({ initial: 'A', label: 'StF', required: true, choices: DSA5.StFs }),
            })
        }
    }

    advanceCost() {
        return DSA5_Utility._calculateAdvCost(this.talentValue.value, this.advanceCategory)
    }

    refundCost() {
        return DSA5_Utility._calculateAdvCost(this.talentValue.value, this.advanceCategory, 0)
    }

    get advanceCategory() {
        return this.actor.system.isPet ? 'C' : this.StF.value;
    }
}