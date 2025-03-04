import { DSADataModel } from "../../abstract.js";

const { SchemaField, HTMLField } = foundry.data.fields;

export default class DescriptionTemplate extends DSADataModel {
    static defineSchema() {
        return {
            description: new SchemaField({
                value: new HTMLField({ initial: '' }),
            }),
            gmdescription: new SchemaField({
                value: new HTMLField({ initial: '' }),
            })
        }
    }
}