import { MerchantSheetMixin } from "./merchantmixin.js";
import ActorSheetdsa5Creature from "./creature-sheet.js";

export default class CreatureMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Creature) {
    static get merchantTemplate() {
        return "systems/dsa5/templates/actors/merchant/creature-merchant-sheet.html";
    }
}