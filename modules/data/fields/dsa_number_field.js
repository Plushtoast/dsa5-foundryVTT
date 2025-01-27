const { NumberField } = foundry.data.fields;

export default class DSANumberField extends NumberField {
    toInput(config={}) {
        const input = super.toInput(config);
        if ( config.tooltip ) input.dataset.tooltip = config.tooltip;
        return input;
    }
}
