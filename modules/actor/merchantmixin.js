import Itemdsa5 from "../item/item-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import DSA5Payment from "../system/payment.js";
import RuleChaos from "../system/rule_chaos.js";
import DSA5_Utility from "../system/utility-dsa5.js";

//todo add on use button to merchant sheet

export const MerchantSheetMixin = (superclass) => class extends superclass {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, { classes: options.classes.concat(["merchant-sheet"]) });
        return options;
    }

    static get merchantTemplate() {
        return "systems/dsa5/templates/actors/merchant/merchant-sheet.html";
    }

    get template() {
        if (this.merchantSheetActivated()) {
            switch (getProperty(this.actor.system, "merchant.merchantType")) {
                case "merchant":
                    return "systems/dsa5/templates/actors/merchant/merchant-limited.html";
                case "loot":
                    return "systems/dsa5/templates/actors/merchant/merchant-limited-loot.html";
                case "epic":
                    return "systems/dsa5/templates/actors/merchant/merchant-epic.html";
                default:
                    return super.template
            }
        }

        return this.constructor.merchantTemplate
    }

    merchantSheetActivated() {
        return this.showLimited() || (this.playerViewEnabled() && ["merchant", "loot", "epic"].includes(getProperty(this.actor.system, "merchant.merchantType")))
    }

    async allowMerchant(ids, allow) {
        let curPermissions = duplicate(this.actor.ownership)
        const newPerm = allow ? 1 : 0
        for (const id of ids) {
            curPermissions[id] = newPerm
        }
        await this.actor.update({ ownership: curPermissions }, { diff: false, recursive: false, noHook: true })
    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.allowMerchant').click(async(ev) => {
            const id = $(ev.currentTarget).attr("data-user-id")
            const i = $(ev.currentTarget).find('i')
            await this.allowMerchant([id], !(i.hasClass("fa-check-circle")))
            i.toggleClass("fa-circle fa-check-circle")
        })
        html.find('.toggleAllAllowMerchant').click(async(ev) => {
            const ids = game.users.filter(x => !x.isGM).map(x => x.id)
            const allow = ev.currentTarget.dataset.lock == "true"
            await this.allowMerchant(ids, allow)
            this.render()
        })
        html.find('.lockTradeSection').click(ev => this.lockTradeSection(ev))
        html.find('.item-tradeLock').click(ev => this.toggleTradeLock(ev))
        html.find('.randomGoods').click(ev => this.randomGoods(ev))
        html.find(".clearInventory").click(ev => this.clearInventory(ev))
        html.find('.removeOtherTradeFriend').click(() => this.removeOtherTradeFriend())
        html.find('.choseTradefriend').click(() => this.choseTradefriend())
        html.find('.setCustomPrice').click(ev => $(ev.currentTarget).addClass("edit"))
        html.find('.customPriceTag').change(async ev => this.setCustomPrice(ev))
            .blur(ev => $(ev.currentTarget).closest('.setCustomPrice').removeClass("edit"))

        html.find('.buy-item').click(ev => {
            this.advanceWrapper(ev, "buyItem", ev)
            DSA5SoundEffect.playMoneySound()
        })
        html.find('.sell-item').click(ev => {
            this.advanceWrapper(ev, "sellItem", ev)
            DSA5SoundEffect.playMoneySound()
        })
        html.find('.item-external-edit').click(ev => {
            ev.preventDefault()
            let itemId = this._getItemId(ev);
            const item = this.getTradeFriend().items.get(itemId)
            item.sheet.render(true);
        });
        html.find('.changeAmountAllItems').mousedown(ev => this.changeAmountAllItems(ev))

        html.find('.gearSearch').prop("disabled", false)
    }

    _canDragStart(selector) {
        return !this.merchantSheetActivated() && this.isEditable;
    }

    async toggleTradeLock(ev) {
        const itemId = this._getItemId(ev);
        let item = this.actor.items.get(itemId)
        this.actor.updateEmbeddedDocuments("Item", [{ _id: item.id, "system.tradeLocked": !item.system.tradeLocked }]);
    }

    async setCustomPrice(ev) {
        ev.stopPropagation()
        ev.preventDefault()
        const itemId = this._getItemId(ev);

        await this.actor.updateEmbeddedDocuments("Item", [{ _id: itemId, "flags.dsa5.customPriceTag": Number(ev.target.value) }])
    }

    removeOtherTradeFriend() {
        this.otherTradeFriend = undefined
        this.render(true)
    }

    async choseTradefriend(){
        (await SelectTradefriendDialog.getDialog(this)).render(true)
    }

    async lockTradeSection(ev) {
        const updates = []
        const rule = this.filterRule(ev)
        let newValue
        for (let item of this.actor.items) {
            if (rule(item)) {
                let upd = item.toObject()
                if (newValue === undefined) newValue = !upd.system.tradeLocked

                upd.system.tradeLocked = newValue
                updates.push(upd)
            }
        }
        this.actor.updateEmbeddedDocuments("Item", updates);
    }

    filterRule(ev) {
        const filter = ev.currentTarget.dataset.type
        if (DSA5.equipmentTypes[filter]) {
            return (item) => { return item.type == "equipment" && item.system.equipmentType.value == filter }
        } else {
            return (item) => { return item.type == filter && DSA5.equipmentCategories.includes(item.type) }
        }
    }

    async changeAmountAllItems(ev) {
        const updates = []
        const rule = this.filterRule(ev)
        for (let item of this.actor.items) {
            if (rule(item)) {
                let upd = item.toObject()
                RuleChaos.increment(ev, upd, "system.quantity.value", 0)
                updates.push(upd)
            }
        }
        this.actor.updateEmbeddedDocuments("Item", updates);
    }

    playerViewEnabled() {
        return getProperty(this.actor.system, "merchant.playerView")
    }

    async buyItem(ev) {
        await this.transferItem(this.actor, this.getTradeFriend(), ev, true)
    }
    async sellItem(ev) {
        await this.transferItem(this.getTradeFriend(), this.actor, ev, false)
    }

    async transferItem(source, target, ev, buy = true) {
        let itemId = this._getItemId(ev);
        let price = $(ev.currentTarget).attr("data-price")
        let amount = ev.ctrlKey ? 10 : 1

        if (game.user.isGM) {
            await this.constructor.finishTransaction(source, target, price, itemId, buy, amount)
        } else if (this.constructor.noNeedToPay(target, source, price) || DSA5Payment.canPay(target, price, true)) {
            game.socket.emit("system.dsa5", {
                type: "trade",
                payload: {
                    target: this.constructor.transferTokenData(target),
                    source: this.constructor.transferTokenData(source),
                    price,
                    itemId,
                    buy,
                    amount
                }
            })
        }
    }

    static transferTokenData(tokenData) {
        let id = { actor: tokenData.id }
        if (tokenData.token)
            id["token"] = tokenData.token.id

        return id
    }

    static async finishTransaction(source, target, price, itemId, buy, amount) {
        let item = source.items.get(itemId).toObject()
        amount = Math.min(Number(item.system.quantity.value), amount)
        if (Number(item.system.quantity.value) > 0) {
            const noNeedToPay = this.noNeedToPay(target, source, price)
            const hasPaid = noNeedToPay || DSA5Payment.payMoney(target, price, true)
            if (hasPaid) {
                if (getProperty(item, "system.worn.value")) item.system.worn.value = false

                if (buy) {
                    await this.updateTargetTransaction(target, item, amount, source, price)
                    await this.updateSourceTransaction(source, target, item, price, itemId, amount)
                    await this.transferNotification(item, target, source, buy, price, amount, noNeedToPay)
                    await this.selfDestruction(source)
                } else {
                    await this.updateSourceTransaction(source, target, item, price, itemId, amount)
                    await this.updateTargetTransaction(target, item, amount, source, price)
                    await this.transferNotification(item, source, target, buy, price, amount, noNeedToPay)
                }
            }
        }
    }

    static isTemporaryToken(target) {
        return getProperty(target.system, "merchant.merchantType") == "loot" && getProperty(target.system, "merchant.temporary")
    }

    static async selfDestruction(target) {
        if (this.isTemporaryToken(target)) {
            const hasItemsLeft = target.items.some(x => DSA5.equipmentCategories.includes(x.type) || (x.type == "money" && x.system.quantity.value > 0))
            if (!hasItemsLeft) {
                game.socket.emit("system.dsa5", {
                    type: "hideDeletedSheet",
                    payload: {
                        target: this.transferTokenData(target)
                    }
                })
                const tokens = target.getActiveTokens().map(x => x.id)
                await canvas.scene.deleteEmbeddedDocuments("Token", tokens)
                await game.actors.get(target.id).delete()
                this.hideDeletedSheet(target)
            }
        }
    }

    static async hideDeletedSheet(target) {
        target.sheet.close(true)
    }

    static async transferNotification(item, source, target, buy, price, amount, noNeedToPay) {
        const notify = game.settings.get("dsa5", "merchantNotification")
        if (notify == 0 || getProperty(item, "system.equipmentType.value") == "service") return

        const notif = "MERCHANT." + (buy ? "buy" : "sell") + (noNeedToPay ? "Loot" : "") + "Notification"
        const template = game.i18n.format(notif, { item: item.name, source: source.name, target: target.name, amount, price, buy })
        const chatData = DSA5_Utility.chatDataSetup(template)
        if (notify == 2) chatData["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id)
        await ChatMessage.create(chatData)
    }

    static noNeedToPay(target, source, price) {
        return price == 0 || getProperty(target.system, "merchant.merchantType") == "loot" || getProperty(source.system, "merchant.merchantType") == "loot"
    }

    static async updateSourceTransaction(source, target, sourceItem, price, itemId, amount) {
        let item = duplicate(sourceItem)
        if (Number(item.system.quantity.value) > amount || item.type == "money") {
            item.system.quantity.value = Number(item.system.quantity.value) - amount
            await source.updateEmbeddedDocuments("Item", [item])
        } else {
            await source.deleteEmbeddedDocuments("Item", [itemId])
        }
        if (!this.noNeedToPay(source, target, price)) await DSA5Payment.getMoney(source, price, true)
    }

    static async updateTargetTransaction(target, sourceItem, amount, source, price) {
        let item = duplicate(sourceItem)
        const isService = getProperty(item, "system.equipmentType.value") == "service"
        if (isService) {
            const msg = game.i18n.format("MERCHANT.buyNotification", { item: item.name, amount, source: target.name, target: source.name, price })
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        } else {
            let res = target.items.find(i => Itemdsa5.areEquals(item, i));
            item.system.quantity.value = amount
            if (!res) {
                await target.createEmbeddedDocuments("Item", [item]);
            } else {
                await Itemdsa5.stackItems(res, item, target)
            }
        }
    }

    getTradeFriend() {
        return this.otherTradeFriend || game.user.character
    }

    async _manageDragItems(item, typeClass) {
        switch (typeClass) {
            case "creature":
            case "npc":
            case "character":
                //TODO skip if not trading window enabled
                this.setTradeFriend(item)
                break;
            default:
                return super._manageDragItems(item, typeClass)
        }
    }

    setTradeFriend(otherTradeFriend) {
        const newTradeFriend = game.actors.get(otherTradeFriend._id)
        if (newTradeFriend.isOwner) {
            this.otherTradeFriend = newTradeFriend
            this.render(true)
        }
    }

    async _render(force = false, options = {}) {
        if (!game.user.isGM && getProperty(this.actor.system, "merchant.merchantType") == "loot" && getProperty(this.actor.system, "merchant.locked")) {
            AudioHelper.play({ src: "sounds/lock.wav", loop: false }, false);
            return
        }
        await super._render(force, options);
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.actor.isOwner) {
            buttons.unshift({
                class: "playerview",
                icon: `fas fa-toggle-on`,
                onclick: async ev => this._togglePlayerview(ev)
            })
        }
        return buttons
    }

    _togglePlayerview(ev) {
        this.actor.update({ "system.merchant.playerView": !getProperty(this.actor.system, "merchant.playerView") })
    }

    async randomGoods(ev) {
        const html = await renderTemplate('systems/dsa5/templates/dialog/randomGoods-dialog.html', { categories: DSA5.equipmentCategories })
        new Dialog({
            title: game.i18n.localize("MERCHANT.randomGoods"),
            content: html,
            default: 'yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: dlg => this.addRandomGoods(this.actor, dlg, ev)
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    async clearInventory(ev) {
        new Dialog({
            title: game.i18n.localize("MERCHANT.clearInventory"),
            content: game.i18n.localize("MERCHANT.deleteAllGoods"),
            default: 'yes',
            buttons: {
                Yes: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("yes"),
                    callback: () => {
                        this.removeAllGoods(this.actor, ev)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel")
                }
            }
        }).render(true)
    }

    async addRandomGoods(actor, dlg, ev) {
        let text = $(ev.currentTarget).text()
        $(ev.currentTarget).html(' <i class="fa fa-spin fa-spinner"></i>')

        let categories = []
        dlg.find('input[type="checkbox"]:checked').each(function() {
            const name = $(this).val()
            categories.push({
                name,
                count: Number(dlg.find(`input[name="each_${name}"]`).val()),
                number: Number(dlg.find(`input[name="number_${name}"]`).val())
            })
        })

        const itemLibrary = game.dsa5.itemLibrary
        if (!itemLibrary.equipmentBuild) {
            await itemLibrary.buildEquipmentIndex()
        }

        let items = []
        for (let cat of categories) {
            const randomItems = (await itemLibrary.getRandomItems(cat.name, cat.number)).map(x => {
                const elem = x.toObject()
                elem.system.quantity.value = cat.count
                return elem
            })

            items.push(...randomItems)
        }

        let seen = {}
        items = items.filter(function(x) {
            let domain = getProperty(x, "system.effect")
            domain = typeof domain === 'object' && domain !== null ? getProperty(domain, "attributes") || "" : ""
            const price = Number(getProperty(x, "system.price.value")) || 0
            if (domain != "" || price > 10000) return false

            let seeName = `${x.type}_${x.name}`
            return (seen.hasOwnProperty(seeName) ? false : (seen[seeName] = true)) && actor.items.filter(function(y) {
                return y.type == x.type && y.name == x.name
            }).length == 0
        })
        await actor.createEmbeddedDocuments("Item", items)
        $(ev.currentTarget).text(text)
    }

    async removeAllGoods(actor, ev) {
        let text = $(ev.currentTarget).text()
        $(ev.currentTarget).html(' <i class="fa fa-spin fa-spinner"></i>')
        let ids = actor.items.filter(x => DSA5.equipmentCategories.includes(x.type) && !getProperty(x, "worn.value")).map(x => x.id)
        await actor.deleteEmbeddedDocuments("Item", ids);
        $(ev.currentTarget).text(text)
    }

    async getData(options) {
        const data = await super.getData(options);
        data["merchantType"] = getProperty(this.actor.system, "merchant.merchantType") || "none"
        data["merchantTypes"] = {
            none: game.i18n.localize("MERCHANT.typeNone"),
            merchant: game.i18n.localize("MERCHANT.typeMerchant"),
            loot: game.i18n.localize("MERCHANT.typeLoot"),
            epic: game.i18n.localize("MERCHANT.typeEpic")
        }
        data["invName"] = data["merchantTypes"][data["merchantType"]]
        data["players"] = game.users.filter(x => !x.isGM).map(x => {
            x.allowedMerchant = this.actor.testUserPermission(x, "LIMITED", false)
            x.buyingFactor = getProperty(this.actor.system, `merchant.factors.buyingFactor.${x.id}`)
            x.sellingFactor = getProperty(this.actor.system, `merchant.factors.sellingFactor.${x.id}`)
            return x
        })

        if (data.merchantType != "epic") {
            this.prepareStorage(data)
            if (this.merchantSheetActivated()) {
                this.filterWornEquipment(data)
                this.prepareTradeFriend(data)
                if (data.actor.inventory["misc"].items.length == 0) data.actor.inventory["misc"].show = false
            }
        } else {
            this.prepareStorage(data)
            data.garadanOptions = {
                1: game.i18n.localize('GARADAN.1'),
                2: game.i18n.localize('GARADAN.2'),
                3: game.i18n.localize('GARADAN.3'),
                4: game.i18n.localize('GARADAN.4'),
                6: game.i18n.localize('GARADAN.6')
            }
        }
        data.hasOtherTradeFriend = !!this.otherTradeFriend

        return data;
    }

    filterWornEquipment(data) {
        for (const [key, value] of Object.entries(data.actor.inventory)) {
            value.items = value.items.filter(x => !getProperty(x, "system.worn.value"))
        }
    }

    prepareStorage(data) {
        if (data["merchantType"] == "merchant") {
            for (const [key, value] of Object.entries(data.actor.inventory)) {
                for (const item of value.items) {
                    item.defaultPrice = this.getItemPrice(item)
                    item.calculatedPrice = Number(parseFloat(`${item.defaultPrice * (getProperty(this.actor.system, "merchant.sellingFactor") || 1)}`).toFixed(2)) * (getProperty(this.actor.system, `merchant.factors.sellingFactor.${game.user.id}`) || 1)
                    item.priceTag = ` / ${item.calculatedPrice}`
                }
            }
        } else if (data["merchantType"] == "loot") {
            for (const [key, value] of Object.entries(data.actor.inventory)) {
                for (const item of value.items) {
                    item.calculatedPrice = this.getItemPrice(item)
                }
            }
            const money = {
                items: data.actor.money.coins.map(x => {
                    x.name = game.i18n.localize(x.name)
                    return x
                }),
                show: true,
                dataType: "money"
            }
            if (money.items.length) data.actor.inventory["money"] = money
        }
    }

    getItemPrice(item) {
        return Number(getProperty(item, "flags.dsa5.customPriceTag")) || (Number(item.system.price.value) * (item.type == "consumable" ? (Number(item.system.QL) || 0) : 1))
    }

    prepareTradeFriend(data) {
        let friend = this.getTradeFriend()
        if (friend) {
            let tradeData = friend.prepareItems({ details: [] })
            let factor = getProperty(this.actor.system, "merchant.merchantType") == "loot" ? 1 : (getProperty(this.actor.system, "merchant.buyingFactor") || 1) * (getProperty(this.actor.system, `merchant.factors.buyingFactor.${game.user.id}`) || 1)
            let inventory = this.prepareSellPrices(tradeData.inventory, factor)
            if (inventory["misc"].items.length == 0) inventory["misc"].show = false

            if (data["merchantType"] == "loot") {
                inventory["money"] = {
                    items: tradeData.money.coins.map(x => {
                        x.name = game.i18n.localize(x.name)
                        return x
                    }),
                    show: true,
                    dataType: "money"
                }
            }

            mergeObject(data, {
                tradeFriend: {
                    img: friend.img,
                    name: friend.name,
                    inventory,
                    money: tradeData.money
                }
            })
        } else {
            mergeObject(data, {
                tradeFriend: {
                    inventory: [],
                    money: { coins: [] }
                }
            })
        }
    }

    prepareSellPrices(inventory, factor) {
        for (const [key, value] of Object.entries(inventory)) {
            for (const item of value.items) {
                item.calculatedPrice = Number(parseFloat(`${this.getItemPrice(item) * factor}`).toFixed(2))
            }
        }
        return inventory
    }
}

class SelectTradefriendDialog extends Dialog{
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
        });
        return options;
    }

    static async getDialog(actor){
        const users = await game.dsa5.apps.gameMasterMenu.getTrackedHeros()
        const dialog = new SelectTradefriendDialog({
            title: game.i18n.localize("DIALOG.setTargetToUser"),
            content: await renderTemplate('systems/dsa5/templates/dialog/selectTradeFriend.html', { users }),
            default: "yes",
            buttons: {},
        })
        dialog.actor = actor
        return dialog
    }

    activateListeners(html){
        super.activateListeners(html)
        html.find('.combatant').click(ev => this.setTargetToUser(ev))
    }

    setTargetToUser(ev){
        this.actor.setTradeFriend({_id: ev.currentTarget.dataset.id})
        this.close()
    }
}