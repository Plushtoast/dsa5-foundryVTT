import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import TableEffectHelpers from './tableEffectHelpers.js';
import TableTemplates from './tableTemplates.js';

const { getProperty } = foundry.utils;

export default class TableEffectContext {
  constructor({ message, mode, options = {}, speaker, applyTargets = [], source, tableContext = {} }) {
    this.message = message;
    this.messageId = message?.id;
    this.mode = mode;
    this.options = options;
    this.speaker = speaker;
    this.applyTargets = applyTargets.filter(Boolean);
    this.source = source;
    this.table = tableContext.table || options.table;
    this.attacker = tableContext.attacker;
    this.defenders = tableContext.defenders || [];
    this.contextTargets = tableContext.targets || [];
  }

  static fromApply(messageId, mode) {
    const message = game.messages.get(messageId);
    const hasEffect = getProperty(message, 'flags.dsa5.hasEffect');
    const options = getProperty(message, 'flags.dsa5.options') || {};
    if (!message || !hasEffect) return undefined;

    let applyTargets = [];
    let source = undefined;
    let speaker = DSA5_Utility.getSpeaker(options.speaker);
    if (!speaker && options.speaker?.actor) speaker = game.actors.get(options.speaker.actor);

    if (mode == 'self') {
      if (speaker) applyTargets.push(speaker);
      if (options.source && speaker) source = speaker.items.get(options.source);
    } else {
      applyTargets = Array.from(game.user.targets).map((token) => token.actor).filter(Boolean);
    }

    const tableContext = TableEffectHelpers.buildEffectContext(options, speaker);
    return new TableEffectContext({ message, mode, options, speaker, applyTargets, source, tableContext });
  }

  static fromHandler({ message, mode, applyTargets = [], source, context = {} }) {
    return new TableEffectContext({
      message,
      mode,
      options: context.options || {},
      speaker: context.speaker,
      applyTargets,
      source,
      tableContext: context,
    });
  }

  get flagPayload() {
    return getProperty(this.message, 'flags.dsa5.hasEffect') || {};
  }

  targetResolutionContext() {
    return {
      speaker: this.speaker,
      targets: this.contextTargets,
      contextTargets: this.contextTargets,
      attacker: this.attacker,
      defenders: this.defenders,
      table: this.table,
    };
  }

  resolveTargets(args = {}) {
    return TableEffectHelpers.evaluateTargetArg(args, this.applyTargets, this.targetResolutionContext());
  }

  async appendRollToMessage(roll) {
    const rollHtml = await roll.render();
    if (!this.message) {
      await ChatMessage.create(DSA5_Utility.chatDataSetup(rollHtml));
      return;
    }

    let content = this.message.content;
    const diceRollPattern = /<div class="dice-roll">[\s\S]*?<\/div>/;
    if (diceRollPattern.test(content)) content = content.replace(diceRollPattern, rollHtml);
    else {
      content = content.replace(
        /(<div class=['"]card-content hideAnchor['"]>[\s\S]*?)(<\/div>)/,
        `$1${rollHtml}$2`,
      );
    }

    this.message = await this.message.update({ content });
  }

  async markApplied() {
    if (!this.message) return;
    const message = game.messages.get(this.message.id) ?? this.message;
    const tt = _loc('ActiveEffects.appliedEffect', {
      source: _loc('table'),
      target: this.applyTargets.map((actor) => actor.name).join(', '),
    });
    const marker = TableTemplates.chatCheckMarker(tt);
    this.message = await message.update({
      content: message.content.replace(/hideAnchor">/, `hideAnchor">${marker}`),
    });
  }
}
