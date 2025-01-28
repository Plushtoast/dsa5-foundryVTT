import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../system/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';
import ObfuscableTemplate from './templates/obfuscable.js';

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;

export default class EquipmentData extends DSADataModel.mixin(DescriptionTemplate, ObfuscableTemplate, ArtifactTemplate, EquipmentTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      equipmentType: new SchemaField({
        value: new StringField({ initial: 'misc', required: true, label: 'equipmentType', choices: DSA5.equipmentTypes }),
      }),
      structure: new SchemaField({
        value: new NumberField({ initial: 0 }),
        max: new NumberField({ initial: 0 }),
      }),
      capacity: new NumberField({ initial: 0, label: 'carrycapacity' }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      worn: new SchemaField({
        value: new BooleanField({ initial: false }),
        wearable: new BooleanField({ initial: false, label: 'wearable' }),
      }),
    });
  }
}
