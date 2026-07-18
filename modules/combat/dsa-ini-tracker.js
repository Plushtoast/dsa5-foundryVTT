import { DefaultAppv2 } from '../actor/baseapp.js';
import { GlobalToolTipHandler } from '../system/globals/tooltip.js';
import { DSA5CombatTracker } from './combat_tracker.js';
import Chase from './chase/chase.js';
import ChaseCombatTracker from './chase/chase-combat-tracker.js';
import NavalCombat from './mkr/naval-combat.js';
const { mergeObject, duplicate } = foundry.utils;

export default class DSAIniTracker extends DefaultAppv2 {
  /** Must match `.iniRoundSeparator` in inittracker.scss (bar width + horizontal margins). */
  static ROUND_SEPARATOR_WIDTH = 12;

  static DEFAULT_OPTIONS = {
    position: {
      width: 440,
      top: 100,
      left: 170,
    },
    window: {
      title: 'DSAIniTracker',
      resizable: true,
      frame: false,
    },
    actions: {
      nextMkr: this._onNextMkr,
      aggroButton: function () {
        DSA5CombatTracker.runActAttackDialog();
      },
      rollMine: this.rollMyChars,
      waitInit: this.waitInit,
      restoreInit: { handler: this.restoreInit, buttons: [0, 2] },
      panToCombatant: this.#onCombatantControl,
      pingCombatant: this.#onCombatantControl,
      rollInitiative: this.#onCombatantControl,
      toggleDefeated: this.#onCombatantControl,
      toggleHidden: this.#onCombatantControl,
      activateCombatant: this.#onCombatantMouseDown,
      rolledInit: this.#editCombatant,
      rollChaseDefaultSkill: this.#rollChaseDefaultSkill,
      chaseTerrainMenu: this.#chaseTerrainMenu,
      chaseDefaultSkillMenu: this.#chaseDefaultSkillMenu,
    },
    classes: ['dsa5', 'initTracker'],
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/initracker/initracker.hbs',
    },
  };

  static _onNextMkr() {
    if (!game.user.isGM) return;
    game.combat?.nextMkr();
  }

  setPosition(position) {
    const currentPosition = super.setPosition(position);
    game.settings.set('dsa5', 'iniTrackerPosition', {
      left: currentPosition.left,
      top: currentPosition.top,
    });
    return currentPosition;
  }

  static connectHooks() {
    Hooks.on('renderDSA5CombatTracker', (app, html, data, what) => {
      if (!game.settings.get('dsa5', 'enableCombatFlow')) return;

      if (game.combat) {
        if (!game.dsa5.apps.initTracker) game.dsa5.apps.initTracker = new DSAIniTracker();

        game.dsa5.apps.initTracker.updateTracker(data);
      } else {
        if (game.dsa5.apps.initTracker) {
          game.dsa5.apps.initTracker.close();
          game.dsa5.apps.initTracker = undefined;
        }
      }
    });
  }

  updateTracker(data) {
    this.combatData = data;
    this.render(true, { focus: false });
  }

  _onClickAction(event, target) {
    ui.combat._onClickAction(event, target);
  }

  async _prepareContext(options) {
    const data = this.combatData;
    mergeObject(options, { position: game.settings.get('dsa5', 'iniTrackerPosition') });
    const itemWidth = game.settings.get('dsa5', 'iniTrackerSize');
    const actorCount = game.settings.get('dsa5', 'iniTrackerCount');

    const combatStarted = data.combat.round;
    if (data.turns && data.combat) {
      data.turns = ChaseCombatTracker.prepareIniTurns(data.turns, data.combat);
    }
    const turnsToUse = data.turns;

    const waitingTurns = [];
    const skipDefeated = game.settings.get('core', Combat.CONFIG_SETTING).skipDefeated;

    //todo change this to one loop
    const anyActive = turnsToUse.some((x) => x.active);
    const isChase = Chase.isChaseActive(data.combat);
    const isNavalMkr = NavalCombat.isNavalMkrActive(data.combat);
    const unRolled = !isChase && data.turns.some((x) => {
      if (x.isChaseSection || !x.isOwner || x.initiative) return false;
      if (!game.user.isGM) return true;
      return data.combat.combatants.get(x.id)?.isNPC;
    });
    if (turnsToUse.length) {
      const filteredTurns = [];

      let toAdd = actorCount;
      let started = false;
      let startIndex = -1;
      let index = 0;
      let loops = 0;
      let currentRound;
      while (!(toAdd == 0 || loops == actorCount)) {
        const turn = duplicate(turnsToUse[index]);
        const combatant = data.combat.combatants.get(turn.id);
        if (!combatant) {
          index++;
          if (index >= turnsToUse.length) {
            index = 0;
            loops++;
          }
          continue;
        }
        if (started && index == startIndex) turn.css = turn.css.replace('active', '');

        if (!combatStarted || (turn.active && !started) || (!anyActive && !started)) {
          started = true;
          startIndex = index;
        } else if (combatant.getFlag('dsa5', 'waitInit') == data.combat.round + loops && !combatant.defeated && (game.user.isGM || !combatant.hidden)) {
          waitingTurns.push(turn);
        }

        if (started && !(skipDefeated && combatant.defeated) && (game.user.isGM || !combatant.hidden)) {
          turn.round = data.combat.round + loops;
          if (turn.isOwner && combatant.actor) {
            const status = combatant.actor.system.status;
            const pool = status.structurePoints ?? status.wounds;
            turn.maxLP = pool?.max ?? 0;
            turn.currentLP = pool?.value ?? 0;
          }
          turn.isVehicle = combatant.actor?.type === 'vehicle';
          turn.showNavalAggro = isNavalMkr && combatant.actor?.type !== 'vehicle';
          if (currentRound && currentRound != turn.round) turn.newRound = 'newRound';

          currentRound = turn.round;
          filteredTurns.push(turn);
          toAdd--;
        }
        index++;
        if (index >= turnsToUse.length) {
          index = 0;
          loops++;
        }
      }
      data.turns = filteredTurns;
    }

    data.isLastRound = data.turns[1]?.newRound;

    const roundSeparators = data.turns?.filter((turn) => turn.newRound).length ?? 0;
    options.position.width = itemWidth * actorCount + actorCount * 3 + 70
      + roundSeparators * this.constructor.ROUND_SEPARATOR_WIDTH;
    options.position.height = itemWidth + 10;

    Object.assign(data, {
      itemWidth,
      unRolled,
      waitingTurns,
    });

    const combatMode = NavalCombat.resolveCombatMode(data.combat);
    data.combatMode = combatMode;
    data.combatModeIcon = {
      standard: 'fa-shield',
      brawling: 'fa-hand-fist fa-rotate-90',
      navalMkr: 'fa-ship',
      chase: 'fa-person-running',
      vehicleChase: 'fa-sailboat',
    }[combatMode] ?? 'fa-shield';
    data.combatModeTooltip = 'COMBAT.MODE.tooltip';

    this.conditionalPanToCurrentCombatant(data);

    return data;
  }

  hasChangedTurn(data) {
    const res = data.turn != this.lastTurnUpdate || data.round != this.lastRoundUpdate;
    this.lastTurnUpdate = data.turn;
    this.lastRoundUpdate = data.round;
    return res;
  }

  async conditionalPanToCurrentCombatant(data) {
    if (!game.settings.get('dsa5', 'enableCombatPan')) return;

    const firstTurn = data.turns[0];
    if (!firstTurn) return;

    const combatant = data.combat.combatants.get(firstTurn.id);

    if (!combatant || !this.hasChangedTurn(data)) return;

    setTimeout(() => {
      const token = combatant.token;
      if (!token || !token.object || !token.object.isVisible) return;
      canvas.animatePan({ x: token.x, y: token.y });

      if (!combatant.actor || !combatant.actor.isOwner) return;
      token.object.control({ releaseOthers: true });
    }, 300);
  }

  async _onWheelResize(ev) {
    let newVal = game.settings.get('dsa5', 'iniTrackerSize');
    if (ev.originalEvent.deltaY > 0) {
      newVal = Math.min(140, newVal + 5);
    } else {
      newVal = Math.max(30, newVal - 5);
    }
    await game.settings.set('dsa5', 'iniTrackerSize', newVal);
    await this.render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    const container = html.find('.dragHandler');
    new foundry.applications.ux.Draggable(this, this.element, container[0], this.options.resizable);

    container.on('wheel', async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      await this._onWheelResize(ev);
      return false;
    });

    html.find('.betterTooltip').on('pointerover', (ev) => this.#betterTooltip(ev));

    const turns = html.find('.iniItem');
    turns.on('pointerover', this._onCombatantHoverIn.bind(this))
    turns.on('pointerout', this._onCombatantHoverOut.bind(this));
    turns.on('dblclick', this._onCombatantMouseDown.bind(this));

    for (const input of this.element.querySelectorAll('.chase-max-rounds-input')) {
      input.addEventListener('change', (ev) => {
        ev.stopPropagation();
        game.combat?.setChaseMaxRounds(ev.currentTarget.value);
      });
      input.addEventListener('click', (ev) => ev.stopPropagation());
    }
  }

  async #betterTooltip(ev) {
    const combatantId = ev.currentTarget.dataset.combatantId;
    const combatant = game.combat.combatants.get(combatantId);
    if (!combatant?.actor) return;
    if (!game.user.isGM && !combatant.actor.isOwner) return;

    GlobalToolTipHandler.handleTooltip(ev, combatant.actor);
  }

  static rollMyChars() {
    if (game.user.isGM) {
      ui.combat.viewed.rollNPC({});
    } else {
      ui.combat.viewed.rollAll({});
    }
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    this._createContextMenu(this._getDsaIniTrackerEntryContextOptions, ".iniTrackerList:not(.waitingTackerList) .combatant", { fixed: true });
    if (game.user.isGM) {
      this._createContextMenu(() => ui.combat._getCombatModeContextOptions(), '.combat-mode-control', {
        eventName: 'click',
        fixed: true,
        parentClassHooks: false,
      });
    }
  }

  _getDsaIniTrackerEntryContextOptions() {
    return ui.combat._getEntryContextOptions();
  }

  static async #openChaseContextMenu(app, target, menuItems) {
    const menu = new foundry.applications.ux.ContextMenu(app.element, '', menuItems, {
      jQuery: false,
      fixed: true,
      eventName: 'none',
    });
    ui.context?.close();
    await menu.render(target, { animate: true });
    ui.context = menu;
  }

  static async #chaseTerrainMenu(event, target) {
    if (!game.user.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    const combat = game.combat;
    if (!Chase.isChaseActive(combat)) return;
    const Handler = Chase.handlerFor(combat);
    const current = combat.system.chaseTerrain ?? 'normal';
    const menuItems = Handler.TERRAIN_IDS.map((id) => ({
      label: Handler.getTerrainLabel(id),
      icon: id === current ? '<i class="fas fa-check"></i>' : '<i class="fas fa-mountain"></i>',
      onClick: () => combat.setChaseTerrain(id),
    }));
    await DSAIniTracker.#openChaseContextMenu(this, target, menuItems);
  }

  static async #chaseDefaultSkillMenu(event, target) {
    if (!game.user.isGM) return;
    event.preventDefault();
    event.stopPropagation();
    const combat = game.combat;
    if (!Chase.isChaseActive(combat)) return;
    const Handler = Chase.handlerFor(combat);
    const current = Handler.defaultSkillKey(combat);
    const menuItems = Handler.defaultSkillOptions(combat).map((o) => ({
      label: _loc(o.label),
      icon: o.key === current ? '<i class="fas fa-check"></i>' : '<i class="fas fa-person-running"></i>',
      onClick: () => combat.setChaseDefaultSkill(o.key),
    }));
    await DSAIniTracker.#openChaseContextMenu(this, target, menuItems);
  }

  static #rollChaseDefaultSkill() {
    if (!Chase.isChaseActive()) return;
    const combatant = game.combat?.combatant;
    if (!combatant) return;
    if (!(game.user.isGM || combatant.isOwner)) return;
    Chase.rollAction(combatant.actor, combatant.tokenId, { skipPicker: true });
  }

  static #onCombatantControl(event, target) {
    ui.combat._onCombatantControl(event, target);
  }

  static async waitInit(ev, target) {
    const combatant = game.combat.combatants.get(game.combat.current.combatantId);
    await combatant.setFlag('dsa5', 'waitInit', game.combat.current.round);
    target.dataset.action = 'nextTurn';
    this._onClickAction(ev, target);
  }

  static async restoreInit(ev, target) {
    const combatant = game.combat.combatants.get(target.dataset.combatantId);
    if (ev.button == 2 && combatant.isOwner) {
      const currentTurn = game.combat.combatants.get(game.combat.current.combatantId);
      const roundInitiative = currentTurn.properInitiative;
      await combatant.unsetFlag('dsa5', 'waitInit');
      await combatant.update({
        "system.roundInitiative": roundInitiative + 0.00001,
      });
      await game.combat.update({ turn: game.combat.turn - 1 })
    }
    else ui.combat._onCombatantMouseDown(ev, target);
  }

  _onCombatantHoverOut(ev) {
    ui.combat._onCombatantHoverOut(ev);
  }

  _onCombatantHoverIn(ev) {
    ui.combat._onCombatantHoverIn(ev);
  }

  static #onCombatantMouseDown(ev, target) {
    ui.combat._onCombatantMouseDown(ev, target);
  }

  static #editCombatant(ev) {
    if (!game.user.isGM) return;

    ui.combat.viewed.combatants.get(ev.currentTarget.dataset.combatantId)?.sheet.render(true)
  }

  _onCombatantMouseDown(ev) {
    ui.combat._onCombatantMouseDown(ev, ev.target.closest("[data-combatant-id]"));
  }
}
