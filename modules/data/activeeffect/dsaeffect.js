import DSATriggers from '../../system/automation/triggers.js';
import { onUseActionsField, OnUseActionMixin } from '../shared/onuse-action-schema.js';

const { ArrayField, BooleanField, ColorField, NumberField, StringField, SchemaField, ObjectField, TypedObjectField } = foundry.data.fields;

export default class DSAActiveEffectDataModel extends OnUseActionMixin(foundry.data.ActiveEffectTypeDataModel) {
  static ADVANTAGE_TYPES = {
    0: '-',
    1: 'TYPES.Item.advantage',
    2: 'TYPES.Item.disadvantage',
  };
  static SUCCESS_EFFECT_TYPES = {
    0: '-',
    1: 'ActiveEffects.onSuccess',
    2: 'ActiveEffects.onFailure',
  };
  static SCOPED_RULE_KEYS = {
    modifier: 'ActiveEffects.scopedRuleTypes.modifier',
    restriction: 'ActiveEffects.scopedRuleTypes.restriction',
  };
  static SCOPED_RULE_SCOPES = {
    self: 'ActiveEffects.scopedRuleScopes.self',
    againstTarget: 'ActiveEffects.scopedRuleScopes.againstTarget',
    incomingAttack: 'ActiveEffects.scopedRuleScopes.incomingAttack',
    allOpponents: 'ActiveEffects.scopedRuleScopes.allOpponents',
  };
  static ADVANCED_FUNCTION_INDEXES = {
    NONE: 0,
    SYSTEM_EFFECT: 1,
    MACRO: 2,
    CREATURE: 3,
    ARMOR_TRANSFORMATION: DSATriggers.EVENTS.ARMOR_TRANSFORMATION,
    DAMAGE_TRANSFORMATION: DSATriggers.EVENTS.DAMAGE_TRANSFORMATION,
    POST_ROLL: DSATriggers.EVENTS.POST_ROLL,
    POST_OPPOSED: DSATriggers.EVENTS.POST_OPPOSED,
    ROLL_DIALOG_RENDER: DSATriggers.EVENTS.ROLL_DIALOG_RENDER,
  };
  static ADVANCED_FUNCTION_TYPES = {
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.NONE]: 'ActiveEffects.advancedFunctions.none',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.SYSTEM_EFFECT]: 'ActiveEffects.advancedFunctions.systemEffect',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.MACRO]: 'ActiveEffects.advancedFunctions.macro',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.CREATURE]: 'ActiveEffects.advancedFunctions.creature',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.ARMOR_TRANSFORMATION]: 'ActiveEffects.advancedFunctions.armorPostprocess',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.DAMAGE_TRANSFORMATION]: 'ActiveEffects.advancedFunctions.damagePostprocess',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.POST_ROLL]: 'ActiveEffects.advancedFunctions.postRoll',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.POST_OPPOSED]: 'ActiveEffects.advancedFunctions.postOpposed',
    [DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.ROLL_DIALOG_RENDER]: 'ActiveEffects.advancedFunctions.rollDialogRender',
  };

  static DISPOSITION_ALL = 2;

  static DISPOSITION_CHOICES = Object.entries(CONST.TOKEN_DISPOSITIONS).reduce(
    (obj, [key, value]) => {
      obj[value] = `TOKEN.DISPOSITION.${key}`;
      return obj;
    },
    { [this.DISPOSITION_ALL]: 'all' },
  );

  static afterUseField() {
    return new SchemaField({
      name: new StringField({ initial: '' }),
      changes: new ArrayField(new ObjectField(), { initial: [] }),
      duration: new ObjectField({ initial: {} }),
    });
  }

  static scopedRuleField() {
    return new SchemaField({
      key: new StringField({ initial: 'modifier', choices: this.SCOPED_RULE_KEYS }),
      scope: new StringField({ initial: 'self', choices: this.SCOPED_RULE_SCOPES }),
      identifiers: new ArrayField(new StringField({ required: true }), { initial: [] }),
      categories: new ArrayField(new StringField({ required: true }), { initial: [] }),
      value: new ObjectField({ initial: {} }),
      data: new ObjectField({ initial: {} }),
      target: new ObjectField({ initial: {} }),
    });
  }

  static defineSchema() {
    const schema = super.defineSchema();
    schema.advancedFunction = new NumberField({ initial: 0, choices: this.ADVANCED_FUNCTION_TYPES, hint: 'ActiveEffects.hints.advancedFunction' });
    schema.equipmentAdvantage = new NumberField({ initial: 0, choices: this.ADVANTAGE_TYPES, hint: 'ActiveEffects.hints.equipmentAdvantage' });
    schema.macroArgs = new SchemaField({
      conditionId: new StringField({ hint: 'ActiveEffects.hints.conditionId' }), // was args0
      conditionValue: new StringField({ hint: 'ActiveEffects.hints.conditionValue' }), // was args1
      macro: new StringField({ hint: 'ActiveEffects.hints.macro' }), // was args3
      creatureLinks: new StringField({ hint: 'ActiveEffects.hints.creatureLinks' }), // was args4
      onDelayed: new StringField({ hint: 'ActiveEffects.hints.onDelayed' }),
      onRemove: new StringField({ hint: 'ActiveEffects.hints.onRemove' }),
      sourceItemUuid: new StringField({ hint: 'ActiveEffects.hints.sourceItemUuid' }),
    });
    schema.delayed = new SchemaField({
      enabled: new BooleanField({ initial: false }),
      originalDuration: new ObjectField(),
      macroEffect: new ObjectField(),
      initialTestData: new ObjectField(),
      sourceActor: new StringField(),
      source: new ObjectField(),
    });
    schema.customDuration = new StringField({ hint: 'ActiveEffects.hints.customDuration' });
    schema.specStep = new NumberField({ initial: 0 });
    schema.applyToOwner = new BooleanField({ initial: false, hint: 'ActiveEffects.applyToOwnerHint' });
    schema.aura = new SchemaField({
      isAura: new BooleanField({ initial: false, hint: 'ActiveEffects.hints.isAura' }),
      auraRadius: new StringField({ hint: 'ActiveEffects.hints.radius' }),
      borderColor: new ColorField({ label: "ActiveEffects.auraColor", hint: 'ActiveEffects.hints.auraColor' }),
      hidden: new BooleanField({ initial: true, hint: 'ActiveEffects.hints.auraHidden' }),
      disposition: new NumberField({ initial: this.DISPOSITION_ALL, choices: this.DISPOSITION_CHOICES, hint: 'ActiveEffects.hints.disposition' }),
      excludeSelf: new BooleanField({ initial: true, hint: 'ActiveEffects.hints.excludeSelf' }),
      ignoreWalls: new BooleanField({ initial: false, hint: 'ActiveEffects.hints.ignoreWalls' }),
      regionBehaviors: new ObjectField(),
    });
    schema.charges = new SchemaField({
      value: new NumberField({ nullable: true, initial: null }),
      max: new NumberField({ nullable: true, initial: null }),
    }, { hint: 'ActiveEffects.hints.charges' });
    schema.maintenance = new SchemaField({
      cost: new NumberField({ nullable: true, initial: null }),
      payType: new StringField({ initial: '' }),
      links: new ArrayField(new StringField({ required: true }), { initial: [] }),
    });
    schema.condition = new SchemaField({
      value: new NumberField({ nullable: true, initial: null }),
      max: new NumberField({ nullable: true, initial: null }),
      auto: new NumberField({ initial: 0 }),
      manual: new NumberField({ initial: 0 }),
    });
    schema.horseSpeed = new NumberField({ nullable: true, initial: null });
    schema.visibility = new SchemaField({
      hideOnToken: new BooleanField({ initial: false, hint: 'ActiveEffects.hints.hideOnToken' }),
      hidePlayers: new BooleanField({ initial: false, hint: 'ActiveEffects.hints.hidePlayers' }),
    });
    schema.useLifecycle = new SchemaField({
      afterUse: new TypedObjectField(this.afterUseField()),
    });
    schema.scopedRules = new TypedObjectField(this.scopedRuleField(), { hint: 'ActiveEffects.hints.scopedRules' });
    schema.removeMessage = new StringField({ hint: 'ActiveEffects.hints.removeMessage' });
    schema.resistRoll = new StringField({ hint: 'ActiveEffects.hints.resistRoll' });
    schema.successEffect = new NumberField({ initial: 0, choices: this.SUCCESS_EFFECT_TYPES, hint: 'ActiveEffects.hints.successEffect' });
    schema.onUseActions = onUseActionsField();
    return schema;
  }

  async addAfterUse({ name = '', changes = [], duration = {} } = {}) {
    const id = foundry.utils.randomID();
    await this.parent.update({
      [`system.useLifecycle.afterUse.${id}`]: { name, changes, duration },
    });
    return id;
  }

  async removeAfterUse(id) {
    if (!id) return;
    await this.parent.update({ [`system.useLifecycle.afterUse.${id}`]: _del });
  }

  async updateAfterUse(id, { name = '', changes = [], duration = {} } = {}) {
    if (!id) return;
    await this.parent.update({
      [`system.useLifecycle.afterUse.${id}`]: { name, changes, duration },
    });
  }
}
