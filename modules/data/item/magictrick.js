import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';
import BasicSpellTemplate from './templates/basicspell.js';

const { SchemaField, StringField } = foundry.data.fields;

export default class MagictrickData extends ItemDataModel.mixin(DescriptionTemplate, BasicSpellTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      feature: new SchemaField({
        value: new StringField({ initial: '', label: 'feature' }),
      }),
      distribution: new StringField({ initial: '', label: 'distribution' }),
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
