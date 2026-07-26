import Select2Dialog from '../dialog/select2Dialog.js';

const { StringField, FilePathField } = foundry.data.fields;
const { renderTemplate } = foundry.applications.handlebars;

function journalCompendiumChoices() {
  return Object.fromEntries(
    game.packs
      .filter((pack) => pack.documentName === 'JournalEntry')
      .sort((a, b) => a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }))
      .map((pack) => [pack.collection, pack.title]),
  );
}

export default class CustomBookDialog extends Select2Dialog {
  static DIALOG_ID = 'journal-browser-custom-book-dialog';

  #existingJournals;
  #resolve;
  #resolved = false;

  static async prompt({ existingJournals = [] } = {}) {
    if (!game.user.isGM) return null;

    const existing = foundry.applications.instances.get(this.DIALOG_ID);
    if (existing) {
      existing.bringToTop();
      return null;
    }

    const content = await this.#renderContent(this.DIALOG_ID);

    return new Promise((resolve) => {
      const dialog = new CustomBookDialog({ existingJournals, content, resolve });
      dialog.render(true);
    });
  }

  constructor({ existingJournals, content, resolve }) {
    super({
      id: CustomBookDialog.DIALOG_ID,
      classes: ['dsa5'],
      window: { title: 'Book.addCustomBook' },
      position: { width: 520 },
      form: { closeOnSubmit: false },
      content,
      buttons: [
        {
          action: 'save',
          icon: 'fas fa-check',
          label: 'Save',
          callback: (_event, button) => CustomBookDialog.#readForm(button.form),
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
          default: true,
        },
      ],
      submit: (result, dlg) => dlg.handleSubmit(result),
    });

    this.#existingJournals = existingJournals;
    this.#resolve = resolve;
    this.addEventListener('close', () => {
      if (!this.#resolved) this.#resolve(null);
    }, { once: true });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const journal = this.element?.querySelector('select[name="journal"]');
    if (!journal || journal.dataset.select2Bound) return;
    journal.dataset.select2Bound = '1';
    $(journal).select2({ width: '100%' });
  }

  async handleSubmit(result) {
    if (result === 'cancel') {
      this.#resolved = true;
      await this.close();
      this.#resolve(null);
      return;
    }

    const entry = CustomBookDialog.#validate(result, this.#existingJournals);
    if (!entry) return;

    this.#resolved = true;
    await this.close();
    this.#resolve(entry);
  }

  static #systemFields() {
    return {
      title: new StringField({
        required: true,
        blank: false,
        label: 'Name',
      }),
      journal: new StringField({
        required: true,
        blank: 'Book.customBookSelectCompendium',
        label: 'Book.customBookJournalCompendium',
        choices: journalCompendiumChoices,
      }),
      splash: new FilePathField({
        required: true,
        blank: false,
        categories: ['IMAGE'],
        label: 'Book.customBookCoverPath',
      }),
      moduleName: new StringField({
        required: false,
        blank: true,
        label: 'Book.customBookModuleName',
        hint: 'Book.customBookModuleNameHint',
        initial: '',
      }),
    };
  }

  static #defaultDocument() {
    return {
      system: {
        title: '',
        journal: '',
        splash: '',
        moduleName: '',
      },
    };
  }

  static async #renderContent(rootId) {
    return renderTemplate('systems/dsa5/templates/wizard/adventure/custom_book_dialog.hbs', {
      systemFields: this.#systemFields(),
      document: this.#defaultDocument(),
      rootId,
    });
  }

  static #readForm(form) {
    const data = new foundry.applications.ux.FormDataExtended(form).object;
    return {
      title: String(data.title ?? '').trim(),
      journal: String(data.journal ?? '').trim(),
      splash: String(data.splash ?? '').trim(),
      moduleName: String(data.moduleName ?? '').trim(),
    };
  }

  static #validate(data, existingJournals) {
    if (!data?.title || !data?.journal || !data?.splash) {
      ui.notifications.warn('Book.customBookInvalidForm', { localize: true });
      return null;
    }
    if (!game.packs.get(data.journal)) {
      ui.notifications.error('Book.customBookMissingCompendium', { localize: true });
      return null;
    }
    if (existingJournals.includes(data.journal)) {
      ui.notifications.warn('Book.customBookDuplicate', { localize: true });
      return null;
    }
    return {
      id: foundry.utils.randomID(),
      title: data.title,
      journal: data.journal,
      splash: data.splash,
      moduleName: data.moduleName || data.title,
    };
  }
}
