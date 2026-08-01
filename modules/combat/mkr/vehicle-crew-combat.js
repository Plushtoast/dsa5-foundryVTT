import DSA5Combatant from '../combatant.js';

/**
 * When vehicles join combat, optionally add their assigned crew as combatants.
 * One dialog covers all ships added in the same batch.
 */
export default class VehicleCrewCombatPrompt {
  static #pending = new Map();
  static #flushTimer = null;
  static #busy = false;

  static register() {
    Hooks.on('createCombatant', this.#onCreateCombatant.bind(this));
  }

  static #onCreateCombatant(combatant, options, userId) {
    if (game.userId !== userId || !game.user.isGM) return;
    if (options?.skipCrewPrompt || options?.fromVehicleCrewPrompt) return;
    if (combatant.actor?.type !== 'vehicle') return;
    this.#queue(combatant);
  }

  static #queue(combatant) {
    const vehicle = combatant.actor;
    if (!vehicle) return;

    const combat = combatant.combat;
    if (!combat) return;

    const crew = this.#eligibleCrew(vehicle, combat);
    if (!crew.length) return;

    this.#pending.set(vehicle.id, { vehicle, combat, crew });

    clearTimeout(this.#flushTimer);
    this.#flushTimer = setTimeout(() => this.#flush(), 50);
  }

  static #eligibleCrew(vehicle, combat) {
    const inCombat = new Set(
      [...(combat.combatants ?? [])]
        .map((c) => c.actorId)
        .filter(Boolean),
    );

    const members = [];
    const sorted = Object.entries(vehicle.system.crewMembers ?? {})
      .sort(([, a], [, b]) => a.sort - b.sort);

    for (const [, member] of sorted) {
      const actor = fromUuidSync(member.uuid);
      if (!actor || actor.type === 'vehicle' || actor.type === 'group') continue;
      if (inCombat.has(actor.id)) continue;
      members.push(actor);
    }
    return members;
  }

  static async #flush() {
    if (this.#busy) {
      this.#flushTimer = setTimeout(() => this.#flush(), 50);
      return;
    }

    const batch = [...this.#pending.values()];
    this.#pending.clear();
    this.#flushTimer = null;
    if (!batch.length) return;

    // Same combat expected for a batch; if mixed, group by combat.
    const byCombat = new Map();
    for (const entry of batch) {
      const id = entry.combat.id;
      if (!byCombat.has(id)) byCombat.set(id, []);
      byCombat.get(id).push(entry);
    }

    this.#busy = true;
    try {
      for (const entries of byCombat.values()) {
        await this.#promptAndAdd(entries);
      }
    } finally {
      this.#busy = false;
    }
  }

  static async #promptAndAdd(entries) {
    const combat = entries[0].combat;
    const scene = canvas.scene;

    const ships = entries.map(({ vehicle, crew }) => ({
      id: vehicle.id,
      name: vehicle.name,
      img: DSA5Combatant.tokenImageFor(vehicle) || vehicle.img,
      crew: crew.map((actor) => {
        const token = scene?.tokens.find((t) => t.actorId === actor.id) ?? null;
        return {
          id: actor.id,
          name: actor.name,
          img: DSA5Combatant.tokenImageFor(actor, token) || actor.img,
          hasToken: !!token,
          tokenHint: token
            ? _loc('VEHICLE.crewCombat.hasToken')
            : _loc('VEHICLE.crewCombat.noToken'),
        };
      }),
    })).filter((s) => s.crew.length);

    if (!ships.length) return;

    const selectedIds = await VehicleCrewCombatDialog.prompt(ships);
    if (!selectedIds?.length) return;

    const selected = new Set(selectedIds);
    const createData = [];

    for (const { crew } of entries) {
      for (const actor of crew) {
        if (!selected.has(actor.id)) continue;
        if (combat.combatants.some((c) => c.actorId === actor.id)) continue;

        const token = scene?.tokens.find((t) => t.actorId === actor.id);
        if (token) {
          createData.push({
            tokenId: token.id,
            sceneId: scene.id,
            actorId: actor.id,
            hidden: token.hidden,
          });
        } else {
          createData.push({
            actorId: actor.id,
            img: DSA5Combatant.tokenImageFor(actor) || actor.img,
          });
        }
      }
    }

    if (!createData.length) return;
    await combat.createEmbeddedDocuments('Combatant', createData, {
      skipCrewPrompt: true,
      fromVehicleCrewPrompt: true,
    });
  }
}

/**
 * Nested ship → crew checkbox dialog.
 * Clicking a ship row toggles all of that ship's crew checkboxes.
 */
class VehicleCrewCombatDialog extends foundry.applications.api.HandlebarsApplicationMixin(
  foundry.applications.api.ApplicationV2,
) {
  static DEFAULT_OPTIONS = {
    id: 'dsa-vehicle-crew-combat',
    classes: ['dsa5', 'vehicle-crew-combat-dialog'],
    window: { title: 'VEHICLE.crewCombat.title', resizable: true },
    position: { width: 480 },
    actions: {
      confirm: this.#onConfirm,
      skip: this.#onSkip,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/dialog-vehicle-crew-combat.hbs',
    },
  };

  constructor(ships, resolve) {
    super();
    this.ships = ships;
    this._resolve = resolve;
    this._resolved = false;
  }

  /**
   * @param {object[]} ships
   * @returns {Promise<string[]|null>} selected actor ids, or null if skipped
   */
  static prompt(ships) {
    const existing = foundry.applications.instances.get(this.DEFAULT_OPTIONS.id);
    if (existing) {
      existing.bringToTop();
      return Promise.resolve(null);
    }

    return new Promise((resolve) => {
      new VehicleCrewCombatDialog(ships, resolve).render(true);
    });
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.ships = this.ships;
    data.hint = _loc('VEHICLE.crewCombat.hint');
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#bindShipRowClicks();
    this.#bindCrewChanges();
  }

  #bindShipRowClicks() {
    for (const row of this.element.querySelectorAll('.vehicle-crew-ship-row')) {
      row.addEventListener('click', (ev) => {
        if (ev.target.closest('input')) return;
        const vehicleId = row.dataset.vehicleId;
        const shipCb = row.querySelector('.ship-toggle');
        if (!shipCb) return;
        shipCb.checked = !shipCb.checked;
        this.#setCrewForShip(vehicleId, shipCb.checked);
        shipCb.indeterminate = false;
      });
    }
  }

  #bindCrewChanges() {
    for (const cb of this.element.querySelectorAll('.crew-toggle')) {
      cb.addEventListener('change', () => {
        this.#syncShipFromCrew(cb.dataset.vehicleId);
      });
    }
    for (const cb of this.element.querySelectorAll('.ship-toggle')) {
      cb.addEventListener('change', () => {
        this.#setCrewForShip(cb.dataset.vehicleId, cb.checked);
        cb.indeterminate = false;
      });
    }
  }

  #setCrewForShip(vehicleId, checked) {
    for (const cb of this.element.querySelectorAll(`.crew-toggle[data-vehicle-id="${vehicleId}"]`)) {
      cb.checked = checked;
    }
  }

  #syncShipFromCrew(vehicleId) {
    const crew = [...this.element.querySelectorAll(`.crew-toggle[data-vehicle-id="${vehicleId}"]`)];
    const shipCb = this.element.querySelector(`.ship-toggle[data-vehicle-id="${vehicleId}"]`);
    if (!shipCb || !crew.length) return;
    const checkedCount = crew.filter((c) => c.checked).length;
    shipCb.checked = checkedCount === crew.length;
    shipCb.indeterminate = checkedCount > 0 && checkedCount < crew.length;
  }

  static #onConfirm() {
    const ids = [...this.element.querySelectorAll('.crew-toggle:checked')].map((cb) => cb.value);
    this._finish(ids);
  }

  static #onSkip() {
    this._finish(null);
  }

  _finish(result) {
    if (this._resolved) return;
    this._resolved = true;
    this._resolve?.(result);
    this.close();
  }

  async close(options) {
    if (!this._resolved) {
      this._resolved = true;
      this._resolve?.(null);
    }
    return super.close(options);
  }
}
