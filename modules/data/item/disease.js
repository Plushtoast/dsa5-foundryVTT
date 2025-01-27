import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import DSA5 from '../../system/config-dsa5.js';

const { NumberField, StringField, SchemaField } = foundry.data.fields;

export default class DiseaseData extends DSADataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      step: new SchemaField({
        value: new NumberField({ initial: 1, label: 'stepValue' }),
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
}
