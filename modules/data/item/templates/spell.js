import DSA5 from '../../../system/config-dsa5.js';
import { DSADataModel } from '../../abstract.js';
import DSABooleanField from '../../fields/dsa_boolean_field.js';

const { SchemaField, NumberField, StringField } = foundry.data.fields;

export default class SpellTemplate extends DSADataModel {
  static defineSchema() {
    return {
      characteristic1: new SchemaField({
        value: new StringField({ initial: 'mu', label: 'Characteristic1', required: true, choices: DSA5.characteristics }),
      }),
      characteristic2: new SchemaField({
        value: new StringField({ initial: 'mu', label: 'Characteristic2', required: true, choices: DSA5.characteristics }),
      }),
      characteristic3: new SchemaField({
        value: new StringField({ initial: 'mu', label: 'Characteristic3', required: true, choices: DSA5.characteristics }),
      }),
      effect: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
      }),
      castingTime: new SchemaField({
        value: new NumberField({ initial: 1 }),
        progress: new NumberField({ initial: 0 }),
        modified: new NumberField({ initial: 0 }),
      }),
      AsPCost: new SchemaField({
        value: new NumberField({ initial: 0, min: 0}),
      }),
      AsPCostDetail: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
      maintainCost: new SchemaField({
        value: new StringField({ initial: '', label: 'maintainCost' }),
      }),
      distribution: new SchemaField({
        value: new StringField({ initial: '', label: 'distribution' }),
      }),
      resistanceModifier: new SchemaField({
        value: new StringField({ initial: '-', label: 'resistanceModifier', required: true, choices: DSA5.magicResistanceModifiers }),
      }),
      canChangeCastingTime: new SchemaField({
        value: new DSABooleanField({ initial: true }),
      }),
      canChangeCost: new SchemaField({
        value: new DSABooleanField({ initial: true }),
      }),
      canChangeRange: new SchemaField({
        value: new DSABooleanField({ initial: true }),
      }),
      variableBaseCost: new DSABooleanField({ initial: false, label: 'variableCost' }),
      effectFormula: new SchemaField({
        value: new StringField({ initial: '', label: 'effectFormula' }),
      }),
      talentValue: new SchemaField({
        value: new NumberField({ initial: 0, min: 0 }),
      }),
    };
  }

  static _migrateData(source) {
    super._migrateData(source);

    const boolFields = ['canChangeCastingTime.value', 'canChangeCost.value', 'canChangeRange.value', 'variableBaseCost'];
    for (const field of boolFields) {
      if (typeof source[field] === 'string') {
        source[field] = source[field] === 'true';
      }
    }
  }

  static buildSpellChargeProgress(item) {
    item.LZ = Number(item.system.castingTime.modified) || 0;
    if (item.LZ > 1) {
      const progress = item.system.castingTime.progress / item.LZ;
      item.title = game.i18n.format('SPELL.loading', {
        status: `${item.system.castingTime.progress}/${item.LZ}`,
      });
      item.progress = `${item.system.castingTime.progress}/${item.LZ}`;
      this.progressTransformation(item, progress);
    }
    return item;
  }
}
