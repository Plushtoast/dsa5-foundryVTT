import Itemdsa5 from "../item-dsa5.js";

export default class EquipmentItemDSA5 extends Itemdsa5 {
    static chatData(data) {
        return [
            this._chatLineHelper("equipmentType", game.i18n.localize(data.equipmentType.value))
        ]
    }
}