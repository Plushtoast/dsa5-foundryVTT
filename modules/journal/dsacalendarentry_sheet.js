import { DSACalendarEntry } from "../data/journal/dsacalendar.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";

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
        return a.from.year - b.from.year || a.from.day - b.from.day;
    }

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/calendarentry_edit.hbs',
            templates: ['systems/dsa5/templates/journal/calendarentry_edit_detail.hbs'],
            scrollable: ['', '.scrollable', '.persona-details-container'],
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

    async _prepareEntries(context, options) {
        const calendar = game.time.calendar;
        context.yearSuffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        for (const key of Object.keys(context.sortedEntries)) {
            const entry = context.sortedEntries[key];
            await DSACalendarEntry.prepareCalendarEntry(entry);
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

    static buildTOC(html, { includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const searchHeadings = container => {
            if (container.classList.contains("event-card__body")) {
                const element = container.querySelector('.event-card__title');
                const node = cls._makeHeadingNode(element, { includeElement });
                const time = container.querySelector('.event-chip');
                if(time) {
                    node.children.push({ level: node.level + 1, text: time.textContent, slug: cls.slugifyHeading(time.textContent), children: [] });
                }
                let parent = stack.at(-1);
                if (node.level <= parent.level) {
                    stack.pop();
                    parent = stack.at(-1);
                }
                parent.children.push(node);
                stack.push(node);
            } else {
                for (const child of (container.children || [])) {
                    searchHeadings(child);
                }
            }            
        };
        if (Array.isArray(html)) html.forEach(searchHeadings);
        else searchHeadings(html);
        return cls._flattenTOC(root.children);
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
        for (const entry of html.querySelectorAll(".event-card")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const title = entry.querySelector('.persona-list-name').textContent || '';
            const location = entry.querySelector('.eventlocation')?.textContent || '';
            const isMatch = [title, location].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(_event, query, rgx, html) : this.#editFilter(_event, query, rgx, html);
    }
}