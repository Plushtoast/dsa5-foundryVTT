import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../abstract.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../system/config-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class AmmunitionData extends ItemDataModel.mixin(DescriptionTemplate, EquipmentTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      ammunitiongroup: new SchemaField({
        value: new StringField({ initial: '-', label: 'ammunitiongroup', choices: DSA5.ammunitiongroups }),
      }),
      damageMod: new StringField({ initial: '', label: 'MODS.damage' }),
      rangeMultiplier: new NumberField({ initial: 1, label: 'MODS.range', step: 0.1, min: 0 }),
      armorMod: new StringField({ initial: '', label: 'MODS.armor' }),
      atmod: new NumberField({ initial: 0, label: 'atmod' }),
      mag: new SchemaField({
        value: new NumberField({ initial: 0, min: 0 }),
        max: new NumberField({ initial: 0, min: 0 }),
      }),
    });
  }

  async getSheetData(data) {
    data.domains = this.prepareDomains();
  }

  static chatData(data, name) {
    return [{ key: 'ammunitiongroup', val: data.ammunitiongroup.value, localizeVal: true }];
  }
}
