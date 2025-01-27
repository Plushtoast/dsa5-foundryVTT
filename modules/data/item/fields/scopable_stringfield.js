import DSAStringField from "../../fields/dsa_string_field.js";

export default class ScopableStringField extends DSAStringField {
    toInput(config={}) {
        const input = super.toInput(config);
        if ( config.scope ) input.name = `${config.scope}${input.name}`;
        return input;
    }
}
