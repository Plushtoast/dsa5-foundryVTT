import DescriptionTemplate from "./templates/description.js";
import { DSADataModel } from "../abstract.js";

export default class EffectwrapperData extends DSADataModel.mixin(DescriptionTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), { });
    }
}