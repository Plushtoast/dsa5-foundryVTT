import APValueTemplate from './templates/apvalue.js';
import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import DSA5 from '../../config/config-dsa5.js';
import RangeweaponData from './rangeweapon.js';

const { NumberField, SchemaField, StringField } = foundry.data.fields;

export default class TraitData extends ItemDataModel.mixin(DescriptionTemplate, APValueTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      traitType: new SchemaField({
        value: new StringField({ initial: 'meleeAttack', label: 'traitType', required: true, choices: DSA5.traitCategories }),
      }),
      // problem at is sometimes string and sometimes number
      at: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
      pa: new NumberField({ initial: 0, label: 'CHAR.PARRY' }),
      reach: new SchemaField({
        value: new StringField({ initial: '', label: 'reach' }),
      }),
      damage: new SchemaField({
        value: new StringField({ initial: '1d6', label: 'damage' }),
      }),
      reloadTime: new SchemaField({
        value: new StringField({ initial: '', label: 'reloadTime' }),
        progress: new NumberField({ initial: 0 }),
      }),
      aimTime: new SchemaField({
        progress: new NumberField({ initial: 0 }),
      }),
      AsPCost: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
      duration: new SchemaField({
        value: new StringField({ initial: '', label: 'duration' }),
      }),
      aspect: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
      effect: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
        attributes: new StringField({ initial: '' }),
      }),
      step: new SchemaField({
        value: new NumberField({ initial: 0, label: 'stepValue' }),
      }),
      distribution: new StringField({ initial: '', label: 'distribution' }),
    });
  }

  async getSheetData(data) {
    data.ranges = DSA5.meleeRanges;
  }

  static chatData(data, name) {
    let res = [];
    switch (data.traitType.value) {
      case 'meleeAttack':
        res = [
          { key: 'attack', val: data.at.value },
          { key: 'damage', val: data.damage.value },
          { key: 'reach', val: data.reach.value },
        ];
        break;
      case 'rangeAttack':
        res = [
          { key: 'attack', val: data.at.value },
          { key: 'damage', val: data.damage.value },
          { key: 'reach', val: data.reach.value },
          { key: 'reloadTime', val: data.reloadTime.value },
        ];
        break;
      case 'armor':
        res = [{ key: 'protection', val: data.damage.value }];
        break;
      case 'general':
        res = [];
        break;
      case 'familiar':
        res = [
          { key: 'APValue', val: data.APValue.value },
          { key: 'AsPCost', val: data.AsPCost.value },
          { key: 'duration', val: data.duration.value },
          { key: 'aspect', val: data.aspect.value },
        ];
        break;
      case 'trick':
        res = [{ key: 'APValue', val: data.APValue.value }];
        break;
      case 'entity':
        res = [
          { key: 'distribution', val: data.distribution },
          { key: 'CHARAbbrev.QL', val: data.AsPCost.value },
        ];
        break;
      case 'summoning':
        res = [
          { key: 'distribution', val: data.distribution },
          { key: 'conjuringDifficulty', val: data.at.value },
        ];
        break;
    }
    if (data.effect.value) res.push({ key: 'effect', val: data.effect.value });

    return res;
  }

  prepareEmbeddedItemSheet() {
    let item = super.prepareEmbeddedItemSheet();
    switch (item.system.traitType.value) {
      case 'rangeAttack':
        item = this.constructor._prepareRangeTrait(item, this.actor);
        break;
      case 'meleeAttack':
        item = this.constructor._prepareMeleetrait(item, this.actor);
        break;
    }
    this._setOnUseEffect(item);
    return item;
  }

  static _prepareRangeTrait(item, actorData) {
    item.attack = Number(item.system.at.value);
    item.LZ = Number(item.system.reloadTime.value);
    if (item.LZ > 0) RangeweaponData.buildReloadProgress(item);
    RangeweaponData.buildAimProgress(item);

    return this._parseDmg(item, actorData);
  }

  static _prepareMeleetrait(item, actorData) {
    item.attack = Number(item.system.at.value);
    if (item.system.pa != 0) item.parry = item.system.pa;

    return this._parseDmg(item, actorData);
  }
}
