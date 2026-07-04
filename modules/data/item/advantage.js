import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import APValueTemplate from './templates/apvalue.js';
import MaxTemplate from './templates/max.js';
import RequirementsTemplate from './templates/requirements.js';
import AdvantageRulesDSA5 from '../../system/rules/advantage-rules-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class AdvantageData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, APValueTemplate, MaxTemplate, RequirementsTemplate) {
  static vantageSubcategories = {
    general: 'VantageSubcategory.general',
    tiergefährten: 'VantageSubcategory.tiergefährten',
    ahnenblut: 'VantageSubcategory.ahnenblut',
  };

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      subcategory: new SchemaField({
        value: new StringField({
          initial: 'general',
          required: true,
          label: 'subcategory',
          choices: AdvantageData.vantageSubcategories,
        }),
      }),
      rule: new SchemaField({
        value: new StringField({ initial: '', label: 'rule' }),
      }),
      step: new SchemaField({
        value: new NumberField({ initial: 1 }),
      }),
      effect: new SchemaField({
        value: new StringField({ initial: '', label: 'effect' }),
      }),
    });
  }

  static chatData(data, name) {
    return [
      { key: 'rule', val: data.rule.value },
      { key: 'effect', val: data.effect.value },
    ];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    this._setOnUseEffect(item);
    return item;
  }

  get effectMultiplier() {
    return Number(this.step?.value) || 1;
  }

  advanceCost() {
    return AdvantageRulesDSA5.stepXPCost(this, this.step.value);
  }

  refundCost() {
    return AdvantageRulesDSA5.stepXPCost(this, this.step.value - 1);
  }
}
