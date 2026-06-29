import { damageModifier, selfDamage } from './handlers/damage.js';
import { nextAction, resistEffect, selfAttack } from './handlers/conditions.js';
import { malus } from './handlers/malus.js';
import { gearDamaged, gearLost, weaponDelay, weaponRepairPenalty } from './handlers/gear.js';
import { maneuverPenaltyIgnore, defenseCountModifier, attackPenaltyReduction } from './handlers/charged.js';
import { scopedModifier, scopedRestriction } from './handlers/scoped.js';
import TableOpportunityAttack from './workflows/opportunityAttack.js';

export const TABLE_EFFECT_ORDER = [
  'damageModifier',
  'gearDamaged',
  'weaponRepairPenalty',
  'gearLost',
  'resistEffect',
  'malus',
  'selfDamage',
  'selfAttack',
  'nextAction',
  'opportunityAttack',
  'weaponDelay',
  'maneuverPenaltyIgnore',
  'defenseCountModifier',
  'attackPenaltyReduction',
  'scopedModifier',
  'scopedRestriction',
];

export const TABLE_EFFECT_HANDLERS = {
  damageModifier,
  gearDamaged,
  weaponRepairPenalty,
  gearLost,
  resistEffect,
  malus,
  selfDamage,
  selfAttack,
  nextAction,
  opportunityAttack: (ctx, args) => TableOpportunityAttack.createCard(ctx, args),
  weaponDelay,
  maneuverPenaltyIgnore,
  defenseCountModifier,
  attackPenaltyReduction,
  scopedModifier,
  scopedRestriction,
};

export const IMPLEMENTED_EFFECT_KEYS = Object.freeze([...TABLE_EFFECT_ORDER]);
