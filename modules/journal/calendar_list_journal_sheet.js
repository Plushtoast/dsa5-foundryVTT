export default class CalendarListJournalSheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    #search;

    static #pageTitleTOCPlaceholderSlug = '__dsa5-custom-journal-page-title';

    static settingName = null;

    static DEFAULT_OPTIONS = {
        actions: {
            selectEntry: CalendarListJournalSheet.#selectEntry,
            toggleVisibility: CalendarListJournalSheet.#toggleVisibility,
            removeEntry: CalendarListJournalSheet.#removeEntry,
            addEntry: CalendarListJournalSheet.#addEntry,
        },
        position: {
            width: 1000,
            height: 700
        },
        includeTOC: true,
    };

    static sortEntryPairs([, a], [, b]) {
        return 0;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const entries = Object.entries(foundry.utils.duplicate(this.document.system[this.constructor.objectKey] || {}))
            .filter(([, value]) => value && (value.visible || game.user.isGM))
            .sort((a, b) => this.constructor.sortEntryPairs(a, b));

        context.sortedEntries = Object.fromEntries(entries);
        context.isGM = game.user.isGM;
        context.isRegistered = this.constructor.settingName
            ? game.settings.get('dsa5', this.constructor.settingName).activated.some(x => x.uuid == this.document.parent.uuid)
            : false;

        await this._prepareEntries(context, options);

        if (!this.isView) {
            if (options.currentKey) this.currentKey = options.currentKey;

            if (this.currentKey && context.sortedEntries[this.currentKey]) {
                context.currentKey = this.currentKey;
                context.detailHTML = await this.renderDetail(this.currentKey);
            }
        }

        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        this.#search ??= new foundry.applications.ux.SearchFilter({
            inputSelector: "input[type=search]",
            contentSelector: ".eventscontainer",
            callback: this.onSearchFilter.bind(this)
        });
        if (options.search) {
            this.#search.query = options.search;
            options.search = null;
        }
        this.#search.bind(this.element);
        if (this.options.includeTOC) this.toc = this.#buildTOC();

        if (this.isView) return;

        const registrationToggle = this.element.querySelector('.showInCalendar');
        if (registrationToggle && this.constructor.settingName) {
            registrationToggle.addEventListener('change', async event => {
                const isChecked = event.target.checked;
                const settings = game.settings.get('dsa5', this.constructor.settingName);
                if (isChecked) {
                    if (!settings.activated.some(x => x.uuid === this.document.parent.uuid)) {
                        settings.activated.push({ uuid: this.document.parent.uuid, name: this.document.parent.name });
                    }
                } else {
                    settings.activated = settings.activated.filter(x => x.uuid !== this.document.parent.uuid);
                }
                await game.settings.set('dsa5', this.constructor.settingName, settings);
                await this._afterRegistrationChange();
            });
        }

        await this._onRenderEditable(context, options);
    }

    static async #toggleVisibility(ev, target) {
        const key = target.dataset.key;
        const entry = this.document.system[this.constructor.objectKey][key];
        if (!entry) return;
        await this.document.update({ [`system.${this.constructor.objectKey}.${key}.visible`]: !entry.visible });
    }

    static async #selectEntry(event, target) {
        const detailsContainer = this.element.querySelector('.persona-details-container');
        if (!detailsContainer) return;

        const key = target.dataset.key;
        this.currentKey = key;

        if (!key) return;

        this.constructor.updateSelectionUI(target);

        detailsContainer.innerHTML = await this.renderDetail(key);
    }

    static updateSelectionUI(clickedElement) {
        const listItem = clickedElement.closest('[data-key]');
        if (!listItem) return;

        const listContainer = listItem.parentElement;
        listContainer?.querySelectorAll('.selected').forEach(item => item.classList.remove('selected'));
        listItem.classList.add('selected');
    }

    _tearDown(options) {
        super._tearDown(options);
        this.#search?.unbind();
    }

    #buildTOC() {
        const toc = this.constructor.buildTOC(this.element);
        if (!this.isView || !this.page.title.show || !Object.keys(toc).length) return toc;

        return {
            [CalendarListJournalSheet.#pageTitleTOCPlaceholderSlug]: {
                text: this.page.name,
                level: this.page.title.level,
                slug: CalendarListJournalSheet.#pageTitleTOCPlaceholderSlug,
                children: [],
                order: -1,
            },
            ...toc,
        };
    }

    async _prepareEntries(_context, _options) {
        // Implemented by subclasses when they need to enrich sorted entries.
    }

    async _onRenderEditable(_context, _options) {
        // Optional subclass hook.
    }

    async _afterRegistrationChange() {
        // Optional subclass hook.
    }

    static async #removeEntry(ev, target) {
        const key = target.dataset.key;
        await this.document.update({ [`system.${this.constructor.objectKey}.${key}`]: _del });
    }

    static async #addEntry(ev, target) {
        await this.newEntry();
    }
}