const { NumberField } = foundry.data.fields;

export default class DSANumberField extends NumberField {
    toInput(config={}) {
        const input = super.toInput(config);
        if ( config.tooltip ) input.dataset.tooltip = config.tooltip;
        return input;
    }

    /** @inheritDoc */
    toFormGroup(groupConfig = {}, inputConfig = {}) {
        const group = super.toFormGroup(groupConfig, inputConfig);
        const tooltip = inputConfig.tooltip || this.options.tooltip;
        if (tooltip) group.dataset.tooltip = tooltip;
        return group;
    }
}
