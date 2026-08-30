import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import EncumbranceTemplate from './templates/encumbrance.js';
import StructureTemplate from './templates/structure.js';
import DSA5 from '../../config/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';
import CeremonialItemTemplate from './templates/ceremonial-item.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import InformableTemplate from './templates/informable.js';
import DSABooleanField from '../fields/dsa_boolean_field.js';

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;

export default class ArmorData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, ArtifactTemplate, CeremonialItemTemplate, ObfuscableTemplate, EquipmentTemplate, EncumbranceTemplate, StructureTemplate, InformableTemplate) {
  static ENHANCEMENT_SLOT_LIMITS = { material: 1, creationTechnique: 1, improvement: 2, treatment: 1 };

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
      isArtifact: new BooleanField({ initial: false, label: 'SpecCategory.staff' }),
      isCeremonial: new BooleanField({ initial: false, label: 'SpecCategory.ceremonial' }),
      uniq: new DSABooleanField({ initial: false, label: 'WEAPON.uniq', tooltip: 'WEAPON.uniqHint' }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (typeof source.subcategory === 'string') {
      source.subcategory = Number(source.subcategory) || 0;
    }
  }

  async getSheetData(data) {
    await super.getSheetData(data);
    data.domains = this.prepareDomains();
    data.breakPointRating = this.defaultBreakPointRating;
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
