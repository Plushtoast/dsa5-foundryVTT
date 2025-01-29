import APValueTemplate from './templates/apvalue.js';
import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';

const { NumberField, StringField } = foundry.data.fields;

export default class SpellextensionData extends ItemDataModel.mixin(DescriptionTemplate, APValueTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      talentValue: new NumberField({ initial: 0, label: 'requiredFW', min: 0 }),
      effect: new StringField({ initial: '' }), // this might be deprecated
      source: new StringField({ initial: '' }),
      category: new StringField({
        initial: 'spell',
        required: true,
        label: 'Category',
        choices: {
          spell: 'TYPES.Item.spell',
          liturgy: 'TYPES.Item.liturgy',
          ritual: 'TYPES.Item.ritual',
          ceremony: 'TYPES.Item.ceremony',
        },
      }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'source', val: data.source },
      { key: 'Category', val: data.category, localizeVal: true },
    ];
  }
}
