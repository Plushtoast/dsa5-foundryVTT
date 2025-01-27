import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import APValueTemplate from './templates/apvalue.js';
import MaxTemplate from './templates/max.js';
import RequirementsTemplate from './templates/requirements.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class DisadvantageData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate, MaxTemplate, RequirementsTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      step: new SchemaField({
        value: new NumberField({ initial: 1 }),
      }),
      effect: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
      }),
    });
  }
}
