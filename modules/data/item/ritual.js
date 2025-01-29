import SpellData from "./spell.js";

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class RitualData extends SpellData {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
           permanentCost: new SchemaField({
                value: new NumberField({ initial: 0, label: 'permanentCost', min: 0 }),
           }),
           feature: new StringField({ initial: '', label: 'feature' }), 
           reversalis: new StringField({ label: 'LocalizedIDs.reversalis'})
        });
    }
}