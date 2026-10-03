import DSA5_Utility from '../helpers/utility-dsa5.js';
import Chase from '../../combat/chase/chase.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';
import TrapFlow from './trap-flow.js';
import GroupCheck from '../rolls/group-check.js';

const { duplicate } = foundry.utils;

/**
 * Crush, suffocate, slide, and boulder set-pieces for trap automation.
 * Static methods live here so TrapAutomation can inherit them.
 * Numeric ids match DSATrapRegionBehavior (that file cannot be imported here).
 */
export default class TrapSetpiece {
  static TRAPTYPE_STONE = 1;
  static TRAPTYPE_ARROW = 2;
  static TRAPTYPE_BLADE = 3;
  static TRAPTYPE_CRUSH = 4;
  static TRAPTYPE_SLIDE = 5;
  static TRAPTYPE_SUFFOCATE = 6;
  static TRAPTYPE_MAGICAL = 7;

  static isTimerTrapType(trapType) {
    const type = Number(trapType);
    return type === this.TRAPTYPE_CRUSH || type === this.TRAPTYPE_SUFFOCATE;
  }

  static isStoneTrapType(trapType) {
    return Number(trapType) === this.TRAPTYPE_STONE;
  }

  static isMagicalTrapType(trapType) {
    return Number(trapType) === this.TRAPTYPE_MAGICAL;
  }

  static isSlideTrapType(trapType) {
    return Number(trapType) === this.TRAPTYPE_SLIDE;
  }

  static isSetpieceTrapType(trapType) {
    return this.isTimerTrapType(trapType) || this.isStoneTrapType(trapType) || this.isSlideTrapType(trapType);
  }

  static DEFAULT_IMG = 'systems/dsa5/icons/categories/trap.webp';

  static trapImg(source) {
    return source?.flags?.dsa5?.img || source?.img || this.DEFAULT_IMG;
  }

  static skipsTriggerDamage(trapType) {
    return this.isTimerTrapType(trapType) || this.isStoneTrapType(trapType);
  }

  static parseInterval(value) {
    const match = String(value || '').match(/-?\d+/);
    return match ? Math.max(0, Number(match[0]) || 0) : 0;
  }

  static countdownFrom(system = {}, extras = {}) {
    const escape = TrapFlow.defenseOfType(system, 'group') || {};
    const interval = escape.interval || '';
    return {
      remaining: Math.max(0, Number(escape.timerRounds) || 0),
      elapsed: 0,
      escapeModifier: Number(escape.modifier) || 0,
      escalateEvery: Math.max(0, Number(escape.escalateEvery) || 0),
      escalateMax: Number(escape.escalateMax) || 0,
      interval,
      intervalRounds: this.parseInterval(interval),
      combatSinceAttempt: 0,
      timedOut: false,
      trapName: extras.trapName || '',
      trapMessage: extras.trapMessage || '',
      tokenUuid: extras.tokenUuid || '',
    };
  }

  static advanceCountdown(countdown = {}) {
    const next = {
      ...countdown,
      remaining: Math.max(0, (Number(countdown.remaining) || 0) - 1),
      elapsed: (Number(countdown.elapsed) || 0) + 1,
      combatSinceAttempt: (Number(countdown.combatSinceAttempt) || 0) + 1,
      timedOut: false,
    };
    if (next.escalateEvery > 0 && next.elapsed % next.escalateEvery === 0) {
      const stepped = (Number(next.escapeModifier) || 0) - 1;
      next.escapeModifier = Math.max(Number(next.escalateMax) || 0, stepped);
    }
    next.timedOut = next.remaining <= 0;
    return next;
  }

  /**
   * Spend leftover interval KR for one escape attempt.
   * Combat ticks already counted since the last attempt are not subtracted again.
   */
  static spendEscapeInterval(countdown = {}) {
    const interval = Math.max(0, Number(countdown.intervalRounds) || this.parseInterval(countdown.interval));
    const already = Math.max(0, Number(countdown.combatSinceAttempt) || 0);
    const extra = Math.max(0, interval - already);
    let next = { ...countdown, combatSinceAttempt: 0 };
    for (let i = 0; i < extra; i++) next = this.advanceCountdown(next);
    next.combatSinceAttempt = 0;
    return next;
  }

  static resistRollPlus(resistRoll, delta) {
    const text = String(resistRoll || '').trim();
    if (!text) return text;
    const parts = text.split(/\s+/);
    const last = parts.pop();
    const current = Number(last);
    if (!Number.isFinite(current)) {
      parts.push(last, String(delta));
      return parts.join(' ');
    }
    parts.push(String(current + Number(delta) || 0));
    return parts.join(' ');
  }

  static slideStunEffect(damage = 0) {
    const skill = _loc('LocalizedIDs.selfControl');
    const stunned = CONFIG.statusEffects?.find((effect) => effect.id === 'stunned');
    return {
      name: stunned?.name ? _loc(stunned.name) : skill,
      img: stunned?.img || 'icons/svg/daze.svg',
      statuses: ['stunned'],
      system: {
        resistRoll: `${skill} ${-Math.abs(Number(damage) || 0)}`,
        changes: [{ key: 'system.condition.stunned', type: 'add', value: 1 }],
      },
    };
  }

  static withSlideResist(effects = [], damage = 0) {
    const copies = duplicate(effects || []);
    const penalty = -Math.abs(Number(damage) || 0);
    const withResist = copies.filter((effect) => effect?.system?.resistRoll);
    if (withResist.length) {
      for (const effect of withResist) {
        effect.system.resistRoll = this.resistRollPlus(effect.system.resistRoll, penalty);
      }
      return copies;
    }
    return [...copies, this.slideStunEffect(damage)];
  }

  static resolvedGroupTargetQs(value) {
    const qs = Number(value);
    return Number.isFinite(qs) && qs > 1 ? qs : GroupCheck.DEFAULT_TARGET_QS;
  }

  static resolvedGroupMaxRolls(value) {
    const maxRolls = Number(value);
    return Number.isFinite(maxRolls) && maxRolls > 0 ? maxRolls : GroupCheck.DEFAULT_MAX_ROLLS;
  }

  static groupCheckFrom(system = {}) {
    const enricher = TrapSetpiece.#groupCheckFromText(system.description, system.gmdescription);
    const stored = TrapFlow.defenseOfType(system, 'group') || {};
    const enricherQs = Number(enricher.targetQs);
    return {
      targetQs: Number.isFinite(enricherQs) && enricherQs > 0
        ? enricherQs
        : this.resolvedGroupTargetQs(stored.targetQs),
      maxRolls: enricher.maxRolls != null
        ? GroupCheck.resolveMaxRolls(enricher.maxRolls)
        : this.resolvedGroupMaxRolls(stored.maxRolls),
    };
  }

  static groupTargetQsFrom(system = {}) {
    return this.groupCheckFrom(system).targetQs;
  }

  static groupMaxRollsFrom(system = {}) {
    return this.groupCheckFrom(system).maxRolls;
  }

  static #groupCheckFromText(...texts) {
    const merged = {};
    for (const text of texts) {
      const parsed = this.#groupCheckFromEnricher(text);
      if (!parsed) continue;
      for (const [key, value] of Object.entries(parsed)) {
        if (merged[key] == null) merged[key] = value;
      }
    }
    return merged;
  }

  static #groupCheckFromEnricher(text) {
    if (!text) return null;
    for (const match of String(text).matchAll(/options=\{([^}]*)\}/g)) {
      try {
        const opts = JSON.parse(`{${match[1]}}`);
        const parsed = {};
        if (opts.targetQs != null && Number.isFinite(Number(opts.targetQs))) parsed.targetQs = Number(opts.targetQs);
        if (opts.maxRolls != null && Number.isFinite(Number(opts.maxRolls))) parsed.maxRolls = Number(opts.maxRolls);
        if (opts.interval != null && String(opts.interval).trim()) parsed.interval = String(opts.interval).trim();
        if (Object.keys(parsed).length) return parsed;
      } catch (err) {
        /* ignore malformed enricher options */
      }
    }
    return null;
  }

  static timerEscapeResist(system = {}) {
    const escape = TrapFlow.defenseOfType(system, 'group') || {};
    const groupCheck = this.groupCheckFrom(system);
    return {
      skill: escape.skill || _loc('LocalizedIDs.featOfStrength'),
      mod: Number(escape.modifier) || 0,
      interval: escape.interval || '',
      applications: escape.applications || '',
      effect: {
        name: system.name || _loc('REGIONBEHAVIOR_DSATrap.escape'),
        system: {
          macroArgs: {
            groupCheck: true,
            maxRolls: groupCheck.maxRolls,
            targetQs: groupCheck.targetQs,
            interval: escape.interval || '',
            applications: escape.applications || '',
          },
        },
      },
    };
  }

  static async startTimer({ behavior, token, trapMessage, openEscape = true } = {}) {
    const system = behavior?.system || {};
    if (!this.isTimerTrapType(system.trapType)) return null;
    const countdown = this.countdownFrom(system, {
      trapName: behavior.name,
      trapMessage: trapMessage?.uuid || '',
      tokenUuid: token?.uuid || '',
    });
    if (countdown.remaining < 1) return null;

    await this.persistCountdown(behavior, countdown, trapMessage);
    await this.ensureStartedCombat(token);

    if (system.passwordRequired) {
      await this.notifyPassword(behavior);
    }

    if (openEscape) {
      await this.openEscapeCheck?.({
        trapMessage,
        token,
        resist: this.timerEscapeResist({ ...system, name: behavior.name }),
      });
    }

    return countdown;
  }

  static shouldTickCountdown(countdown, { round, disarmed } = {}) {
    if (disarmed || !countdown || countdown.timedOut) return false;
    if (Number.isFinite(round) && countdown.lastRound === round) return false;
    return true;
  }

  static cardCountdown(countdown) {
    if (!countdown) return null;
    return {
      remaining: countdown.remaining,
      escapeModifier: countdown.escapeModifier,
      timedOut: Boolean(countdown.timedOut),
      interval: countdown.interval || '',
    };
  }

  static async persistCountdown(behavior, countdown, trapMessage) {
    if (behavior?.update) {
      await behavior.update({ 'flags.dsa5.countdown': countdown });
    }
    if (!trapMessage?.update) return;
    const cardCountdown = this.cardCountdown(countdown);
    const { TrapState } = await import('../../chatmessage/trap_state.js');
    const trapState = await TrapState.fromMessage(trapMessage);
    if (trapState) {
      await trapState.persistCard({ trapDataPatch: { countdown: cardCountdown } });
      return;
    }
    const trapData = duplicate(trapMessage.flags?.dsa5?.trapData || {});
    trapData.countdown = cardCountdown;
    await trapMessage.update({ 'flags.dsa5.trapData': trapData });
  }

  static async clearCountdown(behavior, trapMessage) {
    if (behavior?.update) await behavior.update({ 'flags.dsa5.countdown': null });
    if (!trapMessage?.update) return;
    const { TrapState } = await import('../../chatmessage/trap_state.js');
    const trapState = await TrapState.fromMessage(trapMessage);
    if (trapState) {
      await trapState.persistCard({ trapDataPatch: { countdown: null } });
      return;
    }
    const trapData = duplicate(trapMessage.flags?.dsa5?.trapData || {});
    trapData.countdown = null;
    await trapMessage.update({ 'flags.dsa5.trapData': trapData });
  }

  static async tickCountdown(behavior, trapMessage) {
    const stored = behavior?.flags?.dsa5?.countdown;
    if (!stored || stored.timedOut || stored.remaining < 1) return stored || null;

    const next = this.advanceCountdown(stored);
    if (Number.isFinite(game.combat?.round)) next.lastRound = game.combat.round;
    await this.persistCountdown(behavior, next, trapMessage || await TrapSetpiece.#messageFromCountdown(stored));

    if (next.timedOut) await this.notifyTimeout(behavior, next);
    else if (next.escalateEvery > 0 && next.elapsed % next.escalateEvery === 0) {
      ui.notifications.info('REGIONBEHAVIOR_DSATrap.timerEscalated', {
        format: { trap: behavior.name, modifier: next.escapeModifier, rounds: next.remaining },
        localize: true,
      });
    }
    return next;
  }

  static async onRegionRound(behavior) {
    const countdown = behavior?.flags?.dsa5?.countdown;
    if (!this.shouldTickCountdown(countdown, {
      round: game.combat?.round,
      disarmed: behavior?.system?.disarmed,
    })) return null;
    const trapMessage = await TrapSetpiece.#messageFromCountdown(countdown);
    return this.tickCountdown(behavior, trapMessage);
  }

  static async notifyTimeout(behavior, countdown = {}) {
    const content = `<p>${_loc('REGIONBEHAVIOR_DSATrap.timerExpired', {
      trap: behavior?.name || countdown.trapName || '',
      rounds: countdown.elapsed || 0,
    })}</p>`;
    ui.notifications.warn('REGIONBEHAVIOR_DSATrap.timerExpired', {
      format: { trap: behavior?.name || countdown.trapName || '', rounds: countdown.elapsed || 0 },
      localize: true,
    });
    await ChatMessage.create(TrapSetpiece.#gmChatData(content));
  }

  static async notifyPassword(behavior) {
    const content = `<p>${_loc('REGIONBEHAVIOR_DSATrap.passwordRequired', { trap: behavior.name })}</p>`;
    ui.notifications.info('REGIONBEHAVIOR_DSATrap.passwordRequired', {
      format: { trap: behavior.name },
      localize: true,
    });
    await ChatMessage.create(TrapSetpiece.#gmChatData(content));
  }

  static async rollChaseDistance(formula) {
    const text = String(formula || '').trim();
    if (!text || !this.isValidDamageFormula?.(text)) return 0;
    const roll = await new Roll(text).evaluate();
    return Math.max(0, Number(roll.total) || 0);
  }

  static async applyBoulderCatch(combat, chaser) {
    const flags = chaser?.actor?.flags?.dsa5 || {};
    if (!flags.trapBoulder) return null;
    const trapMessage = flags.trapMessageUuid ? await fromUuid(flags.trapMessageUuid) : null;
    if (!trapMessage) return null;
    const { TrapState } = await import('../../chatmessage/trap_state.js');
    const trapState = await TrapState.fromMessage(trapMessage);
    if (!trapState) return null;
    return trapState.applyCatchDamage();
  }

  static async startBoulderChase({ behavior, token, region, combat, trapMessage } = {}) {
    const system = behavior?.system || {};
    if (!this.isStoneTrapType(system.trapType)) return null;
    if (!token?.actor) return null;

    const chase = TrapFlow.defenseOfType(system, 'chase') || {};
    const gs = Number(chase.gs) || 0;
    const fw = Number(chase.fw) || 0;
    const distance = await this.rollChaseDistance(chase.distanceFormula);
    if (!gs && !fw && !distance) return null;

    combat = await TrapSetpiece.#ensureCombat(token, combat);
    const victim = await TrapSetpiece.#ensureCombatant(combat, token);
    const boulder = await Actor.create({
      name: behavior.name,
      type: 'npc',
      img: this.trapImg(behavior),
      system: {
        characteristics: {
          mu: { initial: 14 },
          kl: { initial: 14 },
          in: { initial: 14 },
          ch: { initial: 14 },
          ff: { initial: 14 },
          ge: { initial: 14 },
          ko: { initial: 14 },
          kk: { initial: 14 },
        },
        status: {
          speed: { initial: gs },
          wounds: { value: 50 },
        },
      },
      flags: {
        dsa5: {
          trapBoulder: true,
          chaseFw: fw,
          trapMessageUuid: trapMessage?.uuid || '',
          trapBehaviorUuid: behavior?.uuid || '',
        },
      },
    });

    const skillName = _loc('LocalizedIDs.bodyControl');
    try {
      const existing = boulder.items.find((entry) => entry.type === 'skill' && entry.name === skillName);
      if (existing) {
        await existing.update({ 'system.talentValue.value': fw });
      } else {
        const skill = await DSA5_Utility.skillByName(skillName);
        if (skill) {
          const data = skill.toObject();
          data.system.talentValue.value = fw;
          await boulder.createEmbeddedDocuments('Item', [data]);
        }
      }
    } catch (err) {
      console.warn(err);
    }

    const boulderToken = await TrapSetpiece.#placeBoulderToken(boulder, { behavior, token, region });
    const [chaser] = await combat.createEmbeddedDocuments('Combatant', [{
      actorId: boulder.id,
      tokenId: boulderToken?.id,
      name: boulder.name,
      img: boulder.img,
      system: { chaseRole: 'chasing', chaseDistance: distance },
    }]);

    if (!Chase.isChaseActive(combat)) await combat.setCombatMode('chase');
    await combat.updateEmbeddedDocuments('Combatant', [
      { _id: victim.id, 'system.chaseRole': 'fleeing' },
      { _id: chaser.id, 'system.chaseRole': 'chasing', 'system.chaseDistance': distance },
    ]);
    Chase.clearAssignFleerHint();
    await combat.setChaseDefaultSkill?.('bodyControl');

    return {
      combat,
      boulder,
      boulderToken,
      chaser: combat.combatants.get(chaser.id) ?? chaser,
      victim: combat.combatants.get(victim.id) ?? victim,
      distance,
      gs,
      fw,
    };
  }

  static #trapLocation(region, token) {
    try {
      const bounds = region?.bounds;
      if (bounds && Number.isFinite(bounds.x) && Number.isFinite(bounds.width)) {
        return { x: bounds.x + (bounds.width / 2), y: bounds.y + (bounds.height / 2) };
      }
    } catch {
      /* region polygon tree may not be ready off-canvas */
    }
    const objectCenter = region?.object?.center;
    if (objectCenter && Number.isFinite(objectCenter.x)) {
      return { x: objectCenter.x, y: objectCenter.y };
    }
    const shape = region?.shapes?.[0];
    if (shape && Number.isFinite(Number(shape.x))) {
      const width = Number(shape.width) || (Number(shape.radiusX) * 2) || 0;
      const height = Number(shape.height) || (Number(shape.radiusY) * 2) || 0;
      return { x: Number(shape.x) + (width / 2), y: Number(shape.y) + (height / 2) };
    }
    const tokenDoc = token?.documentName === 'Token' ? token : token?.document;
    if (tokenDoc && Number.isFinite(Number(tokenDoc.x))) {
      return { x: Number(tokenDoc.x), y: Number(tokenDoc.y) };
    }
    if (Number.isFinite(Number(token?.x))) return { x: Number(token.x), y: Number(token.y) };
    return null;
  }

  static async #placeBoulderToken(boulder, { behavior, token, region } = {}) {
    const scene = token?.parent || token?.document?.parent || canvas.scene;
    if (!scene || !boulder) return null;

    const point = this.#trapLocation(region || behavior?.parent, token);
    if (!point) return null;

    try {
      const preview = await boulder.getTokenDocument({}, { parent: scene });
      const gridSize = scene.grid?.size || canvas.grid?.size || 100;
      const width = (preview.width || 1) * gridSize;
      const height = (preview.height || 1) * gridSize;
      const tokenData = await boulder.getTokenDocument({
        x: point.x - (width / 2),
        y: point.y - (height / 2),
        hidden: false,
        actorLink: true,
      }, { parent: scene });
      const [created] = await scene.createEmbeddedDocuments('Token', [tokenData]);
      return created ?? null;
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  static #gmChatData(content) {
    const gmIds = game.users.filter((user) => user.isGM && user.active).map((user) => user.id);
    return DSA5_Utility.chatDataSetup(content, DICE_CONSTANTS.CHAT_MODES.SELF, false, gmIds);
  }

  static async #messageFromCountdown(countdown) {
    if (!countdown?.trapMessage) return null;
    try {
      return await fromUuid(countdown.trapMessage);
    } catch (err) {
      console.warn(err);
      return null;
    }
  }

  static async ensureStartedCombat(token) {
    const combat = await TrapSetpiece.#ensureCombat(token, game.combat);
    if (token?.id && token?.actor?.id) {
      try {
        await TrapSetpiece.#ensureCombatant(combat, token);
      } catch (err) {
        console.warn(err);
      }
    }
    if (!combat.started) await combat.startCombat();
    return combat;
  }

  static async #ensureCombat(token, existing) {
    if (existing) return existing;
    if (game.combat) return game.combat;
    const sceneId = token?.parent?.id || canvas.scene?.id;
    const [created] = await Combat.createDocuments([{ type: 'dsacombat', scene: sceneId }]);
    await created.activate({ render: false });
    return game.combats.get(created.id) ?? created;
  }

  static async #ensureCombatant(combat, token) {
    const existing = combat.combatants.find((entry) => entry.tokenId === token.id || entry.actorId === token.actor?.id);
    if (existing) return existing;
    const [created] = await combat.createEmbeddedDocuments('Combatant', [{
      actorId: token.actor.id,
      tokenId: token.id,
    }]);
    return created;
  }
}
