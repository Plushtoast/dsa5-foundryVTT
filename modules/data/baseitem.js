import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import DSA5Payment from '../system/payment/payment.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import { DSADataModel } from './abstract.js';

import { ItemFactory } from '../item/item-factory.js';
const { renderTemplate } = foundry.applications.handlebars;

export class ItemDataModel extends DSADataModel {
  /**
   * @async
   * @param {Object} data - The data to prepare for the sheet
   * @returns {Promise<Object>} The prepared sheet data
   */
  async getSheetData(data) {
    // Implementation placeholder for child classes
    return data;
  }

  /**
   * Get the associated actor if any
   * @returns {Actor|null} The parent actor or null
   */
  get actor() {
    return this.parent?.actor || null;
  }

  get effectMultiplier() {
    return 1;
  }

  /**
   * Prepares domain attributes for display
   * @returns {string|null} Formatted HTML for domain attributes
   */
  prepareDomains() {
    const dom = this.effect?.attributes;
    if (!dom) return null;

    const MAGICAL_REGEX = new RegExp(_loc('WEAPON.magical'), 'i');
    const BLESSED_REGEX = new RegExp(_loc('WEAPON.clerical'), 'i');

    return dom
      .split(',')
      .map(x => {
        const trimmed = x.trim();
        let cssClass = '';
        if (MAGICAL_REGEX.test(trimmed)) cssClass = 'magical';
        else if (BLESSED_REGEX.test(trimmed)) cssClass = 'blessed';
        return `<li class="${cssClass}">${trimmed}</li>`;
      })
      .join('');
  }

  /**
   * Helper function to format a chat line
   * @param {Object} options - Line data options
   * @param {string} options.key - The key to be localized
   * @param {string} options.val - The value to display
   * @param {boolean} [options.localizeVal=false] - Whether to localize the value
   * @returns {string} Formatted HTML line
   */
  static _chatLineHelper({ key, val, localizeVal = false }) {
    const displayValue = localizeVal ? _loc(val) : val;
    return `<b>${_loc(key)}</b>: ${displayValue || '-'}`;
  }

  /**
   * Get chat data for the item
   * @param {Object} data - The item data
   * @param {string} name - The item name
   * @returns {Array} Array of chat data objects
   */
  static chatData(data, name) {
    return [];
  }

  /**
   * Post item data to chat
   * @async
   * @param {Item} item - The item to post
   * @returns {Promise<ChatMessage>} The created chat message
   */
  static async _postItem(item) {
    const chatData = foundry.utils.duplicate(item);
    const detailsObfuscated = foundry.utils.getProperty(chatData, 'system.obfuscation.details');
    const descriptionObfuscated = foundry.utils.getProperty(chatData, 'system.obfuscation.description');

    // Prepare properties array
    const properties = detailsObfuscated 
      ? [] 
      : this.chatData(chatData.system, item.name).map(x => this._chatLineHelper(x));

    // Add price information if available
    const hasPrice = 'price' in chatData.system && !detailsObfuscated;
    if (hasPrice) {
      let price = chatData.system.price.value;
      if (chatData.system.QL) {
        price = ItemFactory.getSubClass(chatData.type).consumablePrice(chatData);
      }
      const prices = await DSA5Payment._moneyToString(price);
      properties.push(`<b>${_loc('price')}</b>: ${prices}`);
    }

    // Merge properties into chat data
    foundry.utils.mergeObject(chatData, {
      properties,
      descriptionObfuscated,
      hasPrice,
      itemLink: item.pack ? item.link : null,
      img: chatData.img.includes('/blank.webp') ? null : chatData.img
    });

    // Create and send chat message
    const html = await renderTemplate('systems/dsa5/templates/chat/post-item.hbs', chatData);
    const chatOptions = DSA5_Utility.chatDataSetup(html);
    return ChatMessage.create(chatOptions);
  }

  /**
   * Get a copy of the item with overrides applied
   * @returns {Object} The item with overrides applied
   */
  itemWithOverrides() {
    const object = this.parent.toObject();
    const overrides = foundry.utils.flattenObject(this.parent.overrides || {});
    foundry.utils.mergeObject(object, overrides);
    return object;
  }

  /**
   * Prepare the item for display in an embedded sheet
   * @returns {Object} The prepared item data
   */
  prepareEmbeddedItemSheet() {
    return this.itemWithOverrides();
  }

  /**
   * Prepare item structure information
   * @param {Object} item - The item to prepare
   * @returns {Object} The prepared item
   */
  static _prepareItemStructure(item) {
    // Handle structure
    if (item.system.structure && item.system.structure.max != 0) {
      item.structureMax = item.system.structure.max;
      item.structureCurrent = item.system.structure.value;
    }

    // Handle enchantment classes
    const enchants = foundry.utils.getProperty(item, 'flags.dsa5.enchantments');
    if (enchants && enchants.length > 0) {
      item.enchantClass = 'rar';
    } else if (item.effects.length > 0) {
      item.enchantClass = 'common';
    } else if (item.system.effect && item.system.effect.value) {
      if (item.type === 'armor') {
        this._processArmorEnchantments(item);
      } else {
        item.enchantClass = 'common';
      }
    }

    return item;
  }

  /**
   * Process armor enchantments to determine class
   * @private
   * @param {Object} item - The armor item
   */
  static _processArmorEnchantments(item) {
    const INI_ABBREV = _loc('CHARAbbrev.INI').toLowerCase();
    const GS_ABBREV = _loc('CHARAbbrev.GS').toLowerCase();

    for (const mod of item.system.effect.value.split(/,|;/).map(x => x.trim())) {
      const vals = mod.replace(/(\s+)/g, ' ').trim().split(' ');

      // Skip standard penalties (-1 INI, -1 GS)
      if (vals.length === 2 && 
          [INI_ABBREV, GS_ABBREV].includes(vals[1].toLowerCase()) && 
          !isNaN(vals[0]) && 
          Number(vals[0]) === -1) {
        continue;
      } else {
        item.enchantClass = 'common';
        break;
      }
    }
  }

  /**
   * Set onUseEffect flag on item
   * @param {Object} item - The item to process
   * @private
   */
  _setOnUseEffect(item) {
    item.OnUseEffect = !!foundry.utils.getProperty(item, 'flags.dsa5.onUseEffect');
  }

  /**
   * Calculate transformation progress for visual display
   * @param {Object} item - The item being transformed
   * @param {number} progress - Progress value between 0 and 1
   */
  static progressTransformation(item, progress) {
    if (progress >= 0.5) {
      item.transformRight = '181deg';
      item.transformLeft = `${Math.round(progress * 360 - 179)}deg`;
    } else {
      item.transformRight = `${Math.round(progress * 360 + 1)}deg`;
      item.transformLeft = '0deg';
    }
  }

  /**
   * Parse damage formula into components
   * @param {Object} item - The item with damage formula
   * @param {Object} rollData - Data for roll evaluation
   * @param {Object} [modification] - Optional damage modifications
   * @returns {Object} Item with parsed damage components
   */
  static _parseDmg(item, rollData = {}, modification) {
    const damageValue = item.system.damage.value;
    const parseDamage = new Roll(DiceDSA5.replaceDieLocalization(damageValue), rollData);

    let damageDie = '';
    let damageTerm = '';
    let lastOperator = '+';

    // Process each term in the formula
    for (const term of parseDamage.terms) {
      if (term.faces) {
        damageDie = `${term.number}d${term.faces}`;
      } else if (term.operator) {
        lastOperator = term.operator;
      } else if (term.number !== undefined) {
        damageTerm += `${lastOperator}${term.number}`;
      }
    }

    // Apply damage modifications if provided
    if (modification) {
      const damageMod = foundry.utils.getProperty(modification, 'system.damageMod');
      if (Number(damageMod)) {
        damageTerm += `+${Number(damageMod)}`;
      } else if (damageMod) {
        item.damageBonusDescription = `, ${damageMod} ${_loc('CHARAbbrev.damage')} ${modification.name}`;
      }
    }

    // Evaluate the final damage term
    if (damageTerm) {
      damageTerm = Roll.safeEval(damageTerm);
    }

    // Update item with parsed values
    item.damagedie = damageDie || '0d6';
    item.damageAdd = damageTerm !== '' 
      ? `${Number(damageTerm) >= 0 ? '+' : ''}${damageTerm}` 
      : '';

    return item;
  }

  /**
   * Convert chat data to a formatted string
   * @param {string} [name=''] - The item name
   * @returns {string} Formatted HTML string of chat data
   */
  chatDataToString(name = '') {
    const detailsObfuscated = foundry.utils.getProperty(this, "obfuscation.details");

    if (detailsObfuscated) return '';

    return this.constructor.chatData(this, name)
      .map(x => this.constructor._chatLineHelper(x))
      .join('<br>');
  }

  itemEquippedMessage() {}
}
