import Itemdsa5 from "../item/item-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import DSA5Payment from "../system/payment.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import ActorSheetdsa5NPC from "./npc-sheet.js";

export default class MerchantSheetDSA5 extends ActorSheetdsa5NPC {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, { classes: options.classes.concat(["dsa5", "actor", "npc-sheet", "merchant-sheet"]) });
        return options;
    }

    get template() {
        if (this.merchantSheetActivated()) {
            switch (getProperty(this.actor.data.data, "merchant.merchantType")) {
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

        return "systems/dsa5/templates/actors/merchant/merchant-sheet.html";
    }

    merchantSheetActivated() {
        return this.showLimited() || (this.playerViewEnabled() && ["merchant", "loot", "epic"].includes(getProperty(this.actor.data.data, "merchant.merchantType")))
    }

    async allowMerchant(ids, allow) {
        let curPermissions = duplicate(this.actor.data.permission)
        for (const id of ids) {
            curPermissions[id] = allow ? 1 : 0
        }
        await this.actor.update({ permission: curPermissions }, { diff: false, recursive: false, noHook: true })
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

        html.find('.randomGoods').click(ev => {
            this.randomGoods(ev)
        })
        html.find(".clearInventory").click(ev => {
            this.clearInventory(ev)
        })
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
            const item = this.getTradeFriend().items.find(i => i.data._id == itemId)
            item.sheet.render(true);
        });

        if (this.showLimited()) {
            let ims = html.find('.content .item')
            ims.each((i, li) => {
                li.setAttribute("draggable", false);
            });
            ims.on('dragstart', null)
        }

    }

    playerViewEnabled() {
        return getProperty(this.actor.data.data, "merchant.playerView")
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
            MerchantSheetDSA5.finishTransaction(source, target, price, itemId, buy, amount)
        } else if (MerchantSheetDSA5.noNeedToPay(target, source, price) || DSA5Payment.canPay(target, price, true)) {
            let targetId = { actor: target.data._id }
            if (target.token) {
                targetId["token"] = target.token.data._id
            }
            let sourceId = { actor: source.data._id }
            if (source.token) {
                sourceId["token"] = source.token.data._id
            }

            game.socket.emit("system.dsa5", {
                type: "trade",
                payload: {
                    target: targetId,
                    source: sourceId,
                    price: price,
                    itemId: itemId,
                    buy: buy,
                    amount: amount
                }
            })
        }
    }

    static async finishTransaction(source, target, price, itemId, buy, amount) {
        let item = duplicate(await source.getEmbeddedDocument("Item", itemId))
        amount = Math.min(Number(item.data.quantity.value), amount)
        if (Number(item.data.quantity.value) > 0) {
            const hasPaid = MerchantSheetDSA5.noNeedToPay(target, source, price) || DSA5Payment.payMoney(target, price, true)
            if (hasPaid) {
                if (buy) {
                    await this.updateTargetTransaction(target, item, amount, source)
                    await this.updateSourceTransaction(source, target, item, price, itemId, amount)
                } else {
                    await this.updateSourceTransaction(source, target, item, price, itemId, amount)
                    await this.updateTargetTransaction(target, item, amount, source)
                }
            }
        }
    }

    static noNeedToPay(target, source, price) {
        return price == 0 || getProperty(target.data.data, "merchant.merchantType") == "loot" || getProperty(source.data.data, "merchant.merchantType") == "loot"
    }

    static async updateSourceTransaction(source, target, sourceItem, price, itemId, amount) {
        let item = duplicate(sourceItem)
        if (Number(item.data.quantity.value) > amount || item.type == "money") {
            item.data.quantity.value = Number(item.data.quantity.value) - amount
            await source.updateEmbeddedDocuments("Item", [item])
        } else {
            await source.deleteEmbeddedDocuments("Item", [itemId])
        }
        if (!this.noNeedToPay(source, target, price)) await DSA5Payment.getMoney(source, price, true)
    }

    static async updateTargetTransaction(target, sourceItem, amount, source) {
        let item = duplicate(sourceItem)
        const isService = getProperty(item, "data.equipmentType.value") == "service"
        if (isService) {
            const msg = game.i18n.format("MERCHANT.service", { item: item.name, amount, buyer: target.name, merchant: source.name })
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        } else {
            let res = target.data.items.find(i => Itemdsa5.areEquals(item, i));
            item.data.quantity.value = amount
            if (!res) {
                await target.createEmbeddedDocuments("Item", [item]);
            } else {
                await Itemdsa5.stackItems(res, item, target)
            }
        }
    }

    getTradeFriend() {
        return game.user.character
    }

    async _render(force = false, options = {}) {
        if (!game.user.isGM && getProperty(this.actor.data.data, "merchant.merchantType") == "loot" && getProperty(this.actor.data.data, "merchant.locked")) {
            AudioHelper.play({ src: "sounds/lock.wav", loop: false }, false);
            return
        }
        await super._render(force, options);
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (game.user.isGM) {
            buttons.unshift({
                class: "playerview",
                icon: `fas fa-toggle-on`,
                onclick: async ev => this._togglePlayerview(ev)
            })
        }
        return buttons
    }

    _togglePlayerview(ev) {
        this.actor.update({ "data.merchant.playerView": !getProperty(this.actor.data.data, "merchant.playerView") })
    }

    async randomGoods(ev) {
        let dialogData = {
            categories: DSA5.equipmentCategories
        }
        renderTemplate('systems/dsa5/templates/dialog/randomGoods-dialog.html', { dialogData }).then(html => {
            new Dialog({
                title: game.i18n.localize("MERCHANT.randomGoods"),
                content: html,
                default: 'yes',
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("yes"),
                        callback: dlg => {
                            this.addRandomGoods(this.actor, dlg, ev)
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    }
                }
            }).render(true)
        })
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
            categories.push($(this).val())
        })
        let numbers = {}
        dlg.find('input[type="number"]').each(function() {
            numbers[$(this).attr("name").split("_")[1]] = Number($(this).val())
        })
        const itemLibrary = game.dsa5.itemLibrary
        if (!itemLibrary.equipmentBuild) {
            await itemLibrary.buildEquipmentIndex()
        }

        let items = []
        for (let cat of categories) {
            items.push(...await itemLibrary.getRandomItems(cat, numbers[cat]))
        }

        var seen = {}
        items = items.filter(function(x) {
            const domain = getProperty(x, "data.data.effect.attributes") || ""
            const price = Number(getProperty(x, "data.data.price.value")) || 0
            if (domain != "" || price > 10000) return false

            let seeName = `${x.type}_${x.name}`
            return (seen.hasOwnProperty(seeName) ? false : (seen[seeName] = true)) && actor.data.items.filter(function(y) {
                return y.type == x.type && y.name == x.name
            }).length == 0
        })
        await actor.createEmbeddedDocuments("Item", items.map(x => x.toObject()))
        $(ev.currentTarget).text(text)
    }

    async removeAllGoods(actor, ev) {
        let text = $(ev.currentTarget).text()
        $(ev.currentTarget).html(' <i class="fa fa-spin fa-spinner"></i>')
        let ids = actor.items.filter(x => ["poison", "consumable", "equipment", "plant", "ammunition"].includes(x.type)).map(x => x.id)
        ids.push(...actor.items.filter(x => ["armor", "meleeweapon", "rangeweapon"].includes(x.type) && !x.data.data.worn.value).map(x => x.id))
        await actor.deleteEmbeddedDocuments("Item", ids);
        $(ev.currentTarget).text(text)
    }

    async getData(options) {
        const data = await super.getData(options);
        data["merchantType"] = getProperty(this.actor.data.data, "merchant.merchantType") || "none"
        data["merchantTypes"] = {
            none: game.i18n.localize("MERCHANT.typeNone"),
            merchant: game.i18n.localize("MERCHANT.typeMerchant"),
            loot: game.i18n.localize("MERCHANT.typeLoot"),
            epic: game.i18n.localize("MERCHANT.typeEpic")
        }
        data["invName"] = data["merchantTypes"][data["merchantType"]]
        data["players"] = game.users.filter(x => !x.isGM).map(x => {
            x.allowedMerchant = this.actor.testUserPermission(x, "LIMITED", false)
            x.buyingFactor = getProperty(this.actor.data.data, `merchant.factors.buyingFactor.${x.id}`)
            x.sellingFactor = getProperty(this.actor.data.data, `merchant.factors.sellingFactor.${x.id}`)
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
        return data;
    }

    filterWornEquipment(data) {
        for (const [key, value] of Object.entries(data.actor.inventory)) {
            value.items = value.items.filter(x => !getProperty(x, "data.worn.value"))
        }
    }

    prepareStorage(data) {
        if (data["merchantType"] == "merchant") {
            for (const [key, value] of Object.entries(data.actor.inventory)) {
                for (const item of value.items) {
                    item.defaultPrice = this.getItemPrice(item)
                    item.calculatedPrice = Number(parseFloat(`${item.defaultPrice * (getProperty(this.actor.data.data, "merchant.sellingFactor") || 1)}`).toFixed(2)) * (getProperty(this.actor.data.data, `merchant.factors.sellingFactor.${game.user.id}`) || 1)
                    item.priceTag = ` / ${item.calculatedPrice}`
                }
            }
        } else if (data["merchantType"] == "loot") {
            for (const [key, value] of Object.entries(data.actor.inventory)) {
                for (const item of value.items) {
                    item.calculatedPrice = this.getItemPrice(item)
                }
            }
            data.actor.inventory["money"] = {
                items: data.actor.money.coins.map(x => {
                    x.name = game.i18n.localize(x.name)
                    return x
                }),
                show: true,
                dataType: "money"
            }
        }
    }

    getItemPrice(item) {
        return Number(item.data.price.value) * (item.type == "consumable" ? (Number(item.data.QL) || 0) : 1)
    }

    prepareTradeFriend(data) {
        let friend = this.getTradeFriend()
        if (friend) {
            let tradeData = friend.prepareItems({ details: [] })
            let factor = getProperty(this.actor.data.data, "merchant.merchantType") == "loot" ? 1 : (getProperty(this.actor.data.data, "merchant.buyingFactor") || 1) * (getProperty(this.actor.data.data, `merchant.factors.buyingFactor.${game.user.id}`) || 1)
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