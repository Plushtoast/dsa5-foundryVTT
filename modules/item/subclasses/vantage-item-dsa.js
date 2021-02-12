import Itemdsa5 from "../item-dsa5.js";

export default class VantageItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("effect", data.effect.value),
        ]
    }
}