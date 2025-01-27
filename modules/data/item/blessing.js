import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import BasicSpellTemplate from './templates/basicspell.js';

const { SchemaField, StringField } = foundry.data.fields;

export default class BlessingData extends DSADataModel.mixin(DescriptionTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      feature: new SchemaField({
        value: new StringField({ initial: '', label: 'feature' }),
        }),
    });
  }
}
