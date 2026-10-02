/**
 * Domain owner for merchant / loot stock fill and refill.
 *
 * FillConfig (persisted on `system.merchant.shop.stockRules.lastFillConfig`):
 * {
 *   presetId, categories: { [type]: { enabled, number, each, types? } },
 *   filtersEnabled (bool, default false),
 *   filters: { [category]: { selects, inputs, booleans } } — item-library detailFilter payload (plain object),
 *   region, maxPrice, allowDuplicates, allowQlVariants,
 *   tradeableOnly, enhanceChance, qlBand, poisonStepBand, ammoStack,
 *   qtyMode ('each' | 'total' | 'draws'),
 *   serviceSubcategories (string[] | null) — when set, equipment services must match,
 *   mode, sectionType,
 *   hygiene: { excludePriceZero, excludeIllegalBooks, excludeArtifacts, excludeMagical, excludeSiege, excludeUniq }
 * }
 *
 * `categories[type].enabled` is the allow-list. Nested equipmentType checkboxes
 * live under `categories.equipment.types`. QL/step variants are always distinct
 * lines unless `allowQlVariants` is false.
 */
import DSA5 from '../../config/config-dsa5.js';
import MerchantConfig from '../../config/merchant-config.js';
import MerchantShopHelper from './merchant-shop-helper.js';
import { ItemFactory } from '../../item/item-factory.js';

const { getProperty, duplicate, mergeObject } = foundry.utils;

const HIDDEN_FLAG = 'shopHiddenToday';
const PRICE_MOD_FLAG = 'shopDayPriceMod';
const MAGICAL_DOMAIN = () => new RegExp(`${_loc('magical')}|${_loc('blessed')}`, 'i');

export default class MerchantStockService {
  static HIDDEN_FLAG = HIDDEN_FLAG;
  static PRICE_MOD_FLAG = PRICE_MOD_FLAG;

  static defaultHygiene() {
    return {
      excludePriceZero: true,
      excludeIllegalBooks: true,
      excludeArtifacts: true,
      excludeMagical: true,
      excludeSiege: true,
      excludeUniq: true,
    };
  }

  static emptyFillConfig() {
    return {
      presetId: 'custom',
      categories: {},
      filtersEnabled: false,
      filters: {},
      region: '',
      maxPrice: MerchantConfig.DEFAULT_MAX_PRICE,
      allowDuplicates: true,
      allowQlVariants: true,
      tradeableOnly: true,
      enhanceChance: 0,
      qlBand: MerchantConfig.DEFAULT_QL_BAND,
      poisonStepBand: MerchantConfig.DEFAULT_POISON_STEP_BAND,
      ammoStack: 20,
      qtyMode: 'each',
      serviceSubcategories: null,
      mode: 'merge',
      sectionType: null,
      hygiene: this.defaultHygiene(),
    };
  }

  static normalizeFillConfig(raw = {}) {
    const base = this.emptyFillConfig();
    const merged = mergeObject(base, duplicate(raw) || {}, { inplace: false });
    merged.hygiene = { ...this.defaultHygiene(), ...(raw.hygiene || {}) };
    if ('excludeEinzigartig' in merged.hygiene && !('excludeUniq' in (raw.hygiene || {}))) {
      merged.hygiene.excludeUniq = !!merged.hygiene.excludeEinzigartig;
    }
    delete merged.hygiene.excludeEinzigartig;
    merged.categories = this.#normalizeCategories(raw.categories);
    merged.filtersEnabled = !!raw.filtersEnabled;
    merged.filters = foundry.utils.isPlainObject(raw.filters) ? duplicate(raw.filters) : {};
    merged.allowQlVariants = raw.allowQlVariants !== false;
    merged.serviceSubcategories = this.#normalizeServiceSubcategories(raw.serviceSubcategories);
    merged.mode = MerchantConfig.RESTOCK_MODES[merged.mode] ? merged.mode : 'merge';
    merged.qtyMode = MerchantConfig.QTY_MODES[merged.qtyMode] ? merged.qtyMode : 'each';
    merged.qlBand = MerchantConfig.normalizeBand(raw.qlBand ?? merged.qlBand);
    merged.poisonStepBand = MerchantConfig.normalizeBand(
      raw.poisonStepBand ?? merged.poisonStepBand,
      MerchantConfig.DEFAULT_POISON_STEP_BAND,
    );
    delete merged.wareGroupId;
    return merged;
  }

  static #normalizeCategories(stored) {
    const allow = MerchantConfig.mergeFillAllowList({
      categories: foundry.utils.isPlainObject(stored) ? stored : {},
    }).categories;
    const counts = MerchantConfig.DEFAULT_FILL_COUNTS;
    const categories = {};
    for (const [key, entry] of Object.entries(allow)) {
      const defaults = counts[key] || { number: 4, each: 1 };
      categories[key] = {
        enabled: !!entry.enabled,
        number: Math.max(0, Number(stored?.[key]?.number ?? defaults.number) || 0),
        each: Math.max(1, Number(stored?.[key]?.each ?? defaults.each) || 1),
      };
      if (entry.types) {
        categories[key].types = { ...entry.types };
      }
    }
    return categories;
  }

  static #normalizeServiceSubcategories(stored) {
    const keys = Array.isArray(stored)
      ? stored
      : foundry.utils.isPlainObject(stored)
        ? Object.entries(stored).filter(([, on]) => on).map(([key]) => key)
        : [];
    const allowed = keys.filter((key) => DSA5.serviceSubcategories[key]);
    return allowed.length ? allowed : null;
  }

  /**
   * Inventory section `data-type` is either an Item type (`meleeweapon`) or an
   * equipmentType key (`tools`, `bags`). Consumables share those subtype buckets.
   */
  static resolveSectionKey(sectionKey) {
    if (!sectionKey) return null;
    if (DSA5.equipmentTypes[sectionKey]) {
      return { fillCategory: 'equipment', equipmentType: sectionKey };
    }
    if (DSA5.equipmentCategories.has(sectionKey)) {
      return { fillCategory: sectionKey, equipmentType: null };
    }
    const aliases = { meleeweapons: 'meleeweapon', rangeweapons: 'rangeweapon' };
    if (aliases[sectionKey]) {
      return { fillCategory: aliases[sectionKey], equipmentType: null };
    }
    return null;
  }

  static seedFromActor(actor, { presetId, sectionType, equipmentType, mode } = {}) {
    const shop = MerchantConfig.shopOf(actor) || MerchantConfig.emptyShopView(actor);
    const last = shop.stockRules?.lastFillConfig || {};
    const config = this.normalizeFillConfig({
      ...last,
      region: last.region || shop.region || '',
      maxPrice: last.maxPrice ?? shop.maxPrice ?? MerchantConfig.DEFAULT_MAX_PRICE,
      allowDuplicates: last.allowDuplicates ?? shop.allowDuplicates ?? true,
      tradeableOnly: last.tradeableOnly ?? shop.tradeableOnly ?? true,
      enhanceChance: last.enhanceChance ?? shop.enhanceChance ?? 0,
      qlBand: MerchantConfig.normalizeBand(last.qlBand ?? shop.qlBand),
      poisonStepBand: MerchantConfig.normalizeBand(
        last.poisonStepBand ?? shop.poisonStepBand,
        MerchantConfig.DEFAULT_POISON_STEP_BAND,
      ),
      ammoStack: last.ammoStack ?? shop.ammoStack ?? 20,
      mode: mode || last.mode || shop.stockRules?.restockMode || 'merge',
      sectionType: sectionType ?? null,
    });
    delete config.wareGroupId;

    if (presetId && presetId !== 'custom') this.applyPreset(config, presetId, { keepFilters: true });
    if (sectionType) this.#scopeToSection(config, sectionType, equipmentType);
    return config;
  }

  static applyPreset(config, presetId, { keepFilters = false } = {}) {
    const presets = MerchantConfig.stockFillPresets();
    const preset = presets[presetId];
    if (!preset) return config;

    config.presetId = presetId;
    if (!keepFilters) {
      config.filters = {};
      config.filtersEnabled = false;
    }

    if (presetId === 'custom') return config;

    const enabled = new Set(preset.categories || []);
    const equipmentTypes = preset.equipmentTypes ? new Set(preset.equipmentTypes) : null;
    const defaults = MerchantConfig.DEFAULT_FILL_COUNTS;
    for (const [key, entry] of Object.entries(config.categories)) {
      entry.enabled = enabled.has(key);
      const base = defaults[key] || { number: 4, each: 1 };
      const override = preset.counts?.[key];
      entry.number = Math.max(0, Number(override?.number ?? base.number) || 0);
      entry.each = Math.max(1, Number(override?.each ?? base.each) || 1);
      if (key === 'equipment' && entry.types && equipmentTypes) {
        for (const type of Object.keys(entry.types)) {
          entry.types[type] = equipmentTypes.has(type);
        }
        entry.enabled = [...equipmentTypes].some((type) => entry.types[type]);
      }
    }
    config.qtyMode = MerchantConfig.QTY_MODES[preset.qtyMode] ? preset.qtyMode : 'each';
    config.serviceSubcategories = preset.serviceSubcategories
      ? [...preset.serviceSubcategories]
      : null;
    return config;
  }

  static enabledCategoryKeys(config) {
    return Object.entries(config?.categories || {})
      .filter(([, entry]) => entry?.enabled && Number(entry.number) > 0)
      .map(([key]) => key);
  }

  static requestedFillCount(config) {
    return this.enabledCategoryKeys(config).reduce((sum, key) => {
      return sum + Math.max(0, Number(config.categories?.[key]?.number) || 0);
    }, 0);
  }

  static itemPrice(item) {
    if (!item) return 0;
    if (item.type === 'consumable') {
      return Number(ItemFactory.getSubClass('consumable').consumablePrice(item)) || 0;
    }
    return Number(getProperty(item, 'system.price.value')) || 0;
  }

  static identityKey(item, { allowQlVariants = true } = {}) {
    const parts = [item.type, item.name];
    if (allowQlVariants) {
      if (item.system?.QL != null) parts.push(`ql${item.system.QL}`);
      if (item.system?.step?.value != null) parts.push(`st${item.system.step.value}`);
    }
    return parts.join('_');
  }

  static effectiveMaxPrice(config) {
    const cap = Number(config?.maxPrice) || 0;
    return cap > 0 ? cap : MerchantConfig.FALLBACK_PRICE_CAP;
  }

  static applyPoolHygiene(items, config = {}) {
    const hygiene = { ...this.defaultHygiene(), ...(config.hygiene || {}) };
    const magical = MAGICAL_DOMAIN();
    return (items || []).filter((item) => this.#passesHygiene(item, config, hygiene, magical));
  }

  static #passesHygiene(item, config, hygiene, magical) {
    if (!item) return false;
    if (config.tradeableOnly && item.system?.tradeLocked) return false;
    if (getProperty(item, 'system.worn.value')) return false;

    const price = this.itemPrice(item);
    if (hygiene.excludePriceZero && price <= 0) return false;
    if (price > this.effectiveMaxPrice(config)) return false;

    const domain = getProperty(item, 'system.effect.attributes') || '';
    if (hygiene.excludeMagical && magical.test(domain)) return false;
    if (hygiene.excludeArtifacts && item.system?.isArtifact) return false;
    if (hygiene.excludeUniq && item.system?.uniq) return false;
    if (hygiene.excludeSiege && this.#isSiege(item)) return false;
    if (item.type === 'book' && hygiene.excludeIllegalBooks && Number(item.system?.legality) !== 0) return false;
    if (item.type === 'equipment' && !this.#equipmentTypeAllowed(item, config)) return false;
    if (item.type === 'equipment' && !this.#serviceSubcategoryAllowed(item, config)) return false;
    return true;
  }

  static #isSiege(item) {
    const skill = `${getProperty(item, 'system.combatskill.value') || ''}`;
    return /belager|siege/i.test(skill);
  }

  static #equipmentTypeAllowed(item, config) {
    const types = config.categories?.equipment?.types;
    if (!types) return true;
    const key = item.system?.equipmentType?.value;
    if (!key) return true;
    return types[key] !== false;
  }

  static #serviceSubcategoryAllowed(item, config) {
    const allowed = config.serviceSubcategories;
    if (!allowed?.length) return true;
    if (item.system?.equipmentType?.value !== 'service') return true;
    const sub = item.system?.serviceSubcategory || 'other';
    return allowed.includes(sub);
  }

  static applyPriceCap(items, maxPrice) {
    const cap = Number(maxPrice) || 0;
    if (cap <= 0) return items;
    return items.filter((item) => this.itemPrice(item) <= cap);
  }

  static filterSeen(items, actor, config = {}) {
    const allowQlVariants = config.allowQlVariants !== false;
    const allowDuplicates = !!config.allowDuplicates;
    const seen = new Set();
    if (!allowDuplicates && actor?.items) {
      for (const item of actor.items) seen.add(this.identityKey(item, { allowQlVariants }));
    }

    const hygienic = this.applyPoolHygiene(items, config);
    if (allowDuplicates) return hygienic;

    const filtered = [];
    for (const item of hygienic) {
      const key = this.identityKey(item, { allowQlVariants });
      if (seen.has(key)) continue;
      seen.add(key);
      filtered.push(item);
    }
    return filtered;
  }

  static applyTypeDefaults(item, config = {}) {
    if (!item?.system) return item;

    if (item.system.worn) item.system.worn.value = false;
    if ('tradeLocked' in item.system) item.system.tradeLocked = false;
    delete item.system.parent_id;

    const category = config.categories?.[item.type];
    const each = Number(category?.each);
    const hasEach = Number.isFinite(each) && each > 0;
    const skipQty = config.qtyMode === 'total' || config.qtyMode === 'draws';

    if (item.type === 'ammunition') {
      if (!skipQty) {
        const stack = Number(config.ammoStack) || (hasEach ? each : item.system.quantity?.value) || 1;
        item.system.quantity.value = Math.max(1, stack);
      } else if (!item.system.quantity?.value) {
        item.system.quantity.value = 1;
      }
      if (item.system.mag?.max) item.system.mag.value = item.system.mag.max;
    } else if (!skipQty && hasEach) {
      item.system.quantity.value = each;
    } else if (!item.system.quantity?.value) {
      item.system.quantity.value = 1;
    }

    if (item.type === 'consumable') {
      this.#assignWeightedQl(item, config);
      if (item.system.maxCharges) item.system.charges = item.system.maxCharges;
      if ((Number(item.system.QL) || 1) >= 4) {
        foundry.utils.setProperty(item, `flags.dsa5.${MerchantConfig.SHOP_FEATURED_FLAG}`, true);
      }
    }

    if (item.type === 'poison') this.#assignWeightedStep(item, config);

    return item;
  }

  static maybeEnhance(item, { chance } = {}) {
    if (!['meleeweapon', 'rangeweapon', 'armor'].includes(item?.type)) return item;
    if ((Number(chance) || 0) <= 0) return item;
    if (Math.random() > Number(chance)) return item;
    foundry.utils.setProperty(item, `flags.dsa5.${MerchantConfig.SHOP_FEATURED_FLAG}`, true);
    return item;
  }

  static #assignWeightedQl(item, config) {
    const band = MerchantConfig.normalizeBand(config.qlBand);
    item.system.QL = this.#weightedLow(band);
  }

  static #assignWeightedStep(item, config) {
    const band = MerchantConfig.normalizeBand(config.poisonStepBand, MerchantConfig.DEFAULT_POISON_STEP_BAND);
    if (!item.system.step) item.system.step = { value: 1 };
    item.system.step.value = this.#weightedLow(band);
  }

  static #weightedLow(band) {
    const hi = Math.max(1, band);
    const weights = [];
    for (let value = 1; value <= hi; value += 1) weights.push(hi + 1 - value);
    const total = weights.reduce((sum, weight) => sum + weight, 0);
    let roll = Math.random() * total;
    for (let index = 0; index < weights.length; index += 1) {
      roll -= weights[index];
      if (roll <= 0) return index + 1;
    }
    return 1;
  }

  static #ensureNotAllQlOne(items, config) {
    const band = MerchantConfig.normalizeBand(config.qlBand);
    if (band <= 1) return;
    const consumables = items.filter((item) => item.type === 'consumable');
    if (consumables.length < 2) return;
    if (consumables.every((item) => Number(item.system.QL) === 1)) {
      consumables[0].system.QL = Math.min(band, 2);
    }
  }

  static async pickRandomItems({ category, number, config, actor }) {
    const library = game.dsa5.itemLibrary;
    await library.buildEquipmentIndex();

    const requested = Math.max(0, Number(number) || 0);
    if (!requested) return [];

    const filter = config.filtersEnabled ? config.filters?.[category] : null;
    let pool;
    if (filter && (filter.selects?.length || filter.inputs?.length || filter.booleans?.length || filter.rangeSearches?.length)) {
      pool = await library.findEquipmentItemDetailed(filter, category, false);
    } else {
      pool = await library.getRandomItems(category, Math.max(requested * 3, requested + 24));
    }

    if (category === 'plant' && config.region) {
      pool = this.#preferRegion(pool, config.region);
    }

    const documents = pool
      .map((entry) => (entry?.toObject ? entry.toObject() : entry ? duplicate(entry) : null))
      .filter(Boolean)
      .map((item) => {
        delete item._id;
        return item;
      });

    const qtyMode = config.qtyMode || 'each';
    if (qtyMode === 'draws' || qtyMode === 'total') {
      const unique = this.#uniqueByIdentity(this.applyPoolHygiene(documents, config), config);
      const shuffled = library.shuffle(unique);
      if (qtyMode === 'draws') {
        const each = Number(config.categories?.[category]?.each) || 1;
        return this.accumulateDraws(shuffled, requested, each, config);
      }
      return shuffled.slice(0, requested);
    }

    const filtered = this.filterSeen(documents, actor, config);
    const shuffled = library.shuffle(filtered);
    return shuffled.slice(0, requested);
  }

  static #uniqueByIdentity(items, config = {}) {
    const seen = new Set();
    const unique = [];
    for (const item of items) {
      const key = this.identityKey(item, config);
      if (seen.has(key)) continue;
      seen.add(key);
      unique.push(item);
    }
    return unique;
  }

  /**
   * Sample `draws` times with replacement from `pool` and stack quantity on identity.
   * Each draw adds `each` to that line.
   */
  static accumulateDraws(pool, draws, each = 1, config = {}) {
    if (!pool?.length) return [];
    const requested = Math.max(0, Math.floor(Number(draws) || 0));
    if (!requested) return [];
    const qty = Math.max(1, Math.floor(Number(each) || 1));
    const byKey = new Map();
    for (let index = 0; index < requested; index += 1) {
      const source = pool[Math.floor(Math.random() * pool.length)];
      const pick = duplicate(source);
      delete pick._id;
      this.#ensureQuantity(pick);
      const key = this.identityKey(pick, config);
      const existing = byKey.get(key);
      if (existing) {
        existing.system.quantity.value += qty;
      } else {
        pick.system.quantity.value = qty;
        byKey.set(key, pick);
      }
    }
    return [...byKey.values()];
  }

  static #ensureQuantity(item) {
    if (!item.system) item.system = {};
    if (!item.system.quantity) item.system.quantity = {};
    if (!Number.isFinite(Number(item.system.quantity.value))) item.system.quantity.value = 0;
  }

  /**
   * Split `total` units across `items`. When total >= n, every line gets at least 1
   * and the remainder is assigned one-by-one at random. When total < n and
   * `dropEmpty`, only `total` lines remain at qty 1.
   */
  static distributeQuantities(items, total, { random = Math.random, dropEmpty = true } = {}) {
    if (!items?.length) return items || [];
    const T = Math.max(0, Math.floor(Number(total) || 0));
    const working = [...items];
    for (const item of working) this.#ensureQuantity(item);

    if (T <= 0) {
      if (dropEmpty) return [];
      for (const item of working) item.system.quantity.value = 0;
      return working;
    }

    if (T < working.length) {
      this.#shuffleInPlace(working, random);
      const chosen = working.slice(0, T);
      for (const item of chosen) item.system.quantity.value = 1;
      if (dropEmpty) return chosen;
      for (const item of working.slice(T)) item.system.quantity.value = 0;
      return working;
    }

    for (const item of working) item.system.quantity.value = 1;
    let rest = T - working.length;
    while (rest > 0) {
      const index = Math.floor(random() * working.length);
      working[index].system.quantity.value += 1;
      rest -= 1;
    }
    return working;
  }

  static #shuffleInPlace(array, random = Math.random) {
    for (let i = array.length - 1; i > 0; i -= 1) {
      const j = Math.floor(random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
  }

  static #preferRegion(pool, region) {
    const needle = region.toLowerCase();
    const matched = [];
    const rest = [];
    for (const item of pool) {
      const value = `${getProperty(item, 'system.location.region') || getProperty(item, 'system.region') || ''}`.toLowerCase();
      if (value.includes(needle)) matched.push(item);
      else rest.push(item);
    }
    return [...matched, ...rest];
  }

  static async buildFromFillConfig(config, actor) {
    const normalized = this.normalizeFillConfig(config);
    const items = [];
    for (const type of this.enabledCategoryKeys(normalized)) {
      const category = normalized.categories[type];
      let picked = await this.pickRandomItems({
        category: type,
        number: category.number,
        config: normalized,
        actor,
      });
      for (const item of picked) {
        this.applyTypeDefaults(item, normalized);
        this.maybeEnhance(item, { chance: normalized.enhanceChance });
      }
      if (normalized.qtyMode === 'total') {
        picked = this.distributeQuantities(picked, category.each);
      }
      items.push(...picked);
    }
    this.#ensureNotAllQlOne(items, normalized);
    return items;
  }

  static async applyFill(actor, config, { persist = true, notify = true } = {}) {
    const normalized = this.normalizeFillConfig(config);
    const items = await this.buildFromFillConfig(normalized, actor);
    if (!items.length) {
      ui.notifications.warn(_loc('MERCHANT.fill.noMatches'));
      return [];
    }

    if (normalized.mode === 'replaceAll') {
      await this.#deleteMatching(actor, { all: true });
    } else if (normalized.mode === 'replaceSection') {
      await this.#deleteMatching(actor, {
        types: this.enabledCategoryKeys(normalized),
        equipmentTypes: this.#restrictedEquipmentTypes(normalized),
      });
    }

    const created = await this.#createOrMerge(actor, items, normalized);
    if (persist && MerchantConfig.shopOf(actor)) {
      await this.#persistFillConfig(actor, normalized);
    }
    const requested = this.requestedFillCount(normalized);
    if (notify && created.length) {
      ui.notifications.info(_loc('MERCHANT.fill.done', { count: created.length }));
    }
    if (notify && normalized.qtyMode !== 'draws' && items.length < requested) {
      ui.notifications.warn(_loc('MERCHANT.fill.shortfall', { got: items.length, requested }));
    }
    return created;
  }

  static async refill(actor, { openDialogIfEmpty = false } = {}) {
    const last = MerchantConfig.shopOf(actor)?.stockRules?.lastFillConfig;
    if (!last || !this.enabledCategoryKeys(this.normalizeFillConfig(last)).length) {
      if (openDialogIfEmpty) {
        const { default: StockFillDialog } = await import('./stock-fill-dialog.js');
        StockFillDialog.show(actor);
      } else {
        ui.notifications.warn(_loc('MERCHANT.fill.noLastConfig'));
      }
      return [];
    }
    const config = this.normalizeFillConfig(last);
    config.mode = 'replaceSection';
    return this.applyFill(actor, config);
  }

  static async restockSection(actor, sectionKey) {
    const resolved = this.resolveSectionKey(sectionKey);
    if (!resolved) return [];

    const { fillCategory, equipmentType } = resolved;
    const config = this.seedFromActor(actor, {
      sectionType: fillCategory,
      equipmentType,
      mode: 'replaceSection',
    });
    const defaults = MerchantConfig.DEFAULT_FILL_COUNTS[fillCategory] || { number: 4, each: 1 };
    const current = config.categories[fillCategory] || {};
    config.categories[fillCategory] = {
      ...defaults,
      ...current,
      enabled: true,
      number: Math.max(1, Number(current.number) || defaults.number || 4),
    };
    if (equipmentType && config.categories.equipment?.types) {
      for (const key of Object.keys(config.categories.equipment.types)) {
        config.categories.equipment.types[key] = key === equipmentType;
      }
    }
    config.mode = 'replaceSection';
    return this.applyFill(actor, config, { persist: false, notify: true });
  }

  static async applyDailyHide(actor) {
    const shop = MerchantConfig.shopOf(actor);
    const hidePercent = Math.max(0, Math.min(100, Number(shop?.stockRules?.dailyHidePercent) || 0));
    const variationMax = Math.max(0, Math.min(50, Number(shop?.stockRules?.priceVariationPercent ?? 10)));

    const candidates = actor.items.filter((item) => {
      if (!DSA5.equipmentCategories.has(item.type)) return false;
      if (item.system?.tradeLocked) return false;
      return !getProperty(item, 'system.worn.value');
    });

    const hadMods = candidates.some((item) => {
      if (item.getFlag('dsa5', HIDDEN_FLAG)) return true;
      const mod = Number(item.getFlag('dsa5', PRICE_MOD_FLAG));
      return Number.isFinite(mod) && mod !== 0;
    });

    if (hidePercent <= 0 && variationMax <= 0) {
      if (!hadMods) {
        ui.notifications.warn(_loc('MERCHANT.fill.shopDayZero'));
        return null;
      }
      const clears = candidates.map((item) => ({
        _id: item.id,
        [`flags.dsa5.${HIDDEN_FLAG}`]: false,
        [`flags.dsa5.${PRICE_MOD_FLAG}`]: 0,
      }));
      if (clears.length) await actor.updateEmbeddedDocuments('Item', clears);
      return { hidden: 0, reset: true };
    }

    const mode = shop?.stockRules?.dailyHideMode || 'random';
    const updates = candidates.map((item) => ({
      _id: item.id,
      [`flags.dsa5.${HIDDEN_FLAG}`]: false,
      [`flags.dsa5.${PRICE_MOD_FLAG}`]: variationMax > 0 ? this.rollPriceVariation(variationMax) : 0,
    }));

    if (hidePercent > 0 && candidates.length) {
      let ordered = [...candidates];
      if (mode === 'lowStock') {
        ordered.sort((left, right) => (Number(left.system.quantity?.value) || 0) - (Number(right.system.quantity?.value) || 0));
      } else if (mode === 'config') {
        const types = new Set(this.enabledCategoryKeys(this.normalizeFillConfig(shop?.stockRules?.lastFillConfig)));
        ordered = ordered.filter((item) => types.has(item.type));
      } else {
        ordered = game.dsa5.itemLibrary.shuffle(ordered);
      }
      const hideCount = Math.round((ordered.length * hidePercent) / 100);
      for (const item of ordered.slice(0, hideCount)) {
        const update = updates.find((row) => row._id === item.id);
        if (update) update[`flags.dsa5.${HIDDEN_FLAG}`] = true;
      }
    }

    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
    return { hidden: updates.filter((row) => row[`flags.dsa5.${HIDDEN_FLAG}`]).length, reset: false };
  }

  /** Random integer percent in [-max, +max] (1% steps). */
  static rollPriceVariation(maxPercent) {
    const max = Math.max(0, Math.min(50, Math.trunc(Number(maxPercent) || 0)));
    if (max <= 0) return 0;
    return Math.floor(Math.random() * (max * 2 + 1)) - max;
  }

  /** Multiplier from Handelstag price scatter flag (1 + mod%). */
  static dayPriceFactor(item) {
    const mod = Number(getProperty(item, `flags.dsa5.${PRICE_MOD_FLAG}`));
    if (!Number.isFinite(mod) || mod === 0) return 1;
    return 1 + mod / 100;
  }

  static async toggleFeatured(item) {
    if (!item) return;
    const next = !item.getFlag('dsa5', MerchantConfig.SHOP_FEATURED_FLAG);
    return item.setFlag('dsa5', MerchantConfig.SHOP_FEATURED_FLAG, next);
  }

  static async toggleHiddenToday(item) {
    if (!item || item.system?.tradeLocked) return;
    const next = !item.getFlag('dsa5', HIDDEN_FLAG);
    return item.setFlag('dsa5', HIDDEN_FLAG, next);
  }

  /**
   * Mark all goods in a sheet section as today's special, or clear them if any
   * are already featured.
   */
  static async toggleFeaturedSection(actor, sectionKey) {
    return this.#toggleSectionFlag(actor, sectionKey, MerchantConfig.SHOP_FEATURED_FLAG);
  }

  /** Hide all goods in a section for today, or unhide them if any are already hidden. Skips trade-locked items. */
  static async toggleHiddenTodaySection(actor, sectionKey) {
    return this.#toggleSectionFlag(actor, sectionKey, HIDDEN_FLAG, { skipTradeLocked: true });
  }

  static async #toggleSectionFlag(actor, sectionKey, flag, { skipTradeLocked = false } = {}) {
    let items = this.#itemsInSection(actor, sectionKey);
    if (skipTradeLocked) items = items.filter((item) => !item.system?.tradeLocked);
    if (!items.length) return [];

    const next = !items.some((item) => item.getFlag('dsa5', flag));
    const updates = items.map((item) => ({
      _id: item.id,
      [`flags.dsa5.${flag}`]: next,
    }));
    return actor.updateEmbeddedDocuments('Item', updates);
  }

  static #itemsInSection(actor, sectionKey) {
    const resolved = this.resolveSectionKey(sectionKey);
    if (!resolved) return [];
    const { fillCategory, equipmentType } = resolved;
    return actor.items.filter((item) => {
      if (equipmentType) {
        return ['equipment', 'consumable'].includes(item.type)
          && item.system?.equipmentType?.value === equipmentType;
      }
      return item.type === fillCategory && DSA5.equipmentCategories.has(item.type);
    });
  }

  static async randomizeSectionQuantities(actor, sectionKey) {
    const items = this.#itemsInSection(actor, sectionKey)
      .filter((item) => !getProperty(item, 'system.worn.value'));
    if (!items.length) return [];

    const total = items.reduce((sum, item) => sum + (Number(item.system.quantity?.value) || 0), 0);
    if (total <= 0) return [];

    const payload = items.map((item) => ({
      _id: item.id,
      name: item.name,
      type: item.type,
      system: { quantity: { value: Number(item.system.quantity?.value) || 0 } },
    }));
    this.distributeQuantities(payload, total, { dropEmpty: false });
    const updates = payload.map((item) => ({
      _id: item._id,
      'system.quantity.value': Number(item.system.quantity.value) || 0,
    }));
    const updated = await actor.updateEmbeddedDocuments('Item', updates);
    ui.notifications.info(_loc('MERCHANT.fill.randomizedQuantities', { count: updates.length }));
    return updated;
  }

  static async clearSection(actor, sectionKey) {
    const resolved = this.resolveSectionKey(sectionKey);
    if (!resolved) return 0;
    const { fillCategory, equipmentType } = resolved;
    return this.#deleteMatching(actor, {
      types: [fillCategory],
      equipmentTypes: equipmentType ? [equipmentType] : null,
    });
  }

  static #scopeToSection(config, sectionType, equipmentType = null) {
    for (const [key, entry] of Object.entries(config.categories)) {
      entry.enabled = key === sectionType;
    }
    config.sectionType = sectionType;
    config.sectionEquipmentType = equipmentType || null;
    config.mode = 'replaceSection';
    if (sectionType === 'equipment' && equipmentType && config.categories.equipment?.types) {
      for (const key of Object.keys(config.categories.equipment.types)) {
        config.categories.equipment.types[key] = key === equipmentType;
      }
    }
  }

  /** When only some equipment subtypes are enabled, limit replace deletes to those. */
  static #restrictedEquipmentTypes(config) {
    if (config.sectionEquipmentType) return [config.sectionEquipmentType];
    if (!config.categories?.equipment?.enabled) return null;
    const types = config.categories.equipment.types;
    if (!types) return null;
    const enabled = Object.entries(types)
      .filter(([, on]) => on)
      .map(([key]) => key);
    if (!enabled.length || enabled.length === Object.keys(types).length) return null;
    return enabled;
  }

  static async #deleteMatching(actor, { types = [], equipmentTypes = null, all = false } = {}) {
    const typeSet = new Set(types);
    const equipSet = equipmentTypes?.length ? new Set(equipmentTypes) : null;
    const ids = actor.items
      .filter((item) => {
        if (!DSA5.equipmentCategories.has(item.type)) return false;
        if (getProperty(item, 'system.worn.value')) return false;
        if (all) return true;
        if (equipSet && ['equipment', 'consumable'].includes(item.type)) {
          return equipSet.has(item.system?.equipmentType?.value);
        }
        if (typeSet.size && !typeSet.has(item.type)) return false;
        return true;
      })
      .map((item) => item.id);
    if (ids.length) await actor.deleteEmbeddedDocuments('Item', ids);
    return ids.length;
  }

  static async #createOrMerge(actor, items, config) {
    const stackFill = config.qtyMode === 'total' || config.qtyMode === 'draws';
    const incoming = stackFill ? this.#collapseByIdentity(items, config) : items;
    const shouldMerge = config.mode === 'merge' && (!config.allowDuplicates || stackFill);
    if (!shouldMerge) {
      return actor.createEmbeddedDocuments('Item', incoming);
    }

    const updates = [];
    const creates = [];
    for (const incomingItem of incoming) {
      const existing = actor.items.find((item) => this.#sameLine(item, incomingItem, config));
      if (existing) {
        updates.push({
          _id: existing.id,
          'system.quantity.value': (Number(existing.system.quantity?.value) || 0) + (Number(incomingItem.system.quantity?.value) || 1),
        });
      } else {
        creates.push(incomingItem);
      }
    }
    const created = creates.length ? await actor.createEmbeddedDocuments('Item', creates) : [];
    if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
    return created;
  }

  static #collapseByIdentity(items, config) {
    const byKey = new Map();
    for (const item of items) {
      this.#ensureQuantity(item);
      const key = this.identityKey(item, config);
      const existing = byKey.get(key);
      if (existing) {
        existing.system.quantity.value += Number(item.system.quantity.value) || 1;
      } else {
        byKey.set(key, item);
      }
    }
    return [...byKey.values()];
  }

  static #sameLine(existing, incoming, config) {
    return this.identityKey(existing, config) === this.identityKey(incoming, config);
  }

  static async #persistFillConfig(actor, config) {
    await MerchantShopHelper.ensureShop(actor);
    const payload = duplicate(config);
    delete payload.appliedAt;
    delete payload.appliedCount;
    if (!foundry.utils.isPlainObject(payload.filters)) payload.filters = {};
    payload.filtersEnabled = !!payload.filtersEnabled;
    await actor.update({
      'system.merchant.shop.stockRules.lastFillConfig': _replace(payload),
    });
  }
}
