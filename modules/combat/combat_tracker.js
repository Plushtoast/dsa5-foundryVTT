import Actordsa5 from '../actor/actor-dsa5.js';
import { ActAttackDialog } from '../dialog/dialog-react.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import { dispositionBackgroundStyle, dispositionBorderStyle } from '../system/helpers/token_disposition.js';
import NavalCombat from './mkr/naval-combat.js';
import Chase from './chase/chase.js';
import ChaseCombatTracker from './chase/chase-combat-tracker.js';

const { getProperty } = foundry.utils;

export class DSA5CombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/system/combattracker/header.hbs',
      templates: [
        'systems/dsa5/templates/system/combattracker/mkr-bar.hbs',
        'systems/dsa5/templates/system/combattracker/chase-bar.hbs',
      ],
    },
    tracker: {
      template: 'systems/dsa5/templates/system/combattracker/combattracker.hbs',
    },
    footer: {
      template: 'systems/dsa5/templates/system/combattracker/footer.hbs',
    },
  };

  static DEFAULT_OPTIONS = {
    actions: {
      convertToBrawl: this._convertToBrawl,
      nextMkr: this._nextMkr,
      cycleMkrPhase: { handler: this._onMkrPhaseControl, buttons: [0, 2] },
      advanceMkrPhase: this._advanceMkrPhase,
      retreatMkrPhase: this._retreatMkrPhase,
      setChaseTerrain: this._setChaseTerrain,
      setChaseMaxRounds: this._setChaseMaxRounds,
      setChaseDefaultSkill: this._setChaseDefaultSkill,
      setChaseRole: this._setChaseRole,
      setChaseDistance: this._setChaseDistance,
      aggroButton: this._onAggroButtonClicked,
      combatRules: this._onCombatRulesButtonClicked,
      createCombatMode: this._createCombatMode,
      resetBrawlingPoints: this._resetBrawlingPoints,
    },
  };

  static COMBAT_MODE_STARTS = [
    { id: 'standard', icon: 'fa-shield', label: 'COMBAT.MODE.standard', hint: 'COMBAT.MODE.standardHint' },
    { id: 'brawling', icon: 'fa-hand-fist fa-rotate-90', label: 'COMBAT.MODE.brawling', hint: 'COMBAT.MODE.brawlingHint' },
    { id: 'chase', icon: 'fa-person-running', label: 'COMBAT.MODE.chase', hint: 'COMBAT.MODE.chaseHint' },
    { id: 'vehicleChase', icon: 'fa-sailboat', label: 'COMBAT.MODE.vehicleChase', hint: 'COMBAT.MODE.vehicleChaseHint' },
    { id: 'navalMkr', icon: 'fa-ship', label: 'COMBAT.MODE.navalMkr', hint: 'COMBAT.MODE.navalMkrHint' },
  ];

  static async _createCombatMode(_event, target) {
    if (!game.user.isGM) return;
    const mode = target.dataset.mode || 'standard';
    let combat = game.combat;
    if (!combat) {
      combat = await game.combats.documentClass.create();
      await combat.activate({ render: false });
    }
    await combat.setCombatMode(mode);
  }

  static _nextMkr() {
    game.combat?.nextMkr();
  }

  static _onMkrPhaseControl(event) {
    event.preventDefault();
    if (event.button === 2) game.combat?.retreatMkrPhase();
    else game.combat?.advanceMkrPhase();
  }

  static _advanceMkrPhase() {
    game.combat?.advanceMkrPhase();
  }

  static _retreatMkrPhase() {
    game.combat?.retreatMkrPhase();
  }

  static _setChaseTerrain(_ev, target) {
    game.combat?.setChaseTerrain(target.value);
  }

  static _setChaseMaxRounds(_ev, target) {
    game.combat?.setChaseMaxRounds(target.value);
  }

  static _setChaseDefaultSkill(_ev, target) {
    game.combat?.setChaseDefaultSkill(target.value);
  }

  static _setChaseRole(_ev, target) {
    const combatantId = target.closest('[data-combatant-id]')?.dataset?.combatantId;
    if (!combatantId) return;
    game.combat?.setCombatantChaseRole(combatantId, target.value);
  }

  static async _setChaseDistance(_ev, target) {
    const combatantId = target.closest('[data-combatant-id]')?.dataset?.combatantId;
    if (!combatantId) return;
    const current = Number(target.dataset.distance) || 0;
    const value = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'CHASE.setDistance' },
      content: `<p><label>${_loc('CHASE.distance')}</label></p><input type="number" name="distance" min="0" step="1" value="${current}">`,
      ok: {
        label: 'Confirm',
        callback: (_event, button) => Number(button.form.elements.distance.value),
      },
    });
    if (value === null || value === undefined || Number.isNaN(value)) return;
    game.combat?.setCombatantChaseDistance(combatantId, value);
  }

  static _onAggroButtonClicked() {
    DSA5CombatTracker.runActAttackDialog();
  }

  static _convertToBrawl() {
    game.combat.convertToBrawl();
  }

  static _resetBrawlingPoints() {
    game.combats.documentClass.resetSceneBrawlingPoints();
  }

  static async _onCombatRulesButtonClicked() {
    if (DSA5_Utility.moduleEnabled('dsa5-core')) {
      if (game.i18n.lang == "de")
        game.dsa5.apps.journalBrowser.loadBookAndPage("Grundregelwerk", "Kampf", "books", 'Regeln');
      else
        game.dsa5.apps.journalBrowser.loadBookAndPage("Core rules", "Combat", "books", 'Rules');
    }
  }

  static runActAttackDialog() {
    if (!game.combat) return;

    const combatant = game.combat.combatant;
    if (!combatant) return;

    if (game.user.isGM || combatant.isOwner) ActAttackDialog.showDialog(combatant.actor, combatant.tokenId);
  }

  async _prepareTurnContext(combat, combatant, index) {
    const turn = await super._prepareTurnContext(combat, combatant, index);
    const isAllowedToSeeEffects = game.user.isGM || (combatant.actor && combatant.actor.testUserPermission(game.user, 'OBSERVER')) || !game.settings.get('dsa5', 'hideEffects');
    turn.defenseCount = combatant.system.defenseCount;
    turn.actionCount = Number(getProperty(combatant, 'actor.system.actionCount.value')) || 0;
    turn.actionCounts = `${turn.actionCount} ${_loc('actionCount')}`;
    turn.roundInitiative = combatant.system.roundInitiative;

    let remainders = [];
    let aiming = [];
    if (combatant.actor) {
      for (const x of combatant.actor.items) {
        const isWornRangeWeapon = x.type == 'rangeweapon' && x.system.worn.value;
        const lz = isWornRangeWeapon ? Actordsa5.calcLZ(x, combatant.actor) : 0;

        if (isWornRangeWeapon && x.system.reloadTime.progress > 0) {
          const wpn = {
            name: x.name,
            remaining: lz - x.system.reloadTime.progress,
          };
          if (wpn.remaining > 0) remainders.push(wpn);
        } else if (['spell', 'liturgy'].includes(x.type) && x.system.castingTime.modified > 0) {
          const wpn = {
            name: x.name,
            remaining: x.system.castingTime.modified - x.system.castingTime.progress,
          };
          if (wpn.remaining > 0) remainders.push(wpn);
        }

        if (isWornRangeWeapon) {
          const aimProgress = Number(x.system?.aimTime?.progress) || 0;
          if (aimProgress > 0) {
            const loaded = lz === 0 || (Number(x.system.reloadTime?.progress) || 0) >= lz;
            if (loaded) {
              aiming.push({
                name: x.name,
                progress: Math.clamp(aimProgress, 0, 2),
                status: `${aimProgress}/2`,
              });
            }
          }
        }
      }
    }
    remainders = remainders.sort((a, b) => a.remaining - b.remaining);

    aiming = aiming.sort((a, b) => b.progress - a.progress);

    const ongoingLines = [];
    if (remainders.length > 0) ongoingLines.push(...remainders.map((x) => `${x.name} - ${x.remaining}`));
    if (aiming.length > 0) ongoingLines.push(...aiming.map((x) => `${x.name} - ${_loc('WEAPON.aim')} ${x.status}`));

    if (ongoingLines.length > 0) {
      turn.ongoings = `${_loc('COMBATTRACKER.ongoing')}<br>${ongoingLines.join('<br>')}`;

      if (remainders.length > 0) turn.ongoing = remainders[0].remaining;
      else if (aiming.length > 0) turn.ongoing = aiming[0].progress;
    }
    const effects = [];
    const defeatedStatus = CONFIG.specialStatusEffects.DEFEATED;
    for (const e of combatant.actor?.temporaryEffects || []) {
      if (e.statuses.has(defeatedStatus) || e.statuses.has('defeated')) turn.isDefeated = true;
      else if (e.img && isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.system?.visibility?.hidePlayers) && !e.system?.visibility?.hideOnToken) {
        effects.push({ img: e.img, name: e.name });
      }
    }
    turn.effects = {
      icons: effects,
      tooltip: this._formatEffectsTooltip(effects),
    };

    const disposition = combatant.token?.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    turn.dispositionStyle = dispositionBackgroundStyle(disposition);
    turn.dispositionBorderStyle = dispositionBorderStyle(disposition);

    if (combatant.actor?.type === 'vehicle') {
      turn.vehicleImmobile = combatant.actor.system.isImmobile;
      turn.vehicleSinking = combatant.actor.system.isSinking;
    }

    if (NavalCombat.isNavalMkrActive(combat)) {
      turn.isVehicle = combatant.actor?.type === 'vehicle';
      turn.mkrPhaseRelevant = NavalCombat.isCombatantRelevantToPhase(combatant, combat.system.mkrPhase);
      if (!turn.mkrPhaseRelevant) {
        turn.css = `${turn.css || ''} mkr-phase-irrelevant`.trim();
      }
    }

    return ChaseCombatTracker.enrichTurn(turn, combatant, combat);
  }

  async _prepareCombatContext(context, options) {
    await super._prepareCombatContext(context, options);
    const combat = game.combat;
    context.isBrawling = combat?.isBrawling;
    context.combatMode = NavalCombat.resolveCombatMode(combat);
    context.isNavalMkr = NavalCombat.isNavalMkrActive(combat);
    context.combatModeIcon = {
      standard: 'fa-shield',
      brawling: 'fa-hand-fist fa-rotate-90',
      navalMkr: 'fa-ship',
      chase: 'fa-person-running',
      vehicleChase: 'fa-sailboat',
    }[context.combatMode] ?? 'fa-shield';
    context.combatModeTooltip = 'COMBAT.MODE.tooltip';
    context.combatRulesTooltip = {
      standard: 'COMBATTRACKER.rulesHint.standard',
      brawling: 'COMBATTRACKER.rulesHint.brawling',
      navalMkr: 'COMBATTRACKER.rulesHint.navalMkr',
      chase: 'COMBATTRACKER.rulesHint.chase',
      vehicleChase: 'COMBATTRACKER.rulesHint.vehicleChase',
    }[context.combatMode] ?? 'COMBATTRACKER.rulesHint.standard';
    context.combatModeStarts = this.constructor.COMBAT_MODE_STARTS;

    if (context.isNavalMkr) {
      this.#prepareNavalMkrContext(context, combat);
    }
    ChaseCombatTracker.prepareCombatContext(context, combat);
  }

  async _prepareTrackerContext(context, options) {
    await super._prepareTrackerContext(context, options);
    if (game.combat && Chase.isChaseActive(game.combat)) {
      // Always inject section headers (even empty) as drop targets for roles.
      context.turns = ChaseCombatTracker.reorderTurns(context.turns ?? [], game.combat);
    }
  }

  #prepareNavalMkrContext(context, combat) {
    context.mkr = NavalCombat.getMkrProgress(combat);
    context.mkrPhase = combat?.system?.mkrPhase;
  }

  _canSortInitiative(event) {
    return game.user.isGM;
  }

  _dragStartInitiativeSort(event) {
    const dataTransfer = {
      type: 'CombatantSort',
      data: {
        combatantId: event.currentTarget.dataset.combatantId,
      },
    };
    event.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
  }

  _dragOverInitiativeSort(event) {
    event.preventDefault();
    const isChase = Chase.isChaseActive(game.combat);
    const section = isChase ? event.target.closest('.chase-section-header[data-chase-role]') : null;
    const fieldset = event.target.closest('.combatant');

    if (section) {
      if (this.lastFieldset) {
        this.lastFieldset.classList.remove('dragSortMarker');
        this.lastFieldset = null;
      }
      if (this.lastSection !== section) {
        if (this.lastSection) this.lastSection.classList.remove('dragSortMarker');
        section.classList.add('dragSortMarker');
        this.lastSection = section;
      }
      return;
    }

    if (this.lastSection) {
      this.lastSection.classList.remove('dragSortMarker');
      this.lastSection = null;
    }

    if (fieldset) {
      if (this.lastFieldset !== fieldset) {
        if (this.lastFieldset) {
          this.lastFieldset.classList.remove('dragSortMarker');
        }
        fieldset.classList.add('dragSortMarker');
        this.lastFieldset = fieldset;
      }
    } else if (this.lastFieldset) {
      this.lastFieldset.classList.remove('dragSortMarker');
      this.lastFieldset = null;
    }
  }

  async _dropInitiativeSort(event) {
    event.preventDefault();
    if (this.lastSection) {
      this.lastSection.classList.remove('dragSortMarker');
      this.lastSection = null;
    }
    if (this.lastFieldset) {
      this.lastFieldset.classList.remove('dragSortMarker');
      this.lastFieldset = null;
    }

    const data = JSON.parse(event.dataTransfer.getData('text/plain'));

    if (data.type !== 'CombatantSort') return;

    const combatantId = data.data.combatantId;
    const combatant = game.combat.combatants.get(combatantId);
    if (!combatant) return;

    if (Chase.isChaseActive(game.combat)) {
      const sectionTarget = event.target.closest('.chase-section-header[data-chase-role]');
      let targetRole;

      if (sectionTarget) {
        targetRole = sectionTarget.dataset.chaseRole || 'chasing';
      } else {
        const roleTarget = event.target.closest('.combatant');
        if (roleTarget) {
          const targetCombatant = game.combat.combatants.get(roleTarget.dataset.combatantId);
          targetRole = Chase.getRole(targetCombatant);
        }
      }

      if (targetRole && combatant.system?.chaseRole !== targetRole) {
        await game.combat?.setCombatantChaseRole(combatantId, targetRole);
        return;
      }
    }

    const hoverTarget = event.target.closest('.combatant');
    if (!hoverTarget) return;

    const targetId = hoverTarget.dataset.combatantId;

    if (targetId === combatantId) return;

    const targetCombatant = game.combat.combatants.get(targetId);

    const roundInitiative = targetCombatant.properInitiative;
    const update = {};
    if (event.ctrlKey) {
      update.initiative = roundInitiative + 0.00001;
      update.system = {
        roundInitiative: -1,
      };
    } else {
      update.system = {
        roundInitiative: roundInitiative + 0.00001,
      };
    }

    await combatant.update(update);
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    if (game.user.isGM) {
      this._createContextMenu(this._getCombatModeContextOptions.bind(this), '.combat-mode-control', {
        eventName: 'click',
        fixed: true,
        parentClassHooks: false,
      });
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: ".combatant",
      dropSelector: ".combat-tracker",
      permissions: {
        dragstart: this._canSortInitiative.bind(this),
        drop: this._canSortInitiative.bind(this)
      },
      callbacks: {
        dragstart: this._dragStartInitiativeSort.bind(this),
        dragover: this._dragOverInitiativeSort.bind(this),
        drop: this._dropInitiativeSort.bind(this)
      }
    }).bind(this.element);

    for (const input of this.element.querySelectorAll('.chase-distance-input')) {
      input.addEventListener('change', (ev) => this.#onChaseDistanceChange(ev));
      input.addEventListener('click', (ev) => ev.stopPropagation());
    }

    for (const input of this.element.querySelectorAll('.chase-max-rounds-input')) {
      input.addEventListener('change', (ev) => {
        game.combat?.setChaseMaxRounds(ev.currentTarget.value);
      });
      input.addEventListener('click', (ev) => ev.stopPropagation());
    }

    this.element.querySelectorAll('.mkr-phase-control').forEach((el) => {
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    });

    for (const select of this.element.querySelectorAll('select[data-action="setChaseDefaultSkill"]')) {
      select.addEventListener('change', (ev) => {
        game.combat?.setChaseDefaultSkill(ev.currentTarget.value);
      });
      select.addEventListener('click', (ev) => ev.stopPropagation());
    }
  }

  async #onChaseDistanceChange(event) {
    if (!game.user.isGM) return;
    const input = event.currentTarget;
    const combatantId = input.closest('[data-combatant-id]')?.dataset?.combatantId;
    if (!combatantId) return;
    await game.combat?.setCombatantChaseDistance(combatantId, input.value);
  }

  _getEntryContextOptions() {
    const options = super._getEntryContextOptions();
    if (!Chase.isChaseActive(game.combat)) return options;

    options.unshift(
      {
        label: 'CHASE.role.fleeing',
        icon: '<i class="fas fa-person-running"></i>',
        visible: () => game.user.isGM,
        callback: (li) => game.combat?.setCombatantChaseRole(li.dataset.combatantId, 'fleeing'),
      },
      {
        label: 'CHASE.role.chasing',
        icon: '<i class="fas fa-bullseye"></i>',
        visible: () => game.user.isGM,
        callback: (li) => game.combat?.setCombatantChaseRole(li.dataset.combatantId, 'chasing'),
      },
      {
        label: 'CHASE.setDistance',
        icon: '<i class="fas fa-ruler"></i>',
        visible: (li) => {
          if (!game.user.isGM) return false;
          const c = game.combat?.combatants.get(li.dataset.combatantId);
          return Chase.getRole(c) === 'chasing';
        },
        callback: async (li) => {
          const combatant = game.combat?.combatants.get(li.dataset.combatantId);
          if (!combatant) return;
          const current = Number(combatant.system.chaseDistance) || 0;
          const value = await foundry.applications.api.DialogV2.prompt({
            window: { title: 'CHASE.setDistance' },
            content: `<p><label>${_loc('CHASE.distance')}</label></p><input type="number" name="distance" min="0" step="1" value="${current}">`,
            ok: {
              label: 'Confirm',
              callback: (_event, button) => Number(button.form.elements.distance.value),
            },
          });
          if (value === null || value === undefined || Number.isNaN(value)) return;
          await game.combat.setCombatantChaseDistance(combatant.id, value);
        },
      },
    );
    return options;
  }

  _getCombatModeContextOptions() {
    return [
      {
        label: _loc('COMBAT.MODE.standard'),
        icon: '<i class="fas fa-shield"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('standard'),
      },
      {
        label: _loc('COMBAT.MODE.brawling'),
        icon: '<i class="fas fa-hand-fist"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('brawling'),
      },
      {
        label: _loc('COMBAT.MODE.chase'),
        icon: '<i class="fas fa-person-running"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('chase'),
      },
      {
        label: _loc('COMBAT.MODE.vehicleChase'),
        icon: '<i class="fas fa-sailboat"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('vehicleChase'),
      },
      {
        label: _loc('COMBAT.MODE.navalMkr'),
        icon: '<i class="fas fa-ship"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('navalMkr'),
      },
    ];
  }
}

Hooks.on('preCreateCombatant', (data, options, user) => {
  const actor = DSA5_Utility.getSpeaker({
    actor: data.actorId,
    scene: data.sceneId,
    token: data.tokenId,
  });
  if (!actor) return;

  const combat = data.combat ?? game.combat;
  if (Chase.isChaseActive(combat) && data.system?.chaseRole !== 'fleeing') {
    const patch = { 'system.chaseRole': 'chasing' };
    const maxDistance = Chase.maxChaseDistance(combat);
    if (maxDistance !== null) patch['system.chaseDistance'] = maxDistance;
    if (data.updateSource) data.updateSource(patch);
    else {
      foundry.utils.setProperty(data, 'system.chaseRole', 'chasing');
      if (maxDistance !== null) foundry.utils.setProperty(data, 'system.chaseDistance', maxDistance);
    }
  }

  if (actor.type === 'vehicle') {
    const allowed = NavalCombat.isNavalMkrActive(combat) || Chase.isVehicleChase(combat);
    if (!allowed) {
      ui.notifications.warn('VEHICLE.combat.mkrOnly', { localize: true });
      return false;
    }
  } else if (actor.system.merchant?.merchantType === 'loot') {
    return false;
  }

  if (data.combat.isBrawling) {
    data.brawlingChange({
      ppSource: 'current',
      resetPP: false,
      applyPostDamage: false,
      unarm: data.combat.system.unarmEveryone,
    }).then((conf) => {
      if (!conf?.actorChange) return;
      delete conf.actorChange._id;
      actor.update(conf.actorChange).then(() => {
        game.canvas.scene.updateEmbeddedDocuments('Token', conf.tokenChange);
      });
    });
  }
});

Hooks.on('deleteCombatant', (data, options, user) => {
  const actor = DSA5_Utility.getSpeaker({
    actor: data.actorId,
    scene: data.sceneId,
    token: data.tokenId,
  });
  if (!actor) return;
  if (actor.system.merchant?.merchantType === 'loot' && actor.type !== 'vehicle') return false;

  if (data.combat.isBrawling) {
    const conf = data.leaveBrawling();
    if (!data.token) return;
    game.canvas.scene.updateEmbeddedDocuments('Token', conf.tokenChange);
  }
});

Hooks.on('preDeleteCombat', (combat, options, user) => {
  if (options.noHook) return;
  if (!game.user.isGM) return;

  const finishDelete = async () => {
    if (combat.isBrawling) {
      const left = await combat.convertToBrawl(false);
      if (!left) return;
    } else {
      const settled = await combat.settleLingeringBrawlPoints();
      if (!settled) return;
    }
    await combat.delete({ noHook: true });
  };

  const hasLingeringPP = [...combat.combatants].some(
    (c) => Number(c.actor?.system?.status?.temporaryLeP?.max) > 0,
  );
  if (combat.isBrawling || hasLingeringPP) {
    finishDelete();
    return false;
  }
});

Hooks.on('updateCombatant', (combatant, change, user) => {
  if (!DSA5_Utility.isActiveGM()) return;

  if (change.initiative) {
    const baseRoll = combatant.getFlag('dsa5', 'baseRoll');
    if (!baseRoll) {
      const parts = `${change.initiative}`.split('.');
      const roll = Number(parts[0]) - Math.round(combatant.actor.system.status.initiative.value);
      combatant.setFlag('dsa5', 'baseRoll', roll);
    }
  } else if ('initiative' in change && change.initiative == null) {
    combatant.update({ 'flags.dsa5.baseRoll': _del });
  }
});

class RepeatingEffectsHelper {
  static async updateCombatHook(combat, updateData) {
    if (!updateData.round && !updateData.turn) return;

    if (combat.round != 0 && combat.turns && combat.active) {
      if (combat.previous.round < combat.current.round) await RepeatingEffectsHelper.startOfRound(combat);
    }
  }

  static async startOfRound(combat) {
    if (!DSA5_Utility.isActiveGM()) return;

    for (const turn of combat.turns) {
      if (!turn.defeated && turn.actor) {
        if (turn.actor?.statuses.has('bleeding')) await this.applyBleeding(turn, combat);
        if (turn.actor?.system.condition.burning) await this.applyBurning(turn, combat);

        await this.startOfRoundEffects(turn, combat);
      }
    }
  }

  static async startOfRoundEffects(turn, combat) {
    const regenerationAttributes = ['wounds', 'astralenergy', 'karmaenergy'];
    for (const attr of regenerationAttributes) {
      if (getProperty(turn.actor?.system.repeatingEffects, `disabled.${attr}`)) continue;

      const effectvalues = turn.actor.system.repeatingEffects.startOfRound[attr].map((x) => x.value).join('+');

      if (!effectvalues) continue;

      const damageRoll = await new Roll(effectvalues).evaluate();
      const damage = await damageRoll.render();
      const type = _loc(damageRoll.total > 0 ? 'CHATNOTIFICATION.regenerates' : 'CHATNOTIFICATION.getsHurt');
      const applyDamage = `${this.buildActorName(turn)} ${type} ${_loc(attr)} ${damage}`;

      await this.sendEventMessage(applyDamage, combat, turn);
      if (attr == 'wounds') await turn.actor.applyDamage(damageRoll.total * -1);
      else await turn.actor.applyMana(damageRoll.total * -1, attr == 'astralenergy' ? 'AsP' : 'KaP');
    }
  }

  static async applyBleeding(turn, combat) {
    if (turn.actor.system.status.wounds.value < 1) return;

    const msg = _loc('CHATNOTIFICATION.bleeding', {
      actor: this.buildActorName(turn),
    });
    await this.sendEventMessage(msg, combat, turn);
    await turn.actor.applyDamage(1);
  }

  static async applyBurning(turn, combat) {
    if (turn.actor?.system.status.wounds.value < 1) return;

    const step = turn.actor?.system.condition.burning;
    const protection = DSA5StatusEffects.resistantToEffect(turn.actor, 'burning');
    const die = { 0: '1', 1: '1d3', 2: '1d6', 3: '2d6' }[step - protection] || '1';
    const damageRoll = await new Roll(die).evaluate();
    const damage = await damageRoll.render();
    const msg = _loc(`CHATNOTIFICATION.burning.${step}`, {
      actor: this.buildActorName(turn),
      damage,
    });

    await this.sendEventMessage(msg, combat, turn);
    await turn.actor.applyDamage(damageRoll.total);
  }

  static buildActorName(turn) {
    let name = turn.token.name;
    if (game.settings.get('dsa5', 'hideRegenerationToOwner')) {
      if (turn.token.name != turn.token.actor.name) name += ` (${turn.token.actor.name})`;
    }
    return turn.token.actor.toAnchor({ name }).outerHTML;
  }

  static async sendEventMessage(content, combat, turn) {
    if (game.settings.get('dsa5', 'hideRegenerationToOwner')) {
      const recipients = combat.combatants.get(turn.id).players;
      recipients.push(...game.users.filter((x) => x.isGM).map((x) => x.id));
      const chatData = DSA5_Utility.chatDataSetup(content, undefined, undefined, recipients);
      delete chatData.speaker;
      await ChatMessage.create(chatData);
    } else {
      await ChatMessage.create(DSA5_Utility.chatDataSetup(content));
    }
  }
}

Hooks.on("updateCombat", RepeatingEffectsHelper.updateCombatHook)