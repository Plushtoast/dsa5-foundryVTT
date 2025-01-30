import APValueTemplate from "./templates/apvalue.js";
import DescriptionTemplate from "./templates/description.js";
import { ItemDataModel } from "../baseitem.js";

const { NumberField, StringField } = foundry.data.fields;

export default class EssenceData extends ItemDataModel.mixin(DescriptionTemplate, APValueTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            level: new NumberField({ initial: 1, label: 'level', min: 1, max: 3 }),
            requirements: new StringField({ initial: '', label: 'combinationWith' }),
        });
    }
}