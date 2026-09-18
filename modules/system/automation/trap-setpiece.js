import DSA5_Utility from '../helpers/utility-dsa5.js';
import Chase from '../../combat/chase/chase.js';
import { DICE_CONSTANTS } from '../../config/dice-constants.js';

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

  static countdownFrom(system = {}, extras = {}) {
    return {
      remaining: Math.max(0, Number(system.timerRounds) || 0),
      elapsed: 0,
      escapeModifier: Number(system.escapeModifier) || 0,
      escalateEvery: Math.max(0, Number(system.escalateEvery) || 0),
      escalateMax: Number(system.escalateMax) || 0,
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
      timedOut: false,
    };
    if (next.escalateEvery > 0 && next.elapsed % next.escalateEvery === 0) {
      const stepped = (Number(next.escapeModifier) || 0) - 1;
      next.escapeModifier = Math.max(Number(next.escalateMax) || 0, stepped);
    }
    next.timedOut = next.remaining <= 0;
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

  static timerEscapeResist(system = {}) {
    return {
      skill: _loc('LocalizedIDs.featOfStrength'),
      mod: Number(system.escapeModifier) || 0,
      effect: {
        name: system.name || _loc('REGIONBEHAVIOR_DSATrap.escape'),
        system: {
          macroArgs: { groupCheck: true, maxRolls: 99, targetQs: 1 },
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

    if (!game.combat) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.timerNeedsCombat', {
        format: { trap: behavior.name, rounds: countdown.remaining },
        localize: true,
      });
    }

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

  static async persistCountdown(behavior, countdown, trapMessage) {
    if (behavior?.update) {
      await behavior.update({ 'flags.dsa5.countdown': countdown });
    }
    if (!trapMessage?.update) return;
    const trapData = duplicate(trapMessage.flags?.dsa5?.trapData || {});
    trapData.countdown = {
      remaining: countdown.remaining,
      escapeModifier: countdown.escapeModifier,
      timedOut: Boolean(countdown.timedOut),
    };
    await trapMessage.update({ 'flags.dsa5.trapData': trapData });
  }

  static async clearCountdown(behavior, trapMessage) {
    if (behavior?.update) await behavior.update({ 'flags.dsa5.countdown': null });
    if (!trapMessage?.update) return;
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

  static async startBoulderChase({ behavior, token, region, combat } = {}) {
    const system = behavior?.system || {};
    if (!this.isStoneTrapType(system.trapType)) return null;
    if (!token?.actor) return null;

    const gs = Number(system.chaseGs) || 0;
    const fw = Number(system.chaseFw) || 0;
    const distance = await this.rollChaseDistance(system.chaseDistanceFormula);
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
      flags: { dsa5: { trapBoulder: true, chaseFw: fw } },
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
