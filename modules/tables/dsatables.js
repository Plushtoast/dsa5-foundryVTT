import DSA5 from '../config/config-dsa5.js';
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

    const table = DSA5.systemTables.find((x) => x.name == dataset.table);
    const tableResults = await DSATables.getRollTable(table.pack[game.i18n.lang], _loc(`TABLENAMES.${dataset.table}`), dataset);
    for (let tableResult of tableResults) {
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
    let effects = [];
    if (hasEffect && hasEffect.resistEffect) {
      const failEffects = Array.isArray(hasEffect.resistEffect.fail) ? hasEffect.resistEffect.fail : [hasEffect.resistEffect.fail];
      for (let fail of failEffects) {
        const ef = OnUseEffect.effectBaseDummy(fail.description, hasEffect.resistEffect.changes || [], hasEffect.resistEffect.duration || {});
        if (fail.systemEffect) {
          //todo add duration
          mergeObject(ef, {
            _id: 'botchEffect',
            flags: {
              dsa5: {
                hideOnToken: false,
                hidePlayers: false,
                advancedFunction: 2,
                args3: `await actor.addCondition("${fail.systemEffect}", ${fail.level || 1});`,
              },
            },
          });
        } else if (fail.command) {
          mergeObject(ef, {
            _id: 'botchEffect',
            flags: {
              dsa5: {
                hideOnToken: false,
                hidePlayers: false,
                advancedFunction: 2,
                args3: fail.command,
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

  static async finalizeEffect(ef) {
      if(ef.duration?.seconds) {
        ef.duration.seconds = (await new Roll(DSATables.#prepareRollString(`${ef.duration.seconds}`)).evaluate()).total;
      }
      else if (ef.duration?.rounds) {
        ef.duration.rounds = (await new Roll(DSATables.#prepareRollString(`${ef.duration.rounds}`)).evaluate()).total;
      }
      else if (ef.duration?.turns) {
        ef.duration.turns = (await new Roll(DSATables.#prepareRollString(`${ef.duration.turns}`)).evaluate()).total;
      }

      if (!ef.img) ef.img = 'icons/svg/aura.svg';
  }

  static #prepareRollString(rollBase) {
    return `${rollBase}`.replaceAll(/wW/g, 'd')
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
    return `, <a class="roll-button botch-roll" data-table="${table}" data-weaponless="${weaponless}" data-source="${source}" data-token="${speaker.token}" data-actor="${speaker.actor}" data-scene="${speaker.scene}"><i class="fas fa-dice"></i>${title}</a>`;
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
