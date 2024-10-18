import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5 from './config-dsa5.js';
import DSA5Dialog from '../dialog/dialog-dsa5.js';
import DSA5_Utility from './utility-dsa5.js';
import AdvantageRulesDSA5 from './advantage-rules-dsa5.js';
import SpecialabilityRulesDSA5 from './specialability-rules-dsa5.js';
import TraitRulesDSA5 from './trait-rules-dsa5.js';
import Itemdsa5 from '../item/item-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import OpposedDsa5 from './opposed-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effects.js';
import DSA5SoundEffect from './dsa-soundeffect.js';
import EquipmentDamage from './equipment-damage.js';
import EquipmentDamageDialog from '../dialog/dialog-equipmentdamage.js';
import DSATables from '../tables/dsatables.js';
import RequestRoll from './request-roll.js';
import { MeasuredTemplateDSA } from './measuretemplate.js';
import TableEffects from '../tables/tableEffects.js';
import CreatureType from './creature-type.js';
import { applyDamage } from '../hooks/chat_context.js';
import DSATriggers from './triggers.js';
import RuleChaos from './rule_chaos.js';
const { mergeObject, deepClone, duplicate, getProperty } = foundry.utils;

export default class DiceDSA5 {
  static async rollTest(testData) {
    let rollResults;
    switch (testData.source.type) {
      case 'ceremony':
      case 'ritual':
      case 'liturgy':
      case 'spell':
        rollResults = await this.rollSpell(testData);
        break;
      case 'skill':
        rollResults = await this.rollTalent(testData);
        break;
      case 'combatskill':
        rollResults = await this.rollCombatskill(testData);
        break;
      case 'trait':
        if (testData.mode == 'parry') await this.updateDefenseCount(testData);
        rollResults = testData.mode == 'damage' ? await this.rollDamage(testData) : await this.rollCombatTrait(testData);
        break;
      case 'regenerate':
        rollResults = await this.rollRegeneration(testData);
        break;
      case 'meleeweapon':
      case 'rangeweapon':
        if (testData.mode == 'parry') await this.updateDefenseCount(testData);
        rollResults = testData.mode == 'damage' ? await this.rollDamage(testData) : await this.rollWeapon(testData);
        break;
      case 'dodge':
        await this.updateDefenseCount(testData);
        rollResults = await this.rollStatus(testData);
        break;
      case 'poison':
      case 'disease':
        rollResults = await this.rollItem(testData);
        break;
      case 'fallingDamage':
        rollResults = await this.rollFallingDamage(testData);
        break;
      default:
        rollResults = await this.rollAttribute(testData);
    }
    mergeObject(rollResults, deepClone(testData.extra));
    return rollResults;
  }

  static async rollDices(testData, cardOptions) {
    if (!testData.roll) {
      const d3dColors = game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration;
      let roll;
      switch (testData.source.type) {
        case 'liturgy':
        case 'spell':
        case 'ceremony':
        case 'ritual':
        case 'skill':
          roll = await new Roll('1d20+1d20+1d20').evaluate();

          mergeObject(roll.dice[0].options, d3dColors(testData.source.system.characteristic1.value));
          mergeObject(roll.dice[1].options, d3dColors(testData.source.system.characteristic2.value));
          mergeObject(roll.dice[2].options, d3dColors(testData.source.system.characteristic3.value));
          break;
        case 'regenerate':
          const leDie = [];

          if (testData.regenerateLeP) leDie.push([game.settings.get('dsa5', 'lessRegeneration') ? '1d3' : '1d6']);
          if (testData.extra.actor.isMage && testData.regenerateAsP) leDie.push('1d6');
          if (testData.extra.actor.isPriest && testData.regenerateKaP) leDie.push('1d6');

          roll = await new Roll(leDie.join('+')).evaluate();
          if (testData.regenerateLeP) mergeObject(roll.dice[0].options, d3dColors('mu'));
          if (testData.extra.actor.isMage && testData.regenerateAsP) mergeObject(roll.dice[leDie.length - 1].options, d3dColors('ge'));
          if (testData.extra.actor.isPriest && testData.regenerateKaP) mergeObject(roll.dice[leDie.length - 1].options, d3dColors('in'));
          if (testData.extra.actor.isMage && testData.regenerateAsP && testData.extra.actor.isPriest && testData.regenerateKaP)
            mergeObject(roll.dice[leDie.length - 2].options, d3dColors('ge'));
          break;
        case 'meleeweapon':
        case 'rangeweapon':
        case 'weaponless':
        case 'combatskill':
        case 'trait':
          if (testData.mode == 'damage') {
            let rollFormula = await this.damageFormula(testData);
            roll = await new Roll(rollFormula, testData.extra.actor.system).evaluate();
            for (let i = 0; i < roll.dice.length; i++) mergeObject(roll.dice[i].options, d3dColors('damage'));
          } else {
            roll = await new Roll('1d20').evaluate();
            mergeObject(roll.dice[0].options, d3dColors(testData.mode));
          }
          break;
        case 'dodge':
          roll = await new Roll('1d20').evaluate();
          mergeObject(roll.dice[0].options, d3dColors('dodge'));
          break;
        case 'poison':
        case 'disease':
          let pColor = d3dColors('in');
          roll = await new Roll('1d20+1d20+1d20').evaluate();
          mergeObject(roll.dice[0].options, pColor);
          mergeObject(roll.dice[1].options, pColor);
          mergeObject(roll.dice[2].options, pColor);
          break;
        case 'fallingDamage':
          const baseMod = await this._situationalModifiers(testData);
          const formula = `${testData.fallingHeight}d6+${baseMod}-${testData.extra.options.availableQs || 0}`;
          roll = await new Roll(formula).evaluate();
          break;
        default:
          roll = await new Roll('1d20').evaluate();
          mergeObject(roll.dice[0].options, d3dColors(testData.source.system.attr));
      }
      roll = await DiceDSA5.manualRolls(roll, testData.source.type, testData.extra.options);
      await this.showDiceSoNice(roll, cardOptions.rollMode);
      testData.roll = roll;
      testData.rollMode = cardOptions.rollMode;
    }
    return testData;
  }

  static async setupDialog({ dialogOptions, testData, cardOptions }) {
    let rollMode = game.settings.get('core', 'rollMode');
    let sceneStress = 'challenging';

    if (typeof testData.source.toObject === 'function') testData.source = testData.source.toObject(false);

    mergeObject(testData, {
      testDifficulty: sceneStress,
    });

    mergeObject(dialogOptions.data, {
      testDifficulty: sceneStress,
      testModifier: dialogOptions.data.modifier || 0,
    });

    let situationalModifiers = dialogOptions.data.situationalModifiers || (testData.extra.actor ? DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source) : []);

    if (testData.extra.options.moreModifiers != undefined) {
      situationalModifiers.push(...testData.extra.options.moreModifiers);
    }

    let targets = [];
    game.user.targets.forEach((target) => {
      if (target.actor)
        targets.push({
          name: target.actor.name,
          id: target.id,
          img: target.actor.img,
        });
    });

    mergeObject(dialogOptions.data, {
      hasSituationalModifiers: situationalModifiers.length > 0,
      situationalModifiers,
      attributesList: ['mu', 'kl', 'in', 'ch', 'ff', 'ge', 'ko', 'kk'].reduce((acc, att) => {
        acc[att] = game.i18n.localize(`CHARAbbrev.${att.toUpperCase()}`);
        return acc;
      }, {}),
      rollMode: dialogOptions.data.rollMode || rollMode,
      defenseCount: await this.getDefenseCount(testData),
      targets,
    });

    cardOptions.user = game.user.id;

    if (!testData.extra.options.bypass) {
      const dialog = DSA5Dialog.getDialogForItem(testData, dialogOptions.data);
      const content = await renderTemplate(dialogOptions.template, dialogOptions.data);
      return new Promise((resolve, reject) => {
        new dialog({
          title: dialogOptions.title,
          content,
          buttons: dialog.getRollButtons(testData, dialogOptions, resolve, reject),
          default: 'rollButton',
        })
          .recallSettings(testData.extra.speaker, testData.source, testData.mode, dialogOptions.data)
          .render(true);
      });
    } else {
      cardOptions.rollMode = testData.extra.options.rollMode || rollMode;
      if (!testData.situationalModifiers) testData.situationalModifiers = [];
      return { testData, cardOptions, dialogOptions };
    }
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
      const html = `<div class="card-content"><b>Duplicatus-${game.i18n.localize('Roll')}</b>: <span data-tooltip="${game.i18n.localize('Roll')} vs ${duplicatusRollTarget}" class="die-ch d20">${duplicatusRoll._total}</span></div`;
      res.other = [html];
      if (!hit && res.successLevel > 0) {
        res.description = `${game.i18n.localize('Failure')}, ${game.i18n.localize('CHATNOTIFICATION.duplicatus')}`;
        res.successLevel = 0;
      }
    }
  }

  static async _rollConfirm() {
    return await new Roll('1d20').evaluate();
  }

  static async _rollSingleD20(roll, res, id, modifier, testData, combatskill = '', multiplier = 1) {
    let description = '';
    res = Math.round((res + modifier) * multiplier);
    const rollTotal = roll.total ?? roll._total;
    const color = game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration(id);
    const suc = res - rollTotal >= 0;
    const characteristics = [{ char: id, res: rollTotal, suc, tar: res }];
    let successLevel = suc ? 1 : -1;
    let botch = 20;
    let crit = 1;
    const statKey = { meleeweapon: 'meleeStats', rangeweapon: 'rangeStats' }[testData.source.type];

    if (statKey) {
      botch = Math.min(testData.extra.actor.system[statKey].botch, testData.source.system.botch);
      crit = Math.max(testData.extra.actor.system[statKey].crit, testData.source.system.crit);
    }

    if (RuleChaos.improvisedWeapon.test(testData.source.name)) {
      if (!SpecialabilityRulesDSA5.hasAbility(testData.extra.actor, game.i18n.localize('LocalizedIDs.improvisedWeaponMaster'))) botch = Math.min(19, botch);

      this._appendSituationalModifiers(testData, `${game.i18n.localize('CHAR.ATTACK')} - ${game.i18n.localize('WEAPON.improvised')}`, 2, 'defenseMalus');
    }

    if (testData.situationalModifiers.find((x) => x.name == game.i18n.localize('MODS.opportunityAttack') && x.value != 0)) {
      botch = 50;
      crit = -50;
    }

    const isCrit = rollTotal <= crit;
    const isBotch = rollTotal >= botch;

    if (isCrit || isBotch) {
      description = game.i18n.localize(isCrit ? 'CriticalSuccess' : 'CriticalFailure');

      successLevel = isCrit ? 3 : -3;
      if (!game.settings.get('dsa5', 'noConfirmationRoll')) {
        let rollConfirm = await DiceDSA5.manualRolls(await DiceDSA5._rollConfirm(), 'confirmationRoll', testData.extra.options);
        const confirmChange = getProperty(testData.source, `system.${isCrit ? 'critConfirm' : 'botchConfirm'}`) || 0;
        let res2 = res - Math.clamp(rollConfirm.total + confirmChange, 1, 20);

        if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.weaponAptitude')} (${combatskill})`) && !(res2 >= 0)) {
          let a = rollConfirm.total;
          rollConfirm = await DiceDSA5.manualRolls(await DiceDSA5._rollConfirm(), 'LocalizedIDs.weaponAptitude', testData.extra.options);
          res2 = res - Math.clamp(rollConfirm.total + confirmChange, 1, 20);
          description += `, ${game.i18n.format('usedWeaponExpertise', { a, b: rollConfirm.total })}`;
        }

        this._addRollDiceSoNice(testData, rollConfirm, color);
        let confirmed = res2 >= 0;
        if (isBotch) confirmed = !confirmed;

        characteristics.push({
          char: id,
          res: Math.clamp(rollConfirm.total + confirmChange, 1, 20),
          suc: confirmed,
          tar: res,
        });
        description = `${game.i18n.localize(confirmed ? 'confirmed' : 'unconfirmed')} ${description}`;

        if (confirmed) successLevel = isCrit ? 3 : -3;
        else successLevel = isCrit ? 2 : -2;
      }
    } else {
      description = game.i18n.localize(suc ? 'Success' : 'Failure');
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
    let roll = testData.roll;
    const chars = [];

    for (let res of roll.terms[0].results) {
      chars.push({ char: 'damage', res: res.result, suc: false });
    }

    let result = {
      rollType: 'fallingDamage',
      preData: testData,
      modifiers: await this._situationalModifiers(testData),
      extra: {},
      damage: Math.max(0, roll.total),
      formula: roll.formula,
      characteristics: chars,
    };
    return result;
  }

  static async rollRegeneration(testData) {
    let modifier = await this._situationalModifiers(testData);
    let roll = testData.roll;
    let chars = [];

    let result = {
      rollType: 'regenerate',
      preData: testData,
      modifiers: modifier,
      extra: {},
    };

    const attrs = [];
    if (testData.regenerateLeP) attrs.push('LeP');
    if (testData.extra.actor.system.isMage && testData.regenerateAsP) attrs.push('AsP');
    if (testData.extra.actor.system.isPriest && testData.regenerateKaP) attrs.push('KaP');
    let index = 0;

    const isSick = testData.extra.actor.effects.some((x) => x.statuses.includes('sick'));
    if (isSick) {
      this._appendSituationalModifiers(testData, game.i18n.localize('CONDITION.sick'), '*0');
      for (let k of attrs) {
        chars.push({ char: k, res: 0, die: 'd6' });
        result[k] = 0;
        index += 2;
      }
    } else {
      for (let k of attrs) {
        this._appendSituationalModifiers(
          testData,
          game.i18n.localize(`LocalizedIDs.regeneration${k}`),
          AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize(`LocalizedIDs.regeneration${k}`)),
          k,
        );
        this._appendSituationalModifiers(
          testData,
          game.i18n.localize(`LocalizedIDs.weakRegeneration${k}`),
          AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize(`LocalizedIDs.weakRegeneration${k}`)) * -1,
          k,
        );
        this._appendSituationalModifiers(
          testData,
          game.i18n.localize(`LocalizedIDs.advancedRegeneration${k}`),
          SpecialabilityRulesDSA5.abilityStep(testData.extra.actor, game.i18n.localize(`LocalizedIDs.advancedRegeneration${k}`)),
          k,
        );
        this._appendSituationalModifiers(testData, `${game.i18n.localize(`CHARAbbrev.${k}`)} ${game.i18n.localize('Modifier')}`, testData[`${k}Modifier`], k);
        this._appendSituationalModifiers(testData, `${game.i18n.localize(`CHARAbbrev.${k}`)} ${game.i18n.localize('regenerate')}`, testData[`regeneration${k}`], k);

        chars.push({
          char: k,
          res: roll.terms[index].results[0].result,
          die: 'd6',
        });
        result[k] = Math.round(
          Math.max(0, Number(roll.terms[index].results[0].result) + Number(modifier) + (await this._situationalModifiers(testData, k))) * Number(testData.regenerationFactor),
        );
        index += 2;
      }
    }

    result.characteristics = chars;
    return result;
  }

  static async rollStatus(testData) {
    let roll = testData.roll || (await new Roll('1d20').evaluate());
    let result = await this._rollSingleD20(
      roll,
      testData.source.system.max,
      testData.extra.statusId,
      await this._situationalModifiers(testData),
      testData,
      '',
      this._situationalMultipliers(testData),
    );
    result.rollType = 'dodge';
    const isDodge = testData.extra.statusId == 'dodge';
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
    let roll = testData.roll ? testData.roll : await new Roll('1d20').evaluate();
    this._appendSituationalModifiers(testData, game.i18n.localize('Difficulty'), testData.testDifficulty);
    let result = await this._rollSingleD20(
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

    if (testData.source.type == 'meleeweapon') {
      const skill = Actordsa5._calculateCombatSkillValues(
        testData.extra.actor.items.find((x) => x.type == 'combatskill' && x.name == testData.source.system.combatskill.value),
        testData.extra.actor.system,
      );
      weapon = Actordsa5._prepareMeleeWeapon(testData.source, [skill], testData.extra.actor);
    } else if (testData.source.type == 'rangeweapon') {
      const skill = Actordsa5._calculateCombatSkillValues(
        testData.extra.actor.items.find((x) => x.type == 'combatskill' && x.name == testData.source.system.combatskill.value),
        testData.extra.actor.system,
      );
      weapon = Actordsa5._prepareRangeWeapon(testData.source, [], [skill], testData.extra.actor);
    } else {
      weapon = testData.source.system;
    }
    return this.replaceDieLocalization(testData.source.system.damage.value) + `+${weapon.extraDamage || 0}`;
  }

  static async rollDamage(testData) {
    let modifiers = await this._situationalModifiers(testData);
    let chars = [];

    let roll = testData.roll;
    let damage = roll.total + modifiers;

    for (let k of roll.terms) {
      if (k instanceof foundry.dice.terms.Die || k.class == 'Die') {
        for (let l of k.results)
          chars.push({
            char: testData.mode,
            res: l.result,
            die: 'd' + k.faces,
          });
      }
    }

    return {
      rollType: 'damage',
      damage,
      characteristics: chars,
      preData: testData,
      modifiers,
      extra: {},
    };
  }

  static async _situationalModifiers(testData, filter = '') {
    let result = 0;
    for (let val of testData.situationalModifiers) {
      if (val.value == undefined) continue;

      const evaluatedVal = Number(val.value) || (await this._stringToRoll(val.value));
      result += val.type == filter || (filter == '' && val.type == undefined) ? evaluatedVal : 0;
    }
    return result;
  }

  static _situationalPartCheckModifiers(testData) {
    return testData.situationalModifiers.reduce(
      function (_this, val) {
        if (val.type == 'TPM') {
          const pcs = val.value.split('|');
          if (pcs.length != 3) return _this;

          _this[0] = _this[0] + Number(pcs[0]);
          _this[1] = _this[1] + Number(pcs[1]);
          _this[2] = _this[2] + Number(pcs[2]);
          return _this;
        } else {
          return _this;
        }
      },
      [0, 0, 0],
    );
  }

  static _situationalMultipliers(testData) {
    return testData.situationalModifiers.reduce(function (_this, val) {
      return _this * (val.type == '*' ? Number(`${val.value}`.replace(/,/, '.')) || 1 : 1);
    }, 1);
  }

  static _appendSituationalModifiers(testData, name, val, type = '') {
    let existing = testData.situationalModifiers.find((x) => x.name == name);

    if (existing) {
      existing.value = val;
    } else {
      testData.situationalModifiers.push({
        name,
        value: val,
        type,
      });
    }
  }

  static async rollCombatTrait(testData) {
    let roll = testData.roll || (await new Roll('1d20').evaluate());
    let source = testData.source; //.system == undefined ? testData.source : testData.source.system
    const isMelee = source.system.traitType.value == 'meleeAttack';
    const isAttack = testData.mode == 'attack';
    if (isMelee) {
      let weapon = {
        system: {
          combatskill: { value: '-' },
          reach: { value: source.system.reach.value },
        },
      };

      this._appendSituationalModifiers(testData, game.i18n.localize('opposingWeaponSize'), this._compareWeaponReach(weapon, testData));
    }
    let result = await this._rollSingleD20(
      roll,
      isAttack ? Number(source.system.at.value) : Number(source.system.pa),
      testData.mode,
      await this._situationalModifiers(testData),
      testData,
      '',
      this._situationalMultipliers(testData),
    );

    await this.getDuplicatusRoll(result, testData);

    let success = result.successLevel > 0;

    await this.detailedWeaponResult(result, testData, source);

    if (isAttack && success) {
      await DiceDSA5.evaluateDamage(testData, result, source, !isMelee, result.doubleDamage);
    }
    result.rollType = 'weapon';
    const effect = DiceDSA5.parseEffect(source);
    if (effect) result['parsedEffect'] = effect;

    return result;
  }

  static async _stringToRoll(text, testData) {
    const promises = [];
    const regex = /\d{1}[dDwW]\d/g;
    const modText = `${text}`;
    modText.replace(regex, function (match) {
      promises.push(new Roll(DiceDSA5.replaceDieLocalization(match), testData.extra.actor.system).evaluate());
    });
    const data = await Promise.all(promises);
    const rollString = modText.replace(regex, () => {
      const roll = data.shift();
      if (testData) {
        DiceDSA5._addRollDiceSoNice(testData, roll, game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration('ch'));
      }
      return roll.total;
    });
    return await Roll.safeEval(rollString);
  }

  static replaceDieLocalization(formula) {
    return formula.replace(/[Ww](?=\d)/g, 'd');
  }

  static async evaluateDamage(testData, result, weapon, isRangeWeapon, doubleDamage) {
    let rollFormula = this.replaceDieLocalization(weapon.system.damage.value);
    let overrideDamage = [];
    let dmgMultipliers = weapon.dmgMultipliers || [];
    let damageBonusDescription = dmgMultipliers.map((x) => `${x.name} *${x.val}`);
    let armorPen = [];
    let bonusDmg = 0;
    for (let val of testData.situationalModifiers) {
      let number = 0;
      if (val.armorPen) armorPen.push(val.armorPen);
      if (val.damageBonus) {
        if (/^\*/.test(val.damageBonus)) {
          dmgMultipliers.push({
            name: val.name,
            val: Number(val.damageBonus.replace('*', '')),
          });
          continue;
        }
        const isOverride = /^=/.test(val.damageBonus);
        const rollString = `${val.damageBonus}`.replace(/^=/, '');

        let roll = await DiceDSA5._stringToRoll(rollString, testData);
        number = roll * (val.step || 1);

        if (isOverride) {
          rollFormula = this.replaceDieLocalization(rollString);
          overrideDamage.push({ name: val.name, roll });
          continue;
        } else {
          val.damageBonus = roll;
          bonusDmg += number;
        }
      }
    }

    let damageRoll =
      testData.damageRoll || (await DiceDSA5.manualRolls(await new Roll(rollFormula, testData.extra.actor.system).evaluate(), 'CHAR.DAMAGE', testData.extra.options));
    let damage = damageRoll.total;

    let weaponroll = 0;
    for (let k of damageRoll.terms) {
      if (k instanceof foundry.dice.terms.Die || k.class == 'Die') {
        for (let l of k.results) {
          weaponroll += Number(l.result);
          result.characteristics.push({
            char: 'damage',
            res: l.result,
            die: 'd' + k.faces,
          });
        }
      }
    }
    let weaponBonus = damage - weaponroll;

    if (overrideDamage.length > 0) {
      damageBonusDescription.push(overrideDamage[0].name + ' ' + damage);
    } else {
      damage += bonusDmg;

      damageBonusDescription.push(game.i18n.localize('Roll') + ' ' + weaponroll);
      if (weaponBonus != 0) damageBonusDescription.push(game.i18n.localize('weaponModifier') + ' ' + weaponBonus);

      testData.situationalModifiers.reduce((prev, x) => {
        if (x.damageBonus) {
          const value = /^\*/.test(x.damageBonus) ? x.damageBonus : Number(x.damageBonus) * (x.step || 1);
          damageBonusDescription.push(`${x.name} ${value}`);
        }
      }, damageBonusDescription);

      if (testData.situationalModifiers.find((x) => x.name.indexOf(game.i18n.localize('CONDITION.bloodrush')) > -1)) {
        damage += 2;
        damageBonusDescription.push(game.i18n.localize('CONDITION.bloodrush') + ' ' + 2);
      }

      if (weapon.extraDamage) {
        damage = Number(weapon.extraDamage) + Number(damage);
        damageBonusDescription.push(game.i18n.localize('damageThreshold') + ' ' + weapon.extraDamage);
      }

      let status = testData.extra.actor.system[isRangeWeapon ? 'rangeStats' : 'meleeStats'].damage;
      const statusDmg = await DiceDSA5._stringToRoll(status, testData);
      if (statusDmg != 0) {
        damage += statusDmg;
        damageBonusDescription.push(game.i18n.localize('statuseffects') + ' ' + statusDmg);
      }

      const combatskill = getProperty(weapon, 'system.combatskill.value');
      const ktwDamage = testData.extra.actor.system.skillModifiers.combat.damage.reduce((prev, x) => {
        if (x.target == combatskill) prev += Number(x.value);
        return prev;
      }, 0);

      if (ktwDamage) {
        damage = damage + ktwDamage;
        damageBonusDescription.push(`${game.i18n.localize('TYPES.Item.combatskill')} (${game.i18n.localize('CHARAbbrev.damage')}) ${ktwDamage}`);
      }
    }

    if (doubleDamage) {
      damage = damage * doubleDamage;
      damageBonusDescription.push(game.i18n.format('doubleDamage', { x: doubleDamage }));
    }
    for (const el of dmgMultipliers) {
      damage = damage * el.val;
    }
    result.armorPen = armorPen;
    result.damagedescription = damageBonusDescription.join(', ');
    result.damage = Math.round(damage);
    result.damageRoll = duplicate(damageRoll);
  }

  static async rollWeapon(testData) {
    let roll = testData.roll || (await new Roll('1d20').evaluate());
    let weapon;

    let source = testData.source;
    const combatskill = source.system.combatskill.value;

    let skill = Actordsa5._calculateCombatSkillValues(
      testData.extra.actor.items.find((x) => x.type == 'combatskill' && x.name == combatskill),
      testData.extra.actor.system,
      {
        step: await this._situationalModifiers(testData, 'step'),
        [testData.mode]: await this._situationalModifiers(testData, testData.mode),
      },
    );

    const isMelee = source.type == 'meleeweapon';
    if (isMelee) {
      weapon = Actordsa5._prepareMeleeWeapon(source, [skill], testData.extra.actor);
      if (testData.mode == 'attack') {
        this._appendSituationalModifiers(testData, game.i18n.localize('opposingWeaponSize'), this._compareWeaponReach(weapon, testData));
      }
    } else {
      weapon = Actordsa5._prepareRangeWeapon(source, [], [skill], testData.extra.actor);
    }
    let result = await this._rollSingleD20(
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

    if (testData.mode == 'attack' && result.successLevel > 0 && !testData.extra.counterAttack)
      await DiceDSA5.evaluateDamage(testData, result, weapon, !isMelee, result.doubleDamage);

    if (testData.extra.counterAttack) {
      DSA5_Utility.getSpeaker(testData.extra.speaker).addCondition('stunned');
      result.description += ', ' + DSA5_Utility.replaceConditions(game.i18n.localize('stunnedByCounterAttack'));
    }

    result.rollType = 'weapon';
    const effect = DiceDSA5.parseEffect(weapon);

    if (effect) result.parsedEffect = effect;

    return result;
  }

  static _weaponBotchCritEffect(source, key, actor) {
    const result = [];
    for (let effect of source.effects) {
      for (let change of effect.changes) {
        if (change.key == key) {
          if (change.value == 'description') {
            result.push(effect.description);
          } else if (/^condition /.test(change.value)) {
            const value = change.value.replace(/^condition /, '').split(' ');
            const count = Number(value[1]) || 1;
            const condition = game.i18n.localize(`CONDITION.${value[0]}`);
            const msg = DSA5_Utility.replaceConditions(
              game.i18n.format('CHATNOTIFICATION.suffersCondition', {
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
    const isAttack = testData.mode == 'attack' && !testData.extra.counterAttack;
    const isMelee = source.type == 'meleeweapon' || getProperty(source, 'system.traitType.value') == 'meleeAttack';
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
        result.description += this._weaponBotchCritEffect(source, 'self.criteffect', testData.extra.actor);
        break;
      case -3:
        const isWeaponless = getProperty(source, 'system.combatskill.value') == game.i18n.localize('LocalizedIDs.wrestle') || source.type == 'trait';
        if (isAttack && isMelee && (await DSATables.tableEnabledFor('Melee'))) result.description += DSATables.rollCritBotchButton('Melee', isWeaponless, testData);
        else if (isAttack && (await DSATables.tableEnabledFor('Range'))) result.description += DSATables.rollCritBotchButton('Range', false, testData);
        else if (!isAttack && (await DSATables.tableEnabledFor('Defense'))) result.description += DSATables.rollCritBotchButton('Defense', isWeaponless, testData);
        else result.description += await DSATables.defaultBotch();

        result.description += this._weaponBotchCritEffect(source, 'self.botcheffect', testData.extra.actor);
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
    if (testData.rollMode) {
      for (let i = 0; i < roll.dice.length; i++) mergeObject(roll.dice[i].options, color);

      await this.showDiceSoNice(roll, testData.rollMode);
    }
  }

  static async rollCombatskill(testData) {
    let roll = testData.roll ? testData.roll : await new Roll('1d20').evaluate();
    let source = Actordsa5._calculateCombatSkillValues(testData.source, testData.extra.actor.system);
    let result = await this._rollSingleD20(
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

  static async manualRolls(roll, description = '', options = {}) {
    let cheat = options.cheat;
    if (options.predefinedResult && description == 'CHAR.DAMAGE') cheat = false;

    if (cheat || game.settings.get('dsa5', 'allowPhysicalDice')) {
      if (!options.predefinedResult) {
        let result = false;
        let form;
        let dice = [];
        for (let term of roll.terms) {
          if (term instanceof foundry.dice.terms.Die || term.class == 'Die') {
            for (let res of term.results) dice.push({ faces: term.faces, val: res.result });
          }
        }

        const content = await renderTemplate('systems/dsa5/templates/dialog/manualroll-dialog.html', {
          dice,
          description,
        });
        [result, form] = await new Promise((resolve, reject) => {
          new DSA5Dialog({
            title: game.i18n.localize(options.cheat ? 'DIALOG.cheat' : 'DSASETTINGS.allowPhysicalDice'),
            content,
            default: 'ok',
            buttons: {
              ok: {
                icon: '<i class="fa fa-check"></i>',
                label: game.i18n.localize('yes'),
                callback: (dlg) => resolve([true, dlg]),
              },
              cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize('cancel'),
                callback: () => resolve([false, 0]),
              },
            },
          }).render(true);
        });

        if (result) {
          let changes = [];
          form.find('.dieInput').each(function (index) {
            let val = Number($(this).val());
            if (val > 0) changes.push({ val, index });
            index++;
          });
          roll.editRollAtIndex(changes);
        }
      } else {
        roll.editRollAtIndex(options.predefinedResult);
      }
    }
    return roll;
  }

  static parseEffect(source) {
    const effectString = source.system.effect ? source.system.effect.value : undefined;
    const result = [];
    if (effectString) {
      const regex = /^[a-z]+\|[öäüÖÄÜa-zA-z ]+$/;

      for (let k of effectString.split(';')) {
        if (regex.test(k.trim())) {
          const split = k.split('|').map((x) => x.trim());
          if (split[0] == 'condition') {
            const effect = CONFIG.statusEffects.find((x) => x.id == split[1]);
            result.push(
              `<a class="chat-condition chatButton" data-id="${effect.id}">
                            <img src="${effect.img}"/>${game.i18n.localize(effect.name)}
                            </a>`,
            );
          } else
            result.push(
              `<a class="roll-button roll-item" data-name="${split[1]}" data-type="${split[0]}"><i class="fas fa-dice"></i>${game.i18n.localize(split[0])}: ${split[1]}</a>`,
            );
        }
      }
    }
    const poison = getProperty(source, 'flags.dsa5.poison');
    if (poison) {
      result.push(
        `<a class="roll-button roll-item" data-removecharge="${!poison.permanent}" data-name="${
          poison.name
        }" data-type="poison"><i class="fas fa-dice"></i>${game.i18n.localize('TYPES.Item.poison')}: ${poison.name}</a>`,
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

    if (res.successLevel < 0) {
      const traditions = ['traditionWitch', 'traditionFjarning', 'braniborian'].map((x) => game.i18n.localize(`LocalizedIDs.${x}`));
      const factor = testData.extra.actor.items.some((x) => x.type == 'specialability' && traditions.includes(x.name)) ? 3 : 2;
      res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.finalcost / factor);
    }

    if (isClerical) {
      feature = 'KaPCost';
      weakBody = game.i18n.localize('LocalizedIDs.weakKarmicBody');
      energy = game.i18n.localize(`LocalizedIDs.${res.successLevel > 0 ? 'mightyKarmaControl' : 'karmaControl'}`);
      globalMod = { val: 'kapModifier', name: 'KaP' };
    } else {
      feature = 'AsPCost';
      weakBody = game.i18n.localize('LocalizedIDs.weakAstralBody');
      energy = game.i18n.localize(`LocalizedIDs.${res.successLevel > 0 ? 'energyControl' : 'smallEnergyControl'}`);
      globalMod = { val: 'aspModifier', name: 'AsP' };
    }
    costModifiers.push(
      {
        name: weakBody,
        value: AdvantageRulesDSA5.vantageStep(testData.extra.actor, weakBody),
      },
      {
        name: energy,
        value: SpecialabilityRulesDSA5.abilityStep(testData.extra.actor, energy) * -1,
      },
      {
        name: `${game.i18n.localize('statuseffects')} (${game.i18n.localize('CHARAbbrev.' + globalMod.name)})`,
        value: testData.extra.actor.system[globalMod.val] + (await this._situationalModifiers(testData, feature)),
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

  static async rollSpell(testData) {
    let res = await this._rollThreeD20(testData);
    const isClerical = ['ceremony', 'liturgy'].includes(testData.source.type);
    res['rollType'] = testData.source.type;
    res.preData.calculatedSpellModifiers.finalcost = res.preData.calculatedSpellModifiers.cost;
    if (res.successLevel >= 2) {
      let extraFps = (await new Roll('1d6').evaluate()).total;
      res.description = res.description + ', ' + game.i18n.localize('additionalFPs') + ' ' + extraFps;
      res.result += extraFps;
      res.qualityStep = Math.min(game.settings.get('dsa5', 'capQSat'), Math.ceil(res.result / 3));
      res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.cost / 2);
    } else if (res.successLevel <= -2) {
      res.description += DSATables.rollCritBotchButton(isClerical ? 'Liturgy' : 'Spell', false, testData);
    }

    if (res.successLevel > 0) {
      if (testData.source.system.effectFormula.value != '') {
        let formula = DiceDSA5.replaceDieLocalization(testData.source.system.effectFormula.value.replaceAll(game.i18n.localize('CHARAbbrev.QS'), res.qualityStep));
        let armorPen = [];
        for (let mod of testData.situationalModifiers) {
          if (mod.armorPen) armorPen.push(mod.armorPen);
        }
        if (/(,|;)/.test(formula)) formula = formula.split(/[,;]/)[res.qualityStep - 1];

        let rollEffect = testData.damageRoll
          ? testData.damageRoll
          : await DiceDSA5.manualRolls(await new Roll(formula, testData.extra.actor.system).evaluate(), 'CHAR.DAMAGE', testData.extra.options);

        this._addRollDiceSoNice(testData, rollEffect, game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration('damage'));
        res['calculatedEffectFormula'] = formula;
        for (let k of rollEffect.terms) {
          if (k instanceof foundry.dice.terms.Die || k.class == 'Die')
            for (let l of k.results)
              res['characteristics'].push({
                char: 'effect',
                res: l.result,
                die: 'd' + k.faces,
              });
        }
        const damageBonusDescription = [];
        const statusDmg = await DiceDSA5._stringToRoll(testData.extra.actor.system[isClerical ? 'liturgyStats' : 'spellStats'].damage, testData);
        if (statusDmg != 0) {
          damageBonusDescription.push(game.i18n.localize('statuseffects') + ' ' + statusDmg);
        }
        res['armorPen'] = armorPen;
        res['damageRoll'] = rollEffect;
        res['damage'] = rollEffect.total + statusDmg;
        res['damagedescription'] = damageBonusDescription.join('\n');
      }
    }

    await this.calculateEnergyCost(isClerical, res, testData);
    await this.getDuplicatusRoll(res, testData);

    for (const creature of ['minorFairies', 'minorSpirits']) {
      const name = game.i18n.localize('CONDITION.' + creature);
      if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, name) && !testData.extra.actor.effects.find((x) => x.name == name)) {
        const ghostroll = await new Roll('1d20').evaluate();
        if (ghostroll.total <= res.preData.calculatedSpellModifiers.finalcost) {
          res.description += ', ' + game.i18n.format('minorghostsappear', { creature: name });
          DSA5_Utility.getSpeaker(testData.extra.speaker).addCondition(creature);
        }
      }
    }

    return res;
  }

  static async _rollThreeD20(testData) {
    let roll = testData.roll ? (testData.roll instanceof Roll ? testData.roll : Roll.fromData(testData.roll)) : await new Roll('1d20+1d20+1d20').evaluate();
    let description = [];
    let successLevel = 0;

    this._appendSituationalModifiers(testData, game.i18n.localize('Difficulty'), testData.testDifficulty);
    let modifiers = await this._situationalModifiers(testData);

    let fws = Number(testData.source.system.talentValue.value) + testData.advancedModifiers.fws + (await this._situationalModifiers(testData, 'FW'));
    const pcms = this._situationalPartCheckModifiers(testData, 'TPM');

    let tar = [1, 2, 3].map(
      (x) =>
        testData.extra.actor.system.characteristics[testData.source.system[`characteristic${x}`].value].value + modifiers + testData.advancedModifiers.chars[x - 1] + pcms[x - 1],
    );
    let res = [0, 1, 2].map((x) => roll.terms[x * 2].results[0].result - tar[x]);

    if (testData.routine) fws = Math.round(fws / 2);
    else for (let k of res) if (k > 0) fws -= k;

    let crit = testData.extra.actor.system.skillModifiers.crit;
    let botch = testData.extra.actor.system.skillModifiers.botch;
    if (['spell', 'ritual'].includes(testData.source.type) && AdvantageRulesDSA5.hasVantage(testData.extra.actor, game.i18n.localize('LocalizedIDs.wildMagic'))) botch = 19;

    if (testData.source.type == 'skill' && AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.incompetent')} (${testData.source.name})`)) {
      let reroll = await new Roll('1d20').evaluate();
      let indexOfMinValue = res.reduce((iMin, x, i, arr) => (x < arr[iMin] ? i : iMin), 0);
      let oldValue = roll.terms[indexOfMinValue * 2].total;
      fws += Math.max(res[indexOfMinValue], 0);
      fws -= Math.max(0, reroll.total - tar[indexOfMinValue]);
      //DSA5_Utility.editRollAtIndex(roll, indexOfMinValue, reroll.total)
      roll.editRollAtIndex([{ index: indexOfMinValue, val: reroll.total }]);
      this._addRollDiceSoNice(testData, reroll, roll.terms[indexOfMinValue * 2].options);
      description.push(
        game.i18n.format('CHATNOTIFICATION.unableReroll', {
          die: indexOfMinValue + 1,
          oldVal: oldValue,
          newVal: reroll.total,
        }),
      );
    }
    let automaticResult = 0;
    if (testData.source.type == 'skill' && TraitRulesDSA5.hasTrait(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.automaticSuccess')} (${testData.source.name})`)) {
      description.push(game.i18n.localize('LocalizedIDs.automaticSuccess'));
      successLevel = 1;
      automaticResult = 1;
    } else if (testData.source.type == 'skill' && TraitRulesDSA5.hasTrait(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.automaticFail')} (${testData.source.name})`)) {
      description.push(game.i18n.localize('LocalizedIDs.automaticFail'));
      successLevel = -1;
    } else {
      successLevel = DiceDSA5.get3D20SuccessLevel(roll, fws, botch, crit);
      if (testData.routine) successLevel = 1;

      description.push(DiceDSA5.getSuccessDescription(successLevel));
    }

    description = description.join(', ');
    let qualityStep = 0;

    if (successLevel > 0) {
      fws += await this._situationalModifiers(testData, 'FP');
      qualityStep =
        Math.max(1, (fws == 0 ? 1 : fws > 0 ? Math.ceil(fws / 3) : 0) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0)) +
        (testData.advancedModifiers.qls || 0) +
        (await this._situationalModifiers(testData, 'QL'));
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
    let res = await this._rollThreeD20(testData);
    res.rollType = 'talent';
    return res;
  }

  static get3D20SuccessLevel(roll, fws, botch = 20, critical = 1) {
    const critFilter = roll.terms.filter((x) => x.results && x.results[0].result <= critical).length;
    const botchFilter = roll.terms.filter((x) => x.results && x.results[0].result >= botch).length;
    if (critFilter >= 2) return critFilter;
    if (botchFilter >= 2) return botchFilter * -1;
    return fws >= 0 ? 1 : -1;
  }

  static getSuccessDescription(successLevel) {
    return game.i18n.localize(['AstoundingFailure', 'CriticalFailure', 'Failure', '', 'Success', 'CriticalSuccess', 'AstoundingSuccess'][successLevel + 3]);
  }

  static async rollItem(testData) {
    let roll = testData.roll || (await new Roll('1d20+1d20+1d20').evaluate());
    let description = [];
    let modifier = await this._situationalModifiers(testData);
    let fws = Number(testData.source.system.step.value);
    let tar = [1, 2, 3].map((x) => 10 + Number(testData.source.system.step.value) + modifier);
    let res = [0, 1, 2].map((x) => roll.terms[x * 2].results[0].result - tar[x]);
    for (let k of res) {
      if (k > 0) fws -= k;
    }

    let botch = 20;

    const successLevel = DiceDSA5.get3D20SuccessLevel(roll, fws, botch);
    description.push(DiceDSA5.getSuccessDescription(successLevel));

    description = description.join(', ');

    let result = {
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
      case 'poison':
        let dur = testData.source.system.duration.value.split(' / ').map((x) => x.trim());
        let effect = testData.source.system.effect.value.split(' / ').map((x) => x.trim());
        result.duration = dur.length > 1 ? (result.successLevel > 0 ? dur[0] : dur[1]) : dur[0];
        result.effect = effect.length > 1 ? (result.successLevel > 0 ? effect[0] : effect[1]) : effect[0];
        break;
      case 'disease':
        let dmg = testData.source.system.damage.value.split(' / ').map((x) => x.trim());
        let duration = testData.source.system.duration.value.split(' / ').map((x) => x.trim());
        result.damageeffect = dmg.length > 1 ? (result.successLevel > 0 ? dmg[0] : dmg[1]) : dmg[0];
        result.duration = duration.length > 1 ? (result.successLevel > 0 ? duration[0] : duration[1]) : duration[0];
        break;
    }
    return result;
  }

  static async updateDefenseCount(testData) {
    if (game.combat && !testData.fateUsed) await game.combat.updateDefenseCount(testData.extra.speaker);
  }

  static _compareWeaponReach(weapon, testData) {
    //TODO move this to roll dialog
    let circumvent = testData.situationalModifiers.find((x) => x.name == game.i18n.localize('LocalizedIDs.circumvent'));
    const attacker = DSA5.meleeRangesArray.indexOf(weapon.system.reach.value);
    const defender = DSA5.meleeRangesArray.indexOf(testData.opposingWeaponSize);
    if (circumvent && defender > attacker) circumvent.value = Math.min(circumvent.step, defender - attacker) * 2;

    return Math.min(0, attacker - defender) * 2;
  }

  static async showDiceSoNice(roll, rollMode) {
    if (DSA5_Utility.moduleEnabled('dice-so-nice') && game.dice3d) {
      let whisper = null;
      let blind = false;
      switch (rollMode) {
        case 'blindroll':
          blind = true;
          whisper = game.users.filter((user) => user.isGM).map((x) => x.id);
          break;
        case 'gmroll':
          whisper = game.users.filter((user) => user.isGM).map((x) => x.id);
          break;
        case 'selfroll':
          whisper = [];
          break;
      }
      const promise = game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
      if (!game.settings.get('dice-so-nice', 'immediatelyDisplayChatMessages')) await promise;
    }
  }

  static addApplyEffectData(testData) {
    const source = testData.preData.source;

    if (testData.successLevel > 0) {
      if (['meleeweapon', 'rangeweapon'].includes(source.type) || (source.type == 'trait' && ['rangeAttack', 'meleeAttack'].includes(source.system.traitType.value))) {
        if (
          source.effects.some((x) => {
            return !getProperty(x, 'flags.dsa5.applyToOwner');
          })
        )
          return true;
      } else if (['spell', 'liturgy', 'ritual', 'ceremony', 'trait', 'skill'].includes(source.type)) {
        if (source.effects.length > 0) return true;
      }
    }

    if (['disease', 'poison'].includes(source.type)) {
      const search = testData.successLevel > 0 ? 1 : 2;
      return source.effects.filter((x) => getProperty(x, 'flags.dsa5.successEffect') == search || !getProperty(x, 'flags.dsa5.successEffect')).length > 0;
    }

    const specAbIds = testData.preData.situationalModifiers.filter((x) => x.specAbId).map((x) => x.specAbId);
    if (specAbIds.length > 0) {
      const specAbs = testData.preData.extra.actor.items.filter((x) => specAbIds.includes(x._id));
      for (const spec of specAbs) if (spec.effects.length > 0) return true;
    }

    return false;
  }

  static async renderRollCard(chatOptions, testData, rerenderMessage) {
    const applyEffect = this.addApplyEffectData(testData);
    const immuneTo = CreatureType.checkImmunity(testData);
    const preData = deepClone(testData.preData);
    const hideDamage = rerenderMessage ? rerenderMessage.flags.data.hideDamage : preData.mode == 'attack';
    await DSATriggers.postRoll({ testData, preData });
    Hooks.call('postProcessDSARoll', chatOptions, testData, rerenderMessage, hideDamage);
    await DSA5_Utility.callAsyncHooks('postProcessDSARoll', [testData]);
    delete preData.extra.actor;
    delete testData.actor;
    delete testData.preData;

    const hasAreaTemplate = testData.successLevel > 0 && preData.source.system.target && preData.source.system.target.type in game.dsa5.config.areaTargetTypes;

    let chatData = {
      title: chatOptions.title,
      immuneTo,
      testData,
      hideData: game.user.isGM,
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
          name: game.i18n.localize('MODS.partChecks'),
          value: preData.advancedModifiers.chars,
        });
      if (preData.advancedModifiers.fws != 0)
        chatData.modifierList.push({
          name: game.i18n.localize('MODS.FW'),
          value: preData.advancedModifiers.fws,
        });
      if (preData.advancedModifiers.qls != 0)
        chatData.modifierList.push({
          name: game.i18n.localize('MODS.QS'),
          value: preData.advancedModifiers.qls,
        });
    }

    if (['gmroll', 'blindroll'].includes(chatOptions.rollMode)) chatOptions['whisper'] = game.users.filter((user) => user.isGM).map((x) => x.id);
    if (chatOptions.rollMode === 'blindroll') chatOptions['blind'] = true;
    else if (chatOptions.rollMode === 'selfroll') chatOptions['whisper'] = [game.user.id];

    DSA5SoundEffect.playEffect(preData.mode, preData.source, testData.successLevel, chatOptions.whisper, chatOptions.blind);

    mergeObject(chatOptions, {
      flags: {
        data: {
          preData,
          postData: testData,
          template: chatOptions.template,
          rollMode: chatOptions.rollMode,
          isOpposedTest: chatOptions.isOpposedTest,
          title: chatOptions.title,
          hideData: chatData.hideData,
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

      const html = await renderTemplate(chatOptions.template, chatData);
      //Seems to be a foundry bug, after edit inline rolls are not converted anymore
      const actor = ChatMessage.getSpeakerActor(rerenderMessage.speaker) || game.users.get(rerenderMessage.author)?.character;
      const rollData = actor ? actor.getRollData() : {};
      const enriched = await TextEditor.enrichHTML(html, {
        rollData,
        async: true,
      });
      chatOptions['content'] = enriched;

      const newMsg = await rerenderMessage.update({
        content: chatOptions['content'],
        flags: {
          data: chatOptions.flags.data,
        },
      });

      ui.chat.updateMessage(newMsg);
      return newMsg;
    }
  }

  static async _itemRoll(ev) {
    let input = $(ev.currentTarget),
      messageId = input.parents('.message').attr('data-message-id'),
      message = game.messages.get(messageId),
      speaker = message.speaker,
      category = input.attr('data-type'),
      name = input.attr('data-name');

    let actor = DSA5_Utility.getSpeaker(speaker);

    if (actor) {
      const source = actor.items.find((x) => x.name == name && x.type == category);
      if (source) {
        const item = new Itemdsa5(source.toObject());
        const removeCharge = input.attr('data-removecharge') ? input.attr('data-removecharge') == 'true' : false;
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
        ui.notifications.error(
          game.i18n.format('DSAError.notFound', {
            category: category,
            name: name,
          }),
        );
      }
    }
  }

  static async _rollEdit(ev) {
    let input = $(ev.currentTarget),
      messageId = input.parents('.message').attr('data-message-id'),
      message = game.messages.get(messageId);

    let data = message.flags.data;
    let newTestData = data.preData;

    newTestData.extra.actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker)?.toObject(false);
    if (newTestData.extra.options.cheat) delete newTestData.extra.options.cheat;
    let index;

    switch (input.attr('data-edit-type')) {
      case 'roll':
        index = input.attr('data-edit-id');
        let newValue = Number(input.val());

        if (newTestData.roll.terms.length > index * 2) {
          let newRoll = Roll.fromData(newTestData.roll);
          newRoll.editRollAtIndex([{ index, val: newValue }]);
          newTestData.roll = newRoll;
        } else {
          let oldDamageRoll = Roll.fromData(data.postData.damageRoll);
          index = index - newTestData.roll.terms.filter((x) => x.results).length;
          oldDamageRoll.editRollAtIndex([{ index, val: newValue }]);
          newTestData.damageRoll = oldDamageRoll;
        }
        break;
      case 'mod':
        index = newTestData.situationalModifiers.findIndex((x) => x.name == game.i18n.localize('chatEdit'));
        if (index > 0) newTestData.situationalModifiers.splice(index, 1);

        let newVal = {
          name: game.i18n.localize('chatEdit'),
          value: Number(input.val()) - (await this._situationalModifiers(newTestData)),
        };
        newTestData.situationalModifiers.push(newVal);
        break;
    }

    if (data.postData.damageRoll && !newTestData.damageRoll) newTestData.damageRoll = data.postData.damageRoll;

    let chatOptions = {
      template: data.template,
      rollMode: data.rollMode,
      title: data.title,
      speaker: message.speaker,
      user: message.author.id,
    };

    if (['gmroll', 'blindroll'].includes(chatOptions.rollMode)) chatOptions['whisper'] = game.users.filter((user) => user.isGM).map((x) => x.id);

    if (chatOptions.rollMode === 'blindroll') chatOptions['blind'] = true;

    if (['poison', 'disease'].includes(newTestData.source.type)) {
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

  static showCurrentTargets(ev) {
    const targets = [];
    let i18nkey;
    if (ev.currentTarget.dataset.target == 'target') {
      i18nkey = 'TT.applyEffectTargets';
      for (let target of game.user.targets) targets.push(target.document.texture.src);
    } else {
      i18nkey = 'TT.applyEffectCaster';
      const message = game.messages.get($(ev.currentTarget).parents('.message').attr('data-message-id'));
      const actor = DSA5_Utility.getSpeaker(message.flags.data.preData.extra.speaker);
      if (actor) targets.push(actor.token ? actor.token.texture.src : actor.prototypeToken.texture.src);
    }
    const msg = targets.length
      ? targets.map((x) => `<img style="width:25px;height:25px;" src="${x}"/>`).join('')
      : `<small><i class="fas fa-exclamation-circle"></i> ${game.i18n.localize('DIALOG.noTarget')}</small>`;
    ev.currentTarget.dataset.tooltip = `<div><p>${game.i18n.localize(i18nkey)}</p>${msg}</div>`;
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
      let elem = $(event.currentTarget);
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
    html.on('click', '.applyDamage', async (ev) => applyDamage($(ev.currentTarget).closest('.message'), ev.currentTarget.dataset.mode));
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
    html.on('click', '.placeTemplate', async (ev) => MeasuredTemplateDSA.placeTemplateFromChat(ev));
    html.on('click', '.message-delete', (ev) => {
      let message = game.messages.get($(ev.currentTarget).parents('.message').attr('data-message-id'));
      let targeted = message.flags.unopposeData;

      if (!targeted) return;

      let target = canvas.tokens.get(message.flags.unopposeData.targetSpeaker.token);
      OpposedDsa5.clearOpposed(target.actor);
    });
    html.on('click', '.resistEffect', (ev) => DSAActiveEffectConfig.resistEffect(ev));
    html.on('click', '.resistPain', (ev) => DiceDSA5.rollResistPain(ev));
    RequestRoll.chatListeners(html);
  }
}
