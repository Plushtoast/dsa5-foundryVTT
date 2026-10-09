import { DefaultAppv2 } from '../../actor/baseapp.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import { TrapState } from '../../chatmessage/trap_state.js';

/**
 * GM canvas toggle that reveals regions carrying a DSA trap behavior
 * while the token controls are active.
 */
export default class TrapRegionControls {
  static TOOL_NAME = 'manageTraps';
  static BEHAVIOR_TYPE = 'DSATrap';

  static #enabled = false;
  static #hasTraps = null;
  static #visibilityPatched = false;

  static #refreshControls = foundry.utils.debounce(() => {
    ui.controls?.render({ reset: true });
  }, 100);

  static get enabled() {
    return this.#enabled;
  }

  static registerHooks() {
    this.#patchVisibility();
    Hooks.on('getSceneControlButtons', (controls) => this.installTool(controls));
    Hooks.on('canvasReady', () => this.#onRegionsChanged());
    for (const hook of ['createRegion', 'deleteRegion', 'updateRegion', 'createRegionBehavior', 'deleteRegionBehavior', 'updateRegionBehavior']) {
      Hooks.on(hook, () => this.#onRegionsChanged());
    }
  }

  /**
   * @param {RegionDocument|null|undefined} region
   * @returns {boolean}
   */
  static isTrapRegion(region) {
    return region?.behaviors?.some((behavior) => behavior.type === this.BEHAVIOR_TYPE) ?? false;
  }

  /**
   * @param {Scene|object|null|undefined} [scene]
   * @returns {boolean}
   */
  static sceneHasTraps(scene = canvas.scene) {
    return !!scene?.regions?.some((region) => this.isTrapRegion(region));
  }

  /**
   * @param {Scene|object|null|undefined} [scene]
   * @returns {boolean}
   */
  static shouldShowTool(scene = canvas.scene) {
    return !!game.user?.isGM && this.sceneHasTraps(scene);
  }

  /**
   * Token-layer tool. Foundry drops it when `visible` is false.
   * @returns {object}
   */
  static tokenTool() {
    return {
      name: this.TOOL_NAME,
      order: 5,
      title: 'REGIONBEHAVIOR_DSATrap.manageTraps',
      icon: 'fa-solid fa-land-mine-on',
      button: true,
      visible: this.shouldShowTool(),
      onChange: () => this.openManagementDialog(),
    };
  }

  /**
   * @param {Record<string, { tools?: Record<string, object> }>} controls
   */
  static installTool(controls) {
    if (!controls.tokens?.tools) return;
    controls.tokens.tools[this.TOOL_NAME] = this.tokenTool();
  }

  /**
   * @param {boolean} enabled
   */
  static setEnabled(enabled) {
    const next = !!enabled && !!game.user?.isGM;
    if (this.#enabled === next) return;
    this.#enabled = next;
    this.refreshVisibility();
  }

  static openManagementDialog() {
    return TrapManagementDialog.open();
  }

  static trapCardEntries(scene = canvas.scene) {
    return Array.from(scene?.regions ?? []).flatMap((region) =>
      Array.from(region.behaviors ?? [])
        .filter((behavior) => this.canCreateTrapCard(behavior))
        .map((behavior) => ({
          uuid: behavior.uuid,
          name: behavior.name || region.name,
          regionName: region.name,
        })),
    );
  }

  static canCreateTrapCard(behavior) {
    if (behavior?.type !== this.BEHAVIOR_TYPE || behavior.disabled || behavior.system?.disarmed) return false;
    const charges = Number(behavior.system?.charges);
    const remainingCharges = Number(behavior.system?.remainingCharges);
    return !(charges > 0 && remainingCharges < 1);
  }

  static #trapBehaviors(scene = canvas.scene) {
    return Array.from(scene?.regions ?? []).flatMap((region) =>
      Array.from(region.behaviors ?? []).filter((behavior) => behavior.type === this.BEHAVIOR_TYPE),
    );
  }

  static async rearmTraps() {
    const chargedTraps = this.#trapBehaviors().filter((behavior) => {
      const charges = Number(behavior.system?.charges);
      return Number.isFinite(charges) && charges > 0;
    });

    await Promise.all(chargedTraps.map((behavior) => behavior.update({
      'system.remainingCharges': Number(behavior.system.charges),
      'system.disarmed': false,
    })));
  }

  static async setTrapsDisabled(disabled) {
    const trapsToUpdate = this.#trapBehaviors().filter((behavior) => Boolean(behavior.disabled) !== disabled);
    await Promise.all(trapsToUpdate.map((behavior) => behavior.update({ disabled })));
  }

  /**
   * @param {PIXI.Container & { document?: RegionDocument }} regionObject
   * @param {{ enabled?: boolean, isGM?: boolean }} [options]
   * @returns {boolean}
   */
  static forcesVisible(regionObject, { enabled = this.#enabled, isGM = !!game.user?.isGM } = {}) {
    return enabled && isGM && this.isTrapRegion(regionObject?.document);
  }

  static refreshVisibility() {
    const placeables = canvas.regions?.placeables;
    if (!placeables) return;
    for (const region of placeables) {
      if (!this.isTrapRegion(region.document)) continue;
      region.renderFlags.set({ refreshVisibility: true });
      region.applyRenderFlags();
    }
  }

  static #onRegionsChanged() {
    const hasTraps = this.sceneHasTraps();
    if (hasTraps === this.#hasTraps) return;
    this.#hasTraps = hasTraps;
    this.#refreshControls();
  }

  static #patchVisibility() {
    if (this.#visibilityPatched) return;
    const Region = foundry.canvas.placeables.Region;
    const original = Object.getOwnPropertyDescriptor(Region.prototype, 'isVisible')?.get;
    if (!original) return;
    Object.defineProperty(Region.prototype, 'isVisible', {
      configurable: true,
      get() {
        if (TrapRegionControls.forcesVisible(this)) return true;
        return original.call(this);
      },
    });
    this.#visibilityPatched = true;
  }
}

class TrapManagementDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    id: 'dsa-trap-management-dialog',
    classes: ['dsa5'],
    position: { width: 520 },
    window: {
      title: 'REGIONBEHAVIOR_DSATrap.manageTraps',
      contentClasses: ['standard-form', 'flexcol', 'gap5px'],
    },
    actions: {
      createTrapCard: this.#createTrapCard,
      rearmTraps: this.#rearmTraps,
      disableAllTraps: this.#disableAllTraps,
      enableAllTraps: this.#enableAllTraps,
      toggleTrapVisibility: this.#toggleTrapVisibility,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/trap-management.hbs',
    },
  };

  static open() {
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) return existing.bringToTop();

    const dialog = new this();
    dialog.render(true);
    return dialog;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.showingTraps = TrapRegionControls.enabled;
    return context;
  }

  static async #rearmTraps() {
    await TrapRegionControls.rearmTraps();
    await this.close();
  }

  static async #createTrapCard() {
    await this.close();
    TrapCardSelectionDialog.open();
  }

  static async #disableAllTraps() {
    await TrapRegionControls.setTrapsDisabled(true);
    await this.close();
  }

  static async #enableAllTraps() {
    await TrapRegionControls.setTrapsDisabled(false);
    await this.close();
  }

  static async #toggleTrapVisibility() {
    TrapRegionControls.setEnabled(!TrapRegionControls.enabled);
    await this.close();
  }
}

class TrapCardSelectionDialog extends DefaultAppv2 {
  #previewRegionObject = null;
  #previousHover = false;
  selectedTrapUuid = '';

  static DEFAULT_OPTIONS = {
    id: 'dsa-trap-card-selection-dialog',
    classes: ['dsa5'],
    position: { width: 460 },
    window: {
      title: 'REGIONBEHAVIOR_DSATrap.createTrapCard',
      contentClasses: ['standard-form', 'flexcol', 'gap5px'],
    },
    actions: {
      selectTrap: this.#selectTrap,
      confirmTrapCard: this.#confirmTrapCard,
      cancel: this.#cancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/trap-card-selection.hbs',
    },
  };

  static open() {
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) return existing.bringToTop();

    TrapRegionControls.setEnabled(true);
    const dialog = new this();
    dialog.render(true);
    return dialog;
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    context.traps = TrapRegionControls.trapCardEntries();
    context.hasTraps = context.traps.length > 0;
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const button of this.element.querySelectorAll('[data-trap-preview]')) {
      button.addEventListener('pointerenter', () => this.#previewTrap(button.dataset.trapUuid));
      button.addEventListener('pointerleave', () => this.#clearPreview());
    }
  }

  async close(options) {
    this.#clearPreview();
    return super.close(options);
  }

  #previewTrap(uuid) {
    this.#clearPreview();
    const region = fromUuidSync(uuid)?.parent;
    const object = region?.object;
    if (!object) return;

    this.#previewRegionObject = object;
    this.#previousHover = object.hover;
    object.hover = true;
    object.renderFlags.set({ refreshState: true });
    object.applyRenderFlags();
  }

  #clearPreview() {
    if (!this.#previewRegionObject) return;
    this.#previewRegionObject.hover = this.#previousHover;
    this.#previewRegionObject.renderFlags.set({ refreshState: true });
    this.#previewRegionObject.applyRenderFlags();
    this.#previewRegionObject = null;
  }

  static async #selectTrap(event) {
    const behavior = fromUuidSync(event.currentTarget.dataset.trapUuid);
    const region = behavior?.parent;
    const scene = canvas.scene;
    if (
      !TrapRegionControls.canCreateTrapCard(behavior)
      || region?.parent?.id !== scene?.id
      || scene.regions.get(region.id)?.uuid !== region.uuid
      || !region.object
    ) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.trapCardSelectionChanged', { localize: true });
      return;
    }

    TrapRegionControls.setEnabled(true);
    canvas.regions.activate();
    await canvas.animatePan({ x: region.object.center.x, y: region.object.center.y });
    this.#clearPreview();
    if (!region.object.control({ releaseOthers: true })) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.trapCardSelectionChanged', { localize: true });
      return;
    }

    this.selectedTrapUuid = behavior.uuid;
    for (const button of this.element.querySelectorAll('[data-action="selectTrap"]')) {
      const selected = button.dataset.trapUuid === this.selectedTrapUuid;
      button.setAttribute('aria-pressed', String(selected));
    }
    const confirm = this.element.querySelector('[data-action="confirmTrapCard"]');
    if (confirm) confirm.disabled = false;
  }

  static async #confirmTrapCard() {
    const uuid = this.selectedTrapUuid;
    const behavior = uuid ? fromUuidSync(uuid) : null;
    const region = behavior?.parent;
    const scene = canvas.scene;
    if (
      !TrapRegionControls.canCreateTrapCard(behavior)
      || region?.parent?.id !== scene?.id
      || scene.regions.get(region.id)?.uuid !== region.uuid
    ) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.trapCardSelectionChanged', { localize: true });
      return;
    }

    const tokenCandidates = new Map();
    for (const tokenObject of canvas.tokens?.placeables ?? []) {
      const token = tokenObject.document;
      const actor = TrapState.actorFromToken(token);
      if (!actor) continue;

      const existing = tokenCandidates.get(actor.id);
      if (!existing || (tokenObject.controlled && !existing.controlled)) {
        tokenCandidates.set(actor.id, {
          actor,
          token,
          controlled: tokenObject.controlled,
        });
      }
    }

    if (!tokenCandidates.size) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.noSceneTokensForTrapCard', { localize: true });
      return;
    }

    const [actorId] = await ActorPickerDialog.open({
      actors: ActorPickerDialog.buildActorPickerData({
        actors: [...tokenCandidates.values()].map(({ actor }) => actor),
      }),
      title: 'REGIONBEHAVIOR_DSATrap.selectActorForTrapCard',
      selectionMode: 'single',
    });
    if (!actorId) return;

    const candidate = tokenCandidates.get(actorId);
    if (canvas.scene?.id !== scene.id || candidate?.token.parent?.id !== scene.id) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.trapCardSelectionChanged', { localize: true });
      return;
    }

    const currentBehavior = fromUuidSync(uuid);
    if (!TrapRegionControls.canCreateTrapCard(currentBehavior) || currentBehavior.parent?.uuid !== region.uuid) {
      ui.notifications.warn('REGIONBEHAVIOR_DSATrap.trapCardSelectionChanged', { localize: true });
      return;
    }

    await new TrapState(currentBehavior, candidate.token, region, 'manual').toMessage();
    await this.close();
  }

  static async #cancel() {
    await this.close();
  }
}
