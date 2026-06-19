import OnUseEffect from '../../system/automation/onUseEffects.js';
import EffectDuration from '../../status/effectDuration.js';
import ConditionEffectBuilder from '../../status/conditionEffectBuilder.js';
import { normalizeList } from '../tableEffectUtils.js';

const { duplicate, mergeObject } = foundry.utils;

export async function malus(ctx, args) {
  const entries = normalizeList(args);
  let applied = false;

  for (const malus of entries) {
    let { hasTargets, finalTargets } = ctx.resolveTargets(malus);
    const alternateEffect = !hasTargets && malus.noTarget;
    if (!hasTargets && !alternateEffect) continue;
    if (alternateEffect) finalTargets = [ctx.speaker].filter(Boolean);
    if (!finalTargets.length) continue;

    const systemEffect = alternateEffect ? malus.noTarget.systemEffect : malus.systemEffect;
    const systemEffectLevel = alternateEffect ? malus.noTarget.level : malus.level || 1;
    let changes = alternateEffect ? malus.noTarget.changes : malus.changes;
    const duration = alternateEffect ? malus.noTarget.duration : malus.duration;

    if (systemEffect) {
      const baseEffect = CONFIG.statusEffects.find((entry) => entry.id == systemEffect);
      if (!baseEffect) {
        console.warn('Unknown table effect system effect', systemEffect, malus);
        continue;
      }

      if (!changes) {
        changes = duplicate(baseEffect.system?.changes || []);
        const baseChange = changes.find((change) => change.key == `system.condition.${systemEffect}`);
        if (baseChange) baseChange.value = systemEffectLevel;
      }

      let effect;
      if (changes) {
        effect = ConditionEffectBuilder.fromSystemEffect(systemEffect, {
          level: systemEffectLevel,
          changes,
          duration: duration || {},
        }) || OnUseEffect.effectBaseDummy(_loc(`CONDITION.${systemEffect}`) + ' - ' + _loc('botchCritEffect'), changes, duration || {});
        if (baseEffect.icon && !effect.icon) effect.icon = baseEffect.icon;
      } else {
        effect = systemEffect;
      }

      await EffectDuration.finalizeEffect(effect);
      for (const target of finalTargets) {
        await target.addCondition(effect);
      }
      applied = true;
    } else if (changes) {
      const effect = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), changes || [], duration || {});
      mergeObject(effect, {
        system: {
          visibility: {
            hideOnToken: false,
            hidePlayers: false,
          },
        },
      });
      await EffectDuration.finalizeEffect(effect);
      for (const target of finalTargets) {
        await target.addCondition(effect);
      }
      applied = true;
    }
  }

  return applied;
}
