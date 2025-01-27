import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import EquipmentTemplate from './templates/equipment.js';
import EncumbranceTemplate from './templates/encumbrance.js';
import StructureTemplate from './templates/structure.js';
import DSA5 from '../../system/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;

export default class ArmorData extends DSADataModel.mixin(DescriptionTemplate, ArtifactTemplate, EquipmentTemplate, EncumbranceTemplate, StructureTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      protection: new SchemaField({
        value: new NumberField({ initial: 0, label: 'protection' }),
        leftleg: new NumberField({ initial: 0 }),
        rightleg: new NumberField({ initial: 0 }),
        leftarm: new NumberField({ initial: 0 }),
        rightarm: new NumberField({ initial: 0 }),
        head: new NumberField({ initial: 0 }),
      }),
      worn: new SchemaField({
        value: new BooleanField({}),
      }),
      subcategory: new StringField({ choices: Object.keys(DSA5.armorSubcategories).reduce((acc, key) => {
        acc[key] = `ARMORSUBCATEGORIES.${key}`;
        return acc;
      }, {}), required: true, initial: 0, label: 'COMBATSKILLCATEGORY.subcategory' }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if(typeof source.subcategory === 'string') {
      source.subcategory = Number(source.subcategory) || 0;
    }
  }
}
