import ItemSheetdsa5 from "./item-sheet.js"

export default class ItemSpeciesdsa5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 530
        options.height = 570
        super(item, options);
        this.mce = null;
    }
}