import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import NavalCombat from './mkr/naval-combat.js';
import NavalCombatDamage from './mkr/naval-combat-damage.js';
import NavalHouseRules from './mkr/naval-house-rules.js';
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

  /**
   * GM start options for Prügelei. Returns null if cancelled.
   * @returns {Promise<{ppSource: string, resetPP: boolean, applyPostDamage: boolean, unarmEveryone: boolean}|null>}
   */
  async brawlingDialog() {
    const content = await renderTemplate('systems/dsa5/templates/dialog/brawling-start-dialog.hbs', {
      ppSource: 'current',
      resetPP: true,
      applyPostDamage: false,
      unarmEveryone: true,
    });

    return foundry.applications.api.DialogV2.wait({
      window: { title: 'BRAWLING.name' },
      position: { width: 480 },
      content,
      rejectClose: false,
      modal: true,
      // Same DialogV2 scroll workaround as ActorPickerDialog: content scrolls, footer stays put.
      render: (_event, dialog) => {
        const form = dialog.element.querySelector('form');
        if (!form) return;
        form.style.overflowY = 'hidden';
        form.querySelector('.dialog-content')?.classList.add('scrollable');
      },
      buttons: [
        {
          action: 'ok',
          icon: 'fa fa-check',
          label: 'ok',
          default: true,
          callback: (_event, button) => {
            const form = button.form;
            return {
              ppSource: form.elements.ppSource.value === 'max' ? 'max' : 'current',
              resetPP: form.elements.resetPP.checked,
              applyPostDamage: form.elements.applyPostDamage.checked,
              unarmEveryone: form.elements.unarmEveryone.checked,
            };
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
          callback: () => null,
        },
      ],
    });
  }

  /**
   * Ask whether to convert lost PP into LeP damage now, or keep PP for later.
   * @returns {Promise<{applyPostDamage: boolean}|null>}
   */
  async brawlingEndDialog() {
    const content = `<p>${_loc('BRAWLING.dialog.endIntro')}</p>
      <ul class="dsalist">
        <li>${_loc('BRAWLING.dialog.endApplyHint')}</li>
        <li>${_loc('BRAWLING.dialog.endKeepHint')}</li>
      </ul>`;

    return foundry.applications.api.DialogV2.wait({
      window: { title: 'BRAWLING.dialog.endTitle' },
      position: { width: 480, height: 'auto' },
      content,
      rejectClose: false,
      modal: true,
      buttons: [
        {
          action: 'apply',
          icon: 'fa fa-heart-crack',
          label: 'BRAWLING.dialog.endApply',
          default: true,
          callback: () => ({ applyPostDamage: true }),
        },
        {
          action: 'keep',
          icon: 'fa fa-clock',
          label: 'BRAWLING.dialog.endKeep',
          callback: () => ({ applyPostDamage: false }),
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
          callback: () => null,
        },
      ],
    });
  }

  /**
   * @returns {boolean} False if the GM cancelled leaving brawl.
   */
  async convertToBrawl(force = undefined) {
    const goBrawling = force ?? !this.isBrawling;

    const actorUpdates = [];
    const tokenUpdates = [];
    const chatMessages = [];

    if (goBrawling) {
      const options = await this.brawlingDialog();
      if (!options) return false;

      await this.update({ 'system.unarmEveryone': options.unarmEveryone });

      for (const x of this.combatants) {
        if (!x.actor) continue;

        const change = await x.brawlingChange({
          ppSource: options.ppSource,
          resetPP: options.resetPP,
          applyPostDamage: options.applyPostDamage,
          unarm: options.unarmEveryone,
        });

        if (change.actorChange) {
          if (x.actor.isToken) {
            await x.actor.update(change.actorChange);
          } else {
            actorUpdates.push(change.actorChange);
          }
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

      DSA5Combat.brawlStart();
    } else {
      const end = await this.brawlingEndDialog();
      if (!end) return false;

      for (const x of this.combatants) {
        if (!x.actor) continue;

        const change = end.applyPostDamage
          ? await x.settlePostBrawlDamage()
          : x.leaveBrawling();

        if (change.actorChange) {
          if (x.actor.isToken) {
            await x.actor.update(change.actorChange);
          } else {
            actorUpdates.push(change.actorChange);
          }
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

    if (actorUpdates.length) await Actordsa5.updateDocuments(actorUpdates);
    if (tokenUpdates.length) await game.canvas.scene.updateEmbeddedDocuments('Token', tokenUpdates);
    await this.update({
      'system.isBrawling': goBrawling,
      'system.combatMode': goBrawling ? 'brawling' : 'standard',
      ...this.#navalResetFields(),
      ...this.#chaseResetFields(),
    });

    if (chatMessages.length) {
      await this.showBrawlingDamage(chatMessages);
    }
    return true;
  }

  /**
   * When combat ends outside brawl mode but leftover PP remain, ask to settle.
   * @returns {Promise<boolean>} False if cancelled.
   */
  async settleLingeringBrawlPoints() {
    const combatants = [...this.combatants].filter(
      (c) => c.actor && Number(c.actor.system.status?.temporaryLeP?.max) > 0,
    );
    if (!combatants.length) return true;

    const end = await this.brawlingEndDialog();
    if (!end) return false;
    if (!end.applyPostDamage) return true;

    const actorUpdates = [];
    const chatMessages = [];
    for (const x of combatants) {
      const change = await x.settlePostBrawlDamage({ switchTokenBar: false });
      if (change.actorChange) {
        if (x.actor.isToken) await x.actor.update(change.actorChange);
        else actorUpdates.push(change.actorChange);
      }
      if (change.damage.brawlDamage > 0) {
        chatMessages.push({
          name: x.token?.name ?? x.actor.name,
          id: x.token?.id,
          data: change.damage,
        });
      }
    }

    if (actorUpdates.length) await Actordsa5.updateDocuments(actorUpdates);
    if (chatMessages.length) await this.showBrawlingDamage(chatMessages);
    return true;
  }

  /**
   * Clear Prügelpunkte (temporaryLeP) for every actor with a token on the active scene.
   */
  static async resetSceneBrawlingPoints() {
    if (!game.user.isGM) return;
    const scene = canvas.scene;
    if (!scene) {
      ui.notifications.warn('BRAWLING.resetPPNoScene', { localize: true });
      return;
    }

    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'BRAWLING.resetPP' },
      content: `<p>${_loc('BRAWLING.resetPPConfirm')}</p>`,
      rejectClose: false,
      modal: true,
    });
    if (!confirmed) return;

    const seen = new Set();
    const actorUpdates = [];
    for (const token of scene.tokens) {
      const actor = token.actor;
      if (!actor || seen.has(actor.id)) continue;
      seen.add(actor.id);
      if (!(Number(actor.system.status?.temporaryLeP?.max) > 0)) continue;
      actorUpdates.push({
        _id: actor.id,
        system: { status: { temporaryLeP: { value: 0, max: 0 } } },
      });
    }

    if (!actorUpdates.length) {
      ui.notifications.info('BRAWLING.resetPPNone', { localize: true });
      return;
    }

    await Actordsa5.updateDocuments(actorUpdates);
    ui.notifications.info(_loc('BRAWLING.resetPPDone', { count: actorUpdates.length }));
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
      const updates = this.turns.map((combatant) => combatant.getRoundStateResetUpdate());
      if (updates.length) await this.updateEmbeddedDocuments('Combatant', updates);
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

  /**
   * Naval MKR: cycle phase-relevant combatants; at end of the loop advance the MKR phase.
   * Damage report has no active turn — End Turn finishes the MKR.
   */
  async nextTurn() {
    if (!this.isNavalMkr) return super.nextTurn();
    if (this.round === 0) return this.nextRound();

    const phase = NavalCombat.normalizePhase(this.system.mkrPhase);
    if (phase === 'damageReport') return this.nextMkr();

    const relevant = NavalCombat.phaseRelevantCombatants(this, phase);
    if (!relevant.length) return this.#requestAdvanceMkrPhase();

    const currentId = this.combatant?.id;
    const idx = relevant.findIndex((c) => c.id === currentId);
    if (idx < 0) {
      return this.#setCombatTurn(this.turns.findIndex((c) => c.id === relevant[0].id));
    }
    if (idx >= relevant.length - 1) return this.#requestAdvanceMkrPhase();

    const next = relevant[idx + 1];
    return this.#setCombatTurn(this.turns.findIndex((c) => c.id === next.id));
  }

  async #setCombatTurn(turn) {
    if (turn < 0) return this;
    await this.#clearBroadsideShots();
    const advanceTime = this.getTimeDelta(this.round, this.turn, this.round, turn);
    const updateData = { round: this.round, turn };
    const updateOptions = { direction: 1, worldTime: { delta: advanceTime } };
    Hooks.callAll('combatTurn', this, updateData, updateOptions);
    await this.update(updateData, updateOptions);
    return this;
  }

  async previousTurn() {
    if (this.isNavalMkr) await this.#clearBroadsideShots();
    return super.previousTurn();
  }

  async #requestAdvanceMkrPhase() {
    if (game.user.isGM) return this.advanceMkrPhase();
    await game.socket.emit('system.dsa5', {
      type: 'advanceMkrPhase',
      payload: { combatId: this.id },
    });
    return this;
  }

  async getDefenseCount(speaker) {
    const comb = this.getCombatantFromActor(speaker);
    return comb?.system.defenseCount
  }

  getCombatantFromActor(speaker) {
    if (!speaker) return undefined;

    if (speaker.token) {
      return this.getCombatantForToken(speaker.token);
    }
    if (speaker.actor) {
      return this.getCombatantForActor(speaker.actor);
    }

    return undefined;
  }

  /**
   * First combatant linked to a token id or TokenDocument.
   * @param {string|TokenDocument} token
   * @returns {Combatant|null}
   */
  getCombatantForToken(token) {
    return this.getCombatantsByToken(token)[0] ?? null;
  }

  /**
   * First combatant linked to an actor id or Actor.
   * @param {string|Actor} actor
   * @returns {Combatant|null}
   */
  getCombatantForActor(actor) {
    return this.getCombatantsByActor(actor)[0] ?? null;
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
    const combatant = this.getCombatantForToken(tokenDoc);
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
      'system.chaseDefaultSkill': 'bodyControl',
    };
  }

  #chaseInitFields(mode) {
    const Handler = mode === 'vehicleChase' ? VehicleChase : Chase;
    const round = Math.max(1, this.round || 1);
    const terrain = Handler.TERRAIN_IDS.includes(this.system.chaseTerrain)
      ? this.system.chaseTerrain
      : 'normal';
    const preferred = mode === 'vehicleChase' ? 'boatsAndShips' : 'bodyControl';

    return {
      'system.combatMode': mode,
      'system.isBrawling': false,
      'system.chaseStartRound': round,
      'system.chaseMaxRounds': this.system.chaseMaxRounds || Chase.DEFAULT_MAX_ROUNDS,
      'system.chaseTerrain': terrain,
      'system.chaseDefaultSkill': preferred,
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
      if (this.isBrawling) {
        const left = await this.convertToBrawl(false);
        if (!left) return;
      } else {
        await this.update({
          'system.combatMode': 'standard',
          ...(current === 'navalMkr' ? this.#navalResetFields() : {}),
          ...(Chase.isChaseMode(current) ? this.#chaseResetFields() : {}),
        });
      }
      await this.#removeVehicleCombatants();
      if (Chase.isChaseMode(current)) Chase.clearAssignFleerHint();
      return;
    }

    if (mode === 'navalMkr') {
      if (this.isBrawling) {
        const left = await this.convertToBrawl(false);
        if (!left) return;
      }

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
      if (Chase.isChaseMode(current)) Chase.clearAssignFleerHint();
      return;
    }

    if (mode === 'chase' || mode === 'vehicleChase') {
      if (this.isBrawling) {
        const left = await this.convertToBrawl(false);
        if (!left) return;
      }
      if (mode === 'chase') await this.#removeVehicleCombatants();
      const enteringChase = !Chase.isChaseMode(current);
      await this.update(this.#chaseInitFields(mode));
      await this.#assignDefaultChaseRoles({ enteringChase });
      await this.#announceMkrChat(mode === 'vehicleChase' ? 'CHASE.startedVehicle' : 'CHASE.started', {
        round: Math.max(1, this.round || 1),
      });
      Chase.showAssignFleerHint(this);
      return;
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
    const turn = NavalCombat.firstRelevantTurnIndex(this, 'heroActions') ?? 0;

    await this.#tickVehicleRamCooldown();
    await NavalHouseRules.tickAutoReload(this);
    await this.#clearBroadsideShots();
    await this.update({
      round: nextRound,
      turn,
      'system.mkrRound': mkrRound,
      'system.mkrKrStart': nextRound,
      'system.mkrPhase': 'heroActions',
      'system.commandedGuns': [],
      'system.pendingHits': [],
    });
    await this.#announceMkrChat('VEHICLE.mkr.advanced', { mkr: mkrRound, round: nextRound });
  }

  async #clearBroadsideShots() {
    // TypedObjectField merges plain `{}`; ForcedReplacement is required to wipe keys.
    const empty = foundry.data.operators.ForcedReplacement.create({});
    const updates = this.combatants
      .filter((c) => c.system?.broadsideShots && Object.keys(c.system.broadsideShots).length)
      .map((c) => ({ _id: c.id, 'system.broadsideShots': empty }));
    if (updates.length) await this.updateEmbeddedDocuments('Combatant', updates);
  }

  async setChaseTerrain(terrain) {
    if (!game.user.isGM || !this.isChase) return;
    const Handler = Chase.handlerFor(this);
    if (!Handler.TERRAIN_IDS.includes(terrain)) return;
    await this.update({ 'system.chaseTerrain': terrain });
    if (this.isVehicleChase) this.#refreshVehicleChaseSheets();
  }

  /** Keep open vehicle sheets' effective GS in sync with chase terrain. */
  #refreshVehicleChaseSheets() {
    for (const combatant of this.combatants) {
      const actor = combatant.actor;
      if (actor?.type === 'vehicle') actor.sheet?.render(false);
    }
  }

  async setChaseMaxRounds(value) {
    if (!game.user.isGM || !this.isChase) return;
    const max = Math.max(1, Math.floor(Number(value) || Chase.DEFAULT_MAX_ROUNDS));
    await this.update({ 'system.chaseMaxRounds': max });
  }

  async setChaseDefaultSkill(skillKey) {
    if (!game.user.isGM || !this.isChase) return;
    const Handler = Chase.handlerFor(this);
    const keys = Handler.locomotionSkillKeys(null, this);
    if (!keys.includes(skillKey)) return;
    await this.update({ 'system.chaseDefaultSkill': skillKey });
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

    const becomingFirstFleer = role === 'fleeing'
      && Chase.getRole(combatant) !== 'fleeing'
      && ![...this.combatants].some((c) => c.id !== combatantId && Chase.getRole(c) === 'fleeing');

    await combatant.update({ 'system.chaseRole': role });

    if (becomingFirstFleer) {
      Chase.clearAssignFleerHint();
      await Chase.promptAndApplyInitialDistances(this, combatant);
    } else if (role === 'fleeing') {
      Chase.clearAssignFleerHint();
    } else if (!Chase.hasFleer(this)) {
      Chase.showAssignFleerHint(this);
    }
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
    if (!next) return;

    await this.#clearBroadsideShots();
    await this.update(this.#mkrPhaseTurnUpdate(next));

    if (next === 'attacks') await NavalCombatDamage.promptCommandedGuns(this);
    if (next === 'damageReport') await NavalCombatDamage.processDamageReport(this);
  }

  /** Step back one MKR phase without undoing damage / gun prompts. */
  async retreatMkrPhase() {
    if (!game.user.isGM || !this.isNavalMkr) return;

    const prev = NavalCombat.previousPhase(this.system.mkrPhase || 'heroActions');
    if (!prev) return;

    await this.#clearBroadsideShots();
    await this.update(this.#mkrPhaseTurnUpdate(prev));
  }

  /** Phase change payload: damage report clears the active turn; others jump to first actor. */
  #mkrPhaseTurnUpdate(phase) {
    const update = { 'system.mkrPhase': phase };
    if (phase === 'damageReport') {
      update.turn = null;
      return update;
    }
    const turn = NavalCombat.firstRelevantTurnIndex(this, phase);
    if (turn !== null) update.turn = turn;
    return update;
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
