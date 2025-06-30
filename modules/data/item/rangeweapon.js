import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import StructureTemplate from './templates/structure.js';
import ArtifactTemplate from './templates/artifact.js';
import DSA5 from '../../system/config-dsa5.js';
import ScopableStringField from './fields/scopable_stringfield.js';
import ScopableNumberField from './fields/scopable_numberfield.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { SchemaField, StringField, NumberField, BooleanField } = foundry.data.fields;

export default class RangeweaponData extends ItemDataModel.mixin(DescriptionTemplate, ObfuscableTemplate, ArtifactTemplate, EquipmentTemplate, StructureTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      ammunitiongroup: new SchemaField({
        value: new ScopableStringField({ initial: '-', label: 'ammunitiongroup', required: true, choices: DSA5.ammunitiongroups }),
      }),
      currentAmmo: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
      combatskill: new SchemaField({
        value: new ScopableStringField({ initial: 'crossbows', label: 'TYPES.Item.combatskill' }),
      }),
      crit: new ScopableNumberField({ initial: 1, min: 1, max: 19 }),
      botch: new ScopableNumberField({ initial: 20, min: 2, max: 20 }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      damage: new SchemaField({
        value: new ScopableStringField({ initial: '1d6', label: 'damage' }),
      }),
      reloadTime: new SchemaField({
        value: new ScopableStringField({ initial: '1', label: 'reloadTime', min: 0 }),
        progress: new ScopableNumberField({ initial: 0 }),
      }),
      reach: new SchemaField({
        value: new ScopableStringField({ initial: '5/25/40', label: 'reach' }),
      }),
      worn: new SchemaField({
        value: new BooleanField({ initial: false }),
      }),
      isArtifact: new BooleanField({ initial: false,  label: 'SpecCategory.staff' })
    });
  }

  async getSheetData(data) {
    data.combatskills = await DSA5_Utility.allCombatSkillsList('range');
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${data.document.system.combatskill.value}`)];
  }

  static chatData(data, name) {
    let res = [
      { key: 'damage', val: data.damage.value },
      { key: 'TYPES.Item.combatskill', val: data.combatskill.value },
      { key: 'reach', val: data.reach.value },
    ];
    if (data.effect.value) res.push({ key: 'effect', val: DSA5_Utility.replaceConditions(data.effect.value) });

    return res;
  }

  static buildReloadProgress(item) {
    const progress = item.system.reloadTime.progress / item.LZ;
    item.title = game.i18n.format('WEAPON.loading', {
      status: `${item.system.reloadTime.progress}/${item.LZ}`,
    });
    item.progress = `${item.system.reloadTime.progress}/${item.LZ}`;
    if (progress >= 1) {
      item.title = game.i18n.localize('WEAPON.loaded');
    }
    this.progressTransformation(item, progress);
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.toggleValue = item.system.worn.value || false;
    item.toggle = true;    
    item.system.preparedWeight = this.parent.system.preparedWeight;
    this.constructor._prepareItemStructure(item)
    this._setOnUseEffect(item);
    return item;
  }
}
