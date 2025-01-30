import APValueTemplate from './templates/apvalue.js';
import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';

const { NumberField, StringField } = foundry.data.fields;

export default class MagicalsignData extends ItemDataModel.mixin(DescriptionTemplate, APValueTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      asp: new NumberField({ initial: 0, label: 'AsPCost', min: 0 }),
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

  static chatData(data, name) {
    let res = [{ key: 'AsPCost', val: data.asp }];
    if (data.category == 2) res.push({ key: 'feature', val: data.feature });

    return res;
  }
}
