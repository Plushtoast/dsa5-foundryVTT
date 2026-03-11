import DSA5_Utility from '../helpers/utility-dsa5.js';
import DiceDSA5 from './dice-dsa5.js';
import { ReactToAttackDialog, ReactToSkillDialog } from '../../dialog/dialog-react.js';
import Actordsa5 from '../../actor/actor-dsa5.js';
import EquipmentDamage from '../automation/equipment-damage.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import Itemdsa5 from '../../item/item-dsa5.js';
import DSATriggers from '../automation/triggers.js';

const { mergeObject, getProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * @typedef {Object} OpposedTestResult
 * @property {string} winner - The winner of the opposed test ('attacker' or 'defender')
 * @property {Array<string>} other - Additional result information
 * @property {number} [differenceSL] - Difference in success levels
 * @property {Object} [damage] - Damage information if applicable
 * @property {string} [result] - Formatted result string
 * @property {string} [img] - Winner's image
 * @property {Object} speakerAttack - Attacker's speaker data
 * @property {Object} speakerDefend - Defender's speaker data
 */

/**
 * @typedef {Object} TestResult
 * @property {number} successLevel - Success level of the test
 * @property {number} qualityStep - Quality step of the test
 * @property {number} result - Raw test result
 * @property {string} rollType - Type of roll performed
 * @property {number} [damage] - Damage value if applicable
 * @property {boolean} [doubleDamage] - Whether damage should be doubled
 * @property {Array<string>} [armorPen] - Armor penetration modifiers
 * @property {Object} source - Source item of the test
 * @property {Object} [ammo] - Ammunition data if applicable
 * @property {boolean} [counterAttack] - Whether this is a counter attack
 */

/**
 * @typedef {Object} CombatantData
 * @property {Object} speaker - Speaker information
 * @property {TestResult} testResult - Test result data
 * @property {string} messageId - Associated message ID
 * @property {string} [img] - Combatant's image
 */

/**
 * Handles opposed test resolution in the DSA5 system
 * Manages attack/defense interactions, damage calculation, and result presentation
 */
export default class OpposedDsa5 {
  /**
   * Main entry point for handling opposed test targets and messages
   * Routes different types of opposed test scenarios to appropriate handlers
   * @param {ChatMessage} message - The chat message triggering the opposed test
   * @returns {Promise<void>}
   */
  static async handleOpposedTarget(message) {
    if (!message) return;

    const actor = DSA5_Utility.getSpeaker(message.speaker) ?? await OpposedDsa5.rebuildEmptyActor(message);

    if (!actor) return;

    const testResult = message.flags.data.postData;
    const preData = message.flags.data.preData;

    if (actor.flags.oppose) {
      // DEFEND - Actor is responding to an attack
      OpposedDsa5.answerOpposedTest(actor, message, testResult, preData);
    } else if (game.user.targets.size && message.flags.data.isOpposedTest && !message.flags.data.defenderMessage && !message.flags.data.attackerMessage) {
      // ATTACK - Actor is initiating an attack against targets
      OpposedDsa5.createOpposedTest(actor, message, testResult, preData);
    } else if (message.flags.data.defenderMessage || message.flags.data.attackerMessage) {
      // NOT DEFEND - Resolving final opposed test results
      OpposedDsa5.resolveFinalMessage(message);
    } else if (message.flags.data.unopposedStartMessage) {
      // EDIT NOT DEFEND - Re-doing an undefended test
      OpposedDsa5.redoUndefended(message);
    } else if (message.flags.data.startMessagesList) {
      // EDIT - Changing start message data
      OpposedDsa5.changeStartMessage(message);
    } else {
      // DMG ONLY ROLL - Handle damage-only scenarios
      await this.showDamage(message);
      await this.showSpellWithoutTarget(message);
    }
  }

  /**
   * Rebuilds an empty actor from message data when original actor is not available
   * Used for tests where the original actor context has been lost
   * @param {ChatMessage} message - The message containing actor rebuild data
   * @returns {Promise<Actor|null>} The rebuilt actor or null if not rebuildable
   */
  static async rebuildEmptyActor(message) {
    if (message.flags?.data?.preData?.extra?.speaker?.token == 'emptyActor') {
      return DSA5_Utility.emptyActor(12, message.flags?.data?.preData?.source?.name);
    }
  }

  /**
   * Redoes an undefended opposed test with updated message data
   * @param {ChatMessage} message - The message containing the redo request
   * @returns {void}
   */
  static async redoUndefended(message) {
    let startMessage = game.messages.get(message.flags.data.unopposedStartMessage);
    startmessage.flags.unopposeData.attackMessageId = message.id;
    this.resolveUndefended(startMessage);
  }

  /**
   * Handles the response from a defending actor to an opposed test
   * Combines attacker and defender data and processes the opposed test result
   * @param {Actor} actor - The defending actor
   * @param {ChatMessage} message - The defender's test message
   * @param {TestResult} testResult - The defender's test result
   * @param {Object} preData - Pre-test data from the defender
   * @returns {Promise<void>}
   */
  static async answerOpposedTest(actor, message, testResult, preData) {
    const attackMessage = game.messages.get(actor.flags.oppose.messageId);
    if (!attackMessage) {
      ui.notifications.error('DSAError.staleData', { localize: true });
      await OpposedDsa5.clearOpposed(actor);
      return OpposedDsa5.createOpposedTest(actor, message, testResult, preData);
    }
    const attacker = {
      speaker: actor.flags.oppose.speaker,
      testResult: attackMessage.flags.data.postData,
      messageId: attackMessage.id,
      img: DSA5_Utility.getSpeaker(actor.flags.oppose.speaker)?.img,
    };
    attacker.testResult.source = attackMessage.flags.data.preData.source;

    OpposedDsa5.combine_effects(attacker, attackMessage.flags.data.preData);

    const defender = {
      speaker: message.speaker,
      testResult,
      messageId: message.id,
      img: actor.msg,
    };

    defender.testResult.source = message.flags.data.preData.source;

    const listOfDefenders = attackMessage.flags.data.defenderMessage ? Array.from(attackMessage.flags.data.defenderMessage) : [];
    listOfDefenders.push(message.id);

    if (game.user.isGM) await attackMessage.update({ 'flags.data.defenderMessage': listOfDefenders, });

    await message.update({ 'flags.data.attackerMessage': attackMessage.id });

    await this.completeOpposedProcess(attacker, defender, {
      target: true,
      startMessageId: actor.flags.oppose.startMessageId,
      whisper: message.whisper,
      blind: message.blind,
    });
    await OpposedDsa5.clearOpposed(actor);
  }

  /**
   * Creates an appropriate HTML tag for displaying media (video or image)
   * Returns video tag for .webm files, image tag for others
   * @param {string} path - The file path to the media
   * @returns {string} HTML tag for displaying the media
   */
  static videoOrImgTag(path) {
    if (/\.webm$/.test(path)) {
      return `<video loop autoplay src="${path}" width="50" height="50"></video>`;
    }
    return `<img src="${path}" width="50" height="50"/>`;
  }

  /**
   * Creates an opposed test scenario when an attacker targets one or more defenders
   * Handles both successful attacks and damage-only scenarios
   * @param {Actor} actor - The attacking actor
   * @param {ChatMessage} message - The attacker's test message
   * @param {TestResult} testResult - The attacker's test result
   * @param {Object} preData - Pre-test data from the attacker
   * @returns {Promise<void>}
   */
  static async createOpposedTest(actor, message, testResult, preData) {
    let attacker;

    if (message.speaker.token) attacker = canvas.tokens.get(message.speaker.token).document;
    else attacker = actor.prototypeToken;

    const isDamageRoll = testResult.options?.mode == 'damage';

    if (testResult.successLevel > 0 || isDamageRoll) {
      const attackOfOpportunity = message.flags.data.preData.attackOfOpportunity;
      let unopposedButton = attackOfOpportunity
        ? ''
        : `<div class="flexrow"><button class="unopposed-button small-button chat-button-target" data-target="true">${_loc('Unopposed')}</button></div>`;
      let startMessagesList = [];

      for (const target of game.user.targets) {
        if (target.actor) {
          const content = `${OpposedDsa5.opposeMessage(attacker, target, false)} ${unopposedButton}`;
          let startMessage = await ChatMessage.create({
            user: game.user.id,
            content,
            speaker: message.speaker,
            ['flags.unopposeData']: {
              attackMessageId: message.id,
              targetSpeaker: {
                scene: target.scene.id,
                token: target.id,
                alias: target.document.name,
              },
            },
          });

          const opposeFlag = {
            speaker: message.speaker,
            messageId: message.id,
            startMessageId: startMessage.id,
          };

          if (!game.user.isGM) {
            game.socket.emit('system.dsa5', {
              type: 'target',
              payload: {
                target: target.id,
                scene: target.scene?.id || canvas.scene?.id,
                opposeFlag,
              },
            });
          } else {
            await target.actor.update({ 'flags.oppose': opposeFlag });
          }
          startMessagesList.push(startMessage.id);
          if (attackOfOpportunity) {
            await OpposedDsa5.resolveUndefended(startMessage, _loc('OPPOSED.attackOfOpportunity'));
          } else if (isDamageRoll) {
            await OpposedDsa5.resolveUndefended(startMessage);
          }
          Hooks.call('DSAOpposedRollStart', target);
        }
      }
      message.flags.data.startMessagesList = startMessagesList;
    } else {
      for (const target of game.user.targets) {
        if (target.actor) {
          await ChatMessage.create({
            user: game.user.id,
            content: OpposedDsa5.opposeMessage(attacker, target, true),
            speaker: message.speaker,
          });
        }
      }
    }
  }

  /**
   * Generates HTML content for the opposed test message display
   * Shows attacker vs target with appropriate status and visual elements
   * @param {TokenDocument} attacker - The attacking token
   * @param {Token} target - The target token
   * @param {boolean} fail - Whether the attack failed
   * @returns {string} HTML content for the oppose message
   */
  static opposeMessage(attacker, target, fail) {
    return `<div class="opposed-message">
            <b>${attacker.name}</b> ${_loc('ROLL.Targeting')} <b>${target.document.name}</b> ${fail ? _loc('ROLL.failed') : ''}
            </div>
            <div class="opposed-tokens row-section">
                <div class="col two attacker">${OpposedDsa5.videoOrImgTag(attacker.texture.src)}</div>
                <div class="col two defender">${OpposedDsa5.videoOrImgTag(target.document.texture.src)}</div>
            </div>
             `;
  }

  /**
   * Updates start messages when the main message data changes
   * Synchronizes target and oppose flags across related messages
   * @param {ChatMessage} message - The message with updated data
   * @returns {Promise<void>}
   * @todo Check if this method is still needed in current implementation
   */
  static async changeStartMessage(message) {
    for (let startMessageId of message.flags.data.startMessagesList) {
      let startMessage = game.messages.get(startMessageId);
      let data = startMessage.flags.unopposeData;

      game.socket.emit('system.dsa5', {
        type: 'target',
        payload: {
          target: data.targetSpeaker.token,
          scene: canvas.scene.id,
          opposeFlag: {
            speaker: message.speaker,
            messageId: message.id,
            startMessageId: startMessage.id,
          },
        },
      });
      await startMessage.update({
        'flags.unopposeData.attackMessageId': message.id,
      });
    }
  }

  /**
   * Resolves and displays the final result of an opposed test
   * Processes either attacker or defender message to complete the opposed test
   * @param {ChatMessage} message - The final message in the opposed test sequence
   * @returns {void}
   */
  static resolveFinalMessage(message) {
    let attacker, defender;
    if (message.flags.data.defenderMessage) {
      for (let msg of message.flags.data.defenderMessage) {
        attacker = OpposedDsa5.getMessageDude(message);
        let defenderMessage = game.messages.get(msg);
        defender = OpposedDsa5.getMessageDude(defenderMessage);
        this.completeOpposedProcess(attacker, defender, {
          blind: message.blind,
          whisper: message.whisper,
        });
      }
    } else {
      defender = OpposedDsa5.getMessageDude(message);
      let attackerMessage = game.messages.get(message.flags.data.attackerMessage);
      attacker = OpposedDsa5.getMessageDude(attackerMessage);
      this.completeOpposedProcess(attacker, defender, {
        blind: message.blind,
        whisper: message.whisper,
      });
    }
  }

  /**
   * Extracts combatant data from a chat message for opposed test processing
   * Combines test results with speaker and source information
   * @param {ChatMessage} message - The message containing test data
   * @returns {CombatantData} Formatted combatant data for opposed test
   */
  static getMessageDude(message) {
    let res = {
      speaker: message.speaker,
      testResult: mergeObject(message.flags.data.postData, {
        source: message.flags.data.preData.source,
      }),
      img: DSA5_Utility.getSpeaker(message.speaker).img,
      messageId: message.id,
    };
    if (res.testResult.ammo) res.testResult.source.effects.push(...res.testResult.ammo.effects);
    return res;
  }

  /**
   * Shows or hides damage information in chat messages
   * Handles GM-only damage display and dice animation integration
   * @param {ChatMessage} message - The message containing damage data
   * @param {boolean} [hide=false] - Whether to hide the damage display
   * @returns {Promise<void>}
   */
  static async showDamage(message, hide = false) {
    if (game.user.isGM) {
      if ((!hide || !message.flags.data.hideDamage) && message.flags.data.postData.damageRoll) {
        await message.update({
          content: message.content.replace(`data-hide-damage="${!hide}"`, `data-hide-damage="${hide}"`),
          'flags.data.hideDamage': hide,
        });
        if (!hide)
          DiceDSA5._addRollDiceSoNice(
            message.flags.data.preData,
            Roll.fromData(message.flags.data.postData.damageRoll),
            game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration('damage'),
          );
      }
    } else {
      game.socket.emit('system.dsa5', {
        type: 'showDamage',
        payload: {
          id: message.id,
          hide: hide,
        },
      });
    }
  }

  /**
   * Integrates with JB2A (AutoAnimations) module for automated combat animations
   * Plays appropriate animations based on opposed test results
   * @param {CombatantData} attacker - The attacking combatant data
   * @param {CombatantData} defender - The defending combatant data
   * @param {OpposedTestResult} opposedResult - The result of the opposed test
   * @returns {Promise<void>}
   */
  static async playAutomatedJBA2(attacker, defender, opposedResult) {
    if (DSA5_Utility.moduleEnabled('autoanimations')) {
      //const attackerToken = canvas.tokens.get(attacker.speaker.token)
      const attackerToken = DSA5_Utility.getSpeaker(attacker.speaker).getActiveTokens()[0];
      const defenderToken = DSA5_Utility.getSpeaker(defender.speaker).getActiveTokens()[0];
      if (!attackerToken || !attackerToken.actor || !defenderToken || !defenderToken.actor) {
        return;
      }
      let item = attackerToken.actor.items.get(attacker.testResult.source._id);
      if (!item) item = new Itemdsa5(attacker.testResult.source);
      if (!item) return;

      item = item.toObject();

      const targets = [defenderToken];
      const isHit = opposedResult.winner == 'attacker';
      const hitTargets = isHit ? targets : [];
      const isCrit = attacker.testResult.successLevel > 1 && isHit;
      const isBotch = attacker.testResult.successLevel < 1 && !isHit;
      const isParryCrit = defender.testResult.successLevel > 1 && !isHit;
      const isParryBotch = defender.testResult.successLevel < 1 && isHit;

      const items = [];
      const str = [];

      if (isCrit) {
        str.push(_loc('CriticalSuccess'));
      } else if (isBotch) {
        str.push(_loc('CriticalFailure'));
      } else if (isParryCrit) {
        str.push(`${_loc('CHAR.PARRY')} ${_loc('CriticalSuccess')}`);
      } else if (isParryBotch) {
        str.push(`${_loc('CHAR.PARRY')} ${_loc('CriticalFailure')}`);
      }

      if (!isHit) {
        str.push(_loc('CHAR.PARRY'));
      }

      for (let st of str) {
        items.push({ name: `${item.name} (${st})` }, { name: st });
      }
      items.push(item);
      for (let it of items) {
        const result = await AutomatedAnimations.playAnimation(attackerToken, it, { targets, hitTargets, playOnMiss: true });
        if (result) break;
      }
    }
  }

  /**
   * Displays spell animations for spells cast without specific targets
   * Integrates with AutoAnimations module for visual effects
   * @param {ChatMessage} message - The message containing spell data
   * @returns {Promise<void>}
   */
  static async showSpellWithoutTarget(message) {
    if (DSA5_Utility.moduleEnabled('autoanimations')) {
      const msgData = getProperty(message, 'flags.data');
      if (!msgData || msgData.isOpposedTest) return;

      const result = getProperty(msgData, 'postData.result') || -1;
      if (result > 0) {
        const attackerToken = DSA5_Utility.getSpeaker(msgData.postData.speaker).getActiveTokens()[0];
        if (!attackerToken || !attackerToken.actor) return;

        let targets = Array.from(game.user.targets);
        const item = attackerToken.actor.items.get(msgData.preData.source._id);
        if (!targets.length) targets = [attackerToken];

        AutomatedAnimations.playAnimation(attackerToken, item, { targets });
      }
    }
  }

  /**
   * Clears the opposed test flag from an actor
   * Removes the targeting state when opposed test is completed or cancelled
   * @param {Actor} actor - The actor to clear opposed flags from
   * @returns {Promise<void>}
   */
  static async clearOpposed(actor) {
    if (game.user.isGM) {
      await actor.update({ 'flags.oppose': _del });
    } else {
      game.socket.emit('system.dsa5', {
        type: 'clearOpposed',
        payload: {
          actorId: actor.id,
        },
      });
    }
  }

  /**
   * Handles reaction events for different types of opposed tests
   * Opens appropriate reaction dialogs based on the source type
   * @param {Event} ev - The click event from the reaction button
   * @returns {Promise<void>}
   */
  static async _handleReaction(ev) {
    let messageId = $(ev.currentTarget).parents('.message').attr('data-message-id');
    let message = game.messages.get(messageId);
    let attackMessage = game.messages.get(message.flags.unopposeData.attackMessageId);
    let source = attackMessage.flags.data.preData.source;
    switch (source.type) {
      case 'skill':
        ReactToSkillDialog.showDialog(message);
        break;
      default:
        ReactToAttackDialog.showDialog(message);
    }
  }

  /**
   * Sets up chat message event listeners for opposed test interactions
   * Handles reaction button clicks and opposed test management
   * @param {jQuery} html - The HTML element containing chat messages
   * @returns {Promise<void>}
   */
  static async chatListeners(html) {
    html.on('click', '.unopposed-button', (event) => {
      event.preventDefault();
      this._handleReaction(event);
    });
  }

  /**
   * Hides the reaction button from a start message after opposed test completion
   * Prevents further reactions once the test has been resolved
   * @param {string} startMessageId - The ID of the start message to modify
   * @returns {Promise<void>}
   */
  static async hideReactionButton(startMessageId) {
    if (startMessageId) {
      if (game.user.isGM) {
        let startMessage = game.messages.get(startMessageId);
        let query = $(startMessage.content);
        query.find('button.unopposed-button').remove();
        query = $('<div></div>').append(query);

        await startMessage.update({ content: query.html() });
      } else {
        game.socket.emit('system.dsa5', {
          type: 'hideQueryButton',
          payload: {
            id: startMessageId,
          },
        });
      }
    }
  }

  /**
   * Main orchestration method for completing an opposed test process
   * Handles the full workflow from evaluation to rendering and cleanup
   * @param {CombatantData} attacker - The attacking combatant data
   * @param {CombatantData} defender - The defending combatant data
   * @param {Object} options - Additional options for the opposed test
   * @param {boolean} [options.target] - Whether this is a targeted test
   * @param {string} [options.startMessageId] - ID of the starting message
   * @param {Array} [options.whisper] - Whisper targets for the result
   * @param {boolean} [options.blind] - Whether the result should be blind
   * @returns {Promise<void>}
   */
  static async completeOpposedProcess(attacker, defender, options) {
    await DSATriggers.postOpposed({ attacker, defender, options });
    const opposedResult = await this.evaluateOpposedTest(attacker.testResult, defender.testResult, options);
    this.formatOpposedResult(opposedResult, attacker.speaker, defender.speaker);
    this.rerenderMessagesWithModifiers(opposedResult, attacker, defender);
    Hooks.call('finishOpposedTest', attacker, defender, opposedResult, options);
    await this.finishOpposedTestHookAsync(attacker, defender, opposedResult, options);
    this.playAutomatedJBA2(attacker, defender, opposedResult);
    await this.renderOpposedResult(opposedResult, options);
    await this.hideReactionButton(options.startMessageId);

    return opposedResult;
  }

  /**
   * Hook for custom async processing after opposed test completion
   * Allows modules to add custom logic after test resolution
   * @param {CombatantData} attacker - The attacking combatant data
   * @param {CombatantData} defender - The defending combatant data
   * @param {OpposedTestResult} opposedResult - The result of the opposed test
   * @param {Object} options - Additional options for the opposed test
   * @returns {Promise<void>}
   */
  static async finishOpposedTestHookAsync(attacker, defender, opposedResult, options) { }

  /**
   * Evaluates the outcome of an opposed test between attacker and defender
   * Determines winner, damage, and special effects based on test results
   * @param {TestResult} attackerTest - The attacker's test result
   * @param {TestResult} defenderTest - The defender's test result
   * @param {Object} [options={}] - Additional evaluation options
   * @param {string} [options.additionalInfo] - Extra information to include
   * @returns {Promise<OpposedTestResult>} The complete opposed test result
   */
  static async evaluateOpposedTest(attackerTest, defenderTest, options = {}) {
    let opposeResult = {};

    opposeResult.other = [];
    if (options.additionalInfo) opposeResult.other.push(options.additionalInfo);

    opposeResult.winner = 'attacker';

    if (['weapon', 'spell', 'liturgy', 'ceremony', 'ritual', 'combatskill'].includes(attackerTest.rollType) && defenderTest.successLevel == undefined) {
      defenderTest.successLevel = -5;
    }
    if (attackerTest.rollType == 'damage') {
      defenderTest.successLevel = -5;
      attackerTest.successLevel = 1;
    }

    if (defenderTest.successLevel != undefined) {
      switch (attackerTest.rollType) {
        case 'combatskill':
        case 'talent':
          this._evaluateTalentOpposedRoll(attackerTest, defenderTest, opposeResult, options);
          break;
        case 'ceremony':
        case 'ritual':
        case 'spell':
        case 'liturgy':
        case 'weapon':
        case 'damage':
          await this._evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options);
          break;
        default:
          ui.notifications.error('Can not oppose ' + attackerTest.rollType);
          console.warn('Can not oppose ' + attackerTest.rollType);
      }
    }
    return opposeResult;
  }

  /**
   * Evaluates weapon-based opposed rolls including damage calculation
   * Handles armor damage, counter-attacks, and damage modifiers
   * @param {TestResult} attackerTest - The attacker's weapon test result
   * @param {TestResult} defenderTest - The defender's test result
   * @param {OpposedTestResult} opposeResult - The opposed result being built
   * @param {Object} [options={}] - Additional evaluation options
   * @returns {void} Modifies opposeResult in place
   */
  static async _evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options = {}) {
    const isBrawlingDefense = OpposedDsa5.#brawlingDefenseVersusWeapon(attackerTest, defenderTest);
    if ((attackerTest.successLevel > 0 && defenderTest.successLevel < 0) || isBrawlingDefense) {
      const damage = this._calculateOpposedDamage(attackerTest, defenderTest, options);

      if (isBrawlingDefense) {
        opposeResult.other.push(
          `<div class="flexrow">${_loc('BRAWLING.defense')}</div>`
        );
      }

      if (damage.armorDamaged.damaged && damage.armorDamaged.ids.length) {
        const uuids = damage.armorDamaged.ids.join(';');
        opposeResult.other.push(
          `<div style="margin-top:10px" class="center"><button class="gearDamaged onlyTarget" data-uuid="${uuids}">${_loc('WEAR.checkShort')}</button></div>`,
        );
      }

      if (defenderTest.counterAttack) {
        damage.damage += 2;
        damage.sum = damage.damage - damage.armor;
        damage.tooltip = _loc('LocalizedIDs.counterAttack') + ' 2';
      }

      if (damage.messages.length) {
        if (!damage.tooltip) damage.tooltip = '';

        damage.tooltip += ` ${damage.messages.join('<br>')}`;
      }

      opposeResult.winner = 'attacker';

      let title = '';
      if (damage.armorMod != 0) title += `${damage.armorMod} ${_loc('Modifier')}`;
      if (damage.armorMultiplier != 1) title += `*${damage.armorMultiplier} ${_loc('Modifier')}`;
      if (damage.spellArmor != 0) title += `${damage.spellArmor} ${_loc('spellArmor')}`;
      if (damage.liturgyArmor != 0) title += `${damage.liturgyArmor} ${_loc('liturgyArmor')}`;

      const dmgString = _loc(game.combat?.isBrawling ? 'BRAWLING.temporary' : 'damage');
      const description = `<b>${dmgString}</b>: <span${damage.tooltip ? ` data-tooltip="${damage.tooltip}"` : ''}>${damage.damage}</span><i class="lighticon fas fa-hand-fist" data-tooltip="Roll"></i> - <span data-tooltip="${title}">${damage.armor}</span><i class="lighticon fa fa-shield-alt" data-tooltip="protection"></i> = ${damage.sum}`;
      opposeResult.damage = {
        description,
        value: damage.sum,
        sp: damage.damage,
        armorMod: damage.armorMod,
        armorMultiplier: damage.armorMultiplier,
        spellArmor: damage.spellArmor,
        liturgyArmor: damage.liturgyArmor,
      };
    } else {
      opposeResult.winner = 'defender';

      if(!OpposedDsa5.#attacksVersusWeapon(attackerTest, defenderTest)) return;

      await OpposedDsa5.#attackVersusWeaponMessage(attackerTest, defenderTest);
    }
  }

  static async #attackVersusWeaponMessage(attackerTest, defenderTest) {
    const defWeaponDamage = defenderTest.source.system.damage.value;

    const roll = await new Roll(DiceDSA5.replaceDieLocalization(defWeaponDamage)).evaluate()
    const damage = Math.round(roll.total * 0.5);
    const attacker = await DSA5_Utility.getSpeaker(attackerTest.speaker);

    const context = {
      result: _loc('BRAWLING.attacksHurt', { name: attacker.name }),
      damage: {
        description: `<b>${_loc('damage')}</b>: <span>${damage}</span><i class="lighticon fas fa-hand-fist" data-tooltip="Roll"></i>`
      },
      applyDamageInChat: game.settings.get('dsa5', 'applyDamageInChat')
    }

    const content = await renderTemplate('systems/dsa5/templates/chat/roll/brawling-attack.hbs', context);
    const chatOptions = {
      user: game.user.id,
      content,
      flags: {
        opposeData: {
          speakerDefend: attackerTest.speaker,
          damage: {
            value: damage,
          }
        }
      },
    };

    await ChatMessage.create(chatOptions);
  }

  static #attacksVersusWeapon(attackerTest, defenderTest) {
    const atWeapon = attackerTest.source;
    const defWeapon = defenderTest.source;

    if (!defWeapon || !atWeapon) return false;

    const attackerUsesBrawling = atWeapon.type == 'meleeweapon' && _loc(`LocalizedCTs.${atWeapon.system.combatskill.value}`) == 'Brawling' && !atWeapon.system.preventsBrawlAttackDamage;
    const defenderHasWeapon = defWeapon.type == 'meleeweapon' && _loc(`LocalizedCTs.${defWeapon.system.combatskill.value}`) != 'Brawling';

    return attackerUsesBrawling && defenderHasWeapon;
  }

  static #brawlingDefenseVersusWeapon(attackerTest, defenderTest) {
    const atWeapon = attackerTest.source;
    const defWeapon = defenderTest.source;

    if (!defWeapon || !atWeapon) return false;

    const attackerHasWeapon = atWeapon.type == 'meleeweapon' && _loc(`LocalizedCTs.${atWeapon.system.combatskill.value}`) != 'Brawling';
    const defendsWithBrawling = defWeapon.type == 'meleeweapon'
      && _loc(`LocalizedCTs.${defWeapon.system.combatskill.value}`) == 'Brawling'
      && !defWeapon.system.preventsBrawlParryDamage;

    return attackerHasWeapon && defendsWithBrawling;
  }

  /**
   * Calculates damage for opposed weapon attacks including armor effects
   * Handles critical damage, armor penetration, and special defenses
   * @param {TestResult} attackerTest - The attacker's test result with damage
   * @param {TestResult} defenderTest - The defender's test result
   * @param {Object} [options={}] - Additional calculation options
   * @returns {Object} Damage calculation result with armor effects
   * @returns {number} returns.damage - Base damage before armor
   * @returns {number} returns.armor - Effective armor value
   * @returns {number} returns.sum - Final damage after armor
   * @returns {Array<string>} returns.messages - Damage calculation messages
   * @returns {Object} returns.armorDamaged - Armor damage information
   * @returns {number} returns.armorMod - Armor modifier applied
   * @returns {string} [returns.tooltip] - Additional tooltip information
   */
  static _calculateOpposedDamage(attackerTest, defenderTest, options = {}) {
    const actor = DSA5_Utility.getSpeaker(defenderTest.speaker);

    const messages = [];
    let baseDamage = attackerTest.damage;

    const immuneToCrit = _loc('LocalizedIDs.immuneToCrit');
    if (attackerTest.doubleDamage && actor.items.find((x) => x.name == immuneToCrit && x.type == 'trait')) {
      baseDamage = Math.floor(baseDamage / attackerTest.doubleDamage);
      messages.push(immuneToCrit);
    }
    options.origin = attackerTest.source;
    options.defender = actor;
    options.damage = baseDamage;
    options.defenderTest = defenderTest;
    options.attackerTest = attackerTest;

    let { wornArmor, armor } = Actordsa5.armorValue(actor, options);
    options.armor = armor;

    const transformed = DSAActiveEffectConfig.applyRollTransformation(actor, options, DSATriggers.EVENTS.DAMAGE_TRANSFORMATION).options;
    armor = transformed.armor;
    let damage = transformed.damage;

    let multipliers = [];
    let armorMod = 0;
    const aPen = attackerTest.armorPen || [];
    for (const mod of aPen) {
      if (/^\*/.test(mod)) multipliers.push(Number(mod.replace('*', '')));
      else armorMod += Number(mod);
    }
    let spellArmor = 0;
    let liturgyArmor = 0;

    if (['spell', 'ritual'].includes(attackerTest.source.type)) spellArmor += actor.system.spellArmor || 0;
    else if (['liturgy', 'ceremony'].includes(attackerTest.source.type)) spellArmor += actor.system.liturgyArmor || 0;

    armor += armorMod;
    const armorMultiplier = multipliers.reduce((sum, x) => {
      return sum * x;
    }, 1);
    armor = Math.max(Math.round(armor * armorMultiplier), 0);
    armor += spellArmor + liturgyArmor;
    const armorDamaged = EquipmentDamage.armorGetsDamage(damage, attackerTest);
    const ids = wornArmor.map((x) => actor.items.get(x._id).uuid);

    return {
      damage,
      armor,
      armorDamaged: { damaged: armorDamaged, ids },
      armorMod,
      spellArmor,
      liturgyArmor,
      armorMultiplier,
      messages,
      sum: damage - armor,
    };
  }

  /**
   * Evaluates talent-based opposed rolls (skills, attributes, etc.)
   * Determines winner based on success levels and quality steps
   * @param {TestResult} attackerTest - The attacker's talent test result
   * @param {TestResult} defenderTest - The defender's talent test result
   * @param {OpposedTestResult} opposeResult - The opposed result being built
   * @param {Object} [options={}] - Additional evaluation options
   * @returns {void} Modifies opposeResult in place
   */
  static _evaluateTalentOpposedRoll(attackerTest, defenderTest, opposeResult, options = {}) {
    if (attackerTest.successLevel > 0 && attackerTest.successLevel > defenderTest.successLevel) {
      opposeResult.winner = 'attacker';
    } else if (attackerTest.qualityStep > defenderTest.qualityStep || (attackerTest.result >= 0 && defenderTest.result < 0)) {
      opposeResult.winner = 'attacker';
      opposeResult.differenceSL = attackerTest.qualityStep - defenderTest.qualityStep;
    } else {
      opposeResult.winner = 'defender';
      opposeResult.differenceSL = defenderTest.qualityStep - attackerTest.qualityStep;
    }
  }

  /**
   * Formats the opposed test result for display in chat
   * Generates localized winner/loser messages with success level differences
   * @param {OpposedTestResult} opposeResult - The opposed test result to format
   * @param {Object} attacker - The attacker's speaker data
   * @param {Object} defender - The defender's speaker data
   * @returns {void} Modifies opposeResult in place with formatted text and image
   */
  static formatOpposedResult(opposeResult, attacker, defender) {
    let str = opposeResult.differenceSL ? 'winsFP' : 'wins';
    if (opposeResult.winner == 'attacker') {
      opposeResult.result = _loc('OPPOSED.' + str, {
        winner: attacker.alias,
        loser: defender.alias,
        SL: opposeResult.differenceSL,
      });
      opposeResult.img = attacker.img;
    } else if (opposeResult.winner == 'defender') {
      opposeResult.result = _loc('OPPOSED.' + str, {
        winner: defender.alias,
        loser: attacker.alias,
        SL: opposeResult.differenceSL,
      });
      opposeResult.img = defender.img;
    }

    opposeResult.speakerAttack = attacker;
    opposeResult.speakerDefend = defender;

    return opposeResult;
  }

  /**
   * Re-renders messages with updated modifiers after opposed test completion
   * Updates damage display based on test outcome
   * @param {OpposedTestResult} opposeResult - The opposed test result
   * @param {CombatantData} attacker - The attacking combatant data
   * @param {CombatantData} defender - The defending combatant data
   * @returns {void}
   */
  static rerenderMessagesWithModifiers(opposeResult, attacker, defender) {
    let attackerMessage = game.messages.get(attacker.messageId);
    this.showDamage(attackerMessage, opposeResult.winner != 'attacker');
  }

  /**
   * Renders the final opposed test result as a chat message
   * Handles damage display options, permissions, and UI configuration
   * @param {OpposedTestResult} formattedOpposeResult - The formatted opposed result
   * @param {Object} [options={}] - Rendering options
   * @param {Array} [options.whisper] - Whisper targets for the message
   * @param {boolean} [options.blind] - Whether the message should be blind
   * @param {boolean} [options.target] - Whether this was a targeted test
   * @param {string} [options.startMessageId] - ID of the starting message
   * @returns {Promise<void>}
   */
  static async renderOpposedResult(formattedOpposeResult, options = {}) {
    const hideConfig = game.settings.get('dsa5', 'hideOpposedDamageSelect');
    formattedOpposeResult.hideData = { value: [1, 2].includes(hideConfig) };
    formattedOpposeResult.applyDamageInChat = game.settings.get('dsa5', 'applyDamageInChat');
    formattedOpposeResult.isBrawling = game.combat?.isBrawling;

    const content = await renderTemplate('systems/dsa5/templates/chat/roll/opposed-result.hbs', formattedOpposeResult);
    const chatOptions = {
      user: game.user.id,
      content,
      flags: {
        opposeData: formattedOpposeResult,
        hideData: { value: formattedOpposeResult.hideData.value },
      },
      whisper: hideConfig > 1 ? [] : options.whisper,
      blind: options.blind,
    };

    // does this do anything? does not work with v13 aymore
    // if (options.target) chatOptions['flags.startMessageId'] = options.startMessageId;

    await ChatMessage.create(chatOptions);
  }

  /**
   * Combines effects from ammunition and situational modifiers into attacker data
   * Merges special ability effects and active effects for test processing
   * @param {CombatantData} attacker - The attacker's combatant data
   * @param {Object} testData - The test data containing modifiers and effects
   * @returns {void} Modifies attacker data in place
   */
  static combine_effects(attacker, testData) {
    if (attacker.testResult.ammo) attacker.testResult.source.effects.push(...attacker.testResult.ammo.effects);

    const triggerIds = testData.situationalModifiers.reduce((acc, x) => {
      if (x.specAbId) acc.push(x.specAbId);
      return acc;
    }, []);
    if (!triggerIds.length) return;

    const actor = DSA5_Utility.getSpeaker(attacker.speaker);
    const allowedTriggers = new Set([DSATriggers.EVENTS.DAMAGE_TRANSFORMATION]);
    const existingIds = new Set(attacker.testResult.source.effects.map(x => x._id));
    for (const id of triggerIds) {
      const specAb = actor.items.get(id);
      if (!specAb) continue;

      for (const effect of specAb.effects) {
        if (existingIds.has(effect._id)) continue;
        if (!allowedTriggers.has(effect.system.advancedFunction)) continue;

        attacker.testResult.source.effects.push(effect.toObject());
      }
    }
  }

  /**
   * Resolves an undefended opposed test (when defender doesn't respond)
   * Creates a default defender result and processes the opposed test
   * @param {ChatMessage} startMessage - The start message for the undefended test
   * @param {string} [additionalInfo=''] - Additional information to include in result
   * @returns {Promise<void>}
   */
  static async resolveUndefended(startMessage, additionalInfo = '') {
    let unopposeData = startMessage.flags.unopposeData;

    let attackMessage = game.messages.get(unopposeData.attackMessageId);
    let attacker = {
      speaker: attackMessage.speaker,
      testResult: attackMessage.flags.data.postData,
      messageId: unopposeData.attackMessageId,
    };
    attacker.testResult.source = attackMessage.flags.data.preData.source;

    OpposedDsa5.combine_effects(attacker, attackMessage.flags.data.preData);

    let target = canvas.tokens.get(unopposeData.targetSpeaker.token);
    let defender = {
      speaker: unopposeData.targetSpeaker,
      testResult: {
        actor: target.actor,
        speaker: {
          token: unopposeData.targetSpeaker.token,
        },
      },
    };
    await this.clearOpposed(target.actor);

    await this.completeOpposedProcess(attacker, defender, {
      target: true,
      startMessageId: startMessage.id,
      additionalInfo: additionalInfo,
    });
    if (game.user.isGM) {
      await attackMessage.update({
        'flags.data.unopposedStartMessage': startMessage.id,
      });
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'updateAttackMessage',
        payload: {
          messageId: attackMessage.id,
          startMessageId: startMessage.id,
        },
      });
    }
  }
}
