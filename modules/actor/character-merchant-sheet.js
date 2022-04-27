import { MerchantSheetMixin } from "./merchantmixin.js";
import ActorSheetdsa5Character from "./character-sheet.js";

export default class CharacterMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Character) {
    static get merchantTemplate() {
        return "systems/dsa5/templates/actors/merchant/character-merchant-sheet.html";
    }
}