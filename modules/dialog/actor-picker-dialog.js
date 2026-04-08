import QueryOrchestrator from '../system/queries/query-orchestrator.js';

const { renderTemplate } = foundry.applications.handlebars;

export default class ActorPickerDialog extends foundry.applications.api.DialogV2 {
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

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('.select2').select2();

    ActorPickerDialog.#bindActorPickerEvents(this.element);
    this.#bindDropEvents();
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

  static #bindActorPickerEvents(element) {
    const searchFilter = new foundry.applications.ux.SearchFilter({
      inputSelector: 'input.actorsearch[type=search]',
      contentSelector: '.query-actor-list',
      callback: ActorPickerDialog.#onActorSearchFilter,
    });
    searchFilter.bind(element);

    element.querySelectorAll('.query-actor-row').forEach((row) => {
      row.addEventListener('click', (event) => {
        if (event.target.closest('.query-actor-selector')) return;

        const checkbox = row.querySelector('.query-actor-selector');
        if (checkbox) checkbox.checked = !checkbox.checked;
      });
    });
  }

  static #getSelectedActorIds(form) {
    return Array.from(form.querySelectorAll('input[name="queryActor"]:checked')).map((el) => el.value);
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
      const fragment = document.createRange().createContextualFragment(
        await renderTemplate('systems/dsa5/templates/dialog/parts/actor-picker-row.hbs', { actor: entry }),
      );
      list.appendChild(fragment);
      ActorPickerDialog.#bindActorPickerEvents(this.element);
    });
  }

  static async open({ actors, title = 'DSAQUERIES.COMMANDS.addActor', header = '', callback } = {}) {
    if (!actors?.length) {
      ui.notifications.info('DSAQUERIES.NOTIFICATIONS.noAvailableActors', { localize: true });
      return;
    }

    const content = await renderTemplate(this.TEMPLATE, { actors, header });

    const dialog = new this({
      window: { title },
      content,
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
    });

    return callback ? dialog.render(true) : ((await dialog.wait()) ?? []);
  }
}
