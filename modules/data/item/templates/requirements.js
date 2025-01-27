import { DSADataModel } from "../../abstract.js";
const { SchemaField } = foundry.data.fields;
import DSAStringField from "../../fields/dsa_string_field.js";


export default class RequirementsTemplate extends DSADataModel {
    static defineSchema() {
        return {
            requirements: new SchemaField({
                value: new DSAStringField({ initial: '', label: 'requirements' }),
            })
        }
    }
}