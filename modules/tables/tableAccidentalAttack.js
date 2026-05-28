import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import TableEffectHelpers from './tableEffectHelpers.js';

const { mergeObject } = foundry.utils;

export default class TableAccidentalAttack {
  static async createDefenseCard(target, source, args, tableMessageId, context = {}) {
    const sourceActor = source.actor || source.parent || context.speaker;
    const sourceSpeaker = TableEffectHelpers.speakerFromActor(sourceActor);
    const targetSpeaker = TableEffectHelpers.speakerFromActor(target);
    if (!sourceSpeaker || !targetSpeaker) return false;

    const defendable = Number(args.defendable) || 0;
    const content = `<div class="dsa5 chat-card">
      <p><b>${_loc('botchCritEffect')}</b>: ${_loc('Defense')} ${defendable}</p>
      <p>${sourceActor.name}: ${source.name} &rarr; ${target.name}</p>
      <div class="flexrow">
        <button class="tableSelfAttackDefense small-button chat-button" data-tooltip="${_loc('dodge')}"><i class="fas fa-shield-alt"></i> ${_loc('dodge')}</button>
        <button class="tableSelfAttackDamage small-button chat-button"><i class="fas fa-tint"></i> ${_loc('damage')}</button>
      </div>
    </div>`;
    await ChatMessage.create(mergeObject(DSA5_Utility.chatDataSetup(content), {
      flags: {
        dsa5: {
          selfAttackDefense: {
            tableMessageId,
            source: source.id,
            sourceData: DSA5_Utility.toObjectIfPossible(source),
            sourceActor: sourceSpeaker,
            target: targetSpeaker,
            defendable,
            args,
          },
        },
      },
    }));
    return true;
  }

  static async rollDefense(ev) {
    const message = game.messages.get(ev.currentTarget.closest('.message')?.dataset.messageId);
    const data = TableEffectHelpers.flag(message, 'selfAttackDefense');
    const actor = TableEffectHelpers.actorFromSpeaker(data?.target);
    if (!message || !data || !actor) return false;
    if (data.damageApplied || data.defenseRolled) return false;

    const setupData = await actor.setupDodge({
      moreModifiers: [{ name: _loc('botchCritEffect'), value: data.defendable, selected: true }],
      subtitle: ` (${_loc('botchCritEffect')})`,
    }, data.target.token);
    setupData.testData.opposable = false;
    const result = await actor.basicTest(setupData);
    const success = (result.result.qualityStep || 0) > 0;
    await message.update({
      'flags.dsa5.selfAttackDefense.defenseRolled': true,
      'flags.dsa5.selfAttackDefense.defenseSucceeded': success,
    });
    if (success) await TableEffectHelpers.markWorkflowUsed(message, _loc('OPPOSED.defenderWins'));
    else ui.notifications.info('Failure', { localize: true });
    return true;
  }

  static async applyDamage(ev) {
    const message = game.messages.get(ev.currentTarget.closest('.message')?.dataset.messageId);
    const data = TableEffectHelpers.flag(message, 'selfAttackDefense');
    const actor = TableEffectHelpers.actorFromSpeaker(data?.target);
    const sourceActor = TableEffectHelpers.actorFromSpeaker(data?.sourceActor);
    const source = data?.source && sourceActor ? sourceActor.items.get(data.source) || data.sourceData : data?.sourceData;
    if (!message || !data || !actor || !source) return false;
    if (data.damageApplied || data.defenseSucceeded) return false;

    const roll = await TableEffectHelpers.rollSourceDamage(source, data.args || {}, { speaker: sourceActor });
    await actor.applyDamage(Math.round(roll.total));
    await ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
    await message.update({ 'flags.dsa5.selfAttackDefense.damageApplied': true });
    await TableEffectHelpers.markWorkflowUsed(message, _loc('damageApplied'));
    return true;
  }
}