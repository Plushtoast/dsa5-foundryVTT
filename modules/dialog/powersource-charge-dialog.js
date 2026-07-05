import { DefaultAppv2 } from '../actor/baseapp.js';
import EnhancementHelper from '../system/enhancement/enhancement-helper.js';

export default class PowersourceChargeDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    id: 'powersource-charge-dialog',
    classes: ['dsa5', 'powersource-charge-dialog'],
    tag: 'form',
    window: {
      title: 'POWERSOURCE.chargeDialogTitle',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: { width: 520, height: 'auto' },
    actions: {
      save: this.#save,
      cancel: this.#cancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/powersource-charge-dialog.hbs',
      scrollable: ['.scrollable'],
    },
  };

  constructor(actor, options = {}) {
    super({ ...options, id: options.id ?? `powersource-charge-${actor.id}` });
    this.actor = actor;
    this.sources = this.#buildSources(actor);
  }

  static show(actor) {
    if (!actor) return;
    if (!actor.isOwner && !game.user.isGM) return;

    const dialogId = `powersource-charge-${actor.id}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return;
    }

    new this(actor, { id: dialogId }).render(true);
  }

  #buildSources(actor) {
    EnhancementHelper.preparePowersources(actor);
    return (actor.powersource?.segments ?? []).map((segment) => ({
      itemId: segment.itemId,
      effectId: segment.effectId,
      label: segment.label,
      value: Number(segment.value) || 0,
      max: Number(segment.max) || 0,
    }));
  }

  async _prepareContext() {
    return {
      sources: this.sources,
      editable: this.actor.isOwner || game.user.isGM,
    };
  }

  #readFormData() {
    const form = this.element?.tagName === 'FORM' ? this.element : this.element?.querySelector('form');
    if (!form) return [];

    return this.sources.map((source) => {
      const input = form.querySelector(`[name="charge-${source.effectId}"]`);
      const value = Math.max(0, Math.min(source.max, Number(input?.value) || 0));
      return { ...source, value };
    });
  }

  static async #save(event) {
    event?.preventDefault();
    if (!this.actor.isOwner && !game.user.isGM) return;

    const entries = this.#readFormData();
    const updatesByItem = {};

    for (const entry of entries) {
      const original = this.sources.find((s) => s.effectId === entry.effectId);
      if (!original || entry.value === original.value) continue;
      updatesByItem[entry.itemId] ??= [];
      updatesByItem[entry.itemId].push({
        _id: entry.effectId,
        'system.powersource.value': entry.value,
      });
    }

    for (const [itemId, effects] of Object.entries(updatesByItem)) {
      const item = this.actor.items.get(itemId);
      if (!item) continue;
      await item.updateEmbeddedDocuments('ActiveEffect', effects);
    }

    await this.close();
  }

  static async #cancel(event) {
    event?.preventDefault();
    await this.close();
  }
}
