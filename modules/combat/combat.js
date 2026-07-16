import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import NavalCombat from './mkr/naval-combat.js';
import NavalCombatDamage from './mkr/naval-combat-damage.js';
import Chase from './chase/chase.js';
import VehicleChase from './chase/vehicle-chase.js';
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

  get isChase() {
    return Chase.isChaseActive(this);
  }

  get isVehicleChase() {
    return Chase.isVehicleChase(this);
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
      ...this.#chaseResetFields(),
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
        await k.update({
          'system.defenseCount': 0,
          'system.roundInitiative': -1,
          'system.actionsUsed': 0,
          'system.freeActionUsed': false,
          'system.movementActionConsumed': false,
          'system.chaseRolled': false,
          'system.chaseLastMove': 0,
          'system.chaseDistanceBefore': null,
        });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'clearCombat',
        payload: {},
      });
    }
  }

  _sortCombatants(a, b) {
    if (Chase.isChaseActive(this)) {
      const roleA = Chase.getRole(a);
      const roleB = Chase.getRole(b);
      if (roleA !== roleB) {
        if (roleA === 'fleeing') return -1;
        if (roleB === 'fleeing') return 1;
      }
      const da = Chase.getDistance(a) ?? Number.POSITIVE_INFINITY;
      const db = Chase.getDistance(b) ?? Number.POSITIVE_INFINITY;
      return (da - db) || (a.id > b.id ? 1 : -1);
    }

    let ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    let ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;

    if (a.system.roundInitiative >= 0) ia = a.system.roundInitiative;
    if (b.system.roundInitiative >= 0) ib = b.system.roundInitiative;

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
    };
  }

  #chaseResetFields() {
    return {
      'system.chaseStartRound': 0,
      'system.chaseMaxRounds': Chase.DEFAULT_MAX_ROUNDS,
    };
  }

  #chaseInitFields(mode) {
    const Handler = mode === 'vehicleChase' ? VehicleChase : Chase;
    const round = Math.max(1, this.round || 1);
    const terrain = Handler.TERRAIN_IDS.includes(this.system.chaseTerrain)
      ? this.system.chaseTerrain
      : 'normal';

    return {
      'system.combatMode': mode,
      'system.isBrawling': false,
      'system.chaseStartRound': round,
      'system.chaseMaxRounds': this.system.chaseMaxRounds || Chase.DEFAULT_MAX_ROUNDS,
      'system.chaseTerrain': terrain,
      ...this.#navalResetFields(),
    };
  }

  async setCombatMode(mode) {
    if (!game.user.isGM) return;

    const current = this.combatMode;
    if (current === mode) return;

    if (mode === 'brawling') {
      await this.#removeVehicleCombatants();
      await this.convertToBrawl(true);
      return;
    }

    if (mode === 'standard') {
      if (this.isBrawling) await this.convertToBrawl(false);
      else {
        await this.update({
          'system.combatMode': 'standard',
          ...(current === 'navalMkr' ? this.#navalResetFields() : {}),
          ...(Chase.isChaseMode(current) ? this.#chaseResetFields() : {}),
        });
      }
      await this.#removeVehicleCombatants();
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
        ...this.#chaseResetFields(),
      });
      await this.#announceMkrChat('VEHICLE.mkr.started', { mkr: 1, round });
      return;
    }

    if (mode === 'chase' || mode === 'vehicleChase') {
      if (this.isBrawling) await this.convertToBrawl(false);
      if (mode === 'chase') await this.#removeVehicleCombatants();
      const enteringChase = !Chase.isChaseMode(current);
      await this.update(this.#chaseInitFields(mode));
      await this.#assignDefaultChaseRoles({ enteringChase });
      await this.#announceMkrChat(mode === 'vehicleChase' ? 'CHASE.startedVehicle' : 'CHASE.started', {
        round: Math.max(1, this.round || 1),
      });
    }
  }

  /** Default every combatant to Verfolger unless already marked Flüchtend. */
  async #assignDefaultChaseRoles({ enteringChase = false } = {}) {
    const updates = [];
    for (const combatant of this.combatants) {
      if (combatant.system?.chaseRole === 'fleeing') continue;
      const update = { _id: combatant.id };
      let changed = false;
      if (combatant.system?.chaseRole !== 'chasing') {
        update['system.chaseRole'] = 'chasing';
        changed = true;
      }
      // Legacy initial 0 must not count as "Caught" before the GM sets a start distance.
      if (enteringChase && combatant.system?.chaseDistance === 0) {
        update['system.chaseDistance'] = null;
        changed = true;
      }
      if (changed) updates.push(update);
    }
    if (updates.length) await this.updateEmbeddedDocuments('Combatant', updates);
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

  async setChaseTerrain(terrain) {
    if (!game.user.isGM || !this.isChase) return;
    const Handler = Chase.handlerFor(this);
    if (!Handler.TERRAIN_IDS.includes(terrain)) return;
    await this.update({ 'system.chaseTerrain': terrain });
  }

  async setChaseMaxRounds(value) {
    if (!game.user.isGM || !this.isChase) return;
    const max = Math.max(1, Math.floor(Number(value) || Chase.DEFAULT_MAX_ROUNDS));
    await this.update({ 'system.chaseMaxRounds': max });
  }

  async markChaseRolled(combatantId) {
    if (!this.isChase) return;
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;

    if (game.user.isGM || combatant.isOwner) {
      await combatant.update({ 'system.chaseRolled': true });
      return;
    }

    await game.socket.emit('system.dsa5', {
      type: 'markChaseRolled',
      payload: { combatantId },
    });
  }

  async applyChaseDistanceUpdates(updates) {
    if (!this.isChase || !updates?.length) return;

    if (game.user.isGM) {
      await this.updateEmbeddedDocuments('Combatant', updates);
      return;
    }

    await game.socket.emit('system.dsa5', {
      type: 'applyChaseDistanceUpdates',
      payload: { updates },
    });
  }

  async setCombatantChaseRole(combatantId, role) {
    if (!game.user.isGM || !this.isChase) return;
    if (!['fleeing', 'chasing'].includes(role)) return;
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    await combatant.update({ 'system.chaseRole': role });
  }

  async setCombatantChaseDistance(combatantId, distance) {
    if (!game.user.isGM || !this.isChase) return;
    const combatant = this.combatants.get(combatantId);
    if (!combatant) return;
    const previous = Chase.getDistance(combatant);
    const next = Math.max(0, Number(distance) || 0);
    await combatant.update({ 'system.chaseDistance': next });
    if (next <= 0 && previous !== null && previous > 0) {
      await Chase.announceCatch(this, combatant);
    }
  }

  async advanceMkrPhase() {
    if (!game.user.isGM || !this.isNavalMkr) return;

    const next = NavalCombat.nextPhase(this.system.mkrPhase || 'heroActions');
    await this.update({ 'system.mkrPhase': next });

    if (next === 'attacks') await NavalCombatDamage.promptCommandedGuns(this);
    if (next === 'damageReport') await NavalCombatDamage.processDamageReport(this);
  }

  async #removeVehicleCombatants() {
    const ids = this.combatants.filter((c) => c.actor?.type === 'vehicle').map((c) => c.id);
    if (ids.length) await this.deleteEmbeddedDocuments('Combatant', ids);
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
