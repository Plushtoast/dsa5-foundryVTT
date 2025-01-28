import DescriptionTemplate from "./templates/description.js";
import { DSADataModel } from "../abstract.js";
import EquipmentTemplate from "./templates/equipment.js";
import DSA5 from "../../system/config-dsa5.js";
import DSAStringField from "../fields/dsa_string_field.js";
import AoeTemplate from "./templates/aoe.js";
import ObfuscableTemplate from "./templates/obfuscable.js";

const { StringField, SchemaField, NumberField } = foundry.data.fields;

export default class ConsumableData extends DSADataModel.mixin(AoeTemplate, ObfuscableTemplate, DescriptionTemplate, EquipmentTemplate) {
    static defineSchema() {
        return this.mergeSchema(super.defineSchema(), {
            equipmentType: new SchemaField({
                value: new StringField({ initial: 'misc', required: true, label: 'equipmentType', choices: DSA5.equipmentTypes }),
            }),
            QLList: new DSAStringField({ initial: '', label: 'qualitySteps' }),
            QL: new NumberField({ initial: 1, required: true, label: 'qualityStep' }),
            charges: new NumberField({ initial: 1 }),
            maxCharges: new NumberField({ initial: 1 }),
            difficulty: new NumberField({ initial: 0, label: 'Difficulty' }),
            ingredients: new StringField({ initial: '' }),
            tools: new StringField({ initial: '', label: 'Equipment.tools' }),
        });
    }
}