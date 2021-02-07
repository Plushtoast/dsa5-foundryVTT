import ItemSheetdsa5 from "../item-sheet.js";
import DSA5 from "../../system/config-dsa5.js"

export default class PoisonSheetDSA5 extends ItemSheetdsa5 {
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        buttons.unshift({
            class: "rolleffect",
            icon: `fas fa-dice-d20`,
            onclick: async ev => this.setupEffect(ev)
        })
        return buttons
    }
    async getData() {
        const data = await super.getData()
        data["resistances"] = DSA5.magicResistanceModifiers
        return data
    }
}