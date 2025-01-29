import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';

const { NumberField, StringField } = foundry.data.fields;

export default class PatronData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      talents: new StringField({ initial: '', label: 'skills' }),
      culture: new StringField({ initial: '', label: 'TYPES.Item.culture' }),
      category: new NumberField({
        initial: 0,
        label: 'Category',
        required: true,
        choices: {
          0: 'PATRON.0',
          1: 'PATRON.1',
          2: 'PATRON.2',
          3: 'PATRON.3',
        },
      }),
      priority: new NumberField({
        initial: 0,
        label: 'PATRON.priority',
        required: true,
        choices: {
          0: 'PATRON.primary',
          1: 'PATRON.secondary',
        },
      }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'skills', val: data.talents },
      { key: 'culture', val: data.culture },
      { key: 'Category', val: `PATRON.${data.category}`, localizeVal: true },
    ];
  }
}
