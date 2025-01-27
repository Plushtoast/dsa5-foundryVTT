import { DSADataModel } from "../../abstract.js";

const { SchemaField, StringField } = foundry.data.fields;

export default class APValueTemplate extends DSADataModel {
    static defineSchema() {
        return {
            APValue: new SchemaField({
                value: new StringField({ initial: '0', label: 'APValue' }),
            })
        }
    }
}