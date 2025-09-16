import { PersonaeDramatis } from "../system/calendar/personaedramatis.js";

export default class SelectJournal extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {   
    #search;

    static DEFAULT_OPTIONS = {
        actions: {
            selectEntry: SelectJournal.#selectEntry,
            toggleVisibility: SelectJournal.#toggleVisibility,
            removeEntry: SelectJournal.#removeEntry,
            addEntry: SelectJournal.#addEntry,
        },
        position: {
            width: 1000,
            height: 700
        },
        includeTOC: true,
    };

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
        if (this.options.includeTOC) this.toc = this.constructor.buildTOC(this.element);
    }

    static #toggleVisibility(ev, target) {
        const key = target.dataset.key;
        const entry = this.document.system[this.constructor.objectKey][key];
        if (!entry) return;
        this.document.update({ [`system.${this.constructor.objectKey}.${key}.visible`]: !entry.visible });
    }

    static async #selectEntry(event, target) {
        const detailsContainer = this.element.querySelector('.persona-details-container');
        if (!detailsContainer) return;

        const key = target.dataset.key;
        this.currentKey = key;

        if (!key) return;

        PersonaeDramatis.updateSelectionUI(target);

        detailsContainer.innerHTML = await this.renderDetail(key);
    }

    _tearDown(options) {
        super._tearDown(options);
        this.#search?.unbind();
    }

    static #removeEntry(ev, target) {
        const key = target.dataset.key;
        this.document.update({ [`system.${this.constructor.objectKey}.-=${key}`]: null });
    }

    static #addEntry(ev, target) {
        this.newEntry();
    }
}