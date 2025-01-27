import APValueTemplate from './templates/apvalue.js';
import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';

const { NumberField, StringField } = foundry.data.fields;

export default class SpellextensionData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      talentValue: new NumberField({ initial: 0, label: 'requiredFW' }),
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
}
