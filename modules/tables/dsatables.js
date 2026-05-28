import DSA5 from '../config/config-dsa5.js';
import DSAActiveEffectDataModel from '../data/activeeffect/dsaeffect.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';

const { getProperty, mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class DSATables {
  static async showBotchCard(dataset, options = {}) {
    options.speaker = {
      token: dataset.token,
      actor: dataset.actor,
      scene: dataset.scene,
    };
    options.source = dataset.source;
    options.table = dataset.table;
    options.tableContext = DSATables.#decodeBotchContext(dataset.context);

    const table = DSA5.systemTables.find((x) => x.name == dataset.table);
    const tableResults = await DSATables.getRollTable(table.pack[game.i18n.lang], _loc(`TABLENAMES.${dataset.table}`), dataset);
    for (const tableResult of tableResults) {
      const hasEffect = options.speaker ? await DSATables.hasEffect(tableResult) : false;
      const result = DSA5_Utility.replaceDies(DSA5_Utility.replaceConditions(tableResult.results[0].description));
      const title = `${_loc('TABLENAMES.' + dataset.table)}`;

      const content = await renderTemplate('systems/dsa5/templates/tables/tableCard.hbs', { result, title, hasEffect });

      const effects = await this.buildEffects(tableResult, hasEffect);

      ChatMessage.create({
        user: game.user.id,
        content,
        whisper: options.whisper,
        blind: options.blind,
        flags: {
          data: {
            preData: {
              source: {
                effects,
              },
              extra: {
                actor: { id: options.speaker.actor },
                speaker: options.speaker,
              },
              situationalModifiers: [],
            },
            postData: {},
          },
          dsa5: {
            hasEffect,
            options,
          },
        },
      });
    }
  }

  static async hasEffect(tableResult) {
    return getProperty(tableResult.results[0], 'flags.dsa5') || false;
  }

  static async buildEffects(tableResult, hasEffect) {
    const effects = [];
    if (hasEffect && hasEffect.resistEffect) {
      const failEffects = DSATables.#normalizeFailEffects(hasEffect.resistEffect.fail);
      for (const fail of failEffects) {
        const ef = OnUseEffect.effectBaseDummy(fail.description || _loc('botchCritEffect'), hasEffect.resistEffect.changes || [], fail.duration || hasEffect.resistEffect.duration || {});
        ef._id = 'botchEffect';
        if (fail.systemEffect) {
          mergeObject(ef, {
            system: {
              advancedFunction: DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.SYSTEM_EFFECT,
              macroArgs: {
                conditionId: fail.systemEffect,
                conditionValue: `${fail.level || 1}`,
              },
              visibility: {
                hideOnToken: false,
                hidePlayers: false,
              },
            },
          });
        } else if (fail.damage) {
          mergeObject(ef, {
            system: {
              advancedFunction: DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.MACRO,
              macroArgs: {
                macro: DSATables.#damageMacro(fail.damage),
              },
              visibility: {
                hideOnToken: false,
                hidePlayers: false,
              },
            },
          });
        } else if (fail.command) {
          mergeObject(ef, {
            system: {
              advancedFunction: DSAActiveEffectDataModel.ADVANCED_FUNCTION_INDEXES.MACRO,
              macroArgs: {
                macro: fail.command,
              },
              visibility: {
                hideOnToken: false,
                hidePlayers: false,
              },
            },
          });
        }
        await DSATables.finalizeEffect(ef);
        effects.push(ef);
      }
    }
    return effects;
  }

  static #normalizeFailEffects(failEffects) {
    if (!failEffects) return [];
    return (Array.isArray(failEffects) ? failEffects : [failEffects]).filter(Boolean);
  }

  static #damageMacro(formula) {
    return `await actor.applyDamage(${JSON.stringify(formula)}, { msg: 'fallingDamage' });`;
  }

  static async finalizeEffect(ef) {
      if (ef.duration?.value) {
        ef.duration.value = (await new Roll(DSATables.#prepareRollString(`${ef.duration.value}`)).evaluate()).total;
      } else if (ef.duration?.seconds) {
        ef.duration.value = (await new Roll(DSATables.#prepareRollString(`${ef.duration.seconds}`)).evaluate()).total;
        ef.duration.units = 'seconds';
        delete ef.duration.seconds;
      } else if (ef.duration?.rounds) {
        ef.duration.value = (await new Roll(DSATables.#prepareRollString(`${ef.duration.rounds}`)).evaluate()).total;
        ef.duration.units = 'rounds';
        delete ef.duration.rounds;
      } else if (ef.duration?.turns) {
        ef.duration.value = (await new Roll(DSATables.#prepareRollString(`${ef.duration.turns}`)).evaluate()).total;
        ef.duration.units = 'turns';
        delete ef.duration.turns;
      }

      if (!ef.img) ef.img = 'icons/svg/aura.svg';
  }

  static #prepareRollString(rollBase) {
    return `${rollBase}`.replaceAll(/[wW]/g, 'd')
  }

  static async getRollTable(packName, name, options = {}) {
    const pack = game.packs.get(packName);
    const table = (await pack.getDocuments({ name__in: [name] }))[0];
    let result = await table.draw({ displayChat: false });
    if (options.weaponless == 'true' && result.roll.total < 7) {
      result.roll.editRollAtIndex([{ index: 0, val: result.roll.total + 5 }]);
      result = await table.draw({ displayChat: false, roll: result.roll });
    }
    return [result];
  }

  static async tableEnabledFor(key) {
    const table = DSA5.systemTables.find((x) => x.name == key);
    return table ? game.settings.get(table.setting.module, table.setting.key) : false;
  }

  static rollCritBotchButton(table, weaponless, testData) {
    const title = _loc(`TABLENAMES.${table}`);
    const speaker = testData.extra.speaker;
    const source = testData.source._id;
    const context = encodeURIComponent(JSON.stringify(DSATables.#buildBotchContext(testData, table)));
    return `, <a class="roll-button botch-roll" data-table="${table}" data-weaponless="${weaponless}" data-source="${source}" data-token="${speaker.token}" data-actor="${speaker.actor}" data-scene="${speaker.scene}" data-context="${context}"><i class="fas fa-dice"></i>${title}</a>`;
  }

  static #buildBotchContext(testData, table) {
    return {
      table,
      speaker: testData.extra.speaker,
      targets: Array.from(game.user.targets).map((target) => DSATables.#speakerFromToken(target)).filter(Boolean),
      attacker: DSATables.#speakerFromMessage(testData.attackerMessage),
      defenders: DSATables.#speakersFromMessages(testData.defenderMessage),
      attackerMessage: testData.attackerMessage,
      defenderMessage: testData.defenderMessage,
      isOpposedTest: testData.isOpposedTest,
    };
  }

  static #decodeBotchContext(context) {
    if (!context) return {};
    try {
      return JSON.parse(decodeURIComponent(context));
    } catch (exception) {
      console.warn('Could not parse table effect context', context, exception);
      return {};
    }
  }

  static #speakerFromToken(target) {
    if (!target?.actor) return undefined;
    return {
      token: target.id,
      actor: target.actor.id,
      scene: target.scene?.id || canvas.scene?.id,
    };
  }

  static #speakerFromMessage(messageId) {
    const message = messageId ? game.messages.get(messageId) : undefined;
    return getProperty(message, 'flags.data.preData.extra.speaker') || message?.speaker;
  }

  static #speakersFromMessages(messageIds) {
    const ids = messageIds ? Array.from(messageIds instanceof Set ? messageIds : Array.isArray(messageIds) ? messageIds : [messageIds]) : [];
    return ids.map((messageId) => DSATables.#speakerFromMessage(messageId)).filter(Boolean);
  }

  static async defaultBotch() {
    return ', ' + _loc('selfDamage') + (await new Roll('1d6+2').evaluate()).total;
  }

  static defaultAttackCrit(confirmed) {
    let res = ', ' + _loc('halfDefense');
    if (confirmed) res += ', ' + _loc('doubleDamage', { x: 2 });
    return res;
  }

  static defaultParryCrit() {
    return ', ' + _loc('attackOfOpportunity');
  }
}
