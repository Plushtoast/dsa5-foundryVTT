import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import ItemRulesDSA5 from '../system/rules/item-rules-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effects.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import CreatureType from '../system/automation/creature-type.js';
import DSA5CombatDialog from '../dialog/dialog-combat-dsa5.js';
import DSA5SpellDialog from '../dialog/dialog-spell-dsa5.js';
import { ITEM_CONSTANTS } from '../config/item-constants.js';
import { ModifierCalculator } from './concerns/modifier-calculator.js';
import { CombatSystem } from './concerns/combat-system.js';
import { ItemFactory } from './item-factory.js';
import { DialogBuilder } from './dialog-builder.js';
import { CombatSpecialAbilities } from './concerns/combat-special-abilities.js';
import { MiracleModifiers } from './concerns/miracle-modifiers.js';
import { ResistanceTests } from './concerns/resistance-tests.js';
import { ItemEquality } from './concerns/item-equality.js';
const { getProperty, mergeObject, duplicate } = foundry.utils;
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

/** @constant {Object<string, string>} Actor types */
const ACTOR_TYPES = {
  CHARACTER: 'character',
  NPC: 'npc',
  CREATURE: 'creature'
};

/** @constant {string} Opposition indicator for chat titles */
const OPPOSED_SUFFIX = ' - ';

const { SPELL, LITURGY, CEREMONY, RITUAL, SKILL } = ITEM_CONSTANTS.TEST_TYPES;

/**
 * DSA5 Item class extending Foundry VTT's base Item class
 * Handles all item types in the Das Schwarze Auge 5 system
 * @extends {Item}
 */
export default class Itemdsa5 extends Item {
  /** @type {string} Default icon path for items without specific icons */
  static DEFAULT_ICON = ITEM_CONSTANTS.DEFAULT_ICON_PATH;

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
      for (let d of data) {
        this.defaultIcon(d);
      }
    } else {
      this.defaultIcon(data);
    }
    return await super.create(data, options);
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
   *   - {string} specAbId - Special ability ID
   *   - {string} [type] - Modifier type (optional)
   *   - {Object} flatValues - Flat values object
   */
  static getSpecAbModifiers(html, mode) {
    const res = [];
    const isAttack = mode === ITEM_CONSTANTS.COMBAT_MODES.ATTACK;
    const mainAttribute = isAttack ? ITEM_CONSTANTS.ATTACK : ITEM_CONSTANTS.PARRY;

    const matchers = {
      [mainAttribute]: 'value',
      [ITEM_CONSTANTS.DAMAGE]: 'damageBonus',
      [ITEM_CONSTANTS.DEFENSE_MALUS]: 'dmmalus',
    };

    for (const element of html.find('.specAbs')) {
      const dataset = element.dataset;
      const step = Number(dataset.step);

      if (step <= 0) continue;

      const modifier = ModifierCalculator.parseModifierValue(dataset, mainAttribute, step);
      if (!modifier) continue;

      const flatValues = ModifierCalculator.extractFlatValues(dataset, matchers);

      res.push({
        name: $(element).find('a').text().trim(),
        value: modifier.value + (flatValues.value || 0),
        damageBonus: dataset.tpbonus,
        dmmalus: Number(dataset.dmmalus) * step + (flatValues.dmmalus || 0),
        step,
        specAbId: dataset.id,
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
      ritual: RitualItemDSA5,
      spell: SpellItemDSA5,
      liturgy: LiturgyItemDSA5,
      ceremony: CeremonyItemDSA5,
      trait: TraitItemDSA5,
      disease: DiseaseItemDSA5,
      poison: PoisonItemDSA5,
      money: MoneyItemDSA5,
      rangeweapon: RangeweaponItemDSA5,
      meleeweapon: MeleeweaponDSA5,
      combatskill: CombatskillDSA5,
      skill: SkillItemDSA5,
      application: ApplicationItemDSA5,
      consumable: ConsumableItemDSA,
    });
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
    for (let doc of documents) {
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
    let result = await DiceDSA5.rollTest(testData);

    result.postFunction = 'itemTest';

    if (game.user.targets.size) {
      cardOptions.isOpposedTest = testData.opposable;
      const opposed = OPPOSED_SUFFIX + game.i18n.localize('Opposed');
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
    testData.situationalModifiers = Actordsa5._parseModifiers(html);
    const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
    const formData = new foundry.applications.ux.FormDataExtended(form).object;
    testData.calculatedSpellModifiers = {
      castingTime: html.find('.castingTime').text(),
      cost: html.find('.aspcost').text(),
      reach: html.find('.reach').text(),
      maintainCost: html.find('.maintainCost').text(),
    };
    testData.situationalModifiers.push(
      ModifierCalculator.parseValueType(game.i18n.localize('sight'), formData.vision || 0),
      {
        name: game.i18n.localize('removeGesture'),
        value: Number(formData.removeGesture) || 0,
      },
      {
        name: game.i18n.localize('removeFormula'),
        value: Number(formData.removeFormula) || 0,
      },
      {
        name: game.i18n.localize('castingTime'),
        value: html.find('.castingTime').data('mod'),
      },
      {
        name: game.i18n.localize('cost'),
        value: html.find('.aspcost').data('mod'),
      },
      {
        name: game.i18n.localize('reach'),
        value: html.find('.reach').data('mod'),
      },
      {
        name: game.i18n.localize('zkModifier'),
        value: formData.zkModifier || 0,
      },
      {
        name: game.i18n.localize('skModifier'),
        value: formData.skModifier || 0,
      },
      {
        name: game.i18n.localize('maintainedSpells'),
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
    for (let extension of extensions) {
      const item = fromUuidSync(extension.uuid);
      if (!item) continue;

      for (let ef of item.effects) {
        for (let change of ef.changes) {
          if (DSA5SpellDialog.rollChanges.includes(change.key)) continue;
          if (rollModifiers.includes(change.key)) continue;

          if (change.key == 'macro.transform') {
            await DSA5_Utility.callItemTransformationMacro(change.value, source, ef);
          } else if (change.key == 'system.effectFormula.value' && change.mode == 2) {
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
    for (let k of html.find('.specAbs.active')) {
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
        name: game.i18n.localize('MODS.defenseMalus'),
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
    const keys = ['FP', 'step', 'QL', 'TPM', 'FW', cost];
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
        };
      }),
    );

    return res;
  }

  /**
   * Apply foreign spell modifier if enabled and applicable
   * @static
   * @param {Object} actor - Actor casting the spell
   * @param {Object} source - Spell item being cast
   * @param {Array<Object>} situationalModifiers - Array to add modifiers to
   * @param {Object} data - Data object to modify with foreign spell status
   * @returns {void}
   */
  static foreignSpellModifier(actor, source, situationalModifiers, data) {
    const enabledActorTypes = [ACTOR_TYPES.NPC, ACTOR_TYPES.CHARACTER];
    const applicableSpellTypes = [SPELL, RITUAL];

    if (game.settings.get('dsa5', 'enableForeignSpellModifer') &&
        enabledActorTypes.includes(actor.type) &&
        applicableSpellTypes.includes(source.type)) {
      
      const distributions = source.system.distribution.value.split(',').map((x) => x.trim().toLowerCase());
      const regx = new RegExp(`(${game.i18n.localize('tradition')}|\\\)|\\\()`, 'g');
      const traditions = actor.system.tradition.magical
        .replace(regx, '')
        .split(',')
        .map((x) => x.trim().toLowerCase());
      traditions.push(game.i18n.localize('general').toLowerCase());

      data.isForeign = !distributions.some((x) => traditions.includes(x));
      if (data.isForeign) {
        situationalModifiers.push({
          name: game.i18n.localize('DSASETTINGS.enableForeignSpellModifer'),
          value: -2,
          selected: true,
        });
      }
    }
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    situationalModifiers.push(
      ...ItemRulesDSA5.getTalentBonus(actor, source.name, ['advantage', 'disadvantage', 'specialability', 'equipment']),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.magicalAttunement', 1, true),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.magicalRestriction', -1, true),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.boundToArtifact', -1, true),
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
    situationalModifiers.push(...actor.getSkillModifier(source.name, source.type));

    for (const thing of actor.system.skillModifiers.global) situationalModifiers.push({ name: thing.source, value: thing.value });

    ModifierCalculator.getSkZkModifier(data, source);
    Object.assign(data, {
      visionOptions: DSA5.skillVision,
    });
  }

  static setupDialog(ev, options, spell, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = DialogBuilder.createSpellDialog(spell, actor, tokenId, options)    

    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, spell);

    dialogOptions.callback = async (html, options = {}) => {
      cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
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
        name: game.i18n.localize('CEREMONYMODIFIER.artefact'),
        value: html.find('[name="artefactUsage"]').is(':checked') ? 1 : 0,
      },
      {
        name: game.i18n.localize('place'),
        value: html.find('[name="placeModifier"]').val(),
      },
      {
        name: game.i18n.localize('time'),
        value: html.find('[name="timeModifier"]').val(),
      },
    );
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    super.getSituationalModifiers(situationalModifiers, actor, data, source);

    let timeModifier = 0;
    const traditionItem = actor.items.find(x => x.type == "specialability" && x.name.startsWith(game.i18n.localize('LocalizedIDs.assumeTradition')));
    let assumeTradition = (traditionItem?.name || actor.system.tradition.clerical)?.toLowerCase() || '';

    if (assumeTradition) {
      const components = game.time.calendar.timeToComponents(game.time.worldTime);
      const gameMonth = components.month;
      const monthName = game.time.calendar.constructor.months[gameMonth].toLowerCase();
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
    const { dialogOptions, testData, cardOptions } = DialogBuilder.createCombatDialog(item, actor, tokenId, options);
    dialogOptions.callback = (html, options = {}) => {
      cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
      testData.situationalModifiers = Actordsa5._parseModifiers(html);
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
    const msg = await renderTemplate('systems/dsa5/templates/chat/consumable-used.hbs', {
      item,
      effect,
      hasAreaTemplate: item.system.target && item.system.target.type in DSA5.areaTargetTypes,
    });
    if (newQuantity == 0) {
      await item.actor.deleteEmbeddedDocuments('Item', [item.id]);
    } else {
      await item.update({
        'system.quantity.value': newQuantity,
        'system.charges': newCharges,
      });
    }

    const chatOptions = DSA5_Utility.chatDataSetup(msg);
    chatOptions['flags.data'] = {
      preData: {
        source: item.toObject(),
        extra: {
          speaker: DialogBuilder.buildSpeaker(actor, tokenId),
        },
      },
      postData: {
        qualityStep: item.system.QL,
      },
    };
    await ChatMessage.create(chatOptions);
    await this._applyActiveEffect(item);
  }

  static async _applyActiveEffect(source) {
    let effects = source.effects.toObject();
    if (effects.length > 0) {
      const { msg, resistRolls, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(
        source.actor,
        effects,
        source,
        {
          qualityStep: source.system.QL,
        },
        source.actor,
      );

      const infoMsg = `${game.i18n.format('ActiveEffects.appliedEffect', {
        target: source.actor.token?.name || source.actor.name,
        source: effectNames.join(', '),
      })} ${msg || ''}`;
      ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    }
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
    const { dialogOptions, testData, cardOptions } = DialogBuilder.createCombatDialog(item, actor, tokenId, options);

    const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, DSA5_Utility.toObjectIfPossible(item));
    dialogOptions.data.multipleDefenseValue = multipleDefenseValue;
    dialogOptions.data.defenseCountString = game.i18n.format('defenseCount', { malus: multipleDefenseValue });
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
            name: `${currentAmmo.name} - ${game.i18n.localize('atmod')}`,
            value: currentAmmo.system.atmod,
            selected: true,
            specAbId: source.system.currentAmmo.value,
          });
        }
        if (currentAmmo.system.damageMod || currentAmmo.system.armorMod) {
          const dmgMod = {
            name: `${currentAmmo.name} - ${game.i18n.localize('MODS.damage')}`,
            value: currentAmmo.system.damageMod.replace(/wWD/g, 'd') || 0,
            type: 'dmg',
            selected: true,
            specAbId: source.system.currentAmmo.value,
          };
          if (currentAmmo.system.armorMod) dmgMod.armorPen = currentAmmo.system.armorMod;

          situationalModifiers.push(dmgMod);
        }
        if (currentAmmo.effects.length) {
          situationalModifiers.push({
            name: `${currentAmmo.name} - ${game.i18n.localize('TYPES.Item.ammunition')}`,
            value: 1,
            type: 'effect',
            selected: true,
            specAbId: source.system.currentAmmo.value,
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
      let itemData = item.system;
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
    const { dialogOptions, testData, cardOptions } = DialogBuilder.createCombatDialog(item, actor, tokenId, options);

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
        name: game.i18n.localize('RITUALMODIFIER.rightClothes'),
        value: html.find('[name="rightClothes"]').is(':checked') ? 1 : 0,
      },
      {
        name: game.i18n.localize('RITUALMODIFIER.rightEquipment'),
        value: html.find('[name="rightEquipment"]').is(':checked') ? 1 : 0,
      },
      {
        name: game.i18n.localize('place'),
        value: html.find('[name="placeModifier"]').val(),
      },
      {
        name: game.i18n.localize('time'),
        value: html.find('[name="timeModifier"]').val(),
      },
    );
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    super.getSituationalModifiers(situationalModifiers, actor, data, source);

    mergeObject(data, {
      isRitual: true,
      locationModifiers: DSA5.ritualLocationModifiers,
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
      ...actor.getSkillModifier(source.name, source.type),
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
    const reverseLookUp = game.i18n.localize(`LocalizedSkills.${skill.name}`);
    const modifierData = game.dsa5.config.SKILL[reverseLookUp];

    if (!modifierData) return;

    data.focusRuleModifiers = modifierData.modifiers;
  }

  static setupDialog(ev, options, skill, actor, tokenId) {
    const { dialogOptions, testData, cardOptions } = DialogBuilder.createSkillDialog(skill, actor, tokenId, options);

    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, skill);
    this.prepareFocusRuleModifiers(dialogOptions.data, actor, skill);

    dialogOptions.callback = (html, options = {}) => {
      cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
      const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
      const formData = new foundry.applications.ux.FormDataExtended(form).object;
      testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
      testData.situationalModifiers = Actordsa5._parseModifiers(html);
      testData.situationalModifiers.push(
        ModifierCalculator.parseValueType(game.i18n.localize('sight'), formData.vision || 0),
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
    const { dialogOptions, testData, cardOptions } = DialogBuilder.createCombatDialog(item, actor, tokenId, options);

    const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, item.toObject());
    dialogOptions.data.multipleDefenseValue = multipleDefenseValue;
    dialogOptions.data.defenseCountString = game.i18n.format('defenseCount', {
      malus: multipleDefenseValue,
    });

    const traitType = item.system.traitType.value;
    this.getSituationalModifiers(dialogOptions.data.situationalModifiers, actor, dialogOptions.data, item, tokenId);

    dialogOptions.callback = (html, options = {}) => {
      if (traitType == 'meleeAttack') {
        DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, options.mode);
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
