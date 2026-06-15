import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import TableEffectHelpers from '../tableEffectHelpers.js';
import TableTemplates from '../tableTemplates.js';
import TableChatWorkflow from './TableChatWorkflow.js';

const { mergeObject } = foundry.utils;

export default class TableAccidentalAttack extends TableChatWorkflow {
  static flagKey = 'selfAttackDefense';

  static async createDefenseCard(ctx, target, source, args) {
    const sourceActor = source.actor || source.parent || ctx.speaker;
    const sourceSpeaker = TableEffectHelpers.speakerFromActor(sourceActor);
    const targetSpeaker = TableEffectHelpers.speakerFromActor(target);
    if (!sourceSpeaker || !targetSpeaker) return false;

    const defendable = Number(args.defendable) || 0;
    const content = await TableTemplates.accidentalAttackDefenseCard({
      sourceActorName: sourceActor.name,
      sourceName: source.name,
      targetName: target.name,
      defendable,
    });

    return this.createWorkflowMessage(content, {
      tableMessageId: ctx.messageId,
      source: source.id,
      sourceData: DSA5_Utility.toObjectIfPossible(source),
      sourceActor: sourceSpeaker,
      target: targetSpeaker,
      defendable,
      args,
    });
  }

  static async rollDefense(ev) {
    const message = this.getMessage(ev);
    const data = this.flag(message);
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
    if (success) await this.markWorkflowUsed(message, _loc('OPPOSED.defenderWins'));
    else ui.notifications.info('Failure', { localize: true });
    return true;
  }

  static async applyDamage(ev) {
    const message = this.getMessage(ev);
    const data = this.flag(message);
    const actor = TableEffectHelpers.actorFromSpeaker(data?.target);
    const sourceActor = TableEffectHelpers.actorFromSpeaker(data?.sourceActor);
    const source = data?.source && sourceActor ? sourceActor.items.get(data.source) || data.sourceData : data?.sourceData;
    if (!message || !data || !actor || !source) return false;
    if (data.damageApplied || data.defenseSucceeded) return false;

    const roll = await TableEffectHelpers.rollSourceDamage(source, data.args || {}, { speaker: sourceActor });
    await actor.applyDamage(Math.round(roll.total));
    await ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
    await message.update({ 'flags.dsa5.selfAttackDefense.damageApplied': true });
    await this.markWorkflowUsed(message, _loc('damageApplied'));
    return true;
  }
}
