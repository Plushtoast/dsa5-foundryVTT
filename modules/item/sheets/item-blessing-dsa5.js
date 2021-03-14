import ItemSheetdsa5 from "../item-sheet.js";
import CantripItemDSA5 from "../subclasses/cantrip-item-dsa.js";
import DSA5_Utility from "../../system/utility-dsa5.js";

export default class BlessingSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "rolleffect",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }

    setupEffect(ev) {
        if (this.item.options.actor.data.data.status.karmaenergy.value < 1) {
            return ui.notifications.error(game.i18n.localize("DSAError.NotEnoughKaP"))
        }
        this.item.options.actor.update({ "data.status.karmaenergy.value": this.item.options.actor.data.data.status.karmaenergy.value -= 1 })
        let chatMessage = `<p><b>${this.item.name} - ${game.i18n.localize('blessing')} ${game.i18n.localize('probe')}</b></p><p>${this.item.data.data.description.value}</p><p>${CantripItemDSA5.chatData(this.item.data.data, "").join("</br>")}</p>`
        ChatMessage.create(DSA5_Utility.chatDataSetup(chatMessage));

    }
}