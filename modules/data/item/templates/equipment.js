import { DSADataModel } from "../../abstract.js";
import ScopableStringField from "../fields/scopable_stringfield.js";

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class EquipmentTemplate extends DSADataModel {
    static defineSchema() {
        return {
            price: new SchemaField({
                value: new NumberField({ initial: 0 }),
            }),
            quantity: new SchemaField({
                value: new NumberField({ initial: 1, step: 1 }),
            }),
            weight: new SchemaField({
                value: new NumberField({ initial: 0 }),
            }),
            effect: new SchemaField({
                value: new ScopableStringField({ initial: '', label: 'effect' }),
                attributes: new ScopableStringField({ initial: '' }),
            }),
            parent_id: new StringField({ initial: '' }),
        }
    }
}