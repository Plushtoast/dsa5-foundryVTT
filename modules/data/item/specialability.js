import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import RequirementsTemplate from './templates/requirements.js';
import APValueTemplate from './templates/apvalue.js';
import DSABooleanField from '../fields/dsa_boolean_field.js';
import DSA5 from '../../system/config-dsa5.js';
import ArtifactTemplate from './templates/artifact.js';
import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class SpecialabilityData extends ItemDataModel.mixin(DescriptionTemplate, ArtifactTemplate, APValueTemplate, RequirementsTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      rule: new SchemaField({
        value: new StringField({ initial: '', label: 'rule' }),
      }),
      maxRank: new SchemaField({
        value: new NumberField({ initial: 0, label: 'maxlevel', min: 0 }),
      }),
      step: new SchemaField({
        value: new NumberField({ initial: 1, min: 0 }),
        circle: new StringField({ initial: '1', label: 'circle', min: 0 }),
        canNotMultiply: new DSABooleanField({ label: 'notMultiplyable' }),
      }),
      category: new SchemaField({
        value: new StringField({ initial: 'general', label: 'Category', required: true, choices: DSA5.specialAbilityCategories }),
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

  static _migrateData(source) {
    super._migrateData(source);

    if (typeof source.step?.canNotMultiply === 'string') {
      source.step.canNotMultiply = source.step.canNotMultiply === 'true';
    }
  }

  getSheetData(data) {
    let group = 'SpecCategory.general';
    data.categories = Object.entries(DSA5.specialAbilityCategories).map(([value, label]) => {
      if (value == 'clerical') group = 'SpecCategory.clerical';
      else if (value == 'magical') group = 'SpecCategory.magical';

      return { valueAttr: value, labelAttr: label, group };
    });
  }

  static chatData(data, name) {
    return [{ key: 'rule', val: data.rule.value }];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    this._setOnUseEffect(item);
    this._setAEPayments(item);
    return item;
  }

  _setAEPayments(item) {
    if (item.OnUseEffect) return;

    const cost = Number(foundry.utils.getProperty(item, 'system.AsPCost'));
    if (cost) item.AEpayable = true;
  }

  advanceCost() {
    return SpecialabilityRulesDSA5.stepXPCost(this, this.step.value)
  }

  refundCost() {
    return SpecialabilityRulesDSA5.stepXPCost(this, this.step.value - 1)
  }
}
