import { DefaultAppv2 } from '../../actor/baseapp.js';
import { FormAppv2 } from '../../actor/formapp.js';
import QueryOrchestrator from '../queries/query-orchestrator.js';

const { mergeObject, fromUuidSync } = foundry.utils;

let syncTimer;

export async function syncScQuickbar(force = false) {
  if (!game.settings.get('dsa5', 'enableScQuickbar')) {
    game.dsa5.apps.scQuickbar?.close();
    return;
  }

  const viewer = game.dsa5.apps.scQuickbar;
  if (!viewer) return;

  await viewer.render({ force, focus: false });
}

function scheduleSyncScQuickbar(force = false) {
  if (!game.settings.get('dsa5', 'enableScQuickbar')) return;
  if (syncTimer) clearTimeout(syncTimer);
  syncTimer = setTimeout(() => {
    syncTimer = undefined;
    syncScQuickbar(force);
  }, 100);
}

export default class ScQuickbar extends DefaultAppv2 {
  static DISPLAY_MODE_ALL = 0;
  static DISPLAY_MODE_LOGGED_IN = 1;
  static DISPLAY_MODE_COLLAPSED = 2;

  static PORTRAIT_SIZE_MIN = 48;
  static PORTRAIT_SIZE_MAX = 120;
  static PORTRAIT_SIZE_STEP = 4;
  static NAME_HEIGHT = 16;
  static NAME_GAP = 2;
  static CONTROLS_WIDTH = 28;
  static CONTROLS_ROW_HEIGHT = 28;

  static DEFAULT_OPTIONS = {
    id: 'sc-quickbar',
    window: {
      title: 'SCQUICKBAR.title',
      resizable: false,
      frame: false,
      positioned: true,
    },
    actions: {
      panToMember: this.#onPanToMember,
    },
    classes: ['dsa5', 'sc-quickbar', 'faded-ui'],
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/hud/sc-quickbar.hbs',
    },
  };

  #draggable;
  #highlighted;

  static register() {
    if (game.dsa5.apps.scQuickbar) return;

    this.#migrateDisplayMode();

    game.dsa5.apps.scQuickbar = new ScQuickbar();
    ScQuickbar.connectHooks();

    if (game.settings.get('dsa5', 'enableScQuickbar')) {
      syncScQuickbar(true);
    }

    Hooks.call('dsa5ScQuickbarReady', game.dsa5.apps.scQuickbar);
  }

  static #migrateDisplayMode() {
    const legacy = game.settings.storage.get('client')?.['dsa5.scQuickbarLoggedInOnly'];
    if (legacy !== true) return;
    if (game.settings.get('dsa5', 'scQuickbarDisplayMode') !== this.DISPLAY_MODE_ALL) return;
    game.settings.set('dsa5', 'scQuickbarDisplayMode', this.DISPLAY_MODE_LOGGED_IN);
  }

  static #normalizeDisplayMode(mode) {
    const value = Number(mode);
    if (value === this.DISPLAY_MODE_LOGGED_IN || value === this.DISPLAY_MODE_COLLAPSED) return value;
    return this.DISPLAY_MODE_ALL;
  }

  static connectHooks() {
    const refresh = () => scheduleSyncScQuickbar();
    const refreshForce = () => scheduleSyncScQuickbar(true);

    Hooks.on('canvasReady', refreshForce);
    Hooks.on('createToken', refresh);
    Hooks.on('updateToken', refresh);
    Hooks.on('deleteToken', refresh);
    Hooks.on('updateActor', refresh);
    Hooks.on('createActiveEffect', refresh);
    Hooks.on('updateActiveEffect', refresh);
    Hooks.on('deleteActiveEffect', refresh);
    Hooks.on('updateCombat', refresh);
    Hooks.on('combatTurn', refresh);
    Hooks.on('deleteCombat', refresh);
    Hooks.on('createCombat', refresh);
    Hooks.on('userConnected', refresh);
    Hooks.on('userActivity', refresh);
    Hooks.on('updateUser', refresh);
    Hooks.on('updateSetting', (setting) => {
      if (setting.key === 'primaryParty') refreshForce();
    });
  }

  static #primaryParty() {
    const partyUuid = game.settings.get('dsa5', 'primaryParty');
    const party = partyUuid ? fromUuidSync(partyUuid) : null;
    return party?.type === 'group' ? party : null;
  }

  static resolveMemberActors() {
    const party = this.#primaryParty();
    if (party) {
      const actors = [...(party.system.actors ?? [])];
      if (actors.length) return actors;

      return Object.values(party.system.members ?? {})
        .sort((left, right) => left.sort - right.sort)
        .map((member) => fromUuidSync(member.uuid))
        .filter(Boolean);
    }
    return QueryOrchestrator.activeCharacterActors();
  }

  static isLoggedInCharacter(actor) {
    if (!actor) return false;
    return game.users.some((user) => user.active && user.character?.id === actor.id);
  }

  static isMemberDimmed(actor) {
    if (!actor) return false;
    if (actor.hasCondition('incapacitated') || actor.hasCondition('unconscious') || actor.hasCondition('dead')) return true;

    const tokenRef = this.#sceneTokenRef(actor);
    if (tokenRef.onScene && tokenRef.tokenId) {
      const combatant = game.combat?.getCombatantForToken?.(tokenRef.tokenId);
      if (combatant?.defeated) return true;
    }

    const defeatedStatus = CONFIG.specialStatusEffects.DEFEATED;
    return actor.effects?.some((effect) => effect.statuses?.has(defeatedStatus)) ?? false;
  }

  static async prepareMemberEntries({ loggedInOnly = false } = {}) {
    let actors = this.resolveMemberActors();

    if (!game.user.isGM && game.user.character) {
      actors = actors.filter((actor) => actor.id === game.user.character.id);
    }

    if (loggedInOnly) {
      actors = actors.filter((actor) => this.isLoggedInCharacter(actor));
    }

    const entries = [];

    for (const actor of actors) {
      const { tokenId, onScene } = this.#sceneTokenRef(actor);
      const tokenDoc = onScene ? canvas.scene.tokens.get(tokenId) : null;
      const img = tokenDoc?.texture?.src ?? actor.prototypeToken?.texture?.src ?? actor.img;
      const entry = {
        actorId: actor.id,
        tokenId,
        onScene,
        name: tokenDoc?.name ?? actor.name,
        img,
        active: this.#isActiveTurn(actor),
        dimmed: this.isMemberDimmed(actor),
        canViewResources: this.#canViewResources(actor),
        loggedIn: this.isLoggedInCharacter(actor),
      };

      if (entry.canViewResources) {
        entry.resources = this.#memberResources(actor);
      }

      entry.effects = this.#memberEffectIcons(actor);
      entries.push(entry);
    }

    return entries;
  }

  static #sceneTokenRef(actor) {
    if (!actor || !canvas.ready || !canvas.scene) {
      return { tokenId: null, onScene: false };
    }

    for (const tokenDoc of canvas.scene.tokens) {
      if (tokenDoc.actor?.id !== actor.id) continue;
      const tokenObj = tokenDoc.object;
      if (!tokenObj) continue;
      if (!game.user.isGM && ui.combat?._isTokenVisible && !ui.combat._isTokenVisible(tokenObj)) {
        continue;
      }
      return { tokenId: tokenDoc.id, onScene: true };
    }

    return { tokenId: null, onScene: false };
  }

  static #canViewResources(actor) {
    if (!actor) return false;
    return game.user.isGM
      || actor.isOwner
      || actor.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
  }

  static #memberResources(actor) {
    return {
      LeP: {
        value: actor.system.status.wounds.value,
        max: actor.system.status.wounds.max,
        label: _loc('CHAR.LEP'),
      },
      AsP: {
        value: actor.system.status.astralenergy.value,
        max: actor.system.status.astralenergy.max,
        label: _loc('CHAR.ASP'),
      },
      KaP: {
        value: actor.system.status.karmaenergy.value,
        max: actor.system.status.karmaenergy.max,
        label: _loc('CHAR.KAP'),
      },
    };
  }

  static #memberEffectIcons(actor) {
    const icons = [];
    const SHOW_ICON = CONST.ACTIVE_EFFECT_SHOW_ICON;
    const defeatedStatus = CONFIG.specialStatusEffects.DEFEATED;

    for (const effect of actor?.appliedEffects ?? []) {
      if (effect.statuses.has(defeatedStatus)) continue;
      if ((effect.showIcon === SHOW_ICON.ALWAYS)
        || ((effect.showIcon === SHOW_ICON.CONDITIONAL) && effect.isTemporary)) {
        icons.push({ img: effect.img, name: effect.name });
      }
    }

    const tooltip = ui.combat?._formatEffectsTooltip?.(icons) ?? '';
    return { icons, tooltip, hasIcons: icons.length > 0 };
  }

  static #isActiveTurn(actor) {
    if (!game.combat || !actor) return false;
    const tokenRef = this.#sceneTokenRef(actor);
    if (!tokenRef.onScene || !tokenRef.tokenId) return false;
    const combatant = game.combat.getCombatantForToken(tokenRef.tokenId);
    return combatant?.id === game.combat.combatant?.id;
  }

  static #savedPosition() {
    const saved = game.settings.get('dsa5', 'scQuickbarPosition') ?? {};
    if (Number.isFinite(saved.left) && Number.isFinite(saved.top)) {
      return { left: saved.left, top: saved.top };
    }
    return null;
  }

  static #verticalControlsHeight(portraitSize) {
    const { CONTROLS_WIDTH, CONTROLS_ROW_HEIGHT } = this;
    const gap = 4;
    const controlCount = 2;
    const buttonsPerRow = Math.max(1, Math.floor((portraitSize + gap) / (CONTROLS_WIDTH + gap)));
    const rows = Math.ceil(controlCount / buttonsPerRow);
    return rows * CONTROLS_ROW_HEIGHT + (rows - 1) * gap;
  }

  static #controlsOnlyDimensions(portraitSize, vertical) {
    const { CONTROLS_WIDTH, CONTROLS_ROW_HEIGHT } = this;
    const gap = 4;
    const controlCount = 2;
    const controlColumnHeight = controlCount * CONTROLS_ROW_HEIGHT + (controlCount - 1) * gap;

    if (vertical) {
      return {
        width: portraitSize,
        height: this.#verticalControlsHeight(portraitSize),
      };
    }

    return {
      width: CONTROLS_WIDTH,
      height: controlColumnHeight,
    };
  }

  static #computeDimensions(memberCount, portraitSize, vertical, reserveResourceRow = true) {
    const { CONTROLS_WIDTH, NAME_HEIGHT, NAME_GAP } = this;
    const gap = 4;
    const resourceRow = reserveResourceRow ? 14 : 0;
    const memberHeight = portraitSize + NAME_GAP + NAME_HEIGHT + resourceRow;

    if (!memberCount) {
      return this.#controlsOnlyDimensions(portraitSize, vertical);
    }

    const controlsHeight = vertical ? this.#verticalControlsHeight(portraitSize) : 0;

    return {
      width: vertical
        ? portraitSize
        : portraitSize * memberCount + gap * (memberCount - 1) + CONTROLS_WIDTH + gap,
      height: vertical
        ? controlsHeight + gap + memberHeight * memberCount + gap * (memberCount - 1)
        : memberHeight,
    };
  }

  setPosition(position) {
    const currentPosition = super.setPosition(position);
    if (Number.isFinite(currentPosition?.left) && Number.isFinite(currentPosition?.top)) {
      game.settings.set('dsa5', 'scQuickbarPosition', {
        left: currentPosition.left,
        top: currentPosition.top,
      });
    }
    return currentPosition;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);

    const portraitSize = game.settings.get('dsa5', 'scQuickbarSize');
    const layout = game.settings.get('dsa5', 'scQuickbarLayout');
    const displayMode = this.constructor.#normalizeDisplayMode(game.settings.get('dsa5', 'scQuickbarDisplayMode'));
    const collapsed = displayMode === this.constructor.DISPLAY_MODE_COLLAPSED;
    const loggedInOnly = displayMode === this.constructor.DISPLAY_MODE_LOGGED_IN;
    const members = collapsed
      ? []
      : await this.constructor.prepareMemberEntries({ loggedInOnly });
    const reserveResourceRow = members.some((member) => member.resources);
    const dimensions = this.constructor.#computeDimensions(
      members.length,
      portraitSize,
      layout === 0,
      reserveResourceRow,
    );
    const saved = this.constructor.#savedPosition();

    mergeObject(options, {
      position: mergeObject(dimensions, saved ?? {}),
    });

    mergeObject(context, {
      members,
      portraitSize,
      layout,
      vertical: layout === 0,
      displayMode,
      collapsed,
      loggedInOnly,
      reserveResourceRow,
    });

    return context;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    this._createContextMenu(this._getScQuickbarContextOptions.bind(this), '[data-action="configMenu"]', {
      eventName: 'click',
      fixed: true,
      parentClassHooks: false,
    });
  }

  _getScQuickbarContextOptions() {
    const { DISPLAY_MODE_ALL, DISPLAY_MODE_LOGGED_IN, DISPLAY_MODE_COLLAPSED } = this.constructor;
    const displayMode = this.constructor.#normalizeDisplayMode(game.settings.get('dsa5', 'scQuickbarDisplayMode'));
    const layout = game.settings.get('dsa5', 'scQuickbarLayout');
    const icon = (active, defaultIcon) => (active ? '<i class="fas fa-check"></i>' : defaultIcon);

    return [
      {
        label: 'SCQUICKBAR.displayAll',
        icon: icon(displayMode === DISPLAY_MODE_ALL, '<i class="fas fa-users"></i>'),
        onClick: () => game.settings.set('dsa5', 'scQuickbarDisplayMode', DISPLAY_MODE_ALL),
      },
      {
        label: 'SCQUICKBAR.displayLoggedIn',
        icon: icon(displayMode === DISPLAY_MODE_LOGGED_IN, '<i class="fas fa-user-check"></i>'),
        onClick: () => game.settings.set('dsa5', 'scQuickbarDisplayMode', DISPLAY_MODE_LOGGED_IN),
      },
      {
        label: 'SCQUICKBAR.displayCollapsed',
        icon: icon(displayMode === DISPLAY_MODE_COLLAPSED, '<i class="fas fa-eye-slash"></i>'),
        onClick: () => game.settings.set('dsa5', 'scQuickbarDisplayMode', DISPLAY_MODE_COLLAPSED),
      },
      {
        label: 'SCQUICKBAR.layoutHorizontal',
        icon: icon(layout === 1, '<i class="fas fa-grip-horizontal"></i>'),
        onClick: () => game.settings.set('dsa5', 'scQuickbarLayout', 1),
      },
      {
        label: 'SCQUICKBAR.layoutVertical',
        icon: icon(layout === 0, '<i class="fas fa-grip-vertical"></i>'),
        onClick: () => game.settings.set('dsa5', 'scQuickbarLayout', 0),
      },
      {
        label: 'SCQUICKBAR.configure',
        icon: '<i class="fa-solid fa-cog"></i>',
        onClick: () => new ConfigureScQuickbar().render(true),
      },
    ];
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const handle = this.element?.querySelector('.dragHandler');
    if (handle) {
      this.#draggable = new foundry.applications.ux.Draggable(this, this.element, handle, false);
      handle.onwheel = (ev) => this.#onWheelResize(ev);
    }

    this.#clearHover();

    this.element.querySelectorAll('.sc-quickbar-member').forEach((portrait) => {
      portrait.addEventListener('pointerover', this.#onMemberHoverIn.bind(this));
      portrait.addEventListener('pointerout', this.#onMemberHoverOut.bind(this));
      portrait.addEventListener('dblclick', this.#onPortraitDblClick.bind(this));
    });

    if (this.constructor.#savedPosition()) return;

    const viewportHeight = window.innerHeight;
    const elementHeight = this.element?.offsetHeight || 88;
    const top = Math.max(20, viewportHeight - elementHeight - 80);
    this.setPosition({ top, left: 20 });
  }

  _onClose(options) {
    super._onClose(options);
    this.#clearHover();
    this.#draggable = null;
  }

  #clearHover() {
    this.#highlighted?._onHoverOut({});
    this.#highlighted = null;
  }

  #onMemberHoverIn(event) {
    if (!canvas.ready) return;
    const { tokenId } = event.currentTarget?.dataset ?? {};
    if (!tokenId) return;
    const token = canvas.tokens.get(tokenId);
    if (token && token._canHover(game.user, event)) {
      token._onHoverIn(event, { hoverOutOthers: true });
      this.#highlighted = token;
    }
  }

  #onMemberHoverOut(event) {
    this.#highlighted?._onHoverOut(event);
    this.#highlighted = null;
  }

  async #onWheelResize(ev) {
    ev.stopPropagation();
    ev.preventDefault();

    const { PORTRAIT_SIZE_MIN, PORTRAIT_SIZE_MAX, PORTRAIT_SIZE_STEP } = this.constructor;
    const current = game.settings.get('dsa5', 'scQuickbarSize');
    const delta = ev.deltaY > 0 ? -PORTRAIT_SIZE_STEP : PORTRAIT_SIZE_STEP;
    const next = Math.clamp(current + delta, PORTRAIT_SIZE_MIN, PORTRAIT_SIZE_MAX);
    if (next === current) return;

    await game.settings.set('dsa5', 'scQuickbarSize', next);
  }

  static async #onPanToMember(ev, target) {
    if (!canvas.ready) return;

    const { actorId, tokenId } = target.dataset ?? {};
    if (!tokenId) {
      if (actorId) {
        const actor = game.actors.get(actorId);
        if (actor) ui.notifications.info('SCQUICKBAR.notOnScene', { localize: true });
      }
      return;
    }

    const token = canvas.tokens.get(tokenId);
    if (!token?.isVisible) return;

    token.control({ releaseOthers: true });
    await canvas.animatePan(token.center);
  }

  #onPortraitDblClick(ev) {
    const { actorId } = ev.currentTarget?.dataset ?? {};
    const actor = game.actors.get(actorId);
    if (actor) actor.sheet.render(true);
  }
}

export class ConfigureScQuickbar extends FormAppv2 {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'SCQUICKBAR.configure',
    },
    position: {
      width: 520,
    },
    actions: {
      resetScQuickbar: this.resetScQuickbar,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/configureScQuickbar.hbs',
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('select, input, range-picker').on('change', async (ev) => {
      if (!ev.currentTarget.name) return;

      const name = ev.currentTarget.name.split('.');
      let val = ev.currentTarget.value;
      if (ev.currentTarget.type === 'checkbox') val = ev.currentTarget.checked;

      await game.settings.set(name[0], name[1], val);
      this.render();
    });
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    mergeObject(data, {
      enableScQuickbar: game.settings.get('dsa5', 'enableScQuickbar'),
      scQuickbarSize: game.settings.get('dsa5', 'scQuickbarSize'),
      scQuickbarLayout: game.settings.get('dsa5', 'scQuickbarLayout'),
      layoutChoices: game.settings.settings.get('dsa5.scQuickbarLayout').choices,
    });
    return data;
  }

  static async resetScQuickbar() {
    await game.settings.set('dsa5', 'scQuickbarPosition', {});
    await game.settings.set('dsa5', 'scQuickbarLayout', 1);
    await game.settings.set('dsa5', 'scQuickbarSize', 64);
    await game.settings.set('dsa5', 'scQuickbarDisplayMode', ScQuickbar.DISPLAY_MODE_ALL);
    await syncScQuickbar(true);
  }
}
