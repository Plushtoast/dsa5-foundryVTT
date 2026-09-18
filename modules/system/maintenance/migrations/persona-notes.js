export default class PersonaNotesMigrator {
  static KEY = 'personaNotes';
  static DIALOG_ID = 'dsa-persona-notes-migration';
  static #PAGE_UPDATE_OPTIONS = {
    dsaSkipPersonaFill: true,
    dsaSkipPersonaSync: true,
    dsaSkipPersonaRefresh: true,
  };
  static #LANG = {
    de: {
      confirm: 'Almanach-Notizen wiederherstellen',
      done: 'Almanach-Notizen bei {count} Einträgen wiederhergestellt.',
      effect: '{count} Almanach-Einträge haben noch einen eigenen Notiztext. Die Aktualisierung trennt dort die Verknüpfung mit dem Akteur, damit der bisherige Almanach-Text wieder sichtbar ist.',
      intro: 'Almanach-Notizen sind jetzt standardmäßig mit dem Notizfeld des Akteurs verknüpft. Notizen, die nur im Almanach gepflegt wurden, können dadurch unsichtbar wirken.',
      more: 'und {count} weitere',
      once: 'Diese Frage wird nur einmal gestellt. Du kannst Einträge später im Almanach weiterhin manuell entkoppeln.',
      privacy: 'Die Notizen der Akteure werden nicht verändert. Es wird nichts auf Charakterbögen kopiert.',
      skip: 'Verknüpft lassen',
      title: 'Almanach-Notizen wiederherstellen',
    },
    en: {
      confirm: 'Restore Almanac notes',
      done: 'Restored Almanac notes on {count} entries.',
      effect: '{count} Almanac entries still have their own notes. The update turns the actor-notes link off for those entries so the old Almanac text is visible again.',
      intro: 'Almanac notes are now linked to the actor notes field by default. Notes that were written only in the Almanac can look like they disappeared.',
      more: 'and {count} more',
      once: 'This question is asked only once. You can still unlink entries later in the Almanac.',
      privacy: 'Actor notes are not changed, so nothing is copied onto character sheets.',
      skip: 'Keep linked',
      title: 'Restore Almanac notes',
    },
  };

  static #loc(key, data = {}) {
    const pack = this.#LANG[game.i18n.lang] ?? this.#LANG.en;
    return String(pack[key] ?? this.#LANG.en[key] ?? key).replace(/\{(\w+)\}/g, (_, name) => data[name] ?? '');
  }

  static #personaModel() {
    return CONFIG.JournalEntryPage.dataModels.dsapersonaedramatis;
  }

  static normalizeNotesHtml(html) {
    return String(html ?? '')
      .replace(/&nbsp;/gi, ' ')
      .replace(/<br\s*\/?>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static notesHtmlIsEmpty(html) {
    return !this.normalizeNotesHtml(html);
  }

  static notesHtmlEquals(left, right) {
    return this.normalizeNotesHtml(left) === this.normalizeNotesHtml(right);
  }

  static storedActorNotesLink(page, key) {
    return page?._source?.system?.personae?.[key]?.linkActorNotes;
  }

  static shouldUnlink(page, key, entry = {}) {
    if (this.storedActorNotesLink(page, key) === false) return false;
    if (!entry.actor_uuid) return false;

    let actor;
    try {
      actor = fromUuidSync(entry.actor_uuid);
    } catch {
      actor = null;
    }
    if (!this.#personaModel()?.isActorNotesLinkable?.(actor)) return false;
    if (this.notesHtmlIsEmpty(entry.notes)) return false;
    if (this.notesHtmlEquals(entry.notes, actor.system?.details?.notes?.value)) return false;
    return true;
  }

  static collect(pages) {
    const targets = pages ?? this.#worldPersonaPages();
    const plan = [];
    let count = 0;

    for (const target of targets) {
      const page = target?.page ?? target;
      const keys = [];
      for (const [key, entry] of Object.entries(page?.system?.personae || {})) {
        if (!this.shouldUnlink(page, key, entry)) continue;
        keys.push(key);
      }
      if (!keys.length) continue;
      plan.push({ page, keys });
      count += keys.length;
    }

    return { pages: plan, count };
  }

  static *#worldPersonaPages() {
    for (const journal of game.journal) {
      for (const page of journal.pages) {
        if (page.type === 'dsapersonaedramatis') yield page;
      }
    }
  }

  static async apply(plan) {
    const pages = plan?.pages || [];
    for (const { page, keys } of pages) {
      if (!page || !keys?.length) continue;
      const update = {};
      for (const key of keys) update[`system.personae.${key}.linkActorNotes`] = false;
      await page.update(update, this.#PAGE_UPDATE_OPTIONS);
    }
    if (pages.length) this.#personaModel()?.refreshCalendarPicker?.();
    return plan?.count ?? 0;
  }

  static async prompt(plan) {
    const names = plan.pages.flatMap(({ page, keys }) => keys.map((key) => page.system?.personae?.[key]?.name).filter(Boolean));
    const preview = names.slice(0, 12).map((name) => `<li>${foundry.utils.escapeHTML(name)}</li>`).join('');
    const more = names.length > 12 ? `<p>${this.#loc('more', { count: names.length - 12 })}</p>` : '';
    const content = `
      <div>
        <p>${this.#loc('intro')}</p>
        <p>${this.#loc('effect', { count: plan.count })}</p>
        <p>${this.#loc('privacy')}</p>
        ${preview ? `<ul>${preview}</ul>${more}` : ''}
        <p>${this.#loc('once')}</p>
      </div>
    `;

    try {
      return await foundry.applications.api.DialogV2.wait({
        id: this.DIALOG_ID,
        window: { title: this.#loc('title') },
        content,
        modal: true,
        rejectClose: false,
        buttons: [
          {
            action: 'restore',
            icon: 'fa fa-check',
            label: this.#loc('confirm'),
            default: true,
            callback: () => true,
          },
          {
            action: 'skip',
            icon: 'fas fa-times',
            label: this.#loc('skip'),
            callback: () => false,
          },
        ],
      });
    } catch {
      return false;
    }
  }

  static async migrate() {
    const plan = this.collect();
    if (!plan.count) return 0;

    const restore = await this.prompt(plan);
    if (!restore) return 0;

    const count = await this.apply(plan);
    ui.notifications.info(this.#loc('done', { count }));
    return count;
  }
}
