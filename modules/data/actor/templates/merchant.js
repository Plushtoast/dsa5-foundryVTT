import DSA5 from '../../../config/config-dsa5.js';
import MerchantConfig from '../../../config/merchant-config.js';
import { DSADataModel } from '../../abstract.js';
import DSABooleanField from '../../fields/dsa_boolean_field.js';

const { SchemaField, NumberField, StringField, ObjectField, BooleanField, FilePathField } = foundry.data.fields;

/**
 * Always-on merchant block stays slim (type, factors, hide/lock).
 * Shop fill/display extras live on nullable `shop` so PCs/NPCs/vehicles that are not
 * shops persist `shop: null` instead of a full nested default tree.
 */
export default class MerchantTemplate extends DSADataModel {
  static _migrateData(source) {
    super._migrateData(source);
    const merchant = source.merchant;
    if (!merchant) return;

    if (Number(merchant.garadan) === 5) merchant.garadan = 2;

    const hasShopPayload = foundry.utils.isPlainObject(merchant.shop)
      || MerchantConfig.SHOP_SOURCE_KEYS.some((key) => Object.hasOwn(merchant, key));
    if (!hasShopPayload) return;

    const shop = MerchantTemplate.#collectShopSource(merchant);
    // Partial document updates omit merchantType. Never wipe shop from an incomplete migrate pass
    // (e.g. saving shopImageFrame alone would otherwise set merchant.shop = null).
    if (!Object.hasOwn(merchant, 'merchantType')) {
      merchant.shop = shop;
      return;
    }

    const mode = merchant.merchantType;
    const keepShop = MerchantConfig.isMerchantMode(mode)
      && (mode === 'merchant' || mode === 'epic' || MerchantConfig.isShopConfigPopulated(shop));

    if (!keepShop) {
      merchant.shop = null;
      return;
    }

    if (shop.priceTier == null && merchant.sellingFactor != null) {
      shop.priceTier = MerchantConfig.priceTierFromFactor(merchant.sellingFactor);
    }
    if (shop.buyTier == null && merchant.buyingFactor != null) {
      shop.buyTier = MerchantConfig.priceTierFromFactor(merchant.buyingFactor);
    }
    shop.qlBand = MerchantConfig.normalizeBand(shop.qlBand, MerchantConfig.DEFAULT_QL_BAND);
    shop.poisonStepBand = MerchantConfig.normalizeBand(shop.poisonStepBand, MerchantConfig.DEFAULT_POISON_STEP_BAND);
    merchant.shop = shop;
  }

  static #collectShopSource(merchant) {
    const shop = foundry.utils.isPlainObject(merchant.shop) ? { ...merchant.shop } : {};
    for (const key of MerchantConfig.SHOP_SOURCE_KEYS) {
      if (!Object.hasOwn(merchant, key)) continue;
      if (shop[key] == null) shop[key] = merchant[key];
      delete merchant[key];
    }
    if (Object.hasOwn(shop, 'wareGroups')) delete shop.wareGroups;
    return shop;
  }

  static defineSchema() {
    return {
      merchant: new SchemaField({
        locked: new BooleanField({ initial: false }),
        merchantType: new StringField({ initial: 'none', required: true, choices: DSA5.merchantTypes, label: 'creatureClass' }),
        temporary: new DSABooleanField({ initial: false }),
        sellingFactor: new NumberField({ initial: 1, step: 0.01, min: 0 }),
        buyingFactor: new NumberField({ initial: 0.5, step: 0.01, min: 0 }),
        hidePlayer: new DSABooleanField({ initial: false, label: 'MERCHANT.hidePlayer', tooltip: 'MERCHANT.hidePlayerHint' }),
        hideMoney: new DSABooleanField({ initial: false, label: 'MERCHANT.hideMoney', tooltip: 'MERCHANT.hideMoneyHint' }),
        allowPlayerItemDetails: new DSABooleanField({
          initial: true,
          label: 'MERCHANT.allowPlayerItemDetails',
          tooltip: 'MERCHANT.allowPlayerItemDetailsHint',
        }),
        presentationMode: new DSABooleanField({
          initial: false,
          label: 'MERCHANT.presentationMode',
          tooltip: 'MERCHANT.presentationModeHint',
        }),
        factors: new SchemaField({
          buyingFactor: new ObjectField(),
          sellingFactor: new ObjectField(),
        }),
        garadan: new NumberField({
          initial: 0,
          label: 'Garadan',
          choices: MerchantConfig.GARADAN_CHOICES,
        }),
        shop: new SchemaField({
          shopName: new StringField({ initial: '', label: 'MERCHANT.shopName' }),
          shopImage: new FilePathField({
            categories: ['IMAGE'],
            required: false,
            nullable: true,
            blank: true,
            initial: null,
            label: 'MERCHANT.shopImage',
          }),
          shopImageFrame: new ObjectField({
            initial: {},
            label: 'MERCHANT.shopImageFrame',
          }),
          priceTier: new NumberField({
            initial: 3,
            integer: true,
            min: 1,
            max: 6,
            label: 'MERCHANT.priceTier.label',
            choices: MerchantConfig.PRICE_TIER_CHOICES,
          }),
          buyTier: new NumberField({
            initial: 1,
            integer: true,
            min: 1,
            max: 6,
            label: 'MERCHANT.buyTier',
            choices: MerchantConfig.PRICE_TIER_CHOICES,
          }),
          region: new StringField({ initial: '', label: 'PLANT.region' }),
          maxPrice: new NumberField({
            initial: MerchantConfig.DEFAULT_MAX_PRICE,
            min: 0,
            label: 'MERCHANT.maxPrice',
          }),
          stockRules: new SchemaField({
            dailyHidePercent: new NumberField({ initial: 0, min: 0, max: 100, integer: true, label: 'MERCHANT.dailyHidePercent' }),
            dailyHideMode: new StringField({
              initial: 'random',
              required: true,
              choices: MerchantConfig.DAILY_HIDE_MODES,
              label: 'MERCHANT.dailyHideMode.label',
            }),
            priceVariationPercent: new NumberField({
              initial: 10,
              min: 0,
              max: 50,
              integer: true,
              label: 'MERCHANT.priceVariation',
            }),
            lastFillConfig: new ObjectField({ initial: {} }),
            restockMode: new StringField({
              initial: 'replaceSection',
              required: true,
              choices: MerchantConfig.RESTOCK_MODES,
              label: 'MERCHANT.restockMode.label',
            }),
          }),
          enhanceChance: new NumberField({ initial: 0, min: 0, max: 1, step: 0.01, label: 'MERCHANT.enhanceChance' }),
          allowDuplicates: new DSABooleanField({ initial: true, label: 'MERCHANT.allowDuplicates' }),
          tradeableOnly: new DSABooleanField({
            initial: true,
            label: 'MERCHANT.tradeableOnly',
            hint: 'MERCHANT.tradeableOnlyHint',
          }),
          qlBand: new NumberField({
            initial: MerchantConfig.DEFAULT_QL_BAND,
            integer: true,
            min: 1,
            max: 6,
            step: 1,
            label: 'MERCHANT.qlBand',
          }),
          poisonStepBand: new NumberField({
            initial: MerchantConfig.DEFAULT_POISON_STEP_BAND,
            integer: true,
            min: 1,
            max: 6,
            step: 1,
            label: 'MERCHANT.poisonStepBand',
          }),
          ammoStack: new NumberField({ initial: 20, integer: true, min: 1, label: 'MERCHANT.ammoStack' }),
        }, { required: false, nullable: true, initial: null }),
      }),
    };
  }
}
