import Itemdsa5 from "../item-dsa5.js";

export default class CantripItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("feature", data.feature.value),
        ]
    }
}