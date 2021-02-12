import DSA5_Utility from "../../system/utility-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";

export default class ConsumableItemDSA extends Itemdsa5 {
    static chatData(dat, name) {
        return [
            this._chatLineHelper("qualityStep", data.QL),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.QLList.split("\n")[data.QL - 1])),
            this._chatLineHelper("charges", data.charges)
        ]
    }

    static checkEquality(item, item2) {
        return item2.type == item.type && item.name == item2.name && item.data.description.value == item2.data.description.value && item.data.QL == item2.data.QL
    }

    static setupDialog(ev, options, item, actor) {
        let title = game.i18n.format("CHATNOTIFICATION.usesItem", { actor: item.options.actor.name, item: item.name })

        if (!item.isOwned)
            return

        let charges = (item.data.data.quantity.value - 1) * item.data.data.maxCharges + item.data.data.charges
        if (charges <= 0) {
            ui.notifications.error(game.i18n.localize("DSAError.NotEnoughCharges"))
            return
        }

        let newCharges = item.data.data.charges <= 1 ? item.data.data.maxCharges : item.data.data.charges - 1
        let newQuantity = item.data.data.charges <= 1 ? item.data.data.quantity.value - 1 : item.data.data.quantity.value

        let effect = DSA5_Utility.replaceDies(item.data.data.QLList.split("\n")[item.data.data.QL - 1], true)
        let msg = `<div><b>${title}</b></div><div>${item.data.data.description.value}</div><div><b>${game.i18n.localize('effect')}</b>: ${effect}</div>`
        if (newQuantity == 0) {
            item.options.actor.deleteEmbeddedEntity("OwnedItem", item.data._id)
        } else {
            item.update({
                'data.quantity.value': newQuantity,
                'data.charges': newCharges
            })
        }
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg))
    }

    static async combineItem(item1, item2, actor) {
        item1 = duplicate(item1)
        let charges = (item1.data.quantity.value - 1) * item1.data.maxCharges + item1.data.charges
        let item2charges = (item2.data.quantity.value - 1) * item2.data.maxCharges + item2.data.charges
        let newQuantity = Math.floor((charges + item2charges) / item1.data.maxCharges) + 1
        let newCharges = (charges + item2charges) % item1.data.maxCharges
        if (newCharges == 0) {
            newQuantity -= 1
            newCharges = item1.data.maxCharges
        }
        item1.data.quantity.value = newQuantity
        item1.data.charges = newCharges
        await actor.updateEmbeddedEntity("OwnedItem", item1)
    }

}