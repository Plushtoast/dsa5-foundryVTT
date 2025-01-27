import { DSADataModel } from "../../abstract.js";

const { SchemaField, StringField } = foundry.data.fields;

export default class BasicSpellTemplate extends DSADataModel {
    static defineSchema() {
        return {
            range: new SchemaField({
                value: new StringField({ initial: '', label: 'reach' }),
            }),
            duration: new SchemaField({
                value: new StringField({ initial: '', label: 'duration' }),
            }),
            targetCategory: new SchemaField({
                value: new StringField({ initial: '', label: 'targetCategory' }),
            }),
        }
    }
}