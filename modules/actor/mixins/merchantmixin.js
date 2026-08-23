import Itemdsa5 from '../../item/item-dsa5.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5SoundEffect from '../../system/helpers/dsa-soundeffect.js';
import DSA5Payment from '../../system/payment/payment.js';
import RuleChaos from '../../system/rules/rule_chaos.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import MoneyTracker from '../../system/orwell/money-tracker.js';
import TransactionSummaryService from '../../system/payment/transaction-summary.js';
import { InventoryBulkActionHelper } from '../../system/helpers/inventory-bulk-action.js';
import { merchantCommercePartTemplates, merchantStallPartTemplates } from '../template-configs.js';
import MerchantModeHelper from '../concerns/merchant-mode.js';
import MerchantConfig from '../../config/merchant-config.js';
import MerchantStockService from '../../system/merchant/merchant-stock-service.js';
import MerchantStallHelper from '../../system/merchant/merchant-stall.js';
import MerchantShopHelper from '../../system/merchant/merchant-shop-helper.js';
import MerchantShopPresence from '../../system/merchant/merchant-shop-presence.js';
import StockFillDialog from '../../system/merchant/stock-fill-dialog.js';
import { ItemFactory } from '../../item/item-factory.js';
import { fetchBagItems, transferBagWithContents } from '../../hooks/itemDrop.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import ImageFrameDialog from '../../dialog/image-frame-dialog.js';
import ImageFramePicker from '../../system/helpers/image-frame-picker.js';

const { mergeObject, getProperty, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

//todo add on use button to merchant sheet

export const MerchantSheetMixin = (superclass) =>
  class extends superclass {
    static merchantDefaultTypes = new Set(['merchant', 'loot', 'epic']);
    #merchantRenderAbort;
    /** @type {ReturnType<typeof MerchantStallHelper.defaultFilter>|null} */
    #stallFilter = null;
    #stallHoverToken = 0;
    #shopPresence = { didJoin: false };

    static DEFAULT_OPTIONS = {
      classes: ['merchant-sheet'],
      actions: {
        allowMerchant: this._allowMerchant,
        toggleAllAllowMerchant: this._toggleAllAllowMerchant,
        lockTradeSection: this._lockTradeSection,
        clearInventory: this._clearInventory,
        randomGoods: this._randomGoods,
        fillStock: this._fillStock,
        refillStock: this._refillStock,
        restockSection: this._restockSection,
        clearSection: this._clearSection,
        applyDailyHide: this._applyDailyHide,
        openItemLibrary: this._openItemLibrary,
        merchantSectionMenu: this._merchantSectionMenu,
        toggleShopFeatured: this._toggleShopFeatured,
        toggleShopFeaturedSection: this._toggleShopFeaturedSection,
        toggleShopHiddenToday: this._toggleShopHiddenToday,
        toggleShopHiddenTodaySection: this._toggleShopHiddenTodaySection,
        setCustomPrice: this._setCustomPrice,
        choseTradefriend: this._choseTradefriend,
        openTradeFriendSheet: this._openTradeFriendSheet,
        removeOtherTradeFriend: this._removeOtherTradeFriend,
        toggleTradeLock: this._toggleTradeLock,
        itemExternalEdit: this._itemExternalEdit,
        tradeWrapper: this._tradeWrapper,
        changeAmountAllItems: { handler: this.changeAmountAllItems, buttons: [0, 2] },
        pickShopImage: this._pickShopImage,
        useActorImage: this._useActorImage,
        clearShopImage: this._clearShopImage,
        configureShopBannerFrame: this._configureShopBannerFrame,
        showShopImage: this._showShopImage,
        setMerchantType: this._setMerchantType,
        setGaradan: this._setGaradan,
        setPriceTier: this._setPriceTier,
        setBuyTier: this._setBuyTier,
        setShopChip: this._setShopChip,
        toggleShopAffordable: this._toggleShopAffordable,
        toggleShopSpecials: this._toggleShopSpecials,
        toggleSellMode: this._toggleSellMode,
        togglePresentationMode: this._togglePresentationMode,
        toggleShopPurse: this._toggleShopPurse,
        setShopViewMode: this._setShopViewMode,
        itemEdit: this._itemEdit,
      },
    };

    static TABS = {
      sheet: superclass.TABS.sheet,
      merchant: {
        tabs: [
          { id: 'stock', label: 'MERCHANT.subtab.stock', icon: 'fas fa-boxes-stacked' },
          { id: 'shop', label: 'MERCHANT.subtab.shop', icon: 'fas fa-store' },
          { id: 'access', label: 'MERCHANT.subtab.access', icon: 'fas fa-user-lock' },
        ],
        initial: 'stock',
      },
    };

    get title() {
      return MerchantConfig.shopDisplayName(this.actor) || super.title;
    }

    static PARTS = {
      sheet: super.PARTS.sheet,
      header: {
        template: 'systems/dsa5/templates/actors/actorv2/merchant-header.hbs',
        templates: ['systems/dsa5/templates/actors/merchant/merchant-header.hbs', 'systems/dsa5/templates/actors/parts/attributes.hbs', 'systems/dsa5/templates/actors/parts/healthbar.hbs', 'systems/dsa5/templates/actors/actorv2/avatar.hbs']
      },
      tabs: super.PARTS.tabs,
      main: {
        template: 'systems/dsa5/templates/actors/actor-main.hbs',
        scrollable: [''],
      },
      combat: super.PARTS.combat,
      skills: super.PARTS.skills,
      magic: super.PARTS.magic,
      religion: super.PARTS.religion,
      inventory: {
        template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.hbs',
        scrollable: [''],
        templates: [...merchantCommercePartTemplates],
      },
      companion: super.PARTS.companion,
      status: super.PARTS.status,
      notes: super.PARTS.notes,
    };

    static MERCHANTPARTS = {
      merchant: {
        sheet: super.PARTS.sheet,
        header: {
          template: 'systems/dsa5/templates/actors/merchant/merchant_limited_header.hbs',
          templates: [
            'systems/dsa5/templates/actors/merchant/parts/shop-buyer.hbs',
            'systems/dsa5/templates/actors/merchant/parts/shop-purse.hbs',
          ],
        },
        tabs: super.PARTS.tabs,
        inventory: {
          template: 'systems/dsa5/templates/actors/merchant/merchant-limited.hbs',
          scrollable: ['', '.dsa-shop-presentation__list', '.dsa-shop-presentation__stage'],
          templates: [...merchantStallPartTemplates],
        },
        notes: {
          template: 'systems/dsa5/templates/actors/actor-notes.hbs',
          scrollable: [''],
        },
      },
      loot: {
        sheet: super.PARTS.sheet,
        header: {
          template: 'systems/dsa5/templates/actors/merchant/merchant_limited_header.hbs',
          templates: [
            'systems/dsa5/templates/actors/merchant/parts/shop-buyer.hbs',
            'systems/dsa5/templates/actors/merchant/parts/shop-purse.hbs',
          ],
        },
        inventory: {
          template: 'systems/dsa5/templates/actors/merchant/merchant-limited-loot.hbs',
          scrollable: [''],
          templates: [...merchantStallPartTemplates],
        },
      },
      epic: {
        sheet: super.PARTS.sheet,
        tabs: super.PARTS.tabs,
        inventory: {
          template: 'systems/dsa5/templates/actors/merchant/merchant-epic.hbs',
          scrollable: [''],
        },
        notes: {
          template: 'systems/dsa5/templates/actors/actor-notes.hbs',
          scrollable: [''],
        },
      },
    };

    _configureRenderParts(options) {
      if (this.merchantSheetActivated()) {
        const merchantType = this.actor.system.merchant.merchantType;
        if (this.constructor.merchantDefaultTypes.has(merchantType)) {
          return foundry.utils.deepClone(this.constructor.MERCHANTPARTS[merchantType]);
        } else {
          return foundry.utils.deepClone(this.constructor.LIMITEDPARTS);
        }
      }
      return super._configureRenderParts(options);
    }

    cleanTabs(tabs) {
      if (this.merchantSheetActivated()) {
        let toKeep;
        const merchantType = this.actor.system.merchant.merchantType || 'none';
        switch (merchantType) {
          case 'epic':
          case 'merchant':
            toKeep = new Set(['inventory', 'notes']);
            break;
          case 'loot':
            toKeep = new Set(['inventory']);
            break;
        }

        if (toKeep) {
          let hasAnyActive;
          for (const tab of Object.keys(tabs)) {
            if (!toKeep.has(tab)) {
              delete tabs[tab];
              continue;
            }
            hasAnyActive = hasAnyActive || tabs[tab].active;
          }
          if (!hasAnyActive) {
            tabs.inventory.active = true;
            tabs.inventory.cssClass = 'active';
          }
        } else {
          super.cleanTabs(tabs);
        }
      } else {
        super.cleanTabs(tabs);
      }
    }

    /**
     * Player/limited shop views stay interactive (buy, search, filters) even when the
     * document is not editable (LIMITED permission or a locked pack). Edit view still
     * honors Foundry's disabled state.
     */
    _toggleDisabled(disabled) {
      super._toggleDisabled(this.merchantSheetActivated() ? false : disabled);
    }

    tracksShopPresence() {
      if (!this.merchantSheetActivated()) return false;
      const merchantType = this.actor.system.merchant?.merchantType;
      return merchantType === 'merchant' || merchantType === 'loot';
    }

    _prepareTabs(group) {
      // Merchant subtabs must not run ActorSheet.cleanTabs (that keeps only inventory/notes).
      if (group === 'merchant') {
        const saved = MerchantShopHelper.rememberedSubtab(this.actor);
        if (saved) this.tabGroups.merchant = saved;
        const tabs = foundry.applications.api.Application.prototype._prepareTabs.call(this, 'merchant');
        if (this.actor.system.merchant.merchantType !== 'merchant') delete tabs.shop;
        if (this.tabGroups.merchant && !tabs[this.tabGroups.merchant]) {
          this.tabGroups.merchant = 'stock';
          if (tabs.stock) {
            for (const tab of Object.values(tabs)) {
              tab.active = tab.id === 'stock';
              tab.cssClass = tab.active ? 'active' : '';
            }
          }
        }
        return tabs;
      }
      const tabs = super._prepareTabs(group);
      const merchantType = this.actor.system.merchant.merchantType || 'none';
      if (tabs.inventory) tabs.inventory.label = DSA5.merchantTypes[merchantType];
      return tabs;
    }

    merchantSheetActivated() {
      return this.showLimited() || (this.playerViewEnabled() && this.constructor.merchantDefaultTypes.has(this.actor.system.merchant.merchantType));
    }

    changeTab(tab, group, options) {
      super.changeTab(tab, group, options);
      if (group === 'merchant') MerchantShopHelper.rememberSubtab(this.actor, tab);
    }

    static async _pickShopImage() {
      await MerchantShopHelper.ensureShop(this.actor);
      const FilePicker = foundry.applications.apps.FilePicker;
      const current = this.actor.system.merchant.shop?.shopImage || this.actor.img || '';
      const picker = new FilePicker.implementation({
        type: 'image',
        current,
        callback: (path) => MerchantShopHelper.setShopImage(this.actor, path),
        document: this.actor,
        position: {
          top: this.position.top + 40,
          left: this.position.left + 10,
        },
      });
      await picker.browse();
    }

    static _useActorImage() {
      return MerchantShopHelper.useActorImageAsBanner(this.actor);
    }

    static _clearShopImage() {
      return MerchantShopHelper.setShopImage(this.actor, '');
    }

    static async _configureShopBannerFrame() {
      await MerchantShopHelper.ensureShop(this.actor);
      const imageSrc = MerchantConfig.shopBannerSrc(this.actor);
      if (!imageSrc) {
        ui.notifications.warn('MERCHANT.shopImageFrameNeedImage', { localize: true });
        return;
      }
      return ImageFrameDialog.configure({
        id: `dsa-shop-banner-frame-${this.actor.id}`,
        title: 'MERCHANT.shopImageFrame',
        imageSrc,
        preset: 'banner',
        frame: MerchantConfig.shopBannerFrame(this.actor),
        onSave: (frame) => MerchantShopHelper.setShopImageFrame(this.actor, frame),
      });
    }

    static _showShopImage() {
      const imageSrc = MerchantConfig.shopBannerSrc(this.actor);
      if (!imageSrc) {
        ui.notifications.warn('MERCHANT.shopImageFrameNeedImage', { localize: true });
        return;
      }
      return DSA5_Utility.showArtwork({
        img: imageSrc,
        name: MerchantConfig.shopDisplayName(this.actor),
        uuid: this.actor.uuid,
        isOwner: true,
      });
    }

    static _setMerchantType(ev, target) {
      return MerchantModeHelper.setMerchantType(this.actor, target.dataset.value);
    }

    static _setGaradan(ev, target) {
      return MerchantModeHelper.setGaradan(this.actor, target.dataset.value);
    }

    static _setPriceTier(ev, target) {
      return MerchantShopHelper.applyPriceTier(this.actor, target.dataset.value);
    }

    static _setBuyTier(ev, target) {
      return MerchantShopHelper.applyBuyTier(this.actor, target.dataset.value);
    }

    getStallFilter() {
      if (this.#stallFilter) return { ...MerchantStallHelper.defaultFilter(), ...this.#stallFilter };
      return MerchantStallHelper.rememberedFilter();
    }

    async applyStallFilter(patch) {
      const filter = { ...this.getStallFilter(), ...patch };
      this.#stallFilter = filter;
      await MerchantStallHelper.persistFilter(filter);
      this.render();
    }

    static _setShopChip(ev, target) {
      return this.applyStallFilter({ category: target.dataset.chip || 'all' });
    }

    static _toggleShopAffordable() {
      const filter = this.getStallFilter();
      return this.applyStallFilter({ affordable: !filter.affordable });
    }

    static _toggleShopSpecials() {
      const filter = this.getStallFilter();
      return this.applyStallFilter({ specials: !filter.specials });
    }

    static _toggleSellMode() {
      if (this.actor.system.merchant?.presentationMode) {
        this.sellMode = false;
        return;
      }
      this.sellMode = !this.sellMode;
      this.render();
    }

    static async _togglePresentationMode() {
      if (this.actor.system.merchant?.merchantType !== 'merchant') return;
      const next = !this.actor.system.merchant.presentationMode;
      this.sellMode = false;
      await this.actor.update({ 'system.merchant.presentationMode': next });
    }

    static _toggleShopPurse() {
      this.purseExpanded = !this.purseExpanded;
      this.render();
    }

    static _setShopViewMode(ev, target) {
      return this.applyStallFilter({ viewMode: target.dataset.view === 'list' ? 'list' : 'cards' });
    }

    async _onChangeForm(formConfig, event) {
      const target = event.target;
      const controlHost = target?.closest?.('[data-shop-control]') || target;
      const control = controlHost?.dataset?.shopControl;
      if (control === 'setEnhanceChance') {
        await MerchantShopHelper.shopUpdate(this.actor, { enhanceChance: Number(controlHost.value) / 100 });
        return;
      }
      if (control === 'toggleFillCategory') {
        await MerchantShopHelper.toggleFillCategory(this.actor, target.dataset.category, target.checked);
        return;
      }
      if (control === 'toggleFillEquipmentType') {
        await MerchantShopHelper.toggleFillEquipmentType(this.actor, target.dataset.type, target.checked);
        return;
      }
      if (control === 'setShopSort') {
        const filter = { ...this.getStallFilter(), sort: target.value };
        this.#stallFilter = filter;
        await MerchantStallHelper.persistFilter(filter);
        this.render();
        return;
      }
      if (target?.name === 'system.merchant.sellingFactor') {
        await MerchantShopHelper.setSellingFactor(this.actor, target.value);
        return;
      }
      if (target?.name === 'system.merchant.buyingFactor') {
        await MerchantShopHelper.setBuyingFactor(this.actor, target.value);
        return;
      }
      return super._onChangeForm(formConfig, event);
    }

    static async _allowMerchant(ev, target) {
      const id = target.dataset.userId;
      await this.allowMerchant([id], !target.classList.contains('fa-check-circle'));
    }

    async allowMerchant(ids, allow) {
      const curPermissions = duplicate(this.actor.ownership);
      const newPerm = allow ? CONST.DOCUMENT_OWNERSHIP_LEVELS.LIMITED : CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE;
      for (const id of ids) {
        curPermissions[id] = newPerm;
      }
      await this.actor.update({ ownership: curPermissions }, { diff: false, recursive: false, noHook: true });
    }

    static async _toggleAllAllowMerchant(ev, target) {
      const ids = game.users.filter((x) => !x.isGM).map((x) => x.id);
      const allow = target.dataset.lock == 'true';
      await this.allowMerchant(ids, allow);
      this.render();
    }

    static _fillStock() {
      StockFillDialog.show(this.actor);
    }

    static _randomGoods(ev, target) {
      StockFillDialog.show(this.actor);
    }

    static async _refillStock(ev, target) {
      const button = target;
      button?.setAttribute('disabled', 'disabled');
      button?.classList.add('disabled');
      try {
        await MerchantStockService.refill(this.actor);
      } finally {
        button?.removeAttribute('disabled');
        button?.classList.remove('disabled');
      }
    }

    static async _restockSection(ev, target) {
      const button = target;
      button?.setAttribute('disabled', 'disabled');
      button?.classList.add('disabled');
      try {
        await MerchantStockService.restockSection(this.actor, target.dataset.type);
      } finally {
        button?.removeAttribute('disabled');
        button?.classList.remove('disabled');
      }
    }

    static async _clearSection(ev, target) {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'MERCHANT.fill.clearSection' },
        content: _loc('MERCHANT.fill.clearSectionConfirm'),
        rejectClose: false,
        modal: true,
      });
      if (proceed) await MerchantStockService.clearSection(this.actor, target.dataset.type);
    }

    static async _applyDailyHide() {
      const result = await MerchantStockService.applyDailyHide(this.actor);
      if (result == null) return;
      if (result.reset) ui.notifications.info(_loc('MERCHANT.fill.shopDayReset'));
      else ui.notifications.info(_loc('MERCHANT.fill.shopDayDone', { count: result.hidden }));
    }

    static async _merchantSectionMenu(ev, target) {
      const app = this;
      const menu = new foundry.applications.ux.ContextMenu(this.element, '', [
        {
          label: 'SHEET.addItem',
          icon: '<i class="fas fa-plus fa-fw"></i>',
          onClick: () => this.constructor._onItemCreate.call(app, ev, target),
        },
        {
          label: 'MERCHANT.fill.restockSection',
          icon: '<i class="fas fa-rotate fa-fw"></i>',
          onClick: () => this.constructor._restockSection.call(app, ev, target),
        },
        {
          label: 'MERCHANT.fill.clearSection',
          icon: '<i class="fas fa-trash fa-fw"></i>',
          onClick: () => this.constructor._clearSection.call(app, ev, target),
        },
      ], { jQuery: false, fixed: true, eventName: 'none' });
      ui.context?.close();
      await menu.render(target, { animate: true });
      ui.context = menu;
    }

    static _openItemLibrary() {
      game.dsa5.itemLibrary?.render(true);
    }

    static _toggleShopFeatured(ev, target) {
      const item = this.actor.items.get(this._getItemId(target));
      return MerchantStockService.toggleFeatured(item);
    }

    static _toggleShopFeaturedSection(ev, target) {
      return MerchantStockService.toggleFeaturedSection(this.actor, target.dataset.type);
    }

    static _toggleShopHiddenToday(ev, target) {
      const item = this.actor.items.get(this._getItemId(target));
      return MerchantStockService.toggleHiddenToday(item);
    }

    static _toggleShopHiddenTodaySection(ev, target) {
      return MerchantStockService.toggleHiddenTodaySection(this.actor, target.dataset.type);
    }

    static _itemEdit(ev, target) {
      if (this.merchantSheetActivated()) {
        const merchant = this.actor.system.merchant;
        if (merchant?.presentationMode) {
          if (!game.user.isGM) return;
        } else if (merchant?.allowPlayerItemDetails === false) {
          return;
        }
      }
      const itemId = this._getItemId(target);
      const item = this.actor.items.get(itemId);
      item?.sheet.render(true);
    }

    static _setCustomPrice(ev, target) {
      target.classList.toggle('edit');
    }

    async _processSubmitData(event, form, submitData, options = {}) {
      if (foundry.utils.getProperty(submitData, 'system.merchant.shop') != null) {
        await MerchantShopHelper.ensureShop(this.actor);
      }
      return super._processSubmitData(event, form, submitData, options);
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      this.#merchantRenderAbort?.abort();
      this.#merchantRenderAbort = new AbortController();
      const { signal } = this.#merchantRenderAbort;

      ImageFramePicker.hydrateMediaFrames(this.element);

      for (const input of this.element.querySelectorAll('.customPriceTag')) {
        input.addEventListener('change', (ev) => this.setCustomPrice(ev), { signal });
        input.addEventListener('blur', (ev) => ev.currentTarget.closest('.setCustomPrice')?.classList.remove('edit'), { signal });
      }

      this.element.querySelectorAll('.gearSearch').forEach((el) => {
        el.disabled = false;
      });

      if (this.merchantSheetActivated()) {
        this.#bindStallItemTooltips(signal);
      } else {
        this.#clearStallTooltipChrome();
      }
      if (this.tracksShopPresence()) {
        await MerchantShopPresence.ensureJoined(this.actor.id, this.#shopPresence);
      } else {
        await MerchantShopPresence.leave(this.actor.id, this.#shopPresence);
      }
    }

    async close(options = {}) {
      this.#shopPresence.closing = true;
      await MerchantShopPresence.leave(this.actor?.id, this.#shopPresence);
      await this.#finalizeMerchantTradeSummary();
      try {
        return await super.close(options);
      } finally {
        this.#shopPresence.closing = false;
        this.#shopPresence.didJoin = false;
      }
    }

    async #finalizeMerchantTradeSummary() {
      const actorId = this.actor?.id;
      if (!actorId) return;
      if (game.user.isGM) {
        await TransactionSummaryService.finalizeSessionsForActor(actorId);
        return;
      }
      game.socket.emit('system.dsa5', {
        type: 'finalizeMerchantSummary',
        payload: { actorId },
      });
    }

    #bindStallItemTooltips(signal) {
      this.element.classList.add('tooltipConnector');
      this.element.dataset.tooltipDirection = 'LEFT';
      for (const tile of this.element.querySelectorAll('.dsa-shop-hover')) {
        if (tile.closest('.dsa-shop-presentation')) continue;
        tile.addEventListener('mouseenter', () => this.#onStallItemHover(tile), { signal });
        tile.addEventListener('mouseleave', () => this.#onStallItemHoverLeave(), { signal });
      }
    }

    #clearStallTooltipChrome() {
      this.element.classList.remove('tooltipConnector');
      delete this.element.dataset.tooltipDirection;
      this.#onStallItemHoverLeave();
    }

    async #onStallItemHover(target) {
      const hoverToken = ++this.#stallHoverToken;
      const itemId = target.dataset.itemId || this._getItemId(target);
      if (!itemId) return;
      const fromFriend = target.dataset.fromFriend === 'true' || !!target.querySelector('[data-action="itemExternalEdit"]');
      const item = fromFriend ? this.getTradeFriend()?.items.get(itemId) : this.actor.items.get(itemId);
      if (!item) return;

      const tooltip = await MerchantStallHelper.itemTooltipHtml(item, {
        priceLabel: target.dataset.priceLabel || '',
      });
      if (hoverToken !== this.#stallHoverToken || !target.matches(':hover') || !tooltip) return;

      const anchor = this.element.classList.contains('tooltipConnector') ? this.element : target;
      game.tooltip.activate(anchor, {
        html: tooltip,
        cssClass: 'itemLibraryTooltip',
      });
    }

    #onStallItemHoverLeave() {
      this.#stallHoverToken++;
      game.tooltip.deactivate();
    }

    _filterGear(_event, query, rgx, html) {
      for (const entry of html.querySelectorAll('.item')) {
        if (entry.classList.contains('dsa-shop-presentation__card')) continue;
        if (!query) {
          entry.hidden = false;
          continue;
        }
        const title = entry.querySelector('.dsa-shop-tile__name, .equipment-item-name [data-action="itemEdit"], .equipment-item-name a, .dsa-shop-presentation__pick span')?.textContent
          || entry.querySelector('[data-action="itemEdit"]')?.textContent
          || '';
        if (!title) {
          entry.hidden = false;
          continue;
        }
        const isMatch = [title].some((q) => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
        entry.hidden = !isMatch;
      }
    }

    _canDragStart(selector) {
      return !this.merchantSheetActivated() && this.isEditable;
    }

    static _itemExternalEdit(ev, target) {
      ev.preventDefault();
      const itemId = this._getItemId(target);
      const item = this.getTradeFriend().items.get(itemId);
      item.sheet.render(true);
    }

    static async _toggleTradeLock(ev, target) {
      const itemId = this._getItemId(target);
      const item = this.actor.items.get(itemId);
      this.actor.updateEmbeddedDocuments('Item', [{ _id: item.id, 'system.tradeLocked': !item.system.tradeLocked }]);
    }

    async setCustomPrice(ev) {
      ev.stopPropagation();
      ev.preventDefault();
      const itemId = this._getItemId(ev.currentTarget);

      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'flags.dsa5.customPriceTag': Number(ev.target.value) }]);
    }

    static _removeOtherTradeFriend() {
      this.otherTradeFriend = undefined;
      this.render(true);
    }

    static _openTradeFriendSheet() {
      if (!game.user.isGM) return;
      this.getTradeFriend()?.sheet?.render(true);
    }

    static async _choseTradefriend(_ev, _target) {
      const candidates = game.user.isGM
        ? await game.dsa5.apps.gameMasterMenu.getTrackedHeros()
        : game.actors.filter((actor) => actor.isOwner);
      const actors = ActorPickerDialog.buildActorPickerData({
        actors: candidates.filter((actor) => actor.id !== this.actor.id),
      });
      if (!actors.length) {
        ui.notifications.warn('DSAError.noProperActor', { localize: true });
        return;
      }

      const currentId = this.otherTradeFriend?.id;
      const [actorId] = await ActorPickerDialog.open({
        actors: actors.map((entry) => ({ ...entry, preselected: entry.id === currentId })),
        title: 'MERCHANT.choseTradefriend',
        selectionMode: 'single',
      });
      if (!actorId) return;
      this.setTradeFriend({ _id: actorId });
    }

    static async _lockTradeSection(ev, target) {
      const updates = [];
      const rule = this.filterRule(target);
      let newValue;
      for (const item of this.actor.items) {
        if (!rule(item)) continue;
        if (newValue === undefined) newValue = !item.system.tradeLocked;
        updates.push({ _id: item.id, 'system.tradeLocked': newValue });
      }
      if (updates.length) await this.actor.updateEmbeddedDocuments('Item', updates);
    }

    filterRule(target) {
      const filter = target.dataset.type;
      if (DSA5.equipmentTypes[filter]) {
        return (item) => {
          return item.type == 'equipment' && item.system.equipmentType.value == filter;
        };
      } else {
        return (item) => {
          return item.type == filter && DSA5.equipmentCategories.has(item.type);
        };
      }
    }

    static async changeAmountAllItems(ev, target) {
      const updates = [];
      const rule = this.filterRule(target);
      for (const item of this.actor.items) {
        if (rule(item)) {
          const upd = { _id: item.id, system: { quantity: { value: item.system.quantity.value } } };
          RuleChaos.increment(ev, upd, 'system.quantity.value', 0);
          updates.push(upd);
        }
      }
      this.actor.updateEmbeddedDocuments('Item', updates);
    }

    async buyItem(dataset) {
      DSA5SoundEffect.playMoneySound();
      const tradeFriend = this.getTradeFriend();
      if (!tradeFriend) return ui.notifications.error('DSAError.noProperActor', { localize: true });

      await this.transferItem(this.actor, tradeFriend, dataset, true);
    }

    async sellItem(dataset) {
      DSA5SoundEffect.playMoneySound();
      const tradeFriend = this.getTradeFriend();
      if (!tradeFriend) return ui.notifications.error('DSAError.noProperActor', { localize: true });

      await this.transferItem(tradeFriend, this.actor, dataset, false);
    }

    static _tradeWrapper(ev, target) {
      const dataset = { ...target.dataset };
      dataset.itemId = this._getItemId(target);
      dataset.amount = ev.ctrlKey ? 10 : 1;
      this.advanceWrapper(target, target.dataset.fct, dataset);
    }

    async transferItem(source, target, dataset, buy = true) {
      const { itemId, price, amount } = dataset;

      if (game.user.isGM) {
        await this.constructor.finishTransaction(source, target, price, itemId, buy, amount);
      } else if (this.constructor.noNeedToPay(target, source, price) || (await DSA5Payment.canPay(target, price, true))) {
        game.socket.emit('system.dsa5', {
          type: 'trade',
          payload: {
            target: this.constructor.transferTokenData(target),
            source: this.constructor.transferTokenData(source),
            price,
            itemId,
            buy,
            amount,
          },
        });
      }
    }

    static transferTokenData(tokenData) {
      const id = { actor: tokenData.id };
      if (tokenData.token) id['token'] = tokenData.token.id;

      return id;
    }

    static async finishTransaction(source, target, price, itemId, buy, amount) {
      const sourceItem = source.items.get(itemId);
      const item = sourceItem.toObject();
      if (Number(item.system.quantity.value) > 0) {
        amount = Math.min(Number(item.system.quantity.value), amount);
        let totalPrice = Number(price) * amount;

        const isBagWithContents = item.type === 'equipment' && getProperty(item, 'system.equipmentType.value') === 'bags'
          && source.items.some((i) => i.system.parent_id == itemId);

        // Sum up prices of bag contents for merchant transactions
        if (isBagWithContents && !this.noNeedToPay(target, source, `${totalPrice}`)) {
          const children = fetchBagItems(sourceItem, source);
          for (const child of children) {
            totalPrice += DSA5_Utility.itemPrice(child) * (child.system.quantity?.value || 1);
          }
        }

        price = `${totalPrice}`;

        const noNeedToPay = this.noNeedToPay(target, source, price);
        const shouldTrackMoney = !this.isLootTransfer(target, source);
        const hasPaid = noNeedToPay || (await DSA5Payment.payMoney(target, price, true, false));
        if (hasPaid) {
          if (getProperty(item.system, 'worn.value')) item.system.worn.value = false;

          if (buy) {
            let res;
            if (isBagWithContents) {
              res = await transferBagWithContents(source, target, item);
            } else {
              res = await this.updateTargetTransaction(target, item, amount, source, price);
              await this.updateSourceTransaction(source, target, item, price, itemId, amount);
            }
            await this.transferNotification(item, target, source, buy, price, amount, noNeedToPay, res);
            await this.selfDestruction(source);

            if (shouldTrackMoney) {
              await MoneyTracker.track(target, { type: 'buy', name: item.name, amount }, totalPrice * -1);
              await MoneyTracker.track(source, { type: 'sell', name: item.name, amount }, totalPrice);
            }
          } else {
            let res;
            if (isBagWithContents) {
              res = await transferBagWithContents(source, target, item);
            } else {
              await this.updateSourceTransaction(source, target, item, price, itemId, amount);
              res = await this.updateTargetTransaction(target, item, amount, source, price);
            }
            await this.transferNotification(item, source, target, buy, price, amount, noNeedToPay, res);

            if (shouldTrackMoney) {
              await MoneyTracker.track(target, { type: 'buy', name: item.name, amount }, totalPrice);
              await MoneyTracker.track(source, { type: 'sell', name: item.name, amount }, totalPrice * -1);
            }
          }
        }
      }
      if (source.sheet.rendered) source.sheet.render();
      if (target.sheet.rendered) target.sheet.render();
      game.socket.emit('system.dsa5', {
        type: 'refreshSheets',
        payload: {
          sheets: [
            { id: source.id, type: 'ActorSheet', sheetId: source.sheet.id },
            { id: target.id, type: 'ActorSheet', sheetId: target.sheet.id },
          ],
        },
      });
    }

    static isTemporaryToken(target) {
      return target.system.merchant.merchantType == 'loot' && target.system.merchant.temporary;
    }

    static isLootTransfer(target, source) {
      return target.system.merchant.merchantType == 'loot' || source.system.merchant.merchantType == 'loot';
    }

    static async selfDestruction(target) {
      if (this.isTemporaryToken(target)) {
        const hasItemsLeft = target.items.some((x) => DSA5.equipmentCategories.has(x.type) || (x.type == 'money' && x.system.quantity.value > 0));
        if (!hasItemsLeft) {
          game.socket.emit('system.dsa5', {
            type: 'hideDeletedSheet',
            payload: {
              target: this.transferTokenData(target),
            },
          });
          const tokens = target.getActiveTokens().map((x) => x.id);
          await canvas.scene.deleteEmbeddedDocuments('Token', tokens);
          await game.actors.get(target.id).delete();
          this.hideDeletedSheet(target);
        }
      }
    }

    static async hideDeletedSheet(target) {
      target.sheet.close(true);
    }

    static async transferNotification(item, source, target, buy, price, amount, noNeedToPay, res) {
      const notify = game.settings.get('dsa5', 'merchantNotification');
      if (notify == 0 || getProperty(item.system, 'equipmentType.value') == 'service') return;

      await TransactionSummaryService.recordMerchantTransaction({
        source,
        target,
        notify,
        item,
        receivedItem: res,
        amount,
        price,
        buy,
      });
    }

    static noNeedToPay(target, source, price) {
      return price == 0 || target.system.merchant.merchantType == 'loot' || source.system.merchant.merchantType == 'loot';
    }

    static async updateSourceTransaction(source, target, sourceItem, price, itemId, amount) {
      const item = duplicate(sourceItem);
      if (Number(item.system.quantity.value) > amount || item.type == 'money') {
        item.system.quantity.value = Number(item.system.quantity.value) - amount;
        await source.updateEmbeddedDocuments('Item', [item], { render: false });
      } else {
        await source.deleteEmbeddedDocuments('Item', [itemId], {
          render: false,
        });
      }
      if (!this.noNeedToPay(source, target, price)) await DSA5Payment.getMoney(source, price, true, false);
    }

    static async updateTargetTransaction(target, sourceItem, amount, source, price) {
      const item = duplicate(sourceItem);
      const isService = getProperty(item, 'system.equipmentType.value') == 'service';
      if (isService) {
        const msg = _loc('MERCHANT.buyNotification', {
          item: item.name,
          amount,
          source: target.name,
          target: source.name,
          price,
        });
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
      } else {
        const res = target.items.find((i) => ItemFactory.areEquals(item, i));
        item.system.quantity.value = amount;
        if (!res) {
          return (
            await target.createEmbeddedDocuments('Item', [item], {
              render: false,
            })
          )[0];
        } else {
          await Itemdsa5.stackItems(res, item, target, false);
          return res;
        }
      }
    }

    getTradeFriend() {
      const controlledActor = canvas?.tokens?.controlled?.length === 1 ? canvas.tokens.controlled[0].actor : undefined;
      return this.otherTradeFriend || game.user.character || controlledActor;
    }

    async _manageDragItems(item, typeClass) {
      switch (typeClass) {
        case 'creature':
        case 'npc':
        case 'character':
          if (this.merchantSheetActivated()) {
            this.setTradeFriend(item);
            break;
          }
          return super._manageDragItems(item, typeClass);
        default:
          return super._manageDragItems(item, typeClass);
      }
    }

    async _onDropActor(event, item) {
      const limited = this.actor.limited;
      const owner = this.actor.isOwner;

      if (!(limited || owner)) return false;
      if (item.uuid == this.actor.uuid) return false;

      if (owner || (limited && item.documentName == 'Actor')) {
        return await this._manageDragItems(item, item.type);
      }
    }

    setTradeFriend(otherTradeFriend) {
      const newTradeFriend = game.actors.get(otherTradeFriend._id);
      if (newTradeFriend.isOwner) {
        this.otherTradeFriend = newTradeFriend;
        this.render(true);
      }
    }

    async render(options = {}, _options = {}) {
      if (!game.user.isGM && this.actor.system.merchant.merchantType == 'loot' && this.actor.system.merchant.locked) {
        foundry.audio.AudioHelper.play({ src: 'sounds/lock.wav', loop: false }, false);
        return;
      }
      return super.render(options, _options);
    }

    static async _clearInventory(ev, target) {
      const proceed = await foundry.applications.api.DialogV2.confirm({
        window: {
          title: 'MERCHANT.clearInventory',
        },
        content: _loc('MERCHANT.deleteAllGoods'),
        rejectClose: false,
        modal: true,
      });
      if (proceed) this.removeAllGoods(this.actor, ev);
    }

    async removeAllGoods(actor, target) {
      const text = $(target).text();
      $(target).html(' <i class="fa fa-spin fa-spinner"></i>');
      await InventoryBulkActionHelper.deleteInventory(actor, { includeEquipped: false });
      $(target).text(text);
    }

    async _prepareContext(_options) {
      const data = await super._prepareContext(_options);
      data.merchantType = this.actor.system.merchant.merchantType || 'none';
      data.invName = DSA5.merchantTypes[data.merchantType];
      data.players = game.users
        .filter((x) => !x.isGM)
        .map((x) => {
          x.allowedMerchant = this.actor.testUserPermission(x, 'LIMITED', false);
          x.buyingFactor = getProperty(this.actor.system, `merchant.factors.buyingFactor.${x.id}`);
          x.sellingFactor = getProperty(this.actor.system, `merchant.factors.sellingFactor.${x.id}`);
          return x;
        });

      this.prepareStorage(data);
      if (data.merchantType != 'epic') {
        if (this.merchantSheetActivated()) {
          this.filterWornEquipment(data);
          this.prepareTradeFriend(data);
          this.hideEmptyCategories(data.prepare.inventory);
          if (!game.user.isGM) this.filterHiddenToday(data.prepare.inventory);
          data.stall = MerchantStallHelper.prepareStall({
            actor: this.actor,
            inventory: data.prepare.inventory,
            friend: data.tradeFriend,
            friendInventory: data.tradeFriend?.inventory,
            friendMoney: data.tradeFriend?.money,
            merchantMoney: data.prepare.money,
            filter: this.getStallFilter(),
            sellMode: !!this.sellMode,
            purseExpanded: !!this.purseExpanded,
            isLoot: data.merchantType === 'loot',
            isGM: game.user.isGM,
          });
        }
      }
      data.hasOtherTradeFriend = !!this.otherTradeFriend;
      if (this.merchantSheetActivated()) {
        data.shopViewers = MerchantShopPresence.viewersFor(this.actor.id);
        data.showShopViewersInBuyer = game.user.isGM && !this.otherTradeFriend;
      }
      data.notesReadOnly = this.merchantSheetActivated() && !this.isEditable;
      data.notesInlineEditable = data.owner && !data.notesReadOnly;
      data.tabs ??= this._prepareTabs('sheet');
      data.merchantTabs = this._prepareTabs('merchant');
      Object.assign(data, MerchantShopHelper.prepareSheetContext(this.actor));

      return data;
    }

    hideEmptyCategories(inventory) {
      for (const value of Object.values(inventory)) {
        value.show = value.items.length && value.items.some(x => !x.system.tradeLocked)
      }
    }

    filterWornEquipment(data) {
      for (const value of Object.values(data.prepare.inventory)) {
        value.items = value.items.filter((x) => !getProperty(x.system, 'worn.value'));
      }
    }

    filterHiddenToday(inventory) {
      for (const value of Object.values(inventory)) {
        value.items = value.items.filter((item) => !item.flags?.dsa5?.shopHiddenToday);
      }
    }

    prepareStorage(data) {
      if (data.merchantType == 'merchant') {
        for (const value of Object.values(data.prepare.inventory)) {
          value.hasFeatured = value.items.some((item) => item.flags?.dsa5?.shopFeatured);
          value.hasHiddenToday = value.items.some((item) => item.flags?.dsa5?.shopHiddenToday && !item.system?.tradeLocked);
          for (const item of value.items) {
            item.defaultPrice = this.getItemPrice(item);
            item.calculatedPrice =
              Number(parseFloat(`${item.defaultPrice * (this.actor.system.merchant.sellingFactor || 1)}`).toFixed(2)) *
              (getProperty(this.actor.system, `merchant.factors.sellingFactor.${game.user.id}`) || 1);
            item.priceTag = ` / ${item.calculatedPrice}`;
          }
        }
      } else if (data.merchantType == 'loot') {
        for (const value of Object.values(data.prepare.inventory)) {
          value.hasFeatured = value.items.some((item) => item.flags?.dsa5?.shopFeatured);
          value.hasHiddenToday = value.items.some((item) => item.flags?.dsa5?.shopHiddenToday && !item.system?.tradeLocked);
          for (const item of value.items) {
            item.calculatedPrice = this.getItemPrice(item);
          }
        }
        const money = {
          items: data.prepare.money.coins.map((x) => {
            x.name = _loc(x.name);
            return x;
          }),
          show: true,
          dataType: 'money',
        };
        if (money.items.length) data.prepare.inventory['money'] = money;
      }
    }

    getItemPrice(item) {
      return DSA5_Utility.itemPrice(item) * MerchantStockService.dayPriceFactor(item);
    }

    prepareTradeFriend(data) {
      const friend = this.getTradeFriend();
      if (friend) {
        const tradeData = friend.prepareItems({ details: [] });
        const factor =
          this.actor.system.merchant.merchantType == 'loot'
            ? 1
            : (this.actor.system.merchant.buyingFactor || 1) * (getProperty(this.actor.system, `merchant.factors.buyingFactor.${game.user.id}`) || 1);
        const inventory = this.prepareSellPrices(tradeData.inventory, factor);
        this.hideEmptyCategories(inventory);

        if (data.merchantType == 'loot') {
          inventory['money'] = {
            items: tradeData.money.coins.map((x) => {
              x.name = _loc(x.name);
              return x;
            }),
            show: true,
            dataType: 'money',
          };
        }

        mergeObject(data, {
          tradeFriend: {
            img: friend.img,
            name: friend.name,
            inventory,
            money: tradeData.money,
          },
        });
      } else {
        mergeObject(data, {
          tradeFriend: {
            inventory: [],
            money: { coins: [] },
          },
        });
      }
    }

    prepareSellPrices(inventory, factor) {
      for (const value of Object.values(inventory)) {
        for (const item of value.items) {
          item.calculatedPrice = Number(parseFloat(`${this.getItemPrice(item) * factor}`).toFixed(2));
        }
      }
      return inventory;
    }
  };

export class RandomGoodsAddition extends foundry.applications.api.DialogV2 {
  static get template() {
    return 'systems/dsa5/templates/dialog/randomGoods-dialog.hbs';
  }

  static async contentData(options = {}) {
    return {
      categories: Array.from(DSA5.equipmentCategories),
      options,
    };
  }

  static async showDialog(actor, target, options = {}) {
    const html = await renderTemplate(this.template, await this.contentData(options));
    new game.dsa5.dialogs.RandomGoodsAddition({
      window: {
        title: 'MERCHANT.randomGoods',
      },
      content: html,
      options,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'yes',
          default: true,
          callback: (event, button, dialog) => {
            this.addRandomGoods(actor, $(button.form), target);
          },
        },
        {
          action: 'no',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  static async generateItems(dlg, actor) {
    const itemLibrary = game.dsa5.itemLibrary;
    await itemLibrary.buildEquipmentIndex();

    const items = [];
    for (const cat of dlg.find('input[type="checkbox"]:checked')) {
      const name = cat.value;
      const count = Number(dlg.find(`input[name="each_${name}"]`).val());
      const number = Number(dlg.find(`input[name="number_${name}"]`).val());
      const randomItems = (await itemLibrary.getRandomItems(name, number)).map((x) => {
        const elem = x.toObject();
        elem.system.quantity.value = count;
        return elem;
      });

      items.push(...randomItems);
    }

    const filtered = this.filterSeen(items, actor);
    return filtered.map((item) => MerchantStockService.applyTypeDefaults(item, {}));
  }

  static filterSeen(items, actor, config = {}) {
    return MerchantStockService.filterSeen(items.map((item) => (item.toObject ? item.toObject() : item)), actor, config);
  }

  static async addRandomGoods(actor, dlg, target) {
    target?.setAttribute('disabled', 'disabled');
    target?.classList.add('disabled');
    try {
      await actor.createEmbeddedDocuments('Item', await this.generateItems(dlg, actor));
    } finally {
      target?.removeAttribute('disabled');
      target?.classList.remove('disabled');
    }
  }
}
