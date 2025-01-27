import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import EquipmentTemplate from './templates/equipment.js';
import StructureTemplate from './templates/structure.js';
import ArtifactTemplate from './templates/artifact.js';
import DSA5 from '../../system/config-dsa5.js';
import ScopableStringField from './fields/scopable_stringfield.js';
import ScopableNumberField from './fields/scopable_numberfield.js';
import ScopableBooleanField from './fields/scopable_booleanfield.js';

const { SchemaField, StringField, BooleanField } = foundry.data.fields;

export default class MeleeweaponData extends DSADataModel.mixin(DescriptionTemplate, ArtifactTemplate, EquipmentTemplate, StructureTemplate) {
  static defineSchema() {
    const guideValues = foundry.utils.duplicate(DSA5.characteristics)
    guideValues['-'] = '-'
    guideValues['ge/kk'] = 'CHAR.GEKK'

    return this.mergeSchema(super.defineSchema(), {
      crit: new ScopableNumberField({ initial: 1 }),
      botch: new ScopableNumberField({ initial: 20 }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      damage: new SchemaField({
        value: new ScopableStringField({ initial: '1d6', label: 'damage' }),
      }),
      atmod: new SchemaField({
        value: new ScopableNumberField({ initial: 0, label: 'atmod' }),
        offhandMod: new ScopableNumberField({ initial: 0 }),
      }),
      pamod: new SchemaField({
        value: new ScopableNumberField({ initial: 0, label: 'pamod' }),
        offhandMod: new ScopableNumberField({ initial: 0 }),
      }),
      reach: new SchemaField({
        value: new ScopableStringField({ initial: 'medium', label: 'reach', required: true, choices: DSA5.meleeRanges }),
        shieldSize: new ScopableStringField({ initial: 'medium', label: 'shieldSize', required: true, choices: DSA5.shieldSizes }),
      }),
      damageThreshold: new SchemaField({
        value: new ScopableNumberField({ initial: 14, label: 'damageThreshold' }),
      }),
      guidevalue: new SchemaField({
        value: new ScopableStringField({ initial: '-', label: 'guidevalue', choices: guideValues, required: true }),
      }),
      combatskill: new SchemaField({
        value: new ScopableStringField({ initial: 'daggers', label: 'TYPES.Item.combatskill' }),
      }),
      worn: new SchemaField({
        value: new BooleanField({  }),
        offhand: new ScopableBooleanField({ label: 'offHand' }),
        wrongGrip: new ScopableBooleanField(),
      }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if(!DSA5.shieldSizes[source.reach.shieldSize]) {
      source.reach.shieldSize = 'medium';
    }
  }
}
