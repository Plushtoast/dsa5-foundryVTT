import { RollDialogBuilder } from '../dialog/dialog-builder.js';
import Itemdsa5 from '../item/item-dsa5.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MoneyTracker from '../system/orwell/money-tracker.js';
import TransactionSummaryService from '../system/payment/transaction-summary.js';
import { DefaultAppv2 } from './baseapp.js';
const { mergeObject, randomID } = foundry.utils;

export class Trade extends DefaultAppv2 {
  #gearSearch;

  static DEFAULT_OPTIONS = {
    classes: ['noscrollWizard'],
    position: {
      width: 900,
    },
    window: {
      title: 'MERCHANT.exchange',
      resizable: true,
    },
    actions: {
      itemExternalEdit: this._itemExternalEdit,
      itemEdit: this._itemEdit,
    }
  };

  static PARTS = {    
    main: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-trade.hbs',
      templates: ['systems/dsa5/templates/actors/parts/gearSearch.hbs'],
      scrollable: [".scrollable"]
    }
  }

  constructor(sourceId, targetId, options = {}) {
    super();
    this.tradeData = {
      offered: {},
      offer: {},
      id: options.id || randomID(),
      sourceId,
      targetId,
      offerAccepted: false,
      offeredAccepted: false,
    };
  }

  async startTrade() {
    game.socket.emit('system.dsa5', {
      type: 'startTrade',
      payload: {
        sourceId: this.tradeData.sourceId,
        targetId: this.tradeData.targetId,
        id: this.tradeData.id,
      },
    });
    this.render(true);
  }

  _filterGear(_event, query, rgx, html) {
    for (const entry of html.querySelectorAll(".item")) {
      if (!query) {
        entry.hidden = false;
        continue;
      }

      const title = entry.querySelector('[data-action="itemEdit"]')?.textContent || '';
      if (!title) {
        entry.hidden = false;
        continue;
      }
      const isMatch = [title].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
      entry.hidden = !isMatch;
    }
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#gearSearch?.unbind();
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const tradeFriend = DSA5_Utility.getSpeaker(this.tradeData.sourceId);
    let inventory = tradeFriend.prepareItems({ details: [] });

    inventory.inventory['money'] = {
      items: inventory.money.coins.map((x) => {
        x.name = _loc(x.name);
        return x;
      }),
      show: true,
      dataType: 'money',
    };

    for (let section of Object.values(inventory.inventory)) {
      for (let item of section.items) {
        if (this.tradeData.offer[item._id]) {
          item.system.quantity.value -= this.tradeData.offer[item._id].system.quantity.value;
        }
      }
    }

    mergeObject(data, {
      tradeData: this.tradeData,
      document: DSA5_Utility.getSpeaker(this.tradeData.targetId),
      tradeFriend,
      inventory,
    });
    return data;
  }

  static findTradeApp(id) {
    for (const [appId, app] of Array.from(foundry.applications.instances)) {
      if (app instanceof Trade && app?.tradeData?.id === id) {
        return app;
      }
    }
    return false;
  }

  async close(options = {}) {
    if (!options.skipSocket) {
      game.socket.emit('system.dsa5', {
        type: 'tradeCanceled',
        payload: {
          id: this.tradeData.id,
        },
      });
    }
    return super.close(options);
  }

  static _itemExternalEdit(ev, target) {
    this._editItem(target, this.tradeData.targetId);
  }

  static _itemEdit(ev, target) {
    this._editItem(target, this.tradeData.sourceId);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('.trade').on('click', (ev) => this._offerItem(ev));
    html.find('.acceptTrade').on('click', (ev) => this.acceptTrade(ev));

    this.#gearSearch ??= new foundry.applications.ux.SearchFilter({
      inputSelector: ".gearSearch",
      contentSelector: ".window-content",
      callback: this._filterGear.bind(this)
    });
    this.#gearSearch.bind(this.element);
  }

  _editItem(target, id) {
    const actor = DSA5_Utility.getSpeaker(id);
    const item = actor.items.get(target.dataset.itemId);
    item.sheet.render(true);
  }

  _offerItem(ev) {
    if (this.tradeData.offerAccepted) return;

    const id = ev.currentTarget.dataset.itemId;
    const actor = DSA5_Utility.getSpeaker(this.tradeData.sourceId);
    const item = actor.items.get(id);

    let amount = ev.ctrlKey ? 10 : 1;
    let isStopTrade = ev.currentTarget.dataset.stopTrade;
    let availableCount = isStopTrade ? this.tradeData.offer[id].system.quantity.value : item.system.quantity.value;
    if (item) {
      if (isStopTrade) {
        this.tradeData.offer[id].system.quantity.value -= Math.min(amount, availableCount);
        if (this.tradeData.offer[id].system.quantity.value <= 0) {
          delete this.tradeData.offer[id];
        }
        this.offerChanged();
        this.render();
      } else {
        if (this.tradeData.offer[id]) {
          availableCount -= this.tradeData.offer[id].system.quantity.value;
        } else {
          this.tradeData.offer[id] = item.toObject();
          this.tradeData.offer[id].system.quantity.value = 0;
        }

        if (availableCount > 0) {
          this.tradeData.offer[id].system.quantity.value += Math.min(amount, availableCount);
          this.offerChanged();
          this.render();
        }
      }

      DSA5SoundEffect.playMoneySound();
    }
  }

  async offerChanged() {
    game.socket.emit('system.dsa5', {
      type: 'receiveOfferedItems',
      payload: {
        id: this.tradeData.id,
        trader: this.tradeData.sourceId,
        offered: this.tradeData.offer,
      },
    });
  }

  static receiveOfferedItems(data) {
    const app = this.findTradeApp(data.payload.id);
    if (app) {
      if (data.payload.trader == app.tradeData.sourceId) {
        app.tradeData.offer = data.payload.offered;
        app.tradeData.offerAccepted = false;
      } else {
        app.tradeData.offered = data.payload.offered;
        app.tradeData.offeredAccepted = false;
      }
      app.render();
    }
  }

  static isGMTrade(actor) {
    return game.user.isGM && !actor.hasPlayerOwner;
  }

  static isPlayerTrade(actor) {
    return !game.user.isGM && actor.isOwner;
  }

  static socketStartTrade(data) {
    TransactionSummaryService.ensureTradeSummary(data.payload);
    const target = DSA5_Utility.getSpeaker(data.payload.targetId);
    if (this.isGMTrade(target) || this.isPlayerTrade(target)) {
      const app = new Trade(data.payload.targetId, data.payload.sourceId, {
        id: data.payload.id,
      });
      app.render(true);
    }
  }

  acceptTrade() {
    this.tradeData.offerAccepted = !this.tradeData.offerAccepted;
    this.render(true);
    game.socket.emit('system.dsa5', {
      type: 'acceptTrade',
      payload: {
        id: this.tradeData.id,
        trader: this.tradeData.sourceId,
        accepted: this.tradeData.offerAccepted,
      },
    });
  }

  static tradeWasAccepted(data) {
    const app = this.findTradeApp(data.payload.id);

    if (app) {
      app.tradeData.offeredAccepted = data.payload.accepted;
      if (app.tradeData.offerAccepted && app.tradeData.offeredAccepted) {
        app.finishTrade();
        DSA5SoundEffect.playMoneySound();
      } else {
        app.render();
      }
    }
  }

  async finishTrade() {
    let transferSummary = [];
    if (DSA5_Utility.isActiveGM()) {
      transferSummary = await Trade.updateData(this.tradeData);
      await TransactionSummaryService.finalizeTradeSummary(this.tradeData, 'completed', transferSummary);
    }

    game.socket.emit('system.dsa5', {
      type: 'tradeFinished',
      payload: {
        id: this.tradeData.id,
        tradeData: this.tradeData,
        transferSummary,
      },
    });

    this.close({ skipSocket: true });
    DSA5SoundEffect.playMoneySound();
  }

  static async updateData(tradeData) {
    const source = DSA5_Utility.getSpeaker(tradeData.sourceId);
    const target = DSA5_Utility.getSpeaker(tradeData.targetId);

    const sourceReceived = await this.modifyActor(source, tradeData.offer, tradeData.offered);
    const targetReceived = await this.modifyActor(target, tradeData.offered, tradeData.offer);

    return [
      { actorName: source.name, items: sourceReceived },
      { actorName: target.name, items: targetReceived },
    ].filter((entry) => entry.items.length > 0);
  }

  static async modifyActor(actor, toRemove, toAdd) {
    const removeIds = [];
    const updateItems = [];
    for (let id of Object.keys(toRemove)) {
      const item = actor.items.get(id);
      if (item) {
        if (item.system.quantity.value <= toRemove[id].system.quantity.value && item.type != 'money') {
          removeIds.push(id);
        } else {
          updateItems.push({
            _id: id,
            'system.quantity.value': item.system.quantity.value - toRemove[id].system.quantity.value,
          });
        }
      }
    }

    await actor.deleteEmbeddedDocuments('Item', removeIds, { render: false });
    await actor.updateEmbeddedDocuments('Item', updateItems, { render: false });

    const receivedItems = [];
    for (let item of Object.values(toAdd)) {
      const targetItem = await actor.sheet._manageDragItems(item, item.type);
      const resolvedItem = targetItem || actor.items.find((existing) => Itemdsa5.areEquals?.(item, existing)) || actor.items.find((existing) => existing.name === item.name && existing.type === item.type);
      receivedItems.push({
        item: resolvedItem || item,
        quantity: Number(item.system?.quantity?.value) || 0,
      });
    }

    await this.trackTradeItems(actor, toRemove, toAdd);
    return receivedItems.filter((entry) => entry.quantity > 0 && entry.item?.name);
  }

  static async trackTradeItems(actor, toRemove, toAdd) {
    for (const item of Object.values(toAdd)) {
      if (!item?.name || item.type === 'money') continue;
      const amount = Number(item.system?.quantity?.value) || 1;
      await MoneyTracker.track(actor, { type: 'buy', name: item.name, amount }, 0);
    }

    for (const item of Object.values(toRemove)) {
      if (!item?.name || item.type === 'money') continue;
      const amount = Number(item.system?.quantity?.value) || 1;
      await MoneyTracker.track(actor, { type: 'sell', name: item.name, amount }, 0);
    }
  }

  static async tradeWasFinished(data) {
    const app = this.findTradeApp(data.payload.id);

    if (app) app.close({ skipSocket: true });
  }

  static tradeWasCanceled(data) {
    const app = this.findTradeApp(data.payload.id);
    TransactionSummaryService.finalizeTradeSummary({ id: data.payload.id }, 'canceled');

    if (app) app.close({ skipSocket: true });
  }

  static socketListeners(data) {
    switch (data.type) {
      case 'receiveOfferedItems':
        this.receiveOfferedItems(data);
        return true;
      case 'startTrade':
        this.socketStartTrade(data);
        return true;
      case 'acceptTrade':
        this.tradeWasAccepted(data);
        return true;
      case 'tradeCanceled':
        this.tradeWasCanceled(data);
        return true;
      case 'tradeFinished':
        this.tradeWasFinished(data);
        return true;
    }
  }
}

export class TradeOptions extends DefaultAppv2 {
  constructor(actor, options) {
    super(options);
    this.actorId = RollDialogBuilder.buildSpeaker(actor, actor.token?.id);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.actors = game.actors.filter((x) => x.hasPlayerOwner && x.id != this.actorId.actor);
    return data;
  }

  static DEFAULT_OPTIONS = {
    classes: ['noscrollWizard'],
    window: {
      title: 'MERCHANT.exchange',
      resizable: true,
    },
  };

  static PARTS = {    
    main: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-tradeoptions.hbs',
      scrollable: [".scrollable"]
    }
  }

  _startTrade(ev) {
    const target = game.actors.get(ev.currentTarget.dataset.id);
    const app = new Trade(this.actorId, RollDialogBuilder.buildSpeaker(target, target.token?.id));
    app.startTrade();
    this.close();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('.startTrade').on('dblclick', (ev) => this._startTrade(ev));
  }
}
