const { StringField } = foundry.data.fields;

export default class DSAStringField extends StringField {
  /** @inheritDoc */
  toFormGroup(groupConfig = {}, inputConfig = {}) {
    const group = super.toFormGroup(groupConfig, inputConfig);
    const tooltip = inputConfig.tooltip || this.options.tooltip;
    if (tooltip) group.dataset.tooltip = tooltip;
    return group;
  }
}
