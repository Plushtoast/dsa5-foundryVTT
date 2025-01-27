import APValueTemplate from './templates/apvalue.js';
import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';

const { NumberField, StringField } = foundry.data.fields;

export default class MagicalsignData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      asp: new NumberField({ initial: 0, label: 'AsPCost' }),
      feature: new StringField({ initial: '', label: 'feature' }),
      category: new NumberField({
        initial: 1,
        label: 'Category',
        required: true,
        choices: {
          1: 'TYPES.Item.magicalsign',
          2: 'additionalsign',
        },
      }),
    });
  }
}
