import RuleChaos from '../rules/rule_chaos.js';
const { getProperty } = foundry.utils;
export function isWeapon(item) {
  return !!item && (item.type === 'meleeweapon' || item.type === 'rangeweapon');
}
/**
 * True if the weapon currently occupies both hands.
 *
 * - Melee: uses RuleChaos "wielded two-handed" evaluation (respects wrongGrip).
 * - Ranged: uses `system.worn.requiresBothHands` (default true).
 */
export function isTwoHandedWeapon(item) {
  if (!isWeapon(item)) return false;
  if (item.type === 'meleeweapon') return RuleChaos.isWieldedTwohanded(item);
  if (item.type === 'rangeweapon') return getProperty(item, 'system.worn.requiresBothHands') !== false;
  return false;
}
/**
 * True if this weapon may be equipped in the off-hand.
 * For ranged weapons this requires `requiresBothHands === false`.
 */
export function canEquipWeaponOffHand(item) {
  return isWeapon(item) && !isTwoHandedWeapon(item);
}
