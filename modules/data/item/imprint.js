import DescriptionTemplate from "./templates/description.js";
import { DSADataModel } from "../abstract.js";

const { StringField } = foundry.data.fields;

export default class ImprintData extends DSADataModel.mixin(DescriptionTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            category: new StringField({ initial: '', label: 'Category' }),
            requirements: new StringField({ initial: '', label: 'requirements' }),
        });
    }
}