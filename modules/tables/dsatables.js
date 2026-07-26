import DSA5 from '../config/config-dsa5.js';
import DSAActiveEffectDataModel from '../data/activeeffect/dsaeffect.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import EffectDuration from '../status/effectDuration.js';
import TestModuleLoader from '../tests/testModuleLoader.js';
import TableEffectHelpers from './tableEffectHelpers.js';
import TableTemplates from './tableTemplates.js';
import { damageMacro, normalizeList } from './tableEffectUtils.js';

const TABLE_EFFECT_RUNTIME_TESTS = 'tableEffectRuntime';

TestModuleLoader.register(TABLE_EFFECT_RUNTIME_TESTS, {
  url: 'systems/dsa5/modules/tests/tableEffectRuntimeTests.js',
});

const { getProperty, mergeObject } = foundry.utils;

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
    if (!table) return;

    if (await DSATables.tableEnabledFor(dataset.table)) {
      const tableResults = await DSATables.getRollTable(table.pack[game.i18n.lang], _loc(`TABLENAMES.${dataset.table}`), dataset);
      for (const tableResult of tableResults) {
        await DSATables.#createBotchCardFromTableResult(tableResult, options);
      }
    } else if (table.defaultResult) {
      await DSATables.#createBotchCardFromDefault(table.defaultResult, options);
    }
  }

  static async hasEffect(tableResult) {
    return getProperty(tableResult.results[0], 'flags.dsa5') || false;
  }

  static async buildEffects(tableResult, hasEffect) {
    const effects = [];
    if (hasEffect && hasEffect.resistEffect) {
      const failEffects = normalizeList(hasEffect.resistEffect.fail);
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
                macro: damageMacro(fail.damage),
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
        await EffectDuration.finalizeEffect(ef);
        effects.push(ef);
      }
    }
    return effects;
  }

  static finalizeEffect(effect) {
    return EffectDuration.finalizeEffect(effect);
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
    if (!table?.setting?.module) return false;
    return game.settings.get(table.setting.module, table.setting.key);
  }

  static rollCritBotchButton(table, weaponless, testData) {
    const title = _loc(`TABLENAMES.${table}`);
    const speaker = testData.extra.speaker;
    const source = testData.source._id;
    const context = encodeURIComponent(JSON.stringify(TableEffectHelpers.buildBotchContext(testData, table)));
    return `, <a class="roll-button botch-roll" data-table="${table}" data-weaponless="${weaponless}" data-source="${source}" data-token="${speaker.token}" data-actor="${speaker.actor}" data-scene="${speaker.scene}" data-context="${context}"><i class="fas fa-dice"></i>${title}</a>`;
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

  static async #createBotchCardFromTableResult(tableResult, options) {
    const hasEffect = options.speaker ? await DSATables.hasEffect(tableResult) : false;
    const result = DSA5_Utility.replaceDies(DSA5_Utility.replaceConditions(tableResult.results[0].description));
    const title = _loc(`TABLENAMES.${options.table}`);

    await DSATables.#postBotchCard({ title, result, hasEffect, options });
  }

  static async #createBotchCardFromDefault(defaultResult, options) {
    const hasEffect = defaultResult.effects || false;
    const damageFormula = hasEffect?.selfDamage?.damage;
    const previewTotal = damageFormula ? (await new Roll(damageFormula).evaluate()).total : '';
    const result = `${_loc(defaultResult.description)}${previewTotal}`;

    await DSATables.#postBotchCard({
      title: _loc(`TABLENAMES.${options.table}`),
      result,
      hasEffect,
      options,
    });
  }

  static async #postBotchCard({ title, result, hasEffect, options }) {
    const content = await TableTemplates.tableCard({ result, title, hasEffect });
    const effects = await DSATables.buildEffects(undefined, hasEffect);

    return ChatMessage.create({
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

  static defaultAttackCrit(confirmed) {
    let res = ', ' + _loc('halfDefense');
    if (confirmed) res += ', ' + _loc('doubleDamage', { x: 2 });
    return res;
  }

  static defaultParryCrit() {
    return ', ' + _loc('attackOfOpportunity');
  }

  static async runRuntimeTests(options = {}) {
    const Runner = await TestModuleLoader.load(TABLE_EFFECT_RUNTIME_TESTS);
    return Runner.run(options);
  }

  static getTestLoadStates() {
    return TestModuleLoader.getLoadStates();
  }
}
