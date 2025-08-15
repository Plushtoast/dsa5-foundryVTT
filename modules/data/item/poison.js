import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../config/config-dsa5.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { NumberField, StringField, SchemaField } = foundry.data.fields;

export default class PoisonData extends ItemDataModel.mixin(DescriptionTemplate, ObfuscableTemplate, EquipmentTemplate) {
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
      sucht: new StringField({ label: 'poisonCategory.3' }),
      ql: new StringField({ label: 'POISON.ql' }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'stepValue', val: data.step.value },
      { key: 'poisonType', val: data.poisonType.value },
      { key: 'start', val: data.start.value },
      { key: 'duration', val: data.duration.value },
      { key: 'resistanceModifier', val: data.resistance.value },
      { key: 'effect', val: DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value)) },
    ];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();   
    item.system.preparedWeight = this.parent.system.preparedWeight;
    return item;
  }
}
