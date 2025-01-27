import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import EquipmentTemplate from './templates/equipment.js';

const { NumberField, BooleanField, StringField, SchemaField } = foundry.data.fields;

export default class PlantData extends DSADataModel.mixin(DescriptionTemplate, EquipmentTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      price: new SchemaField({
        raw: new NumberField({ initial: 0 }),
        value: new NumberField({ initial: 0 }),
      }),
      location: new SchemaField({
        landscape: new StringField({ initial: '', label: 'PLANT.landscape' }),
        region: new StringField({ initial: '', label: 'PLANT.region' }),
      }),
      difficulty: new SchemaField({
        search: new NumberField({ initial: 0, label: 'PLANT.search' }),
        identify: new NumberField({ initial: 0, label: 'PLANT.identify' }),
      }),
      usages: new StringField({ initial: '0/0/0/0/0/0', label: 'PLANT.usages' }),
      effect: new StringField({ initial: '', label: 'effect' }),
      infos: new StringField({ initial: '' }),
      recipes: new StringField({ initial: '' }),
      planttype: new SchemaField({
        healing: new BooleanField({}),
        poison: new BooleanField({}),
        physical: new BooleanField({}),
        psychic: new BooleanField({}),
        crop: new BooleanField({}),
        defensive: new BooleanField({}),
        supernatural: new BooleanField({}),
      }),
      availability: new SchemaField({
        highNorth: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        grasLands: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        swamps: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        woods: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        jungle: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        mountains: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        desert: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
        maraskan: new NumberField({ initial: 1, min: 0, max: 5, step: 1 }),
      }),
    });
  }
}
