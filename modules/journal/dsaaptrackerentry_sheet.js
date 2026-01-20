export class DSAAPTrackerEntrySheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    static TRACKER_FLAG = 'apTrackerId';

    static DEFAULT_OPTIONS = {
        actions: {
            deleteEntry: DSAAPTrackerEntrySheet.#deleteEntry,
        },
        position: {
            width: 700,
            height: 700,
        },
    };

    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/aptracker_view.hbs'
        }
    };

    static EDIT_PARTS = {
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/aptracker_edit.hbs',
            scrollable: ['', '.scrollable']
        }
    };

    get isEditable() {
        return game.user.isGM;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const entries = foundry.utils.duplicate(this.document.system.entries || {});
        const rows = Object.entries(entries)
            .map(([key, entry]) => ({
                key,
                ...entry,
            }))
            .sort((a, b) => (a.created || 0) - (b.created || 0));
        const actorId = foundry.utils.getProperty(this.document.parent?.flags, `dsa5.${this.constructor.TRACKER_FLAG}`);
        if (actorId) {
            const actor = game.actors.get(actorId);
            if (actor) {
                context.actorHeader = {
                    uuid: actor.uuid,
                    img: actor.img,
                    name: actor.name,
                    link: actor.toAnchor().outerHTML,
                    subtitle: actor.type === 'creature' ? (actor.system.creatureClass?.value || '') : (actor.system.details?.career?.value || '')
                };
            }
        }
        context.rows = await Promise.all(rows.map(async (entry) => {
            let descriptionHtml = '';
            switch (entry.type) {
                case 'attribute':
                    descriptionHtml = game.i18n.localize(`CHAR.${(entry.attr || '').toUpperCase()}`);
                    break;
                case 'permanentLoss':
                    descriptionHtml = `${game.i18n.localize(entry.attr || '')} (${game.i18n.localize('permanentCost')})`;
                    break;
                case 'point':
                    descriptionHtml = game.i18n.localize(entry.attr || '');
                    break;
                case 'item':
                    if (entry.itemUuid) {
                        const item = await fromUuid(entry.itemUuid);
                        descriptionHtml = item?.toAnchor ? item.toAnchor().outerHTML : `${game.i18n.localize('TYPES.Item.' + (entry.itemType || ''))}: ${entry.itemName || ''}`;
                    } else {
                        descriptionHtml = `${game.i18n.localize('TYPES.Item.' + (entry.itemType || ''))}: ${entry.itemName || ''}`;
                    }
                    break;
                case 'sum':
                    descriptionHtml = game.i18n.localize('MASTER.awardXP');
                    break;
                default:
                    descriptionHtml = '';
            }

            let changeHtml = '';
            if (entry.state) {
                changeHtml = entry.state > 0 ? '<em class="fas fa-plus">&nbsp;</em>' : '<em class="fas fa-minus">&nbsp;</em>';
            } else if (entry.previous !== null && entry.next !== null) {
                const symbol = entry.next > entry.previous ? 'angles-up' : 'angles-down';
                changeHtml = `${entry.previous}&nbsp;<em class="fas fa-${symbol}">&nbsp;</em>&nbsp;${entry.next}`;
            }

            return {
                ...entry,
                descriptionHtml,
                changeHtml: `<p>${changeHtml}</p>`
            };
        }));
        context.editRows = rows;
        context.isGM = game.user.isGM;
        return context;
    }

    static #deleteEntry(event, target) {
        const key = target.dataset.key;
        if (!key) return;
        this.document.update({ [`system.entries.-=${key}`]: null });
    }
}
