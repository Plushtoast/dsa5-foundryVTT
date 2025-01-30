import DescriptionTemplate from "./templates/description.js";
import { ItemDataModel } from "../baseitem.js";

const { StringField } = foundry.data.fields;

export default class ImprintData extends ItemDataModel.mixin(DescriptionTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            category: new StringField({ initial: '', label: 'Category' }),
            requirements: new StringField({ initial: '', label: 'requirements' }),
        });
    }
}