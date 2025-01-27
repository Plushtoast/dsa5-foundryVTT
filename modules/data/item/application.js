import DescriptionTemplate from "./templates/description.js";
import { DSADataModel } from "../abstract.js";

const { StringField } = foundry.data.fields;

export default class ApplicationData extends DSADataModel.mixin(DescriptionTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            skill: new StringField({ initial: '', label: 'TYPES.Item.skill' }),
        });
    }
}