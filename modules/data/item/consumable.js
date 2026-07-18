import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import DSA5 from '../../config/config-dsa5.js';
import DSAStringField from '../fields/dsa_string_field.js';
import AoeTemplate from './templates/aoe.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { ItemFactory } from '../../item/item-factory.js';

const { StringField, SchemaField, NumberField, HTMLField } = foundry.data.fields;
const { TextEditor } = foundry.applications.ux;

const SKILL_MOD_TYPES = new Set(['FW', 'FP', 'QL', 'step', 'TPM', 'CMP']);
const SKILL_MOD_SCOPES = new Set(['liturgy', 'ceremony', 'spell', 'ritual', 'skill', 'feature']);

export default class ConsumableData extends ItemDataModel.mixin(OnUseTemplate, AoeTemplate, ObfuscableTemplate, DescriptionTemplate, EquipmentTemplate) {
  get detail_name() {
    if (this.detailsObfuscated && !game.user.isGM) return super.detail_name;

    return `${super.detail_name} (${_loc('CHARAbbrev.QS')} ${this.QL})`;
  }

  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      equipmentType: new SchemaField({
        value: new StringField({ initial: 'misc', required: true, label: 'equipmentType', choices: DSA5.equipmentTypes }),
      }),
      QLList: new DSAStringField({ initial: '', label: 'qualitySteps' }),
      QL: new NumberField({ initial: 1, required: true, label: 'qualityStep' }),
      charges: new NumberField({ initial: 1, min: 0 }),
      maxCharges: new NumberField({ initial: 1, min: 0 }),
      difficulty: new NumberField({ initial: 0, label: 'Difficulty' }),
      ingredients: new HTMLField({ initial: '' }),
      tools: new StringField({ initial: '', label: 'Equipment.tools' }),
    });
  }

  async getSheetData(data) {
    const availableSteps = data.document.system.QLList.split('\n');
    data.calculatedPrice = ItemFactory.getSubClass(data.document.type).consumablePrice(data.document);
    data.availableSteps = Object.fromEntries(availableSteps.map((_, i) => [i + 1, i + 1]));
    data.enrichedIngredients = await TextEditor.enrichHTML(data.document.system.ingredients, { secrets: data.document.isOwner });
    data.currentStep = availableSteps[data.document.system.QL - 1] || '';
    data.detail_name = this.detail_name;
  }

  static chatData(data, name) {
    return [
      { key: 'qualityStep', val: data.QL },
      { key: 'effect', val: DSA5_Utility.replaceDies(data.QLList.split('\n')[data.QL - 1]) },
      { key: 'charges', val: data.charges },
    ];
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.system.preparedWeight = this.parent.system.preparedWeight;
    item.name = this.parent.system.detail_name;
    this.constructor._prepareConsumable(item);
    return item;
  }

  static _prepareConsumable(item) {
    if (item.system.maxCharges) {
      item.consumable = true;
      item.structureMax = item.system.maxCharges;
      item.structureCurrent = item.system.charges;
    }
    return item;
  }

  /** Remaining uses across quantity stacks and per-item charges. */
  static remainingUses(item) {
    const quantity = Number(item.system.quantity?.value) || 0;
    const maxCharges = Number(item.system.maxCharges) || 0;
    const charges = Number(item.system.charges) || 0;
    if (maxCharges > 0) return Math.max(0, (quantity - 1) * maxCharges + charges);
    return Math.max(0, quantity);
  }

  /**
   * True when the item has non-transferred skillModifiers effects meant for roll dialogs.
   * Those should be consumed via the roll modifier, not inventory Use.
   */
  static offersRollModifiers(item) {
    return item.effects.some((effect) => this.#isRollModifierEffect(effect));
  }

  static #isRollModifierEffect(effect) {
    if (effect.disabled || effect.transfer) return false;
    return effect.changes.some((change) => this.#parseSkillModifierKey(change.key));
  }

  /**
   * @param {string} key
   * @returns {{ scope: string|null, modKey: string }|null}
   */
  static #parseSkillModifierKey(key) {
    if (typeof key !== 'string' || !key.startsWith('system.skillModifiers.')) return null;

    const parts = key.split('.');
    // system.skillModifiers.FW | system.skillModifiers.spell.FW | system.skillModifiers.postRoll.FP
    if (parts.length === 3) {
      const modKey = parts[2];
      if (!SKILL_MOD_TYPES.has(modKey)) return null;
      return { scope: null, modKey };
    }

    if (parts.length === 4) {
      const scope = parts[2];
      const modKey = parts[3];
      if (scope === 'postRoll' || scope === 'combat' || scope === 'conditional') return null;
      if (!SKILL_MOD_SCOPES.has(scope) || !SKILL_MOD_TYPES.has(modKey)) return null;
      return { scope, modKey };
    }

    return null;
  }

  static #formatModifierValue(rawValue, mode) {
    const match = String(rawValue).match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;

    const numericPart = match[0];
    switch (Number(mode)) {
      case CONST.ACTIVE_EFFECT_MODES.MULTIPLY:
        return `*${numericPart}`;
      case CONST.ACTIVE_EFFECT_MODES.OVERRIDE:
        return `=${numericPart}`;
      default:
        return Number(numericPart);
    }
  }

  /**
   * Parse a skillModifiers change against the current roll source.
   * Value format matches transferred AEs: `"SkillName 2"` / `"SkillName +2"` (semicolon-separated).
   * Scoped keys (`system.skillModifiers.spell.FW`) match by item type; optional name still filters.
   * @returns {{ type: string, value: number|string }|null}
   */
  static #matchChangeToRoll(change, source) {
    const parsed = this.#parseSkillModifierKey(change.key);
    if (!parsed || !source) return null;

    const modType = parsed.modKey === 'step' ? '' : parsed.modKey;
    const entries = String(change.value ?? '').split(/[;,]+/);

    for (const entry of entries) {
      const trimmed = entry.trim();
      if (!trimmed) continue;

      const tokens = trimmed.split(/\s+/);
      const rawValue = tokens.pop();
      const target = tokens.join(' ').trim();
      const value = this.#formatModifierValue(rawValue, change.mode);
      if (value === null || (typeof value === 'number' && Number.isNaN(value))) continue;

      if (parsed.scope) {
        if (source.type !== parsed.scope) continue;
        if (target && target !== source.name) continue;
      } else if (target !== source.name) {
        continue;
      }

      return { type: modType, value };
    }

    return null;
  }

  static addConsumableModifiers(situationalModifiers, actor, testData) {
    if (!actor) return;

    const source = testData.source;
    const typeLabel = game.i18n.localize('TYPES.Item.consumable');

    for (const item of actor.items) {
      if (item.type !== 'consumable') continue;
      if (this.remainingUses(item) <= 0) continue;

      for (const effect of item.effects) {
        if (!this.#isRollModifierEffect(effect)) continue;

        for (const change of effect.changes) {
          const matched = this.#matchChangeToRoll(change, source);
          if (!matched) continue;

          situationalModifiers.push({
            name: `${typeLabel}: ${item.name}`,
            value: matched.value,
            type: matched.type,
            selected: false,
            consumableId: item.id,
            ref: { uuid: item.uuid, id: item.id },
            source: item.name,
          });
        }
      }
    }
  }

  /** Consume one charge / unit (same accounting as inventory Use). */
  async consumeItem() {
    const item = this.parent;
    const quantity = Number(item.system.quantity.value) || 0;
    const maxCharges = Number(item.system.maxCharges) || 0;
    const charges = Number(item.system.charges) || 0;

    if (this.constructor.remainingUses(item) <= 0) return false;

    if (maxCharges > 0) {
      const newCharges = charges <= 1 ? maxCharges : charges - 1;
      const newQuantity = charges <= 1 ? quantity - 1 : quantity;
      if (newQuantity <= 0) {
        await item.delete();
      } else {
        await item.update({
          'system.quantity.value': newQuantity,
          'system.charges': newCharges,
        });
      }
    } else if (quantity <= 1) {
      await item.delete();
    } else {
      await item.update({ 'system.quantity.value': quantity - 1 });
    }

    return true;
  }

  static async triggerConsumptions(testData, actor) {
    if (!actor || !testData.situationalModifiers) return;
    if (testData.extra?.consumablesConsumed) return;
    if (testData.extra) testData.extra.consumablesConsumed = true;

    const consumedIds = new Set();
    for (const mod of testData.situationalModifiers) {
      if (mod.selected === false) continue;

      const id = mod.consumableId || mod.ref?.id;
      if (!id || consumedIds.has(id)) continue;

      const item = actor.items.get(id);
      if (!item || item.type !== 'consumable' || !item.system?.consumeItem) continue;

      consumedIds.add(id);
      await item.system.consumeItem();
    }
  }
}
