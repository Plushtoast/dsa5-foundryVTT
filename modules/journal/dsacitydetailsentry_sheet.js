import { DSACityDetailsEntry } from '../data/journal/dsacitydetails.js';
import CalendarListJournalSheet from './calendar_list_journal_sheet.js';
import JournalListUx from './journal-list-ux.js';

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
                ...CalendarListJournalSheet.listUxPartials,
            ],
            scrollable: ['', '.scrollable', '.citydetails-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/citydetailsentry_view.hbs',
            templates: [...CalendarListJournalSheet.listUxPartials],
        },
    };

    get listUxDescriptor() {
        const collator = JournalListUx.collator();
        return {
            typeKey: 'city',
            entryHeadingClass: 'citydetails-detail-name',
            searchPlaceholder: 'Book.search',
            addTooltip: 'DSACITYDETAILS.Add',
            ungroupOnSort: 'name',
            editItemSelector: '.citydetails-list-item, .persona-list-item',
            viewItemSelector: '.citydetails-detail-view, .citygen-card',
            editSearch: { selectors: ['.citydetails-list-name, .persona-list-name', '.citydetails-list-meta, .persona-list-meta'] },
            viewSearch: { selectors: ['.citydetails-detail-name, .citygen-card__name', '.citydetails-detail-meta, .citygen-card__meta', '.citydetails-detail-content, .citygen-card__desc'] },
            getGroupInfo: entry => [{
                key: entry.kind || 'merchants',
                label: entry.kindLabel || _loc(DSACityDetailsEntry.KIND_CHOICES[entry.kind] || DSACityDetailsEntry.KIND_CHOICES.merchants),
            }],
            compareGroups: (left, right) => {
                const order = DSACityDetailsEntrySheet.KIND_ORDER;
                const index = value => {
                    const found = order.indexOf(value);
                    return found === -1 ? Number.MAX_SAFE_INTEGER : found;
                };
                return index(left) - index(right);
            },
            compare: (a, b, sort) => {
                if (sort === 'name') return collator.compare(a.name || '', b.name || '');
                return this.constructor.sortEntryPairs([, a], [, b]);
            },
            filters: [{
                key: 'kinds',
                type: 'set',
                icon: 'fa-filter',
                options: () => this.constructor.KIND_ORDER.map(kind => ({
                    key: kind,
                    label: _loc(DSACityDetailsEntry.KIND_CHOICES[kind]),
                })),
                predicate: (entry, uxState) => JournalListUx.isEnabled(uxState.filters?.kinds, entry.dataset.kind),
            }],
            sortModes: [
                { key: 'kind', label: 'JOURNALLIST.sortByKind' },
                { key: 'name', label: 'JOURNALLIST.sortByName' },
            ],
        };
    }

    static sortEntryPairs([, a], [, b]) {
        const kindOrder = this.#sortIndex(this.KIND_ORDER, a.kind) - this.#sortIndex(this.KIND_ORDER, b.kind);
        if (kindOrder) return kindOrder;

        return JournalListUx.collator().compare(a.name || '', b.name || '');
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