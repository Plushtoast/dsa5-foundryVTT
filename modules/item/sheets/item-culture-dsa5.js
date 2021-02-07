import ItemSheetdsa5 from "../item-sheet.js"

export default class ItemCulturedsa5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 700
        options.height = 700
        super(item, options);
        this.mce = null;
    }

}