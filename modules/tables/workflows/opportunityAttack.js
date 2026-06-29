import OnUseEffect from '../../system/automation/onUseEffects.js';
import ConditionEffectBuilder from '../../status/conditionEffectBuilder.js';
import EffectDuration from '../../status/effectDuration.js';
import TableEffectFactory from '../tableEffectFactory.js';
import TableEffectHelpers from '../tableEffectHelpers.js';
import TableTemplates from '../tableTemplates.js';
import TableChatWorkflow from './TableChatWorkflow.js';

const { duplicate, mergeObject } = foundry.utils;

export default class TableOpportunityAttack extends TableChatWorkflow {
  static flagKey = 'opportunityAttack';

  static normalize(args = {}) {
    const attacks = Array.isArray(args.attacks) ? args.attacks.map((attack) => this.normalizeAttack(attack)) : undefined;
    return {
      ...this.normalizeAttack(args),
      count: Number(args.count ?? attacks?.length ?? 1),
      attacks,
    };
  }

  static normalizeAttack(args = {}) {
    return {
      attackModifier: Number(args.attackModifier ?? args.modifier ?? 0),
      damageModifier: args.damageModifier ?? '',
      defenseAllowed: args.defenseAllowed === true,
      allowBasicManeuvers: args.allowBasicManeuvers === true,
      allowSpecialManeuvers: args.allowSpecialManeuvers === true,
      followupMalus: args.followupMalus,
      followupResistEffect: args.followupResistEffect,
    };
  }

  static async createCard(ctx, args) {
    const actor = ctx.speaker;
    const target = ctx.attacker || ctx.applyTargets[0];
    if (!actor || !target) return false;

    const weapons = this.#meleeWeapons(actor).map((weapon) => ({ id: weapon.id, name: weapon.name }));
    const data = this.normalize(args);
    const targetSpeaker = TableEffectHelpers.speakerFromActor(target);
    const actorSpeaker = TableEffectHelpers.speakerFromActor(actor);
    if (!targetSpeaker || !actorSpeaker) return false;

    const content = await TableTemplates.opportunityAttackCard({
      actorName: actor.name,
      targetName: target.name,
      modifiers: this.#attackModifiers(data).join(' / '),
      weapons,
    });

    return this.createWorkflowMessage(content, {
      tableMessageId: ctx.messageId,
      actor: actorSpeaker,
      target: targetSpeaker,
      data,
      used: false,
      usedCount: 0,
    });
  }

  static async roll(ev) {
    const message = this.getMessage(ev);
    const data = this.flag(message);
    const usedCount = Number(data?.usedCount || 0);
    const count = Number(data?.data?.count || 1);
    if (!message || !data || usedCount >= count) return false;

    const actor = TableEffectHelpers.actorFromSpeaker(data.actor);
    const weapon = actor?.items.get(ev.currentTarget.dataset.weapon);
    if (!actor || !weapon) return false;

    const attackData = this.#attackData(data.data, usedCount);
    TableEffectHelpers.targetToken(data.target);
    const setupData = await actor.setupWeapon(weapon, 'attack', {
      damageModifier: attackData.damageModifier,
      forceOpportunityAttack: !attackData.allowBasicManeuvers && !attackData.allowSpecialManeuvers,
      opportunityAttackManeuvers: {
        allowBasic: attackData.allowBasicManeuvers,
        allowSpecial: attackData.allowSpecialManeuvers,
      },
      moreModifiers: [{ name: _loc('MODS.opportunityAttack'), value: attackData.attackModifier, selected: true }],
      subtitle: ` (${_loc('attackOfOpportunity')})`,
    }, data.actor.token);
    setupData.testData.attackOfOpportunity = attackData.defenseAllowed ? 0 : attackData.attackModifier || -4;
    const nextUsedCount = usedCount + 1;
    await message.update({
      'flags.dsa5.opportunityAttack.used': nextUsedCount >= count,
      'flags.dsa5.opportunityAttack.usedCount': nextUsedCount,
    });
    if (nextUsedCount >= count) await this.markWorkflowUsed(message, _loc('attackOfOpportunity'));
    const result = await actor.basicTest(setupData);
    await this.#applyFollowupMalus(actor, attackData.followupMalus, message);
    await this.#applyFollowupEffect(result, attackData, data.target, message);
    return result;
  }

  static #attackData(data, index) {
    return data.attacks?.[index] ? mergeObject(duplicate(data), data.attacks[index], { inplace: false }) : data;
  }

  static #attackModifiers(data) {
    return data.attacks?.length ? data.attacks.map((attack) => attack.attackModifier) : [data.attackModifier];
  }

  static async #applyFollowupMalus(actor, followupMalus, message) {
    if (followupMalus?.type == 'ignoreManeuverPenalty') {
      await TableEffectFactory.createManeuverPenaltyIgnore(actor, followupMalus.value, followupMalus.duration || { rounds: 1 });
      await message.update({ 'flags.dsa5.opportunityAttack.followupApplied': true });
      return true;
    }

    if (!followupMalus?.changes?.length) return false;

    const effect = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), followupMalus.changes, followupMalus.duration || { rounds: 1 });
    await TableEffectFactory.addCondition(actor, effect);
    await message.update({ 'flags.dsa5.opportunityAttack.followupApplied': true });
    return true;
  }

  static async #applyFollowupEffect(result, attackData, targetSpeaker, message) {
    const successLevel = result?.result?.successLevel ?? result?.successLevel ?? 0;
    const followupEffect = attackData.followupResistEffect;
    const target = TableEffectHelpers.actorFromSpeaker(targetSpeaker);
    if (successLevel <= 0 || !followupEffect?.systemEffect || !target) return false;

    const effect = ConditionEffectBuilder.fromSystemEffect(followupEffect.systemEffect, {
      level: followupEffect.level || 1,
      duration: followupEffect.duration || {},
    });
    if (!effect) return false;

    await TableEffectFactory.addCondition(target, effect);
    await message.update({ 'flags.dsa5.opportunityAttack.followupEffectApplied': true });
    return true;
  }

  static #meleeWeapons(actor) {
    return actor.items.filter((item) => item.type == 'meleeweapon' && item.system?.worn?.value);
  }
}
