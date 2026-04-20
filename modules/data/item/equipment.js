import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../config/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';
import ObfuscableTemplate from './templates/obfuscable.js';

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;

export default class EquipmentData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, ObfuscableTemplate, ArtifactTemplate, EquipmentTemplate) {
  static ENHANCEMENT_SLOT_LIMITS = { material: 1, creationTechnique: 0, improvement: 1 };

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      equipmentType: new SchemaField({
        value: new StringField({ initial: 'misc', required: true, label: 'equipmentType', choices: DSA5.equipmentTypes }),
      }),
      structure: new SchemaField({
        value: new NumberField({ initial: 0, min: 0 }),
        max: new NumberField({ initial: 0, min: 0 }),
      }),
      capacity: new NumberField({ initial: 0, label: 'carrycapacity', min: 0 }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      worn: new SchemaField({
        value: new BooleanField({ initial: false }),
        wearable: new BooleanField({ initial: false, label: 'wearable' }),
      }),
      isArtifact: new BooleanField({ initial: false, label: 'SpecCategory.staff' })
    });
  }

  async getSheetData(data) {
    data.domains = this.prepareDomains();
  }

  static chatData(data, name) {
    return [{ key: 'equipmentType', val: `Equipment.${data.equipmentType.value}`, localizeVal: true }];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.toggle = item.system.worn.wearable || false;
    if (item.toggle) item.toggleValue = item.system.worn.value || false;
    item.system.preparedWeight = this.parent.system.preparedWeight;
    this.constructor._prepareItemStructure(item);
    this._setOnUseEffect(item);
    return item
  }

  get isBagWithContents() {
    return this.actor && this.equipmentType.value == 'bags';
  }
}
