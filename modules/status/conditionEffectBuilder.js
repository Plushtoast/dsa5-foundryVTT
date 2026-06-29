import OnUseEffect from '../system/automation/onUseEffects.js';
import EffectDuration from './effectDuration.js';

const { duplicate } = foundry.utils;

export default class ConditionEffectBuilder {
  static fromSystemEffect(systemEffect, { level = 1, changes, duration = {}, name, icon } = {}) {
    const baseEffect = CONFIG.statusEffects.find((entry) => entry.id == systemEffect);
    if (!baseEffect) return undefined;

    let effectChanges = changes ? duplicate(changes) : duplicate(baseEffect.system?.changes || []);
    const baseChange = effectChanges.find((change) => change.key == `system.condition.${systemEffect}`);
    if (baseChange) baseChange.value = level;

    const label = name || `${_loc(`CONDITION.${systemEffect}`)} - ${_loc('botchCritEffect')}`;
    const effect = OnUseEffect.effectBaseDummy(label, effectChanges, duration || {});
    if (icon || baseEffect.icon) effect.icon = icon || baseEffect.icon;
    return effect;
  }

  static async applyToActor(actor, systemEffect, options = {}) {
    const effect = this.fromSystemEffect(systemEffect, options);
    if (!effect) return false;

    await EffectDuration.finalizeEffect(effect);
    await actor.addCondition(effect);
    return true;
  }
}
