import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import APValueTemplate from './templates/apvalue.js';
import RequirementsTemplate from './templates/requirements.js';
import DSA5 from '../../system/config-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class CareerData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate, RequirementsTemplate) {
  static defineSchema() {
    const characteristics = foundry.utils.duplicate(DSA5.characteristics);
    characteristics['-'] = '-';

    return this.mergeSchema(super.defineSchema(), {
      languagePoints: new SchemaField({
        value: new NumberField({ initial: 0, label: 'languagePoints' }),
      }),
      spelltrickCount: new SchemaField({
        value: new NumberField({ initial: 0, label: 'spelltrickCount' }),
      }),
      recommendedAdvantages: new SchemaField({
        value: new StringField({ initial: '', label: 'recommendedAdvantages' }),
      }),
      recommendedDisadvantages: new SchemaField({
        value: new StringField({ initial: '', label: 'recommendedDisadvantages' }),
      }),
      notsuitableAdvantages: new SchemaField({
        value: new StringField({ initial: '', label: 'notsuitableAdvantages' }),
      }),
      notsuitableDisadvantages: new SchemaField({
        value: new StringField({ initial: '', label: 'notsuitableDisadvantages' }),
      }),
      mageLevel: new SchemaField({
        value: new StringField({ initial: 'mundane', label: 'mageLevel', choices: DSA5.mageLevels, required: true }),
      }),
      skills: new SchemaField({
        value: new StringField({ initial: '', label: 'skills' }),
      }),
      guidevalue: new SchemaField({
        value: new StringField({ initial: '-', label: 'guidevalue', choices: characteristics, required: true }),
        factor: new NumberField({ initial: 1, label: 'energyfactor' }),
      }),
      tradition: new SchemaField({
        value: new StringField({ initial: '', label: 'tradition' }),
      }),
      feature: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
      happyTalents: new SchemaField({
        value: new StringField({ initial: '', label: 'happyTalents' }),
      }),
      spells: new SchemaField({
        value: new StringField({ initial: '', label: 'spells' }),
      }),
      spelltricks: new SchemaField({
        value: new StringField({ initial: '', label: 'magictricks' }),
      }),
      liturgies: new SchemaField({
        value: new StringField({ initial: '', label: 'liturgies' }),
      }),
      blessings: new SchemaField({
        value: new StringField({ initial: '', label: 'blessings' }),
      }),
      specialAbilities: new SchemaField({
        value: new StringField({ initial: '', label: 'specialAbilities' }),
      }),
      combatSkills: new SchemaField({
        value: new StringField({ initial: '', label: 'TYPES.Item.combatskill' }),
      }),
      clothing: new SchemaField({
        value: new StringField({ initial: '' }),
      }),
    });
  }
}
