import { DSADataModel } from "../../abstract.js";

const { SchemaField, NumberField } = foundry.data.fields;

export default class EncumbranceTemplate extends DSADataModel {
    static defineSchema() {
        return {
            encumbrance: new SchemaField({
                value: new NumberField({ initial: 0, label: 'encumbrance' }),
            })
        }
    }
}