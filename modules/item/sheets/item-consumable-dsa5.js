import ItemSheetdsa5 from "../item-sheet.js";
import DSA5 from "../../system/config-dsa5.js"

export default class ConsumableSheetDSA extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 480
        super(item, options);
        this.mce = null;
    }
    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (this.item.isOwned) {
            buttons.unshift({
                class: "consumeItem",
                icon: `fas fa-dice-d20`,
                onclick: async ev => this.setupEffect(ev)
            })
        }
        return buttons
    }
    async getData() {
        const data = await super.getData()
        data["calculatedPrice"] = (data.data.price.value * data.data.QL) || 0
        data["availableSteps"] = data.data.QLList.split("\n").map((x, i) => i + 1)
        data['equipmentTypes'] = DSA5.equipmentTypes;
        return data
    }
    setupEffect(ev) {
        this.item.setupEffect()
    }
}