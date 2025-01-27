import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';

const { SchemaField, StringField, NumberField, HTMLField } = foundry.data.fields;

export default class AggregatedtestData extends DSADataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      interval: new SchemaField({
        value: new StringField({ initial: '', label: 'interval' }),
      }),
      allowedTestCount: new SchemaField({
        value: new NumberField({ initial: 7, label: 'allowedTestCount' }),
      }),
      usedTestCount: new SchemaField({
        value: new NumberField({ initial: 0, label: 'usedTestCount' }),
      }),
      previousFailedTests: new SchemaField({
        value: new NumberField({ initial: 0, label: 'previousFailedTests' }),
      }),
      talent: new SchemaField({
        value: new StringField({ initial: '', label: 'skill1' }),
        value2: new StringField({ initial: '', label: 'skill2' }),
        value3: new StringField({ initial: '', label: 'skill3' }),
      }),
      cummulatedQS: new SchemaField({
        value: new NumberField({ initial: 0, label: 'cummulatedQS' }),
      }),
      baseModifier: new NumberField({ initial: 0, label: 'Modifier' }),
      partsuccess: new HTMLField({label: 'PartSuccess' }),
      success: new HTMLField({ label: 'Success' }),
    });
  }
}
