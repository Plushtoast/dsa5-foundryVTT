import LiturgyData from './liturgy.js';

const { SchemaField, NumberField } = foundry.data.fields;

export default class CeremonyData extends LiturgyData {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      permanentCost: new SchemaField({
        value: new NumberField({ initial: 0, label: 'permanentCost' }),
      }),
    });
  }
}
