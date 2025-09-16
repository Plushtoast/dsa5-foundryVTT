import { DSACalendarEntry } from "../data/journal/dsacalendar.js";
import SelectJournal from "./select_journal.js";

export class DSACalendarEntrySheet extends SelectJournal {
    static objectKey = 'calendarentries';
    static DEFAULT_OPTIONS = {
        position: {
            width: 1000,
            height: 700
        },
        includeTOC: true,
    };

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/calendarentry_edit.hbs',
            templates: ['systems/dsa5/templates/journal/calendarentry_edit_detail.hbs'],
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
            if (options.currentKey)
                this.currentKey = options.currentKey;
            
            if (this.currentKey && context.sortedEntries[this.currentKey]) {
                context.currentKey = this.currentKey;
                context.detailHTML = await this.renderDetail(this.currentKey);
            }
        }
        context.isRegistered = game.settings.get('dsa5', DSACalendarEntry.SETTING_NAME).activated.some(x => x.uuid == this.document.parent.uuid);
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

        const showInCalendar = this.element.querySelector('.showInCalendar');
        if (showInCalendar) {
            showInCalendar.addEventListener('change', (event) => {
                const isChecked = event.target.checked;
                const settings = game.settings.get('dsa5', DSACalendarEntry.SETTING_NAME);
                if (isChecked) {
                    settings.activated.push({ uuid: this.document.parent.uuid, name: this.document.parent.name });
                } else {
                    settings.activated = settings.activated.filter(x => x.uuid !== this.document.parent.uuid);
                }
                game.dsa5.apps.CalendarPicker.constructor.invalidateCache(this.document.parent.uuid);
                game.settings.set('dsa5', DSACalendarEntry.SETTING_NAME, settings);
            });
        }        
    }

    static buildTOC(html, { includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const searchHeadings = element => {
            if ((element instanceof HTMLHeadingElement) && element.classList.contains("event-card__title")) {
                const node = cls._makeHeadingNode(element, { includeElement });
                let parent = stack.at(-1);
                if (node.level <= parent.level) {
                    stack.pop();
                    parent = stack.at(-1);
                }
                parent.children.push(node);
                stack.push(node);
            }
            for (const child of (element.children || [])) {
                searchHeadings(child);
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

    onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(_event, query, rgx, html) : this.#editFilter(_event, query, rgx, html);
    }    
}