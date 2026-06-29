import TableEffectContext from './tableEffectContext.js';
import { TABLE_EFFECT_HANDLERS, TABLE_EFFECT_ORDER } from './tableEffectRegistry.js';

const SOURCE_REQUIRED_KEYS = new Set(['gearDamaged', 'gearLost', 'weaponDelay', 'weaponRepairPenalty', 'damageModifier']);

export async function runTableEffects(messageId, mode) {
  const ctx = TableEffectContext.fromApply(messageId, mode);
  if (!ctx) return;

  const payload = ctx.flagPayload;
  const knownKeys = new Set(TABLE_EFFECT_ORDER);

  for (const key of Object.keys(payload)) {
    if (!knownKeys.has(key)) console.warn('Unknown table effect key', key, payload[key]);
  }

  for (const key of TABLE_EFFECT_ORDER) {
    const args = payload[key];
    if (!args) continue;

    if (SOURCE_REQUIRED_KEYS.has(key) && !ctx.source) continue;

    const handler = TABLE_EFFECT_HANDLERS[key];
    const result = await handler(ctx, args);
    if (!result) console.warn(`Table effect for <${key}> not working yet`, args, mode, ctx.applyTargets, ctx.source);
  }

  await ctx.markApplied();
}

export { TableEffectContext };
