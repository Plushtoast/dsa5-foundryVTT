import Itemdsa5 from '../item/item-dsa5.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import MoneyTracker from '../system/orwell/money-tracker.js';
import TransactionSummaryService from '../system/payment/transaction-summary.js';
import { DefaultAppv2 } from './baseapp.js';
import { fetchBagItems } from '../hooks/itemDrop.js';
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

  get selfTrade() {
    const source = DSA5_Utility.getSpeaker(this.tradeData.sourceId);
    const target = DSA5_Utility.getSpeaker(this.tradeData.targetId);
    if (!source?.isOwner || !target?.isOwner) return false;

    for (const user of game.users) {
      if (user.id === game.user.id) continue;
      if (user.character?.id === source.id || user.character?.id === target.id) return false;
    }
    return true;
  }

  async startTrade() {
    if (this.selfTrade) {
      this.position.width = 1200;
      this.render(true);
      return;
    }
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
    const inventory = tradeFriend.prepareItems({ details: [] });

    inventory.inventory['money'] = {
      items: inventory.money.coins.map((x) => {
        x.name = _loc(x.name);
        return x;
      }),
      show: true,
      dataType: 'money',
    };

    for (const section of Object.values(inventory.inventory)) {
      for (const item of section.items) {
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

    if (this.selfTrade) {
      const targetActor = DSA5_Utility.getSpeaker(this.tradeData.targetId);
      const targetInventory = targetActor.prepareItems({ details: [] });

      targetInventory.inventory['money'] = {
        items: targetInventory.money.coins.map((x) => {
          x.name = _loc(x.name);
          return x;
        }),
        show: true,
        dataType: 'money',
      };

      for (const section of Object.values(targetInventory.inventory)) {
        for (const item of section.items) {
          if (this.tradeData.offered[item._id]) {
            item.system.quantity.value -= this.tradeData.offered[item._id].system.quantity.value;
          }
        }
      }

      data.targetInventory = targetInventory;
    }

    data.selfTrade = this.selfTrade;
    data.colClass = this.selfTrade ? 'four' : 'third';

    return data;
  }

  static findTradeApp(id) {
    for (const [_appId, app] of Array.from(foundry.applications.instances)) {
      if (app instanceof Trade && app?.tradeData?.id === id) {
        return app;
      }
    }
    return false;
  }

  async close(options = {}) {
    if (!options.skipSocket && !this.selfTrade) {
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

    if (this.selfTrade) {
      html.find('.tradeTarget').on('click', (ev) => this._offerTargetItem(ev));
      html.find('.completeSelfTrade').on('click', () => this.completeSelfTrade());
    } else {
      html.find('.acceptTrade').on('click', (ev) => this.acceptTrade(ev));
    }

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

    const amount = ev.ctrlKey ? 10 : 1;
    const isStopTrade = ev.currentTarget.dataset.stopTrade;
    let availableCount = isStopTrade ? this.tradeData.offer[id].system.quantity.value : item.system.quantity.value;
    if (item) {
      if (isStopTrade) {
        this.tradeData.offer[id].system.quantity.value -= Math.min(amount, availableCount);
        if (this.tradeData.offer[id].system.quantity.value <= 0) {
          delete this.tradeData.offer[id];
          // Remove bag children from offer when bag is removed
          if (item.system.isBagWithContents) {
            for (const child of fetchBagItems(item, actor)) {
              delete this.tradeData.offer[child.id];
            }
          }
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
          // Auto-include bag children in the offer
          if (item.system.isBagWithContents) {
            for (const child of fetchBagItems(item, actor)) {
              if (!this.tradeData.offer[child.id]) {
                this.tradeData.offer[child.id] = child.toObject();
              }
            }
          }
          this.offerChanged();
          this.render();
        }
      }

      DSA5SoundEffect.playMoneySound();
    }
  }

  _offerTargetItem(ev) {
    const id = ev.currentTarget.dataset.itemId;
    const actor = DSA5_Utility.getSpeaker(this.tradeData.targetId);
    const item = actor.items.get(id);

    const amount = ev.ctrlKey ? 10 : 1;
    const isStopTrade = ev.currentTarget.dataset.stopTrade;
    let availableCount = isStopTrade ? this.tradeData.offered[id].system.quantity.value : item.system.quantity.value;
    if (item) {
      if (isStopTrade) {
        this.tradeData.offered[id].system.quantity.value -= Math.min(amount, availableCount);
        if (this.tradeData.offered[id].system.quantity.value <= 0) {
          delete this.tradeData.offered[id];
          if (item.system.isBagWithContents) {
            for (const child of fetchBagItems(item, actor)) {
              delete this.tradeData.offered[child.id];
            }
          }
        }
        this.render();
      } else {
        if (this.tradeData.offered[id]) {
          availableCount -= this.tradeData.offered[id].system.quantity.value;
        } else {
          this.tradeData.offered[id] = item.toObject();
          this.tradeData.offered[id].system.quantity.value = 0;
        }

        if (availableCount > 0) {
          this.tradeData.offered[id].system.quantity.value += Math.min(amount, availableCount);
          if (item.system.isBagWithContents) {
            for (const child of fetchBagItems(item, actor)) {
              if (!this.tradeData.offered[child.id]) {
                this.tradeData.offered[child.id] = child.toObject();
              }
            }
          }
          this.render();
        }
      }

      DSA5SoundEffect.playMoneySound();
    }
  }

  async completeSelfTrade() {
    if (DSA5_Utility.isActiveGM()) {
      await Trade.updateData(this.tradeData);
    } else {
      game.socket.emit('system.dsa5', {
        type: 'selfTradeFinish',
        payload: { tradeData: this.tradeData },
      });
    }
    DSA5SoundEffect.playMoneySound();
    this.close({ skipSocket: true });
  }

  async offerChanged() {
    if (this.selfTrade) return;

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
    const updated = DSA5_Utility.isActiveGM();
    if (updated) {
      transferSummary = await Trade.updateData(this.tradeData);
      await TransactionSummaryService.finalizeTradeSummary(this.tradeData, 'completed', transferSummary);
    }

    game.socket.emit('system.dsa5', {
      type: 'tradeFinished',
      payload: {
        id: this.tradeData.id,
        tradeData: this.tradeData,
        transferSummary,
        updated,
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

    source.sheet?.render();
    target.sheet?.render();

    return [
      { actorName: source.name, items: sourceReceived },
      { actorName: target.name, items: targetReceived },
    ].filter((entry) => entry.items.length > 0);
  }

  static async modifyActor(actor, toRemove, toAdd) {
    const removeIds = [];
    const updateItems = [];
    for (const id of Object.keys(toRemove)) {
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

    const addItems = Object.values(toAdd);
    const addById = new Map(Object.entries(toAdd));
    const bagIds = new Set();
    const childOfBag = new Set();

    for (const [id, item] of addById) {
      if (item.type === 'equipment' && item.system?.equipmentType?.value === 'bags') {
        const hasChildren = addItems.some((other) => other._id !== item._id && other.system?.parent_id == id);
        if (hasChildren) bagIds.add(id);
      }
    }

    if (bagIds.size > 0) {
      for (const item of addItems) {
        if (!bagIds.has(item._id) && item.system?.parent_id && bagIds.has(item.system.parent_id)) {
          childOfBag.add(item._id);
        }
        if (bagIds.has(item._id) && item.system?.parent_id && bagIds.has(item.system.parent_id)) {
          childOfBag.add(item._id);
        }
      }
    }

    const idMap = new Map();
    const receivedItems = [];

    if (bagIds.size > 0) {
      const bagsToCreate = addItems.filter((item) => bagIds.has(item._id));
      const remaining = [...bagsToCreate];
      const created = new Set();
      while (remaining.length > 0) {
        const batch = remaining.filter((b) => !b.system.parent_id || !bagIds.has(b.system.parent_id) || created.has(b.system.parent_id));
        if (batch.length === 0) break; // prevent infinite loop
        for (const bag of batch) {
          const copy = foundry.utils.duplicate(bag);
          const newParentId = idMap.get(copy.system.parent_id);
          if (newParentId) copy.system.parent_id = newParentId;
          if (copy.system.worn?.value) copy.system.worn.value = false;
          const oldId = copy._id;
          delete copy._id;
          const [createdBag] = await actor.createEmbeddedDocuments('Item', [copy], { render: false });
          idMap.set(oldId, createdBag.id);
          created.add(oldId);
          receivedItems.push({ item: createdBag, quantity: Number(bag.system?.quantity?.value) || 0 });
          remaining.splice(remaining.indexOf(bag), 1);
        }
      }

      const children = addItems.filter((item) => childOfBag.has(item._id) && !bagIds.has(item._id));
      if (children.length > 0) {
        const copies = children.map((item) => {
          const copy = foundry.utils.duplicate(item);
          const newParentId = idMap.get(copy.system.parent_id);
          if (newParentId) copy.system.parent_id = newParentId;
          if (copy.system.worn?.value) copy.system.worn.value = false;
          delete copy._id;
          return copy;
        });
        const createdChildren = await actor.createEmbeddedDocuments('Item', copies, { render: false });
        for (let idx = 0; idx < children.length; idx++) {
          idMap.set(children[idx]._id, createdChildren[idx].id);
          receivedItems.push({ item: createdChildren[idx], quantity: Number(children[idx].system?.quantity?.value) || 0 });
        }
      }
    }

    for (const item of addItems) {
      if (bagIds.has(item._id) || childOfBag.has(item._id)) continue;

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

    if (DSA5_Utility.isActiveGM() && !data.payload.updated) {
      const transferSummary = await Trade.updateData(data.payload.tradeData);
      await TransactionSummaryService.finalizeTradeSummary(data.payload.tradeData, 'completed', transferSummary);
    }

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
      case 'selfTradeFinish':
        if (DSA5_Utility.isActiveGM()) {
          this.updateData(data.payload.tradeData);
        }
        return true;
    }
  }
}
