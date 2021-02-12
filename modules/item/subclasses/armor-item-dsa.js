import Itemdsa5 from "../item-dsa5.js"

export default class ArmorItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let properties = [
            this._chatLineHelper("protection", data.protection.value),
            this._chatLineHelper("encumbrance", data.encumbrance.value)
        ]
        if (data.effect.value != "")
            properties.push(this._chatLineHelper("effect", data.effect.value))

        return properties
    }
}