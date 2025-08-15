import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { NumberField, StringField, SchemaField } = foundry.data.fields;

export default class DiseaseData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      step: new SchemaField({
        value: new NumberField({ initial: 1, label: 'stepValue', min: 1 }),
      }),
      resistance: new SchemaField({
        value: new StringField({ initial: 'ZK', label: 'resistanceModifier', required: true, choices: DSA5.magicResistanceModifiers }),
      }),
      incubation: new SchemaField({
        value: new StringField({ initial: '', label: 'incubation' }),
      }),
      damage: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
      }),
      duration: new SchemaField({
        value: new StringField({ initial: '', label: 'duration' }),
      }),
      source: new SchemaField({
        value: new StringField({ initial: '', label: 'source' }),
      }),
      treatment: new SchemaField({
        value: new StringField({ initial: '', label: 'treatment' }),
      }),
      antidot: new SchemaField({
        value: new StringField({ initial: '', label: 'antidot' }),
      }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'stepValue', val: data.step.value },
      { key: 'incubation', val: data.incubation.value },
      { key: 'damage', val: DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.damage.value)) },
      { key: 'duration', val: data.duration.value },
      { key: 'source', val: DSA5_Utility.replaceDies(data.source.value) },
      { key: 'treatment', val: data.treatment.value },
      { key: 'antidot', val: data.antidot.value },
      { key: 'resistanceModifier', val: data.resistance.value },
    ];
  }
}
