import CreatureType from '../../system/automation/creature-type.js';
import EquipmentDamage from '../../system/automation/equipment-damage.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import TableTemplates from '../tableTemplates.js';
import OnUseEffect from '../../system/automation/onUseEffects.js';
import EffectDuration from '../../status/effectDuration.js';

const { getProperty } = foundry.utils;

function normalizeGearArgs(args) {
  if (typeof args == 'number') return args;
  return args;
}

export async function gearDamaged(ctx, args) {
  const source = ctx.source;
  const gearArgs = normalizeGearArgs(args);
  if (!source || !['meleeweapon', 'rangeweapon'].includes(source.type)) return false;

  const attributes = getProperty(source, 'system.effect.attributes') || '';
  const regex = new RegExp(`(${CreatureType.magical}|${CreatureType.clerical})`, 'i');
  const isMagical = regex.test(attributes);
  if (isMagical) {
    const actor = source.actor || source.parent;
    if (actor) await actor.equipWeaponToHand(source.id, { equip: false });
    else await source.update({ 'system.worn.value': false, 'system.worn.offHand': false });
  } else if (game.settings.get('dsa5', 'armorAndWeaponDamage')) {
    await EquipmentDamage.absoluteDamageLevelToItem(source, gearArgs);
  }

  return true;
}

export async function weaponRepairPenalty(ctx, args) {
  const source = ctx.source;
  if (!source || !['meleeweapon', 'rangeweapon'].includes(source.type)) {
    console.warn('Unable to apply weapon repair penalty table effect', { args, source });
    return false;
  }

  const value = Number(args.value) || 0;
  const combatSkill = source.system.combatskill.value;
  if (!value || !combatSkill) return false;

  const changes = [{ key: 'system.skillModifiers.combat.attack', type: 'custom', value: `${combatSkill} ${value}` }];
  if (source.type == 'meleeweapon') changes.push({ key: 'system.skillModifiers.combat.parry', type: 'custom', value: `${combatSkill} ${value}` });

  const effect = OnUseEffect.effectBaseDummy(args.name || _loc('botchCritEffect'), changes, {});
  effect.transfer = true;
  effect.system.applyToOwner = true;
  effect.flags.dsa5.tableEffect = { type: 'weaponRepairPenalty' };
  await EffectDuration.finalizeEffect(effect);
  await source.createEmbeddedDocuments('ActiveEffect', [effect]);
  return true;
}

export async function gearLost(ctx, args) {
  const source = ctx.source;
  if (!source || !['meleeweapon', 'rangeweapon'].includes(source.type)) return false;

  const actor = source.actor || source.parent;
  if (actor) await actor.equipWeaponToHand(source.id, { equip: false });
  else await source.update({ 'system.worn.value': false, 'system.worn.offHand': false });
  if (args.distance) {
    const roll = await new Roll(args.distance).evaluate();
    const renderedRoll = await roll.render();
    const msg = _loc('WEAPON.dropped', { distance: roll.total });
    const content = await TableTemplates.gearDropped({ message: msg, rollHtml: renderedRoll });
    ChatMessage.create(DSA5_Utility.chatDataSetup(content));
  }
  return true;
}

export async function weaponDelay(ctx, args) {
  const source = ctx.source;
  const actions = Math.max(0, Number(args.actions) || 0);
  const hasReloadProgress = source?.system?.reloadTime?.progress !== undefined;
  if (!actions || !hasReloadProgress) {
    console.warn('Unable to apply weapon delay table effect', { args, source });
    return false;
  }

  await source.update({
    'system.reloadTime.progress': (Number(source.system.reloadTime.progress) || 0) - actions,
    'system.aimTime.progress': 0,
  });
  return true;
}
