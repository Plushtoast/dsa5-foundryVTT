import Actordsa5 from '../actor/actor-dsa5.js';
import CombatskillData from '../data/item/combatskill.js';
import TraitData from '../data/item/trait.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import TableTemplates from './tableTemplates.js';

const { getProperty } = foundry.utils;

export default class TableEffectHelpers {
  static actorFromSpeaker(speaker) {
    return speaker ? DSA5_Utility.getSpeaker(speaker) : undefined;
  }

  static speakerFromActor(actor) {
    if (!actor) return undefined;
    return {
      actor: actor.id,
      token: actor.token?.id,
      scene: actor.token?.parent?.id || canvas.scene?.id,
    };
  }

  static speakerFromToken(target) {
    if (!target?.actor) return undefined;
    return {
      token: target.id,
      actor: target.actor.id,
      scene: target.scene?.id || canvas.scene?.id,
    };
  }

  static speakerFromMessage(messageId) {
    const message = messageId ? game.messages.get(messageId) : undefined;
    return getProperty(message, 'flags.data.preData.extra.speaker') || message?.speaker;
  }

  static speakersFromMessages(messageIds) {
    const ids = messageIds ? Array.from(messageIds instanceof Set ? messageIds : Array.isArray(messageIds) ? messageIds : [messageIds]) : [];
    return ids.map((messageId) => this.speakerFromMessage(messageId)).filter(Boolean);
  }

  static actorsFromSpeakers(speakers = []) {
    return speakers.map((speaker) => this.actorFromSpeaker(speaker)).filter(Boolean);
  }

  static evaluateTargetArg(args = {}, targets = [], context = {}) {
    const target = args.target;
    const selectedTargets = Array.from(game.user.targets).map((x) => x.actor).filter(Boolean);
    let finalTargets = targets.filter(Boolean);
    let hasTargets = true;

    if (!target) {
      finalTargets = targets.filter(Boolean);
      hasTargets = finalTargets.length > 0;
    } else if (target == 'self') {
      finalTargets = [context.speaker || targets[0]].filter(Boolean);
    } else if (target == 'victim') {
      finalTargets = selectedTargets.length ? selectedTargets : context.targets || context.contextTargets || [];
      hasTargets = finalTargets.length > 0;
      if (!hasTargets) ui.notifications.warn('DSAError.noVictim', { localize: true });
    } else if (target == 'attacker') {
      finalTargets = [context.attacker].filter(Boolean);
      hasTargets = finalTargets.length > 0;
      if (!hasTargets) console.warn('Table effect target attacker could not be resolved', args, context);
    } else {
      finalTargets = [];
      hasTargets = false;
      console.warn('Unknown table effect target', target, args);
    }

    return { hasTargets, finalTargets };
  }

  static buildEffectContext(options, speaker) {
    const tableContext = options.tableContext || {};
    return {
      table: tableContext.table || options.table,
      speaker: speaker || DSA5_Utility.getSpeaker(options.speaker),
      targets: this.actorsFromSpeakers(tableContext.targets),
      attacker: this.actorFromSpeaker(tableContext.attacker),
      defenders: this.actorsFromSpeakers(tableContext.defenders),
    };
  }

  static buildBotchContext(testData, table) {
    return {
      table,
      speaker: testData.extra.speaker,
      targets: Array.from(game.user.targets).map((target) => this.speakerFromToken(target)).filter(Boolean),
      attacker: this.speakerFromMessage(testData.attackerMessage),
      defenders: this.speakersFromMessages(testData.defenderMessage),
      attackerMessage: testData.attackerMessage,
      defenderMessage: testData.defenderMessage,
      isOpposedTest: testData.isOpposedTest,
    };
  }

  static async rollSourceDamage(source, args = {}, context = {}) {
    const damageActor = context.damageActor || source.actor || source.parent || context.speaker;
    if (!damageActor) throw new Error('No damage actor found for table effect damage roll.');

    const preparedItem = this.prepareDamageItem(source, args, damageActor);
    const damage = (preparedItem.damagedie + preparedItem.damageAdd).replace(/[wWD]/g, 'd');
    return await new Roll(`(${damage})*${args.multiplier || 1}${args.modifier || ''}`).evaluate();
  }

  static prepareDamageItem(source, args, actor) {
    if (args.damage) return { damagedie: args.damage, damageAdd: '' };

    const obj = DSA5_Utility.toObjectIfPossible(source);
    const combatskills = actor.items.filter((x) => x.type == 'combatskill').map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), actor.system));
    if (source.type == 'rangeweapon') return Actordsa5._prepareRangeWeapon(obj, [], combatskills, actor);
    if (source.type == 'meleeweapon') return Actordsa5._prepareMeleeWeapon(obj, combatskills, actor);

    return source.system.traitType.value == 'meleeAttack' ? TraitData._prepareMeleetrait(obj, actor.system) : TraitData._prepareRangeTrait(obj, actor.system);
  }

  static async markWorkflowUsed(message, label) {
    if (message.content.includes('fa-check')) return;
    const marker = await TableTemplates.chatCheckMarker(label);
    await message.update({
      content: message.content.replace('</div>', `${marker}</div>`),
    });
  }

  static targetToken(speaker) {
    if (!speaker?.token) return undefined;
    const token = canvas.tokens.get(speaker.token);
    if (token) token.setTarget(true, { releaseOthers: true });
    return token;
  }

  static flag(message, path) {
    return getProperty(message, `flags.dsa5.${path}`);
  }
}
