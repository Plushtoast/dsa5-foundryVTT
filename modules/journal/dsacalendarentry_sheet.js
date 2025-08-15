import { DSACalendarEntry } from "../data/journal/dsacalendar.js";

export class DSACalendarEntrySheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    #scrollToId;

    static DEFAULT_OPTIONS = {
        actions: {
            addCalendarEntry: DSACalendarEntrySheet.#addCalendarEntry,
            removeCalendarEntry: DSACalendarEntrySheet.#removeCalendarEntry
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

    async _prepareContext(_options) {
        const context = await super._prepareContext(_options);
        const calendar = game.time.calendar;

        const entries = Object.entries(foundry.utils.duplicate(this.document.system.calendarentries))
            .filter(x => x.visible || game.user.isGM)
            .sort(([, a], [, b]) => {
                return a.from.year - b.from.year || a.from.day - b.from.day;
            });
        context.sortedEntries = Object.fromEntries(entries);
        context.yearSuffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        if (this.isView) {
            for (let key of Object.keys(context.sortedEntries)) {
                const entry = context.sortedEntries[key];
                DSACalendarEntry.prepareCalendarEntry(entry);
            }
        } else {
            context.availableMonths = this.#getLocalizedArray(calendar.months.values, calendar.translationPrefix);
            for (let key of Object.keys(context.sortedEntries)) {
                const entry = context.sortedEntries[key];
                entry.from.max = calendar.months.values[entry.from.month].days + 1;
            }
        }
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

        if(this.#scrollToId) {
            this.element.querySelector(`[data-id="${this.#scrollToId}"]`)?.scrollIntoView({ behavior: "smooth" });
            this.#scrollToId = null;
        }
    }

    static #addCalendarEntry(ev, target) {
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const id = foundry.utils.randomID();
        this.#scrollToId = id;
        this.document.update({
            system: {
                calendarentries: {
                    [id]: {
                        title: 'New Entry',
                        from: {
                            dayOfMonth: components.dayOfMonth + 1,
                            month: components.month,
                            year: components.year
                        }
                    }
                }
            }
        })
    }

    static #removeCalendarEntry(ev, target) {
        const key = target.dataset.key;
        this.document.update({ [`system.calendarentries.-=${key}`]: null });
    }
}