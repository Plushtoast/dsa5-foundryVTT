import QueryOrchestrator from '../system/queries/query-orchestrator.js';

const { renderTemplate } = foundry.applications.handlebars;

export default class ActorPickerDialog extends foundry.applications.api.DialogV2 {
  static #getSelectionMode(element) {
    return element.querySelector('.query-actor-picker')?.dataset.selectionMode || 'multiple';
  }

  static #buildActorEntry(actor) {
    const { designatedUser } = QueryOrchestrator.resolveDesignatedUser(actor);
    const isActiveCharacter = designatedUser?.character?.id === actor.id;

    const actorTypeKey = `TYPES.Actor.${actor.type}`;
    const actorType = game.i18n.has(actorTypeKey) ? _loc(actorTypeKey) : actor.type;
    const metaParts = [];
    if (designatedUser) metaParts.push(designatedUser.name);
    if (actorType) metaParts.push(actorType);

    return {
      id: actor.id,
      name: actor.name,
      img: actor.img,
      meta: metaParts.join(' - '),
      isActiveCharacter,
      isPlayerOwned: actor.hasPlayerOwner,
    };
  }

  static ACTOR_SOURCES = Object.freeze({
    group: 'group',
    tracked: 'tracked',
    self: 'self',
  });

  static #getGroupActors() {
    const partyUuid = game.settings.get('dsa5', 'primaryParty');
    if (!partyUuid) return [];

    const party = fromUuidSync(partyUuid);
    return party?.system?.actors?.size ? Array.from(party.system.actors) : [];
  }

  static #getMasterMenuActors() {
    const tracked = game.settings.get('dsa5', 'trackedActors');
    if (tracked.actors?.length) {
      return game.actors
        .filter((a) => tracked.actors.includes(a.id))
        .sort((a, b) => tracked.actors.indexOf(a.id) - tracked.actors.indexOf(b.id));
    }
    return game.actors.filter((a) => a.hasPlayerOwner);
  }

  static #getSelfActors() {
    return game.users.map((u) => u.character).filter(Boolean);
  }

  static #getActorsBySource(source) {
    switch (source) {
      case this.ACTOR_SOURCES.group:
        return this.#getGroupActors();
      case this.ACTOR_SOURCES.tracked:
        return this.#getMasterMenuActors();
      case this.ACTOR_SOURCES.self:
        return this.#getSelfActors();
      default:
        return this.#getMasterMenuActors();
    }
  }

  static #getTrackedActors() {
    const partyUuid = game.settings.get('dsa5', 'primaryParty');
    if (partyUuid) {
      const party = fromUuidSync(partyUuid);
      if (party?.system?.actors?.size) return Array.from(party.system.actors);
    }

    const tracked = game.settings.get('dsa5', 'trackedActors');
    if (tracked.actors?.length) {
      return game.actors
        .filter((a) => tracked.actors.includes(a.id))
        .sort((a, b) => tracked.actors.indexOf(a.id) - tracked.actors.indexOf(b.id));
    }
    return game.actors.filter((a) => a.hasPlayerOwner);
  }

  static #availableSources() {
    const sources = [];
    if (this.#getGroupActors().length) {
      sources.push({ key: this.ACTOR_SOURCES.group, icon: 'fa-solid fa-people-group', tooltip: 'DSAQUERIES.ACTORSOURCE.group' });
    }
    sources.push({ key: this.ACTOR_SOURCES.tracked, icon: 'fa-solid fa-clipboard-list', tooltip: 'DSAQUERIES.ACTORSOURCE.tracked' });
    if (this.#getSelfActors().length) {
      sources.push({ key: this.ACTOR_SOURCES.self, icon: 'fa-solid fa-user', tooltip: 'DSAQUERIES.ACTORSOURCE.self' });
    }
    return sources;
  }

  static buildActorPickerData({ existingIds = new Set(), actors } = {}) {
    return (actors ?? this.#getTrackedActors())
      .filter((actor) => !existingIds.has(actor.id))
      .map((actor) => this.#buildActorEntry(actor))
      .sort((a, b) => {
        const aPriority = a.isActiveCharacter ? 2 : a.isPlayerOwned ? 1 : 0;
        const bPriority = b.isActiveCharacter ? 2 : b.isPlayerOwned ? 1 : 0;
        if (aPriority !== bPriority) return bPriority - aPriority;
        return a.name.localeCompare(b.name, game.i18n.lang);
      });
  }

  static TEMPLATE = 'systems/dsa5/templates/dialog/actor-picker-dialog.hbs';

  static DEFAULT_OPTIONS = {
    actions: {
      actorSource: this.#onActorSource,
      selectAll: this.#onSelectAll,
      selectNone: this.#onSelectNone,
    },
  };

  static #onActorSource(event, target) {
    if (target.getAttribute('aria-pressed') === 'true') return;

    const nav = target.closest('.query-actor-source-toggle');
    for (const btn of nav.querySelectorAll('button[data-source]')) {
      btn.setAttribute('aria-pressed', btn === target ? 'true' : 'false');
    }

    this.#switchActorSource(target.dataset.source);
  }

  static #onSelectAll(event, target) {
    for (const cb of this.element.querySelectorAll('.query-actor-selector')) {
      if (!cb.closest('.query-actor-row')?.hidden) cb.checked = true;
    }
    ActorPickerDialog.#syncSelectedState(this.element);
  }

  static #onSelectNone(event, target) {
    for (const cb of this.element.querySelectorAll('.query-actor-selector')) {
      if (!cb.closest('.query-actor-row')?.hidden) cb.checked = false;
    }
    ActorPickerDialog.#syncSelectedState(this.element);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('.select2').select2();

    ActorPickerDialog.#bindSearchFilter(this.element);
    ActorPickerDialog.#bindActorRowEvents(this.element);
    this.#bindDropEvents();

    const form = this.element.querySelector('form');
    form.style.overflowY = 'hidden';
    form.querySelector('.dialog-content').classList.add('scrollable');
  }

  static #onActorSearchFilter(_event, query, rgx, html) {
    for (const row of html.querySelectorAll('.query-actor-row')) {
      if (!query) {
        row.hidden = false;
        continue;
      }

      const searchable = [row.dataset.actorName || '', row.dataset.actorMeta || ''];
      row.hidden = !searchable.some((value) => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(value)));
    }
  }

  static #bindSearchFilter(element) {
    if (element.dataset.actorPickerSearchBound === 'true') return;

    const searchFilter = new foundry.applications.ux.SearchFilter({
      inputSelector: 'input.actorsearch[type=search]',
      contentSelector: '.query-actor-list',
      callback: ActorPickerDialog.#onActorSearchFilter,
    });
    searchFilter.bind(element);

    element.dataset.actorPickerSearchBound = 'true';
  }

  static #syncSelectedState(element) {
    element.querySelectorAll('.query-actor-row').forEach((row) => {
      const selector = row.querySelector('.query-actor-selector');
      row.classList.toggle('selected', !!selector?.checked);
    });
  }

  static #bindActorRowEvents(element) {
    const picker = element.querySelector('.query-actor-picker');
    if (!picker || picker.dataset.actorPickerBound === 'true') return;
    picker.dataset.actorPickerBound = 'true';

    picker.addEventListener('change', (event) => {
      if (event.target.closest('.query-actor-selector')) {
        ActorPickerDialog.#syncSelectedState(element);
      }
    });

    ActorPickerDialog.#syncSelectedState(element);
  }

  static #getSelectedActorIds(form) {
    return Array.from(form.querySelectorAll('input[name="queryActor"]:checked')).map((el) => el.value);
  }

  async #switchActorSource(source) {
    const selectionMode = ActorPickerDialog.#getSelectionMode(this.element);
    const actors = ActorPickerDialog.buildActorPickerData({ actors: ActorPickerDialog.#getActorsBySource(source) })
      .map((a) => ({ ...a, preselected: true }));

    const list = this.element.querySelector('.query-actor-list');
    if (!list) return;

    const rows = await Promise.all(
      actors.map((actor) => renderTemplate('systems/dsa5/templates/dialog/parts/actor-picker-row.hbs', { actor, selectionMode })),
    );
    list.innerHTML = rows.join('');

    ActorPickerDialog.#syncSelectedState(this.element);

    const searchInput = this.element.querySelector('input.actorsearch');
    if (searchInput) searchInput.value = '';
  }

  #bindDropEvents() {
    const list = this.element.querySelector('.query-actor-list');
    if (!list) return;

    list.addEventListener('dragover', (event) => event.preventDefault());
    list.addEventListener('drop', async (event) => {
      event.preventDefault();
      let data;
      try {
        data = JSON.parse(event.dataTransfer.getData('text/plain'));
      } catch {
        return;
      }
      if (data.type !== 'Actor') return;

      const actor = await Actor.implementation.fromDropData(data);
      if (!actor) return;

      if (list.querySelector(`[data-actor-id="${actor.id}"]`)) return;

      const entry = ActorPickerDialog.#buildActorEntry(actor);
      const selectionMode = ActorPickerDialog.#getSelectionMode(this.element);
      const fragment = document.createRange().createContextualFragment(
        await renderTemplate('systems/dsa5/templates/dialog/parts/actor-picker-row.hbs', { actor: entry, selectionMode }),
      );
      list.appendChild(fragment);
      ActorPickerDialog.#bindActorRowEvents(this.element);
    });
  }

  static async open({ actors = [], title = 'DSAQUERIES.COMMANDS.addActor', header = '', callback, selectionMode = 'multiple', showSourceToggle = false } = {}) {
    let actorSources = [];
    if (showSourceToggle) {
      actorSources = this.#availableSources();
      if (actorSources.length <= 1) actorSources = [];
      else {
        const defaultSource = actorSources[0].key;
        actors = this.buildActorPickerData({ actors: this.#getActorsBySource(defaultSource) })
          .map((a) => ({ ...a, preselected: true }));
      }
    }
    const content = await renderTemplate(this.TEMPLATE, { actors, header, selectionMode, actorSources });

    const dialogConfig = {
      window: { title, resizable: true },
      content,
      classes: ['dsa5'],
      buttons: [
        {
          action: 'confirm',
          icon: 'fa fa-check',
          label: 'yes',
          default: true,
          callback: (_event, button, dlg) => {
            const form = button.form || dlg.form || dlg.element;
            const actorIds = this.#getSelectedActorIds(form);
            if (callback) return callback({ actorIds, form });
            return actorIds;
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
          callback: () => (callback ? undefined : []),
        },
      ],
    };

    if (callback) {
      new this(dialogConfig).render(true);
      return;
    }

    return (await this.wait(dialogConfig)) ?? [];
  }
}
