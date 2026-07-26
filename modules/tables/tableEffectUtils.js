export function normalizeList(value) {
  if (!value) return [];
  return (Array.isArray(value) ? value : [value]).filter(Boolean);
}

export function damageMacro(formula) {
  return `await actor.applyDamage(${JSON.stringify(formula)}, { msg: 'fallingDamage' });`;
}
