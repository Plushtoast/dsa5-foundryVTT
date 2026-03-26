const { renderTemplate } = foundry.applications.handlebars;

export class JournalEntryTargetHelper {
  static #collator() {
    return new Intl.Collator(game.i18n?.lang || undefined, { sensitivity: 'base', numeric: true });
  }

  static collectTargets(pageType) {
    const collator = this.#collator();
    const journals = [];
    const pages = [];

    for (const journal of game.journal?.contents || []) {
      const matchingPages = journal.pages.filter((page) => page.type === pageType);
      if (!matchingPages.length) continue;

      journals.push({ journal, uuid: journal.uuid, name: journal.name });
      for (const page of matchingPages) {
        pages.push({
          journal,
          page,
          uuid: page.uuid,
          name: page.name,
          journalUuid: journal.uuid,
          journalName: journal.name,
        });
      }
    }

    journals.sort((left, right) => collator.compare(left.name || '', right.name || ''));
    pages.sort((left, right) => {
      const journalSort = collator.compare(left.journalName || '', right.journalName || '');
      if (journalSort !== 0) return journalSort;
      return collator.compare(left.name || '', right.name || '');
    });

    return { journals, pages };
  }

  static async chooseTarget({
    pageType,
    defaultName,
    dialogTitle,
    templateData = {},
  }) {
    dialogTitle ??= _loc('DSAJOURNALTARGET.dialogTitle');
    const targets = this.collectTargets(pageType);

    const content = await renderTemplate('systems/dsa5/templates/system/calendar/journal-target-dialog.hbs', {
      defaultName,
      hasExistingPages: targets.pages.length > 0,
      hasExistingJournals: targets.journals.length > 0,
      pages: targets.pages.map((target) => ({
        value: target.uuid,
        label: `${target.journalName} / ${target.name}`,
      })),
      journals: targets.journals.map((target) => ({
        value: target.uuid,
        label: target.name,
      })),
      ...templateData,
    });

    try {
      return await foundry.applications.api.DialogV2.wait({
        window: {
          title: dialogTitle,
        },
        content,
        render: (event, dialog) => {
          const modeSelect = dialog.element.querySelector('[name="mode"]');
          const updateMode = () => {
            const mode = modeSelect.value;
            dialog.element.querySelectorAll('.personae-target-group').forEach((group) => {
              const visibleModes = group.dataset.mode.split(',');
              group.hidden = !visibleModes.includes(mode);
            });
          };
          modeSelect.addEventListener('change', updateMode);
          updateMode();
        },
        buttons: [
          {
            action: 'ok',
            icon: 'fa fa-check',
            label: 'yes',
            default: true,
            callback: (event, button) => {
              const data = new foundry.applications.ux.FormDataExtended(button.form).object;
              if (data.mode === 'existing-page') {
                return { mode: data.mode, pageUuid: data.pageUuid };
              }
              if (data.mode === 'new-page') {
                return { mode: data.mode, journalUuid: data.journalUuid, pageName: data.pageName?.trim() };
              }
              return {
                mode: data.mode,
                journalName: data.journalName?.trim(),
                pageName: data.pageName?.trim(),
              };
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => false,
          },
        ],
      });
    } catch (error) {
      return false;
    }
  }

  static async ensureTarget(target, { pageType, defaultName }) {
    if (!target?.mode) return {};

    if (target.mode === 'existing-page') {
      const page = await fromUuid(target.pageUuid);
      return { journal: page?.parent, page };
    }

    if (target.mode === 'new-page') {
      const journal = await fromUuid(target.journalUuid);
      if (!journal) return {};

      const [page] = await journal.createEmbeddedDocuments('JournalEntryPage', [
        {
          name: target.pageName || defaultName,
          type: pageType,
        },
      ]);
      return { journal, page };
    }

    const journal = await JournalEntry.create({
      name: target.journalName || defaultName,
      pages: [
        {
          name: target.pageName || defaultName,
          type: pageType,
        },
      ],
    });
    const page = journal?.pages.find((entry) => entry.type === pageType);
    return { journal, page };
  }

  static async registerJournal(journal, { settingName, refresh }) {
    if (!journal) return;

    const settings = game.settings.get('dsa5', settingName) || { activated: [] };
    settings.activated ||= [];
    if (settings.activated.some((entry) => entry.uuid === journal.uuid)) return;

    settings.activated.push({ uuid: journal.uuid, name: journal.name });
    await game.settings.set('dsa5', settingName, settings);
    await refresh?.();
  }
}