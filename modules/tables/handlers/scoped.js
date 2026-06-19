import TableEffectFactory from '../tableEffectFactory.js';
import TableEffectHelpers from '../tableEffectHelpers.js';

const { duplicate } = foundry.utils;

function resolveScopedRule(args, ctx) {
  const { hasTargets, finalTargets } = ctx.resolveTargets({ ...args, target: args.target || 'self' });
  const incomingAttack = ['incomingAttack', 'allOpponents'].includes(args.scope);
  const selfScope = args.scope == 'self';
  const scopedTargets = incomingAttack || selfScope ? [] : ctx.resolveTargets({ target: args.scopeTarget || 'attacker' }).finalTargets;
  if (!hasTargets || (!incomingAttack && !selfScope && !scopedTargets.length)) return undefined;

  return { finalTargets, incomingAttack, selfScope, scopedTargets };
}

function scopedRuleEntry(args, resolved, data) {
  const entry = {
    scope: resolved.incomingAttack ? 'incomingAttack' : args.scope || 'againstTarget',
    ...data,
  };
  if (!resolved.incomingAttack && !resolved.selfScope) entry.target = TableEffectHelpers.speakerFromActor(resolved.scopedTargets[0]);
  return entry;
}

export async function scopedModifier(ctx, args) {
  let applied = false;
  for (const scopedModifier of Array.isArray(args) ? args : [args]) {
    const resolved = resolveScopedRule(scopedModifier, ctx);
    if (!resolved || !scopedModifier.changes?.length) continue;

    const entry = scopedRuleEntry(scopedModifier, resolved, {
      changes: duplicate(scopedModifier.changes),
      requiresManeuver: !!scopedModifier.requiresManeuver,
      requiresNoManeuver: !!scopedModifier.requiresNoManeuver,
      requiresOpponentManeuver: !!scopedModifier.requiresOpponentManeuver,
    });
    if (scopedModifier.maneuverTypes) entry.maneuverTypes = duplicate(scopedModifier.maneuverTypes);
    for (const actor of resolved.finalTargets) {
      await TableEffectFactory.createScopedModifier(actor, entry, scopedModifier.duration || { rounds: 1 });
      applied = true;
    }
  }
  return applied;
}

export async function scopedRestriction(ctx, args) {
  const restrictions = args.restrictions || (args.restriction ? [args.restriction] : []);
  const resolved = resolveScopedRule(args, ctx);
  if (!resolved || !restrictions.length) return false;

  const entry = scopedRuleEntry(args, resolved, {
    restrictions: duplicate(restrictions),
  });
  if (args.clearOnWeaponReady && ctx.source?.uuid) {
    entry.clearOnWeaponReady = true;
    entry.origin = ctx.source.uuid;
  }
  for (const actor of resolved.finalTargets) {
    await TableEffectFactory.createScopedRestriction(actor, entry, args.duration || { rounds: 1 });
  }
  return true;
}
