import DSA5 from '../../config/config-dsa5.js';
import { ActorDialogBuilder } from '../actor-dialog-builder.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../../system/rolls/dice-dsa5.js';
import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

const optionRegex = /options=\{[0-9a-zA-ZöüäÖÜÄß: ",&;()+.-]+\}/;
const { mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class FallingDamageHelper {
  static CATEGORY = 'fallingDamage';

  static chatCompletionOption() {
    return { name: _loc('fallingDamage'), type: this.CATEGORY };
  }

  static isCategory(category) {
    return category === this.CATEGORY;
  }

  static isName(name) {
    return name === _loc('fallingDamage');
  }

  static requestOptionsFromDataset(dataset = {}) {
    const fallingHeight = Number(dataset.fallingHeight);
    const fallingFloor = Number(dataset.fallingFloor);
    return {
      ...(dataset.fallingHeight !== undefined && Number.isFinite(fallingHeight) ? { fallingHeight } : {}),
      ...(dataset.fallingFloor !== undefined && Number.isFinite(fallingFloor) ? { fallingFloor } : {}),
    };
  }

  static enrich(inner, customTextMatch) {
    const fallingDamage = this.#parseEnricher(inner);
    if (!fallingDamage) return null;

    return this.#createEnricherLink(fallingDamage, customTextMatch);
  }

  static async setup(actor, options = {}, tokenId) {
    const name = _loc('fallingDamage');
    const skill = actor.items.find((x) => x.type == 'skill' && x.name == _loc('LocalizedIDs.bodyControl')).toObject();
    const defaultOptions = {
      modifier: 0,
      messageMode: game.settings.get('core', 'messageMode'),
      subtitle: ` (${name})`,
      postFunction: {
        functionName: 'game.dsa5.entities.Actordsa5.updateFallingDamage',
        options,
        tokenId,
        speaker: ActorDialogBuilder.buildSpeaker(actor, tokenId),
      },
    };
    const testOptions = mergeObject(defaultOptions, {
      modifier: options.skillModifier ?? defaultOptions.modifier,
      messageMode: options.messageMode ?? defaultOptions.messageMode,
    });
    const setupData = await actor.setupSkill(skill, testOptions, tokenId);
    if (!setupData) return null;
    setupData.testData.opposable = false;
    const result = await actor.basicTest(setupData, { suppressMessage: true });
    if (!result) return null;
    await this.updateFallingDamage(testOptions.postFunction, result);
    await DiceDSA5.renderRollCard(result.cardOptions, result.result, result.options.rerenderMessage);
    return result;
  }

  static async updateFallingDamage(postFunction, result, source) {
    const actor = DSA5_Utility.getSpeaker(postFunction.speaker);
    const qlMultiplier = SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.tumbling') ? 3 : 2;
    const availableQs = (result.result.qualityStep || 0) * qlMultiplier;
    mergeObject(postFunction.options, {
      availableQs,
      qlMultiplier,
      tumbling: qlMultiplier > 2,
      reductionFormula: DiceDSA5.fallingDamageReductionFormula(qlMultiplier, availableQs),
    });
    const setupData = await this.#setupFallingHeight(actor, postFunction.options, postFunction.tokenId);
    const fallingDamage = await actor.basicTest(setupData, {
      suppressMessage: true,
    });
    fallingDamage.applyDamageInChat = game.settings.get('dsa5', 'applyDamageInChat');
    const html = await renderTemplate('systems/dsa5/templates/chat/roll/fallingdamage-card.hbs', fallingDamage);
    result.result.chatCardDamage = fallingDamage.result.damage;

    if (!result.result.other) result.result.other = [];

    result.result.other.push(html);

    if (result.chatData) {
      result.chatData.other = [html];
    }

    if (postFunction.options?.trapMessageUuid) {
      await game.dsa5.apps.TrapState?.postFallingDamage?.(postFunction, result);
    }
  }

  static #setupFallingHeight(actor, options, tokenId) {
    const title = _loc('fallingDamage');
    const testData = {
      source: {
        type: this.CATEGORY,
      },
      opposable: false,
      extra: {
        options,
        speaker: ActorDialogBuilder.buildSpeaker(actor, tokenId),
      },
    };

    const situationalModifiers = [];
    const qlMultiplier = options.qlMultiplier || 2;
    const availableQs = options.availableQs || 0;
    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/fallingdamage-dialog.hbs',
      data: {
        messageMode: options.messageMode,
        situationalModifiers,
        fallingFloorOptions: DSA5.fallingConditions,
        modifier: options.fallingHeight || options.modifier || 1,
        fallingFloor: options.fallingFloor ?? 0,
        tumbling: options.tumbling,
        qlMultiplier,
        availableQs,
        reductionFormula: options.reductionFormula || DiceDSA5.fallingDamageReductionFormula(qlMultiplier, availableQs),
      },
      callback: (html, options = {}) => {
        testData.situationalModifiers = [
          {
            name: _loc('fallingFloor'),
            value: html.find('[name="fallingFloor"]').val(),
          },
        ];
        cardOptions.messageMode = html.find('[name="messageMode"]:checked').val();
        testData.fallingHeight = Math.max(1, Number(html.find('[name="testModifier"]').val()) || 1);
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = ActorDialogBuilder._setupCardOptions(
      'systems/dsa5/templates/chat/roll/fallingdamage-card.hbs',
      title,
      tokenId,
      actor,
    );

    return DiceDSA5.setupDialog({
      dialogOptions,
      testData,
      cardOptions,
    });
  }

  static #parseEnricher(inner) {
    const content = inner.replace(optionRegex, '').trim();
    const name = _loc('fallingDamage');
    if (content.slice(0, name.length).toLowerCase() !== name.toLowerCase()) return null;

    const remainder = content.slice(name.length);
    if (remainder && !/^[,\s]/.test(remainder)) return null;

    const parameters = remainder.replace(/^[,\s]+/, '').split(/[,\s]+/).filter(Boolean);
    if (parameters.length > 3 || parameters.some((value) => !/^[+-]?\d+$/.test(value))) return null;

    const [modifier = '0', height, floor] = parameters;
    const fallingHeight = height === undefined ? undefined : Number(height);
    const fallingFloor = floor === undefined ? undefined : Number(floor);

    if (fallingHeight !== undefined && fallingHeight < 1) return null;
    if (fallingFloor !== undefined && !Object.hasOwn(DSA5.fallingConditions, fallingFloor)) return null;

    return { modifier: Number(modifier), fallingHeight, fallingFloor };
  }

  static #createEnricherLink(fallingDamage, customTextMatch) {
    const name = _loc('fallingDamage');
    const customText = customTextMatch ? customTextMatch.replace(/[{}]/g, '') : undefined;
    const parameterLabel = [
      fallingDamage.fallingHeight,
      fallingDamage.fallingFloor === undefined ? undefined : `${fallingDamage.fallingFloor > 0 ? '+' : ''}${fallingDamage.fallingFloor}`,
    ].filter((value) => value !== undefined).join(', ');
    const label = customText
      ? `${customText}${this.#formatModifier(fallingDamage.modifier)}`
      : `${name}${this.#formatModifier(fallingDamage.modifier)}${parameterLabel ? `, ${parameterLabel}` : ''}`;
    const { escapeHTML } = foundry.utils;
    const fallingHeightAttribute =
      fallingDamage.fallingHeight === undefined ? '' : ` data-falling-height="${fallingDamage.fallingHeight}"`;
    const fallingFloorAttribute =
      fallingDamage.fallingFloor === undefined ? '' : ` data-falling-floor="${fallingDamage.fallingFloor}"`;

    return $(
      `<a class="roll-button request-roll" data-tooltip="${_loc('TT.enricherRq')}" data-type="skill" data-modifier="${fallingDamage.modifier}" data-name="${escapeHTML(name)}" data-label="${escapeHTML(label)}"${fallingHeightAttribute}${fallingFloorAttribute}><em class="fas fa-dice"></em>${escapeHTML(label)}</a>`,
    )[0];
  }

  static #formatModifier(modifier) {
    if (modifier < 0) return ` ${modifier}`;
    if (modifier > 0) return ` +${modifier}`;
    return '';
  }
}
