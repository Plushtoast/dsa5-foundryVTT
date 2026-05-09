import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DSAActiveEffect from '../status/dsa_active_effects.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import ItemRulesDSA5 from '../system/rules/item-rules-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effect_config.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5CombatDialog from '../dialog/dialog-combat-dsa5.js';
import DSA5SpellDialog from '../dialog/dialog-spell-dsa5.js';
import { ITEM_CONSTANTS } from '../config/item-constants.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import CreatureType from '../system/automation/creature-type.js';
import { ModifierCalculator } from './concerns/modifier-calculator.js';
import { CombatSystem } from './concerns/combat-system.js';
import { ItemFactory } from './item-factory.js';
import { CombatSpecialAbilities } from './concerns/combat-special-abilities.js';
import { MiracleModifiers } from './concerns/miracle-modifiers.js';
import { ResistanceTests } from './concerns/resistance-tests.js';
import { ItemEquality } from './concerns/item-equality.js';
import { ItemCreateDialog } from './item-create-dialog.js';
import { ItemDialogBuilder } from './item-dialog-builder.js';
import { SpellModifiers } from './concerns/spell-modifiers.js';
import { SituationalModifiersWidget } from '../system/helpers/situational-modifiers-widget.js';
import { PersonaeSocialContactService } from '../system/helpers/personae-social-contact.js';
import SpellPreferenceRule from '../system/rules/spell-preference-rule.js';

const { getProperty, mergeObject, duplicate, setProperty, randomID } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

// ===== TYPE DEFINITIONS =====

/**
 * @typedef {Object} ModifierObject
 * @property {string} name - Display name of the modifier
 * @property {number} value - Numeric modifier value
 * @property {string} [type] - Modifier type (e.g., 'dmg', 'defenseMalus')
 * @property {boolean} [selected] - Whether modifier is selected by default
 * @property {string} [source] - Source of the modifier
 */

/**
 * @typedef {Object} TestData
 * @property {Object} source - Source item being tested
 * @property {boolean} opposable - Whether this test can be opposed
 * @property {Array<ModifierObject>} situationalModifiers - Applied modifiers
 * @property {number} testDifficulty - Base difficulty of the test
 * @property {Object} extra - Extra test data and options
 */

/**
 * @typedef {Object} CardOptions
 * @property {string} template - Template path for the chat card
 * @property {string} title - Chat card title
 * @property {Object} speaker - Speaker information for chat
 * @property {Object} flags - Additional flags for the chat message
 */

// ===== CONSTANTS =====

/** @constant {string} Opposition indicator for chat titles */
const OPPOSED_SUFFIX = ' - ';

const { SPELL, RITUAL, LITURGY, CEREMONY, SKILL } = ITEM_CONSTANTS.TEST_TYPES;

const ACTOR_TYPES = {
  CHARACTER: 'character',
  NPC: 'npc',
};

/**
 * DSA5 Item class extending Foundry VTT's base Item class
 * Handles all item types in the Das Schwarze Auge 5 system
 * @extends {Item}
 */
export default class Itemdsa5 extends Item {
  /** @type {string} Default icon path for items without specific icons */
  static DEFAULT_ICON = ITEM_CONSTANTS.DEFAULT_ICON_PATH;

  static supportsOnUseActions(type) {
    return !!CONFIG.Item.dataModels?.[type]?.implementsOnUseEffect;
  }

  static migrateData(source) {
    const migrated = super.migrateData(source);
    const legacyOnUseEffect = getProperty(migrated, 'flags.dsa5.onUseEffect');
    const currentActions = getProperty(migrated, 'system.onUseActions') || {};

    if (this.supportsOnUseActions(migrated.type) && typeof legacyOnUseEffect === 'string' && legacyOnUseEffect.trim() !== '' && Object.keys(currentActions).length === 0) {
      setProperty(migrated, 'system.onUseActions', {
        [randomID()]: {
          name: migrated.name || '',
          img: migrated.img || '',
          macro: legacyOnUseEffect,
        },
      });
    }

    if (getProperty(migrated, 'flags.dsa5.onUseEffect') !== undefined) {
      delete migrated.flags.dsa5.onUseEffect;
    }

    return migrated;
  }

  /**
   * Set default icon for item data
   * @override
   * @param {Object} data - Item data object
   * @param {string} [data.img] - Image path
   * @param {string} data.type - Item type
   * @returns {void}
   */
  static defaultIcon(data) {
    if (!data.img || data.img === '') {
      if (data.type in ITEM_CONSTANTS.DEFAULT_IMAGES) {
        data.img = ITEM_CONSTANTS.DEFAULT_IMAGES[data.type];
      } else if (data.type.startsWith('ability')) {
        data.img = ITEM_CONSTANTS.DEFAULT_IMAGES.specialability;
      } else {
        data.img = this.DEFAULT_ICON;
      }
    }
  }

  /**
   * Create new item instances with proper icon defaults
   * @override
   * @param {Object|Array<Object>} data - Item creation data
   * @param {Object} [options={}] - Creation options
   * @returns {Promise<Itemdsa5|Array<Itemdsa5>>} Created item(s)
   */
  static async create(data, options) {
    if (Array.isArray(data)) {
      for (const d of data) {
        this.defaultIcon(d);
      }
    } else {
      this.defaultIcon(data);
    }
    return await super.create(data, options);
  }

  /* @override */
  static async createDialog(data = {}, createOptions = {}, { folders, types, template, context, ...dialogOptions } = {}, renderOptions = {}) {
    return ItemCreateDialog.wait(this, data, createOptions, { folders, types, template, context, ...dialogOptions }, renderOptions);
  }

  /**
   * Get special ability modifiers from HTML form elements
   * @param {jQuery} html - jQuery wrapped HTML element containing the form
   * @param {string} mode - Combat mode ('attack' | 'parry')
   * @returns {Array<Object>} Array of modifier objects with properties:
   *   - {string} name - Display name of the modifier
   *   - {number} value - Calculated modifier value
   *   - {string} damageBonus - Damage bonus string
   *   - {number} dmmalus - Defense malus value
   *   - {number} step - Step value from dataset
   *   - {Object} ref - Reference object { id } pointing to the special ability
   *   - {string} [type] - Modifier type (optional)
   *   - {Object} flatValues - Flat values object
   */
  static getSpecAbModifiers(html, mode) {
    const res = [];
    const isAttack = mode === ITEM_CONSTANTS.COMBAT_MODES.ATTACK;
    const mainAttribute = isAttack ? ITEM_CONSTANTS.COMBAT_BONUS.ATTACK : ITEM_CONSTANTS.COMBAT_BONUS.PARRY;

    const matchers = {
      [mainAttribute]: 'value',
      [ITEM_CONSTANTS.COMBAT_BONUS.DAMAGE]: 'damageBonus',
      [ITEM_CONSTANTS.COMBAT_BONUS.DEFENSE_MALUS]: 'dmmalus',
    };

    for (const element of html.find('.specAbs')) {
      const dataset = element.dataset;
      const step = Number(dataset.step);
      if (step <= 0) continue;
      const modifier = ModifierCalculator.parseModifierValue(dataset, mainAttribute, step);
      if (!modifier) continue;

      const flatValues = ModifierCalculator.extractFlatValues(dataset, matchers);
      const name = element.querySelector('a').textContent.trim();

      res.push({
        name,
        value: modifier.value + (flatValues.value || 0),
        damageBonus: dataset.tpbonus,
        dmmalus: Number(dataset.dmmalus) * step + (flatValues.dmmalus || 0),
        step,
        ref: { id: dataset.id },
        type: modifier.type,
        flatValues
      });
    }
    return res;
  }

  /**
   * Build embedded HTML for item browsing
   * @override
   * @param {Object} config - Embed configuration
   * @param {Object} [options={}] - Additional rendering options
   * @returns {Promise<HTMLElement>} Rendered HTML element
   */
  async _buildEmbedHTML(config, options = {}) {
    const template = `systems/dsa5/templates/items/browse/${this.type}.hbs`;
    const item = await renderTemplate(template, {
      document: this,
      isGM: game.user.isGM,
      ...(await this.sheet._prepareContext()),
      ...options,
    });
    return $(item)[0];
  }

  /**
   * Register all item subclasses with the ItemFactory
   * @static
   * @returns {void}
   */
  static setupSubClasses() {
    ItemFactory.setupSubclasses({
      aggregatedTest: AggregatedTestItemDSA5,
      ritual: RitualItemDSA5,
      spell: SpellItemDSA5,
      liturgy: LiturgyItemDSA5,
      ceremony: CeremonyItemDSA5,
      trait: TraitItemDSA5,
      disease: DiseaseItemDSA5,
      poison: PoisonItemDSA5,
      money: MoneyItemDSA5,
      plant: PlantItemDSA5,
      rangeweapon: RangeweaponItemDSA5,
      meleeweapon: MeleeweaponDSA5,
      combatskill: CombatskillDSA5,
      skill: SkillItemDSA5,
      application: ApplicationItemDSA5,
      consumable: ConsumableItemDSA,
    });
  }

  static getSubClass(type) {
    return ItemFactory.getSubClass(type);
  }

  // ===== CONDITION MANAGEMENT =====

  /**
   * Add a status condition to this item
   * @param {string} effect - The effect/condition key to add
   * @param {number} [value=1] - The value/level of the condition
   * @param {boolean} [absolute=false] - Whether this is an absolute value
   * @param {boolean} [auto=true] - Whether to apply automatically
   * @returns {Promise<Object>} Promise resolving to the add operation result
   */
  async addCondition(effect, value = 1, absolute = false, auto = true) {
    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  /**
   * Remove a status condition from this item
   * @param {string} effect - The effect/condition key to remove
   * @param {number} [value=1] - The value/level to remove
   * @param {boolean} [auto=true] - Whether to apply automatically
   * @param {boolean} [absolute=false] - Whether this is an absolute removal
   * @returns {Promise<Object>} Promise resolving to the removal operation result
   */
  async removeCondition(effect, value = 1, auto = true, absolute = false) {
    return DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute);
  }

  /**
   * Check if this item has a specific condition
   * @param {string} conditionKey - The condition key to check for
   * @returns {boolean} True if the item has the condition, false otherwise
   */
  hasCondition(conditionKey) {
    return DSA5StatusEffects.hasCondition(this, conditionKey);
  }

  // ===== DOCUMENT LIFECYCLE HOOKS =====

  /**
   * Handle document creation operations and update related actor conditions
   * @override
   * @static
   * @param {Array<Itemdsa5>} documents - Array of created item documents
   * @param {Object} operation - Database operation details
   * @param {User} user - User who performed the operation
   * @returns {Promise<Array<Itemdsa5>>} Promise resolving to the operation result
   * @private
   */
  static async _onCreateOperation(documents, operation, user) {
    await this._updateActorConditions(documents);
    return super._onCreateOperation(documents, operation, user);
  }

  /**
   * Handle document update operations and update related actor conditions
   * @override
   * @static
   * @param {Array<Itemdsa5>} documents - Array of updated item documents
   * @param {Object} operation - Database operation details
   * @param {User} user - User who performed the operation
   * @returns {Promise<Array<Itemdsa5>>} Promise resolving to the operation result
   * @private
   */
  static async _onUpdateOperation(documents, operation, user) {
    await this._updateActorConditions(documents);
    return super._onUpdateOperation(documents, operation, user);
  }

  /**
   * Handle document deletion operations and update related actor conditions
   * @override
   * @static
   * @param {Array<Itemdsa5>} documents - Array of deleted item documents
   * @param {Object} operation - Database operation details
   * @param {User} user - User who performed the operation
   * @returns {Promise<Array<Itemdsa5>>} Promise resolving to the operation result
   * @private
   */
  static async _onDeleteOperation(documents, operation, user) {
    await this._updateActorConditions(documents);
    return super._onDeleteOperation(documents, operation, user);
  }

  /**
   * Update actor conditions for all documents that have associated actors
   * @static
   * @param {Array<Itemdsa5>} documents - Array of item documents to process
   * @returns {Promise<void>} Promise that resolves when all conditions are updated
   * @private
   */
  static async _updateActorConditions(documents) {
    for (const doc of documents) {
      if (doc.actor) {
        await Actordsa5.postUpdateConditions(doc.actor);
      }
    }
  }

  // ===== UTILITY METHODS =====

  /**
   * Parse effect string into structured modifier data
   * @static
   * @param {string} effect - Raw effect string to parse
   * @param {Object} actor - Actor object providing context for parsing
   * @returns {Object<string, Array<string|number>>} Parsed modifiers organized by type
   * @todo This needs the current movement type for proper parsing
   */
  static parseEffect(effect, actor) {
    return ModifierCalculator.parseEffect(effect, actor);
  }

  /**
   * Update the three characteristics values on a source item
   * @static
   * @param {Object} source - Source item object to modify
   * @param {string} ch1 - First characteristic identifier
   * @param {string} ch2 - Second characteristic identifier  
   * @param {string} ch3 - Third characteristic identifier
   * @returns {void}
   */
  static updateCharacteristics(source, ch1, ch2, ch3) {
    source.system.characteristic1.value = ch1;
    source.system.characteristic2.value = ch2;
    source.system.characteristic3.value = ch3;
  }

  // ===== DIALOG AND TESTING =====

  /**
   * Setup dialog for item test (base implementation - should be overridden by subclasses)
   * @static
   * @param {Event} ev - DOM event that triggered the dialog
   * @param {Object} options - Dialog options and configuration
   * @param {Itemdsa5} item - Item instance to test
   * @param {Object} actor - Actor performing the test
   * @param {string} tokenId - ID of the token representing the actor
   * @returns {Object|null} Dialog configuration object or null if not implemented
   */
  static setupDialog(ev, options, item, actor, tokenId) {
    return null;
  }

  /**
   * Setup dialog for item test (instance method that delegates to subclass)
   * @param {Event} ev - DOM event that triggered the dialog
   * @param {Object} [options={}] - Dialog options and configuration
   * @param {string} tokenId - ID of the token representing the actor
   * @returns {Object|null} Dialog configuration object or null if not supported
   */
  setupEffect(ev, options = {}, tokenId) {
    return ItemFactory.getSubClass(this.type).setupDialog(ev, options, this, this.parent, tokenId);
  }

  async rollAggregatedProbe(which, tokenId) {
    return await ItemFactory.getSubClass(this.type).rollAggregatedProbe(this, which, tokenId);
  }

  static async _createUseChatMessage(item, actor, tokenId, effect, options = {}) {
    const msg = await renderTemplate('systems/dsa5/templates/chat/consumable-used.hbs', {
      item,
      effect,
      applyEffect: options.applyEffect,
      hasAreaTemplate: options.hasAreaTemplate,
    });

    const chatOptions = DSA5_Utility.chatDataSetup(msg);
    chatOptions['flags.data'] = {
      preData: {
        source: item.toObject(),
        extra: {
          speaker: ItemDialogBuilder.buildSpeaker(actor, tokenId),
        },
      },
    };

    if (options.postData) {
      chatOptions['flags.data'].postData = options.postData;
    }

    await ChatMessage.create(chatOptions);
  }

  static async _applyItemUseActiveEffect(source, testData = {}) {
    const effects = source.effects.toObject();
    if (!effects.length) return;

    const { msg, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(source.actor, effects, source, testData, source.actor);

    const infoMsg = `${_loc('ActiveEffects.appliedEffect', {
      target: source.actor.token?.name || source.actor.name,
      source: effectNames.join(', '),
    })} ${msg || ''}`;
    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
  }

  /**
   * Default equality check for item stacking purposes
   * @static
   * @param {Itemdsa5} item - First item to compare
   * @param {Itemdsa5} item2 - Second item to compare
   * @returns {boolean} True if items are considered equal for stacking
   */
  static checkEquality(item, item2) {
    return item2.type == item.type &&
      item.name == item2.name &&
      item.system.description?.value == item2.system.description?.value;
  }

  /**
   * Combine two items by merging their quantities
   * @static
   * @param {Object} item1 - Target item (will be modified with new quantity)
   * @param {Object} item2 - Source item (provides additional quantity)
   * @param {Object} actor - Actor that owns both items
   * @param {boolean} [render=true] - Whether to trigger UI re-rendering
   * @returns {Promise<Object>} Promise resolving to the update operation result
   */
  static async combineItem(item1, item2, actor, render = true) {
    item1 = duplicate(item1);
    item1.system.quantity.value += item2.system.quantity.value;
    return await actor.updateEmbeddedDocuments('Item', [item1], { render });
  }

  /**
   * Stack compatible items together using their specific combination logic
   * @static
   * @param {Itemdsa5} stackOn - Target item to stack onto
   * @param {Itemdsa5} newItem - Source item to add to the stack
   * @param {Object} actor - Actor that owns both items
   * @param {boolean} [render=true] - Whether to trigger UI re-rendering
   * @returns {Promise<Object>} Promise resolving to the stacking operation result
   */
  static async stackItems(stackOn, newItem, actor, render = true) {
    return await ItemFactory.getSubClass(stackOn.type).combineItem(stackOn, newItem, actor, render);
  }

  /**
   * Perform a comprehensive item test (dice rolling and result calculation)
   * @param {Object} testParams - Test parameters object
   * @param {TestData} testParams.testData - Core test data including modifiers and difficulty
   * @param {CardOptions} testParams.cardOptions - Chat card display options
   * @param {Object} [options={}] - Additional test options
   * @param {boolean} [options.suppressMessage] - Whether to suppress chat output
   * @param {string} [options.rerenderMessage] - Message ID to re-render instead of creating new
   * @returns {Promise<Object>} Promise resolving to test results with structure:
   *   - {Object} result - Dice roll and test calculation results
   *   - {CardOptions} cardOptions - Final chat card options used
   */
  async itemTest({ testData, cardOptions }, options = {}) {
    testData = await DiceDSA5.rollDices(testData, cardOptions);
    const result = await DiceDSA5.rollTest(testData);

    result.postFunction = 'itemTest';

    if (game.user.targets.size) {
      cardOptions.isOpposedTest = testData.opposable;
      const opposed = OPPOSED_SUFFIX + _loc('Opposed');
      if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + '$') != opposed) {
        cardOptions.title += opposed;
      }
    }

    if (!options.suppressMessage) {
      DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage);
    }

    return { result, cardOptions };
  }

  /**
   * Post this item to chat for display to all players
   * @returns {Promise<void>} Promise that resolves when the item has been posted
   */
  async postItem() {
    this.system.constructor._postItem(this);
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    this.overrides = {};
    this.applyEnhancementEffects();
    if (!this.actor) this.applyActiveEffects();
  }

  applyEnhancementEffects() {
    const changes = [];
    const specialAttributeParts = [];

    for (const effect of this.effects) {
      if (effect.type !== 'enhancement' || effect.disabled) continue;
      changes.push(...effect.system.changes.map((change) => ({ ...change, effect })));

      const attrs = effect.system.specialAttributes;
      if (attrs) {
        specialAttributeParts.push(
          ...attrs.split(',').map(s => s.trim()).filter(Boolean)
        );
      }
    }

    if (specialAttributeParts.length) {
      const existing = (foundry.utils.getProperty(this, 'system.effect.attributes') || '').split(',').map(s => s.trim()).filter(Boolean);
      for (const attr of specialAttributeParts) {
        if (!existing.includes(attr)) existing.push(attr);
      }
      foundry.utils.setProperty(this, 'system.effect.attributes', existing.join(', '));
    }

    if (!changes.length) return;

    changes.sort((a, b) => a.priority - b.priority);
    foundry.documents.ActiveEffect.implementation._shimChanges(changes);

    const replacementData = this.getRollData();
    for (const change of changes) {
      if (!change.key) continue;

      if (change.key === 'system.damage.value') {
        this._applyEnhancementDamage(change);
        continue;
      }

      if (change.key === 'system.reach.value' && this.type === 'rangeweapon') {
        this._applyEnhancementRangeMultiplier(change);
        continue;
      }

      const result = DSAActiveEffect.applyChange(this, change, { replacementData });
      if (foundry.utils.isPlainObject(result)) Object.assign(this.overrides, result);

      if (change.key === 'system.protection.value' && this.type === 'armor') {
        this._replicateProtectionToZones(change);
      }
    }
  }

  _applyEnhancementDamage(change) {
    const bonus = Number(change.value) || 0;
    if (bonus === 0) return;

    const base = foundry.utils.getProperty(this, 'system.damage.value') || '1d6';
    let result;

    if (/[+-]\d+$/.test(base)) {
      const match = base.match(/([+-])(\d+)$/);
      const newNumber = parseInt(match[0]) + bonus;
      result = base.replace(match[0], '') + (newNumber >= 0 ? '+' : '-') + Math.abs(newNumber);
    } else {
      result = base + (bonus >= 0 ? '+' : '-') + Math.abs(bonus);
    }

    foundry.utils.setProperty(this, 'system.damage.value', result);
  }

  _applyEnhancementRangeMultiplier(change) {
    const multiplier = Number(change.value) || 1;
    if (multiplier === 1) return;

    const base = foundry.utils.getProperty(this, 'system.reach.value') || '';
    const parts = base.split('/').map(s => s.trim());
    const result = parts.map(p => {
      const num = Number(p);
      return isNaN(num) ? p : Math.round(num * multiplier);
    }).join('/');

    foundry.utils.setProperty(this, 'system.reach.value', result);
  }

  _replicateProtectionToZones(change) {
    const bonus = Number(change.value) || 0;
    if (bonus === 0) return;

    const zones = ['head', 'leftarm', 'rightarm', 'leftleg', 'rightleg'];
    for (const zone of zones) {
      const current = foundry.utils.getProperty(this, `system.protection.${zone}`) || 0;
      if (current !== 0) {
        foundry.utils.setProperty(this, `system.protection.${zone}`, current + bonus);
      }
    }
  }

  applyActiveEffects() {
    const changes = [];

    for (const effect of this.effects) {
      if (effect.type === 'enhancement') continue;
      const delayedData = effect.system?.delayed;
      const isDelayed = !!delayedData?.enabled;
      if (effect.disabled || !effect.transfer || isDelayed) continue;

      const multiply = this.system.effectMultiplier || 1;
      for (let i = 0; i < multiply; i++) {
        changes.push(...effect.system.changes.map((change) => ({ ...change, effect })));
      }
    }

    changes.sort((left, right) => left.priority - right.priority);
    foundry.documents.ActiveEffect.implementation._shimChanges(changes);

    const replacementData = this.getRollData();
    for (const change of changes) {
      if (!change.key) continue;
      DSAActiveEffect.applyChange(this, change, { replacementData });
    }
  }
}

class AggregatedTestItemDSA5 extends Itemdsa5 {
  static async rollAggregatedProbe(item, which, tokenId) {
    const actor = item.actor;
    if (!actor) return;

    const attr = item.system.talent[`value${which}`];
    const skill = actor.items.find((entry) => entry.name == attr && entry.type == 'skill');
    let infoMsg = `<h3 class="center"><b>${_loc('TYPES.Item.aggregatedTest')}</b></h3>`;

    if (item.system.usedTestCount.value >= item.system.allowedTestCount.value) {
      infoMsg += `${_loc('Aggregated.noMoreAllowed')}`;
      await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
      return;
    }

    if (!skill) return;

    const postFunction = {
      functionName: "game.dsa5.entities.Itemdsa5.getSubClass('aggregatedTest').updateAggregatedTest",
      aggregatedItemId: item.id,
      previousCummulatedQS: item.system.cummulatedQS.value,
      previousFailedTests: item.system.previousFailedTests.value,
      previousUsedTestCount: item.system.usedTestCount.value,
      speaker: {
        token: tokenId,
        actor: actor.id,
        scene: canvas.scene?.id,
      },
    };

    const setupData = await actor.setupSkill(
      skill,
      {
        moreModifiers: [
          {
            name: _loc('failedTests'),
            value: -1 * item.system.previousFailedTests.value,
            selected: true,
          },
          {
            name: _loc('Modifier'),
            value: item.system.baseModifier,
            selected: true,
          },
        ],
        postFunction,
      },
      tokenId,
    );

    const res = await actor.basicTest(setupData);
    await this.updateAggregatedTest(postFunction, res);
  }

  static async updateAggregatedTest(postFunction, testResult, source) {
    const actor = DSA5_Utility.getSpeaker(postFunction.speaker);
    if (!actor) return;

    const item = actor.items.get(postFunction.aggregatedItemId);
    if (!item) return;

    const aggregated = item.toObject();
    aggregated.system.cummulatedQS.value = postFunction.previousCummulatedQS;
    aggregated.system.previousFailedTests.value = postFunction.previousFailedTests;
    aggregated.system.usedTestCount.value = postFunction.previousUsedTestCount;

    const result = testResult.result;
    if (result.successLevel > 0) {
      aggregated.system.cummulatedQS.value = Math.min(10, aggregated.system.cummulatedQS.value + result.qualityStep);
    } else {
      aggregated.system.previousFailedTests.value += 1;
    }
    aggregated.system.usedTestCount.value += 1;

    await actor.updateEmbeddedDocuments('Item', [aggregated]);

    const updated = actor.items.get(postFunction.aggregatedItemId);
    await updated.postItem();

    if (aggregated.system.cummulatedQS.value >= 10) {
      await updated.sheet?.postFinishedItem();
    }
  }
}

class WeaponItemDSA5 extends Itemdsa5 { }

class MoneyItemDSA5 extends Itemdsa5 {
  static checkEquality(item, item2) {
    return ItemEquality.checkMoneyEquality(item, item2);
  }
}

class SpellItemDSA5 extends Itemdsa5 {
  static async getCallbackData(testData, html, actor) {
    testData.testDifficulty = 0;
    testData.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);
    const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
    const formData = new foundry.applications.ux.FormDataExtended(form).object;
    testData.calculatedSpellModifiers = {
      castingTime: html.find('.castingTime').text(),
      cost: html.find('.aspcost').text(),
      reach: html.find('.reach').text(),
      maintainCost: html.find('.maintainCost').text(),
    };
    testData.situationalModifiers.push(
      ModifierCalculator.parseValueType(_loc('sight'), formData.vision || 0),
      {
        name: _loc('removeGesture'),
        value: Number(formData.removeGesture) || 0,
      },
      {
        name: _loc('removeFormula'),
        value: Number(formData.removeFormula) || 0,
      },
      {
        name: _loc('castingTime'),
        value: html.find('.castingTime').data('mod'),
      },
      {
        name: _loc('cost'),
        value: html.find('.aspcost').data('mod'),
      },
      {
        name: _loc('reach'),
        value: html.find('.reach').data('mod'),
      },
      {
        name: _loc('zkModifier'),
        value: formData.zkModifier || 0,
      },
      {
        name: _loc('skModifier'),
        value: formData.skModifier || 0,
      },
      {
        name: _loc('maintainedSpells'),
        value: formData.maintainedSpells * -1,
      },
    );
    testData.extensions = SpellItemDSA5.getSpecAbModifiers(html);
    testData.advancedModifiers = {
      chars: [0, 1, 2].map((x) => formData[`ch${x}`]),
      fws: formData.fw,
      qls: formData.qs,
    };
    Itemdsa5.updateCharacteristics(testData.source, ...[0, 1, 2].map((x) => formData[`characteristics${x}`]));
    await this.applyExtensions(testData.source, testData.extensions, actor);
  }

  static async applyExtensions(source, extensions, actor) {
    RuleChaos.ensureNumber(source);
    const rollModifiers = Object.keys(DSA5SpellDialog.rollModifiers).map((x) => `${x}.mod`);
    for (const extension of extensions) {
      const item = fromUuidSync(extension.uuid);
      if (!item) continue;

      for (const ef of item.effects) {
        for (const change of ef.system.changes) {
          if (DSA5SpellDialog.rollChanges.includes(change.key)) continue;
          if (rollModifiers.includes(change.key)) continue;

          if (change.key == 'macro.transform') {
            await DSA5_Utility.callItemTransformationMacro(change.value, source, ef);
          } else if (change.key == 'system.effectFormula.value' && change.type === 'add') {
            source.system.effectFormula.value = source.system.effectFormula.value
              .split(',')
              .map((x) => {
                return x + change.value;
              })
              .join(',');
          } else {
            ef.apply(source, change);
          }
        }
      }
    }
  }

  static getSpecAbModifiers(html) {
    const res = [];
    for (const k of html.find('.specAbs.active')) {
      res.push({
        name: k.dataset.name,
        title: k.dataset.tooltip,
        uuid: k.dataset.uuid,
      });
    }
    return res;
  }

  static attackSpellMalus(source) {
    const res = [];
    if (source.system.effectFormula.value)
      res.push({
        name: _loc('MODS.defenseMalus'),
        value: ITEM_CONSTANTS.RANGE_DEFENSE_MALUS,
        type: 'defenseMalus',
        selected: true,
        source: source.name,
      });

    return res;
  }

  static getPropertyModifiers(actor, item) {
    const isClerical = [CEREMONY, LITURGY].includes(item.type);
    const features = (getProperty(item, 'system.feature') || '')
      .replace(/\(a-z äöü-\)/gi, '')
      .split(',')
      .map((x) => x.trim());
    const res = [];

    const cost = isClerical ? 'KaPCost' : 'AsPCost';
    const keys = ['FP', 'step', 'QL', 'TPM', 'FW', 'CMP', cost];
    for (const k of keys) {
      const type = k == 'step' ? '' : k;
      const modifiers = getProperty(actor.system.skillModifiers, `feature.${k}`);
      res.push(
        ...modifiers
          .filter((x) => features.includes(x.target))
          .map((f) => {
            return {
              name: f.source,
              value: f.value,
              type,
              source: f.source,
              ref: f.ref || null,
            };
          }),
      );
    }
    const conditional = getProperty(actor.system.skillModifiers, `conditional.${cost}`);
    res.push(
      ...conditional.map((f) => {
        return {
          name: f.target,
          value: f.value,
          source: f.source,
          type: cost,
          ref: f.ref || null,
        };
      }),
    );

    return res;
  }

  static foreignSpellModifier(actor, source, situationalModifiers, data) {
    const enabledActorTypes = [ACTOR_TYPES.NPC, ACTOR_TYPES.CHARACTER];
    const applicableSpellTypes = [SPELL, RITUAL];
    const hasPreferencePenalty = SpellPreferenceRule.isEnabled() && SpellPreferenceRule.hasPreferences(actor);

    if (!(game.settings.get('dsa5', 'enableForeignSpellModifer') || hasPreferencePenalty) ||
      !enabledActorTypes.includes(actor.type) ||
      !applicableSpellTypes.includes(source.type)) return;

    const traditionLabel = _loc('tradition');
    const distributions = DSA5_Utility.cleanTraditionTokens(source.system.distribution.value, traditionLabel);
    const fromActorTraditions = DSA5_Utility.cleanTraditionTokens(actor.system.tradition.magical, traditionLabel);
    const fromSpecials = actor.items
      .filter(i => i.type === 'specialability' && i.name.startsWith(traditionLabel))
      .map(i => i.name)
      .flatMap((name) => DSA5_Utility.cleanTraditionTokens(name, traditionLabel));

    const ownTraditions = [...fromActorTraditions, ...fromSpecials, _loc('general').toLowerCase()];

    data.isForeign = !DSA5_Utility.hasMatchingTradition(distributions, ownTraditions);

    const modOffset = (actor.system.spellStats.foreign || 0) + (actor.system.spellStats[`foreign${source.type}`] || 0);

    if (data.isForeign) {
      const basePenalty = hasPreferencePenalty ? -4 : -2;
      situationalModifiers.push({
        name: _loc(hasPreferencePenalty ? 'DSASETTINGS.enableWitchSpellPreferences' : 'DSASETTINGS.enableForeignSpellModifer'),
        value: basePenalty + modOffset,
        selected: true,
      });
    }
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    situationalModifiers.push(
      ...ItemRulesDSA5.getTalentBonus(actor, source.name, ['advantage', 'disadvantage', 'specialability', 'equipment']),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.magicalAttunement', 1, true),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.magicalRestriction', -1, true),
      ...this.getPropertyModifiers(actor, source),
      ...this.attackSpellMalus(source),
    );

    this.foreignSpellModifier(actor, source, situationalModifiers, data);
    if (game.user.targets.size) {
      game.user.targets.forEach((target) => {
        if (target.actor) {
          CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor);
          CombatSystem.checkDuplicatus(actor, target.actor, situationalModifiers);
        }
      });
    }
    situationalModifiers.push(...SpellModifiers.get(actor, source.name, source.type));

    for (const thing of actor.system.skillModifiers.global) situationalModifiers.push({ name: thing.source, value: thing.value });

    ModifierCalculator.getSkZkModifier(data, source);
    Object.assign(data, {
      visionOptions: DSA5.skillVision,
    });
  }

  static setupDialog(ev, options, spell, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = ItemDialogBuilder.createSpellDialog(spell, actor, tokenId, options)

    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, spell);

    dialogOptions.callback = async (html, options = {}) => {
      cardOptions.messageMode = html.find('[name="messageMode"]:checked').val();
      await this.getCallbackData(testData, html, actor);
      mergeObject(testData.extra.options, options);
      testData.hideSpellDetails = game.settings.get('dsa5', 'hideSpellDetails');
      return { testData, cardOptions };
    }

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class LiturgyItemDSA5 extends SpellItemDSA5 { }

class CeremonyItemDSA5 extends LiturgyItemDSA5 {
  static getCallbackData(testData, html, actor) {
    super.getCallbackData(testData, html, actor);
    testData.situationalModifiers.push(
      {
        name: _loc('CEREMONYMODIFIER.artefact'),
        value: html.find('[name="artefactUsage"]').is(':checked') ? 1 : 0,
      },
      {
        name: _loc('place'),
        value: html.find('[name="placeModifier"]').val(),
      },
      {
        name: _loc('time'),
        value: html.find('[name="timeModifier"]').val(),
      },
    );
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    super.getSituationalModifiers(situationalModifiers, actor, data, source);

    let timeModifier = 0;
    const traditionItem = actor.items.find(x => x.type == "specialability" && x.name.startsWith(_loc('LocalizedIDs.assumeTradition')));
    const assumeTradition = (traditionItem?.name || actor.system.tradition.clerical)?.toLowerCase() || '';
    const calendar = game.time.calendar;

    if (assumeTradition && calendar?.constructor?.isDSAcompatible) {
      const components = calendar.timeToComponents(game.time.worldTime);
      const gameMonth = components.month;
      const monthName = calendar.constructor.months[gameMonth].toLowerCase();
      const day = components.dayOfMonth;

      const holidays = CONFIG.time.worldCalendarConfig.holidays.values;
      const isHoliday = holidays.some(h => {
        if (h.month !== gameMonth || !h.gods) return false;
        if (!h.gods.some(g => assumeTradition.includes(g.toLowerCase()))) return false;
        return h.dayEnd ? (h.dayStart <= day && h.dayEnd >= day) : (h.dayStart === day);
      });

      if (isHoliday) {
        timeModifier = 2;
      } else if (assumeTradition.includes(monthName)) {
        timeModifier = 1;
      } else if (monthName === 'namenloser') {
        timeModifier = -5;
      }
    }

    mergeObject(data, {
      isCeremony: true,
      locationModifiers: DSA5.ceremonyLocationModifiers,
      timeModifier,
      timeModifiers: DSA5.ceremonyTimeModifiers,
    });
  }
}

class CombatskillDSA5 extends Itemdsa5 {
  static setupDialog(ev, options, item, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = ItemDialogBuilder.createCombatDialog(item, actor, tokenId, options);
    dialogOptions.callback = (html, options = {}) => {
      cardOptions.messageMode = html.find('[name="messageMode"]:checked').val();
      testData.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);
      mergeObject(testData.extra.options, options);
      return { testData, cardOptions };
    }
    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class ConsumableItemDSA extends Itemdsa5 {
  static consumablePrice(item) {
    let price = item.system.price.value;
    if (isNaN(price)) {
      const priceTags = price.split(';');
      price = Number(priceTags[item.system.QL - 1]);
      if (isNaN(price)) price = Number(priceTags.pop()) || 0;

      return price;
    } else {
      return Number(price) * item.system.QL || 0;
    }
  }

  static checkEquality(item, item2) {
    return ItemEquality.checkConsumableEquality(item, item2);
  }

  static async setupDialog(ev, options, item, actor, tokenId) {
    if (!item.isOwned) return;

    const charges = (item.system.quantity.value - 1) * item.system.maxCharges + item.system.charges;
    if (charges <= 0) {
      ui.notifications.error('DSAError.NotEnoughCharges', { localize: true });
      return;
    }

    const newCharges = item.system.charges <= 1 ? item.system.maxCharges : item.system.charges - 1;
    const newQuantity = item.system.charges <= 1 ? item.system.quantity.value - 1 : item.system.quantity.value;

    const effect = DSA5_Utility.replaceDies(item.system.QLList.split('\n')[item.system.QL - 1], false);
    if (newQuantity == 0) {
      await item.actor.deleteEmbeddedDocuments('Item', [item.id]);
    } else {
      await item.update({
        'system.quantity.value': newQuantity,
        'system.charges': newCharges,
      });
    }

    await this._createUseChatMessage(item, actor, tokenId, effect, {
      hasAreaTemplate: item.system.target && item.system.target.type in DSA5.areaTargetTypes,
      postData: {
        qualityStep: item.system.QL,
      },
    });
    await this._applyItemUseActiveEffect(item, {
      qualityStep: item.system.QL,
    });
  }

  static async combineItem(item1, item2, actor, render = true) {
    item1 = duplicate(item1);
    const charges = (item1.system.quantity.value - 1) * item1.system.maxCharges + item1.system.charges;
    const item2charges = (item2.system.quantity.value - 1) * item2.system.maxCharges + item2.system.charges;
    let newQuantity = Math.floor((charges + item2charges) / item1.system.maxCharges) + 1;
    let newCharges = (charges + item2charges) % item1.system.maxCharges;
    if (newCharges == 0) {
      newQuantity -= 1;
      newCharges = item1.system.maxCharges;
    }
    item1.system.quantity.value = newQuantity;
    item1.system.charges = newCharges;
    return await actor.updateEmbeddedDocuments('Item', [item1], { render });
  }
}

class PlantItemDSA5 extends Itemdsa5 {
  static async setupDialog(ev, options, item, actor, tokenId) {
    if (!item.isOwned) return;

    const quantity = Number(item.system.quantity.value) || 0;
    if (quantity <= 0) {
      ui.notifications.error('DSAError.NotEnoughItems', { localize: true });
      return;
    }

    const newQuantity = quantity - 1;
    const effect = item.system.effect || '';
    if (newQuantity > 0) {
      await item.update({ 'system.quantity.value': newQuantity });
    }

    await this._createUseChatMessage(item, actor, tokenId, effect, {
      applyEffect: item.effects.length > 0,
      hasAreaTemplate: false,
    });

    await this._applyItemUseActiveEffect(item);

    if (OnUseEffect.hasOnUseEffect(item)) {
      await new OnUseEffect(item).executeOnUseEffect();
    }

    if (newQuantity <= 0) {
      await item.actor.deleteEmbeddedDocuments('Item', [item.id]);
    }
  }

}

class DiseaseItemDSA5 extends Itemdsa5 {
  static setupDialog(ev, options, item, actor, tokenId) {
    return ResistanceTests.setupDialog(
      ev,
      options,
      item,
      actor,
      tokenId,
      'LocalizedIDs.ResistanttoDisease'
    );
  }
}

class MeleeweaponDSA5 extends WeaponItemDSA5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    const wrongHandDisabled = AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.ambidextrous');
    source = DSA5_Utility.toObjectIfPossible(source);
    const toSearch = [source.system.combatskill.value];
    const combatSpecAbs = CombatSpecialAbilities.build(actor, ['Combat'], toSearch, data.mode, source);

    if (data.mode == ITEM_CONSTANTS.COMBAT_MODES.ATTACK) {
      CombatSystem.prepareMeleeAttack(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled);
      CombatSystem.addWeaponModifiers(situationalModifiers, source, ITEM_CONSTANTS.COMBAT_MODES.DAMAGE);
    } else if (data.mode == ITEM_CONSTANTS.COMBAT_MODES.PARRY) {
      CombatSystem.prepareMeleeParry(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled);
    }
    CombatSystem.addWeaponModifiers(situationalModifiers, source, data.mode);

    CombatSystem.addAttackStatEffect(situationalModifiers, actor.system.meleeStats[data.mode]);
    CombatSystem.addSpeciesModifiers(situationalModifiers, actor, data, source);

    if ([ITEM_CONSTANTS.COMBAT_MODES.ATTACK, ITEM_CONSTANTS.COMBAT_MODES.PARRY].includes(data.mode)) {
      situationalModifiers.push(
        ...MiracleModifiers.get(actor, { name: source.system.combatskill.value }, '', data.mode),
        ...actor.getCombatEffectSkillModifier(source.system.combatskill.value, data.mode),
      );
    }
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = ItemDialogBuilder.createCombatDialog(item, actor, tokenId, options);

    const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, DSA5_Utility.toObjectIfPossible(item));
    dialogOptions.data.multipleDefenseValue = multipleDefenseValue;
    dialogOptions.data.defenseCountString = _loc('defenseCount', { malus: multipleDefenseValue });
    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, item);

    dialogOptions.callback = (html, options = {}) => {
      DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, dialogOptions.data.mode);
      Hooks.call('callbackDialogCombatDSA5', testData, actor, html, item, tokenId);
      testData.isRangeDefense = dialogOptions.data.isRangeDefense;
      return { testData, cardOptions };
    }

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class PoisonItemDSA5 extends Itemdsa5 {
  static setupDialog(ev, options, item, actor, tokenId) {
    return ResistanceTests.setupDialog(
      ev,
      options,
      item,
      actor,
      tokenId,
      'LocalizedIDs.poisonResistance'
    );
  }
}

class RangeweaponItemDSA5 extends WeaponItemDSA5 {
  static getSituationalModifiers(situationalModifiers, actor, data, _source, tokenId) {
    if (data.mode == ITEM_CONSTANTS.COMBAT_MODES.ATTACK) {
      const source = DSA5_Utility.toObjectIfPossible(_source);

      const toSearch = [source.system.combatskill.value];
      const combatSpecAbs = CombatSpecialAbilities.build(actor, ['Combat'], toSearch, data.mode, source);
      let currentAmmo = actor.items.get(source.system.currentAmmo.value);

      if (currentAmmo) {
        currentAmmo = currentAmmo.toObject(false);
        source.system.effect.attributes = (source.system.effect.attributes || '')
          .split(',')
          .concat((currentAmmo.system.effect.attributes || '').split(','))
          .filter((x) => x != '')
          .join(',');
        const poison = getProperty(currentAmmo.flags, 'dsa5.poison');
        if (poison) mergeObject(_source.flags, { dsa5: { poison } });
      }

      CombatSystem.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatSpecAbs, currentAmmo);

      if (currentAmmo) {
        if (currentAmmo.system.atmod) {
          situationalModifiers.push({
            name: `${currentAmmo.name} - ${_loc('atmod')}`,
            value: currentAmmo.system.atmod,
            selected: true,
            ref: { id: source.system.currentAmmo.value },
          });
        }
        if (currentAmmo.system.damageMod || currentAmmo.system.armorMod) {
          const dmgMod = {
            name: `${currentAmmo.name} - ${_loc('MODS.damage')}`,
            value: currentAmmo.system.damageMod.replace(/wWD/g, 'd') || 0,
            type: 'dmg',
            selected: true,
            ref: { id: source.system.currentAmmo.value },
          };
          if (currentAmmo.system.armorMod) dmgMod.armorPen = currentAmmo.system.armorMod;

          situationalModifiers.push(dmgMod);
        }
        if (currentAmmo.effects.length) {
          situationalModifiers.push({
            name: `${currentAmmo.name} - ${_loc('TYPES.Item.ammunition')}`,
            value: 1,
            type: 'effect',
            selected: true,
            ref: { id: source.system.currentAmmo.value },
          });
        }
      }

      CombatSystem.addWeaponModifiers(situationalModifiers, source, ITEM_CONSTANTS.COMBAT_MODES.ATTACK);
      CombatSystem.addWeaponModifiers(situationalModifiers, source, ITEM_CONSTANTS.COMBAT_MODES.DAMAGE);

      situationalModifiers.push(
        ...MiracleModifiers.get(actor, { name: source.system.combatskill.value }, '', data.mode),
        ...actor.getCombatEffectSkillModifier(source.system.combatskill.value, data.mode),
      );
    }
    CombatSystem.addAttackStatEffect(situationalModifiers, actor.system.rangeStats[data.mode]);
    CombatSystem.addSpeciesModifiers(situationalModifiers, actor, data, _source);
  }

  static async checkAmmunitionState(item, testData, actor, mode) {
    let hasAmmo = true;
    if (mode != ITEM_CONSTANTS.COMBAT_MODES.DAMAGE) {
      const itemData = item.system;
      if (itemData.ammunitiongroup.value == 'infinite') {
        //Dont count ammo
      } else if (itemData.ammunitiongroup.value == '-') {
        testData.extra.ammo = duplicate(item);
        hasAmmo = testData.extra.ammo.system.quantity.value > 0;
      } else {
        const ammoItem = actor.items.get(itemData.currentAmmo.value);
        if (ammoItem) {
          testData.extra.ammo = ammoItem.toObject();
          if (itemData.ammunitiongroup.value == 'mag') {
            hasAmmo = testData.extra.ammo.system.quantity.value > 1 || (testData.extra.ammo.system.mag.value > 0 && testData.extra.ammo.system.quantity.value > 0);
          } else {
            hasAmmo = testData.extra.ammo.system.quantity.value > 0;
          }
        } else {
          hasAmmo = false;
        }
      }
      if (!hasAmmo && actor.type == 'creature') hasAmmo = true;
    }
    if (!hasAmmo) ui.notifications.error('DSAError.NoAmmo', { localize: true });

    return hasAmmo;
  }

  static async setupDialog(ev, options, item, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = ItemDialogBuilder.createCombatDialog(item, actor, tokenId, options);

    if (!(await this.checkAmmunitionState(item, testData, actor, options.mode))) return;

    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, item, tokenId);

    dialogOptions.callback = (html, options = {}) => {
      DSA5CombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options);
      Hooks.call('callbackDialogCombatDSA5', testData, actor, html, item, tokenId);
      return { testData, cardOptions };
    }

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class RitualItemDSA5 extends SpellItemDSA5 {
  static getCallbackData(testData, html, actor) {
    super.getCallbackData(testData, html, actor);
    testData.situationalModifiers.push(
      {
        name: _loc('RITUALMODIFIER.rightClothes'),
        value: html.find('[name="rightClothes"]').is(':checked') ? 1 : 0,
      },
      {
        name: _loc('RITUALMODIFIER.rightEquipment'),
        value: html.find('[name="rightEquipment"]').is(':checked') ? 1 : 0,
      },
      {
        name: _loc('place'),
        value: html.find('[name="placeModifier"]').val(),
      },
      {
        name: _loc('time'),
        value: html.find('[name="timeModifier"]').val(),
      },
    );
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    super.getSituationalModifiers(situationalModifiers, actor, data, source);

    mergeObject(data, {
      isRitual: true,
      locationModifiers: DSA5.ritualLocationModifiers,
      showRightClothes: true,
      timeModifier: 0,
      timeModifiers: DSA5.ritualTimeModifiers,
    });
  }
}

class ApplicationItemDSA5 extends Itemdsa5 { }

class SkillItemDSA5 extends Itemdsa5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    situationalModifiers.push(
      ...ItemRulesDSA5.getTalentBonus(actor, source.name, [
        'advantage',
        'disadvantage',
        'specialability',
        'equipment'
      ]),
      ...SpellModifiers.get(actor, source.name, source.type),
      ...MiracleModifiers.get(actor, source, 'FW', SKILL),
    );

    // Add global skill modifiers
    for (const thing of actor.system.skillModifiers.global) {
      situationalModifiers.push({
        name: thing.source,
        value: thing.value
      });
    }

    Object.assign(data, {
      visionOptions: DSA5.skillVision,
    });
  }

  static prepareFocusRuleModifiers(data, actor, skill) {
    const reverseLookUp = _loc(`LocalizedSkills.${skill.name}`);
    const modifierData = game.dsa5.config.SKILL[reverseLookUp];

    if (!modifierData) return;

    data.focusRuleModifiers = modifierData;
  }

  static async setupDialog(ev, options, skill, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = ItemDialogBuilder.createSkillDialog(skill, actor, tokenId, options);

    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, skill);
    this.prepareFocusRuleModifiers(dialogOptions.data, actor, skill);
    await PersonaeSocialContactService.appendModifierForSkill(dialogOptions.data.situationalModifiers, { skill, actor });

    dialogOptions.callback = (html, options = {}) => {
      cardOptions.messageMode = html.find('[name="messageMode"]:checked').val();
      const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
      const formData = new foundry.applications.ux.FormDataExtended(form).object;
      testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
      testData.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);
      testData.situationalModifiers.push(
        ModifierCalculator.parseValueType(_loc('sight'), formData.vision || 0),
      );
      testData.advancedModifiers = {
        chars: [0, 1, 2].map((x) => Number(html.find(`[name="ch${x}"]`).val())),
        fws: Number(html.find(`[name="fw"]`).val()),
        qls: Number(html.find(`[name="qs"]`).val()),
      };
      Itemdsa5.updateCharacteristics(testData.source, ...[0, 1, 2].map((x) => html.find(`[name="characteristics${x}"]`).val()));
      mergeObject(testData.extra.options, options);
      return { testData, cardOptions };
    }

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class TraitItemDSA5 extends WeaponItemDSA5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source, tokenId) {
    source = DSA5_Utility.toObjectIfPossible(source);
    const traitType = source.system.traitType.value;
    const combatSpecialabilities = CombatSpecialAbilities.build(actor, ['Combat', 'animal'], undefined, data.mode, source);

    if (data.mode == ITEM_CONSTANTS.COMBAT_MODES.ATTACK && traitType == 'meleeAttack') {
      CombatSystem.prepareMeleeAttack(situationalModifiers, actor, data, source, combatSpecialabilities, false);
      CombatSystem.addWeaponModifiers(situationalModifiers, source, ITEM_CONSTANTS.COMBAT_MODES.DAMAGE);
    } else if (data.mode == ITEM_CONSTANTS.COMBAT_MODES.ATTACK && traitType == 'rangeAttack') {
      CombatSystem.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatSpecialabilities);
      CombatSystem.addWeaponModifiers(situationalModifiers, source, ITEM_CONSTANTS.COMBAT_MODES.DAMAGE);
    } else if (data.mode == ITEM_CONSTANTS.COMBAT_MODES.PARRY) {
      CombatSystem.prepareMeleeParry(situationalModifiers, actor, data, source, combatSpecialabilities, false);
    }
    CombatSystem.addWeaponModifiers(situationalModifiers, source, data.mode);
    CombatSystem.addAttackStatEffect(situationalModifiers, actor.system[traitType == 'meleeAttack' ? 'meleeStats' : 'rangeStats'][data.mode]);
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = ItemDialogBuilder.createCombatDialog(item, actor, tokenId, options);

    const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, item.toObject());
    dialogOptions.data.multipleDefenseValue = multipleDefenseValue;
    dialogOptions.data.defenseCountString = _loc('defenseCount', {
      malus: multipleDefenseValue,
    });

    const traitType = item.system.traitType.value;
    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, item, tokenId);

    dialogOptions.callback = (html, options = {}) => {
      if (traitType == 'meleeAttack') {
        DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, dialogOptions.data.mode);
      } else {
        DSA5CombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options);
      }
      testData.isRangeDefense = dialogOptions.data.isRangeDefense;
      Hooks.call('callbackDialogCombatDSA5', testData, actor, html, item, tokenId);
      return { testData, cardOptions };
    }

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}
