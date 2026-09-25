import { DefaultAppv2 } from '../../actor/baseapp.js';
import { FormAppv2 } from '../../actor/formapp.js';
import QueryOrchestrator from '../queries/query-orchestrator.js';
import { tabSlider } from '../helpers/view_helper.js';
import { ActorAvatar, resolveActorTokenImage } from '../helpers/hotbar_actor.js';

const { mergeObject, fromUuidSync } = foundry.utils;

let syncTimer;

export async function syncScQuickbar(force = false) {
  ScQuickbar.syncHiddenPlayerList();
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

  static COMPANION_DISPLAY_FULL = 0;
  static COMPANION_DISPLAY_BESIDE = 1;
  static COMPANION_DISPLAY_HOVER = 2;
  static companionSize(portraitSize) {
    return Math.round(Math.clamp(Number(portraitSize) * 0.7, 36, 48));
  }

  static PORTRAIT_SIZE_MIN = 48;
  static PORTRAIT_SIZE_MAX = 120;
  static PORTRAIT_SIZE_STEP = 4;
  static NAME_HEIGHT = 16;
  static NAME_GAP = 2;
  static CONTROLS_WIDTH = 28;
  static CONTROLS_ROW_HEIGHT = 28;
  static RESOURCE_ROW_HEIGHT = 16;
  static SIDE_INFO_WIDTH = 80;

  static LAYOUT_CHOICES = {
    0: 'SCQUICKBAR.layoutVertical',
    1: 'SCQUICKBAR.layoutHorizontal',
  };

  static PLAYER_COLOR_OFF = 0;
  static PLAYER_COLOR_PIP = 1;
  static PLAYER_COLOR_BACKGROUND = 2;

  static PLAYER_COLOR_CHOICES = {
    0: 'SCQUICKBAR.playerColorOff',
    1: 'SCQUICKBAR.playerColorPip',
    2: 'SCQUICKBAR.playerColorBackground',
  };

  static COMPANION_CHOICES = {
    0: 'SCQUICKBAR.companionFull',
    1: 'SCQUICKBAR.companionBeside',
    2: 'SCQUICKBAR.companionHover',
  };

  static DISPLAY_MODE_LABELS = [
    'SCQUICKBAR.displayAll',
    'SCQUICKBAR.displayLoggedIn',
    'SCQUICKBAR.displayNone',
  ];

  static DEFAULT_CONFIG = {
    displayMode: 0,
    layout: 1,
    size: 64,
    fadedUi: false,
    compactResources: false,
    showName: true,
    sideInfo: false,
    companionDisplay: 1,
    showPlayerColor: 2,
    showPlayerName: false,
    preferActorImg: true,
    showLatency: false,
    showFps: false,
    hidePlayers: false,
  };

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
    classes: ['dsa5', 'sc-quickbar'],
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/sc-quickbar/sc-quickbar.hbs',
    },
  };

  #draggable;
  #highlighted;
  #contextMenu;
  #playerMenu;

  static register() {
    if (game.dsa5.apps.scQuickbar) return;

    game.dsa5.apps.scQuickbar = new ScQuickbar();
    ScQuickbar.connectHooks();

    if (game.settings.get('dsa5', 'enableScQuickbar')) {
      syncScQuickbar(true);
    }

    Hooks.call('dsa5ScQuickbarReady', game.dsa5.apps.scQuickbar);
  }

  static #normalizePlayerColor(value) {
    if (value === true || Number(value) === this.PLAYER_COLOR_BACKGROUND) return this.PLAYER_COLOR_BACKGROUND;
    if (Number(value) === this.PLAYER_COLOR_PIP) return this.PLAYER_COLOR_PIP;
    return this.PLAYER_COLOR_OFF;
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
    Hooks.on('updateUser', refresh);
    this.#bindPlayerPresence();
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

  static #bindPlayerPresence() {
    const players = ui.players;
    if (!players || players._scQuickbarIdleBound) return;
    const original = players._onChangeIdleStatus.bind(players);
    players._onChangeIdleStatus = (user, row) => {
      original(user, row);
      game.dsa5.apps.scQuickbar?.syncIdle(user);
    };
    const refreshLatency = players.refreshLatency.bind(players);
    players.refreshLatency = (...args) => {
      refreshLatency(...args);
      game.dsa5.apps.scQuickbar?.refreshLatency();
    };
    const refreshFPS = players.refreshFPS.bind(players);
    players.refreshFPS = (...args) => {
      refreshFPS(...args);
      game.dsa5.apps.scQuickbar?.refreshFPS(...args);
    };
    players._scQuickbarIdleBound = true;
  }

  static syncHiddenPlayerList() {
    const hide = game.settings.get('dsa5', 'enableScQuickbar') && this.readConfig().hidePlayers;
    document.getElementById('players')?.classList.toggle('sc-quickbar-hide-players', hide);
  }

  refreshLatency() {
    const el = this.element?.querySelector('.sc-quickbar-latency');
    if (!el) return;
    const avg = game.time.averageLatency;
    el.querySelector('.average').innerText = `${Math.round(avg)}ms`;
    el.className = `sc-quickbar-latency ${[[250, 'good'], [1000, 'fair'], [Infinity, 'poor']].find((step) => avg <= step[0])[1]}`;
  }

  refreshFPS({ deactivate = false } = {}) {
    const el = this.element?.querySelector('.sc-quickbar-fps');
    if (!el) return;
    if (deactivate || !canvas.ready) {
      el.querySelector('.average').innerText = '--';
      el.className = 'sc-quickbar-fps';
      return;
    }
    const values = canvas.fps.values;
    const avg = values.reduce((fps, total) => total + fps, 0) / values.length;
    el.querySelector('.average').innerText = Math.round(avg);
    const max = canvas.app.ticker.maxFPS || 60;
    const ratio = avg / max;
    const rating = !Number.isFinite(ratio)
      ? 'fair'
      : [[0.5, 'poor'], [0.8, 'fair'], [Infinity, 'good']].find((step) => ratio < step[0])[1];
    el.className = `sc-quickbar-fps ${rating}`;
  }

  syncIdle(user) {
    const row = this.element?.querySelector(`.sc-quickbar-member[data-user-id="${user.id}"]`);
    row?.classList.toggle('idle', Boolean(user.active && user.idle));
  }

  /**
   * The same entries as the player list, including anything added through getUserContextOptions.
   * @returns {ContextMenuEntry[]}
   */
  static playerContextOptions() {
    const players = ui.players;
    if (!players?._getContextMenuOptions) return [];
    const options = players._getContextMenuOptions();
    Hooks.callAll('getUserContextOptions', players, options);
    return options;
  }

  static #assignedUser(actor) {
    if (!actor) return null;
    const matches = game.users.filter((user) => user.character?.id === actor.id);
    return matches.find((user) => user.active) ?? matches[0] ?? null;
  }

  static companionOwnerIds(actor) {
    const owners = actor?.system?.companionData?.owners;
    if (!owners?.length) return [];
    return owners.map((uuid) => fromUuidSync(uuid)?.id).filter(Boolean);
  }

  static isCompanionActor(actor) {
    return this.companionOwnerIds(actor).length > 0;
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

  static async prepareMemberEntries({ loggedInOnly = false, companionDisplay } = {}) {
    let actors = this.resolveMemberActors();

    if (!game.user.isGM && game.user.character) {
      const mine = game.user.character.id;
      actors = actors.filter((actor) => actor.id === mine || this.companionOwnerIds(actor).includes(mine));
    }

    if (loggedInOnly) {
      const loggedInIds = new Set(actors.filter((actor) => this.isLoggedInCharacter(actor)).map((actor) => actor.id));
      actors = actors.filter((actor) => loggedInIds.has(actor.id)
        || this.companionOwnerIds(actor).some((id) => loggedInIds.has(id)));
    }

    const linked = await this.#linkedCompanions(actors);
    const ownersByCompanionId = new Map(linked.map((item) => [item.actor.id, item.ownerIds]));
    const seen = new Set(actors.map((actor) => actor.id));
    const entries = [...actors, ...linked.map((item) => item.actor).filter((actor) => !seen.has(actor.id))].map((actor) => {
      const entry = this.#memberEntry(actor);
      const linkedOwnerIds = ownersByCompanionId.get(actor.id) ?? [];
      if (linkedOwnerIds.length) {
        entry.ownerIds = [...new Set([...entry.ownerIds, ...linkedOwnerIds])];
        entry.companion = true;
      }
      return entry;
    });
    return this.#nestCompanions(entries, companionDisplay ?? this.readConfig().companionDisplay);
  }

  /**
   * Pets of the shown party: the owner's companion tab, and any actor whose companion owners point at a shown member.
   * @param {Actor[]} actors
   * @returns {Promise<{actor: Actor, ownerIds: string[]}[]>}
   */
  static async #linkedCompanions(actors) {
    const memberIds = new Set(actors.map((actor) => actor.id));
    const linked = new Map();

    const claim = (companion, ownerId) => {
      if (!companion || companion.id === ownerId || !memberIds.has(ownerId)) return;
      const record = linked.get(companion.id) ?? { actor: companion, ownerIds: [] };
      if (!record.ownerIds.includes(ownerId)) record.ownerIds.push(ownerId);
      linked.set(companion.id, record);
    };

    const unresolved = [];
    for (const actor of actors) {
      for (const entry of Object.values(actor.system?.companions ?? {})) {
        if (!entry?.uuid) continue;
        const companion = fromUuidSync(entry.uuid);
        if (companion) claim(companion, actor.id);
        else unresolved.push(fromUuid(entry.uuid).then((doc) => claim(doc, actor.id)));
      }
    }
    if (unresolved.length) await Promise.all(unresolved);

    for (const companion of game.actors) {
      for (const ownerId of this.companionOwnerIds(companion)) claim(companion, ownerId);
    }

    return [...linked.values()];
  }

  static #memberEntry(actor) {
    const { tokenId, onScene } = this.#sceneTokenRef(actor);
    const tokenDoc = onScene ? canvas.scene.tokens.get(tokenId) : null;
    const entry = {
      actorId: actor.id,
      tokenId,
      onScene,
      name: tokenDoc?.name ?? actor.name,
      img: resolveActorTokenImage(actor, tokenDoc),
      ...this.#companionImage(actor, tokenDoc),
      active: this.#isActiveTurn(actor),
      dimmed: this.isMemberDimmed(actor),
      canViewResources: this.#canViewResources(actor),
      loggedIn: this.isLoggedInCharacter(actor),
      companion: this.isCompanionActor(actor),
      ownerIds: this.companionOwnerIds(actor),
      companions: [],
      ...this.#playerPresence(actor),
    };

    if (entry.canViewResources) {
      entry.resources = this.#memberResources(actor);
      entry.resourceTooltip = this.#resourceTooltip(entry.resources);
      entry.resourceCount = this.#visibleResourceCount(entry.resources);
      entry.lepMissing = this.#lepMissingRatio(entry.resources);
    } else {
      entry.lepMissing = 0;
    }

    entry.tooltipHtml = this.#memberTooltipHtml(entry.name, entry.resources, entry);
    entry.effects = this.#memberEffectIcons(actor);
    return entry;
  }

  static #companionImage(actor, tokenDoc) {
    const avatar = ActorAvatar.resolve(actor, tokenDoc, { preferImg: this.readConfig().preferActorImg });
    return { companionImg: avatar.src, companionImgStyle: avatar.style };
  }

  static #playerPresence(actor) {
    const user = this.#assignedUser(actor);
    if (!user) return { userId: null, playerColor: null, playerName: '', roleLabel: '', idle: false };
    return {
      userId: user.id,
      playerColor: user.active ? user.color.css : '#333333',
      playerName: user.pronouns ? `${user.name} (${user.pronouns})` : user.name,
      roleLabel: user.roleLabel ?? '',
      idle: Boolean(user.active && user.idle),
    };
  }

  static #lepMissingRatio(resources) {
    const max = Number(resources?.LeP?.max) || 0;
    if (max <= 0) return 0;
    const value = Math.clamp(Number(resources.LeP.value) || 0, 0, max);
    return (max - value) / max;
  }

  static #nestCompanions(entries, companionDisplay) {
    const nest = Number(companionDisplay) !== this.COMPANION_DISPLAY_FULL;
    if (!nest) return entries;

    const unique = new Map();
    for (const entry of entries) {
      const existing = unique.get(entry.actorId);
      if (!existing) {
        unique.set(entry.actorId, entry);
        continue;
      }
      existing.ownerIds = [...new Set([...existing.ownerIds, ...entry.ownerIds])];
      existing.companion = existing.companion || entry.companion;
    }
    const deduped = [...unique.values()];
    const ids = new Set(deduped.map((entry) => entry.actorId));
    const buckets = new Map();
    const roots = [];

    for (const entry of deduped) {
      const ownerIds = [...new Set(entry.ownerIds.filter((id) => ids.has(id) && id !== entry.actorId))];
      if (!entry.companion || !ownerIds.length) {
        roots.push(entry);
        continue;
      }
      const chip = {
        ...entry,
        companions: [],
        tooltipHtml: this.#memberTooltipHtml(entry.name, entry.resources
          ? { LeP: entry.resources.LeP, AsP: { max: 0 }, KaP: { max: 0 } }
          : null, entry),
      };
      for (const ownerId of ownerIds) {
        const list = buckets.get(ownerId) ?? [];
        if (list.some((item) => item.actorId === chip.actorId)) continue;
        list.push({ ...chip });
        buckets.set(ownerId, list);
      }
    }

    for (const entry of roots) {
      entry.companions = buckets.get(entry.actorId) ?? [];
    }
    return roots;
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
    return actor.system.hudResources();
  }

  static #visibleResourceCount(resources) {
    if (!resources) return 0;
    return 1 + (resources.AsP.max ? 1 : 0) + (resources.KaP.max ? 1 : 0);
  }

  static #resourceTooltip(resources) {
    if (!resources) return '';
    const parts = [`${resources.LeP.label} ${resources.LeP.value}/${resources.LeP.max}`];
    if (resources.AsP.max) parts.push(`${resources.AsP.label} ${resources.AsP.value}/${resources.AsP.max}`);
    if (resources.KaP.max) parts.push(`${resources.KaP.label} ${resources.KaP.value}/${resources.KaP.max}`);
    return parts.join(' • ');
  }

  static #memberTooltipHtml(name, resources, presence = {}) {
    const roleLabel = typeof presence === 'string' ? presence : presence.roleLabel;
    const playerName = typeof presence === 'string' ? '' : presence.playerName;
    const playerColor = typeof presence === 'string' ? '' : presence.playerColor;
    const parts = [name];
    if (roleLabel) parts.push(roleLabel);
    if (resources) {
      parts.push(`${resources.LeP.label} ${resources.LeP.value}/${resources.LeP.max}`);
      if (resources.AsP.max) parts.push(`${resources.AsP.label} ${resources.AsP.value}/${resources.AsP.max}`);
      if (resources.KaP.max) parts.push(`${resources.KaP.label} ${resources.KaP.value}/${resources.KaP.max}`);
    }
    let html = foundry.utils.escapeHTML(parts.filter(Boolean).join('\n')).replaceAll('\n', '<br>');
    if (!playerName) return html;
    const safeColor = /^#[0-9a-fA-F]{3,8}$/.test(playerColor) ? playerColor : '';
    const pip = safeColor ? `<span class="sc-quickbar-tooltip-pip" style="background:${safeColor}"></span>` : '';
    const owner = `${pip}${foundry.utils.escapeHTML(playerName)}`;
    return html.replace(foundry.utils.escapeHTML(name), `${foundry.utils.escapeHTML(name)}<br>${owner}`);
  }

  static readConfig() {
    const stored = game.settings.get('dsa5', 'scQuickbarConfig') ?? {};
    const config = { ...this.DEFAULT_CONFIG, ...stored };
    config.displayMode = this.#normalizeDisplayMode(config.displayMode);
    config.layout = Number(config.layout) === 0 ? 0 : 1;
    config.size = Math.clamp(
      Number(config.size) || this.DEFAULT_CONFIG.size,
      this.PORTRAIT_SIZE_MIN,
      this.PORTRAIT_SIZE_MAX,
    );
    config.fadedUi = !!config.fadedUi;
    config.compactResources = !!config.compactResources;
    config.showName = config.showName !== false;
    config.sideInfo = !!config.sideInfo;
    config.showPlayerColor = this.#normalizePlayerColor(config.showPlayerColor);
    config.showPlayerName = !!config.showPlayerName;
    config.preferActorImg = config.preferActorImg !== false;
    config.showLatency = !!config.showLatency;
    config.showFps = !!config.showFps;
    config.hidePlayers = !!config.hidePlayers;
    const companionDisplay = Number(config.companionDisplay);
    config.companionDisplay = companionDisplay === this.COMPANION_DISPLAY_FULL
      || companionDisplay === this.COMPANION_DISPLAY_HOVER
      ? companionDisplay
      : this.COMPANION_DISPLAY_BESIDE;
    return config;
  }

  static async patchConfig(changes) {
    const current = this.readConfig();
    const next = { ...current, ...changes };
    if (changes.hidePlayers === true && !current.hidePlayers) {
      if (!Object.hasOwn(changes, 'showLatency')) next.showLatency = true;
      if (!Object.hasOwn(changes, 'showFps')) next.showFps = true;
    }
    await game.settings.set('dsa5', 'scQuickbarConfig', next);
    return next;
  }

  static readDisplaySettings() {
    const config = this.readConfig();
    const vertical = config.layout === 0;
    return {
      ...config,
      vertical,
      portraitSize: config.size,
      sideInfo: vertical && config.sideInfo,
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

  static #computeDimensions(memberCount, portraitSize, {
    vertical = false,
    showName = true,
    resourceRows = 0,
    sideInfo = false,
    companionBeside = false,
    companionHover = false,
    maxCompanions = 0,
    showStats = false,
  } = {}) {
    const { CONTROLS_WIDTH, NAME_HEIGHT, NAME_GAP, RESOURCE_ROW_HEIGHT, SIDE_INFO_WIDTH } = this;
    const gap = 4;
    const nameBlock = showName ? NAME_GAP + NAME_HEIGHT : 0;
    const resourceBlock = resourceRows
      ? resourceRows * RESOURCE_ROW_HEIGHT + Math.max(0, resourceRows - 1) * 2
      : 0;

    if (!memberCount) {
      return this.#controlsOnlyDimensions(portraitSize, vertical);
    }

    const controlsHeight = vertical ? this.#verticalControlsHeight(portraitSize) : 0;
    const hasInfoColumn = sideInfo && (showName || resourceRows > 0);
    const icon = this.companionSize(portraitSize);
    const shown = maxCompanions > 0 && (companionBeside || companionHover);
    const strip = shown
      ? maxCompanions * icon + Math.max(0, maxCompanions - 1) * 2
      : 0;
    const companionBelow = !vertical && companionBeside && maxCompanions
      ? gap + maxCompanions * icon + Math.max(0, maxCompanions - 1) * 2
      : 0;
    const companionRight = vertical && companionBeside && maxCompanions ? gap + strip : 0;
    const companionClearance = vertical
      ? (hasInfoColumn ? gap + SIDE_INFO_WIDTH : 0)
      : (showName ? nameBlock + gap : 0);
    const portraitColumn = vertical ? portraitSize + companionRight : portraitSize;
    const portraitBlock = vertical && shown ? Math.max(portraitSize, icon) : portraitSize;
    const memberHeight = (hasInfoColumn
      ? Math.max(portraitBlock, nameBlock + resourceBlock)
      : portraitBlock + nameBlock + resourceBlock) + companionBelow;
    const memberWidth = hasInfoColumn ? portraitColumn + gap + SIDE_INFO_WIDTH : portraitColumn;

    return {
      width: vertical
        ? memberWidth
        : memberWidth * memberCount + gap * (memberCount - 1) + CONTROLS_WIDTH + gap,
      height: vertical
        ? controlsHeight + gap + memberHeight * memberCount + gap * (memberCount - 1) + (showStats ? gap + 22 : 0)
        : Math.max(memberHeight, showStats ? this.CONTROLS_ROW_HEIGHT * 2 + gap + 40 : memberHeight),
      companionClearance,
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

    const {
      layout,
      vertical,
      compactResources,
      showName,
      showPlayerName,
      showPlayerColor,
      showLatency,
      showFps,
      sideInfo,
      portraitSize,
      displayMode,
      companionDisplay,
    } = this.constructor.readDisplaySettings();
    const collapsed = displayMode === this.constructor.DISPLAY_MODE_COLLAPSED;
    const loggedInOnly = displayMode === this.constructor.DISPLAY_MODE_LOGGED_IN;
    const members = collapsed
      ? []
      : await this.constructor.prepareMemberEntries({ loggedInOnly, companionDisplay });
    const reserveResourceRow = !compactResources && members.some((member) => member.resources);
    const resourceRows = reserveResourceRow
      ? Math.max(0, ...members.map((member) => member.resourceCount || 0))
      : 0;
    const maxCompanions = Math.max(0, ...members.map((member) => member.companions?.length || 0));
    const companionBeside = companionDisplay === this.constructor.COMPANION_DISPLAY_BESIDE && maxCompanions > 0;
    const companionHover = companionDisplay === this.constructor.COMPANION_DISPLAY_HOVER && maxCompanions > 0;
    const dimensions = this.constructor.#computeDimensions(members.length, portraitSize, {
      vertical,
      showName: showName || showPlayerName,
      resourceRows,
      sideInfo,
      companionBeside,
      companionHover,
      maxCompanions,
      showStats: showLatency || showFps,
    });
    const { companionClearance, ...position } = dimensions;
    const saved = this.constructor.#savedPosition();

    mergeObject(options, {
      position: mergeObject(position, saved ?? {}),
    });

    mergeObject(context, {
      members,
      portraitSize,
      layout,
      vertical,
      compactResources,
      showName,
      showPlayerName,
      showPlayerColor,
      playerColorMode: showPlayerColor,
      showLatency,
      showFps,
      sideInfo,
      displayMode,
      companionDisplay,
      companionBeside,
      companionHover,
      companionSize: this.constructor.companionSize(portraitSize),
      companionCount: maxCompanions,
      companionClearance: companionClearance ?? 0,
      collapsed,
      loggedInOnly,
      reserveResourceRow,
      resourceRows,
    });

    return context;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    this.#contextMenu = this._createContextMenu(this._getScQuickbarContextOptions.bind(this), '[data-action="configMenu"]', {
      eventName: 'click',
      fixed: true,
      parentClassHooks: false,
      onOpen: () => {
        if (!this.#contextMenu) return;
        this.#contextMenu.menuItems = this._getScQuickbarContextOptions();
      },
    });
    if (this.#contextMenu) {
      const renderEntries = this.#contextMenu._onRenderEntries.bind(this.#contextMenu);
      this.#contextMenu._onRenderEntries = async (menu, options) => {
        await renderEntries(menu, options);
        this.#decorateContextItems(this.#contextMenu);
      };
    }

    this.#playerMenu = this._createContextMenu(() => this.constructor.playerContextOptions(), '.sc-quickbar-member[data-user-id]', {
      fixed: true,
      parentClassHooks: false,
      hookName: '',
      onOpen: () => {
        if (!this.#playerMenu) return;
        this.#playerMenu.menuItems = this.constructor.playerContextOptions();
      },
    });
  }

  #decorateContextItems(menu) {
    for (const item of menu.menuItems) {
      if (!item.element) continue;
      if (item.toggle) {
        item.element.classList.add('toggle');
        item.element.setAttribute('aria-pressed', item.pressed ? 'true' : 'false');
        this.#appendPips(item.element, 2, item.pressed ? 1 : 0);
      }
      if (item.tristate) this.#appendPips(item.element, 3, item.state);
    }
  }

  #appendPips(element, count, activeIndex) {
    element.classList.add('tristate');
    const pips = document.createElement('span');
    pips.className = 'sc-context-tristate';
    for (let index = 0; index < count; index += 1) {
      const pip = document.createElement('i');
      if (index === activeIndex) pip.className = 'active';
      pips.append(pip);
    }
    element.append(pips);
  }

  #toggleOption(label, iconClass, pressed, key, { visible, group = 'options' } = {}) {
    const option = {
      label,
      icon: `<i class="${iconClass}"></i>`,
      toggle: true,
      pressed,
      group,
      onClick: () => this.constructor.patchConfig({ [key]: !this.constructor.readConfig()[key] }),
    };
    if (visible) option.visible = visible;
    return option;
  }

  #tristateOption(labelKeys, state, key, icons, group) {
    const next = (state + 1) % labelKeys.length;
    return {
      label: game.i18n.format('SCQUICKBAR.cycleState', { mode: game.i18n.localize(labelKeys[state]) }),
      icon: `<i class="${icons[state]}"></i>`,
      tristate: true,
      state,
      group,
      onClick: () => this.constructor.patchConfig({ [key]: next }),
    };
  }

  _getScQuickbarContextOptions() {
    const config = this.constructor.readConfig();
    const {
      displayMode, companionDisplay, fadedUi, compactResources, showName, sideInfo,
      showPlayerColor, showPlayerName, showLatency, showFps, hidePlayers, preferActorImg,
    } = config;

    return [
      this.#tristateOption(
        this.constructor.DISPLAY_MODE_LABELS,
        displayMode,
        'displayMode',
        ['fas fa-users', 'fas fa-user-check', 'fas fa-eye-slash'],
        'display',
      ),
      {
        label: 'SCQUICKBAR.layoutHorizontal',
        icon: '<i class="fas fa-grip-horizontal"></i>',
        group: 'layout',
        visible: () => this.constructor.readConfig().layout !== 1,
        onClick: () => this.constructor.patchConfig({ layout: 1 }),
      },
      {
        label: 'SCQUICKBAR.layoutVertical',
        icon: '<i class="fas fa-grip-vertical"></i>',
        group: 'layout',
        visible: () => this.constructor.readConfig().layout !== 0,
        onClick: () => this.constructor.patchConfig({ layout: 0 }),
      },
      this.#toggleOption('SCQUICKBAR.showName', 'fas fa-signature', showName, 'showName'),
      this.#toggleOption('SCQUICKBAR.compactResources', 'fas fa-bars-progress', compactResources, 'compactResources'),
      this.#toggleOption('SCQUICKBAR.sideInfo', 'fas fa-table-columns', sideInfo, 'sideInfo', {
        visible: () => this.constructor.readConfig().layout === 0,
      }),
      this.#toggleOption('SCQUICKBAR.fadedUi', 'fas fa-circle-half-stroke', fadedUi, 'fadedUi'),
      this.#tristateOption(
        Object.values(this.constructor.PLAYER_COLOR_CHOICES),
        showPlayerColor,
        'showPlayerColor',
        ['fas fa-circle', 'fas fa-circle-dot', 'fas fa-fill-drip'],
        'players',
      ),
      this.#toggleOption('SCQUICKBAR.showPlayerName', 'fas fa-user-tag', showPlayerName, 'showPlayerName', { group: 'players' }),
      this.#toggleOption('SCQUICKBAR.preferActorImg', 'fas fa-image', preferActorImg, 'preferActorImg', { group: 'companions' }),
      this.#toggleOption('SCQUICKBAR.showLatency', 'fas fa-signal', showLatency, 'showLatency', { group: 'players' }),
      this.#toggleOption('SCQUICKBAR.showFps', 'fas fa-gauge-high', showFps, 'showFps', { group: 'players' }),
      this.#toggleOption('SCQUICKBAR.hidePlayers', 'fas fa-users-slash', hidePlayers, 'hidePlayers', { group: 'players' }),
      this.#tristateOption(
        Object.values(this.constructor.COMPANION_CHOICES),
        companionDisplay,
        'companionDisplay',
        ['fas fa-user', 'fas fa-paw', 'fas fa-eye'],
        'companions',
      ),
      {
        label: 'SCQUICKBAR.configure',
        icon: '<i class="fa-solid fa-cog"></i>',
        group: 'configure',
        onClick: () => new ConfigureScQuickbar().render(true),
      },
    ];
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.element?.classList.toggle('faded-ui', !!this.constructor.readConfig().fadedUi);
    this.refreshLatency();
    this.refreshFPS();

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

    this.element.querySelectorAll('.sc-quickbar-companion').forEach((companion) => {
      companion.addEventListener('pointerover', (event) => {
        event.stopPropagation();
        this.#onMemberHoverIn(event);
      });
      companion.addEventListener('pointerout', (event) => {
        event.stopPropagation();
        this.#onMemberHoverOut(event);
      });
      companion.addEventListener('dblclick', (event) => {
        event.stopPropagation();
        this.#onPortraitDblClick(event);
      });
      companion.addEventListener('contextmenu', (event) => event.stopPropagation());
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
    const current = this.constructor.readConfig().size;
    const delta = ev.deltaY > 0 ? -PORTRAIT_SIZE_STEP : PORTRAIT_SIZE_STEP;
    const next = Math.clamp(current + delta, PORTRAIT_SIZE_MIN, PORTRAIT_SIZE_MAX);
    if (next === current) return;

    await this.constructor.patchConfig({ size: next });
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
      resizable: true,
    },
    position: {
      width: 620,
      height: 560,
    },
    actions: {
      resetScQuickbar: this.resetScQuickbar,
    },
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    display: {
      template: 'systems/dsa5/templates/system/sc-quickbar/configure.hbs',
      scrollable: ['.scrollable'],
    },
    players: {
      template: 'systems/dsa5/templates/system/sc-quickbar/configure-players.hbs',
      scrollable: ['.scrollable'],
    },
    companions: {
      template: 'systems/dsa5/templates/system/sc-quickbar/configure-companions.hbs',
      scrollable: ['.scrollable'],
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'display', icon: 'fa-solid fa-sliders', label: 'SCQUICKBAR.tabBar' },
        { id: 'players', icon: 'fa-solid fa-users', label: 'SCQUICKBAR.tabPlayers' },
        { id: 'companions', icon: 'fa-solid fa-paw', label: 'SCQUICKBAR.tabCompanions' },
      ],
      initial: 'display',
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    tabSlider($(this.element));
    const html = $(this.element);
    html.find('select, input, range-picker').on('change', async (ev) => {
      if (!ev.currentTarget.name) return;

      const name = ev.currentTarget.name.split('.');
      let val = ev.currentTarget.value;
      if (ev.currentTarget.type === 'checkbox') val = ev.currentTarget.checked;
      else if (ev.currentTarget.tagName === 'RANGE-PICKER' || ev.currentTarget.tagName === 'SELECT') val = Number(val);

      if (name[0] === 'config') {
        await ScQuickbar.patchConfig({ [name[1]]: val });
      } else {
        await game.settings.set(name[0], name[1], val);
      }
      this.render();
    });
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const config = ScQuickbar.readConfig();
    mergeObject(data, {
      enableScQuickbar: game.settings.get('dsa5', 'enableScQuickbar'),
      config,
      layoutChoices: ScQuickbar.LAYOUT_CHOICES,
      playerColorChoices: ScQuickbar.PLAYER_COLOR_CHOICES,
      companionChoices: ScQuickbar.COMPANION_CHOICES,
    });
    return data;
  }

  static async resetScQuickbar() {
    await game.settings.set('dsa5', 'scQuickbarPosition', {});
    await game.settings.set('dsa5', 'scQuickbarConfig', { ...ScQuickbar.DEFAULT_CONFIG });
    await syncScQuickbar(true);
  }
}
