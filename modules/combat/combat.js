import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import NavalCombat from './mkr/naval-combat.js';
import NavalCombatDamage from './mkr/naval-combat-damage.js';
import NavalChase from './mkr/naval-chase.js';
const { renderTemplate } = foundry.applications.handlebars;

export default class DSA5Combat extends Combat {
  constructor(data, context) {
    if (!data) data = {};
    if (!data.type) data.type = 'dsacombat';
    super(data, context);
  }

  async refreshTokenbars() {
    if (game.dsa5.apps.tokenHotbar) game.dsa5.apps.tokenHotbar.updateDSA5Hotbar(undefined, true);
  }

  get isBrawling() {
    return this.system.isBrawling;
  }

  get combatMode() {
    return NavalCombat.resolveCombatMode(this);
  }

  get isNavalMkr() {
    return NavalCombat.isNavalMkrActive(this);
  }

  getMkrProgress() {
    return NavalCombat.getMkrProgress(this);
  }

  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this.refreshTokenbars();
  }

  _onDelete(options, userId) {
    super._onDelete(options, userId);
    this.refreshTokenbars();
  }

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    this.refreshTokenbars();
  }

  async brawlingDialog() {
    return await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'BRAWLING.unarmEveryone',
      },
      content: `<p>${_loc('BRAWLING.unarmEveryoneText')}</p>`,
      rejectClose: false,
      modal: true,
    });
  }

  async convertToBrawl(force = undefined) {
    const goBrawling = force ?? !this.isBrawling;

    const actorUpdates = [];
    const tokenUpdates = [];
    const chatMessages = [];

    if (goBrawling) {
      const unarmEveryone = await this.brawlingDialog();
      if (unarmEveryone === null) return;

      await this.update({ 'system.unarmEveryone': unarmEveryone })

      for (const x of this.combatants) {
        if (!x.actor) return {};

        const change = await x.brawlingChange();

        if (x.actor.isToken) {
          await x.actor.update(change.actorChange);
        } else {
          actorUpdates.push(change.actorChange);
        }

        tokenUpdates.push(...change.tokenChange);
        DSA5Combat.brawlStart();
      }
    } else {
      for (const x of this.combatants) {
        if (!x.actor) return {};

        const change = await x.undoBrawlingChange();
        if (x.actor.isToken) {
          await x.actor.update(change.actorChange);
        } else {
          actorUpdates.push(change.actorChange);
        }

        tokenUpdates.push(...change.tokenChange);
        if (change.damage.brawlDamage > 0) {
          chatMessages.push({
            name: x.token.name,
            id: x.token.id,
            data: change.damage,
          });
        }
      }
    }

    await Actordsa5.updateDocuments(actorUpdates);
    await game.canvas.scene.updateEmbeddedDocuments('Token', tokenUpdates);
    await this.update({
      'system.isBrawling': goBrawling,
      'system.combatMode': goBrawling ? 'brawling' : 'standard',
      ...this.#navalResetFields(),
    });

    if (chatMessages.length) {
      await this.showBrawlingDamage(chatMessages);
    }
  }

  async showBrawlingDamage(messages) {
    const template = await renderTemplate('systems/dsa5/templates/chat/brawling-damage.hbs', { messages });
    ChatMessage.create(DSA5_Utility.chatDataSetup(template));
  }

  static async brawlStart(timeout = 2000, broadcast = true) {
    if (broadcast && DSA5_Utility.isActiveGM()) {
      await game.socket.emit('system.dsa5', {
        type: 'brawlStart',
        payload: {},
      });
    }

    $('.bumFight').remove();
    const brawlAnim = await renderTemplate('systems/dsa5/templates/system/bumFight/animation.hbs', {});
    $('body').append(brawlAnim);

    const bum = $('.bumFight');
    bum.on('click', () => bum.remove());
    bum.addClass('fight');
    setTimeout(function () {
      bum.fadeOut(1000, () => bum.remove());
    }, timeout);
  }

  async clearRoundState() {
    if (game.user.isGM) {
      for (const k of this.turns) {
        await k.update({ 'system.defenseCount': 0, 'system.roundInitiative': -1, 'system.actionsUsed': 0, 'system.freeActionUsed': false, 'system.movementActionConsumed': false });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'clearCombat',
        payload: {},
      });
    }
  }

  _sortCombatants(a, b) {
    let ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    let ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;

    if (a.system.roundInitiative >= 0) ia = a.system.roundInitiative;
    if (b.system.roundInitiative >= 0) ib = b.system.roundInitiative

    return (ib - ia) || (a.id > b.id ? 1 : -1);
  }

  async previousRound() {
    await this.clearRoundState();
    return await super.previousRound();
  }

  async nextRound() {
    await this.clearRoundState();
    return await super.nextRound();
  }

  async getDefenseCount(speaker) {
    const comb = this.getCombatantFromActor(speaker);
    return comb?.system.defenseCount
  }

  getCombatantFromActor(speaker) {
    if (!speaker) return undefined;

    if (speaker.token) {
      return this.combatants.find(combatant => combatant.tokenId === speaker.token);
    } else if (speaker.actor) {
      return this.combatants.find(combatant => combatant.actorId === speaker.actor);
    }

    return undefined;
  }

  async updateDefenseCount(speaker) {
    if (game.user.isGM) {
      const comb = this.getCombatantFromActor(speaker);
      if (comb && !comb.actor.system.config.defense) {
        await comb.update({ 'system.defenseCount': comb.system.defenseCount + 1 });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'updateDefenseCount',
        payload: {
          speaker,
        },
      });
    }
  }

  async updateActionCount(speaker, cost = 1) {
    if (game.user.isGM) {
      const comb = this.getCombatantFromActor(speaker);
      if (comb) {
        await comb.update({ 'system.actionsUsed': (comb.system.actionsUsed || 0) + cost });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'updateActionCount',
        payload: { speaker, cost },
      });
    }
  }

  async toggleFreeAction(speaker) {
    if (game.user.isGM) {
      const comb = this.getCombatantFromActor(speaker);
      if (comb) {
        await comb.update({ 'system.freeActionUsed': !comb.system.freeActionUsed });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'toggleFreeAction',
        payload: { speaker },
      });
    }
  }

  async handleMovementCost(tokenDoc) {
    const combatant = this.combatants.find(c => c.tokenId === tokenDoc.id);
    if (!combatant) return;

    const tokenObj = tokenDoc.object;
    let distance = 0;
    if (tokenObj && tokenDoc.movementHistory?.length) {
      try {
        distance = tokenObj.measureMovementPath(tokenDoc.movementHistory).distance;
      } catch { return; }
    }
    if (distance <= 0) return;

    const updates = {};

    // Any movement consumes the free action
    if (!combatant.system.freeActionUsed) {
      updates['system.freeActionUsed'] = true;
    }

    // Movement beyond GS additionally consumes one base action
    const speed = combatant.actor?.speedByMovementType?.('walk') || 0;
    if (speed > 0 && distance > speed && !combatant.system.movementActionConsumed) {
      updates['system.actionsUsed'] = (combatant.system.actionsUsed || 0) + 1;
      updates['system.movementActionConsumed'] = true;
    }

    if (Object.keys(updates).length) {
      if (game.user.isGM) {
        await combatant.update(updates);
      } else {
        await game.socket.emit('system.dsa5', {
          type: 'handleMovementCost',
          payload: { tokenId: tokenDoc.id },
        });
      }
    }
  }

  #navalResetFields() {
    return {
      'system.mkrRound': 0,
      'system.mkrKrStart': 0,
      'system.mkrPhase': 'heroActions',
      'system.maneuverModifiers': {},
      'system.commandedGuns': [],
      'system.pendingHits': [],
      'system.waterTerrain': 'normal',
    };
  }

  async setCombatMode(mode) {
    if (!game.user.isGM) return;

    const current = this.combatMode;
    if (current === mode) return;

    if (mode === 'brawling') {
      await this.convertToBrawl(true);
      return;
    }

    if (mode === 'standard') {
      if (this.isBrawling) await this.convertToBrawl(false);
      else if (current === 'navalMkr') await this.update({ 'system.combatMode': 'standard', ...this.#navalResetFields() });
      else await this.update({ 'system.combatMode': 'standard' });
      return;
    }

    if (mode === 'navalMkr') {
      if (this.isBrawling) await this.convertToBrawl(false);

      const round = Math.max(1, this.round || 1);
      await this.update({
        'system.combatMode': 'navalMkr',
        'system.isBrawling': false,
        'system.mkrRound': 1,
        'system.mkrKrStart': round,
        'system.mkrPhase': 'heroActions',
        'system.krPerMkr': this.system.krPerMkr || NavalCombat.DEFAULT_KR_PER_MKR,
        'system.maneuverModifiers': {},
        'system.commandedGuns': [],
        'system.pendingHits': [],
        'system.waterTerrain': 'normal',
      });
      await this.#announceMkrChat('VEHICLE.mkr.started', { mkr: 1, round });
    }
  }

  async nextMkr() {
    if (!game.user.isGM || !this.isNavalMkr) return;

    const krPerMkr = this.system.krPerMkr || NavalCombat.DEFAULT_KR_PER_MKR;
    const mkrKrStart = this.system.mkrKrStart ?? this.round ?? 1;
    const nextRound = mkrKrStart + krPerMkr;
    const mkrRound = (this.system.mkrRound || 1) + 1;

    await this.#tickVehicleRamCooldown();
    await this.update({
      round: nextRound,
      'system.mkrRound': mkrRound,
      'system.mkrKrStart': nextRound,
      'system.mkrPhase': 'heroActions',
      'system.commandedGuns': [],
      'system.pendingHits': [],
    });
    await this.#announceMkrChat('VEHICLE.mkr.advanced', { mkr: mkrRound, round: nextRound });
  }

  async setWaterTerrain(terrain) {
    if (!game.user.isGM || !this.isNavalMkr) return;
    if (!NavalChase.WATER_TERRAIN_IDS.includes(terrain)) return;
    await this.update({ 'system.waterTerrain': terrain });
  }

  async advanceMkrPhase() {
    if (!game.user.isGM || !this.isNavalMkr) return;

    const next = NavalCombat.nextPhase(this.system.mkrPhase || 'heroActions');
    await this.update({ 'system.mkrPhase': next });

    if (next === 'attacks') await NavalCombatDamage.promptCommandedGuns(this);
    if (next === 'damageReport') await NavalCombatDamage.processDamageReport(this);
  }

  async #tickVehicleRamCooldown() {
    const updates = [];
    for (const comb of this.combatants) {
      if (comb.actor?.type !== 'vehicle') continue;
      const cd = comb.actor.system.combatState?.ramCooldownMKR ?? 0;
      if (cd > 0) {
        updates.push({ _id: comb.actor.id, 'system.combatState.ramCooldownMKR': cd - 1 });
      }
    }
    if (updates.length) await Actordsa5.updateDocuments(updates);
  }

  async #announceMkrChat(key, data) {
    ChatMessage.create(DSA5_Utility.chatDataSetup(_loc(key, data)));
  }
}