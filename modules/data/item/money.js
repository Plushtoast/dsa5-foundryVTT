import DescriptionTemplate from "./templates/description.js";
import { ItemDataModel } from "../baseitem.js";
import EquipmentTemplate from "./templates/equipment.js";
import DSANumberField from "../fields/dsa_number_field.js";
import DSA5 from "../../system/config-dsa5.js";

export default class MoneyData extends ItemDataModel.mixin(DescriptionTemplate, EquipmentTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            subcategory: new DSANumberField({ initial: 0, required: true, label: 'COMBATSKILLCATEGORY.subcategory', choices: DSA5.moneyTypes }),
        });
    }
}