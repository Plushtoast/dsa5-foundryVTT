import { DSAPersonaEntry } from "../data/journal/dsapersonaedramatis.js";
import { PersonaeDramatis } from "../system/calendar/personaedramatis.js";

export class DSAPersonaeEntrySheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    #scrollToId;
    #search;

    static DEFAULT_OPTIONS = {
        actions: {
            addPersonaEntry: DSAPersonaeEntrySheet.#addPersonaEntry,
            removePersonaEntry: DSAPersonaeEntrySheet.#removePersonaEntry,
            editActor: DSAPersonaeEntrySheet.#editActor,
            showSheet: DSAPersonaeEntrySheet.#showSheet,
            toggleVisibility: DSAPersonaeEntrySheet.#toggleVisibility,
        }
    };

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/personaentry_edit.hbs',
            scrollable: [''],
        },
        footer: super.EDIT_PARTS.footer,
    };

    /** @override */
    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/personaentry_view.hbs',
            templates: ['systems/dsa5/templates/system/calendar/persona-detail.hbs']
        },
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);

        const entries = Object.entries(foundry.utils.duplicate(this.document.system.personae))
            .filter(([key, value]) => value.visible || game.user.isGM)
            .sort(([, a], [, b]) => {
                return a.name.localeCompare(b.name);
            });
        context.sortedEntries = Object.fromEntries(entries);
        if (this.isView) {
            for (let key of Object.keys(context.sortedEntries)) {
                const entry = context.sortedEntries[key];
                await DSAPersonaEntry.preparePersonaEntry(entry, this.document, key);
            }
        }
        context.isGM = game.user.isGM;
        context.isRegistered = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME).activated.some(x => x.uuid == this.document.parent.uuid);
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        if (this.#scrollToId) {
            this.element.querySelector(`[data-id="${this.#scrollToId}"]`)?.scrollIntoView({ behavior: "smooth" });
            this.#scrollToId = null;
        }

        const showInCalendar = this.element.querySelector('.showInCalendar');
        if (showInCalendar) {
            showInCalendar.addEventListener('change', (event) => {
                const isChecked = event.target.checked;
                const settings = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME);
                if (isChecked) {
                    settings.activated.push({ uuid: this.document.parent.uuid, name: this.document.parent.name });
                } else {
                    settings.activated = settings.activated.filter(x => x.uuid !== this.document.parent.uuid);
                }
                game.dsa5.apps.CalendarPicker.constructor.invalidateCache(this.document.parent.uuid);
                game.settings.set('dsa5', DSAPersonaEntry.SETTING_NAME, settings);
            });
        }

        this.#search ??= new foundry.applications.ux.SearchFilter({
            inputSelector: "input[type=search]",
            contentSelector: ".eventscontainer",
            callback: this.#onSearchFilter.bind(this)
        });
        if (options.search) {
            this.#search.query = options.search;
            options.search = null;
        }
        this.#search.bind(this.element);
    }

    static #addPersonaEntry(event, target) {
        this.newEntry();
    }

    static #removePersonaEntry(event, target) {
        const key = target.dataset.key;
        this.document.update({ [`system.personae.-=${key}`]: null });
    }

    async newEntry() {
        const id = foundry.utils.randomID();
        this.#scrollToId = id;
        await this.document.update({
            system: {
                personae: {
                    [id]: {
                        name: 'New Entry',
                        type: 0
                    }
                }
            }
        })
    }

    _tearDown(options) {
        super._tearDown(options);
        this.#search?.unbind();
    }

    #onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(_event, query, rgx, html) : this.#editFilter(_event, query, rgx, html);
    }

    #viewFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll(".persona-detail-view")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const name = entry.querySelector('.persona-detail-name').textContent || '';

            const isMatch = [name].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    #editFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll("fieldset")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const name = entry.querySelector('[name$=".name"]').value || '';

            const isMatch = [name].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    static #editActor(event, target) {
        PersonaeDramatis.editActor(event, target, { stay: true });
    }

    static #showSheet(event, target) {
        PersonaeDramatis.showSheet(event, target, { stay: true });
    }

    static #toggleVisibility(event, target) {
        PersonaeDramatis.toggleVisibility(event, target);
    }
}