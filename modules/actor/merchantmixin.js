import Itemdsa5 from '../item/item-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import DSA5Payment from '../system/helpers/payment.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MoneyTracker from '../system/orwell/money-tracker.js';
import { DefaultAppv2 } from './baseapp.js';
const { mergeObject, getProperty, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

//todo add on use button to merchant sheet

export const MerchantSheetMixin = (superclass) =>
  class extends superclass {
    static merchantDefaultTypes = new Set(['merchant', 'loot', 'epic']);

    static DEFAULT_OPTIONS = {
      classes: ['merchant-sheet'],
      actions: {
        allowMerchant: this._allowMerchant,
        toggleAllAllowMerchant: this._toggleAllAllowMerchant,
        lockTradeSection: this._lockTradeSection,
        clearInventory: this._clearInventory,
        randomGoods: this._randomGoods,
        setCustomPrice: this._setCustomPrice,
        choseTradefriend: this._choseTradefriend,
        removeOtherTradeFriend: this._removeOtherTradeFriend,
        toggleTradeLock: this._toggleTradeLock,
        itemExternalEdit: this._itemExternalEdit,
        tradeWrapper: this._tradeWrapper,
        changeAmountAllItems: { handler: this.changeAmountAllItems, buttons: [0, 2] },
      },
    };

    static PARTS = {
      header: {
        template: 'systems/dsa5/templates/actors/actorv2/merchant-header.hbs',
        templates: ['systems/dsa5/templates/actors/merchant/merchant-header.hbs', 'systems/dsa5/templates/actors/parts/attributes.hbs', 'systems/dsa5/templates/actors/parts/healthbar.hbs', 'systems/dsa5/templates/actors/actorv2/avatar.hbs']
      },
      tabs: {
        template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
        id: "tabs",
        classes: ["tabs", "right"],
      },
      main: {
        template: 'systems/dsa5/templates/actors/actor-main.hbs',
        scrollable: [''],
      },
      combat: {
        template: 'systems/dsa5/templates/actors/actor-combat.hbs',
        scrollable: [''],
        templates: ['systems/dsa5/templates/actors/parts/combatskills.hbs'],
      },
      skills: {
        template: 'systems/dsa5/templates/actors/actor-talents.hbs',
        templates: ['systems/dsa5/templates/actors/character/actor-aggregatedtests.hbs'],
        scrollable: [''],
      },
      magic: {
        template: 'systems/dsa5/templates/actors/character/actor-magic.hbs',
        templates: ['systems/dsa5/templates/actors/parts/spells.hbs', 'systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/magicalSigns.hbs'],
        scrollable: [''],
      },
      religion: {
        template: 'systems/dsa5/templates/actors/character/actor-religion.hbs',
        templates: ['systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/liturgies.hbs'],
        scrollable: [''],
      },
      inventory: {
        template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.hbs',
        scrollable: [''],
        templates: ['systems/dsa5/templates/actors/parts/gearSearchV2.hbs', 'systems/dsa5/templates/actors/parts/containerContent.hbs', 'systems/dsa5/templates/actors/merchant/merchant-permission-part.hbs'],
      },
      status: {
        template: 'systems/dsa5/templates/actors/parts/status_effects.hbs',
        scrollable: [''],
      },
      notes: {
        template: 'systems/dsa5/templates/actors/actor-notes.hbs',
        scrollable: [''],
      },
    };

    static MERCHANTPARTS = {
      merchant: {
        header: {
          template: 'systems/dsa5/templates/actors/merchant/merchant_limited_header.hbs',
        },
        tabs: {
          template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
          id: "tabs",
          classes: ["tabs", "right"],
        },
        inventory: {
          template: 'systems/dsa5/templates/actors/merchant/merchant-limited.hbs',
          templates: ['systems/dsa5/templates/actors/parts/gearSearch.hbs'],
        },
        notes: {
          template: 'systems/dsa5/templates/actors/actor-notes.hbs',
        },
      },
      loot: {
        inventory: {
          template: 'systems/dsa5/templates/actors/merchant/merchant-limited-loot.hbs',
          templates: ['systems/dsa5/templates/actors/parts/gearSearch.hbs'],
        },
      },
      epic: {
        tabs: {
          template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
          id: "tabs",
          classes: ["tabs", "right"],
        },
        inventory: {
          template: 'systems/dsa5/templates/actors/merchant/merchant-epic.hbs',
        },
        notes: {
          template: 'systems/dsa5/templates/actors/actor-notes.hbs',
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
          for (let tab of Object.keys(tabs)) {
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
        }
      } else {
        super.cleanTabs(tabs);
      }
    }

    _toggleDisabled(disabled) {
      console.warn('Merchant sheet does not support disabled state');
    }

    _prepareTabs(group) {
      const tabs = super._prepareTabs(group);
      const merchantType = this.actor.system.merchant.merchantType || 'none';
      if (tabs.inventory) tabs.inventory.label = DSA5.merchantTypes[merchantType];
      return tabs;
    }

    merchantSheetActivated() {
      return this.showLimited() || (this.playerViewEnabled() && this.constructor.merchantDefaultTypes.has(this.actor.system.merchant.merchantType));
    }

    static async _allowMerchant(ev, target) {
      const id = target.dataset.userId;
      await this.allowMerchant([id], !target.classList.contains('fa-check-circle'));
    }

    async allowMerchant(ids, allow) {
      let curPermissions = duplicate(this.actor.ownership);
      const newPerm = allow ? 1 : 0;
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

    static _randomGoods(ev, target) {
      game.dsa5.dialogs.RandomGoodsAddition.showDialog(this.actor, target);
    }

    static _setCustomPrice(ev, target) {
      target.classList.toggle('edit');
    }

    async _onRender(context, options) {
      await super._onRender(context, options);
      const html = $(this.element);

      html
        .find('.customPriceTag')
        .on('change', async (ev) => this.setCustomPrice(ev))
        .on('blur', (ev) => $(ev.currentTarget).closest('.setCustomPrice').removeClass('edit'));

      html.find('.gearSearch').prop('disabled', false);
    }

    _canDragStart(selector) {
      return !this.merchantSheetActivated() && this.isEditable;
    }

    static _itemExternalEdit(ev, target) {
      ev.preventDefault();
      let itemId = this._getItemId(target);
      const item = this.getTradeFriend().items.get(itemId);
      item.sheet.render(true);
    }

    static async _toggleTradeLock(ev, target) {
      const itemId = this._getItemId(target);
      let item = this.actor.items.get(itemId);
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

    static async _choseTradefriend(ev, target) {
      (await SelectTradefriendDialog.getDialog(this)).render(true);
    }

    static async _lockTradeSection(ev, target) {
      const updates = [];
      const rule = this.filterRule(target);
      let newValue;
      for (let item of this.actor.items) {
        if (rule(item)) {
          let upd = item.toObject();
          if (newValue === undefined) newValue = !upd.system.tradeLocked;

          upd.system.tradeLocked = newValue;
          updates.push(upd);
        }
      }
      this.actor.updateEmbeddedDocuments('Item', updates);
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
      for (let item of this.actor.items) {
        if (rule(item)) {
          let upd = { _id: item.id, system: { quantity: { value: item.system.quantity.value } } };
          RuleChaos.increment(ev, upd, 'system.quantity.value', 0);
          updates.push(upd);
        }
      }
      this.actor.updateEmbeddedDocuments('Item', updates);
    }

    async buyItem(dataset) {
      DSA5SoundEffect.playMoneySound();
      await this.transferItem(this.actor, this.getTradeFriend(), dataset, true);
    }

    async sellItem(dataset) {
      DSA5SoundEffect.playMoneySound();
      await this.transferItem(this.getTradeFriend(), this.actor, dataset, false);
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
      let id = { actor: tokenData.id };
      if (tokenData.token) id['token'] = tokenData.token.id;

      return id;
    }

    static async finishTransaction(source, target, price, itemId, buy, amount) {
      const item = source.items.get(itemId).toObject();
      if (Number(item.system.quantity.value) > 0) {
        amount = Math.min(Number(item.system.quantity.value), amount);
        let totalPrice = Number(price) * amount
        price = `${totalPrice}`;

        const noNeedToPay = this.noNeedToPay(target, source, price);
        const hasPaid = noNeedToPay || (await DSA5Payment.payMoney(target, price, true, false));
        if (hasPaid) {
          if (getProperty(item.system, 'worn.value')) item.system.worn.value = false;

          if (buy) {
            const res = await this.updateTargetTransaction(target, item, amount, source, price);
            await this.updateSourceTransaction(source, target, item, price, itemId, amount);
            await this.transferNotification(item, target, source, buy, price, amount, noNeedToPay, res);
            await this.selfDestruction(source);

            await MoneyTracker.track(target, { type: 'buy', name: item.name, amount }, totalPrice * -1);
            await MoneyTracker.track(source, { type: 'sell', name: item.name, amount }, totalPrice);
          } else {
            await this.updateSourceTransaction(source, target, item, price, itemId, amount);
            const res = await this.updateTargetTransaction(target, item, amount, source, price);
            await this.transferNotification(item, source, target, buy, price, amount, noNeedToPay, res);

            await MoneyTracker.track(target, { type: 'buy', name: item.name, amount }, totalPrice);
            await MoneyTracker.track(source, { type: 'sell', name: item.name, amount }, totalPrice * -1);
          }
        }
      }
      if (source.sheet.rendered) source.sheet.render(true);
      if (target.sheet.rendered) target.sheet.render(true);
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

      const notif = 'MERCHANT.' + (buy ? 'buy' : 'sell') + (noNeedToPay ? 'Loot' : '') + 'Notification';
      const anchor = item.type == 'money' ? game.i18n.localize(item.name) : res.toAnchor().outerHTML;
      const template = game.i18n.format(notif, {
        item: anchor,
        source: source.name,
        target: target.name,
        amount,
        price,
        buy,
      });
      const chatData = DSA5_Utility.chatDataSetup(template);
      if (notify == 2) chatData['whisper'] = ChatMessage.getWhisperRecipients('GM').map((u) => u.id);
      await ChatMessage.create(chatData);
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
        const msg = game.i18n.format('MERCHANT.buyNotification', {
          item: item.name,
          amount,
          source: target.name,
          target: source.name,
          price,
        });
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
      } else {
        const res = target.items.find((i) => Itemdsa5.areEquals(item, i));
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
      return this.otherTradeFriend || game.user.character;
    }

    async _manageDragItems(item, typeClass) {
      switch (typeClass) {
        case 'creature':
        case 'npc':
        case 'character':
          //TODO skip if not trading window enabled
          this.setTradeFriend(item);
          break;
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
        content: game.i18n.localize('MERCHANT.deleteAllGoods'),
        rejectClose: false,
        modal: true,
      });
      if (proceed) this.removeAllGoods(this.actor, ev);
    }

    async removeAllGoods(actor, target) {
      let text = $(target).text();
      $(target).html(' <i class="fa fa-spin fa-spinner"></i>');
      let ids = actor.items.filter((x) => DSA5.equipmentCategories.has(x.type) && !getProperty(x.system, 'worn.value')).map((x) => x.id);
      await actor.deleteEmbeddedDocuments('Item', ids);
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
          if (data.prepare.inventory['misc'].items.length == 0) data.prepare.inventory['misc'].show = false;
        }
      }
      data.hasOtherTradeFriend = !!this.otherTradeFriend;

      return data;
    }

    filterWornEquipment(data) {
      for (const [key, value] of Object.entries(data.prepare.inventory)) {
        value.items = value.items.filter((x) => !getProperty(x.system, 'worn.value'));
      }
    }

    prepareStorage(data) {
      if (data.merchantType == 'merchant') {
        for (const [key, value] of Object.entries(data.prepare.inventory)) {
          for (const item of value.items) {
            item.defaultPrice = this.getItemPrice(item);
            item.calculatedPrice =
              Number(parseFloat(`${item.defaultPrice * (this.actor.system.merchant.sellingFactor || 1)}`).toFixed(2)) *
              (getProperty(this.actor.system, `merchant.factors.sellingFactor.${game.user.id}`) || 1);
            item.priceTag = ` / ${item.calculatedPrice}`;
          }
        }
      } else if (data.merchantType == 'loot') {
        for (const [key, value] of Object.entries(data.prepare.inventory)) {
          for (const item of value.items) {
            item.calculatedPrice = this.getItemPrice(item);
          }
        }
        const money = {
          items: data.prepare.money.coins.map((x) => {
            x.name = game.i18n.localize(x.name);
            return x;
          }),
          show: true,
          dataType: 'money',
        };
        if (money.items.length) data.prepare.inventory['money'] = money;
      }
    }

    getItemPrice(item) {
      return DSA5_Utility.itemPrice(item);
    }

    prepareTradeFriend(data) {
      let friend = this.getTradeFriend();
      if (friend) {
        let tradeData = friend.prepareItems({ details: [] });
        let factor =
          this.actor.system.merchant.merchantType == 'loot'
            ? 1
            : (this.actor.system.merchant.buyingFactor || 1) * (getProperty(this.actor.system, `merchant.factors.buyingFactor.${game.user.id}`) || 1);
        let inventory = this.prepareSellPrices(tradeData.inventory, factor);
        if (inventory['misc'].items.length == 0) inventory['misc'].show = false;

        if (data.merchantType == 'loot') {
          inventory['money'] = {
            items: tradeData.money.coins.map((x) => {
              x.name = game.i18n.localize(x.name);
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
      for (const [key, value] of Object.entries(inventory)) {
        for (const item of value.items) {
          item.calculatedPrice = Number(parseFloat(`${this.getItemPrice(item) * factor}`).toFixed(2));
        }
      }
      return inventory;
    }
  };

class SelectTradefriendDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'DIALOG.setTargetToUser',
      resizable: true,
    },
    position: {
      width: 400,
    },
    actions: {
      select: this.setTargetToUser,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/selectTradeFriend.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.users = game.user.isGM ? await game.dsa5.apps.gameMasterMenu.getTrackedHeros() : game.actors.filter((x) => x.isOwner);
    return data;
  }

  static async getDialog(actor) {
    const dialog = new SelectTradefriendDialog();
    dialog.actor = actor;
    return dialog;
  }

  static setTargetToUser(ev, target) {
    this.actor.setTradeFriend({ _id: target.dataset.id });
    this.close();
  }
}

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

    return this.filterSeen(items, actor);
  }

  static filterSeen(items, actor) {
    const seen = new Set();
    const actorItems = (actor?.items || []).reduce((acc, x) => {
      acc.add(`${x.type}_${x.name}`);
      return acc;
    }, new Set());

    const regex = new RegExp(`${game.i18n.localize('magical')}|${game.i18n.localize('blessed')}`, 'i');
    const filtered = items.filter((x) => {
      const domain = getProperty(x.system, 'effect.attributes');
      const price = Number(getProperty(x.system, 'price.value')) || 0;
      if (regex.test(domain) || price > 10000) return false;

      const seeName = `${x.type}_${x.name}`;

      if (seen.has(seeName) || actorItems.has(seeName)) return false;

      seen.add(seeName);
      return true;
    });
    return filtered;
  }

  static async addRandomGoods(actor, dlg, target) {
    const text = target.textContent;
    target.innerHTML = ' <i class="fa fa-spin fa-spinner"></i>';
    await actor.createEmbeddedDocuments('Item', await this.generateItems(dlg, actor));
    target.textContent = text;
  }
}
