import NavalBoardWeapons from '../combat/mkr/naval-board-weapons.js';
import DPS from '../system/automation/derepositioningsystem.js';
import RuleChaos from '../system/rules/rule_chaos.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Runtime accessor avoids circular import with naval-broadside.js */
const Broadside = () => game.dsa5.combat.NavalBroadside;

/**
 * Scrollable ApplicationV2 picker for Volle Breitseite weapon/shot selection.
 * Disables weapons that are out of reach for the current user targets.
 */
export default class NavalBroadsideDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'naval-broadside-app'],
    tag: 'form',
    form: {
      submitOnChange: false,
      closeOnSubmit: false,
    },
    window: {
      title: 'VEHICLE.mkr.broadside',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: {
      width: 560,
      height: 520,
    },
    actions: {
      selectAll: NavalBroadsideDialog.#onSelectAll,
      selectNone: NavalBroadsideDialog.#onSelectNone,
      fire: NavalBroadsideDialog.#onFire,
      cancel: NavalBroadsideDialog.#onCancel,
    },
  };

  static PARTS = {
    content: {
      template: 'systems/dsa5/templates/dialog/naval-broadside-dialog.hbs',
      scrollable: ['.naval-broadside-weapons'],
    },
  };

  #resolve;
  #resolved = false;
  #formState = null;
  #onTargetToken;

  constructor(vehicle, { tokenId, resolve } = {}) {
    super({ id: `dsa-naval-broadside-${vehicle.id}` });
    this.vehicle = vehicle;
    this.tokenId = tokenId;
    this.#resolve = resolve;
    this.weapons = [];
  }

  static prompt(vehicle, options = {}) {
    const dialogId = `dsa-naval-broadside-${vehicle.id}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      const dialog = new NavalBroadsideDialog(vehicle, { ...options, resolve });
      dialog.render(true);
    });
  }

  async _prepareContext(options) {
    const data = await super._prepareContext(options);
    await this.#refreshWeapons();
    data.weapons = this.weapons;
    data.vehicleName = this.vehicle.name;
    data.targetLabel = this.#targetLabel();
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#bindTargetHook();
    this.#bindShotQuantityClicks();
  }

  #bindShotQuantityClicks() {
    const root = this.element;
    if (!root) return;

    root.querySelectorAll('.naval-broadside-shots-input.quantity-click').forEach((el) => {
      el.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        RuleChaos.quantityClick(ev);
        this.#clampShotInput(ev.currentTarget);
      });
      el.addEventListener('contextmenu', (ev) => ev.preventDefault());
      el.addEventListener('change', (ev) => this.#clampShotInput(ev.currentTarget));
    });
  }

  #clampShotInput(input) {
    if (!input) return;
    const min = Number(input.dataset.min ?? 0);
    const max = Number(input.dataset.max);
    let val = Math.floor(Number(input.value) || 0);
    if (!Number.isFinite(val)) val = 0;
    if (Number.isFinite(min)) val = Math.max(min, val);
    if (Number.isFinite(max)) val = Math.min(max, val);
    input.value = String(val);
  }

  _onClose(options) {
    this.#unbindTargetHook();
    if (!this.#resolved && typeof this.#resolve === 'function') {
      this.#resolved = true;
      this.#resolve(null);
    }
    return super._onClose(options);
  }

  #bindTargetHook() {
    if (this.#onTargetToken) return;
    this.#onTargetToken = foundry.utils.debounce(() => this.#onTargetsChanged(), 50);
    Hooks.on('targetToken', this.#onTargetToken);
  }

  #unbindTargetHook() {
    if (!this.#onTargetToken) return;
    Hooks.off('targetToken', this.#onTargetToken);
    this.#onTargetToken = null;
  }

  async #onTargetsChanged() {
    if (!this.rendered) return;
    this.#formState = this.#captureFormState();
    await this.render({ parts: ['content'] });
  }

  #captureFormState() {
    const state = {};
    const root = this.element;
    if (!root) return state;

    for (const weapon of this.weapons) {
      const check = root.querySelector(`[name="weapon.${weapon.id}.selected"]`);
      const shots = root.querySelector(`[name="weapon.${weapon.id}.shots"]`);
      state[weapon.id] = {
        selected: !!check?.checked,
        shots: Number(shots?.value),
      };
    }
    return state;
  }

  #targetLabel() {
    const names = [...game.user.targets].map((t) => t.name || t.document?.name).filter(Boolean);
    if (!names.length) return _loc('VEHICLE.mkr.broadsideNoTarget');
    return names.join(', ');
  }

  #sourceToken() {
    if (this.tokenId) {
      const fromId = canvas.tokens?.get(this.tokenId);
      if (fromId) return fromId;
    }
    return canvas.tokens?.placeables.find((t) => t.actor?.id === this.vehicle.id) ?? null;
  }

  /**
   * Weapon is in range when the furthest user target is within the weapon's long reach band.
   * If distance cannot be measured (no tokens / wrong grid units), treat as in range.
   */
  static isWeaponInRange(weapon, sourceToken, targets = game.user.targets) {
    if (!targets?.size) return false;
    if (!sourceToken || !canvas?.scene) return true;
    if (canvas.scene.grid?.units && canvas.scene.grid.units !== _loc('gridUnits')) return true;

    let maxDistance = 0;
    for (const target of targets) {
      const dist = DPS.rangeFinder(sourceToken, target);
      if (dist.distanceSum > maxDistance) maxDistance = dist.distanceSum;
    }

    const ammoId = weapon.system?.currentAmmo?.value;
    const ammo = ammoId ? weapon.parent?.items?.get(ammoId) : null;
    const rangeMultiplier = Number(ammo?.system?.rangeMultiplier) || 1;
    const bands = String(weapon.system?.reach?.value || '')
      .split('/')
      .map((x) => Number(x) * rangeMultiplier)
      .filter((n) => Number.isFinite(n) && n > 0);

    if (!bands.length) return true;
    return maxDistance <= bands[bands.length - 1];
  }

  async #refreshWeapons() {
    const combat = game.combat;
    const API = Broadside();
    const combatant = API.resolveCombatant(this.vehicle, combat);
    const sourceToken = this.#sourceToken();
    const prev = this.#formState;
    this.#formState = null;

    const weapons = [];
    for (const item of this.vehicle.items.filter((i) => i.type === 'rangeweapon' && i.system?.worn?.value)) {
      const maxShots = API.maxShots(item, combat);
      const already = API.usedShots(combatant, item.id);
      const remaining = Math.max(0, maxShots - already);

      const operatorUuid = this.vehicle.system.weaponOperators?.[item.id];
      let rollingActor = this.vehicle;
      if (operatorUuid) {
        const operator = await fromUuid(operatorUuid);
        if (operator) rollingActor = operator;
      }

      const loaded = NavalBoardWeapons.isWeaponReady(item, rollingActor, this.vehicle);
      const inRange = NavalBroadsideDialog.isWeaponInRange(item, sourceToken, game.user.targets);
      const canFire = remaining > 0 && loaded && inRange;

      const saved = prev?.[item.id];
      let selected = canFire;
      let defaultShots = canFire ? remaining : 0;
      if (saved) {
        selected = canFire && !!saved.selected;
        if (canFire && Number.isFinite(saved.shots)) {
          defaultShots = Math.max(0, Math.min(maxShots, remaining, Math.floor(saved.shots)));
        }
      } else if (canFire) {
        selected = true;
        defaultShots = remaining;
      }

      weapons.push({
        id: item.id,
        name: item.name,
        img: item.img,
        maxShots,
        already,
        remaining,
        defaultShots,
        selected,
        canFire,
        loaded,
        inRange,
        reach: item.system?.reach?.value || '',
      });
    }

    this.weapons = weapons;
  }

  static #onSelectAll() {
    this.element?.querySelectorAll('input[data-weapon-select]').forEach((el) => {
      if (!el.disabled) el.checked = true;
    });
  }

  static #onSelectNone() {
    this.element?.querySelectorAll('input[data-weapon-select]').forEach((el) => {
      el.checked = false;
    });
  }

  static #onCancel() {
    this.close();
  }

  static #onFire() {
    const selection = this.#readSelection();
    if (!selection.length) {
      ui.notifications.warn('VEHICLE.mkr.broadsideNoShots', { localize: true });
      return;
    }

    this.#resolved = true;
    if (typeof this.#resolve === 'function') this.#resolve(selection);
    this.close({ skipResolve: true });
  }

  #readSelection() {
    const root = this.element;
    if (!root) return [];

    const selected = [];
    for (const weapon of this.weapons) {
      if (!weapon.canFire) continue;
      const check = root.querySelector(`[name="weapon.${weapon.id}.selected"]`);
      const shotsInput = root.querySelector(`[name="weapon.${weapon.id}.shots"]`);
      if (!check?.checked) continue;

      let shots = Math.max(0, Math.floor(Number(shotsInput?.value) || 0));
      shots = Math.min(shots, weapon.maxShots, weapon.remaining);
      if (shots > 0) selected.push({ weaponId: weapon.id, shots });
    }
    return selected;
  }
}
