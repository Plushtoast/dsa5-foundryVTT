import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import DSA5_Utility from "../system/utility-dsa5.js";

export class Trade extends Application {
    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = "systems/dsa5/templates/actors/merchant/merchant-trade.html";
        options.width = 900;
        options.resizable = true;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "main" }]
        options.title = game.i18n.localize("MERCHANT.exchange");
        return options;
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
            offeredAccepted: false
        }
    }

    async startTrade() {
        game.socket.emit("system.dsa5", {
            type: "startTrade",
            payload: {
                sourceId: this.tradeData.sourceId,
                targetId: this.tradeData.targetId,
                id: this.tradeData.id
            }
        })
        this.render(true)
    }

    _filterGear(tar) {
        if (tar.val() != undefined) {
            let val = tar.val().toLowerCase().trim()
            let gear = $(this.element).find('.inventory .item')
            gear.removeClass('filterHide')
            gear.filter(function() {
                return $(this).find('a.item-edit').text().toLowerCase().trim().indexOf(val) == -1
            }).addClass('filterHide')
        }
    }

    async getData() {
        const data = await super.getData();
        const tradeFriend = game.actors.get(this.tradeData.sourceId)
        let inventory = tradeFriend.prepareItems({ details: [] })

        inventory.inventory["money"] = {
            items: inventory.money.coins.map(x => {
                x.name = game.i18n.localize(x.name)
                return x
            }),
            show: true,
            dataType: "money"
        }

        for(let section of Object.values(inventory.inventory)) {
            for(let item of section.items) {
                if(this.tradeData.offer[item._id]) {
                    item.system.quantity.value -= this.tradeData.offer[item._id].system.quantity.value
                }
            }
        }

        mergeObject(data,
            {
               tradeData: this.tradeData,
               actor: game.actors.get(this.tradeData.targetId),
               tradeFriend,
               inventory
            }
        )        
        return data
    }

    static findTradeApp(id) {
        for (const app of Object.values(ui.windows)) {
            if (app instanceof this && app?.tradeData?.id === id) {
                return app;
            }
        }
        return false;
    }

    async close(options={}) {
        if(!options.skipSocket) {
            game.socket.emit("system.dsa5", {
                type: "tradeCanceled",
                payload: {
                    id: this.tradeData.id
                }
            })
        }
        return super.close(options);
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.trade').click(ev => this._offerItem(ev))
        const filterGear = ev => this._filterGear($(ev.currentTarget))
        html.find('.item-edit').click(ev => this._editItem(ev, this.tradeData.sourceId))
        html.find('.item-external-edit').click(ev => this._editItem(ev, this.tradeData.targetId))
        html.find('.acceptTrade').click(ev => this.acceptTrade(ev))
        let gearSearch = html.find('.gearSearch')
        gearSearch.keyup(event => filterGear(event))
        gearSearch[0] && gearSearch[0].addEventListener("search", filterGear, false);
    }

    _editItem(ev, id) {
        const actor = game.actors.get(id)
        const item = actor.items.get(ev.currentTarget.dataset.itemId)
        item.sheet.render(true)
    }

    _offerItem(ev) {
        if(this.tradeData.offerAccepted) return

        const id = ev.currentTarget.dataset.itemId
        const actor = game.actors.get(this.tradeData.sourceId)
        const item =  actor.items.get(id)

        let amount = ev.ctrlKey ? 10 : 1
        let isStopTrade = ev.currentTarget.dataset.stopTrade
        let availableCount = isStopTrade ? this.tradeData.offer[id].system.quantity.value : item.system.quantity.value
        if(item){
            if(isStopTrade) {
                this.tradeData.offer[id].system.quantity.value -= Math.min(amount, availableCount)
                if(this.tradeData.offer[id].system.quantity.value <= 0) {
                    delete this.tradeData.offer[id]
                }
                this.offerChanged()
                this.render()
            } else {
                if(this.tradeData.offer[id]) {
                    availableCount -= this.tradeData.offer[id].system.quantity.value
                } else {
                    this.tradeData.offer[id] = item.toObject()
                    this.tradeData.offer[id].system.quantity.value = 0
                }

                if(availableCount > 0) {
                    this.tradeData.offer[id].system.quantity.value += Math.min(amount, availableCount)
                    this.offerChanged()
                    this.render()
                }
            }

            DSA5SoundEffect.playMoneySound()
        }
    }

    async offerChanged() {
        game.socket.emit("system.dsa5", {
            type: "receiveOfferedItems",
            payload: {
                id: this.tradeData.id,
                trader: this.tradeData.sourceId,
                offered: this.tradeData.offer
            }
        })
    }

    static receiveOfferedItems(data) {
        const app = this.findTradeApp(data.payload.id)
        if(app) {
            if(data.payload.trader == app.tradeData.sourceId) {
                app.tradeData.offer = data.payload.offered
                app.tradeData.offerAccepted = false
            } else {
                app.tradeData.offered = data.payload.offered
                app.tradeData.offeredAccepted = false
            }
            app.render()
        }
    }

    static isGMTrade(actor) {
        return game.user.isGM && !actor.hasPlayerOwner
    }

    static isPlayerTrade(actor) {
        return !game.user.isGM && actor.isOwner
    }

    static socketStartTrade(data) {
        const target = game.actors.get(data.payload.targetId)
        if(this.isGMTrade(target) || this.isPlayerTrade(target)) {
            const app = new Trade(data.payload.targetId, data.payload.sourceId, {id: data.payload.id})
            app.render(true)
        }
    }

    acceptTrade() {
        this.tradeData.offerAccepted = !this.tradeData.offerAccepted
        this.render(true)
        game.socket.emit("system.dsa5", {
            type: "acceptTrade",
            payload: {
                id: this.tradeData.id,
                accepted: this.tradeData.offerAccepted
            }
        })
    }

    static tradeWasAccepted(data) {
        const app = this.findTradeApp(data.payload.id)
        
        if(app) {
            app.tradeData.offeredAccepted = data.payload.accepted
            if(app.tradeData.offerAccepted && app.tradeData.offeredAccepted) {
                app.finishTrade()
                DSA5SoundEffect.playMoneySound()
            } else {
                app.render()
            }
            
        }
    }

    async finishTrade() {
        if(DSA5_Utility.isActiveGM()) {
            await Trade.updateData(this.tradeData)
        }

        game.socket.emit("system.dsa5", {
            type: "tradeFinished",
            payload: {
                id: this.tradeData.id,
                tradeData: this.tradeData
            }
        })

        this.close({skipSocket: true})
        DSA5SoundEffect.playMoneySound()
    }

    static async updateData(tradeData) {
        const source = game.actors.get(tradeData.sourceId)
        const target = game.actors.get(tradeData.targetId)

        await this.modifyActor(source, tradeData.offer, tradeData.offered)
        await this.modifyActor(target, tradeData.offered, tradeData.offer)
    }

    static async modifyActor(actor, toRemove, toAdd) {
        const removeIds = []
        const updateItems = []
        for(let id of Object.keys(toRemove)) {
            const item = actor.items.get(id)
            if(item) {
                if((item.system.quantity.value <= toRemove[id].system.quantity.value) && item.type != "money") {
                    removeIds.push(id)
                } else {
                    updateItems.push({_id: id, "system.quantity.value": item.system.quantity.value - toRemove[id].system.quantity.value})
                }
            }
        }

        await actor.deleteEmbeddedDocuments("Item", removeIds, { render: false })
        await actor.updateEmbeddedDocuments("Item", updateItems, { render: false })

        for(let item of Object.values(toAdd)) {
            await actor.sheet._manageDragItems(item, item.type)
        }
    }

    static tradeWasFinished(data) {
        const app = this.findTradeApp(data.payload.id)
        if(DSA5_Utility.isActiveGM()) {
            Trade.updateData(data.payload.tradeData)
        }
        if(app) {
            app.close({skipSocket: true})
        }
    }

    static tradeWasCanceled(data) {
        const app = this.findTradeApp(data.payload.id)
        if(app) {
            app.close({skipSocket: true})
        }
    }

    static socketListeners(data){
        switch (data.type) {

            case "receiveOfferedItems": 
                this.receiveOfferedItems(data)
                return true
            case "startTrade":
                this.socketStartTrade(data)
                return true
            case "acceptTrade":
                this.tradeWasAccepted(data)
                return true
            case "tradeCanceled":
                this.tradeWasCanceled(data)
                return true
            case "tradeFinished":
                this.tradeWasFinished(data)
                return true
        }
    }
}

export class TradeOptions extends Application {
    constructor(id, options) {
        super(options);
        this.actorId = id
    }

    async getData(options) {
        const data = await super.getData(options);
        data.actors = game.actors.filter(x => x.hasPlayerOwner && x.id != this.actorId)
        return data
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.template = "systems/dsa5/templates/actors/merchant/merchant-tradeoptions.html";
        options.resizable = true;
        options.title = game.i18n.localize("MERCHANT.exchange");
        return options;
    }

    _startTrade(ev) {
        const targetId = ev.currentTarget.dataset.id
        const app = new Trade(this.actorId, targetId)
        app.startTrade()
        this.close()    
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.startTrade').on('dblclick', ev => this._startTrade(ev))
    }
}