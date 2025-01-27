import APValueTemplate from "./templates/apvalue.js";
import DescriptionTemplate from "./templates/description.js";
import { DSADataModel } from "../abstract.js";

const { NumberField, StringField } = foundry.data.fields;

export default class EssenceData extends DSADataModel.mixin(DescriptionTemplate, APValueTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            level: new NumberField({ initial: 1, label: 'level' }),
            requirements: new StringField({ initial: '', label: 'combinationWith' }),
        });
    }
}