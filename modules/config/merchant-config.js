import DSA5 from './config-dsa5.js';
import ImageFramePicker from '../system/helpers/image-frame-picker.js';

/**
 * Merchant / loot constants shared by the system and book modules.
 *
 * Modules cannot import this file; it is re-exposed as `game.dsa5.apps.MerchantConfig`
 * and `game.dsa5.MERCHANT` during init.
 *
 * Preisstufe 1–6 is the Fokusregel table and matches Masters Workshop tavern `ps[].f`.
 * Cityguide settlement prices are a different published table (d20 percents) and must
 * not be folded into PRICE_TIER_FACTORS. When cityguide later spawns shops, use
 * `factorFromCityPercent` as the sellingFactor override and `priceTierFromCityPercent`
 * only as the nearest UI tier.
 */
export default class MerchantConfig {
  static CREATE_TYPE_MERCHANT = 'dsa-merchant';
  static CREATE_TYPE_LOOT = 'dsa-loot';
  static CREATE_TYPE_EPIC = 'dsa-epic';

  static CREATE_TYPE_MODES = Object.freeze({
    [this.CREATE_TYPE_MERCHANT]: 'merchant',
    [this.CREATE_TYPE_LOOT]: 'loot',
    [this.CREATE_TYPE_EPIC]: 'epic',
  });

  static SYNC_ACTOR_TYPES = new Set(['npc', 'character', 'creature']);

  static MERCHANT_MODES = new Set(['merchant', 'loot', 'epic']);

  static SHEET_CLASS_NAMES = {
    character: 'CharacterMerchantSheetDSA5',
    npc: 'MerchantSheetDSA5',
    creature: 'CreatureMerchantSheetDSA5',
    vehicle: 'VehicleMerchantSheetDSA5',
  };

  static DEFAULT_SHEET_CLASS_NAMES = {
    character: 'ActorSheetdsa5Character',
    npc: 'ActorSheetdsa5NPC',
    creature: 'ActorSheetdsa5Creature',
    vehicle: 'ActorSheetdsa5Vehicle',
  };

  static CREATE_TYPE_IMAGES = {
    character: 'icons/svg/mystery-man.svg',
    npc: 'icons/svg/mystery-man-black.svg',
    creature: 'icons/svg/mystery-man-black.svg',
    vehicle: 'icons/svg/mystery-man-black.svg',
    group: 'icons/svg/mystery-man.svg',
    [this.CREATE_TYPE_MERCHANT]: 'systems/dsa5/icons/money-S.webp',
    [this.CREATE_TYPE_LOOT]: 'systems/dsa5/icons/categories/Equipment.webp',
    [this.CREATE_TYPE_EPIC]: 'systems/dsa5/icons/Garadan6.webp',
  };

  static SHOP_FEATURED_FLAG = 'shopFeatured';
  static CUSTOM_SELLING_FLAG = 'customSellingFactor';
  static CUSTOM_BUYING_FLAG = 'customBuyingFactor';
  static SUBTAB_FLAG = 'merchantSubtab';
  static STALL_FILTER_FLAG = 'shopStallFilter';
  static SPECIALS_ROW_LIMIT = 6;

  static MERCHANT_TYPE_ICONS = Object.freeze({
    merchant: 'fas fa-store',
    loot: 'fas fa-boxes-stacked',
    epic: 'fas fa-landmark',
    none: 'fas fa-store-slash',
  });

  static merchantTypeIcon(merchantType) {
    return this.MERCHANT_TYPE_ICONS[merchantType] || this.MERCHANT_TYPE_ICONS.merchant;
  }

  static MERCHANT_TYPE_HINTS = Object.freeze({
    none: 'MERCHANT.typeNoneHint',
    merchant: 'MERCHANT.createMerchantHint',
    loot: 'MERCHANT.createLootHint',
    epic: 'MERCHANT.typeEpicHint',
  });

  /** Icon bar steps for merchant Typus (Akteur konfigurieren). */
  static merchantTypeSteps(selected) {
    const current = selected || 'none';
    return Object.keys(DSA5.merchantTypes).map((value) => ({
      value,
      icon: this.merchantTypeIcon(value),
      label: DSA5.merchantTypes[value],
      tooltip: this.MERCHANT_TYPE_HINTS[value] || DSA5.merchantTypes[value],
      active: value === current,
    }));
  }

  /** Default assortment price cap (S / silver). 0 still means “no cap” when set explicitly. */
  static DEFAULT_MAX_PRICE = 500;
  static DEFAULT_QL_BAND = 2;
  static DEFAULT_POISON_STEP_BAND = 2;

  static PRICE_TIER_ICONS = Object.freeze({
    1: 'fas fa-coins',
    2: 'fas fa-basket-shopping',
    3: 'fas fa-scale-balanced',
    4: 'fas fa-gem',
    5: 'fas fa-crown',
    6: 'fas fa-fire',
  });

  static GARADAN_CHOICES = {
    0: 'GARADAN.0',
    1: 'GARADAN.1',
    2: 'GARADAN.2',
    3: 'GARADAN.3',
    4: 'GARADAN.4',
    6: 'GARADAN.6',
  };

  static GARADAN_ICONS = Object.freeze({
    1: 'systems/dsa5/icons/Garadan1.webp',
    2: 'systems/dsa5/icons/Garadan2.webp',
    3: 'systems/dsa5/icons/Garadan3.webp',
    4: 'systems/dsa5/icons/Garadan4.webp',
    6: 'systems/dsa5/icons/Garadan6.webp',
  });

  /** Icon bar steps for Garadan rank (Akteur konfigurieren / epic). */
  static garadanSteps(selected) {
    const current = Number(selected) || 0;
    return Object.keys(this.GARADAN_CHOICES).map((key) => {
      const value = Number(key);
      const img = this.GARADAN_ICONS[value] || null;
      return {
        value,
        img,
        icon: img ? null : 'fas fa-ban',
        tooltip: this.GARADAN_CHOICES[value],
        active: value === current,
      };
    });
  }

  /** Fokusregel Preise — Preisstufe 1–6 → list-price factor. Identical to MW tavern `ps[].f`. */
  static PRICE_TIER_FACTORS = Object.freeze({
    1: 0.5,
    2: 0.75,
    3: 1,
    4: 1.5,
    5: 2,
    6: 4,
  });

  static PRICE_TIER_CHOICES = {
    1: 'MERCHANT.priceTier.1',
    2: 'MERCHANT.priceTier.2',
    3: 'MERCHANT.priceTier.3',
    4: 'MERCHANT.priceTier.4',
    5: 'MERCHANT.priceTier.5',
    6: 'MERCHANT.priceTier.6',
  };

  /**
   * Cityguide settlement price table (`citygende.json` tables.price.rows).
   * Not Fokusregel — keep percents exact when applying as sellingFactor.
   */
  static CITYGEN_PRICE_PERCENTS = Object.freeze({
    veryCheap: 70,
    cheap: 85,
    average: 100,
    expensive: 120,
    veryExpensive: 150,
    usury: 400,
  });

  static DAILY_HIDE_MODES = {
    random: 'MERCHANT.dailyHideMode.random',
    lowStock: 'MERCHANT.dailyHideMode.lowStock',
    config: 'MERCHANT.dailyHideMode.config',
  };

  static RESTOCK_MODES = {
    replaceSection: 'MERCHANT.restockMode.replaceSection',
    merge: 'MERCHANT.restockMode.merge',
    replaceAll: 'MERCHANT.restockMode.replaceAll',
  };

  /** Root keys that belonged on merchant in the short-lived fat Phase 0 schema. */
  static SHOP_SOURCE_KEYS = Object.freeze([
    'shopName',
    'shopImage',
    'shopImageFrame',
    'priceTier',
    'buyTier',
    'region',
    'maxPrice',
    'wareGroups', // legacy key stripped in MerchantTemplate migrate
    'stockRules',
    'enhanceChance',
    'allowDuplicates',
    'tradeableOnly',
    'qlBand',
    'poisonStepBand',
    'ammoStack',
  ]);

  static factorForPriceTier(tier) {
    return this.PRICE_TIER_FACTORS[Number(tier)] ?? 1;
  }

  static priceTierFromFactor(factor) {
    const value = Number(factor);
    if (!Number.isFinite(value) || value <= 0) return 3;

    let best = 3;
    let bestDelta = Infinity;
    for (const [tier, mapped] of Object.entries(this.PRICE_TIER_FACTORS)) {
      const delta = Math.abs(mapped - value);
      if (delta < bestDelta) {
        bestDelta = delta;
        best = Number(tier);
      }
    }
    return best;
  }

  static factorFromCityPercent(percent) {
    const value = Number(percent);
    if (!Number.isFinite(value)) return 1;
    return value / 100;
  }

  static priceTierFromCityPercent(percent) {
    return this.priceTierFromFactor(this.factorFromCityPercent(percent));
  }

  static isMerchantMode(merchantType) {
    return this.MERCHANT_MODES.has(merchantType);
  }

  static shopOf(actorOrData) {
    const merchant = actorOrData?.system?.merchant ?? actorOrData?.merchant ?? actorOrData;
    return merchant?.shop ?? null;
  }

  static isShopConfigPopulated(shop) {
    if (!shop || typeof shop !== 'object') return false;
    if (shop.shopName || shop.shopImage || shop.region) return true;
    if (Number(shop.maxPrice) > 0) return true;
    const last = shop.stockRules?.lastFillConfig;
    return !!(last && Object.keys(last).length);
  }

  static FALLBACK_PRICE_CAP = 10000;

  static DEFAULT_FILL_COUNTS = Object.freeze({
    meleeweapon: { number: 6, each: 1 },
    rangeweapon: { number: 4, each: 1 },
    armor: { number: 4, each: 1 },
    ammunition: { number: 3, each: 20 },
    equipment: { number: 10, each: 1 },
    consumable: { number: 6, each: 1 },
    plant: { number: 6, each: 1 },
    poison: { number: 4, each: 1 },
    book: { number: 4, each: 1 },
  });

  static STOCK_FILL_PRESETS = Object.freeze({
    general: {
      id: 'general',
      label: 'MERCHANT.fill.preset.general',
      icon: 'fas fa-basket-shopping',
      tooltip: 'MERCHANT.fill.preset.generalHint',
      categories: ['equipment', 'consumable', 'plant'],
      equipmentTypes: ['misc', 'tools', 'food', 'light', 'healing', 'clothes'],
    },
    armorer: {
      id: 'armorer',
      label: 'MERCHANT.fill.preset.armorer',
      icon: 'fas fa-shield-halved',
      tooltip: 'MERCHANT.fill.preset.armorerHint',
      categories: ['meleeweapon', 'rangeweapon', 'armor', 'ammunition'],
    },
    herbalist: {
      id: 'herbalist',
      label: 'MERCHANT.fill.preset.herbalist',
      icon: 'fas fa-leaf',
      tooltip: 'MERCHANT.fill.preset.herbalistHint',
      categories: ['plant', 'poison', 'consumable'],
    },
    magic: {
      id: 'magic',
      label: 'MERCHANT.fill.preset.magic',
      icon: 'fas fa-hat-wizard',
      tooltip: 'MERCHANT.fill.preset.magicHint',
      categories: ['equipment', 'consumable', 'book'],
      equipmentTypes: ['alchemy', 'writing', 'misc'],
    },
    tavern: {
      id: 'tavern',
      label: 'MERCHANT.fill.preset.tavern',
      icon: 'fas fa-beer-mug-empty',
      tooltip: 'MERCHANT.fill.preset.tavernHint',
      categories: ['equipment', 'consumable'],
      equipmentTypes: ['service', 'food', 'misc'],
    },
    custom: {
      id: 'custom',
      label: 'MERCHANT.fill.preset.custom',
      icon: 'fas fa-sliders',
      tooltip: 'MERCHANT.fill.preset.customHint',
    },
  });

  static shopDefaults({ shopName = '', priceTier = 3, buyTier = 1, tradeableOnly = true } = {}) {
    return { shopName, priceTier, buyTier, tradeableOnly };
  }

  static stockFillPresets() {
    const presets = foundry.utils.duplicate(this.STOCK_FILL_PRESETS);
    Hooks.call('dsa5.merchantStockPresets', presets);
    return presets;
  }

  /**
   * Normalize QL / poison step band to an integer 1–6.
   * Legacy `{ min, max }` objects use `max`.
   */
  static normalizeBand(value, fallback = this.DEFAULT_QL_BAND) {
    if (foundry.utils.isPlainObject(value)) {
      value = value.max ?? value.min ?? fallback;
    }
    const v = Number(value);
    if (!Number.isFinite(v)) return fallback;
    return Math.max(1, Math.min(6, Math.trunc(v)));
  }

  static emptyShopView(actor) {
    return {
      ...this.shopDefaults({ shopName: '' }),
      shopImage: null,
      region: '',
      maxPrice: this.DEFAULT_MAX_PRICE,
      stockRules: {
        dailyHidePercent: 0,
        dailyHideMode: 'random',
        priceVariationPercent: 10,
        lastFillConfig: {},
        restockMode: 'replaceSection',
      },
      enhanceChance: 0,
      allowDuplicates: true,
      tradeableOnly: true,
      qlBand: this.DEFAULT_QL_BAND,
      poisonStepBand: this.DEFAULT_POISON_STEP_BAND,
      ammoStack: 20,
    };
  }

  static shopDisplayName(actor) {
    const shop = this.shopOf(actor);
    const custom = String(shop?.shopName || '').trim();
    return custom || actor?.name || '';
  }

  static shopBannerSrc(actor) {
    return this.shopOf(actor)?.shopImage || '';
  }

  static shopBannerFrame(actor) {
    return ImageFramePicker.normalizeBanner(this.shopOf(actor)?.shopImageFrame || {});
  }

  static priceTierSteps(selected) {
    const selectedTier = Number(selected) || 3;
    return Object.keys(this.PRICE_TIER_FACTORS).map((key) => {
      const value = Number(key);
      const factor = this.PRICE_TIER_FACTORS[value];
      return {
        value,
        icon: this.PRICE_TIER_ICONS[value],
        label: this.PRICE_TIER_CHOICES[value],
        tooltip: `MERCHANT.priceTier.stepHint.${value}`,
        percent: Math.round(factor * 100),
        active: value === selectedTier,
      };
    });
  }

  static previewPrice(factor, list = 10) {
    const value = Number(factor);
    const safe = Number.isFinite(value) ? value : 1;
    return {
      list,
      shop: Number((list * safe).toFixed(2)),
      factor: safe,
    };
  }

  static defaultFillAllowList() {
    const equipmentTypes = {};
    for (const key of Object.keys(DSA5.equipmentTypes)) {
      equipmentTypes[key] = !['bags', 'wealth', 'blessed', 'automat'].includes(key);
    }
    const categories = {};
    for (const key of DSA5.equipmentCategories) {
      const entry = { enabled: !['poison', 'book'].includes(key) };
      if (key === 'equipment') entry.types = equipmentTypes;
      categories[key] = entry;
    }
    return { categories };
  }

  static mergeFillAllowList(stored) {
    const incoming = foundry.utils.duplicate(stored) || {};
    if (!foundry.utils.isPlainObject(incoming.categories)) delete incoming.categories;
    return foundry.utils.mergeObject(this.defaultFillAllowList(), incoming, { inplace: false });
  }
}
