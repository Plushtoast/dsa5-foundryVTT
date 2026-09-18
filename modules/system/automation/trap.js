import DSAActiveEffectConfig from '../../status/active_effect_config.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import ZoneAttack from './zone-attack.js';
import GroupCheck from '../rolls/group-check.js';
import ItemEnchantment from '../../item/item-enchantment.js';
import DiceDSA5 from '../rolls/dice-dsa5.js';
import RollRequestService from '../queries/roll-request.js';
import TrapSetpiece from './trap-setpiece.js';
import { applyDamage } from '../../hooks/chat_context.js';

const { duplicate, getProperty, mergeObject, expandObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

/**
 * Trap payload copy and trigger execution.
 * Formulas must already be valid Foundry rolls; the data model rejects anything else.
 */
export default class TrapAutomation extends TrapSetpiece {
  static PAYLOAD_FLAG = 'dsa5';

  static isValidDamageFormula(value) {
    if (value == null) return true;
    const text = String(value).trim();
    if (!text) return true;
    if (text.includes('[')) return false;
    return Roll.validate(text);
  }

  static migrateSource(source) {
    if (!source) return source;

    if (typeof source.trigger === 'string') source.trigger = 0;

    if (source.damageText) {
      source.damageFormula = source.damageText;
      delete source.damageText;
    }

    if (Array.isArray(source.attacks)) {
      source.attacks = Object.fromEntries(
        source.attacks.map((attack) => [foundry.utils.randomID(), attack]),
      );
    }

    return this.sanitizeFormulaSource(source);
  }

  static sanitizeFormulaSource(source) {
    if (!source) return source;
    this.#sanitizeFormula(source, 'damageFormula');
    this.#sanitizeFormula(source, 'chaseDistanceFormula');
    for (const attack of this.extraAttacks(source)) {
      this.#sanitizeFormula(attack, 'damageFormula');
    }
    return source;
  }

  static #sanitizeFormula(target, key) {
    if (typeof target?.[key] !== 'string') return;
    target[key] = target[key].trim();
    if (!this.isValidDamageFormula(target[key])) target[key] = '';
  }

  static extraAttacks(system = {}) {
    return Object.values(system.attacks ?? {});
  }

  static strikesFrom(system = {}) {
    const defaults = system.attack || {};
    const strikes = [];
    if (system.damageFormula) {
      strikes.push(this.#strikeFrom(system.damageFormula, '', defaults, defaults));
    }
    for (const extra of this.extraAttacks(system)) {
      if (!extra?.damageFormula) continue;
      strikes.push(this.#strikeFrom(extra.damageFormula, extra.name, extra, defaults));
    }
    return strikes;
  }

  static shotCount(system = {}) {
    if (Number(system.charges) > 0) {
      const remaining = Math.max(0, Number(system.remainingCharges) || 0);
      if (this.isMagicalTrapType(system.trapType)) return remaining > 0 ? 1 : 0;
      return remaining;
    }
    return 1;
  }

  static consumeCharges(system = {}) {
    const remaining = Math.max(0, Number(system.remainingCharges) || 0);
    if (!(Number(system.charges) > 0)) return remaining;
    if (this.isMagicalTrapType(system.trapType)) return Math.max(0, remaining - 1);
    return 0;
  }

  static chargedEnchantmentsForTrigger(behavior, payload) {
    const sourceItem = this.payloadItem(behavior, payload);
    const charged = (ItemEnchantment.list(sourceItem) || []).filter((entry) => entry?.charged);
    if (this.isMagicalTrapType(behavior?.system?.trapType) && charged.length > 1) {
      return [charged[Math.floor(Math.random() * charged.length)]];
    }
    return charged;
  }

  static isOpposedTrapType(trapType) {
    const type = Number(trapType);
    return type === this.TRAPTYPE_ARROW || type === this.TRAPTYPE_BLADE;
  }

  static defaultWeaponType(trapType) {
    const type = Number(trapType);
    if (type === this.TRAPTYPE_ARROW) return 'rangeweapon';
    if (type === this.TRAPTYPE_BLADE) return 'meleeweapon';
    return '';
  }

  static applyAttackWeaponPrefillOnCreate(data = {}) {
    if (!data.system) data.system = {};
    if (data.system.attack?.weaponType) return;
    const weaponType = this.defaultWeaponType(data.system.trapType);
    if (!weaponType) return;
    foundry.utils.setProperty(data, 'system.attack.weaponType', weaponType);
  }

  static applyAttackWeaponPrefill(system = {}, changes = {}) {
    const delta = changes.system;
    if (!delta || !Object.hasOwn(delta, 'trapType')) return;
    if (Number(delta.trapType) === Number(system.trapType)) return;

    const previousDefault = this.defaultWeaponType(system.trapType);
    const nextDefault = this.defaultWeaponType(delta.trapType);
    const incoming = Object.hasOwn(delta.attack ?? {}, 'weaponType')
      ? delta.attack.weaponType
      : (system.attack?.weaponType ?? '');
    if (!incoming || incoming === previousDefault) {
      foundry.utils.setProperty(changes, 'system.attack.weaponType', nextDefault);
    }

    for (const [id, attack] of Object.entries(system.attacks ?? {})) {
      const extraDelta = delta.attacks?.[id];
      const extraIncoming = extraDelta && Object.hasOwn(extraDelta, 'weaponType')
        ? extraDelta.weaponType
        : (attack?.weaponType ?? '');
      if (extraIncoming && extraIncoming !== previousDefault) continue;
      foundry.utils.setProperty(changes, `system.attacks.${id}.weaponType`, nextDefault);
    }
  }

  static isCrushTrapType(trapType) {
    return Number(trapType) === this.TRAPTYPE_CRUSH;
  }

  static sheetVisibility(trapType) {
    return {
      showDamage: !this.skipsTriggerDamage(trapType),
      showAttack: this.isOpposedTrapType(trapType),
      showTimer: this.isTimerTrapType(trapType),
      showPassword: this.isCrushTrapType(trapType),
      showChase: this.isStoneTrapType(trapType),
    };
  }

  static hiddenSystemFieldNames(trapType) {
    const vis = this.sheetVisibility(trapType);
    const hide = new Set();
    if (!vis.showDamage) hide.add('damageFormula');
    if (!vis.showAttack) {
      hide.add('weaponType');
      hide.add('at');
      hide.add('traits');
    }
    if (!vis.showTimer) {
      hide.add('timerRounds');
      hide.add('escapeModifier');
      hide.add('escalateEvery');
      hide.add('escalateMax');
    }
    if (!vis.showPassword) hide.add('passwordRequired');
    if (!vis.showChase) {
      hide.add('chaseGs');
      hide.add('chaseFw');
      hide.add('chaseDistanceFormula');
    }
    return hide;
  }

  static isOpposedStrike(trapType, weaponType) {
    if (weaponType === 'meleeweapon' || weaponType === 'rangeweapon') return true;
    return this.isOpposedTrapType(trapType);
  }

  static willApplyPayload(system = {}, strikes = []) {
    if (this.isStoneTrapType(system.trapType)) return false;
    if (this.skipsTriggerDamage(system.trapType)) return true;
    if (!strikes.length) return true;
    return strikes.some((strike) => !this.isOpposedStrike(system.trapType, strike.weaponType));
  }

  static attackTypeForTrap(trapType, weaponType) {
    const resolved = weaponType || this.defaultWeaponType(trapType);
    if (resolved === 'rangeweapon') return 'rangeAttack';
    return 'meleeAttack';
  }

  static isOpposedHit(result) {
    const level = result?.result?.successLevel ?? result?.successLevel;
    return Number(level) > 0;
  }

  static isGroupCheckResist(effect) {
    const args = effect?.system?.macroArgs || {};
    return Boolean(args.groupCheck) || Number(args.maxRolls) > 0;
  }

  static copyPayloadFromItem(item) {
    const effects = (item.effects ?? []).map((effect) => {
      const data = effect.toObject ? effect.toObject() : duplicate(effect);
      delete data._id;
      return data;
    });

    const dsaFlags = duplicate(item.flags?.dsa5 || {});
    const refs = duplicate(item.system?.refs || {});

    return { effects, flags: dsaFlags, refs };
  }

  static attachPayloadToBehaviorData(behaviorData, item) {
    const payload = this.copyPayloadFromItem(item);
    behaviorData.flags ??= {};
    behaviorData.flags[this.PAYLOAD_FLAG] ??= {};
    Object.assign(behaviorData.flags[this.PAYLOAD_FLAG], {
      payloadEffects: payload.effects,
      payloadFlags: payload.flags,
      payloadRefs: payload.refs,
      img: item.img || this.DEFAULT_IMG,
    });
    return behaviorData;
  }

  static payloadFromBehavior(behavior) {
    const flags = behavior.flags?.[this.PAYLOAD_FLAG] || {};
    return {
      effects: flags.payloadEffects || [],
      flags: flags.payloadFlags || {},
      refs: flags.payloadRefs || {},
    };
  }

  static payloadItem(behavior, payload) {
    payload ??= this.payloadFromBehavior(behavior);
    const flags = { dsa5: duplicate(payload.flags || {}) };
    return {
      name: behavior.name,
      uuid: behavior.uuid,
      img: this.trapImg(behavior),
      flags,
      getFlag(scope, key) {
        return getProperty(this.flags, `${scope}.${key}`);
      },
      async update(data) {
        const expanded = expandObject(data);
        mergeObject(this.flags, expanded.flags || {}, { inplace: true });
        payload.flags = this.flags.dsa5;
        await behavior.update?.({ 'flags.dsa5.payloadFlags': this.flags.dsa5 });
      },
    };
  }

  static hitExtrasMarkup(payload = {}) {
    return DiceDSA5.parseEffect({
      system: { effect: { value: '' } },
      flags: { dsa5: payload.flags || {} },
    });
  }

  static async applyPayloadEffects(actor, effects, { origin, sourceName, skipResistRolls = false, trapMessage, token } = {}) {
    if (!actor || !effects?.length) return { resistRolls: [] };

    const prepared = duplicate(effects).map((effect) => {
      delete effect._id;
      if (effect.duration) {
        const value = effect.duration.value;
        effect.duration.value = (value != null && Number.isFinite(Number(value))) ? Math.round(Number(value)) : null;
      }
      return effect;
    });

    const applied = await DSAActiveEffectConfig.applyAdvancedFunction(
      actor,
      prepared,
      { name: sourceName || 'Trap', type: 'trap' },
      { qualityStep: 0 },
      actor,
      { origin, skipResistRolls },
    );

    if (skipResistRolls || !applied?.resistRolls?.length) return applied;

    const simple = [];
    for (const resist of applied.resistRolls) {
      if (this.isGroupCheckResist(resist.effect) && trapMessage) {
        await this.openEscapeCheck({ trapMessage, token, resist });
      } else {
        simple.push(resist);
      }
    }
    if (simple.length) await DSAActiveEffectConfig.createResistRollMessage(simple, origin, 'target');
    return applied;
  }

  static async openEscapeCheck({ trapMessage, token, resist } = {}) {
    if (!resist) return;
    if (trapMessage) {
      const trapData = duplicate(trapMessage.flags?.dsa5?.trapData || {});
      trapData.pendingEscapeEffects = [...(trapData.pendingEscapeEffects || []), duplicate(resist.effect)];
      await trapMessage.update({ 'flags.dsa5.trapData': trapData });
    }

    const args = resist.effect?.system?.macroArgs || {};
    GroupCheck.openDialog({
      name: resist.skill,
      modifier: resist.mod || 0,
      configuration: {
        targetQs: Number(args.targetQs) || 1,
        maxRolls: Number(args.maxRolls) || 7,
      },
      forceWhisperIDs: token ? RollRequestService.buildTokenWhisper(token) : false,
      datasetOptions: {
        mode: 'escape',
        message: trapMessage?.uuid,
      },
    });
  }

  static async announceHitExtras(behavior, payload, { actor, token } = {}) {
    const parsed = this.hitExtrasMarkup(payload);
    if (!parsed) return;
    const chatData = DSA5_Utility.chatDataSetup(
      `<div><b>${behavior.name}</b>: ${parsed}</div>`,
    );
    if (actor) {
      const tokenDoc = token?.document ?? (token?.documentName === 'Token' ? token : null);
      chatData.speaker = ChatMessage.getSpeaker({ actor, token: tokenDoc || undefined });
    }
    if (token?.uuid) {
      chatData.flags = mergeObject(chatData.flags || {}, {
        dsa5: { zoneAttack: { targetTokenUuid: token.uuid } },
      });
    }
    await ChatMessage.create(chatData);
  }

  static async rollChargedEnchantments(behavior, payload, { token } = {}) {
    const sourceItem = this.payloadItem(behavior, payload);
    const enchantments = this.chargedEnchantmentsForTrigger(behavior, payload);
    const previousTargets = token ? this.#setTokenTarget(token) : null;
    try {
      const consume = !this.isMagicalTrapType(behavior?.system?.trapType);
      for (const enchantment of enchantments) {
        try {
          await ItemEnchantment.roll(sourceItem, enchantment.id, {
            options: { bypass: true },
            postChat: true,
            consume,
          });
        } catch (err) {
          console.warn(err);
        }
      }
    } finally {
      if (previousTargets) this.#restoreTargets(previousTargets);
    }
  }

  static async trigger({ behavior, token, region, trapMessage, skipDialog = false } = {}) {
    const actor = token?.actor;
    if (!behavior || !actor) return null;

    const system = behavior.system || {};
    if (system.disarmed) return null;
    const shots = this.shotCount(system);
    if (system.charges > 0 && shots < 1) return null;

    const strikes = this.strikesFrom(system);
    const payload = this.payloadFromBehavior(behavior);
    const origin = behavior.uuid;
    const opposedResults = [];
    const skipDamage = this.skipsTriggerDamage(system.trapType);
    const applyPayload = this.willApplyPayload(system, strikes);
    let opposedHits = 0;
    let damageDealt = 0;
    let countdown = null;
    let chase = null;

    if (!skipDamage) {
      for (let shot = 0; shot < shots; shot++) {
        for (const strike of strikes) {
          if (this.isOpposedStrike(system.trapType, strike.weaponType)) {
            const opposed = await this.#resolveOpposedAttack({
              behavior, token, region, strike, payload, attachPayload: !applyPayload,
            });
            opposedResults.push(opposed);
            if (this.isOpposedHit(opposed)) {
              opposedHits += 1;
              if (!applyPayload) await this.rollChargedEnchantments(behavior, payload, { token });
            }
          } else {
            damageDealt += await this.#applyUnopposedDamage(actor, strike, behavior, token);
          }
        }
      }
    }

    if (applyPayload) {
      const effects = this.isSlideTrapType(system.trapType)
        ? this.withSlideResist(payload.effects, damageDealt)
        : payload.effects;
      await this.applyPayloadEffects(actor, effects, {
        origin,
        sourceName: behavior.name,
        trapMessage,
        token,
      });
      if (!skipDamage) {
        await this.announceHitExtras(behavior, payload, { actor, token });
        await this.rollChargedEnchantments(behavior, payload, { token });
      }
    }

    if (this.isTimerTrapType(system.trapType)) {
      countdown = await this.startTimer({ behavior, token, trapMessage, openEscape: !skipDialog });
    }
    if (this.isStoneTrapType(system.trapType)) {
      chase = await this.startBoulderChase({ behavior, token, region });
    }

    if (Number(system.charges) > 0) {
      await behavior.update({ 'system.remainingCharges': this.consumeCharges(system) });
    }

    return {
      strikes,
      shots,
      formula: strikes[0]?.damageFormula || '',
      opposedResult: opposedResults[0] ?? null,
      opposedResults,
      opposedHits,
      damageDealt,
      countdown,
      chase,
    };
  }

  static #strikeFrom(damageFormula, name, source, defaults) {
    return {
      name: name || '',
      damageFormula,
      weaponType: source.weaponType || defaults.weaponType || '',
      at: source.at ?? defaults.at,
      traits: source.traits || defaults.traits || '',
    };
  }

  static async #applyUnopposedDamage(actor, strike, behavior, token) {
    const formula = strike?.damageFormula || '';
    const roll = await new Roll(formula).evaluate();
    try {
      game.dsa5.apps.DiceDSA5?._addRollDiceSoNice?.(
        { messageMode: game.settings.get('core', 'messageMode') },
        roll,
        game.dsa5.apps.DiceSoNiceCustomization?.getAttributeConfiguration?.('damage'),
      );
    } catch (err) {
      console.warn(err);
    }
    await this.postDamageCard({
      trapName: behavior?.name,
      strikeName: strike?.name,
      formula,
      roll,
      actor,
      token,
    });
    return Number(roll.total) || 0;
  }

  static diceFromRoll(roll) {
    const dice = [];
    for (const term of roll?.dice || []) {
      for (const result of term.results || []) {
        if (result.discarded) continue;
        dice.push({ faces: term.faces, result: result.result });
      }
    }
    return dice;
  }

  static async postDamageCard({ trapName, strikeName, formula, roll, actor, token } = {}) {
    if (!roll) return;
    const content = await renderTemplate('systems/dsa5/templates/chat/trap/damage.hbs', {
      trapName: trapName || '',
      strikeName: strikeName || '',
      formula: formula || roll.formula,
      total: roll.total,
      dice: this.diceFromRoll(roll),
      applyDamageInChat: game.settings.get('dsa5', 'applyDamageInChat'),
    });
    const tokenDoc = token?.document ?? (token?.documentName === 'Token' ? token : null);
    const chatData = DSA5_Utility.chatDataSetup(content);
    chatData.speaker = ChatMessage.getSpeaker({ actor, token: tokenDoc || undefined });
    chatData.rolls = [roll];
    chatData.flags = mergeObject(chatData.flags || {}, {
      data: { postData: { chatCardDamage: Number(roll.total) } },
    });
    return ChatMessage.create(chatData);
  }

  static applyPostedDamage(message, mode = 'value') {
    if (!message?.id) return;
    return applyDamage({ dataset: { messageId: message.id } }, mode);
  }

  static async #resolveOpposedAttack({ behavior, token, region, strike, payload, attachPayload = true }) {
    const traits = String(strike.traits || '')
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    const attackName = strike.name ? `${behavior.name} (${strike.name})` : behavior.name;

    const sourceItem = {
      name: attackName,
      img: this.trapImg(behavior),
      uuid: behavior.uuid,
      flags: { dsa5: attachPayload ? (payload.flags || {}) : {} },
      effects: attachPayload ? (payload.effects || []) : [],
    };

    return ZoneAttack.resolve({
      sourceItem,
      sourceActor: DSA5_Utility.emptyActor(12, behavior.name),
      region,
      behavior,
      targetToken: token,
      attackName,
      attackValue: Number(strike.at) || 12,
      damageFormula: strike.damageFormula || '0',
      attackType: this.attackTypeForTrap(behavior.system.trapType, strike.weaponType),
      traits,
    });
  }

  static #setTokenTarget(token) {
    const previous = [...(game.user.targets || [])];
    try {
      const object = token.documentName === 'Token' ? token.object : token.object ?? token;
      if (object && game.user.targets) {
        game.user.targets.clear();
        game.user.targets.add(object);
      }
    } catch (err) {
      console.warn(err);
    }
    return previous;
  }

  static #restoreTargets(previous) {
    if (!game.user.targets) return;
    game.user.targets.clear();
    for (const entry of previous || []) game.user.targets.add(entry);
  }
}
