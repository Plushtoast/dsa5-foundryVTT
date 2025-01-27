import DSANumberField from '../../fields/dsa_number_field.js';

export default class ScopableNumberField extends DSANumberField {
    toInput(config={}) {
        const input = super.toInput(config);
        if ( config.scope ) input.name = `${config.scope}${input.name}`;
        return input;
    }
}
