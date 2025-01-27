import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';

const { StringField, NumberField } = foundry.data.fields;

export default class DemonmarkData extends DSADataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      circle: new NumberField({ initial: 1, label: 'circle' }),
      attribute: new StringField({ initial: '', label: 'attributes' }),
      skills: new StringField({ initial: '', label: 'skills' }),
      domain: new StringField({ initial: '', label: 'domains' }),
    });
  }
}
