import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import EncumbranceTemplate from './templates/encumbrance.js';
import StructureTemplate from './templates/structure.js';
import DSA5 from '../../config/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';
import ObfuscableTemplate from './templates/obfuscable.js';

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;

export default class ArmorData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, ArtifactTemplate, ObfuscableTemplate, EquipmentTemplate, EncumbranceTemplate, StructureTemplate) {
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
      subcategory: new NumberField({
        choices: Object.keys(DSA5.armorSubcategories).reduce((acc, key) => {
          acc[key] = `ARMORSUBCATEGORIES.${key}`;
          return acc;
        }, {}),
        required: true,
        initial: 0,
        label: 'COMBATSKILLCATEGORY.subcategory',
      }),
      isArtifact: new BooleanField({ initial: false, label: 'SpecCategory.staff' })
    });
  }

  static _cleanData(source, options, _state) {
    super._cleanData(source, options, _state);
    if (source.worn) source.worn.value = false;
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (typeof source.subcategory === 'string') {
      source.subcategory = Number(source.subcategory) || 0;
    }
  }

  async getSheetData(data) {
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.armorSubcategories[data.document.system.subcategory];
  }

  static chatData(data, name) {
    const properties = [
      { key: 'protection', val: data.protection.value },
      { key: 'encumbrance', val: data.encumbrance.value },
    ];
    if (data.effect.value) properties.push({ key: 'effect', val: data.effect.value });

    return properties;
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.toggleValue = item.system.worn.value || false;
    item.toggle = true;
    item.system.preparedWeight = this.preparedWeight;
    item.system.calculatedEncumbrance = this.calculatedEncumbrance;
    this.constructor._prepareItemStructure(item);
    this._setOnUseEffect(item);
    return item
  }
}
