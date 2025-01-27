import { DSADataModel } from "../../abstract.js";

const { SchemaField, StringField } = foundry.data.fields;

export default class DescriptionTemplate extends DSADataModel {
    static defineSchema() {
        return {
            description: new SchemaField({
                value: new StringField({ initial: '' }),
            }),
            gmdescription: new SchemaField({
                value: new StringField({ initial: '' }),
            })
        }
    }
}