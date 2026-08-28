import { ModuleBookPersonaeHelper } from './module_book_personae_helper.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class ModuleBookPersonaeApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5'],
    window: {
      title: 'PERSONAE.moduleSetup.title',
      icon: 'fa-solid fa-address-book',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: { width: 560, height: 'auto' },
    actions: {
      apply: this.#onApply,
      remove: this.#onRemove,
      close: this.#onClose,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/wizard/adventure/module_book_personae.hbs',
      scrollable: [''],
    },
  };

  #busy = false;

  constructor(book, bookType, options = {}) {
    super({
      id: ModuleBookPersonaeApp.appIdFor(book, bookType),
      ...options,
    });
    this.book = book;
    this.bookType = bookType;
  }

  static appIdFor(book, bookType) {
    const slug = String(book?.id || 'book').slugify({ strict: true });
    return `dsa-module-personae-${bookType}-${slug}`;
  }

  static #onClose() {
    this.close();
  }

  static open(book, bookType) {
    if (!game.user.isGM || !book || !bookType) return null;

    const id = this.appIdFor(book, bookType);
    const existing = foundry.applications.instances.get(id);
    if (existing) {
      existing.bringToFront?.() ?? existing.render(true);
      return existing;
    }

    return new this(book, bookType).render({ force: true });
  }

  get title() {
    return _loc('PERSONAE.moduleSetup.windowTitle', { book: ModuleBookPersonaeHelper.bookDisplayName(this.book) });
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const packs = ModuleBookPersonaeHelper.collectActorPacks(this.book);
    const journal = ModuleBookPersonaeHelper.findJournal(this.book.id, this.bookType);

    context.bookName = ModuleBookPersonaeHelper.bookDisplayName(this.book);
    context.hasJournal = !!journal;
    context.journalName = journal?.name || ModuleBookPersonaeHelper.journalName(context.bookName);
    context.packs = packs.map((pack) => ({ ...pack, checked: true }));
    context.actorTypes = ModuleBookPersonaeHelper.ACTOR_TYPES.map((type) => ({
      id: type,
      label: game.i18n.localize(`TYPES.Actor.${type}`),
      checked: type === 'npc' || type === 'creature',
    }));
    context.skipExisting = true;
    context.hasPacks = packs.length > 0;
    return context;
  }

  #formValues() {
    const packIds = [...this.element.querySelectorAll('input[name="packId"]:checked')].map((input) => input.value);
    const typeSelect = this.element.querySelector('select[name="actorType"]');
    const actorTypes = typeSelect ? [...typeSelect.selectedOptions].map((option) => option.value) : [];
    const skipExisting = !!this.element.querySelector('input[name="skipExisting"]')?.checked;
    return { packIds, actorTypes, skipExisting };
  }

  async #withBusy(fn) {
    if (this.#busy) return;
    this.#busy = true;
    this.element?.querySelectorAll('[data-action]').forEach((button) => { button.disabled = true; });
    try {
      await fn();
    } finally {
      this.#busy = false;
      if (this.rendered) {
        this.element?.querySelectorAll('[data-action]').forEach((button) => { button.disabled = false; });
      }
    }
  }

  static async #onApply() {
    await this.#withBusy(async () => {
      const { packIds, actorTypes, skipExisting } = this.#formValues();
      if (!packIds.length) {
        ui.notifications.warn('PERSONAE.moduleSetup.noPacksSelected', { localize: true });
        return;
      }
      if (!actorTypes.length) {
        ui.notifications.warn('PERSONAE.moduleSetup.noTypesSelected', { localize: true });
        return;
      }

      ui.notifications.info('PERSONAE.moduleSetup.working', { localize: true });
      const result = await ModuleBookPersonaeHelper.apply(this.book, this.bookType, {
        packIds,
        actorTypes,
        skipExisting,
      });

      if (!result.journal) {
        ui.notifications.warn('PERSONAE.moduleSetup.nothingToAdd', { localize: true });
        return;
      }

      ui.notifications.info(_loc('PERSONAE.moduleSetup.done', {
        added: result.added,
        skipped: result.skipped,
        name: result.journal.name,
      }));
      result.journal.sheet?.render(true);
      await this.close();
    });
  }

  static async #onRemove() {
    await this.#withBusy(async () => {
      const journal = ModuleBookPersonaeHelper.findJournal(this.book.id, this.bookType);
      if (!journal) {
        ui.notifications.warn('PERSONAE.moduleSetup.nothingToRemove', { localize: true });
        return;
      }

      const confirmed = await foundry.applications.api.DialogV2.confirm({
        window: { title: 'PERSONAE.moduleSetup.removeTitle' },
        content: `<p>${_loc('PERSONAE.moduleSetup.removeConfirm', { name: journal.name })}</p>`,
        rejectClose: false,
        modal: true,
      });
      if (!confirmed) return;

      await ModuleBookPersonaeHelper.remove(this.book, this.bookType);
      ui.notifications.info(_loc('PERSONAE.moduleSetup.removed', { name: journal.name }));
      await this.close();
    });
  }
}
