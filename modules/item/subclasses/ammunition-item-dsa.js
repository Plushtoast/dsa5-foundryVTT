import Itemdsa5 from "../item-dsa5.js";

export default class AmmunitionItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("ammunitiongroup", game.i18n.localize(data.ammunitiongroup.value))
        ]
    }
}