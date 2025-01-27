import DescriptionTemplate from './templates/description.js';
import { DSADataModel } from '../abstract.js';
import RequirementsTemplate from './templates/requirements.js';
import APValueTemplate from './templates/apvalue.js';
import DSABooleanField from '../fields/dsa_boolean_field.js';
import DSA5 from '../../system/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class SpecialabilityData extends DSADataModel.mixin(DescriptionTemplate, ArtifactTemplate, APValueTemplate, RequirementsTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      rule: new SchemaField({
        value: new StringField({ initial: '', label: 'rule' }),
      }),
      maxRank: new SchemaField({
        value: new NumberField({ initial: 0, label: 'maxlevel' }),
      }),
      step: new SchemaField({
        value: new NumberField({ initial: 1 }),
        circle: new NumberField({ initial: 1, label: 'circle' }),
      }),
      category: new SchemaField({
        value: new StringField({ initial: 'general' }),
        sub: new NumberField({ initial: 0, required: true, label: 'COMBATSKILLCATEGORY.subcategory', choices: DSA5.combatSkillSubCategories }),
      }),
      distribution: new StringField({ initial: '', label: 'distribution' }),
      list: new SchemaField({
        value: new StringField({ initial: '', label: 'TYPES.Item.combatskill' }),
      }),
      effect: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
        value2: new StringField({}),
        value3: new StringField({}),
      }),      
      permanentEffects: new DSABooleanField({ label: 'permanentEffects' }),
      volume: new NumberField({ label: 'volume' }),
      AsPCost: new StringField({ label: 'AsPCost' }),
      feature: new StringField({ label: 'feature' }),
      duration: new SchemaField({
        value: new StringField({ initial: '', label: 'duration' }),
      }),
    });
  }
}
