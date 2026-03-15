import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import RequirementsTemplate from './templates/requirements.js';
import APValueTemplate from './templates/apvalue.js';
import DSABooleanField from '../fields/dsa_boolean_field.js';
import ArtifactTemplate from './templates/artifact.js';
import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

const { SchemaField, StringField, NumberField } = foundry.data.fields;

export default class SpecialabilityData extends ItemDataModel.mixin(DescriptionTemplate, ArtifactTemplate, APValueTemplate, RequirementsTemplate) {
  static COMBAT_SKILL_TYPES = {
    BASEMANEUVER: 0,
    SPECIALMANEUVER: 1,
    COMBATSTYLE: 2,
    COMBATSTYLE_EXTENDED_BASE: 8,
    COMBATSTYLE_EXTENDED: 6,    
    COMBATSTYLE_EXTENDED_PASSIVE: 7,
    PASSIVE: 3,
    GENERAL: 4,
    BRAWLING: 5,
  };

  static APPLIES_COMBAT_EFFECT = new Set([
    this.COMBAT_SKILL_TYPES.COMBATSTYLE, 
    this.COMBAT_SKILL_TYPES.COMBATSTYLE_EXTENDED_PASSIVE,
    this.COMBAT_SKILL_TYPES.PASSIVE
  ]);

  static combatSkillSubCategories = (() => {
    const categories = {};
    Object.entries(this.COMBAT_SKILL_TYPES).forEach(([key, value]) => {
      categories[value] = `COMBATSKILLCATEGORY.${value}`;
    });
    return categories;
  })();

  static styleSFCategories = new Set(['magicalStyle', 'clericalStyle', 'generalStyle']);
  static advancedSFCategories ={
    extGeneral: 'SpecCategory.generalStyle', 
    extClericalStyle: 'SpecCategory.clericalStyle', 
    extMagical: 'SpecCategory.magicalStyle'
  }
  
  static specialAbilityCategories = {
    Combat: 'SpecCategory.Combat',
    command: 'SpecCategory.command',

    general: 'SpecCategory.general',
    generalStyle: 'SpecCategory.generalStyle',
    extGeneral: 'SpecCategory.extGeneral',

    animal: 'SpecCategory.animal',

    fatePoints: 'SpecCategory.fatePoints',
    vampire: 'SpecCategory.vampire',
    lykanthrop: 'SpecCategory.lykanthrop',

    language: 'SpecCategory.language',
    secret: 'SpecCategory.secret',

    clerical: 'SpecCategory.clerical',
    clericalStyle: 'SpecCategory.clericalStyle',
    extClericalStyle: 'SpecCategory.extClericalStyle',
    ceremonial: 'SpecCategory.ceremonial',
    vision: 'SpecCategory.vision',
    prayer: 'SpecCategory.prayer',

    magical: 'SpecCategory.magical',
    magicalStyle: 'SpecCategory.magicalStyle',
    extMagical: 'SpecCategory.extMagical',
    staff: 'SpecCategory.staff',
    pact: 'SpecCategory.pact',
    homunculus: 'SpecCategory.homunculus',
    magicalsign: 'SpecCategory.magicalsign',
    sikaryan: 'SpecCategory.sikaryan',
  };

  static sortedSpecs = (() => {
    const combat = new Set(['Combat', 'command']);
    const magical = new Set(['magical', 'magicalStyle', 'extMagical', 'pact', 'homunculus', 'magicalsign', 'sikaryan']);
    const clerical = new Set(['clerical', 'clericalStyle', 'extClericalStyle', 'ceremonial', 'vision', 'prayer']);
    const unUsed = new Set(['staff']);
    const allCategories = Object.keys(SpecialabilityData.specialAbilityCategories);
    const used = new Set([...combat, ...magical, ...clerical, ...unUsed]);
    const general = new Set(allCategories.filter(cat => !used.has(cat)));
    return { combat, magical, clerical, unUsed, general };
  })();

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
        value: new StringField({ initial: 'general', label: 'Category', required: true, choices: SpecialabilityData.specialAbilityCategories }),
        sub: new NumberField({ initial: 0, required: true, label: 'COMBATSKILLCATEGORY.subcategory', choices: SpecialabilityData.combatSkillSubCategories }),
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
      advancedSF: new StringField({ initial: ''}),
      styleSF: new StringField({ initial: ''}),
    });
  }

  get hasAdvancedSF() {
    if(SpecialabilityData.styleSFCategories.has(this.category.value) || (this.category.value === 'Combat' && this.category.sub === SpecialabilityData.COMBAT_SKILL_TYPES.COMBATSTYLE)) return 'SPECIALABILITYadvancedSF.' + this.category.value;

    return false;
  }

  get hasStyleSF() {
    const extendedCombatStyles = [SpecialabilityData.COMBAT_SKILL_TYPES.COMBATSTYLE_EXTENDED_BASE, SpecialabilityData.COMBAT_SKILL_TYPES.COMBATSTYLE_EXTENDED, SpecialabilityData.COMBAT_SKILL_TYPES.COMBATSTYLE_EXTENDED_PASSIVE];   

    if (this.category.value === 'Combat' && extendedCombatStyles.includes(this.category.sub)) return `SpecCategory.extCombat`;

    return SpecialabilityData.advancedSFCategories[this.category.value];
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (typeof source.step?.canNotMultiply === 'string') {
      source.step.canNotMultiply = source.step.canNotMultiply === 'true';
    }
  }

  getSheetData(data) {
    let group = 'SpecCategory.general';
    data.categories = Object.entries(SpecialabilityData.specialAbilityCategories).map(([value, label]) => {
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

  get appliesCombatEffect() {
    return SpecialabilityData.APPLIES_COMBAT_EFFECT.has(this.category.sub);
  }
}
