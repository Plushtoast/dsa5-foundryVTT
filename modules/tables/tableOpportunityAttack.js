import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import DSATables from './dsatables.js';
import TableEffectActiveEffects from './tableEffectActiveEffects.js';
import TableEffectHelpers from './tableEffectHelpers.js';

const { duplicate, mergeObject } = foundry.utils;

export default class TableOpportunityAttack {
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

  static async createCard(args, mode, targets, source, tableMessageId, message, context = {}) {
    const actor = context.speaker;
    const target = context.attacker || targets[0];
    if (!actor || !target) return false;

    const weapons = this.#meleeWeapons(actor);
    const data = this.normalize(args);
    const targetSpeaker = TableEffectHelpers.speakerFromActor(target);
    const actorSpeaker = TableEffectHelpers.speakerFromActor(actor);
    if (!targetSpeaker || !actorSpeaker) return false;

    const weaponButtons = weapons.length
      ? weapons.map((weapon) => `<button class="tableOpportunityAttack small-button chat-button" data-weapon="${weapon.id}"><i class="fas fa-swords"></i> ${weapon.name}</button>`).join('')
      : `<p>${_loc('DSAError.notFound', { category: _loc('TYPES.Item.meleeweapon'), name: _loc('WEAPON.Item') })}</p>`;
    const modifiers = this.#attackModifiers(data).join(' / ');
    const content = `<div class="dsa5 chat-card">
      <p><b>${_loc('attackOfOpportunity')}</b>: ${actor.name} &rarr; ${target.name}</p>
      <p>${_loc('CHAR.ATTACK')}: ${modifiers}</p>
      <div class="flexrow">${weaponButtons}</div>
    </div>`;
    await ChatMessage.create(mergeObject(DSA5_Utility.chatDataSetup(content), {
      flags: {
        dsa5: {
          opportunityAttack: {
            tableMessageId,
            actor: actorSpeaker,
            target: targetSpeaker,
            data,
            used: false,
            usedCount: 0,
          },
        },
      },
    }));
    return true;
  }

  static async roll(ev) {
    const message = game.messages.get(ev.currentTarget.closest('.message')?.dataset.messageId);
    const data = TableEffectHelpers.flag(message, 'opportunityAttack');
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
    if (nextUsedCount >= count) await TableEffectHelpers.markWorkflowUsed(message, _loc('attackOfOpportunity'));
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
      await TableEffectActiveEffects.createManeuverPenaltyIgnore(actor, followupMalus.value, followupMalus.duration || { rounds: 1 });
      await message.update({ 'flags.dsa5.opportunityAttack.followupApplied': true });
      return true;
    }

    if (!followupMalus?.changes?.length) return false;

    const effect = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), followupMalus.changes, followupMalus.duration || { rounds: 1 });
    await DSATables.finalizeEffect(effect);
    await actor.addCondition(effect);
    await message.update({ 'flags.dsa5.opportunityAttack.followupApplied': true });
    return true;
  }

  static async #applyFollowupEffect(result, attackData, targetSpeaker, message) {
    const successLevel = result?.result?.successLevel ?? result?.successLevel ?? 0;
    const followupEffect = attackData.followupResistEffect;
    const target = TableEffectHelpers.actorFromSpeaker(targetSpeaker);
    if (successLevel <= 0 || !followupEffect?.systemEffect || !target) return false;

    const baseEffect = CONFIG.statusEffects.find((effect) => effect.id == followupEffect.systemEffect);
    if (!baseEffect) return false;

    const level = followupEffect.level || 1;
    const changes = duplicate(baseEffect.system?.changes || []);
    const baseChange = changes.find((change) => change.key == `system.condition.${followupEffect.systemEffect}`);
    if (baseChange) baseChange.value = level;

    const effect = OnUseEffect.effectBaseDummy(`${_loc(`CONDITION.${followupEffect.systemEffect}`)} - ${_loc('botchCritEffect')}`, changes, followupEffect.duration || {});
    effect.icon = baseEffect.icon;
    await DSATables.finalizeEffect(effect);
    await target.addCondition(effect);
    await message.update({ 'flags.dsa5.opportunityAttack.followupEffectApplied': true });
    return true;
  }

  static #meleeWeapons(actor) {
    return actor.items.filter((item) => item.type == 'meleeweapon' && item.system?.worn?.value);
  }
}