import Itemdsa5 from "../item-dsa5.js";

export default class SpecialAbilityItemDSA5 extends Itemdsa5 {
    static chatData(data) {
        return [
            this._chatLineHelper("rule", data.rule.value),
        ]
    }
}