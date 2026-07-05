const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export default class AspPaymentDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static PARTS = {
    content: {
      template: 'systems/dsa5/templates/dialog/asp-payment-dialog.hbs',
      scrollable: ['.scrollable'],
    },
  };

  static DEFAULT_OPTIONS = {
    id: 'asp-payment-dialog',
    classes: ['dsa5'],
    window: {
      title: 'POWERSOURCE.dialogTitle',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: { width: 560, height: 'auto' },
    actions: {
      shiftCost: this.#onShiftCost,
      confirm: this.#onConfirm,
    },
  };

  #resolve;

  constructor(actor, totalCost, paymentOptions = {}) {
    super();
    this.actor = actor;
    this.totalCost = totalCost;
    this.paymentOptions = paymentOptions;
    this.#resolve = paymentOptions.resolve;
    this.sources = AspPaymentDialog.#buildSources(actor, paymentOptions);
    this.#initializeAllocations();
  }

  static prompt(actor, totalCost, options = {}) {
    return new Promise((resolve) => {
      const dialog = new AspPaymentDialog(actor, totalCost, { ...options, resolve });
      dialog.render(true);
    });
  }

  static #buildSources(actor, options = {}) {
    const sources = [];
    const personalAvailable = Number(actor.system.status.astralenergy.value) || 0;
    sources.push({
      id: 'personal',
      label: _loc('AsP'),
      available: personalAvailable,
      allocated: 0,
      min: options.minPersonalAsP ?? 0,
      maxAlloc: personalAvailable,
    });

    for (const segment of actor.powersource?.segments ?? []) {
      if (options.paymentOnly !== false && segment.value <= 0) continue;
      sources.push({
        id: `ks:${segment.itemId}:${segment.effectId}`,
        label: segment.label,
        available: segment.value,
        allocated: 0,
        min: 0,
        maxAlloc: segment.value,
        itemId: segment.itemId,
        effectId: segment.effectId,
        name: segment.name,
      });
    }

    if (options.includeLeP) {
      sources.push({
        id: 'lep',
        label: _loc('LeP'),
        available: Number(actor.system.status.wounds.value) || 0,
        allocated: 0,
        min: 0,
        maxAlloc: Number.MAX_SAFE_INTEGER,
      });
    }

    return sources;
  }

  static #parseAllocation(sources) {
    const personalSource = sources.find((s) => s.id === 'personal');
    const lepSource = sources.find((s) => s.id === 'lep');
    const ksSources = sources
      .filter((s) => s.id.startsWith('ks:'))
      .filter((s) => (Number(s.allocated) || 0) > 0)
      .map((s) => ({
        itemId: s.itemId,
        effectId: s.effectId,
        name: s.name,
        amount: Number(s.allocated) || 0,
      }));

    return {
      personal: Number(personalSource?.allocated) || 0,
      lep: Number(lepSource?.allocated) || 0,
      sources: ksSources,
    };
  }

  #initializeAllocations() {
    const personal = this.sources.find((s) => s.id === 'personal');
    if (personal) {
      personal.allocated = Math.min(
        personal.available,
        Math.max(this.paymentOptions.minPersonalAsP ?? 0, 0),
        this.totalCost,
      );
    }

    let remaining = this.totalCost - (personal?.allocated || 0);
    for (const ks of this.sources.filter((s) => s.id.startsWith('ks:'))) {
      if (remaining <= 0) break;
      const take = Math.min(ks.available, remaining);
      ks.allocated = take;
      remaining -= take;
    }

    const lep = this.sources.find((s) => s.id === 'lep');
    if (lep && remaining > 0) {
      lep.allocated = remaining;
      remaining = 0;
    } else if (personal && remaining > 0) {
      personal.allocated = Math.min(personal.available, personal.allocated + remaining);
    }
  }

  async _prepareContext(options) {
    return {
      totalCost: this.totalCost,
      currentLeP: this.actor.system.status.wounds.value,
      currentAsP: this.actor.system.status.astralenergy.value,
      sources: this.sources,
      includeLeP: !!this.paymentOptions.includeLeP,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const inp of this.element.querySelectorAll('.asp-payment-input')) {
      inp.addEventListener('change', () => this.#onManualInput());
      inp.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter') {
          ev.preventDefault();
          this.#onManualInput();
        }
      });
    }
  }

  #onManualInput() {
    const html = this.element;
    for (const source of this.sources) {
      const input = html.querySelector(`.asp-payment-input[data-id="${source.id}"]`);
      source.allocated = parseInt(input?.value, 10) || 0;
    }
    this.#validateAllocations();
    this.render({ parts: ['content'] });
  }

  #validateAllocations() {
    for (const source of this.sources) {
      const min = source.min ?? 0;
      const max = Math.min(source.available, source.maxAlloc ?? source.available);
      source.allocated = Math.max(min, Math.min(max, Number(source.allocated) || 0));
    }

    let sum = this.sources.reduce((acc, s) => acc + s.allocated, 0);
    if (sum === this.totalCost) return;

    const personal = this.sources.find((s) => s.id === 'personal');
    if (!personal) return;

    const delta = this.totalCost - sum;
    personal.allocated = Math.max(personal.min ?? 0, Math.min(personal.available, personal.allocated + delta));
    sum = this.sources.reduce((acc, s) => acc + s.allocated, 0);

    if (sum !== this.totalCost) {
      const lep = this.sources.find((s) => s.id === 'lep');
      if (lep) {
        lep.allocated = Math.max(0, this.totalCost - sum + lep.allocated);
      }
    }
  }

  static #onShiftCost(event, target) {
    const dir = target.closest('[data-dir]')?.dataset.dir;
    const sourceId = target.closest('[data-id]')?.dataset.id;
    const source = this.sources.find((s) => s.id === sourceId);
    if (!source || !dir) return;

    const delta = dir === 'right' ? 1 : -1;
    const neighbors = this.#shiftNeighbors(source);

    for (const neighbor of neighbors) {
      if (delta > 0) {
        const sourceMax = Math.min(source.available, source.maxAlloc ?? source.available);
        if (source.allocated >= sourceMax) break;
        if (neighbor.allocated <= (neighbor.min ?? 0)) continue;
        source.allocated++;
        neighbor.allocated--;
        break;
      }

      if (source.allocated <= (source.min ?? 0)) break;
      const neighborMax = Math.min(neighbor.available, neighbor.maxAlloc ?? neighbor.available);
      if (neighbor.allocated >= neighborMax) continue;
      source.allocated--;
      neighbor.allocated++;
      break;
    }

    this.#validateAllocations();
    this.render({ parts: ['content'] });
  }

  #shiftNeighbors(source) {
    const index = this.sources.indexOf(source);
    if (index < 0) return [];

    const right = this.sources.slice(index + 1);
    const left = this.sources.slice(0, index).reverse();
    return [...right, ...left];
  }

  static async #onConfirm() {
    this.#validateAllocations();
    const sum = this.sources.reduce((acc, s) => acc + s.allocated, 0);
    if (sum !== this.totalCost) {
      ui.notifications.error('POWERSOURCE.invalidAllocation', { localize: true });
      return;
    }

    const allocation = AspPaymentDialog.#parseAllocation(this.sources);

    this.#resolved = true;
    if (typeof this.paymentOptions.onConfirm === 'function') {
      await this.paymentOptions.onConfirm(allocation);
    }
    if (typeof this.#resolve === 'function') {
      this.#resolve(allocation);
    }
    this.close({ skipResolve: true });
  }

  close(options = {}) {
    if (!options.skipResolve && typeof this.#resolve === 'function' && !this.#resolved) {
      this.#resolved = true;
      this.#resolve(null);
    }
    return super.close(options);
  }

  #resolved = false;
}
