/**
 * Domain owner for the player stall: tiles, hook lines, chips, purse, trade blockers.
 * Sheet mixin orchestrates; GM Stock stays a management list.
 */
import DSA5 from '../../config/config-dsa5.js';
import MerchantConfig from '../../config/merchant-config.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import MerchantStockService from './merchant-stock-service.js';

const { getProperty } = foundry.utils;

const SKIP_CHIP_KEYS = new Set(['service', 'money']);
const PLANT_TYPE_KEYS = ['healing', 'poison', 'physical', 'psychic', 'crop', 'defensive', 'supernatural'];

export default class MerchantStallHelper {
  static defaultFilter() {
    return { category: 'all', affordable: false, specials: false, sort: 'featured', viewMode: 'cards' };
  }

  static rememberedFilter() {
    const stored = game.user?.getFlag?.('dsa5', MerchantConfig.STALL_FILTER_FLAG) || {};
    const filter = { ...this.defaultFilter(), ...stored };
    // Log is a session inspection view only — never restore it as the default layout.
    if (filter.viewMode !== 'list') filter.viewMode = 'cards';
    if (filter.sort === 'price') filter.sort = 'priceAsc';
    return filter;
  }

  static persistFilter(filter) {
    return game.user?.setFlag?.('dsa5', MerchantConfig.STALL_FILTER_FLAG, {
      category: filter.category || 'all',
      affordable: !!filter.affordable,
      specials: !!filter.specials,
      sort: filter.sort || 'featured',
      viewMode: filter.viewMode === 'list' ? 'list' : 'cards',
    });
  }

  static moneyTotal(coins = []) {
    return this.roundMoney(
      coins.reduce((sum, coin) => sum + (Number(coin.system?.quantity?.value) || 0) * (Number(coin.system?.price?.value) || 0), 0),
    );
  }

  static roundMoney(value) {
    return Number(parseFloat(`${Number(value) || 0}`).toFixed(2));
  }

  static formatMoney(value) {
    return `${this.roundMoney(value)} S`;
  }

  static isFeatured(item) {
    return !!getProperty(item, `flags.dsa5.${MerchantConfig.SHOP_FEATURED_FLAG}`);
  }

  static isEnhanced(item) {
    return (item.effects || []).some((effect) => effect.type === 'enhancement' && !effect.disabled);
  }

  static isService(item) {
    return item?.type === 'equipment' && getProperty(item, 'system.equipmentType.value') === 'service';
  }

  static isShoppable(item, { allowTradeLocked = false } = {}) {
    if (!item) return false;
    if (item.type === 'money') return false;
    if ((Number(item.system?.quantity?.value) || 0) <= 0) return false;
    if (getProperty(item.system, 'worn.value')) return false;
    if (item.flags?.dsa5?.shopHiddenToday) return false;
    if (!allowTradeLocked && item.system?.tradeLocked) return false;
    return true;
  }

  static listPrice(item) {
    if (item?.type === 'consumable') {
      const custom = getProperty(item, 'flags.dsa5.customPriceTag');
      if (custom) return this.roundMoney(item.system?.price?.value);
    }
    return this.roundMoney(item?.system?.price?.value);
  }

  /**
   * Price shown to players on the stall / when opening an item from a merchant.
   * Uses customPriceTag (via itemPrice) and shop selling factors — never the raw list price alone.
   */
  static playerFacingPrice(item, actor) {
    const base = DSA5_Utility.itemPrice(item);
    const dayFactor = MerchantStockService.dayPriceFactor(item);
    if (!actor || actor.system?.merchant?.merchantType === 'loot') return this.roundMoney(base * dayFactor);
    const sellingFactor = Number(actor.system?.merchant?.sellingFactor) || 1;
    const userFactor = Number(getProperty(actor.system, `merchant.factors.sellingFactor.${game.user?.id}`)) || 1;
    return this.roundMoney(base * dayFactor * sellingFactor * userFactor);
  }

  static signed(value) {
    const n = Number(value) || 0;
    return n >= 0 ? `+${n}` : `${n}`;
  }

  static truncate(text, length = 72) {
    const value = String(text || '').replace(/\s+/g, ' ').trim();
    if (value.length <= length) return value;
    return `${value.slice(0, length - 1)}…`;
  }

  static hookLine(item, { isGM = false } = {}) {
    if (!item) return '';
    switch (item.type) {
      case 'meleeweapon':
        return [item.system?.damage?.value, `AT${this.signed(item.system?.atmod?.value)} / PA${this.signed(item.system?.pamod?.value)}`, item.system?.combatskill?.value]
          .filter(Boolean)
          .join(' · ');
      case 'rangeweapon':
        return [item.system?.damage?.value, item.system?.reach?.value].filter(Boolean).join(' · ');
      case 'armor':
        return [`${_loc('CHARAbbrev.RS')} ${item.system?.protection?.value ?? 0}`, `BE ${item.system?.encumbrance?.value ?? 0}`].join(' · ');
      case 'ammunition': {
        const group = item.system?.ammunitiongroup?.value;
        const ammoType = group && group !== '-' ? _loc(DSA5.ammunitiongroups[group] || group) : '';
        return [ammoType, `#${item.system?.quantity?.value ?? 0}`].filter(Boolean).join(' · ');
      }
      case 'consumable': {
        const ql = Number(item.system?.QL) || 1;
        const effect = this.truncate((item.system?.QLList || '').split('\n')[ql - 1] || '');
        return [`${_loc('CHARAbbrev.QS')} ${ql}`, effect].filter(Boolean).join(' · ');
      }
      case 'poison':
        return [`${_loc('stepValue')} ${item.system?.step?.value ?? 1}`, item.system?.poisonType?.value].filter(Boolean).join(' · ');
      case 'plant':
        return PLANT_TYPE_KEYS.filter((key) => item.system?.planttype?.[key]).map((key) => _loc(`PLANT.${key}`)).join(' · ');
      case 'book': {
        const parts = [
          item.system?.format != null ? _loc(DSA5.bookFormats[item.system.format] || '') : '',
          item.system?.quality != null ? _loc(DSA5.bookQualities[item.system.quality] || '') : '',
        ];
        if (isGM && Number(item.system?.legality) > 0) parts.push(_loc(DSA5.legalities[item.system.legality] || ''));
        return parts.filter(Boolean).join(' · ');
      }
      case 'equipment':
        if (this.isService(item)) return _loc('Equipment.service');
        return _loc(DSA5.equipmentTypes[item.system?.equipmentType?.value] || item.system?.equipmentType?.value || '');
      default:
        return '';
    }
  }

  static priceBreakdown(item, { sellingFactor = 1, userFactor = 1, calculatedPrice, revealFactors = false } = {}) {
    const price = this.formatMoney(calculatedPrice ?? item.calculatedPrice);
    if (!revealFactors) {
      const lines = [price];
      const hook = this.hookLine(item, { isGM: false });
      if (hook) lines.push(hook);
      return lines.join('\n');
    }

    const list = this.listPrice(item);
    const custom = Number(getProperty(item, 'flags.dsa5.customPriceTag')) || 0;
    const dayMod = Number(getProperty(item, `flags.dsa5.${MerchantStockService.PRICE_MOD_FLAG}`)) || 0;
    const lines = [`${_loc('MERCHANT.price.list')}: ${this.formatMoney(list)}`];
    if (custom) lines.push(`${_loc('MERCHANT.price.custom')}: ${this.formatMoney(custom)}`);
    if (dayMod) lines.push(`${_loc('MERCHANT.priceVariation')}: ${dayMod > 0 ? '+' : ''}${dayMod}%`);
    if (sellingFactor !== 1) lines.push(`${_loc('MERCHANT.price.tier')}: ×${sellingFactor}`);
    if (userFactor !== 1) lines.push(`${_loc('MERCHANT.price.userFactor')}: ×${userFactor}`);
    lines.push(`${_loc('MERCHANT.price.final')}: ${price}`);
    const hook = this.hookLine(item, { isGM: true });
    if (hook) lines.push(hook);
    return lines.join('\n');
  }

  /**
   * Normalize toEmbed / renderTooltip results to an HTML string.
   * `Item#toEmbed` returns an HTMLElement; string concat would become `[object HTML…]`.
   * @param {string|HTMLElement|HTMLCollection|JQuery|null|undefined} content
   * @returns {string|null}
   */
  static tooltipContentToHtml(content) {
    if (!content) return null;
    if (typeof content === 'string') return content;
    if (content instanceof HTMLElement) return content.outerHTML;
    if (typeof content.jquery === 'string' && content[0]) return content[0].outerHTML;
    if (typeof content.length === 'number' && content[0]?.outerHTML) {
      return Array.from(content, (el) => el.outerHTML).join('');
    }
    return null;
  }

  /**
   * Item-library style rich tooltip HTML for stall hover.
   * @param {Item} item
   * @param {{ priceLabel?: string }} [options]
   * @returns {Promise<string|null>}
   */
  static async itemTooltipHtml(item, { priceLabel = '' } = {}) {
    if (!item || item.documentName === 'JournalEntry') return null;
    let tooltip = await item.toEmbed?.({}, { skipHeader: true });
    if (!tooltip) {
      const renderTooltip = game.dsa5?.itemLibrary?.systemConfiguration?.renderTooltip;
      if (typeof renderTooltip === 'function') tooltip = await renderTooltip.call(game.dsa5.itemLibrary.systemConfiguration, item);
    }
    let html = this.tooltipContentToHtml(tooltip);
    if (!html) return null;
    if (priceLabel) {
      html += `<div class="dsa-shop-tooltip-price">${foundry.utils.escapeHTML(priceLabel)}</div>`;
    }
    return html;
  }

  static flattenInventory(inventory = {}, options = {}) {
    const tiles = [];
    for (const [sectionKey, section] of Object.entries(inventory)) {
      if (!section || typeof section !== 'object' || !Array.isArray(section.items)) continue;
      if (SKIP_CHIP_KEYS.has(sectionKey) || SKIP_CHIP_KEYS.has(section.dataType)) continue;
      for (const item of section.items) {
        if (!this.isShoppable(item, options)) continue;
        tiles.push(this.#toTile(item, sectionKey, section.dataType || sectionKey, options));
      }
    }
    return tiles;
  }

  static flattenServices(inventory = {}, options = {}) {
    const section = inventory.service;
    if (!section?.items) return [];
    return section.items.filter((item) => this.isShoppable(item, options)).map((item) => this.#toTile(item, 'service', 'service', options));
  }

  static chipsFromTiles(tiles = []) {
    const seen = new Map();
    for (const tile of tiles) {
      if (!seen.has(tile.chipKey)) seen.set(tile.chipKey, tile.chipLabel);
    }
    return [...seen.entries()].map(([key, label]) => ({ key, label }));
  }

  static filterTiles(tiles = [], filter = {}, purse = Infinity) {
    const state = { ...this.defaultFilter(), ...filter };
    let result = tiles;
    if (state.category && state.category !== 'all') result = result.filter((tile) => tile.chipKey === state.category);
    if (state.specials) result = result.filter((tile) => tile.featured);
    if (state.affordable) result = result.filter((tile) => tile.price <= purse);
    return this.sortTiles(result, state.sort);
  }

  static sortTiles(tiles = [], sort = 'featured') {
    const copy = [...tiles];
    copy.sort((a, b) => {
      if (sort === 'priceAsc') return a.price - b.price || a.name.localeCompare(b.name);
      if (sort === 'priceDesc') return b.price - a.price || a.name.localeCompare(b.name);
      if (sort === 'name') return a.name.localeCompare(b.name);
      if (b.featured !== a.featured) return a.featured ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
    return copy;
  }

  static tradeBlockers({ friend, merchant } = {}) {
    const blockers = [];
    if (!friend?.name) blockers.push({ id: 'noBuyer', label: _loc('MERCHANT.stall.noBuyer'), html: true });
    if (merchant?.merchantType === 'loot' && merchant?.locked) {
      blockers.push({ id: 'lockedLoot', label: _loc('MERCHANT.stall.lockedLoot') });
    }
    return blockers;
  }

  static prepareStall({
    actor,
    inventory,
    friend,
    friendInventory,
    friendMoney,
    merchantMoney,
    filter,
    sellMode = false,
    purseExpanded = false,
    isLoot = false,
    isGM = false,
  } = {}) {
    const sellingFactor = Number(actor?.system?.merchant?.sellingFactor) || 1;
    const userFactor = Number(getProperty(actor?.system, `merchant.factors.sellingFactor.${game.user?.id}`)) || 1;
    // Stall UI is player-facing (incl. GM player-view preview): never expose sell/buy factors.
    const tileOpts = { isLoot, isGM, sellingFactor, userFactor };
    const goods = this.flattenInventory(inventory, tileOpts);
    let services = isLoot ? [] : this.flattenServices(inventory, tileOpts);
    const chips = this.chipsFromTiles(goods);
    const state = { ...this.defaultFilter(), ...filter };
    if (state.viewMode !== 'list' && state.viewMode !== 'log') state.viewMode = 'cards';
    if (state.category !== 'all' && !chips.some((chip) => chip.key === state.category)) {
      // Keep preferred category in remembered filter; only fall back for this render.
      state.category = 'all';
    }
    const purse = this.moneyTotal(friendMoney?.coins || []);
    const merchantTotal = this.moneyTotal(merchantMoney?.coins || []);
    const tiles = this.filterTiles(goods, state, purse).map((tile) => ({
      ...tile,
      unaffordable: !isLoot && tile.price > purse,
    }));
    if (state.category !== 'all' || state.specials) services = [];
    else if (state.affordable) services = services.filter((tile) => tile.price <= purse);
    services = this.sortTiles(
      services.map((tile) => ({ ...tile, unaffordable: !isLoot && tile.price > purse })),
      state.sort,
    );
    const featured = goods.filter((tile) => tile.featured).slice(0, MerchantConfig.SPECIALS_ROW_LIMIT);
    const sellTiles = this.flattenInventory(friendInventory, { ...tileOpts, allowTradeLocked: false }).filter((tile) => !tile.tradeLocked);

    const presentationMode = !isLoot && !!actor?.system?.merchant?.presentationMode;
    const presentationTiles = presentationMode
      ? goods
        .filter((tile) => tile.featured)
        .map((tile) => {
          const hasCustomPrice = Number(tile.customPriceTag) > 0;
          const payPrice = hasCustomPrice
            ? MerchantStallHelper.roundMoney(tile.customPriceTag)
            : tile.merchantPrice;
          return {
            ...tile,
            hasCustomPrice,
            payPrice,
            payPriceLabel: this.formatMoney(payPrice),
            unaffordable: !isGM && !!friend?.name && payPrice > purse,
            hook: '',
          };
        })
      : [];
    const presentationCatalog = presentationMode && isGM
      ? this.sortTiles([...goods], 'name').map((tile) => ({
        id: tile.id,
        name: tile.name,
        featured: !!tile.featured,
      }))
      : [];

    return {
      filter: state,
      chips,
      tiles: presentationMode ? [] : tiles,
      specials: presentationMode || state.specials ? [] : featured,
      hasSpecials: featured.length > 0,
      services: presentationMode ? [] : services,
      empty: presentationMode
        ? !presentationTiles.length
        : !tiles.length && !services.length && (state.specials || !featured.length),
      buyerPurse: {
        total: purse,
        label: this.formatMoney(purse),
        coins: friendMoney?.coins || [],
        expanded: purseExpanded,
        hidden: false,
      },
      merchantPurse: {
        total: merchantTotal,
        label: this.formatMoney(merchantTotal),
        coins: merchantMoney?.coins || [],
        expanded: purseExpanded,
        hidden: !isGM && !!actor?.system?.merchant?.hideMoney,
      },
      blockers: this.tradeBlockers({ friend, merchant: actor?.system?.merchant, isGM }),
      sellTiles: presentationMode ? [] : sellTiles,
      sellMode: !presentationMode && !!sellMode && !!friend?.name,
      presentationMode,
      presentationTiles,
      presentationCatalog,
      presentationHint: presentationMode
        ? (isGM ? _loc('MERCHANT.presentation.hintGm') : _loc('MERCHANT.presentation.hintPlayer'))
        : '',
      presentationEmpty: presentationMode
        ? (isGM ? _loc('MERCHANT.presentation.emptyGm') : _loc('MERCHANT.presentation.emptyPlayer'))
        : '',
      isLoot,
      hasBuyer: !!friend?.name,
      sellActionIcon: isLoot ? 'fas fa-exchange-alt' : 'fas fa-piggy-bank',
      sellActionTooltip: isLoot ? 'MERCHANT.exchange' : 'MERCHANT.sell',
      buyActionIcon: isLoot ? 'fas fa-exchange-alt' : 'fas fa-shopping-cart',
      buyActionTooltip: isLoot ? 'MERCHANT.exchange' : 'MERCHANT.buy',
      viewMode: state.viewMode,
      isCards: state.viewMode !== 'list' && state.viewMode !== 'log',
      isList: state.viewMode === 'list',
      isLog: state.viewMode === 'log',
      allowItemDetails: presentationMode
        ? !!isGM
        : actor?.system?.merchant?.allowPlayerItemDetails !== false,
    };
  }

  static #toTile(item, sectionKey, dataType, {
    isLoot = false,
    isGM = false,
    sellingFactor = 1,
    userFactor = 1,
  } = {}) {
    const featured = this.isFeatured(item);
    const listPrice = this.listPrice(item);
    const dayFactor = MerchantStockService.dayPriceFactor(item);
    const merchantPrice = this.roundMoney(listPrice * dayFactor * sellingFactor * userFactor);
    const customPriceTag = Number(getProperty(item, 'flags.dsa5.customPriceTag')) || 0;
    const price = this.roundMoney(item.calculatedPrice ?? DSA5_Utility.itemPrice(item));
    return {
      id: item._id,
      name: item.name,
      img: item.img,
      type: item.type,
      chipKey: sectionKey,
      chipLabel: `Equipment.${sectionKey}`,
      dataType,
      qty: Number(item.system?.quantity?.value) || 0,
      price,
      priceLabel: isLoot ? '' : this.formatMoney(price),
      listPrice,
      listPriceLabel: isLoot ? '' : this.formatMoney(listPrice),
      merchantPrice,
      merchantPriceLabel: isLoot ? '' : this.formatMoney(merchantPrice),
      customPriceTag: customPriceTag || '',
      hook: this.hookLine(item, { isGM }),
      featured,
      enhanced: this.isEnhanced(item) || featured,
      service: this.isService(item),
      enchantClass: item.enchantClass || '',
      tradeLocked: !!item.system?.tradeLocked,
    };
  }
}
