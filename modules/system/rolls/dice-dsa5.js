import Actordsa5 from '../../actor/actor-dsa5.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5Dialog from '../../dialog/dialog-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import AdvantageRulesDSA5 from '../rules/advantage-rules-dsa5.js';
import SpecialabilityRulesDSA5 from '../rules/specialability-rules-dsa5.js';
import TraitRulesDSA5 from '../rules/trait-rules-dsa5.js';
import Itemdsa5 from '../../item/item-dsa5.js';
import DSA5StatusEffects from '../../status/status_effects.js';
import OpposedDsa5 from './opposed-dsa5.js';
import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import DSA5SoundEffect from '../helpers/dsa-soundeffect.js';
import EquipmentDamage from '../automation/equipment-damage.js';
import EquipmentDamageDialog from '../../dialog/dialog-equipmentdamage.js';
import DSATables from '../../tables/dsatables.js';
import RequestRoll from './request-roll.js';
import { DSARegionTemplate } from '../automation/measuretemplate.js';
import TableEffects from '../../tables/tableEffects.js';
import CreatureType from '../automation/creature-type.js';
import { applyDamage } from '../../hooks/chat_context.js';
import DSATriggers from '../automation/triggers.js';
import RuleChaos from '../rules/rule_chaos.js';
import CombatskillData from '../../data/item/combatskill.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';

const { mergeObject, deepClone, duplicate, getProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;
const { ATTACK, PARRY, DAMAGE, DODGE } = ITEM_CONSTANTS.COMBAT_MODES;
const { SKILL, LITURGY, SPELL, CEREMONY, RITUAL } = ITEM_CONSTANTS.TEST_TYPES;
const { ROLL_TYPES, CHAT_MODES } = DICE_CONSTANTS;

export default class DiceDSA5 {
  /**
   * Main entry point for rolling tests
   * @param {Object} testData - Test configuration data
   * @returns {Promise<Object>} Roll results
   */
  static async rollTest(testData) {
    const { source, mode } = testData;
    const { type } = source;

    // Use a lookup table for better performance and maintainability
    const rollHandlers = {
      [ROLL_TYPES.CEREMONY]: () => this.rollSpell(testData),
      [ROLL_TYPES.RITUAL]: () => this.rollSpell(testData),
      [ROLL_TYPES.LITURGY]: () => this.rollSpell(testData),
      [ROLL_TYPES.SPELL]: () => this.rollSpell(testData),
      [ROLL_TYPES.SKILL]: () => this.rollTalent(testData),
      [ROLL_TYPES.COMBATSKILL]: () => this.rollCombatskill(testData),
      [ROLL_TYPES.TRAIT]: () => this.#handleTraitRoll(testData),
      [ROLL_TYPES.REGENERATE]: () => this.#rollRegeneration(testData),
      [ROLL_TYPES.MELEEWEAPON]: () => this.#handleWeaponRoll(testData),
      [ROLL_TYPES.RANGEWEAPON]: () => this.#handleWeaponRoll(testData),
      [ROLL_TYPES.DODGE]: () => this.#handleDodgeRoll(testData),
      [ROLL_TYPES.POISON]: () => this.rollItem(testData),
      [ROLL_TYPES.DISEASE]: () => this.rollItem(testData),
      [ROLL_TYPES.FALLING_DAMAGE]: () => this.rollFallingDamage(testData)
    };

    const handler = rollHandlers[type] || (() => this.rollAttribute(testData));
    const rollResults = await handler();

    mergeObject(rollResults, deepClone(testData.extra));
    return rollResults;
  }

  /**
   * Handle trait rolls with defense count update
   * @param {Object} testData 
   * @returns {Promise<Object>}
   */
  static async #handleTraitRoll(testData) {
    const { mode } = testData;

    if (mode === PARRY) {
      await this.updateDefenseCount(testData);
    }

    if (mode === ATTACK) {
      await this.consumeAction(testData);
    }

    return mode === DAMAGE
      ? this.rollDamage(testData)
      : this.rollCombatTrait(testData);
  }

  /**
   * Handle weapon rolls with defense count update
   * @param {Object} testData 
   * @returns {Promise<Object>}
   */
  static async #handleWeaponRoll(testData) {
    const { mode } = testData;

    if (mode === PARRY) {
      await this.updateDefenseCount(testData);
    }

    if (mode === ATTACK) {
      await this.consumeAction(testData);
    }

    return mode === DAMAGE
      ? this.rollDamage(testData)
      : this.rollWeapon(testData);
  }

  /**
   * Handle dodge rolls with defense count update
   * @param {Object} testData 
   * @returns {Promise<Object>}
   */
  static async #handleDodgeRoll(testData) {
    await this.updateDefenseCount(testData);
    return this.rollStatus(testData);
  }

  static async rollDices(testData, cardOptions) {
    if (testData.roll) return testData;

    const d3dColors = game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration;
    const actor = this.#actorFromTestData(testData);
    const { source, mode } = testData;
    const { type } = source;

    // Dice roll configuration lookup
    const diceConfigs = {
      [ROLL_TYPES.LITURGY]: () => this.#createThreeD20Roll(source, d3dColors),
      [ROLL_TYPES.SPELL]: () => this.#createThreeD20Roll(source, d3dColors),
      [ROLL_TYPES.CEREMONY]: () => this.#createThreeD20Roll(source, d3dColors),
      [ROLL_TYPES.RITUAL]: () => this.#createThreeD20Roll(source, d3dColors),
      [ROLL_TYPES.SKILL]: () => this.#createThreeD20Roll(source, d3dColors),
      [ROLL_TYPES.REGENERATE]: () => this.#createRegenerationRoll(actor, testData, d3dColors),
      [ROLL_TYPES.MELEEWEAPON]: () => this.#createWeaponRoll(testData, actor, d3dColors),
      [ROLL_TYPES.RANGEWEAPON]: () => this.#createWeaponRoll(testData, actor, d3dColors),
      [ROLL_TYPES.WEAPONLESS]: () => this.#createWeaponRoll(testData, actor, d3dColors),
      [ROLL_TYPES.COMBATSKILL]: () => this.#createWeaponRoll(testData, actor, d3dColors),
      [ROLL_TYPES.TRAIT]: () => this.#createWeaponRoll(testData, actor, d3dColors),
      [ROLL_TYPES.DODGE]: () => this.#createSingleD20Roll(d3dColors(DODGE)),
      [ROLL_TYPES.POISON]: () => this.#createPoisonDiseaseRoll(d3dColors),
      [ROLL_TYPES.DISEASE]: () => this.#createPoisonDiseaseRoll(d3dColors),
      [ROLL_TYPES.FALLING_DAMAGE]: () => this.#createFallingDamageRoll(testData)
    };

    const configHandler = diceConfigs[type] || (() => this.#createAttributeRoll(testData, d3dColors));
    let roll = await configHandler();

    roll = await DiceDSA5.manualRolls(roll, type, testData.extra.options);
    await this.showDiceSoNice(roll, cardOptions.messageMode);

    testData.roll = roll;
    testData.messageMode = cardOptions.messageMode;

    return testData;
  }

  /**
   * Create a three D20 roll for skills/spells
   * @param {Object} source 
   * @param {Function} d3dColors 
   * @returns {Promise<Roll>}
   */
  static async #createThreeD20Roll(source, d3dColors) {
    const roll = await new Roll('1d20+1d20+1d20').evaluate();
    const { system } = source;

    mergeObject(roll.dice[0].options, d3dColors(system.characteristic1.value));
    mergeObject(roll.dice[1].options, d3dColors(system.characteristic2.value));
    mergeObject(roll.dice[2].options, d3dColors(system.characteristic3.value));

    return roll;
  }

  /**
   * Create regeneration roll based on actor capabilities
   * @param {Object} actor 
   * @param {Object} testData 
   * @param {Function} d3dColors 
   * @returns {Promise<Roll>}
   */
  static async #createRegenerationRoll(actor, testData, d3dColors) {
    const { regenerateLeP, regenerateAsP, regenerateKaP } = testData;
    const dice = [];

    if (regenerateLeP) {
      const dieType = game.settings.get('dsa5', 'lessRegeneration') ? '1d3' : '1d6';
      dice.push(dieType);
    }

    if (actor.system.isMage && regenerateAsP) dice.push('1d6');
    if (actor.system.isPriest && regenerateKaP) dice.push('1d6');

    const roll = await new Roll(dice.join('+')).evaluate();

    // Apply colors to dice
    let diceIndex = 0;
    if (regenerateLeP) {
      mergeObject(roll.dice[diceIndex].options, d3dColors('mu'));
      diceIndex++;
    }

    if (actor.system.isMage && regenerateAsP) {
      const targetIndex = actor.system.isPriest && regenerateKaP ? dice.length - 2 : dice.length - 1;
      mergeObject(roll.dice[targetIndex].options, d3dColors('ge'));
    }

    if (actor.system.isPriest && regenerateKaP) {
      mergeObject(roll.dice[dice.length - 1].options, d3dColors('in'));
    }

    return roll;
  }

  /**
   * Create weapon or combat skill roll
   * @param {Object} testData 
   * @param {Object} actor 
   * @param {Function} d3dColors 
   * @returns {Promise<Roll>}
   */
  static async #createWeaponRoll(testData, actor, d3dColors) {
    const { mode } = testData;

    if (mode === DAMAGE) {
      const rollFormula = await this.damageFormula(testData);
      const roll = await new Roll(rollFormula, actor.system).evaluate();

      roll.dice.forEach(die =>
        mergeObject(die.options, d3dColors(DAMAGE))
      );

      return roll;
    }

    const roll = await new Roll('1d20').evaluate();
    mergeObject(roll.dice[0].options, d3dColors(mode));
    return roll;
  }

  /**
   * Create single D20 roll with color
   * @param {Object} colorConfig 
   * @returns {Promise<Roll>}
   */
  static async #createSingleD20Roll(colorConfig) {
    const roll = await new Roll('1d20').evaluate();
    mergeObject(roll.dice[0].options, colorConfig);
    return roll;
  }

  /**
   * Create poison/disease roll
   * @param {Function} d3dColors 
   * @returns {Promise<Roll>}
   */
  static async #createPoisonDiseaseRoll(d3dColors) {
    const roll = await new Roll('1d20+1d20+1d20').evaluate();
    const color = d3dColors('in');

    roll.dice.forEach(die =>
      mergeObject(die.options, color)
    );

    return roll;
  }

  /**
   * Create falling damage roll
   * @param {Object} testData 
   * @returns {Promise<Roll>}
   */
  static async #createFallingDamageRoll(testData) {
    const baseMod = await this._situationalModifiers(testData);
    const { fallingHeight, extra } = testData;
    const availableQs = extra?.options?.availableQs || 0;

    const formula = `${fallingHeight}d6+${baseMod}-${availableQs}`;
    return new Roll(formula).evaluate();
  }

  /**
   * Create attribute roll
   * @param {Object} testData 
   * @param {Function} d3dColors 
   * @returns {Promise<Roll>}
   */
  static async #createAttributeRoll(testData, d3dColors) {
    const roll = await new Roll('1d20').evaluate();
    const { source } = testData;
    mergeObject(roll.dice[0].options, d3dColors(source.system.attr));
    return roll;
  }

  static async setupDialog({ dialogOptions, testData, cardOptions }) {
    const messageMode = game.settings.get('core', 'messageMode');
    const sceneStress = DICE_CONSTANTS.DIFFICULTY.CHALLENGING;

    if (typeof testData.source.toObject === 'function') {
      testData.source = testData.source.toObject(false);
    }

    const actor = this.#actorFromTestData(testData);

    mergeObject(testData, {
      testDifficulty: sceneStress,
    });

    mergeObject(dialogOptions.data, {
      testDifficulty: sceneStress,
      testModifier: dialogOptions.data.modifier || 0,
    });

    const situationalModifiers = this.#gatherSituationalModifiers(
      dialogOptions.data.situationalModifiers,
      actor,
      testData
    );

    const targets = this.#collectTargets();
    const attributesList = this.#buildAttributesList();

    mergeObject(dialogOptions.data, {
      hasSituationalModifiers: situationalModifiers.length > 0,
      situationalModifiers,
      attributesList,
      messageMode: dialogOptions.data.messageMode || messageMode,
      defenseCount: await this.getDefenseCount(testData),
      targets,
    });

    cardOptions.user = game.user.id;

    return this.#handleDialogFlow(testData, dialogOptions, cardOptions, messageMode);
  }

  /**
   * Gather all situational modifiers for the test
   * @param {Array} existingModifiers 
   * @param {Object} actor 
   * @param {Object} testData 
   * @returns {Array}
   */
  static #gatherSituationalModifiers(existingModifiers, actor, testData) {
    const situationalModifiers = existingModifiers ||
      (actor ? DSA5StatusEffects.getRollModifiers(actor, testData.source) : []);

    const { moreModifiers } = testData.extra.options;
    if (moreModifiers) {
      situationalModifiers.push(...moreModifiers);
    }

    return situationalModifiers;
  }

  /**
   * Collect information about current targets
   * @returns {Array}
   */
  static #collectTargets() {
    const targets = [];

    game.user.targets.forEach((target) => {
      if (target.actor) {
        targets.push({
          name: target.actor.name,
          id: target.id,
          img: target.actor.img,
        });
      }
    });

    return targets;
  }

  /**
   * Build the attributes list for dialog display
   * @returns {Object}
   */
  static #buildAttributesList() {
    return Object.keys(DSA5.characteristics).reduce((acc, attr) => {
      acc[attr] = _loc(`CHARAbbrev.${attr.toUpperCase()}`);
      return acc;
    }, {});
  }

  /**
   * Handle dialog flow - either show dialog or proceed with bypass
   * @param {Object} testData 
   * @param {Object} dialogOptions 
   * @param {Object} cardOptions 
   * @param {string} messageMode 
   * @returns {Promise}
   */
  static #handleDialogFlow(testData, dialogOptions, cardOptions, messageMode) {
    const { bypass, messageMode: optionMessageMode } = testData.extra.options;

    if (!bypass) {
      return this.#showDialog(testData, dialogOptions);
    }

    // Handle bypass case
    cardOptions.messageMode = optionMessageMode || messageMode;
    if (!testData.situationalModifiers) {
      testData.situationalModifiers = [];
    }

    return { testData, cardOptions, dialogOptions };
  }

  /**
   * Show the dialog and return a promise
   * @param {Object} testData 
   * @param {Object} dialogOptions 
   * @returns {Promise}
   */
  static #showDialog(testData, dialogOptions) {
    const dialog = DSA5Dialog.getDialogForItem(testData, dialogOptions.data);

    return renderTemplate(dialogOptions.template, dialogOptions.data)
      .then(content => {
        return new Promise((resolve, reject) => {
          const dlg = new dialog({
            window: { title: dialogOptions.title },
            content,
            buttons: dialog.getRollButtons(testData, dialogOptions, resolve, reject),
          })
            .recallSettings(testData.extra.speaker, testData.source, testData.mode, dialogOptions.data)
          dlg.testData = testData;
          dlg.render(true);
        });
      });
  }

  static async getDefenseCount(testData) {
    if (game.combat) return await game.combat.getDefenseCount(testData.extra.speaker);

    return 0;
  }

  static async getDuplicatusRoll(res, testData) {
    const duplicatusEffect = testData.situationalModifiers.find((x) => x.name.includes('Duplicatus') && x.value > 0 && x.value < 5);
    if (duplicatusEffect) {
      const duplicatusRollTarget = Math.round((1 / (duplicatusEffect.value + 1)) * 20);
      const duplicatusRoll = await DiceDSA5.manualRolls(await new Roll('1d20').evaluate());
      this._addRollDiceSoNice(testData, duplicatusRoll, game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration('ch'));
      const hit = duplicatusRollTarget >= duplicatusRoll._total;
      const html = `<div class="card-content"><b>Duplicatus-${_loc('Roll')}</b>: <span data-tooltip="${_loc('Roll')} vs ${duplicatusRollTarget}" class="die-ch d20">${duplicatusRoll._total}</span></div`;
      res.other = [html];
      if (!hit && res.successLevel > 0) {
        res.description = `${_loc('Failure')}, ${_loc('CHATNOTIFICATION.duplicatus')}`;
        res.successLevel = 0;
      }
    }
  }

  static async _rollConfirm() {
    return await new Roll('1d20').evaluate();
  }

  static async _rollSingleD20(roll, res, id, modifier, testData, combatskill = '', multiplier = 1) {
    const actor = this.#actorFromTestData(testData);
    const rollTotal = roll.total ?? roll._total;
    const adjustedRes = Math.round((res + modifier) * multiplier);

    // Calculate basic roll results
    const rollResult = this.#calculateBasicRollResult(rollTotal, adjustedRes, id);

    // Get critical and botch thresholds
    const { botch, crit } = this.#getCriticalThresholds(testData, actor, combatskill);

    // Determine if critical or botch occurred
    const { isCrit, isBotch } = this.#evaluateCriticalResults(rollTotal, crit, botch);

    // Handle confirmation rolls if needed
    const confirmationResult = await this.#handleConfirmationRoll(
      isCrit, isBotch, adjustedRes, combatskill, actor, testData, id
    );

    // Build final result
    return this.#buildSingleD20Result(
      rollResult,
      confirmationResult,
      testData,
      modifier,
      isCrit,
      isBotch
    );
  }

  /**
   * Calculate basic roll result without critical considerations
   * @param {number} rollTotal 
   * @param {number} adjustedRes 
   * @param {string} id 
   * @returns {Object}
   */
  static #calculateBasicRollResult(rollTotal, adjustedRes, id) {
    const success = adjustedRes - rollTotal >= 0;
    const characteristics = [{
      char: id,
      res: rollTotal,
      suc: success,
      tar: adjustedRes
    }];

    return {
      success,
      characteristics,
      successLevel: success ? 1 : -1
    };
  }

  /**
   * Get critical and botch thresholds for the roll
   * @param {Object} testData 
   * @param {Object} actor 
   * @param {string} combatskill 
   * @returns {Object}
   */
  static #getCriticalThresholds(testData, actor, combatskill) {
    const { source } = testData;
    let botch = source.system.botch || DICE_CONSTANTS.DICE.DEFAULT_BOTCH;
    let crit = source.system.crit || DICE_CONSTANTS.DICE.DEFAULT_CRIT;

    // Handle improvised weapon modifications
    this.#adjustForImprovisedWeapon(testData, actor, () => {
      botch = Math.min(19, botch);
    });

    // Apply weapon stat modifiers
    ({ botch, crit } = this.#applyWeaponStatModifiers(testData, actor, botch, crit));

    // Handle opportunity attack modifications
    this.#adjustForOpportunityAttack(testData, () => {
      botch = 50;
      crit = -50;
    });

    return { botch, crit };
  }

  /**
   * Adjust thresholds for improvised weapons
   * @param {Object} testData 
   * @param {Object} actor 
   * @param {Function} adjustBotch 
   */
  static #adjustForImprovisedWeapon(testData, actor, adjustBotch) {
    if (!RuleChaos.improvisedWeapon.test(testData.source.name)) return;

    if (!SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.improvisedWeaponMaster')) {
      adjustBotch();
    }

    this._appendSituationalModifiers(
      testData,
      `${_loc('CHAR.ATTACK')} - ${_loc('WEAPON.improvised')}`,
      2,
      'defenseMalus'
    );
  }

  // Move statKeyMap to module-level constant
  static STAT_KEY_MAP = {
    [ROLL_TYPES.MELEEWEAPON]: 'meleeStats',
    [ROLL_TYPES.RANGEWEAPON]: 'rangeStats'
  };

  /**
   * Apply weapon statistics modifiers to critical thresholds
   * @param {Object} testData 
   * @param {Object} actor 
   * @param {number} botch 
   * @param {number} crit 
   * @returns {Object}
   */
  static #applyWeaponStatModifiers(testData, actor, botch, crit) {
    const { source, mode } = testData;
    const statKey = this.STAT_KEY_MAP[source.type];
    if (!statKey) return { botch, crit };

    const stats = actor.system[statKey];
    botch += stats.botch - DICE_CONSTANTS.DICE.DEFAULT_BOTCH;
    crit += stats.crit - DICE_CONSTANTS.DICE.DEFAULT_CRIT;

    // Apply mode-specific modifiers for melee weapons
    if (source.type === ROLL_TYPES.MELEEWEAPON) {
      if (mode === ATTACK) {
        crit += stats.critAT - DICE_CONSTANTS.DICE.DEFAULT_CRIT;
      } else if (mode === PARRY) {
        crit += stats.critPA - DICE_CONSTANTS.DICE.DEFAULT_CRIT;
      }
    }

    return { botch, crit };
  }

  /**
   * Adjust for opportunity attacks
   * @param {Object} testData 
   * @param {Function} adjustThresholds 
   */
  static #adjustForOpportunityAttack(testData, adjustThresholds) {
    const opportunityAttack = testData.situationalModifiers.find(
      (x) => x.name === _loc('MODS.opportunityAttack') && x.value !== 0
    );

    if (opportunityAttack) {
      adjustThresholds();
    }
  }

  /**
   * Evaluate if roll is critical or botch
   * @param {number} rollTotal 
   * @param {number} crit 
   * @param {number} botch 
   * @returns {Object}
   */
  static #evaluateCriticalResults(rollTotal, crit, botch) {
    return {
      isCrit: rollTotal <= crit,
      isBotch: rollTotal >= botch
    };
  }

  /**
   * Handle confirmation rolls for criticals and botches
   * @param {boolean} isCrit 
   * @param {boolean} isBotch 
   * @param {number} adjustedRes 
   * @param {string} combatskill 
   * @param {Object} actor 
   * @param {Object} testData 
   * @param {string} id 
   * @returns {Promise<Object>}
   */
  static async #handleConfirmationRoll(isCrit, isBotch, adjustedRes, combatskill, actor, testData, id) {
    if (!isCrit && !isBotch) {
      return {
        description: '',
        successLevel: null,
        characteristics: []
      };
    }

    const baseDescription = _loc(isCrit ? 'CriticalSuccess' : 'CriticalFailure');
    const successLevel = isCrit ? DICE_CONSTANTS.SUCCESS_LEVELS.CRITICAL_SUCCESS : DICE_CONSTANTS.SUCCESS_LEVELS.CRITICAL_FAILURE;

    if (game.settings.get('dsa5', 'noConfirmationRoll')) {
      return {
        description: baseDescription,
        successLevel,
        characteristics: []
      };
    }

    const confirmationResult = await this.#performConfirmationRoll(
      isCrit, isBotch, adjustedRes, combatskill, actor, testData, id
    );

    return {
      description: `${_loc(confirmationResult.confirmed ? 'confirmed' : 'unconfirmed')} ${baseDescription}${confirmationResult.additionalDescription}`,
      successLevel: confirmationResult.confirmed ? successLevel : (isCrit ? 2 : -2),
      characteristics: confirmationResult.characteristics
    };
  }

  /**
   * Perform the actual confirmation roll
   * @param {boolean} isCrit 
   * @param {boolean} isBotch 
   * @param {number} adjustedRes 
   * @param {string} combatskill 
   * @param {Object} actor 
   * @param {Object} testData 
   * @param {string} id 
   * @returns {Promise<Object>}
   */
  static async #performConfirmationRoll(isCrit, isBotch, adjustedRes, combatskill, actor, testData, id) {
    let rollConfirm = await DiceDSA5.manualRolls(
      await DiceDSA5._rollConfirm(),
      'confirmationRoll',
      testData.extra.options
    );

    const { source } = testData;
    const confirmChange = getProperty(source, `system.${isCrit ? 'critConfirm' : 'botchConfirm'}`) || 0;
    let confirmResult = adjustedRes - Math.clamp(rollConfirm.total + confirmChange, 1, DICE_CONSTANTS.DICE.D20_FACES);
    let additionalDescription = '';

    if (this.#shouldUseWeaponAptitude(actor, combatskill, confirmResult)) {
      const oldRoll = rollConfirm.total;
      rollConfirm = await DiceDSA5.manualRolls(
        await DiceDSA5._rollConfirm(),
        'LocalizedIDs.weaponAptitude',
        testData.extra.options
      );
      confirmResult = adjustedRes - Math.clamp(rollConfirm.total + confirmChange, 1, DICE_CONSTANTS.DICE.D20_FACES);
      additionalDescription = `, ${_loc('usedWeaponExpertise', { a: oldRoll, b: rollConfirm.total })}`;
    }

    const color = game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration(id);
    this._addRollDiceSoNice(testData, rollConfirm, color);

    let confirmed = confirmResult >= 0;
    if (isBotch) confirmed = !confirmed;

    const characteristics = [{
      char: id,
      res: Math.clamp(rollConfirm.total + confirmChange, 1, DICE_CONSTANTS.DICE.D20_FACES),
      suc: confirmed,
      tar: adjustedRes,
    }];

    return { confirmed, additionalDescription, characteristics };
  }

  /**
   * Check if weapon aptitude should be used
   * @param {Object} actor 
   * @param {string} combatskill 
   * @param {number} confirmResult 
   * @returns {boolean}
   */
  static #shouldUseWeaponAptitude(actor, combatskill, confirmResult) {
    return AdvantageRulesDSA5.hasVantage(
      actor,
      `${_loc('LocalizedIDs.weaponAptitude')} (${combatskill})`,
      false
    ) && confirmResult < 0;
  }

  /**
   * Build the final result object for single D20 roll
   * @param {Object} rollResult 
   * @param {Object} confirmationResult 
   * @param {Object} testData 
   * @param {number} modifier 
   * @param {boolean} isCrit 
   * @param {boolean} isBotch 
   * @returns {Object}
   */
  static #buildSingleD20Result(rollResult, confirmationResult, testData, modifier, isCrit, isBotch) {
    let { successLevel, characteristics } = rollResult;
    let description = confirmationResult.description;

    if (confirmationResult.successLevel !== null) {
      successLevel = confirmationResult.successLevel;
      characteristics.push(...confirmationResult.characteristics);
    } else if (!isCrit && !isBotch) {
      description = _loc(rollResult.success ? 'Success' : 'Failure');
    }

    return {
      successLevel,
      characteristics,
      description,
      preData: testData,
      modifiers: modifier,
      extra: {
        attackFromBehind: testData.extra.attackFromBehind,
      },
    };
  }

  static async rollFallingDamage(testData) {
    const roll = testData.roll;
    const chars = [];

    for (const res of roll.terms[0].results) {
      chars.push({ char: DAMAGE, res: res.result, suc: false });
    }

    const result = {
      rollType: ROLL_TYPES.FALLING_DAMAGE,
      preData: testData,
      modifiers: await this._situationalModifiers(testData),
      extra: {},
      damage: Math.max(0, roll.total),
      formula: roll.formula,
      characteristics: chars,
    };
    return result;
  }

  static async #rollRegeneration(testData) {
    const modifier = await this._situationalModifiers(testData);
    const roll = testData.roll;
    const chars = [];

    const result = {
      rollType: ROLL_TYPES.REGENERATE,
      preData: testData,
      modifiers: modifier,
      extra: {},
    };
    const actor = this.#actorFromTestData(testData);
    const tranceLevel = Number(actor.system?.condition?.trance || 0);
    const attrs = [];
    if (testData.regenerateLeP) attrs.push('LeP');
    if (actor.system.isMage && testData.regenerateAsP) attrs.push('AsP');
    if (actor.system.isPriest && testData.regenerateKaP) attrs.push('KaP');
    let index = 0;

    const isSick = actor.effects.some((x) => x.statuses.has('sick'));
    if (isSick) {
      this._appendSituationalModifiers(testData, _loc('CONDITION.sick'), '*0');
      for (const k of attrs) {
        chars.push({ char: k, res: 0, die: 'd6' });
        result[k] = 0;
        index += 2;
      }
    } else {
      const modifierLoc = _loc('Modifier');
      const regenerationLoc = _loc('regenerate');
      for (const k of attrs) {
        this._appendSituationalModifiers(testData, _loc(`LocalizedIDs.regeneration${k}`), AdvantageRulesDSA5.vantageStep(actor, `LocalizedIDs.regeneration${k}`), k);
        this._appendSituationalModifiers(
          testData,
          _loc(`LocalizedIDs.weakRegeneration${k}`),
          AdvantageRulesDSA5.vantageStep(actor, `LocalizedIDs.weakRegeneration${k}`) * -1,
          k,
        );
        this._appendSituationalModifiers(
          testData,
          _loc(`LocalizedIDs.advancedRegeneration${k}`),
          SpecialabilityRulesDSA5.abilityStep(actor, `LocalizedIDs.advancedRegeneration${k}`),
          k,
        );

        const label = _loc(`CHARAbbrev.${k}`);

        this._appendSituationalModifiers(testData, `${label} ${modifierLoc}`, testData[`${k}Modifier`], k);
        this._appendSituationalModifiers(testData, `${label} ${regenerationLoc}`, testData[`regeneration${k}`], k);

        await this._situationalModifiers(testData);

        chars.push({
          char: k,
          res: roll.terms[index].results[0].result,
          die: 'd6',
        });

        if (k == 'AsP' && tranceLevel > 0) {
          this._appendSituationalModifiers(testData, _loc('CONDITION.trance'), '*0', 'AsP');
          result[k] = 0;
          index += 2;
          continue;
        }

        const modifiedValue = (Number(roll.terms[index].results[0].result) + Number(modifier) + (await this._situationalModifiers(testData, k))) * Number(testData.regenerationFactor);
        result[k] = Math.round(Math.max(0, modifiedValue));

        index += 2;
      }
    }

    result.characteristics = chars;
    return result;
  }

  static async rollStatus(testData) {
    const roll = testData.roll || (await new Roll('1d20').evaluate());
    const result = await this._rollSingleD20(
      roll,
      testData.source.system.max,
      testData.extra.statusId,
      await this._situationalModifiers(testData),
      testData,
      '',
      this._situationalMultipliers(testData),
    );
    result.rollType = DODGE;
    const isDodge = testData.extra.statusId == DODGE;
    if (isDodge && result.successLevel == 3) {
      if (await DSATables.tableEnabledFor('criticalMeleeDefense')) {
        result.description += DSATables.rollCritBotchButton('criticalMeleeDefense', false, testData, testData);
      } else {
        result.description += DSATables.defaultParryCrit();
      }
    } else if (isDodge && result.successLevel == -3) {
      if (await DSATables.tableEnabledFor('Defense')) {
        result.description += DSATables.rollCritBotchButton('Defense', true, testData, testData);
      } else {
        result.description += await DSATables.defaultBotch();
      }
    }
    return result;
  }

  static async rollAttribute(testData) {
    const roll = testData.roll ? testData.roll : await new Roll('1d20').evaluate();
    this._appendSituationalModifiers(testData, _loc('Difficulty'), testData.testDifficulty);
    const result = await this._rollSingleD20(
      roll,
      testData.source.system.value,
      testData.extra.characteristicId,
      await this._situationalModifiers(testData),
      testData,
      '',
      this._situationalMultipliers(testData),
    );
    result.rollType = 'attribute';
    return result;
  }

  static async damageFormula(testData) {
    let weapon;
    const actor = this.#actorFromTestData(testData);
    if (testData.source.type == 'meleeweapon') {
      const skill = CombatskillData._calculateCombatSkillValues(
        actor.items.find((x) => x.type == 'combatskill' && x.name == testData.source.system.combatskill.value),
        actor.system,
      );
      weapon = Actordsa5._prepareMeleeWeapon(testData.source, [skill], actor);
    } else if (testData.source.type == 'rangeweapon') {
      const skill = CombatskillData._calculateCombatSkillValues(
        actor.items.find((x) => x.type == 'combatskill' && x.name == testData.source.system.combatskill.value),
        actor.system,
      );
      weapon = Actordsa5._prepareRangeWeapon(testData.source, [], [skill], actor);
    } else {
      weapon = testData.source.system;
    }
    return this.replaceDieLocalization(testData.source.system.damage.value) + `+${weapon.extraDamage || 0}`;
  }

  static async rollDamage(testData) {
    const modifiers = await this._situationalModifiers(testData);
    const chars = [];

    const roll = testData.roll;
    const damage = roll.total + modifiers;

    for (const k of roll.terms) {
      if (k instanceof foundry.dice.terms.Die || k.class == 'Die') {
        for (const l of k.results)
          chars.push({
            char: testData.mode,
            res: l.result,
            die: 'd' + k.faces,
          });
      }
    }

    return {
      rollType: DAMAGE,
      damage,
      characteristics: chars,
      preData: testData,
      modifiers,
      extra: {},
    };
  }

  /**
   * Calculate total situational modifiers for a given filter
   * @param {Object} testData - Test data containing situational modifiers
   * @param {string} filter - Filter type to apply (empty string for default)
   * @returns {Promise<number>} Total modifier value
   */
  static async _situationalModifiers(testData, filter = '') {
    const { situationalModifiers = [] } = testData;

    const validModifiers = situationalModifiers.filter(modifier =>
      modifier.value !== undefined &&
      (modifier.type === filter || (filter === '' && modifier.type === undefined))
    );

    const modifierPromises = validModifiers.map(async (modifier) => {
      const numericValue = Number(modifier.value);
      return numericValue || await this._stringToRoll(modifier.value);
    });

    let compensation = 0;
    if (filter === ''){
      compensation = await DiceDSA5._situationalModifiers(testData, DICE_CONSTANTS.MODIFIER_TYPES.COMPENSATION);
    }

    const values = await Promise.all(modifierPromises);
    const [pos, neg] = values.reduce((total, value) => {
      if (value < 0) {
        total[1] += value;
      } else {
        total[0] += value;
      }
      return total;
    }, [0, 0]);

    return pos + Math.min(0, neg + compensation);
  }

  /**
   * Calculate part check modifiers (TPM type)
   * @param {Object} testData - Test data containing situational modifiers
   * @returns {Array<number>} Array of three modifier values
   */
  static _situationalPartCheckModifiers(testData) {
    const { situationalModifiers = [] } = testData;

    return situationalModifiers.reduce((result, modifier) => {
      if (modifier.type !== DICE_CONSTANTS.MODIFIER_TYPES.TPM) {
        return result;
      }

      const parts = modifier.value.split('|');
      if (parts.length !== 3) {
        console.warn(`Invalid TPM modifier format for "${modifier.name}": value "${modifier.value}"`);
        return result;
      }

      return parts.map((part, index) => result[index] + Number(part));
    }, [0, 0, 0]);
  }

  /**
   * Calculate multiplier from situational modifiers
   * @param {Object} testData - Test data containing situational modifiers
   * @returns {number} Combined multiplier value
   */
  static _situationalMultipliers(testData) {
    const { situationalModifiers = [] } = testData;

    return situationalModifiers.reduce((multiplier, modifier) => {
      if (modifier.type !== DICE_CONSTANTS.MODIFIER_TYPES.MULTIPLY) {
        return multiplier;
      }

      const value = Number(`${modifier.value}`.replace(/,/, '.')) || 1;
      return multiplier * value;
    }, 1);
  }

  /**
   * Add or update a situational modifier
   * @param {Object} testData - Test data to modify
   * @param {string} name - Modifier name
   * @param {*} value - Modifier value
   * @param {string} type - Modifier type (optional)
   */
  static _appendSituationalModifiers(testData, name, value, type = '') {
    if (!testData.situationalModifiers) {
      testData.situationalModifiers = [];
    }

    const existingModifier = testData.situationalModifiers.find(modifier => modifier.name === name);

    if (existingModifier) {
      existingModifier.value = value;
      if (type) existingModifier.type = type;
    } else {
      testData.situationalModifiers.push({ name, value, type });
    }
  }

  static async rollCombatTrait(testData) {
    const roll = testData.roll || (await new Roll('1d20').evaluate());
    const source = testData.source; //.system == undefined ? testData.source : testData.source.system
    const isMelee = source.system.traitType.value == 'meleeAttack';
    const isAttack = testData.mode == ATTACK;
    if (isMelee) {
      const weapon = {
        system: {
          combatskill: { value: '-' },
          reach: { value: source.system.reach.value },
        },
      };

      this._appendSituationalModifiers(testData, _loc('opposingWeaponSize'), this._compareWeaponReach(weapon, testData));
    }
    const result = await this._rollSingleD20(
      roll,
      isAttack ? Number(source.system.at.value) : Number(source.system.pa),
      testData.mode,
      await this._situationalModifiers(testData),
      testData,
      '',
      this._situationalMultipliers(testData),
    );

    await this.getDuplicatusRoll(result, testData);

    const success = result.successLevel > 0;

    await this.detailedWeaponResult(result, testData, source);

    if (isAttack && success) {
      await DiceDSA5.evaluateDamage(testData, result, source, !isMelee, result.doubleDamage);
    }
    result.rollType = 'weapon';
    const effect = DiceDSA5.parseEffect(source);
    if (effect) result['parsedEffect'] = effect;

    return result;
  }

  /**
   * Convert a string containing dice notation to a roll result
   * @param {string} text - Text containing dice notation
   * @param {Object} testData - Optional test data for dice animations
   * @returns {Promise<number>} Evaluated roll result
   */
  static async _stringToRoll(text, testData) {
    try {
      const diceMatches = [];
      const modifiedText = `${text}`;
      const actor = testData ? this.#actorFromTestData(testData) : {};
      const dicePattern = new RegExp(DICE_CONSTANTS.PATTERNS.DICE_NOTATION.source, 'g');
      let match;

      while ((match = dicePattern.exec(modifiedText)) !== null) {
        diceMatches.push(match[0]);
      }

      if (diceMatches.length === 0) {
        return Roll.safeEval(text) || 0;
      }

      const rollPromises = diceMatches.map(diceNotation =>
        new Roll(this.replaceDieLocalization(diceNotation), actor.system).evaluate()
      );

      const rollResults = await Promise.all(rollPromises);

      if (testData) {
        const diceColor = game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration('ch');
        rollResults.forEach(roll =>
          this._addRollDiceSoNice(testData, roll, diceColor)
        );
      }

      let evaluationString = modifiedText;
      rollResults.forEach(roll => {
        const diceNotationRegex = new RegExp(DICE_CONSTANTS.PATTERNS.DICE_NOTATION.source, 'g');
        evaluationString = evaluationString.replace(
          diceNotationRegex,
          roll.total
        );
      });
      return Roll.safeEval(evaluationString);
    } catch (error) {
      console.error(`Error evaluating dice string "${text}":`, error);
      return 0;
    }
  }

  /**
   * Replace localized die notation (W/w) with standard notation (d)
   * @param {string} formula - Formula to convert
   * @returns {string} Converted formula
   */
  static replaceDieLocalization(formula) {
    const dicePattern = new RegExp(DICE_CONSTANTS.PATTERNS.DIE_LOCALIZATION.source, 'g');
    return formula.replace(dicePattern, 'd');
  }

  static async evaluateDamage(testData, result, weapon, isRangeWeapon, doubleDamage) {
    let rollFormula = this.replaceDieLocalization(weapon.system.damage.value);
    const overrideDamage = [];
    const dmgMultipliers = weapon.dmgMultipliers || [];
    const baseDmgMultipliers = [];
    const damageBonusDescription = {
      multipliers: dmgMultipliers.map((x) => `${x.name} *${x.val}`),
      baseMultipliers: [],
      bonusDmg: [],
      baseDmgBonus: [],
    };
    const armorPen = [];
    let bonusDmg = 0;
    let baseDmgBonus = 0;

    for (const val of testData.situationalModifiers) {
      if (val.armorPen) armorPen.push(val.armorPen);

      if (val.damageBonus) {
        if (/^\*/.test(val.damageBonus)) {
          const withoutAsterisk = Number(val.damageBonus.replace('*', ''));
          if (val.baseBonus) {
            DSA5_Utility.pushOnlyIfUnique(baseDmgMultipliers, { name: val.name, val: withoutAsterisk });
          } else {
            DSA5_Utility.pushOnlyIfUnique(dmgMultipliers, { name: val.name, val: withoutAsterisk });
          }

          continue;
        }

        const isOverride = /^=/.test(val.damageBonus);
        const rollString = `${val.damageBonus}`.replace(/^=/, '');
        const roll = await DiceDSA5._stringToRoll(rollString, testData);
        const number = roll * (val.step || 1);

        if (isOverride) {
          rollFormula = this.replaceDieLocalization(rollString);
          overrideDamage.push({ name: val.name, roll });
          continue;
        }

        val.damageBonus = roll;
        if (val.baseBonus)
          baseDmgBonus += number;
        else
          bonusDmg += number;
      }

      if (val.flatValues?.damageBonus) {
        bonusDmg += Number(val.flatValues.damageBonus) || 0;
      }
    }

    const actor = this.#actorFromTestData(testData);
    const damageRoll = testData.damageRoll || (await DiceDSA5.manualRolls(await new Roll(rollFormula, actor.system).evaluate(), 'CHAR.DAMAGE', testData.extra.options));
    let damage = damageRoll.total;
    let weaponroll = 0;

    for (const k of damageRoll.terms) {
      if (k instanceof foundry.dice.terms.Die || k.class == 'Die') {
        for (const l of k.results) {
          const discarded = !!l.discarded;
          if (!discarded) weaponroll += Number(l.result);

          result.characteristics.push({
            char: discarded ? 'discarded' : DAMAGE,
            res: l.result,
            die: 'd' + k.faces,
            discarded,
          });
        }
      }
    }

    const weaponBonus = damage - weaponroll;

    if (overrideDamage.length > 0) {
      damageBonusDescription.override = overrideDamage[0].name + ' ' + damage;
    } else {
      damage += baseDmgBonus;
      damageBonusDescription.baseDmgBonus.push(_loc('Roll') + ' ' + weaponroll);

      if (weaponBonus != 0) {
        damageBonusDescription.baseDmgBonus.push(_loc('weaponModifier') + ' ' + weaponBonus);
      }

      for (const x of testData.situationalModifiers) {
        if (x.damageBonus) {
          const isMultiplier = /^\*/.test(x.damageBonus);
          let value = isMultiplier ? x.damageBonus.replace(/\*/, '') : Number(x.damageBonus) * (x.step || 1);
          if (x.flatValues?.damageBonus) {
            value += Number(x.flatValues.damageBonus) || 0;
          }
          if (x.baseBonus) {
            if (isMultiplier)
              damageBonusDescription.baseMultipliers.push(`${x.name} ${value}`);
            else
              damageBonusDescription.baseDmgBonus.push(`${x.name} ${value}`);
          } else {
            if (isMultiplier)
              damageBonusDescription.multipliers.push(`${x.name} ${value}`);
            else
              damageBonusDescription.bonusDmg.push(`${x.name} ${value}`);
          }
        }
      }

      const bloodrushModifier = testData.situationalModifiers.find((x) => x.name.indexOf(_loc('CONDITION.bloodrush')) > -1);
      if (bloodrushModifier) {
        damage += 2;
        damageBonusDescription.baseDmgBonus.push(_loc('CONDITION.bloodrush') + ' ' + 2);
      }

      if (weapon.extraDamage) {
        damage = Number(weapon.extraDamage) + Number(damage);
        damageBonusDescription.baseDmgBonus.push(_loc('damageThreshold') + ' ' + weapon.extraDamage);
      }

      const status = actor.system[isRangeWeapon ? 'rangeStats' : 'meleeStats'].damage;
      const statusDmg = await DiceDSA5._stringToRoll(status, testData);
      if (statusDmg != 0) {
        damage += statusDmg;
        damageBonusDescription.baseDmgBonus.push(_loc('statuseffects') + ' ' + statusDmg);
      }

      const combatskill = getProperty(weapon, 'system.combatskill.value');
      const ktwDamage = actor.system.skillModifiers.combat.damage.reduce((prev, x) => {
        return x.target == combatskill ? prev + Number(x.value) : prev;
      }, 0);

      if (ktwDamage) {
        damage += ktwDamage;
        damageBonusDescription.baseDmgBonus.push(`${_loc('TYPES.Item.combatskill')} (${_loc('CHARAbbrev.damage')}) ${ktwDamage}`);
      }

      for (const el of baseDmgMultipliers) {
        damage *= el.val;
      }

      damage += bonusDmg;
    }

    if (doubleDamage) {
      damage *= doubleDamage;
      damageBonusDescription.multipliers.push(_loc('doubleDamage', { x: doubleDamage }));
    }

    for (const el of dmgMultipliers) {
      damage *= el.val;
    }

    result.armorPen = armorPen;
    result.damagedescription = DiceDSA5.buildBonusDescription(damageBonusDescription);
    result.damage = Math.round(damage);
    result.damageRoll = duplicate(damageRoll);
  }

  /**
   * Build a formatted description of damage bonuses and multipliers
   * @param {Object} damageBonusDescription - Object containing bonus arrays
   * @returns {string} Formatted bonus description
   */
  static buildBonusDescription(damageBonusDescription) {
    const {
      override,
      baseDmgBonus = [],
      bonusDmg = [],
      baseMultipliers = [],
      multipliers = []
    } = damageBonusDescription;

    if (override) return override;

    let formula = this.#buildBaseDamageFormula(baseDmgBonus, baseMultipliers);
    formula = this.#addBonusDamage(formula, bonusDmg);
    formula = this.#applyFinalMultipliers(formula, multipliers);

    return formula;
  }

  /**
   * Build base damage formula with base multipliers
   * @param {Array} baseDmgBonus - Base damage bonus components
   * @param {Array} baseMultipliers - Base multiplier components  
   * @returns {string} Base formula part
   */
  static #buildBaseDamageFormula(baseDmgBonus, baseMultipliers) {
    if (baseDmgBonus.length === 0) return '';

    let basePart = baseDmgBonus.join(' + ');

    if (baseMultipliers.length > 0) {
      const multiplierPart = baseMultipliers.join(' * ');
      basePart = baseDmgBonus.length > 1 ? `(${basePart})` : basePart;
      basePart = `${basePart} * ${multiplierPart}`;
    }

    return basePart;
  }

  /**
   * Add bonus damage to the formula
   * @param {string} basePart - Base formula part
   * @param {Array} bonusDmg - Bonus damage components
   * @returns {string} Formula with bonus damage added
   */
  static #addBonusDamage(basePart, bonusDmg) {
    if (bonusDmg.length === 0) return basePart;

    const bonusPart = bonusDmg.join(' + ');
    return basePart ? `${basePart} + ${bonusPart}` : bonusPart;
  }

  /**
   * Apply final multipliers to the complete formula
   * @param {string} formula - Current formula
   * @param {Array} multipliers - Final multiplier components
   * @returns {string} Complete formula with final multipliers
   */
  static #applyFinalMultipliers(formula, multipliers) {
    if (multipliers.length === 0) return formula;

    const multiplierPart = multipliers.join(' * ');
    return `(${formula}) * ${multiplierPart}`;
  }

  static async rollWeapon(testData) {
    const roll = testData.roll || (await new Roll('1d20').evaluate());
    let weapon;

    const source = testData.source;
    const combatskill = source.system.combatskill.value;
    const actor = this.#actorFromTestData(testData);

    const skill = CombatskillData._calculateCombatSkillValues(
      actor.items.find((x) => x.type == 'combatskill' && x.name == combatskill),
      actor.system,
      {
        step: await this._situationalModifiers(testData, 'step'),
        [testData.mode]: await this._situationalModifiers(testData, testData.mode),
      },
    );

    const isMelee = source.type == 'meleeweapon';
    if (isMelee) {
      weapon = Actordsa5._prepareMeleeWeapon(source, [skill], actor);
      if (testData.mode == ATTACK) {
        this._appendSituationalModifiers(testData, _loc('opposingWeaponSize'), this._compareWeaponReach(weapon, testData));
      }
    } else {
      weapon = Actordsa5._prepareRangeWeapon(source, [], [skill], actor);
    }
    const result = await this._rollSingleD20(
      roll,
      weapon[testData.mode],
      testData.mode,
      await this._situationalModifiers(testData),
      testData,
      combatskill,
      this._situationalMultipliers(testData),
    );

    await this.getDuplicatusRoll(result, testData);
    await this.detailedWeaponResult(result, testData, source);

    if (testData.mode == ATTACK && result.successLevel > 0 && !testData.extra.counterAttack)
      await DiceDSA5.evaluateDamage(testData, result, weapon, !isMelee, result.doubleDamage);

    if (testData.extra.counterAttack) {
      this.#actorFromTestData(testData).addCondition('stunned');
      result.description += ', ' + DSA5_Utility.replaceConditions(_loc('stunnedByCounterAttack'));
    }

    result.rollType = 'weapon';
    const effect = DiceDSA5.parseEffect(weapon);

    if (effect) result.parsedEffect = effect;

    return result;
  }

  static _weaponBotchCritEffect(source, key, actor) {
    const result = [];
    for (const effect of source.effects) {
      for (const change of effect.system?.changes || []) {
        if (change.key == key) {
          if (change.value == 'description') {
            result.push(effect.description);
          } else if (/^condition /.test(change.value)) {
            const value = change.value.replace(/^condition /, '').split(' ');
            const count = Number(value[1]) || 1;
            const condition = _loc(`CONDITION.${value[0]}`);
            const msg = DSA5_Utility.replaceConditions(
              _loc('CHATNOTIFICATION.suffersCondition', {
                actor: actor.name,
                condition,
                count,
              }),
            );
            result.push(`<p>${msg}</p>`);
          }
        }
      }
    }
    return result.join('<br/>');
  }

  static async detailedWeaponResult(result, testData, source) {
    const isAttack = testData.mode == ATTACK && !testData.extra.counterAttack;
    const isMelee = source.type == 'meleeweapon' || getProperty(source, 'system.traitType.value') == 'meleeAttack';
    const actor = this.#actorFromTestData(testData);
    switch (result.successLevel) {
      case 3:
        if (isAttack) {
          if (await DSATables.tableEnabledFor('criticalAttack')) {
            result.description += DSATables.rollCritBotchButton('criticalAttack', false, testData);
          } else {
            result.description += DSATables.defaultAttackCrit(true);
            result.doubleDamage = 2;
          }
          result.halfDefense = true;
        } else {
          if (testData.isRangeDefense && (await DSATables.tableEnabledFor('criticalRangeDefense'))) {
            result.description += DSATables.rollCritBotchButton('criticalRangeDefense', false, testData);
          } else if (await DSATables.tableEnabledFor('criticalMeleeDefense')) {
            result.description += DSATables.rollCritBotchButton('criticalMeleeDefense', false, testData);
          } else {
            result.description += DSATables.defaultParryCrit();
          }
        }
        result.description += this._weaponBotchCritEffect(source, 'self.criteffect', actor);
        break;
      case -3:
        const isWeaponless = getProperty(source, 'system.combatskill.value') == _loc('LocalizedIDs.wrestle') || source.type == 'trait';
        if (isAttack && isMelee && (await DSATables.tableEnabledFor('Melee'))) result.description += DSATables.rollCritBotchButton('Melee', isWeaponless, testData);
        else if (isAttack && (await DSATables.tableEnabledFor('Range'))) result.description += DSATables.rollCritBotchButton('Range', false, testData);
        else if (!isAttack && (await DSATables.tableEnabledFor('Defense'))) result.description += DSATables.rollCritBotchButton('Defense', isWeaponless, testData);
        else result.description += await DSATables.defaultBotch();

        result.description += this._weaponBotchCritEffect(source, 'self.botcheffect', actor);
        break;
      case 2:
        if (isAttack) {
          result.description += DSATables.defaultAttackCrit(false);
          result.halfDefense = true;
        }
        break;
      case -2:
        break;
    }
  }

  static async _addRollDiceSoNice(testData, roll, color) {
    if (testData.messageMode) {
      for (let i = 0; i < roll.dice.length; i++) mergeObject(roll.dice[i].options, color);

      await this.showDiceSoNice(roll, testData.messageMode);
    }
  }

  static async rollCombatskill(testData) {
    const roll = testData.roll ? testData.roll : await new Roll('1d20').evaluate();
    const actor = this.#actorFromTestData(testData);
    const source = CombatskillData._calculateCombatSkillValues(testData.source, actor.system);
    const result = await this._rollSingleD20(
      roll,
      source.system[testData.mode].value,
      testData.mode,
      await this._situationalModifiers(testData),
      testData,
      '',
      this._situationalMultipliers(testData),
    );
    await this.detailedWeaponResult(result, testData, source);
    result.rollType = 'combatskill';
    return result;
  }

  /**
   * Handle manual roll input for cheating or physical dice
   * @param {Roll} roll - The roll to potentially modify
   * @param {string} description - Description for the roll dialog
   * @param {Object} options - Roll options including cheat mode
   * @returns {Promise<Roll>} Modified or original roll
   */
  static async manualRolls(roll, description = '', options = {}) {
    const { cheat, predefinedResult } = options;
    const shouldShowDialog = this.#shouldShowManualRollDialog(cheat, predefinedResult, description);

    if (!shouldShowDialog) {
      return roll;
    }

    if (predefinedResult) {
      roll.editRollAtIndex(predefinedResult);
      return roll;
    }

    const diceInfo = this.#extractDiceInfo(roll);
    const userInput = await this.#showManualRollDialog(diceInfo, description, cheat);

    if (userInput.confirmed) {
      roll.editRollAtIndex(userInput.changes);
    }

    return roll;
  }

  /**
   * Determine if manual roll dialog should be shown
   * @param {boolean} cheat - Cheat mode enabled
   * @param {*} predefinedResult - Predefined result exists
   * @param {string} description - Roll description
   * @returns {boolean}
   */
  static #shouldShowManualRollDialog(cheat, predefinedResult, description) {
    const allowPhysicalDice = game.settings.get('dsa5', 'allowPhysicalDice');
    const isDamageRoll = description === 'CHAR.DAMAGE';

    // Don't show dialog for damage rolls with predefined results unless cheating
    if (predefinedResult && isDamageRoll && !cheat) {
      return false;
    }

    return cheat || allowPhysicalDice;
  }

  /**
   * Extract dice information from roll for dialog display
   * @param {Roll} roll - Roll to extract dice from
   * @returns {Array} Array of dice info objects
   */
  static #extractDiceInfo(roll) {
    const dice = [];

    roll.terms.forEach(term => {
      if (term instanceof foundry.dice.terms.Die || term.class === 'Die') {
        term.results.forEach(result => {
          dice.push({
            faces: term.faces,
            val: result.result
          });
        });
      }
    });

    return dice;
  }

  /**
   * Show manual roll dialog and get user input
   * @param {Array} diceInfo - Information about dice to display
   * @param {string} description - Roll description
   * @param {boolean} isCheat - Whether this is cheat mode
   * @returns {Promise<Object>} User input result
   */
  static async #showManualRollDialog(diceInfo, description, isCheat) {
    const content = await renderTemplate(DICE_CONSTANTS.TEMPLATES.MANUAL_ROLL, {
      dice: diceInfo,
      description,
    });

    const titleKey = isCheat ? 'DIALOG.cheat' : 'DSASETTINGS.allowPhysicalDice';

    return new Promise((resolve) => {
      new DSA5Dialog({
        window: { title: titleKey },
        content,
        buttons: [
          {
            action: 'ok',
            icon: 'fa fa-check',
            label: 'yes',
            callback: (event, button, dlg) => {
              const changes = this.#extractChangesFromForm($(button.form));
              resolve({ confirmed: true, changes });
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => resolve({ confirmed: false, changes: [] }),
          },
        ],
      }).render(true);
    });
  }

  /**
   * Extract dice value changes from form
   * @param {jQuery} form - Form element
   * @returns {Array} Array of change objects
   */
  static #extractChangesFromForm(form) {
    const changes = [];

    form.find('.dieInput').each(function (index) {
      const value = Number($(this).val());
      if (value > 0) {
        changes.push({ val: value, index });
      }
    });

    return changes;
  }

  static parseEffect(source) {
    const effectString = source.system.effect ? source.system.effect.value : undefined;
    const result = [];
    if (effectString) {
      const regex = /^[a-z]+\|[öäüÖÄÜa-zA-z ()]+$/;

      for (const k of effectString.split(';')) {
        if (regex.test(k.trim())) {
          const split = k.split('|').map((x) => x.trim());
          if (split[0] == 'condition') {
            const effect = CONFIG.statusEffects.find((x) => x.id == split[1]);
            result.push(`<a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.img}"/>${_loc(effect.name)}</a>`);
          } else {
            let category = `TYPES.Item.${split[0]}`;
            if (!game.i18n.has(category)) category = split[0];

            result.push(
              `<a class="roll-button roll-item" data-name="${split[1]}" data-type="${split[0]}"><i class="fas fa-dice"></i>${_loc(category)}: ${split[1]}</a>`,
            );
          }
        }
      }
    }
    const poison = getProperty(source, 'flags.dsa5.poison');
    if (poison) {
      result.push(
        `<a class="roll-button roll-item" data-removecharge="${!poison.permanent}" data-name="${poison.name}"
        data-type="poison"><i class="fas fa-dice"></i>${_loc('TYPES.Item.poison')}: ${poison.name}</a>`,
      );
    }
    return result.join(', ');
  }

  static async calculateEnergyCost(isClerical, res, testData) {
    let costModifiers = [];
    let weakBody;
    let energy;
    let globalMod;
    let feature;
    const actor = this.#actorFromTestData(testData);
    if (res.successLevel < 0) {
      const traditions = ['traditionWitch', 'traditionFjarning', 'braniborian'].map((x) => _loc(`LocalizedIDs.${x}`));
      const factor = actor.items.some((x) => x.type == 'specialability' && traditions.includes(x.name)) ? 3 : 2;
      res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.finalcost / factor);
    }

    if (isClerical) {
      feature = 'KaPCost';
      weakBody = _loc('LocalizedIDs.weakKarmicBody');
      energy = _loc(`LocalizedIDs.${res.successLevel > 0 ? 'mightyKarmaControl' : 'karmaControl'}`);
      globalMod = { val: 'kapModifier', name: 'KaP' };
    } else {
      feature = 'AsPCost';
      weakBody = _loc('LocalizedIDs.weakAstralBody');
      energy = _loc(`LocalizedIDs.${res.successLevel > 0 ? 'energyControl' : 'smallEnergyControl'}`);
      globalMod = { val: 'aspModifier', name: 'AsP' };
    }
    costModifiers.push(
      {
        name: weakBody,
        value: AdvantageRulesDSA5.vantageStep(actor, weakBody, false),
      },
      {
        name: energy,
        value: SpecialabilityRulesDSA5.abilityStep(actor, energy, false) * -1,
      },
      {
        name: `${_loc('statuseffects')} (${_loc('CHARAbbrev.' + globalMod.name)})`,
        value: actor.system[globalMod.val] + (await this._situationalModifiers(testData, feature)),
      },
    );
    costModifiers = costModifiers.filter((x) => x.value != 0);
    res.preData.calculatedSpellModifiers.description = costModifiers.map((x) => `${x.name} ${x.value}`).join('\n');
    res.preData.calculatedSpellModifiers.finalcost = Math.max(
      1,
      Number(res.preData.calculatedSpellModifiers.finalcost) +
      costModifiers.reduce((b, a) => {
        return b + a.value;
      }, 0),
    );
    if (res.successLevel > 0 && res.preData.calculatedSpellModifiers.maintainCost != 0) {
      const mtCost = res.preData.calculatedSpellModifiers.maintainCost.split(' ');
      mtCost[0] = Math.round(Number(mtCost[0]));
      res.preData.calculatedSpellModifiers.finalcost += mtCost[0];
      res.preData.calculatedSpellModifiers.maintainCost = mtCost.join(' ');
    }
  }

  static #actorFromTestData(testData) {
    return DSA5_Utility.getSpeaker(testData.extra.speaker);
  }

  static async rollSpell(testData) {
    await this.consumeAction(testData);
    const res = await this._rollThreeD20(testData);
    const isClerical = [CEREMONY, LITURGY].includes(testData.source.type);
    res.rollType = testData.source.type;
    const actor = this.#actorFromTestData(testData);
    res.preData.calculatedSpellModifiers.finalcost = res.preData.calculatedSpellModifiers.cost;
    if (res.successLevel >= 2) {
      const extraFps = (await new Roll('1d6').evaluate()).total;
      res.description = res.description + ', ' + _loc('additionalFPs') + ' ' + extraFps;
      res.result += extraFps;
      res.qualityStep = Math.min(game.settings.get('dsa5', 'capQSat'), Math.ceil(res.result / 3));
      res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.cost / 2);
    } else if (res.successLevel <= -2) {
      res.description += DSATables.rollCritBotchButton(isClerical ? 'Liturgy' : 'Spell', false, testData);
    }

    if (res.successLevel > 0) {
      if (testData.source.system.effectFormula.value != '') {
        const replaceQS = new RegExp(`(QL|QS|${_loc('CHARAbbrev.QS')})`, 'g');
        let formula = DiceDSA5.replaceDieLocalization(testData.source.system.effectFormula.value.replaceAll(replaceQS, res.qualityStep));
        const armorPen = [];
        for (const mod of testData.situationalModifiers) {
          if (mod.armorPen) armorPen.push(mod.armorPen);
        }
        if (/(,|;)/.test(formula)) formula = formula.split(/[,;]/)[res.qualityStep - 1];

        const rollEffect = testData.damageRoll
          ? testData.damageRoll
          : await DiceDSA5.manualRolls(await new Roll(formula, actor.system).evaluate(), 'CHAR.DAMAGE', testData.extra.options);

        this._addRollDiceSoNice(testData, rollEffect, game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration(DAMAGE));
        res['calculatedEffectFormula'] = formula;
        for (const k of rollEffect.terms) {
          if (k instanceof foundry.dice.terms.Die || k.class == 'Die')
            for (const l of k.results)
              res['characteristics'].push({
                char: 'effect',
                res: l.result,
                die: 'd' + k.faces,
              });
        }
        const damageBonusDescription = [];
        const statusDmg = await DiceDSA5._stringToRoll(actor.system[isClerical ? 'liturgyStats' : 'spellStats'].damage, testData);
        if (statusDmg != 0) {
          damageBonusDescription.push(_loc('statuseffects') + ' ' + statusDmg);
        }
        res.armorPen = armorPen;
        res.damageRoll = rollEffect;
        res.damage = rollEffect.total + statusDmg;
        res.damagedescription = damageBonusDescription.join('\n');
      }
    }

    await this.calculateEnergyCost(isClerical, res, testData);
    await this.getDuplicatusRoll(res, testData);

    for (const creature of ['minorFairies', 'minorSpirits']) {
      const name = _loc('CONDITION.' + creature);
      if (AdvantageRulesDSA5.hasVantage(actor, name, false) && !actor.effects.find((x) => x.name == name)) {
        const ghostroll = await new Roll('1d20').evaluate();
        if (ghostroll.total <= res.preData.calculatedSpellModifiers.finalcost) {
          res.description += ', ' + _loc('minorghostsappear', { creature: name });
          this.#actorFromTestData(testData).addCondition(creature);
        }
      }
    }

    return res;
  }

  static async _rollThreeD20(testData) {
    const roll = testData.roll ? (testData.roll instanceof Roll ? testData.roll : Roll.fromData(testData.roll)) : await new Roll('1d20+1d20+1d20').evaluate();
    let description = [];
    let successLevel = 0;
    const actor = this.#actorFromTestData(testData);

    this._appendSituationalModifiers(testData, _loc('Difficulty'), testData.testDifficulty);
    const modifiers = await this._situationalModifiers(testData);

    let fws = Number(testData.source.system.talentValue.value) + testData.advancedModifiers.fws + (await this._situationalModifiers(testData, 'FW'));
    const pcms = this._situationalPartCheckModifiers(testData, DICE_CONSTANTS.MODIFIER_TYPES.TPM);

    const tar = [1, 2, 3].map(
      (x) => actor.system.characteristics[testData.source.system[`characteristic${x}`].value].value + modifiers + testData.advancedModifiers.chars[x - 1] + pcms[x - 1],
    );
    const res = [0, 1, 2].map((x) => roll.terms[x * 2].results[0].result - tar[x]);

    if (testData.routine) fws = Math.round(fws / 2);
    else for (const k of res) if (k > 0) fws -= k;

    const crit = actor.system.skillModifiers.crit;
    let botch = actor.system.skillModifiers.botch;
    if ([SPELL, RITUAL].includes(testData.source.type) && AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.wildMagic')) botch = 19;

    if (testData.source.type == SKILL && AdvantageRulesDSA5.hasVantage(actor, `${_loc('LocalizedIDs.incompetent')} (${testData.source.name})`, false)) {
      const reroll = await new Roll('1d20').evaluate();
      const indexOfMinValue = res.reduce((iMin, x, i, arr) => (x < arr[iMin] ? i : iMin), 0);
      const oldValue = roll.terms[indexOfMinValue * 2].total;
      fws += Math.max(res[indexOfMinValue], 0);
      fws -= Math.max(0, reroll.total - tar[indexOfMinValue]);
      roll.editRollAtIndex([{ index: indexOfMinValue, val: reroll.total }]);
      this._addRollDiceSoNice(testData, reroll, roll.terms[indexOfMinValue * 2].options);
      description.push(
        _loc('CHATNOTIFICATION.unableReroll', {
          die: indexOfMinValue + 1,
          oldVal: oldValue,
          newVal: reroll.total,
        }),
      );
    }
    let automaticResult = 0;
    if (testData.source.type == SKILL && TraitRulesDSA5.hasTrait(actor, `${_loc('LocalizedIDs.automaticSuccess')} (${testData.source.name})`, false)) {
      description.push(_loc('LocalizedIDs.automaticSuccess'));
      successLevel = 1;
      automaticResult = 1;
    } else if (testData.source.type == SKILL && TraitRulesDSA5.hasTrait(actor, `${_loc('LocalizedIDs.automaticFail')} (${testData.source.name})`, false)) {
      description.push(_loc('LocalizedIDs.automaticFail'));
      successLevel = -1;
    } else {
      successLevel = DiceDSA5.get3D20SuccessLevel(roll, fws, botch, crit);
      if (testData.routine) successLevel = 1;

      description.push(DiceDSA5.getSuccessDescription(successLevel));
    }

    description = description.join(', ');
    let qualityStep = 0;

    if (successLevel > 0) {
      fws += await this._situationalModifiers(testData, DICE_CONSTANTS.MODIFIER_TYPES.FP);
      qualityStep =
        Math.max(1, (fws == 0 ? 1 : fws > 0 ? Math.ceil(fws / 3) : 0) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0)) +
        (testData.advancedModifiers.qls || 0) +
        (await this._situationalModifiers(testData, DICE_CONSTANTS.MODIFIER_TYPES.QL));
    }

    qualityStep = Math.min(game.settings.get('dsa5', 'capQSat'), qualityStep);
    if (qualityStep < automaticResult) qualityStep = automaticResult;

    return {
      result: fws,
      characteristics: [0, 1, 2].map((x) => {
        return {
          char: testData.source.system[`characteristic${x + 1}`].value,
          res: roll.terms[x * 2].results[0].result,
          suc: res[x] <= 0,
          tar: tar[x],
        };
      }),
      qualityStep,
      description,
      preData: testData,
      successLevel,
      modifiers,
      extra: {},
    };
  }

  static async rollTalent(testData) {
    const res = await this._rollThreeD20(testData);
    res.rollType = 'talent';
    return res;
  }

  /**
   * Determine success level for three D20 rolls
   * @param {Roll} roll - The roll object containing three D20s
   * @param {number} fws - Fertigkeitswert (skill value) remaining
   * @param {number} botch - Botch threshold (default 20)
   * @param {number} critical - Critical threshold (default 1)
   * @returns {number} Success level (-3 to 3)
   */
  static get3D20SuccessLevel(
    roll,
    fws,
    botch = DICE_CONSTANTS.DICE.DEFAULT_BOTCH,
    critical = DICE_CONSTANTS.DICE.DEFAULT_CRIT
  ) {
    const diceResults = roll.terms
      .filter(term => term.results)
      .map(term => term.results[0].result);

    const criticalCount = diceResults.filter(result => result <= critical).length;
    const botchCount = diceResults.filter(result => result >= botch).length;

    if (criticalCount >= 2) return criticalCount;
    if (botchCount >= 2) return botchCount * -1;

    return fws >= 0 ? 1 : -1;
  }

  /**
   * Get localized description for success level
   * @param {number} successLevel - Success level from -3 to 3
   * @returns {string} Localized success description
   */
  static getSuccessDescription(successLevel) {
    const index = Math.max(0, Math.min(6, successLevel + 3));
    const descriptionKey = DICE_CONSTANTS.SUCCESS_DESCRIPTIONS[index];
    return _loc(descriptionKey);
  }

  static async rollItem(testData) {
    const roll = testData.roll || (await new Roll('1d20+1d20+1d20').evaluate());
    let description = [];
    const modifier = await this._situationalModifiers(testData);
    let fws = Number(testData.source.system.step.value);
    const tar = [1, 2, 3].map((x) => 10 + Number(testData.source.system.step.value) + modifier);
    const res = [0, 1, 2].map((x) => roll.terms[x * 2].results[0].result - tar[x]);
    for (const k of res) {
      if (k > 0) fws -= k;
    }

    const botch = 20;

    const successLevel = DiceDSA5.get3D20SuccessLevel(roll, fws, botch);
    description.push(DiceDSA5.getSuccessDescription(successLevel));

    description = description.join(', ');

    const result = {
      result: fws,
      characteristics: [0, 1, 2].map((x) => {
        return {
          char: testData.source.type,
          res: roll.terms[x * 2].results[0].result,
          suc: res[x] <= 0,
          tar: tar[x],
        };
      }),
      qualityStep: Math.min(
        game.settings.get('dsa5', 'capQSat'),
        (fws == 0 ? 1 : fws > 0 ? Math.ceil(fws / 3) : 0) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0),
      ),
      description,
      preData: testData,
      successLevel,
      modifiers: modifier,
      extra: {},
    };
    switch (testData.source.type) {
      case ROLL_TYPES.POISON:
        const dur = testData.source.system.duration.value.split(' / ').map((x) => x.trim());
        const effect = testData.source.system.effect.value.split(' / ').map((x) => x.trim());
        result.duration = dur.length > 1 ? (result.successLevel > 0 ? dur[0] : dur[1]) : dur[0];
        result.effect = effect.length > 1 ? (result.successLevel > 0 ? effect[0] : effect[1]) : effect[0];
        break;
      case ROLL_TYPES.DISEASE:
        const dmg = testData.source.system.damage.value.split(' / ').map((x) => x.trim());
        const duration = testData.source.system.duration.value.split(' / ').map((x) => x.trim());
        result.damageeffect = dmg.length > 1 ? (result.successLevel > 0 ? dmg[0] : dmg[1]) : dmg[0];
        result.duration = duration.length > 1 ? (result.successLevel > 0 ? duration[0] : duration[1]) : duration[0];
        break;
    }
    return result;
  }

  static async updateDefenseCount(testData) {
    if (game.combat && !testData.fateUsed) await game.combat.updateDefenseCount(testData.extra.speaker);
  }

  static async consumeAction(testData, cost = 1) {
    if (!game.combat || testData.fateUsed) return;

    const costMod = Number(testData.extra?.actor?.system?.combat?.actionCostMod) || 0;
    const effectiveCost = Math.max(0, cost + costMod);
    if (effectiveCost <= 0) return;

    await game.combat.updateActionCount(testData.extra.speaker, effectiveCost);
  }

  static _compareWeaponReach(weapon, testData) {
    const circumvent = testData.situationalModifiers.find((x) => x.name == _loc('LocalizedIDs.circumvent'));
    if (circumvent) {
      const attacker = DSA5.meleeRangesArray.indexOf(weapon.system.reach.value);
      const defender = DSA5.meleeRangesArray.indexOf(testData.opposingWeaponSize);
      if (defender > attacker) circumvent.value = Math.min(circumvent.step, defender - attacker) * 2;
    }

    return DSA5.weaponReachModifiers[weapon.system.reach.value]?.[testData.opposingWeaponSize] ?? 0;
  }

  /**
   * Show dice animation using Dice So Nice module
   * @param {Roll} roll - Roll to animate
   * @param {string} messageMode - Roll mode for visibility
   * @returns {Promise<void>}
   */
  static async showDiceSoNice(roll, messageMode) {
    if (!DSA5_Utility.moduleEnabled('dice-so-nice') || !game.dice3d) return;

    const { whisper, blind } = this.#getDiceVisibilitySettings(messageMode);
    const promise = game.dice3d.showForRoll(roll, game.user, true, whisper, blind);

    if (!game.settings.get('dice-so-nice', 'immediatelyDisplayChatMessages')) {
      await promise;
    }
  }

  /**
   * Get visibility settings for dice animation based on roll mode
   * @param {string} messageMode - The roll mode
   * @returns {Object} Visibility settings
   */
  static #getDiceVisibilitySettings(messageMode) {
    const gmUsers = game.users.filter(user => user.isGM).map(user => user.id);

    const visibilityMap = {
      [CHAT_MODES.BLIND]: {
        whisper: gmUsers,
        blind: true
      },
      [CHAT_MODES.GM]: {
        whisper: gmUsers,
        blind: false
      },
      [CHAT_MODES.SELF]: {
        whisper: [],
        blind: false
      },
    };

    return visibilityMap[messageMode] || { whisper: null, blind: false };
  }

  static addApplyEffectData(testData) {
    const pre = testData.preData || {};
    const source = pre.source;
    const successLevel = typeof testData.successLevel !== 'undefined' ? testData.successLevel : (pre.successLevel || 0);

    if (!source) return false;

    const isWeaponLike =
      ['meleeweapon', 'rangeweapon'].includes(source.type) ||
      (source.type === 'trait' && ['rangeAttack', 'meleeAttack'].includes(source.system.traitType.value));

    if (successLevel > 0 && isWeaponLike) {
      if ((source.effects || []).some(e => !e.system.applyToOwner)) return true;
    }

    const spellLikeTypes = [SPELL, LITURGY, RITUAL, CEREMONY, 'trait', SKILL];
    if (successLevel > 0 && spellLikeTypes.includes(source.type)) {
      if ((source.effects || []).length > 0) return true;
    }

    if ([ROLL_TYPES.POISON, ROLL_TYPES.DISEASE].includes(source.type)) {
      const wanted = successLevel > 0 ? 1 : 2;
      const effects = source.effects || [];
      return effects.some(e => e.system.successEffect == wanted);
    }

    const modifiers = pre.situationalModifiers || testData?.situationalModifiers || [];
    const refIds = modifiers.filter(m => m?.ref?.id).map(m => m.ref.id);

    if (refIds.length > 0) {
      const actor = DSA5_Utility.getSpeaker(pre.extra?.speaker || testData.extra?.speaker);
      if (!actor) return false;

      return refIds.some(i => actor.items.get(i)?.effects?.size > 0);
    }

    return false;
  }

  static async renderRollCard(chatOptions, testData, rerenderMessage) {
    const previousOther = rerenderMessage ? getProperty(rerenderMessage, 'flags.data.postData.other') : undefined;
    const applyEffect = this.addApplyEffectData(testData);
    const immuneTo = CreatureType.checkImmunity(testData);
    const preData = deepClone(testData.preData);
    const hideDamage = rerenderMessage ? rerenderMessage.flags.data.hideDamage : preData.mode == ATTACK;
    await DSATriggers.postRoll({ testData, preData });
    Hooks.call('postProcessDSARoll', chatOptions, testData, rerenderMessage, hideDamage);
    await DSA5_Utility.callAsyncHooks('postProcessDSARoll', [testData]);
    delete testData.actor;
    delete testData.preData;

    if (preData.roll instanceof Roll) preData.roll = preData.roll.toJSON();
    if (preData.damageRoll instanceof Roll) preData.damageRoll = preData.damageRoll.toJSON();

    const hasAreaTemplate = testData.successLevel > 0 && preData.source.system.target && preData.source.system.target.type in game.dsa5.config.areaTargetTypes;

    const chatData = {
      title: chatOptions.title,
      immuneTo,
      testData,
      hideData: { value: game.user.isGM },
      preData,
      hideDamage,
      modifierList: preData.situationalModifiers.filter((x) => x.value != 0),
      applyEffect,
      hasAreaTemplate,
      showDamageToGear: await EquipmentDamage.showDamageToGear(preData, testData),
    };

    if (preData.advancedModifiers) {
      if (preData.advancedModifiers.chars.some((x) => x != 0))
        chatData.modifierList.push({
          name: _loc('MODS.partChecks'),
          value: preData.advancedModifiers.chars,
        });
      if (preData.advancedModifiers.fws != 0)
        chatData.modifierList.push({
          name: _loc('MODS.FW'),
          value: preData.advancedModifiers.fws,
        });
      if (preData.advancedModifiers.qls != 0)
        chatData.modifierList.push({
          name: _loc('MODS.QS'),
          value: preData.advancedModifiers.qls,
        });
    }

    if ([CHAT_MODES.GM, CHAT_MODES.BLIND].includes(chatOptions.messageMode)) chatOptions.whisper = game.users.filter((user) => user.isGM).map((x) => x.id);
    if (chatOptions.messageMode === CHAT_MODES.BLIND) chatOptions.blind = true;
    else if (chatOptions.messageMode === CHAT_MODES.SELF) chatOptions.whisper = [game.user.id];

    DSA5SoundEffect.playEffect(preData.mode, preData.source, testData.successLevel, chatOptions.whisper, chatOptions.blind);

    mergeObject(chatOptions, {
      flags: {
        data: {
          preData,
          postData: testData,
          template: chatOptions.template,
          messageMode: chatOptions.messageMode,
          isOpposedTest: chatOptions.isOpposedTest,
          title: chatOptions.title,
          hideData: { value: chatData.hideData.value },
          hideDamage: chatData.hideDamage,
          isDSARoll: true,
        },
      },
    });
    if (!rerenderMessage) {
      chatOptions.content = await renderTemplate(chatOptions.template, chatData);
      return await ChatMessage.create(chatOptions);
    } else {
      const postFunction = getProperty(rerenderMessage, 'flags.data.preData.extra.options.postFunction');
      if (postFunction) {
        testData.messageId = rerenderMessage.id;
        await eval(postFunction.functionName)(postFunction, { result: testData, chatData }, preData.source);
      }

      // Keep additional info blocks (testData.other) stable across rerenders.
      if (Array.isArray(previousOther) && previousOther.length) {
        if (!Array.isArray(testData.other) || testData.other.length === 0) {
          testData.other = deepClone(previousOther);
        } else {
          for (const entry of previousOther) {
            if (!testData.other.includes(entry)) testData.other.push(entry);
          }
        }
      }

      const html = await renderTemplate(chatOptions.template, chatData);
      //Seems to be a foundry bug, after edit inline rolls are not converted anymore
      const actor = ChatMessage.getSpeakerActor(rerenderMessage.speaker) || game.users.get(rerenderMessage.author)?.character;
      const rollData = actor ? actor.getRollData() : {};
      const enriched = await TextEditor.enrichHTML(html, {
        rollData,
      });
      chatOptions.content = enriched;

      const newMsg = await rerenderMessage.update({
        content: chatOptions.content,
        flags: {
          data: chatOptions.flags.data,
        },
      });

      ui.chat.updateMessage(newMsg);
      return newMsg;
    }
  }

  static async _itemRoll(ev) {
    const messageId = $(ev.currentTarget).parents('.message').attr('data-message-id'),
      message = game.messages.get(messageId),
      speaker = message.speaker,
      category = ev.currentTarget.dataset.type,
      name = ev.currentTarget.dataset.name;

    const actor = DSA5_Utility.getSpeaker(speaker);

    if (actor) {
      const source = actor.items.find((x) => x.name == name && x.type == category);
      if (source) {
        const item = new Itemdsa5(source.toObject());
        const removeCharge = ev.currentTarget.dataset.removecharge == 'true';
        if (removeCharge) {
          if (item.system.quantity.value < 1) {
            ui.notifications.error('DSAError.NotEnoughCharges', {
              localize: true,
            });
            return;
          }
        }

        item.setupEffect().then(async (setupData) => {
          await item.itemTest(setupData);
          if (removeCharge)
            await source.update({
              'system.quantity.value': source.system.quantity.value - 1,
            });
        });
      } else {
        const translatedCategory = game.i18n.has('TYPES.Item.' + category) ? _loc('TYPES.Item.' + category) : category;
        ui.notifications.error(
          _loc('DSAError.notFound', {
            category: translatedCategory,
            name,
          }),
        );
      }
    }
  }

  static async _rollEdit(ev) {
    const input = $(ev.currentTarget),
      messageId = input.parents('.message').attr('data-message-id'),
      message = game.messages.get(messageId);

    const data = message.flags.data;
    const newTestData = data.preData;

    if (newTestData.extra.options.cheat) delete newTestData.extra.options.cheat;
    let index;

    switch (input.attr('data-edit-type')) {
      case 'roll':
        index = input.attr('data-edit-id');
        const newValue = Number(input.val());

        if (newTestData.roll.terms.length > index * 2) {
          const newRoll = Roll.fromData(newTestData.roll);
          newRoll.editRollAtIndex([{ index, val: newValue }]);
          newTestData.roll = newRoll;
        } else {
          const oldDamageRoll = Roll.fromData(data.postData.damageRoll);
          index = index - newTestData.roll.terms.filter((x) => x.results).length;
          oldDamageRoll.editRollAtIndex([{ index, val: newValue }]);
          newTestData.damageRoll = oldDamageRoll;
        }
        break;
      case 'mod':
        index = newTestData.situationalModifiers.findIndex((x) => x.name == _loc('chatEdit'));
        if (index > 0) newTestData.situationalModifiers.splice(index, 1);

        const newVal = {
          name: _loc('chatEdit'),
          value: Number(input.val()) - (await this._situationalModifiers(newTestData)),
        };
        newTestData.situationalModifiers.push(newVal);
        break;
    }

    if (data.postData.damageRoll && !newTestData.damageRoll) newTestData.damageRoll = data.postData.damageRoll;

    const chatOptions = {
      template: data.template,
      messageMode: data.messageMode,
      title: data.title,
      speaker: message.speaker,
      user: message.author.id,
    };

    if ([CHAT_MODES.GM, CHAT_MODES.BLIND].includes(chatOptions.messageMode)) chatOptions.whisper = game.users.filter((user) => user.isGM).map((x) => x.id);

    if (chatOptions.messageMode === CHAT_MODES.BLIND) chatOptions.blind = true;
    else if (chatOptions.messageMode === CHAT_MODES.SELF) chatOptions.whisper = [game.user.id];

    if ([ROLL_TYPES.POISON, ROLL_TYPES.DISEASE].includes(newTestData.source.type)) {
      new Itemdsa5(newTestData.source)[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions: chatOptions }, { rerenderMessage: message });
    } else {
      const speaker = DSA5_Utility.getSpeaker(message.speaker);
      speaker[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions: chatOptions }, { rerenderMessage: message });
    }
  }

  static async gearDamaged(ev) {
    const ids = ev.currentTarget.dataset.uuid.split(';');
    if (ids.length > 1) {
      const items = await Promise.all(ids.map((x) => fromUuid(x)));
      EquipmentDamageDialog.showDialog(items);
    } else {
      EquipmentDamage.breakingTest(await fromUuid(ids[0]));
    }
  }

  static async showCurrentTargets(ev) {
    const targets = [];
    let i18nkey;
    if (ev.currentTarget.dataset.target == 'target') {
      i18nkey = 'TT.applyEffectTargets';
      for (const target of game.user.targets) targets.push(target.document.texture.src);
    } else {
      i18nkey = 'TT.applyEffectCaster';
      const message = game.messages.get($(ev.currentTarget).parents('.message').attr('data-message-id'));
      let actor = DSA5_Utility.getSpeaker(message.flags.data.preData.extra.speaker);
      if (actor?.emptyActor?.parent_source_uuid) actor = await fromUuid(actor.emptyActor.parent_source_uuid);
      if (actor) targets.push(actor.token ? actor.token.texture.src : actor.prototypeToken.texture.src);
    }
    const msg = targets.length
      ? targets.map((x) => `<img style="display:inline;width:25px;height:25px;" src="${x}"/>`).join('')
      : `<small><i class="fas fa-exclamation-circle"></i> ${_loc('DIALOG.noTarget')}</small>`;
    ev.currentTarget.dataset.tooltip = `<div><p>${_loc(i18nkey)}</p><p class="center">${msg}</p></div>`;
  }

  static async rollResistPain(ev) {
    const data = ev.currentTarget.dataset;
    const target = { token: data.token, actor: data.actor, scene: canvas.id };
    const actor = DSA5_Utility.getSpeaker(target);
    if (actor) actor.finishResistPainRoll();
  }

  static async wrapLock(ev, callback) {
    const elem = $(ev.currentTarget);

    if (elem.hasClass('locked')) return;

    elem.addClass('locked');
    elem.prepend('<i class="fas fa-spinner fa-spin"></i>');
    await callback(ev, elem);
    setTimeout(() => {
      elem.removeClass('locked');
      elem.find('i').remove();
    }, 2000);
  }

  static async chatListeners(html) {
    html.on('click', '.expand-mods', (event) => {
      event.preventDefault();
      const elem = $(event.currentTarget);
      elem.find('i').toggleClass('fa-minus fa-plus');
      elem.siblings('ul,div').fadeToggle();
    });
    html.on('click', '.edit-toggle', (ev) => {
      ev.preventDefault();
      $(ev.currentTarget).parents('.chat-card').find('.display-toggle').toggle();
    });
    html.on('click', '.botch-roll', (ev) => DSATables.showBotchCard(ev.currentTarget.dataset));
    html.on('click', '.roll-item', (ev) => DiceDSA5._itemRoll(ev));
    html.on('click', '.gearDamaged', async (ev) => DiceDSA5.gearDamaged(ev));
    html.on('click', '.applyDamage', async (ev) => applyDamage(ev.currentTarget.closest('.message'), ev.currentTarget.dataset.mode));
    html.on('change', '.roll-edit', (ev) => DiceDSA5._rollEdit(ev));
    html.on('click', '.applyEffect', async (ev) => {
      DiceDSA5.wrapLock(ev, async (ev, elem) => {
        const id = elem.parents('.message').attr('data-message-id');
        const mode = ev.currentTarget.dataset.target;
        await DSAActiveEffectConfig.applyEffect(id, mode);
      });
    });
    html.on('mouseenter', '.applyEffect', (ev) => DiceDSA5.showCurrentTargets(ev));

    html.on('click', '.applyTableEffect', async (ev) => {
      DiceDSA5.wrapLock(ev, async (ev, elem) => {
        const id = elem.parents('.message').attr('data-message-id');
        const mode = ev.currentTarget.dataset.target;
        await TableEffects.applyEffect(id, mode);
      });
    });
    html.on('click', '.placeTemplate', async (ev) => DSARegionTemplate.placeTemplateFromChat(ev));
    html.on('click', '.message-delete', (ev) => {
      const message = game.messages.get($(ev.currentTarget).parents('.message').attr('data-message-id'));
      const targeted = message.flags.unopposeData;

      if (!targeted) return;

      const target = canvas.tokens.get(message.flags.unopposeData.targetSpeaker.token);
      OpposedDsa5.clearOpposed(target.actor);
    });
    html.on('click', '.resistEffect', (ev) => DSAActiveEffectConfig.resistEffect(ev));
    html.on('click', '.resistPain', (ev) => DiceDSA5.rollResistPain(ev));
    RequestRoll.chatListeners(html);
  }
}
