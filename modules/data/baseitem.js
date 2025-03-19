import DiceDSA5 from '../system/dice-dsa5.js';
import DSA5Payment from '../system/payment.js';
import DSA5_Utility from '../system/utility-dsa5.js';
import { DSADataModel } from './abstract.js';
const { getProperty, mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export class ItemDataModel extends DSADataModel {
  async getSheetData(data) {}

  get actor() {
    return this.parent?.actor;
  }

  prepareDomains() {
    let dom = this.effect.attributes;
    if (dom) {
      const magical = new RegExp(game.i18n.localize('WEAPON.magical'), 'i');
      const blessed = new RegExp(game.i18n.localize('WEAPON.clerical'), 'i');
      dom = dom
        .split(',')
        .map((x) => {
          let cssclass = '';
          if (magical.test(x)) cssclass = 'magical';
          else if (blessed.test(x)) cssclass = 'blessed';
          return `<li class="${cssclass}">${x}</li>`;
        })
        .join('');
    }
    return dom;
  }

  static _chatLineHelper({ key, val, localizeVal } = { localizeVal: false }) {
    if (localizeVal) val = game.i18n.localize(val);
    return `<b>${game.i18n.localize(key)}</b>: ${val ? val : '-'}`;
  }

  static chatData(data, name) {
    return [];
  }

  static async _postItem(item) {
    let chatData = foundry.utils.duplicate(item);

    const detailsObfuscated = getProperty(chatData, 'system.obfuscation.details');
    const descriptionObfuscated = getProperty(chatData, 'system.obfuscation.description');

    mergeObject(chatData, {
      properties: detailsObfuscated ? [] : this.chatData(chatData.system, item.name).map((x) => this._chatLineHelper(x)),
      descriptionObfuscated,
    });

    chatData.hasPrice = 'price' in chatData.system && !detailsObfuscated;
    if (chatData.hasPrice) {
      let price = chatData.system.price.value;
      if (chatData.system.QL) price = Itemdsa5.getSubClass(chatData.type).consumablePrice(chatData);

      const prices = await DSA5Payment._moneyToString(price);
      chatData.properties.push(`<b>${game.i18n.localize('price')}</b>: ${prices}`);
    }

    if (item.pack) chatData.itemLink = item.link;

    if (chatData.img.includes('/blank.webp')) chatData.img = null;

    const html = await renderTemplate('systems/dsa5/templates/chat/post-item.html', chatData);
    const chatOptions = DSA5_Utility.chatDataSetup(html);
    ChatMessage.create(chatOptions);
  }

  prepareEmbeddedItemSheet() {
    return this.parent.toObject();
  }

  static _prepareItemStructure(item) {
    if (item.system.structure && item.system.structure.max != 0) {
      item.structureMax = item.system.structure.max;
      item.structureCurrent = item.system.structure.value;
    }
    const enchants = foundry.utils.getProperty(item, 'flags.dsa5.enchantments');
    if (enchants && enchants.length > 0) {
      item.enchantClass = 'rar';
    } else if (item.effects.length > 0) {
      item.enchantClass = 'common';
    } else if (item.system.effect && item.system.effect.value != '') {
      if (item.type == 'armor') {
        for (let mod of item.system.effect.value.split(/,|;/).map((x) => x.trim())) {
          let vals = mod.replace(/(\s+)/g, ' ').trim().split(' ');
          //TODO should only pass if modifier is -1, -1
          if (
            vals.length == 2 &&
            [game.i18n.localize('CHARAbbrev.INI').toLowerCase(), game.i18n.localize('CHARAbbrev.GS').toLowerCase()].includes(vals[1].toLowerCase()) &&
            !isNaN(vals[0]) &&
            vals[0] == -1
          ) {
            continue;
          } else {
            item.enchantClass = 'common';
            break;
          }
        }
      } else {
        item.enchantClass = 'common';
      }
    }

    return item;
  }

  _setOnUseEffect(item) {
    if (foundry.utils.getProperty(item, 'flags.dsa5.onUseEffect')) item.OnUseEffect = true;
  }

  static progressTransformation(item, progress) {
    if (progress >= 0.5) {
      item.transformRight = '181deg';
      item.transformLeft = `${Math.round(progress * 360 - 179)}deg`;
    } else {
      item.transformRight = `${Math.round(progress * 360 + 1)}deg`;
      item.transformLeft = 0;
    }
  }

  static _parseDmg(item, rollData, modification = undefined) {
    const parseDamage = new Roll(DiceDSA5.replaceDieLocalization(item.system.damage.value), rollData || {});

    let damageDie = '',
      damageTerm = '',
      lastOperator = '+';

    for (let k of parseDamage.terms) {
      if (k.faces) damageDie = k.number + 'd' + k.faces;
      else if (k.operator) lastOperator = k.operator;
      else if (k.number) damageTerm += `${lastOperator}${k.number}`;
    }
    if (modification) {
      let damageMod = foundry.utils.getProperty(modification, 'system.damageMod');
      if (Number(damageMod)) damageTerm += `+${Number(damageMod)}`;
      else if (damageMod) item.damageBonusDescription = `, ${damageMod} ${game.i18n.localize('CHARAbbrev.damage')} ${modification.name}`;
    }
    if (damageTerm) damageTerm = Roll.safeEval(damageTerm);

    item.damagedie = damageDie ? damageDie : '0d6';
    item.damageAdd = damageTerm != '' ? (Number(damageTerm) >= 0 ? '+' : '') + damageTerm : '';

    return item;
  }
}
