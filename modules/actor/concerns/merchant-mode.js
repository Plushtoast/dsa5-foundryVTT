/**
 * Merchant / loot / Garadan actor mode: create payloads, sheet-class sync.
 * Shop field mutations live on MerchantShopHelper; constants on MerchantConfig.
 * Convert UI stays in dsa5-core LootHelper.
 */
import MerchantConfig from '../../config/merchant-config.js';
import DSA5 from '../../config/config-dsa5.js';

export default class MerchantModeHelper {
  /** @deprecated Prefer MerchantConfig — kept for dsa5-core LootHelper. */
  static SHEET_CLASS_NAMES = MerchantConfig.SHEET_CLASS_NAMES;
  /** @deprecated Prefer MerchantConfig — kept for dsa5-core LootHelper. */
  static DEFAULT_SHEET_CLASS_NAMES = MerchantConfig.DEFAULT_SHEET_CLASS_NAMES;

  static CREATE_TYPE_HINTS = Object.freeze({
    merchant: 'MERCHANT.createMerchantHint',
    loot: 'MERCHANT.createLootHint',
    epic: 'MERCHANT.createEpicHint',
  });

  static CREATE_TYPE_SEARCH = Object.freeze({
    merchant: ['Merchant', 'Händler'],
    loot: ['Treasure', 'Schatz', 'Loot'],
    epic: ['Garadan', 'Epic'],
  });

  static merchantSheetClass(actorType) {
    const name = MerchantConfig.SHEET_CLASS_NAMES[actorType];
    return name ? `dsa5.${name}` : null;
  }

  static defaultSheetClass(actorType) {
    const name = MerchantConfig.DEFAULT_SHEET_CLASS_NAMES[actorType];
    return name ? `dsa5.${name}` : null;
  }

  static isManagedSheetClass(actorType, sheetClass) {
    if (!sheetClass) return true;
    return sheetClass === this.merchantSheetClass(actorType) || sheetClass === this.defaultSheetClass(actorType);
  }

  static desiredSheetClass(actorType, merchantType) {
    if (MerchantConfig.isMerchantMode(merchantType)) return this.merchantSheetClass(actorType);
    return this.defaultSheetClass(actorType);
  }

  static modeFromCreateType(type) {
    return MerchantConfig.CREATE_TYPE_MODES[type] ?? null;
  }

  static realActorType(type) {
    return this.modeFromCreateType(type) ? 'npc' : type;
  }

  static async setMerchantType(actor, type) {
    if (!actor || !(type in DSA5.merchantTypes)) return;
    if ((actor.system.merchant?.merchantType || 'none') === type) return;

    if (type === 'merchant') {
      await actor.update(
        { ownership: this.withDefaultPlayerAccess(actor.ownership) },
        { diff: false, recursive: false },
      );
    }
    return actor.update({ 'system.merchant.merchantType': type });
  }

  static async setGaradan(actor, value) {
    if (!actor) return;
    const next = Number(value);
    if (!Number.isFinite(next) || !(next in MerchantConfig.GARADAN_CHOICES)) return;
    if (Number(actor.system.merchant?.garadan) === next) return;
    return actor.update({ 'system.merchant.garadan': next });
  }

  /** LIMITED default ownership so all players can open the shop (OWNER not required). */
  static withDefaultPlayerAccess(ownership = {}) {
    const next = foundry.utils.duplicate(ownership) || {};
    next.default = CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED;
    return next;
  }

  static createDialogTypes() {
    return Object.entries(MerchantConfig.CREATE_TYPE_MODES).map(([value, mode]) => {
      const label = _loc(DSA5.merchantTypes[mode]);
      return {
        value,
        label,
        img: MerchantConfig.CREATE_TYPE_IMAGES[value],
        hint: this.CREATE_TYPE_HINTS[mode],
        searchText: [label, ...(this.CREATE_TYPE_SEARCH[mode] || []), value].join(' '),
      };
    });
  }

  /**
   * Unique default name from the translated merchant subtype (Händler / Schatz / Garadan).
   * @returns {string|null}
   */
  static defaultCreateName({ type, parent, pack } = {}) {
    const mode = this.modeFromCreateType(type);
    if (!mode) return null;
    return this.uniqueActorName(_loc(DSA5.merchantTypes[mode]), { parent, pack });
  }

  static uniqueActorName(baseName, { parent, pack } = {}) {
    let collection;
    if (parent) collection = parent.getEmbeddedCollection('Actor');
    else if (pack) collection = game.packs.get(pack)?.index;
    else collection = game.collections?.get('Actor') ?? game.actors;

    const takenNames = new Set();
    if (collection) {
      for (const document of collection) takenNames.add(document.name);
    }

    let name = baseName;
    let index = 1;
    while (takenNames.has(name)) name = `${baseName} (${++index})`;
    return name;
  }

  /**
   * Map synthetic create types onto npc + merchant flags. No-op for real Actor types.
   * @param {object} data
   * @returns {object} same object, mutated
   */
  static prepareCreateData(data) {
    if (!data || typeof data !== 'object') return data;

    const mode = this.modeFromCreateType(data.type);
    if (!mode) return data;

    if (!data.name?.trim()) data.name = this.defaultCreateName({ type: data.type });
    data.type = 'npc';
    this.enableMerchant(data, { mode });
    return data;
  }

  /**
   * @param {object} actorData create or update payload
   * @param {{ mode: 'merchant'|'loot'|'epic', shopName?: string, actorType?: string }} options
   */
  static enableMerchant(actorData, { mode = 'merchant', shopName = '', actorType = 'npc' } = {}) {
    const merchant = foundry.utils.getProperty(actorData, 'system.merchant') || {};
    const shop = merchant.shop || {};
    const priceTier = Number(shop.priceTier ?? merchant.priceTier) || 3;
    const buyTier = Number(shop.buyTier ?? merchant.buyTier) || 1;
    const resolvedShopName = shop.shopName ?? merchant.shopName ?? shopName ?? '';

    foundry.utils.mergeObject(actorData, {
      flags: {
        core: {
          sheetClass: this.merchantSheetClass(actorType || actorData.type || 'npc'),
        },
      },
      system: {
        merchant: {
          merchantType: mode,
          sellingFactor: merchant.sellingFactor ?? MerchantConfig.factorForPriceTier(priceTier),
          buyingFactor: merchant.buyingFactor ?? MerchantConfig.factorForPriceTier(buyTier),
          hidePlayer: merchant.hidePlayer ?? true,
          hideMoney: merchant.hideMoney ?? true,
          locked: merchant.locked ?? false,
          temporary: merchant.temporary ?? false,
          shop: {
            ...MerchantConfig.emptyShopView(actorData),
            ...shop,
            ...MerchantConfig.shopDefaults({
              shopName: resolvedShopName,
              priceTier,
              buyTier,
              tradeableOnly: shop.tradeableOnly ?? merchant.tradeableOnly ?? true,
            }),
          },
        },
      },
    });
    if (mode === 'merchant') {
      actorData.ownership = this.withDefaultPlayerAccess(actorData.ownership);
    }
    return actorData;
  }

  static disableMerchant(actorData, { actorType = 'npc' } = {}) {
    foundry.utils.mergeObject(actorData, {
      flags: {
        core: {
          sheetClass: this.defaultSheetClass(actorType || actorData.type || 'npc'),
        },
      },
      system: {
        merchant: {
          merchantType: 'none',
          locked: false,
          temporary: false,
          hidePlayer: false,
          shop: null,
        },
      },
    });
    return actorData;
  }

  /**
   * When merchantType changes on npc/character/creature, keep sheet class in sync
   * unless the user picked a third-party sheet.
   */
  static applySheetClassToChange(actor, changed) {
    if (!actor || !MerchantConfig.SYNC_ACTOR_TYPES.has(actor.type)) return;

    const nextType = foundry.utils.getProperty(changed, 'system.merchant.merchantType');
    if (nextType === undefined) return;

    const pendingClass = foundry.utils.getProperty(changed, 'flags.core.sheetClass');
    const currentClass = pendingClass || actor.getFlag('core', 'sheetClass') || '';
    if (!this.isManagedSheetClass(actor.type, currentClass)) return;

    const desired = this.desiredSheetClass(actor.type, nextType);
    if (desired && currentClass !== desired) {
      foundry.utils.setProperty(changed, 'flags.core.sheetClass', desired);
    }
  }

  static reopenSheetIfNeeded(actor, changed) {
    if (!foundry.utils.getProperty(changed, 'system.merchant.merchantType')) return;
    const sheetClass = foundry.utils.getProperty(changed, 'flags.core.sheetClass');
    if (!sheetClass) return;

    const sheet = actor.sheet;
    if (!sheet?.rendered) return;

    const desiredName = sheetClass.split('.').pop();
    if (sheet.constructor.name === desiredName) return;

    this.#reopenSheet(actor, sheet);
  }

  static async #reopenSheet(actor, sheet) {
    await sheet.close();
    actor._sheet = null;
    if (sheet.appId) delete actor.apps[sheet.appId];
    actor.sheet.render(true);
  }
}
