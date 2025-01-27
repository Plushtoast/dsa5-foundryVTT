import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../system/config-dsa5.js';

const { NumberField, StringField, SchemaField } = foundry.data.fields;

export default class PoisonData extends DSADataModel.mixin(DescriptionTemplate, EquipmentTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      step: new SchemaField({
        value: new NumberField({ initial: 1, label: 'stepValue', min: 1, max: 6, step: 1 }),
      }),
      subcategory: new NumberField({ initial: 1, label: 'COMBATSKILLCATEGORY.subcategory', required: true, choices: DSA5.poisonSubTypes }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      poisonType: new SchemaField({
        value: new StringField({ initial: '', label: 'poisonType' }),
      }),
      resistance: new SchemaField({
        value: new StringField({ initial: 'ZK', label: 'resistanceModifier', required: true, choices: DSA5.magicResistanceModifiers }),
      }),
      effect: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
        attributes: new StringField({ initial: '' }),
      }),
      start: new SchemaField({
        value: new StringField({ initial: '', label: 'start' }),
      }),
      duration: new SchemaField({
        value: new StringField({ initial: '', label: 'duration' }),
      }),
      sucht: new StringField({ label: 'poisonCategory.3'}),
      ql: new StringField({ label: 'POISON.ql'}),
    });
  }
}
