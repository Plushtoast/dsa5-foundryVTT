import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import StructureTemplate from './templates/structure.js';
import ArtifactTemplate from './templates/artifact.js';
import DSA5 from '../../config/config-dsa5.js';
import ScopableStringField from './fields/scopable_stringfield.js';
import ScopableNumberField from './fields/scopable_numberfield.js';
import ScopableBooleanField from './fields/scopable_booleanfield.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import DSA5SoundEffect from '../../system/helpers/dsa-soundeffect.js';

const { getProperty, setProperty } = foundry.utils;

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
      aimTime: new SchemaField({
        progress: new ScopableNumberField({ initial: 0 }),
      }),
      reach: new SchemaField({
        value: new ScopableStringField({ initial: '5/25/40', label: 'reach' }),
      }),
      worn: new SchemaField({
        value: new BooleanField({ initial: false }),
        offHand: new ScopableBooleanField({ label: 'offHand', initial: false }),
        requiresBothHands: new BooleanField({ initial: true }),
      }),
      isArtifact: new BooleanField({ initial: false, label: 'SpecCategory.staff' })
    });
  }

  async getSheetData(data) {
    data.combatskills = await DSA5_Utility.allCombatSkillsList('range');
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.weaponStabilities[_loc(`LocalizedCTs.${data.document.system.combatskill.value}`)];
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
    item.title = _loc('WEAPON.loading', {
      status: `${item.system.reloadTime.progress}/${item.LZ}`,
    });
    item.progress = `${item.system.reloadTime.progress}/${item.LZ}`;
    if (progress >= 1) {
      item.title = _loc('WEAPON.loaded');
    }
    this.progressTransformation(item, progress);
  }

  static buildAimProgress(item) {
    const aimProgress = Math.clamp(Number(item.system?.aimTime?.progress) || 0, 0, 2);
    const progress = aimProgress / 2;

    item.aimTitle = _loc('WEAPON.aiming', {
      status: `${aimProgress}/2`,
    });
    item.aimProgress = `${aimProgress}/2`;
    if (progress >= 1) {
      item.aimTitle = _loc('WEAPON.aimed');
    }

    if (progress >= 0.5) {
      item.aimTransformRight = '181deg';
      item.aimTransformLeft = `${Math.round(progress * 360 - 179)}deg`;
    } else {
      item.aimTransformRight = `${Math.round(progress * 360 + 1)}deg`;
      item.aimTransformLeft = '0deg';
    }
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

  getContextOptions() {
    return [{
      name: this.worn.value ? 'SHEET.UnEquipItem' : 'SHEET.EquipItem',
      icon: "<i class='fas fa-shield-alt fa-fw'></i>",
      callback: () => this.reEquipItem(),
    }]
  }

  async reEquipItem() {
    if (this.parent?.actor) {
      await this.parent.actor.equipWeaponToHand(this.parent.id, { hand: 'auto', equip: !this.worn.value });
      return;
    }

    await this.parent.update({ 'system.worn.value': !this.worn.value });
    this.itemEquippedMessage();
  }

  itemEquippedMessage() {
    DSA5SoundEffect.playEquipmentWearStatusChange(this.parent);
    if (this.parent.actor && game.combat) {
      const texts = [{ value: _loc(this.worn.value ? 'SHEET.EquipItem' : 'SHEET.UnEquipItem') + ` ${this.parent.name}` }];
      this.parent.actor.tokenScrollingText(texts);
    }
  }

  async _preUpdate(changed, options, user) {
    // If a ranged weapon switches into 2H mode, its offHand flag must be cleared.
    const requiresBothHands = getProperty(changed, 'system.worn.requiresBothHands');
    if (requiresBothHands === true) setProperty(changed, 'system.worn.offHand', false);
    await super._preUpdate(changed, options, user);
  }
}
