import ItemSheetdsa5 from "../item-sheet.js";

export default class SpellExtensionSheetDSA5 extends ItemSheetdsa5 {
    async getData() {
        const data = await super.getData();
        data['categories'] = ["spell", "liturgy", "ritual", "ceremony"]
        return data
    }
}