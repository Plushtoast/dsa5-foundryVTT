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
}