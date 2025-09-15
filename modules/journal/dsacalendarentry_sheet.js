import { DSACalendarEntry } from "../data/journal/dsacalendar.js";

export class DSACalendarEntrySheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    #scrollToId;
    #search;

    static DEFAULT_OPTIONS = {
        actions: {
            addCalendarEntry: DSACalendarEntrySheet.#addCalendarEntry,
            removeCalendarEntry: DSACalendarEntrySheet.#removeCalendarEntry,
        }
    };

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/calendarentry_edit.hbs',
            scrollable: [''],
        },
        footer: super.EDIT_PARTS.footer,
    };

    /** @override */
    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/calendarentry_view.hbs',
            templates: ['systems/dsa5/templates/journal/calendarcard.hbs']
        },
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const calendar = game.time.calendar;

        const entries = Object.entries(foundry.utils.duplicate(this.document.system.calendarentries))
            .filter(([key, value]) => value.visible || game.user.isGM)
            .sort(([, a], [, b]) => {
                return a.from.year - b.from.year || a.from.day - b.from.day;
            });
        context.sortedEntries = Object.fromEntries(entries);
        context.yearSuffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        if (this.isView) {
            for (let key of Object.keys(context.sortedEntries)) {
                const entry = context.sortedEntries[key];
                await DSACalendarEntry.prepareCalendarEntry(entry);
            }
        } else {
            context.availableMonths = this.#getLocalizedArray(calendar.months.values, calendar.translationPrefix);
            for (let key of Object.keys(context.sortedEntries)) {
                const entry = context.sortedEntries[key];
                entry.from.max = calendar.months.values[entry.from.month].days + 1;
            }
        }
        context.isRegistered = game.settings.get('dsa5', 'calendarJournals').activated.some(x => x.uuid == this.document.parent.uuid);
        context.isGM = game.user.isGM;
        return context;
    }

    #getLocalizedArray(values, translationPrefix) {
        return values.map((item, index) => {
            return { label: game.i18n.localize(`${translationPrefix}.${item.name}`), value: index };
        });
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
                const settings = game.settings.get('dsa5', 'calendarJournals');
                if (isChecked) {
                    settings.activated.push({ uuid: this.document.parent.uuid, name: this.document.parent.name });
                } else {
                    settings.activated = settings.activated.filter(x => x.uuid !== this.document.parent.uuid);
                }
                game.dsa5.apps.CalendarPicker.constructor.invalidateCache(this.document.parent.uuid);
                game.settings.set('dsa5', 'calendarJournals', settings);
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

    static #addCalendarEntry(ev, target) {
        this.newEntry();
    }

    async newEntry() {
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const id = foundry.utils.randomID();
        this.#scrollToId = id;
        await this.document.update({
            system: {
                calendarentries: {
                    [id]: {
                        title: 'New Entry',
                        from: {
                            dayOfMonth: components.dayOfMonth + 1,
                            month: components.month,
                            year: components.year
                        },
                        category: 0
                    }
                }
            }
        })
    }

    static #removeCalendarEntry(ev, target) {
        const key = target.dataset.key;
        this.document.update({ [`system.calendarentries.-=${key}`]: null });
    }

    _tearDown(options) {
        super._tearDown(options);
        this.#search?.unbind();
    }

    #viewFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll(".event-card")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const title = entry.querySelector('.event-card__title').textContent || '';
            const location = entry.querySelector('.eventlocation')?.textContent || '';
            const description = entry.querySelector('.event-card__desc')?.textContent || '';
            const isMatch = [title, location, description].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    #editFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll("fieldset")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const title = entry.querySelector('[name$=".title"]').value || '';
            const location = entry.querySelector('[name$=".location"]').value || '';
            const description = entry.querySelector('[name$=".content"]').value || '';
            const isMatch = [title, location, description].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    #onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(_event, query, rgx, html) : this.#editFilter(_event, query, rgx, html);
    }
}