import Itemdsa5 from "../item-dsa5.js";

export default class SpellextensionItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("target", data.source),
            this._chatLineHelper("category", data.category),
        ]
    }
}