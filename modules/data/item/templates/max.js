import { DSADataModel } from "../../abstract.js";

const { SchemaField, NumberField } = foundry.data.fields;

export default class MaxTemplate extends DSADataModel {
    static defineSchema() {
        return {
            max: new SchemaField({
                value: new NumberField({ initial: 0, label: 'maxlevel', min: 0 }),
            })
        }
    }
}