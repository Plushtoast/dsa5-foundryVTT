import ItemSheetdsa5 from "../item-sheet.js";
import DSA5 from "../../system/config-dsa5.js"

export default class SpellSheetDSA5 extends ItemSheetdsa5 {
    async getData() {
        const data = await super.getData();
        data['characteristics'] = DSA5.characteristics;
        data['StFs'] = DSA5.StFs;
        data['resistances'] = DSA5.magicResistanceModifiers
        return data
    }
}