import DSABooleanField from '../../fields/dsa_boolean_field.js';

export default class ScopableBooleanField extends DSABooleanField {
    toInput(config={}) {
        const input = super.toInput(config);
        if ( config.scope ) input.name = `${config.scope}${input.name}`;
        return input;
    }
}
