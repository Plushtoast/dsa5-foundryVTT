import TableEffectFactory from '../tableEffectFactory.js';

const { duplicate } = foundry.utils;

export async function maneuverPenaltyIgnore(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets({ ...args, target: args.target || 'self' });
  if (!hasTargets || !args.value) return false;

  for (const actor of finalTargets) {
    await TableEffectFactory.createManeuverPenaltyIgnore(actor, args.value, args.duration || { rounds: 1 });
  }
  return true;
}

export async function defenseCountModifier(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets({ ...args, target: args.target || 'self' });
  if (!hasTargets || args.floor === undefined) return false;

  for (const actor of finalTargets) {
    await TableEffectFactory.createDefenseCountModifier(actor, { ...duplicate(args), floor: Number(args.floor) || 0 }, args.duration || { rounds: 1 });
  }
  return true;
}

export async function attackPenaltyReduction(ctx, args) {
  const { hasTargets, finalTargets } = ctx.resolveTargets({ ...args, target: args.target || 'self' });
  if (!hasTargets || !args.value) return false;

  for (const actor of finalTargets) {
    await TableEffectFactory.createAttackPenaltyReduction(actor, args, args.duration || { rounds: 1 });
  }
  return true;
}
