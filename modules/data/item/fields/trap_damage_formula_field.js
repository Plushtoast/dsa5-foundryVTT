const { StringField } = foundry.data.fields;

/**
 * A Foundry roll formula, or blank. Invalid strings are rejected by the data model.
 * Do not parse labels, prose, or localized prefixes here — fix the source data.
 */
export default class TrapDamageFormulaField extends StringField {
  /** @override */
  _validateType(value, options) {
    super._validateType(value, options);
    if (!value) return;
    if (!Roll.validate(value)) {
      throw new Error('must be a valid Foundry roll formula');
    }
  }
}
