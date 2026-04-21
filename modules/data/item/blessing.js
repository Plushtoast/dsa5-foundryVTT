import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import BasicSpellTemplate from './templates/basicspell.js';

const { SchemaField, StringField } = foundry.data.fields;

export default class BlessingData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      feature: new SchemaField({
        value: new StringField({ initial: '', label: 'feature' }),
        }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'duration', val: data.duration.value },
      { key: 'targetCategory', val: data.targetCategory.value },
      { key: 'feature', val: data.feature.value },
    ];
  }
}
