import DSA5 from '../../config/config-dsa5.js';
import { onUseActionsField, OnUseActionMixin } from '../shared/onuse-action-schema.js';
import DSANumberField from '../fields/dsa_number_field.js';
import DSAStringField from '../fields/dsa_string_field.js';

const { SchemaField, NumberField } = foundry.data.fields;

export default class DSAEnhancementEffectDataModel extends OnUseActionMixin(foundry.data.ActiveEffectTypeDataModel) {
  static ALLOWED_ENHANCEMENT_KEY_PREFIX = 'system.';
  static ACTOR_CHANGE_REGEX = /^@actor\./;

  static TARGET_TYPES = {
    equipment: 'TYPES.Item.equipment',
    meleeweapon: 'TYPES.Item.meleeweapon',
    rangeweapon: 'TYPES.Item.rangeweapon',
    armor: 'TYPES.Item.armor',
  };

  static CRAFT_SKILLS = {
    metalworking: 'LocalizedIDs.metalworking',
    woodworking: 'LocalizedIDs.woodworking',
    clothworking: 'LocalizedIDs.clothworking',
    earthencraft: 'LocalizedIDs.earthencraft',
    leatherworking: 'LocalizedIDs.leatherworking',
  };

  static defineSchema() {
    const schema = super.defineSchema();

    schema.targetType = new DSAStringField({
      required: true,
      initial: 'equipment',
      choices: DSAEnhancementEffectDataModel.TARGET_TYPES,
      label: 'Enhancement.targetType',
      tooltip: 'Enhancement.hints.targetType',
    });

    schema.enhancementType = new DSAStringField({
      required: true,
      initial: 'material',
      choices: DSA5.enhancementTypes,
      label: 'Enhancement.enhancementType',
      tooltip: 'Enhancement.hints.enhancementType',
    });

    schema.slotCost = new DSANumberField({
      required: true, initial: 1, integer: true, min: 1,
      label: 'Enhancement.slotCost',
      tooltip: 'Enhancement.hints.slotCost',
    });

    schema.craftingRollMod = new DSANumberField({
      required: true, initial: 0, integer: true,
      label: 'Enhancement.craftingRollMod',
      tooltip: 'Enhancement.hints.craftingRollMod',
    });

    schema.craftingTimeMod = new DSANumberField({
      required: true, initial: 0,
      label: 'Enhancement.craftingTimeMod',
      tooltip: 'Enhancement.hints.craftingTimeMod',
    });

    schema.craftSkill = new DSAStringField({
      required: false,
      initial: '',
      blank: true,
      choices: DSAEnhancementEffectDataModel.CRAFT_SKILLS,
      label: 'Enhancement.craftSkill',
      tooltip: 'Enhancement.hints.craftSkill',
    });

    schema.materialCost = new DSANumberField({
      required: true, initial: 0, integer: true, min: 0,
      label: 'Enhancement.materialCost',
      tooltip: 'Enhancement.hints.materialCost',
    });

    schema.specialAttributes = new DSAStringField({
      required: false,
      initial: '',
      label: 'Enhancement.specialAttributesLabel',
      tooltip: 'Enhancement.hints.specialAttributes',
    });

    schema.powersource = new SchemaField({
      value: new NumberField({ initial: 0, min: 0, label: 'POWERSOURCE.current' }),
      max: new NumberField({ initial: 0, min: 0, label: 'POWERSOURCE.max' }),
    }, { required: false, nullable: true });

    schema.onUseActions = onUseActionsField();

    return schema;
  }

  static getAvailableEnhancementTypes(targetType) {
    const limits = this.getSlotLimits(targetType);
    return Object.fromEntries(
      Object.entries(DSA5.enhancementTypes).filter(([key]) => (limits[key] ?? 0) > 0)
    );
  }

  static validateChangeKeys(changes) {
    return changes.every((change) => {
      if (!change?.key) return true;
      if (this.ACTOR_CHANGE_REGEX.test(change.key)) {
        return change.key.replace(this.ACTOR_CHANGE_REGEX, '').startsWith(this.ALLOWED_ENHANCEMENT_KEY_PREFIX);
      }
      return change.key.startsWith(this.ALLOWED_ENHANCEMENT_KEY_PREFIX);
    });
  }

  static hasMisplacedActorKeys(changes) {
    return changes.some((change) => {
      if (!change?.key || this.ACTOR_CHANGE_REGEX.test(change.key)) return false;
      return /^system\.(status\.regeneration\.|skillModifiers\.conditional\.)/.test(change.key);
    });
  }

  get detail_name() {
    return this.parent.name;
  }

  static getSlotLimits(targetType) {
    const mapping = {
      equipment: 'EquipmentData',
      meleeweapon: 'MeleeweaponData',
      rangeweapon: 'RangeweaponData',
      armor: 'ArmorData',
    };
    const modelName = mapping[targetType];
    if (!modelName) return {};
    const model = CONFIG.Item.dataModels[targetType];
    return model?.ENHANCEMENT_SLOT_LIMITS ?? {};
  }

  async _preCreate(data, options, user) {
    const effect = this.parent;

    // Enhancement effects never transfer and are always hidden on token
    effect.updateSource({ transfer: false, showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON.NONE });

    const item = effect.parent;

    // Allow creation in compendiums (no parent item)
    if (!item) return;

    // Enhancement effects can only live on items, not actors
    if (item.documentName !== 'Item') {
      ui.notifications.warn('Enhancement.onlyOnItems', { localize: true });
      return false;
    }

    // Validate that the item type matches the enhancement's targetType
    if (item.type !== this.targetType) {
      ui.notifications.warn('Enhancement.wrongTargetType', { localize: true });
      return false;
    }

    // Check that the item type supports enhancements
    const limits = item.system.constructor.ENHANCEMENT_SLOT_LIMITS;
    if (!limits) {
      ui.notifications.warn('Enhancement.unsupportedItemType', { localize: true });
      return false;
    }

    const changes = this.changes ?? [];
    if (changes.length && !DSAEnhancementEffectDataModel.validateChangeKeys(changes)) {
      ui.notifications.warn('Enhancement.invalidKeys', { localize: true });
      return false;
    }

    if (DSAEnhancementEffectDataModel.hasMisplacedActorKeys(changes)) {
      ui.notifications.warn('Enhancement.useActorNamespace', { localize: true });
      return false;
    }

    // Check slot availability
    const enhancementType = this.enhancementType;
    const maxSlots = limits[enhancementType] ?? 0;
    if (maxSlots <= 0) return false;

    const usedSlots = item.effects
      .filter(e => e.type === 'enhancement' && e.system.enhancementType === enhancementType)
      .reduce((sum, e) => sum + (e.system.slotCost || 1), 0);

    if (usedSlots + (this.slotCost || 1) > maxSlots) {
      ui.notifications.warn('Enhancement.slotsFull', { localize: true });
      return false;
    }

    if (this.enhancementType === 'powersource' && !this.powersource) {
      this.powersource = { value: 0, max: 0 };
    }
  }
}
