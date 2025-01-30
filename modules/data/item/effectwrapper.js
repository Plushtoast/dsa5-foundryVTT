import DescriptionTemplate from "./templates/description.js";
import { ItemDataModel } from "../baseitem.js";

export default class EffectwrapperData extends ItemDataModel.mixin(DescriptionTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), { });
    }
}