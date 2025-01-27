import { DSADataModel } from "../../abstract.js";

const { SchemaField, NumberField } = foundry.data.fields;

export default class StructureTemplate extends DSADataModel {
    static defineSchema() {
        return {
            structure: new SchemaField({
                value: new NumberField({ initial: 4 }),
                max: new NumberField({ initial: 4 }),
                breakPointRating: new NumberField({ label: 'WEAR.value' } ),
            })
        }
    }
}