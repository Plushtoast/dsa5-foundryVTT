import { DSAPersonaEntry } from "../data/journal/dsapersonaedramatis.js";
import { PersonaeDramatis } from "../system/calendar/personaedramatis.js";
import SelectJournal from "./select_journal.js";

export class DSAPersonaeEntrySheet extends SelectJournal {
    static objectKey = 'personae';
    static DEFAULT_OPTIONS = {
        actions: {
            editActor: DSAPersonaeEntrySheet.#editActor,
            showSheet: DSAPersonaeEntrySheet.#showSheet,
        },
        position: {
            width: 960,
            height: 700
        },
    };

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/personaentry_edit.hbs',
            scrollable: ['', 'scrollable'],
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
        } else {
            if (options.currentKey)
                this.currentKey = options.currentKey;

            if (this.currentKey && context.sortedEntries[this.currentKey]) {
                context.currentKey = this.currentKey;
                context.detailHTML = await this.renderDetail(this.currentKey);
            }
        }
        context.isGM = game.user.isGM;
        context.isRegistered = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME).activated.some(x => x.uuid == this.document.parent.uuid);
        return context;
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

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
    }

    static buildTOC(html, { includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const searchHeadings = element => {
            if ((element instanceof HTMLHeadingElement) && element.classList.contains("persona-detail-name")) {
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
        const id = foundry.utils.randomID();
        this.currentKey = id;
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

    onSearchFilter(_event, query, rgx, html) {
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
        for (const entry of html.querySelectorAll(".persona-list-item")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const name = entry.querySelector('.persona-list-name').textContent || '';

            const isMatch = [name].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    async renderDetail(key) {
        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/journal/personaentry_edit_detail.hbs', {
            elem: this.document.system.personae[key],
            document: this.document,
            isGM: game.user.isGM,
            key
        });
    }

    static #editActor(event, target) {
        PersonaeDramatis.editActor(event, target, { stay: true });
    }

    static #showSheet(event, target) {
        PersonaeDramatis.showSheet(event, target, { stay: true });
    }
}