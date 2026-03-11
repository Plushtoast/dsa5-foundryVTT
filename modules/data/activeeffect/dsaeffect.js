import DSATriggers from '../../system/automation/triggers.js';

const { BooleanField, FilePathField, NumberField, HTMLField, StringField, SchemaField, ObjectField } = foundry.data.fields;

export default class DSAActiveEffectDataModel extends foundry.data.ActiveEffectTypeDataModel {
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

  static defineSchema() {
    const schema = super.defineSchema();
    schema.advancedFunction = new NumberField({ initial: 0, choices: this.ADVANCED_FUNCTION_TYPES });
    schema.equipmentAdvantage = new NumberField({ initial: 0, choices: this.ADVANTAGE_TYPES });
    schema.macroArgs = new SchemaField({
      args0: new StringField(),
      args1: new StringField(),
      args2: new StringField(),
      args3: new StringField(),
      args4: new StringField(),
      onDelayed: new StringField(),
      onRemove: new StringField(),
    });
    schema.delayed = new SchemaField({
      enabled: new BooleanField({ initial: false }),
      originalDuration: new ObjectField(),
      macroEffect: new ObjectField(),
      initialTestData: new ObjectField(),
      sourceActor: new StringField(),
      source: new ObjectField(),
    });
    schema.customDuration = new StringField();
    schema.specStep = new NumberField({ initial: 0 });
    schema.applyToOwner = new BooleanField({ initial: false });
    schema.aura = new SchemaField({
      isAura: new BooleanField({ initial: false }),
      auraRadius: new StringField(),
      borderColor: new StringField(),
      fillColor: new StringField(),
      borderThickness: new NumberField({ initial: 3 }),
      disposition: new NumberField({ initial: 2 }),
      templateSource: new StringField(),
    });
    schema.charges = new SchemaField({
      value: new NumberField({ nullable: true, initial: null }),
      max: new NumberField({ nullable: true, initial: null }),
    });
    schema.description = new StringField();
    schema.condition = new SchemaField({
      value: new NumberField({ nullable: true, initial: null }),
      max: new NumberField({ nullable: true, initial: null }),
      auto: new NumberField({ initial: 0 }),
      manual: new NumberField({ initial: 0 }),
    });
    schema.horseSpeed = new NumberField({ nullable: true, initial: null });
    schema.visibility = new SchemaField({
      hideOnToken: new BooleanField({ initial: false }),
      hidePlayers: new BooleanField({ initial: false }),
    });
    schema.removeMessage = new StringField();
    schema.resistRoll = new StringField();
    schema.successEffect = new NumberField({ initial: 0, choices: this.SUCCESS_EFFECT_TYPES });
    return schema;
  }

  /*static _migrateData(source) {
    super._migrateData(source);
  }*/
}
