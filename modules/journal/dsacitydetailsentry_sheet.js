import { DSACityDetailsEntry } from '../data/journal/dsacitydetails.js';
import CalendarListJournalSheet from './calendar_list_journal_sheet.js';

export class DSACityDetailsEntrySheet extends CalendarListJournalSheet {
    static objectKey = 'details';

    static KIND_ORDER = ['temples', 'inns', 'taverns', 'crafts', 'merchants', 'services', 'healers', 'travellers'];

    static DEFAULT_OPTIONS = {
        actions: {
            duplicateEntry: this.#duplicateEntry,
        },
        position: {
            width: 1000,
            height: 700,
        },
    };

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/citydetailsentry_edit.hbs',
            templates: [
                'systems/dsa5/templates/journal/citydetailsentry_edit_detail.hbs',
            ],
            scrollable: ['', '.scrollable', '.citydetails-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/citydetailsentry_view.hbs',
            templates: [],
        },
    };

    static sortEntryPairs([, a], [, b]) {
        const kindOrder = this.#sortIndex(this.KIND_ORDER, a.kind) - this.#sortIndex(this.KIND_ORDER, b.kind);
        if (kindOrder) return kindOrder;

        return (a.name || '').localeCompare(b.name || '', game.i18n?.lang, { sensitivity: 'base' });
    }

    static buildTOC(html, { includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const searchHeadings = element => {
            if ((element instanceof HTMLHeadingElement) && element.classList.contains('citydetails-detail-name')) {
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

    static #sortIndex(order, value) {
        const index = order.indexOf(value);
        return index === -1 ? Number.MAX_SAFE_INTEGER : index;
    }

    async _prepareEntries(context, _options) {
        for (const [detailKey, entry] of Object.entries(context.sortedEntries)) {
            await DSACityDetailsEntry.prepareCityDetail(entry, { page: this.document, key: detailKey });
            entry.detailKey = detailKey;
            entry.detailUuid = this.document.uuid;
        }
    }

    async newEntry(options = {}) {
        const id = foundry.utils.randomID();
        this.currentKey = id;
        await this.document.update({
            system: {
                details: {
                    [id]: DSACityDetailsEntry.createEntryData(options),
                },
            },
        });
    }

    onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(query, rgx, html) : this.#editFilter(query, rgx, html);
    }

    #viewFilter(query, rgx, html) {
        for (const entry of html.querySelectorAll('.citydetails-detail-view, .citygen-card')) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const name = entry.querySelector('.citydetails-detail-name, .citygen-card__name')?.textContent || '';
            const meta = entry.querySelector('.citydetails-detail-meta, .citygen-card__meta')?.textContent || '';
            const content = entry.querySelector('.citydetails-detail-content, .citygen-card__desc')?.textContent || '';
            const isMatch = [name, meta, content].some(text => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(text)));
            entry.hidden = !isMatch;
        }
    }

    #editFilter(query, rgx, html) {
        for (const entry of html.querySelectorAll('.citydetails-list-item, .persona-list-item')) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const name = entry.querySelector('.citydetails-list-name, .persona-list-name')?.textContent || '';
            const meta = entry.querySelector('.citydetails-list-meta, .persona-list-meta')?.textContent || '';
            const isMatch = [name, meta].some(text => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(text)));
            entry.hidden = !isMatch;
        }
    }

    async renderDetail(key) {
        const detail = foundry.utils.duplicate(this.document.system.details[key] || {});
        await DSACityDetailsEntry.prepareCityDetail(detail, { page: this.document, key });
        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/journal/citydetailsentry_edit_detail.hbs', {
            elem: detail,
            key,
            isGM: game.user.isGM,
            document: this.document,
        });
    }

    static async #duplicateEntry(_event, target) {
        const key = target.dataset.key;
        const detail = this.document.system.details[key];
        if (!detail) return;

        const id = foundry.utils.randomID();
        this.currentKey = id;
        await this.document.update({
            [`system.details.${id}`]: DSACityDetailsEntry.createEntryData(foundry.utils.duplicate(detail)),
        });
    }
}