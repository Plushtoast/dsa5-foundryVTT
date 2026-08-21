/**
 * Actor mutations and sheet context for merchant shop config
 * (Preisstufe, banner, fill allow-list, shop materialization).
 */
import MerchantConfig from '../../config/merchant-config.js';
import DSA5 from '../../config/config-dsa5.js';
import ImageFramePicker from '../helpers/image-frame-picker.js';

export default class MerchantShopHelper {
  static shopUpdate(actor, shopFields) {
    const update = {};
    for (const [key, value] of Object.entries(shopFields)) {
      update[`system.merchant.shop.${key}`] = value;
    }
    return actor.update(update);
  }

  /** Materialize nullable `shop` so nested updates always have a SchemaField target. */
  static async ensureShop(actor) {
    if (MerchantConfig.shopOf(actor)) return actor;
    return actor.update({
      'system.merchant.shop': MerchantConfig.emptyShopView(actor),
    });
  }

  static applyPriceTier(actor, tier) {
    const priceTier = Math.max(1, Math.min(6, Number(tier) || 3));
    return actor.update({
      'system.merchant.shop.priceTier': priceTier,
      'system.merchant.sellingFactor': MerchantConfig.factorForPriceTier(priceTier),
      [`flags.dsa5.${MerchantConfig.CUSTOM_SELLING_FLAG}`]: false,
    });
  }

  static applyBuyTier(actor, tier) {
    const buyTier = Math.max(1, Math.min(6, Number(tier) || 1));
    return actor.update({
      'system.merchant.shop.buyTier': buyTier,
      'system.merchant.buyingFactor': MerchantConfig.factorForPriceTier(buyTier),
      [`flags.dsa5.${MerchantConfig.CUSTOM_BUYING_FLAG}`]: false,
    });
  }

  static setSellingFactor(actor, factor) {
    const value = Number(factor);
    const sellingFactor = Number.isFinite(value) && value > 0 ? value : 1;
    return actor.update({
      'system.merchant.sellingFactor': sellingFactor,
      'system.merchant.shop.priceTier': MerchantConfig.priceTierFromFactor(sellingFactor),
      [`flags.dsa5.${MerchantConfig.CUSTOM_SELLING_FLAG}`]: false,
    });
  }

  static setBuyingFactor(actor, factor) {
    const value = Number(factor);
    const buyingFactor = Number.isFinite(value) && value > 0 ? value : 0.5;
    return actor.update({
      'system.merchant.buyingFactor': buyingFactor,
      'system.merchant.shop.buyTier': MerchantConfig.priceTierFromFactor(buyingFactor),
      [`flags.dsa5.${MerchantConfig.CUSTOM_BUYING_FLAG}`]: false,
    });
  }

  static async setCustomSelling(actor, unlocked) {
    const update = { [`flags.dsa5.${MerchantConfig.CUSTOM_SELLING_FLAG}`]: !!unlocked };
    if (!unlocked) {
      const tier = Number(MerchantConfig.shopOf(actor)?.priceTier) || 3;
      update['system.merchant.shop.priceTier'] = tier;
      update['system.merchant.sellingFactor'] = MerchantConfig.factorForPriceTier(tier);
    }
    return actor.update(update);
  }

  static async setCustomBuying(actor, unlocked) {
    const update = { [`flags.dsa5.${MerchantConfig.CUSTOM_BUYING_FLAG}`]: !!unlocked };
    if (!unlocked) {
      const tier = Number(MerchantConfig.shopOf(actor)?.buyTier) || 1;
      update['system.merchant.shop.buyTier'] = tier;
      update['system.merchant.buyingFactor'] = MerchantConfig.factorForPriceTier(tier);
    }
    return actor.update(update);
  }

  static async setShopImage(actor, path) {
    await this.ensureShop(actor);
    const update = { 'system.merchant.shop.shopImage': path || null };
    if (!path) update['system.merchant.shop.shopImageFrame'] = {};
    return actor.update(update);
  }

  static async setShopImageFrame(actor, frame) {
    await this.ensureShop(actor);
    const normalized = ImageFramePicker.normalizeBanner(frame);
    if (ImageFramePicker.isDefault(normalized)) {
      return actor.update({ 'system.merchant.shop.shopImageFrame': {} });
    }
    return actor.update({ 'system.merchant.shop.shopImageFrame': normalized });
  }

  static async useActorImageAsBanner(actor) {
    return this.setShopImage(actor, actor.img || '');
  }

  static async setFillAllowList(actor, allowList) {
    await this.ensureShop(actor);
    const current = foundry.utils.duplicate(MerchantConfig.shopOf(actor)?.stockRules?.lastFillConfig || {});
    const nextCategories = allowList?.categories || MerchantConfig.defaultFillAllowList().categories;
    const preserved = current.categories || {};
    for (const [key, entry] of Object.entries(nextCategories)) {
      if (preserved[key]?.number != null) entry.number = preserved[key].number;
      if (preserved[key]?.each != null) entry.each = preserved[key].each;
    }
    return actor.update({
      'system.merchant.shop.stockRules.lastFillConfig': foundry.data.operators.ForcedReplacement.create({
        ...current,
        categories: nextCategories,
      }),
    });
  }

  static async toggleFillCategory(actor, category, enabled) {
    await this.ensureShop(actor);
    const current = foundry.utils.duplicate(MerchantConfig.shopOf(actor)?.stockRules?.lastFillConfig || {});
    const categories = foundry.utils.mergeObject(
      MerchantConfig.mergeFillAllowList(current).categories,
      current.categories || {},
      { inplace: false },
    );
    categories[category] ??= { enabled: false };
    categories[category].enabled = !!enabled;
    return actor.update({
      'system.merchant.shop.stockRules.lastFillConfig': foundry.data.operators.ForcedReplacement.create({
        ...current,
        categories,
      }),
    });
  }

  static async toggleFillEquipmentType(actor, type, enabled) {
    await this.ensureShop(actor);
    const current = foundry.utils.duplicate(MerchantConfig.shopOf(actor)?.stockRules?.lastFillConfig || {});
    const categories = foundry.utils.mergeObject(
      MerchantConfig.mergeFillAllowList(current).categories,
      current.categories || {},
      { inplace: false },
    );
    categories.equipment ??= { enabled: true, types: {} };
    categories.equipment.types ??= {};
    categories.equipment.types[type] = !!enabled;
    categories.equipment.enabled = Object.values(categories.equipment.types).some(Boolean);
    return actor.update({
      'system.merchant.shop.stockRules.lastFillConfig': foundry.data.operators.ForcedReplacement.create({
        ...current,
        categories,
      }),
    });
  }

  static rememberSubtab(actor, tab) {
    if (!actor?.id || !tab) return;
    game.user.setFlag('dsa5', `${MerchantConfig.SUBTAB_FLAG}.${actor.id}`, tab);
  }

  static rememberedSubtab(actor) {
    return actor?.id ? game.user.getFlag('dsa5', `${MerchantConfig.SUBTAB_FLAG}.${actor.id}`) : undefined;
  }

  static prepareSheetContext(actor) {
    const merchant = actor.system.merchant;
    const shopRaw = MerchantConfig.shopOf(actor) || MerchantConfig.emptyShopView(actor);
    const sellingFactor = Number(merchant.sellingFactor) || 1;
    const buyingFactor = Number(merchant.buyingFactor) || 0.5;
    const priceTier = MerchantConfig.priceTierFromFactor(sellingFactor);
    const buyTier = MerchantConfig.priceTierFromFactor(buyingFactor);
    const shop = {
      ...shopRaw,
      priceTier,
      buyTier,
      qlBand: MerchantConfig.normalizeBand(shopRaw.qlBand),
      poisonStepBand: MerchantConfig.normalizeBand(shopRaw.poisonStepBand, MerchantConfig.DEFAULT_POISON_STEP_BAND),
      stockRules: {
        ...(shopRaw.stockRules || {}),
        priceVariationPercent: shopRaw.stockRules?.priceVariationPercent ?? 10,
      },
    };
    const fillAllowList = MerchantConfig.mergeFillAllowList(shop.stockRules?.lastFillConfig);
    const fillCategories = Object.entries(fillAllowList.categories).map(([key, entry]) => ({
      key,
      enabled: !!entry.enabled,
      label: `TYPES.Item.${key}`,
      types: entry.types
        ? Object.entries(entry.types).map(([type, on]) => ({
          key: type,
          enabled: !!on,
          label: DSA5.equipmentTypes[type] || type,
        }))
        : null,
    }));
    const shopTitle = MerchantConfig.shopDisplayName(actor);
    const shopOwnerName = actor?.name || '';
    return {
      shop,
      shopTitle,
      shopOwnerName,
      showShopOwner: !!(shopOwnerName && shopTitle !== shopOwnerName),
      shopBanner: MerchantConfig.shopBannerSrc(actor),
      shopBannerCustom: !!MerchantConfig.shopOf(actor)?.shopImage,
      shopBannerVars: ImageFramePicker.buildBannerVars(MerchantConfig.shopBannerFrame(actor)),
      showShopTab: merchant.merchantType === 'merchant',
      priceTierSteps: MerchantConfig.priceTierSteps(priceTier),
      buyTierSteps: MerchantConfig.priceTierSteps(buyTier),
      sellPreview: MerchantConfig.previewPrice(sellingFactor),
      buyPreview: MerchantConfig.previewPrice(buyingFactor),
      enhanceChancePercent: Math.round((Number(shop.enhanceChance) || 0) * 100),
      fillCategories,
      merchantTypeLabel: DSA5.merchantTypes[merchant.merchantType] || merchant.merchantType,
      merchantTypeIcon: MerchantConfig.merchantTypeIcon(merchant.merchantType),
      merchantTypeSteps: MerchantConfig.merchantTypeSteps(merchant.merchantType),
      garadanSteps: MerchantConfig.garadanSteps(merchant.garadan),
    };
  }
}
