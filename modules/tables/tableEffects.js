import TableEffectContext from './tableEffectContext.js';
import { runTableEffects } from './tableEffectRunner.js';
import TableAccidentalAttack from './workflows/accidentalAttack.js';
import TableOpportunityAttack from './workflows/opportunityAttack.js';

export { TABLE_EFFECT_HANDLERS, IMPLEMENTED_EFFECT_KEYS } from './tableEffectRegistry.js';

export default class TableEffects {
  static async applyEffect(id, mode) {
    return runTableEffects(id, mode);
  }

  static async rollSelfAttackDefense(ev) {
    return TableAccidentalAttack.rollDefense(ev);
  }

  static async applySelfAttackDamage(ev) {
    return TableAccidentalAttack.applyDamage(ev);
  }

  static async rollOpportunityAttack(ev) {
    return TableOpportunityAttack.roll(ev);
  }
}
