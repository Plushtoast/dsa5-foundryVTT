import { DSACalendarEntry } from "../data/journal/dsacalendar.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";
import JournalListUx from "./journal-list-ux.js";

export class DSACalendarEntrySheet extends CalendarListJournalSheet {
    static objectKey = 'calendarentries';
    static settingName = DSACalendarEntry.SETTING_NAME;
    static DEFAULT_OPTIONS = {
        position: {
            width: 1000,
            height: 700
        },
    };

    static sortEntryPairs([, a], [, b]) {
        return (a.from?.year - b.from?.year) || (a.from?.day - b.from?.day);
    }

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/calendarentry_edit.hbs',
            templates: ['systems/dsa5/templates/journal/calendarentry_edit_detail.hbs', ...CalendarListJournalSheet.listUxPartials],
            scrollable: ['', '.scrollable', '.persona-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    /** @override */
    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/calendarentry_view.hbs',
            templates: ['systems/dsa5/templates/journal/calendarcard.hbs', ...CalendarListJournalSheet.listUxPartials]
        },
    };

    get listUxDescriptor() {
        const collator = JournalListUx.collator();
        const yearSuffix = game.time.calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        return {
            typeKey: 'events',
            entryHeadingClass: 'event-card__title',
            searchPlaceholder: 'Book.search',
            addTooltip: 'dsacalendar.createEvent',
            ungroupOnSort: 'name',
            editItemSelector: '.persona-list-item',
            viewItemSelector: '.event-card',
            editSearch: { selectors: ['.persona-list-name', '.eventlocation'], datasetKeys: ['searchText'] },
            viewSearch: { selectors: ['.event-card__title', '.eventlocation', '.event-card__desc'] },
            getGroupInfo: entry => {
                const year = entry.from?.year ?? 0;
                const month = entry.from?.month ?? 0;
                const label = [entry.from?.monthLong, year, yearSuffix].filter(Boolean).join(' ');
                return [{ key: `${year}-${month}`, label }];
            },
            compareGroups: (left, right) => {
                const [leftYear, leftMonth] = left.split('-').map(Number);
                const [rightYear, rightMonth] = right.split('-').map(Number);
                return (leftYear - rightYear) || (leftMonth - rightMonth);
            },
            compare: (a, b, sort) => {
                if (sort === 'name') return collator.compare(a.title || '', b.title || '');
                return this.constructor.sortEntryPairs([, a], [, b]);
            },
            filters: [{
                key: 'categories',
                type: 'set',
                icon: 'fa-filter',
                options: () => Object.entries(DSACalendarEntry.CATEGORY_CHOICES).map(([key, label]) => ({
                    key: String(key),
                    label: _loc(label),
                    icon: DSACalendarEntry.CATEGORY_ICONS[key],
                })),
                predicate: (entry, uxState) => JournalListUx.isEnabled(uxState.filters?.categories, entry.dataset.category),
            }],
            sortModes: [
                { key: 'date', label: 'JOURNALLIST.sortByDate' },
                { key: 'name', label: 'JOURNALLIST.sortByName' },
            ],
        };
    }

    async _prepareEntries(context, options) {
        const calendar = game.time.calendar;
        context.yearSuffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        for (const key of Object.keys(context.sortedEntries)) {
            const entry = context.sortedEntries[key];
            await DSACalendarEntry.prepareCalendarEntry(entry);
            entry.calendarKey = key;
            entry.uuid = this.document.uuid;
            entry.juuid = this.document.parent?.uuid;
            entry.yearSuffix = context.yearSuffix;
            entry.isOwner = this.document.isOwner;
        }
    }

    #getLocalizedArray(values, translationPrefix) {
        return values.map((item, index) => {
            return { label: _loc(`${translationPrefix}.${item.name}`), value: index };
        });
    }

    async _afterRegistrationChange() {
        game.dsa5.apps.CalendarPicker.constructor.invalidateCache(this.document.parent.uuid);
        await game.dsa5?.apps?.CalendarPicker?.refreshParts?.(['events', 'config']);
    }

    async newEntry() {
        const components = game.time.calendar.timeToComponents(game.time.worldTime);
        const id = foundry.utils.randomID();
        this.currentKey = id;
        await this.document.update({
            system: {
                calendarentries: {
                    [id]: DSACalendarEntry.createEntryData(components)
                }
            }
        })
    }

    async renderDetail(key) {
        const calendar = game.time.calendar;
        const elem = this.document.system.calendarentries[key];
        const availableMonths = this.#getLocalizedArray(calendar.months.values, calendar.translationPrefix);
        elem.from.max = calendar.months.values[elem.from.month].days + 1;

        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/journal/calendarentry_edit_detail.hbs', {
            elem,
            document: this.document,
            isGM: game.user.isGM,
            key,
            availableMonths,
            yearSuffix: calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix)
        });
    }

}