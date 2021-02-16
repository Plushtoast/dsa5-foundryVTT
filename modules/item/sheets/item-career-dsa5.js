import ItemSheetdsa5 from "../item-sheet.js"
import DSA5 from "../../system/config-dsa5.js"

export default class ItemCareerdsa5 extends ItemSheetdsa5 {
    constructor(item, options) {
        options.width = 700
        options.height = 700
        super(item, options);
        this.mce = null;
    }

    async getData() {
        const data = await super.getData();
        let chars = duplicate(DSA5.characteristics)
        chars["-"] = "-"
        data["mageLevels"] = DSA5.mageLevels
        data['guidevalues'] = chars;
        return data
    }
}