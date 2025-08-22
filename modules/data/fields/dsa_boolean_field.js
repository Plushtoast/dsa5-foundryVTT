const { BooleanField } = foundry.data.fields;

export default class DSABooleanField extends BooleanField {
    /** @inheritDoc */
    toInput(config = {}) {
        const input = super.toInput(config);
        const tooltip = config.tooltip || this.options.tooltip;
        if (tooltip) input.dataset.tooltip = tooltip;
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
