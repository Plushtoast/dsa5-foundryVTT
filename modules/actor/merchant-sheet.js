import Itemdsa5 from "../item/item-dsa5.js";
import DSA5Payment from "../system/payment.js";
import ActorSheetdsa5NPC from "./npc-sheet.js";

export default class MerchantSheetDSA5 extends ActorSheetdsa5NPC {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "actor", "npc-sheet", "merchant-sheet"]),
            width: 770,
            height: 740,
        });
        return options;
    }

    get template() {
        if (this.showLimited() || (this.playerViewEnabled() && ["merchant", "loot"].includes(getProperty(this.actor.data.data, "merchant.merchantType")))) {
            switch (getProperty(this.actor.data.data, "merchant.merchantType")) {
                case "merchant":
                    return "systems/dsa5/templates/actors/merchant/merchant-limited.html";
                case "loot":
                    return "systems/dsa5/templates/actors/merchant/merchant-limited-loot.html";
                default:
                    return super.template
            }
        }
        return "systems/dsa5/templates/actors/merchant/merchant-sheet.html";
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.randomGoods').click(ev => {
            this.randomGoods(ev)
        })
        html.find(".clearInventory").click(ev => {
            this.clearInventory(ev)
        })
        html.find('.buy-item').click(ev => {
            this.advanceWrapper(ev, "buyItem", ev)
        })
        html.find('.sell-item').click(ev => {
            this.advanceWrapper(ev, "sellItem", ev)
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
        } else if (MerchantSheetDSA5.noNeedToPay(target, source) || DSA5Payment.canPay(target, price, true)) {
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
        let item = duplicate(await source.getEmbeddedEntity("OwnedItem", itemId))
        amount = Math.min(Number(item.data.quantity.value), amount)
        if (Number(item.data.quantity.value) > 0) {
            let hasPaid = MerchantSheetDSA5.noNeedToPay(target, source) || DSA5Payment.payMoney(target, price, true)
            if (hasPaid) {
                if (buy) {
                    await this.updateTargetTransaction(target, item, amount)
                    await this.updateSourceTransaction(source, target, item, price, itemId, amount)
                } else {
                    await this.updateSourceTransaction(source, target, item, price, itemId, amount)
                    await this.updateTargetTransaction(target, item, amount)
                }
            }
        }
    }

    static noNeedToPay(target, source) {
        return getProperty(target.data.data, "merchant.merchantType") == "loot" || getProperty(source.data.data, "merchant.merchantType") == "loot"
    }

    static async updateSourceTransaction(source, target, sourceItem, price, itemId, amount) {
        let item = duplicate(sourceItem)
        if (Number(item.data.quantity.value) > amount || item.type == "money") {
            item.data.quantity.value = Number(item.data.quantity.value) - amount
            await source.updateEmbeddedDocuments("Item", [item])
        } else {
            await source.deleteEmbeddedDocuments("Item", [itemId])
        }
        if (!this.noNeedToPay(source, target))
            await DSA5Payment.getMoney(source, price, true)
    }
    static async updateTargetTransaction(target, sourceItem, amount) {
        let item = duplicate(sourceItem)
        let res = target.data.items.find(i => Itemdsa5.areEquals(item, i));
        item.data.quantity.value = amount
        if (!res) {
            await target.createEmbeddedDocuments("Item", [item]);
        } else {
            await Itemdsa5.stackItems(res, item, target)
        }
    }

    getTradeFriend() {
        return game.user.character
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
            categories: ["meleeweapon", "armor", "equipment", "poison", "consumable", "rangeweapon"]
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
            for (let item of await itemLibrary.getRandomItems(cat, numbers[cat])) {
                items.push(item.document)
            }
        }
        var seen = {}
        items = items.filter(function(x) {
            let seeName = `${x.type}_${x.name}`
            return (seen.hasOwnProperty(seeName) ? false : (seen[seeName] = true)) && actor.data.items.filter(function(y) {
                return y.type == x.type && y.name == x.name
            }).length == 0
        })
        await actor.createEmbeddedDocuments("Item", items)
        $(ev.currentTarget).text(text)
    }

    async removeAllGoods(actor, ev) {
        let text = $(ev.currentTarget).text()
        $(ev.currentTarget).html(' <i class="fa fa-spin fa-spinner"></i>')
        let ids = actor.data.items.filter(x => ["equipment", "poison", "consumable"].includes(x.type)).map(x => x._id)
        ids.push(...actor.data.items.filter(x => ["armor", "meleeweapon", "rangeweapon", "equipment"].includes(x.type) && !x.data.worn.value).map(x => x._id))
        await actor.deleteEmbeddedDocuments("Item", ids);
        $(ev.currentTarget).text(text)
    }

    async getData(options) {
        const data = await super.getData(options);
        data["merchantType"] = getProperty(this.actor.data.data, "merchant.merchantType") || "none"
        data["invName"] = { none: game.i18n.localize("equipment"), merchant: game.i18n.localize("MERCHANT.typeMerchant"), loot: game.i18n.localize("MERCHANT.typeLoot") }[data["merchantType"]]
        data["merchantTypes"] = { none: game.i18n.localize("MERCHANT.typeNone"), merchant: game.i18n.localize("MERCHANT.typeMerchant"), loot: game.i18n.localize("MERCHANT.typeLoot") }
        this.prepareStorage(data)
        if (this.showLimited()) {
            this.prepareTradeFriend(data)
            if (data.actor.inventory["misc"].items.length == 0) data.actor.inventory["misc"].show = false
        }
        return data;
    }

    prepareStorage(data) {
        if (data["merchantType"] == "merchant") {
            for (const [key, value] of Object.entries(data.actor.inventory)) {
                for (const item of value.items) {
                    item.defaultPrice = this.getItemPrice(item)
                    item.calculatedPrice = Number(parseFloat(`${item.defaultPrice * (getProperty(this.actor.data.data, "merchant.sellingFactor") || 1)}`).toFixed(2))
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
            let tradeData = friend.prepareItems()
            let factor = getProperty(this.actor.data.data, "merchant.merchantType") == "loot" ? 1 : (getProperty(this.actor.data.data, "merchant.buyingFactor") || 1)
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