import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';

const { StringField, NumberField } = foundry.data.fields;

export default class DemonmarkData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      circle: new NumberField({ initial: 1, label: 'circle', min: 0 }),
      attribute: new StringField({ initial: '', label: 'attributes' }),
      skills: new StringField({ initial: '', label: 'skills' }),
      domain: new StringField({ initial: '', label: 'domains' }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'attributes', val: data.attribute },
      { key: 'skills', val: data.skills },
      { key: 'domains', val: data.domain },
    ];
  }
}
