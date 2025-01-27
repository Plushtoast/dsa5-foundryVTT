const { StringField } = foundry.data.fields;

export default class DSAStringField extends StringField {
  toFormGroup(groupConfig = {}, inputConfig = {}) {
    const group = super.toFormGroup(groupConfig, inputConfig);
    if (inputConfig.tooltip) group.dataset.tooltip = inputConfig.tooltip;
    return group;
  }
}
