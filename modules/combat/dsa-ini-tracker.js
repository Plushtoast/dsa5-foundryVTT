import { DefaultAppv2 } from '../actor/baseapp.js';
import { GlobalToolTipHandler } from '../system/globals/tooltip.js';
import { CalendarWidget } from '../system/calendar/calendarwidget.js';
import { DSA5CombatTracker } from './combat_tracker.js';
import Chase from './chase/chase.js';
import ChaseCombatTracker from './chase/chase-combat-tracker.js';
import NavalCombat from './mkr/naval-combat.js';
const { mergeObject, duplicate } = foundry.utils;

export default class DSAIniTracker extends DefaultAppv2 {
  static TILE_GAP = 4;
  static ROUND_SEPARATOR_WIDTH = 4;
  static PANEL_PAD = 0;
  static PANEL_BORDER = 0;
  static CONTROL_COLUMN_WIDTH = 18;
  static DRAG_COLUMN_WIDTH = 14;
  static RESIZE_HANDLE_WIDTH = 10;
  static CONTROL_GAP = 2;
  static ACTION_ROW_HEIGHT = 32;
  static BADGE_ROW_HEIGHT = 28;
  static INITIATIVE_OVERLAY = 20;
  static MIN_SIZE = 80;
  static COUNT_MIN = 3;
  static COUNT_MAX = 25;
  static DOCK_TOP_MARGIN = 12;

  #resizePointerId = null;
  #resizeStartX = 0;
  #resizeStartCount = 0;
  #suppressPositionPersist = false;
  #layout = null;
  #dockedCombatId = null;
  #forceDockOnce = false;

  static DEFAULT_OPTIONS = {
    position: {
      width: 440,
      top: 100,
      left: 170,
    },
    window: {
      title: 'DSAIniTracker',
      resizable: false,
      frame: false,
    },
    actions: {
      nextMkr: this._onNextMkr,
      cycleMkrPhase: { handler: this._onMkrPhaseControl, buttons: [0, 2] },
      advanceMkrPhase: this._advanceMkrPhase,
      retreatMkrPhase: this._retreatMkrPhase,
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

  static _onMkrPhaseControl(event) {
    if (!game.user.isGM) return;
    event.preventDefault();
    if (event.button === 2) game.combat?.retreatMkrPhase();
    else game.combat?.advanceMkrPhase();
  }

  static _advanceMkrPhase() {
    if (!game.user.isGM) return;
    game.combat?.advanceMkrPhase();
  }

  static _retreatMkrPhase() {
    if (!game.user.isGM) return;
    game.combat?.retreatMkrPhase();
  }

  setPosition(position) {
    const currentPosition = super.setPosition(position);
    if (this.#suppressPositionPersist) return currentPosition;
    if (Number.isFinite(currentPosition?.left) && Number.isFinite(currentPosition?.top)) {
      game.settings.set('dsa5', 'iniTrackerPosition', {
        left: currentPosition.left,
        top: currentPosition.top,
      });
    }
    return currentPosition;
  }

  dockForNewCombat() {
    if (!game.settings.get('dsa5', 'iniTrackerDockToTop')) return;
    this.#dockedCombatId = null;
    this.#forceDockOnce = true;
    if (!this.rendered) return;
    this.render(true, { focus: false, forceDock: true });
  }

  onCombatEnded() {
    this.#dockedCombatId = null;
    this.#forceDockOnce = false;
    CalendarWidget.restoreAfterCombat();
  }

  #applyPosition(options, { forceDock = false, combatStarted = false, combatId = null } = {}) {
    options.position ??= {};
    const shouldDock = game.settings.get('dsa5', 'iniTrackerDockToTop') && combatStarted;
    const doDock = shouldDock && (forceDock || this.#forceDockOnce || !this.rendered || combatId !== this.#dockedCombatId);
    this.#forceDockOnce = false;

    if (doDock) {
      CalendarWidget.collapseForCombat();
      const docked = this.constructor.dockPosition(options.position.width);
      options.position.left = docked.left;
      options.position.top = docked.top;
      if (combatId) this.#dockedCombatId = combatId;
      return;
    }

    if (shouldDock && this.rendered && Number.isFinite(this.position?.left) && Number.isFinite(this.position?.top)) {
      options.position.left = this.position.left;
      options.position.top = Math.max(this.position.top, CalendarWidget.getDockBottom());
      return;
    }

    mergeObject(options.position, game.settings.get('dsa5', 'iniTrackerPosition') ?? {});
  }

  static clampActorCount(count) {
    return Math.clamp(Math.round(Number(count) || 0), this.COUNT_MIN, this.COUNT_MAX);
  }

  static actorCountFromDrag(startCount, deltaX, itemWidth) {
    const slotWidth = Math.max(1, (Number(itemWidth) || 80) + this.TILE_GAP);
    const deltaSlots = Math.round(deltaX / slotWidth);
    return this.clampActorCount(startCount + deltaSlots);
  }

  static widthForActorCount(count, itemWidth, layout = {}) {
    return this.#computeDimensions({
      itemWidth,
      actorCount: count,
      roundSeparators: layout.roundSeparators ?? 0,
      leftControls: layout.leftControls ?? 0,
      rightControls: layout.rightControls ?? 0,
      extraRows: layout.extraRows ?? 0,
      extraBadgeRows: layout.extraBadgeRows ?? 0,
    }).width;
  }

  static resolveCombatantImage(combatant, fallback) {
    if (game.settings.get('dsa5', 'iniTrackerPreferAvatar')) {
      return combatant.actor?.img ?? combatant.img ?? fallback;
    }
    return fallback ?? combatant.img;
  }

  /**
   * Builds the visible ini-tracker strip and the Zurückstellen waiting row.
   * Waiting combatants appear once in `waitingTurns` for the round they delayed
   * and are omitted from that same round in the main strip. Later wrap rounds
   * still include them like everyone else.
   */
  static collectTrackerTurns({
    turns,
    combat,
    actorCount,
    skipDefeated = false,
    isGM = false,
    combatStarted = false,
    isNavalMkr = false,
  }) {
    const waitingTurns = [];
    const waitingIds = new Set();
    const filteredTurns = [];
    const turnsToUse = turns ?? [];
    if (!turnsToUse.length || !combat) return { turns: filteredTurns, waitingTurns };

    const anyActive = turnsToUse.some((x) => x.active);
    let toAdd = actorCount;
    let started = false;
    let startIndex = -1;
    let index = 0;
    let loops = 0;
    let currentRound;

    const advance = () => {
      index += 1;
      if (index >= turnsToUse.length) {
        index = 0;
        loops += 1;
      }
    };

    while (!(toAdd === 0 || loops === actorCount)) {
      const turn = duplicate(turnsToUse[index]);
      const combatant = combat.combatants.get(turn.id);
      if (!combatant) {
        advance();
        continue;
      }

      const visible = isGM || !combatant.hidden;
      const displayedRound = combat.round + loops;
      const isWaitingThisRound = combatant.getFlag?.('dsa5', 'waitInit') == displayedRound
        && !combatant.defeated
        && visible;

      if (started && index === startIndex) turn.css = (turn.css || '').replace('active', '');

      if (!combatStarted || (turn.active && !started) || (!anyActive && !started)) {
        started = true;
        startIndex = index;
      }

      if (isWaitingThisRound) {
        if (!waitingIds.has(turn.id)) {
          waitingIds.add(turn.id);
          turn.img = this.resolveCombatantImage(combatant, turn.img);
          waitingTurns.push(turn);
        }
        advance();
        continue;
      }

      if (started && !(skipDefeated && combatant.defeated) && visible) {
        turn.round = displayedRound;
        this.#decorateTrackerTurn(turn, combatant, isNavalMkr);
        if (currentRound && currentRound !== turn.round) turn.newRound = 'newRound';
        currentRound = turn.round;
        filteredTurns.push(turn);
        toAdd -= 1;
      }
      advance();
    }

    return { turns: filteredTurns, waitingTurns };
  }

  static #decorateTrackerTurn(turn, combatant, isNavalMkr) {
    if (turn.isOwner && combatant.actor) {
      const status = combatant.actor.system.status;
      if (combatant.actor.type === 'vehicle') {
        turn.maxLP = status.structurePoints?.max ?? 0;
        turn.currentLP = status.structurePoints?.value ?? 0;
        turn.maxCrew = status.crew?.max ?? 0;
        turn.currentCrew = status.crew?.value ?? 0;
        turn.showVehicleBars = true;
      } else {
        turn.maxLP = status.wounds?.max ?? 0;
        turn.currentLP = status.wounds?.value ?? 0;
      }
    }
    turn.isVehicle = combatant.actor?.type === 'vehicle';
    turn.showNavalAggro = isNavalMkr && combatant.actor?.type !== 'vehicle';
    turn.img = this.resolveCombatantImage(combatant, turn.img);
  }

  static dockPosition(width, dockBottom = CalendarWidget.getDockBottom()) {
    const minTop = CalendarWidget.collapsedDockBottom();
    return {
      left: Math.max(0, Math.round((window.innerWidth - (Number(width) || 0)) / 2)),
      top: Math.max(minTop, Math.round(Number(dockBottom) || 0)),
    };
  }

  static #controlColumnWidth() {
    return this.CONTROL_COLUMN_WIDTH;
  }

  static #controlColumnHeight(_buttonCount, itemWidth) {
    return Math.max(30, Number(itemWidth) || 80);
  }

  static #controlCounts(data, combatStarted) {
    const isGM = game.user.isGM;
    const control = !!data?.control;
    let left = 0;
    let right = 0;

    if (isGM) {
      left += 1;
      right += 1;
    }
    if (isGM && combatStarted) {
      left += 2;
      right += 2;
    } else if (control) {
      left += 1;
      if (isGM) right += 1;
    }

    return { left, right };
  }

  static #computeDimensions({
    itemWidth,
    actorCount,
    roundSeparators,
    leftControls,
    rightControls,
    extraRows,
    extraBadgeRows,
  }) {
    const size = Math.max(30, Number(itemWidth) || 80);
    const tiles = Math.max(0, Number(actorCount) || 0);
    const seps = Math.max(0, Number(roundSeparators) || 0);
    const leftCount = Math.max(0, Number(leftControls) || 0);
    const rightCount = Math.max(0, Number(rightControls) || 0);
    const rows = Math.max(0, Number(extraRows) || 0);
    const badges = Math.max(0, Number(extraBadgeRows) || 0);

    const leftWidth = leftCount > 0 ? this.CONTROL_COLUMN_WIDTH + this.TILE_GAP : 0;
    const rightWidth = rightCount > 0 ? this.CONTROL_COLUMN_WIDTH + this.TILE_GAP : 0;
    const dragWidth = this.DRAG_COLUMN_WIDTH + this.TILE_GAP;
    const resizeWidth = this.RESIZE_HANDLE_WIDTH + this.TILE_GAP;
    const itemCount = tiles + seps;
    const tilesWidth = itemCount > 0
      ? tiles * size + seps * this.ROUND_SEPARATOR_WIDTH + Math.max(0, itemCount - 1) * this.TILE_GAP
      : size;

    const width = this.PANEL_PAD + this.PANEL_BORDER
      + leftWidth
      + tilesWidth
      + rightWidth
      + dragWidth
      + resizeWidth
      + this.PANEL_PAD;

    const portraitRow = Math.max(
      size + this.INITIATIVE_OVERLAY,
      this.#controlColumnHeight(leftCount, size),
      this.#controlColumnHeight(rightCount, size),
    );

    const height = this.PANEL_PAD + this.PANEL_BORDER
      + portraitRow
      + rows * this.ACTION_ROW_HEIGHT
      + badges * this.BADGE_ROW_HEIGHT
      + this.PANEL_PAD;

    return {
      width: Math.max(this.MIN_SIZE, Math.round(width) || this.MIN_SIZE),
      height: Math.max(this.MIN_SIZE, Math.round(height) || this.MIN_SIZE),
    };
  }

  static connectHooks() {
    Hooks.on('renderDSA5CombatTracker', (app, html, data, what) => {
      if (!game.settings.get('dsa5', 'enableCombatFlow')) return;

      if (game.combat) {
        if (!game.dsa5.apps.initTracker) game.dsa5.apps.initTracker = new DSAIniTracker();

        game.dsa5.apps.initTracker.updateTracker(data);
      } else {
        if (game.dsa5.apps.initTracker) {
          game.dsa5.apps.initTracker.onCombatEnded();
          game.dsa5.apps.initTracker.close();
          game.dsa5.apps.initTracker = undefined;
        }
      }
    });

    Hooks.on('updateCombat', (combat, changed) => {
      if (!game.settings.get('dsa5', 'enableCombatFlow')) return;
      if (!('started' in changed)) return;
      const tracker = game.dsa5.apps.initTracker;
      if (combat.started) tracker?.dockForNewCombat();
      else tracker?.onCombatEnded();
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
    const stored = this.combatData ?? { turns: [], combat: game.combat };
    const data = { ...stored };
    const itemWidth = game.settings.get('dsa5', 'iniTrackerSize');
    const actorCount = this.constructor.clampActorCount(game.settings.get('dsa5', 'iniTrackerCount'));

    const combatStarted = data.combat?.round;
    if (data.turns && data.combat) {
      data.turns = ChaseCombatTracker.prepareIniTurns(data.turns, data.combat);
    }
    const isChase = Chase.isChaseActive(data.combat);
    const isNavalMkr = NavalCombat.isNavalMkrActive(data.combat);
    const mkrPhase = data.combat?.system?.mkrPhase;
    const isDamageReportPhase = isNavalMkr && NavalCombat.normalizePhase(mkrPhase) === 'damageReport';
    let turnsToUse = data.turns ?? [];
    if (isDamageReportPhase) {
      turnsToUse = [];
    } else if (isNavalMkr) {
      turnsToUse = turnsToUse.filter((turn) => {
        const combatant = data.combat.combatants.get(turn.id);
        return NavalCombat.isCombatantRelevantToPhase(combatant, mkrPhase);
      });
    }

    const skipDefeated = game.settings.get('core', Combat.CONFIG_SETTING).skipDefeated;
    const unRolled = !isChase && (data.turns ?? []).some((x) => {
      if (x.isChaseSection || !x.isOwner || x.initiative) return false;
      if (!game.user.isGM) return true;
      return data.combat.combatants.get(x.id)?.isNPC;
    });

    let waitingTurns = [];
    if (turnsToUse.length) {
      const collected = this.constructor.collectTrackerTurns({
        turns: turnsToUse,
        combat: data.combat,
        actorCount,
        skipDefeated,
        isGM: game.user.isGM,
        combatStarted,
        isNavalMkr,
      });
      data.turns = collected.turns;
      waitingTurns = collected.waitingTurns;
    } else if (isNavalMkr) {
      data.turns = [];
    }

    data.isLastRound = isNavalMkr
      ? NavalCombat.isLastRelevantTurn(data.combat)
      : data.turns?.[1]?.newRound;

    const roundSeparators = data.turns?.filter((turn) => turn.newRound).length ?? 0;
    const extraRows = [
      unRolled,
      !combatStarted && game.user.isGM,
      combatStarted && (data.control || game.user.isGM),
    ].filter(Boolean).length;
    const extraBadgeRows = [
      combatStarted && (data.control || game.user.isGM) && isNavalMkr,
      combatStarted && isChase,
    ].filter(Boolean).length;
    const { left, right } = this.constructor.#controlCounts(data, combatStarted);
    this.#layout = {
      itemWidth,
      roundSeparators,
      leftControls: left,
      rightControls: right,
      extraRows,
      extraBadgeRows,
    };
    const dimensions = this.constructor.#computeDimensions({
      itemWidth,
      actorCount,
      roundSeparators,
      leftControls: left,
      rightControls: right,
      extraRows,
      extraBadgeRows,
    });
    options.position ??= {};
    options.position.width = dimensions.width;
    options.position.height = dimensions.height;
    this.#applyPosition(options, {
      forceDock: options.forceDock === true,
      combatStarted: !!combatStarted,
      combatId: data.combat?.id ?? game.combat?.id ?? null,
    });

    Object.assign(data, {
      itemWidth,
      unRolled,
      waitingTurns,
      isNavalMkr,
      isDamageReportPhase,
      mkrEndTurnLabel: isNavalMkr
        ? (isDamageReportPhase ? 'COMBAT.TurnEnd' : 'VEHICLE.mkr.endPhase')
        : null,
      mkr: NavalCombat.getMkrProgress(data.combat) ?? data.mkr,
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

  #bindResizeHandle() {
    const handle = this.element.querySelector('.resize-handle');
    if (!handle) return;

    handle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.stopPropagation();
      this.#resizePointerId = event.pointerId;
      this.#resizeStartX = event.clientX;
      this.#resizeStartCount = this.constructor.clampActorCount(game.settings.get('dsa5', 'iniTrackerCount'));
      handle.setPointerCapture(event.pointerId);
      handle.classList.add('active');
    });

    handle.addEventListener('pointermove', (event) => {
      if (this.#resizePointerId !== event.pointerId) return;
      const itemWidth = game.settings.get('dsa5', 'iniTrackerSize');
      const next = this.constructor.actorCountFromDrag(
        this.#resizeStartCount,
        event.clientX - this.#resizeStartX,
        itemWidth,
      );
      const current = Number(this.element.dataset.previewCount ?? this.#resizeStartCount);
      if (next === current) return;
      this.#previewCount(next);
    });

    const endResize = async (event) => {
      if (this.#resizePointerId !== event.pointerId) return;
      handle.releasePointerCapture(event.pointerId);
      handle.classList.remove('active');
      this.#resizePointerId = null;
      const count = this.constructor.clampActorCount(this.element.dataset.previewCount ?? this.#resizeStartCount);
      delete this.element.dataset.previewCount;
      if (count !== game.settings.get('dsa5', 'iniTrackerCount')) {
        await game.settings.set('dsa5', 'iniTrackerCount', count);
      } else {
        this.render(true, { focus: false });
      }
    };

    handle.addEventListener('pointerup', endResize);
    handle.addEventListener('pointercancel', endResize);
  }

  #previewCount(count) {
    this.element.dataset.previewCount = String(count);
    const itemWidth = game.settings.get('dsa5', 'iniTrackerSize');
    const width = this.constructor.widthForActorCount(count, itemWidth, this.#layout ?? {});
    this.#suppressPositionPersist = true;
    try {
      this.setPosition({ width });
    } finally {
      this.#suppressPositionPersist = false;
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    const container = html.find('.dragHandler');
    new foundry.applications.ux.Draggable(this, this.element, container[0], false);

    container.on('wheel', async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      await this._onWheelResize(ev);
      return false;
    });

    this.#bindResizeHandle();

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

    this.element.querySelectorAll('.mkr-phase-control').forEach((el) => {
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
    });
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
