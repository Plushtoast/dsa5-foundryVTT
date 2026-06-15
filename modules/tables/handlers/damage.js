import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import TableEffectHelpers from '../tableEffectHelpers.js';

export async function applyDamageToTargets(ctx, args, { defaultTarget, requireSource = true } = {}) {
  const targetArgs = {
    ...args,
    target: args.target || defaultTarget,
  };
  const { hasTargets, finalTargets } = ctx.resolveTargets(targetArgs);
  if (!hasTargets || (requireSource && !ctx.source)) return false;

  for (const actor of finalTargets) {
    const roll = await TableEffectHelpers.rollSourceDamage(ctx.source, args, ctx);
    await actor.applyDamage(Math.round(roll.total));
    await ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
  }
  return true;
}

export async function damageModifier(ctx, args) {
  return applyDamageToTargets(ctx, args, { defaultTarget: ctx.table == 'criticalAttack' ? 'victim' : 'self' });
}

export async function selfDamage(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets(args);
  if (!hasTargets) return false;

  if (ctx.source) {
    for (const actor of finalTargets) {
      const roll = await TableEffectHelpers.rollSourceDamage(ctx.source, args, { damageActor: actor });
      await actor.applyDamage(Math.round(roll.total));
      ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
    }
    return true;
  }

  for (const actor of finalTargets) {
    const roll = await new Roll('1d6').evaluate();
    await actor.applyDamage(Math.round(roll.total));
    ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
  }
  return true;
}
