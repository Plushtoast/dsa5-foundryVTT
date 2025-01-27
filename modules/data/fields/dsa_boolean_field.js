const { BooleanField } = foundry.data.fields;

export default class DSABooleanField extends BooleanField {
    toInput(config={}) {
        const input = super.toInput(config);
        if ( config.tooltip ) input.dataset.tooltip = config.tooltip;
        return input;
    }
}
