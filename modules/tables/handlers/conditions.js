import OnUseEffect from '../../system/automation/onUseEffects.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import EffectDuration from '../../status/effectDuration.js';
import TableEffectHelpers from '../tableEffectHelpers.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import { normalizeList } from '../tableEffectUtils.js';
import { malus } from './malus.js';
import { selfDamage } from './damage.js';
import TableAccidentalAttack from '../workflows/accidentalAttack.js';

export async function nextAction(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets(args);
  if (!hasTargets) return false;

  const effect = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), [{ key: 'system.skillModifiers.global', mode: 2, value: args.modifier || 0 }], args.duration || { rounds: 1 });
  await EffectDuration.finalizeEffect(effect);
  for (const target of finalTargets) {
    await target.addCondition(effect);
  }
  return true;
}

export async function resistEffect(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets(args);
  if (!hasTargets) return false;

  const failEffects = normalizeList(args.fail);
  if (!failEffects.length) return false;

  const failNames = failEffects.map((fail) => fail.description).filter(Boolean).join(', ');
  for (const target of finalTargets) {
    const resistRolls = [{
      skill: args.roll,
      mod: args.modifier || 0,
      effect: {
        _id: 'botchEffect',
        name: failNames || _loc('botchCritEffect'),
      },
      target,
      token: target.token ? target.token.id : undefined,
    }];
    await DSAActiveEffectConfig.createResistRollMessage(resistRolls, ctx.messageId, ctx.mode);
  }
  return true;
}

export async function selfAttack(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets(args);
  if (!hasTargets) {
    if (args.noTarget) return malus(ctx, [{ target: 'self', ...args.noTarget }]);
    return selfDamage(ctx, { ...args, target: 'self' });
  }
  if (!ctx.source) return false;

  for (const actor of finalTargets) {
    if (args.defendable !== undefined) {
      await TableAccidentalAttack.createDefenseCard(ctx, actor, ctx.source, args);
      continue;
    }

    const roll = await TableEffectHelpers.rollSourceDamage(ctx.source, args, ctx);
    await actor.applyDamage(Math.round(roll.total));
    await ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
  }
  return true;
}
