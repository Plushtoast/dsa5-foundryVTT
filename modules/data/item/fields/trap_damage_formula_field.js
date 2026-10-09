import { DICE_CONSTANTS } from '../../../config/dice-constants.js';

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
    const formula = value.replace(new RegExp(DICE_CONSTANTS.PATTERNS.DIE_LOCALIZATION.source, 'g'), 'd');
    if (!Roll.validate(formula)) {
      throw new Error(_loc('REGIONBEHAVIOR_DSATrap.FLOW.invalidFormula'));
    }
  }
}
