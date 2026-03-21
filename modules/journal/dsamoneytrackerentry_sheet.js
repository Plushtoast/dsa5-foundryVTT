import MoneyTracker from '../system/orwell/money-tracker.js';
import DSA5Payment from '../system/payment/payment.js';

export class DSAMoneyTrackerEntrySheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    static TRACKER_FLAG = 'moneyTrackerId';

    static DEFAULT_OPTIONS = {
        actions: {
            deleteEntry: DSAMoneyTrackerEntrySheet.#deleteEntry,
        },
        position: {
            width: 700,
            height: 700,
        },
    };

    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/moneytracker_view.hbs'
        }
    };

    static EDIT_PARTS = {
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/moneytracker_edit.hbs',
            scrollable: ['', '.scrollable']
        }
    };

    get isEditable() {
        return game.user.isGM;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const entries = foundry.utils.duplicate(this.document.system.entries || {});
        const entryRows = Object.entries(entries)
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
        context.rows = await Promise.all(entryRows.map(async (entry) => {
            const costValue = Number(entry.cost);
            const totalValue = Number.isFinite(Number(entry.total)) ? Number(entry.total) : Number(entry.next) || 0;
            const safeCost = Number.isFinite(costValue) ? costValue : 0;
            const absCost = Math.abs(safeCost);
            const sign = safeCost < 0 ? '-' : '';
            return {
                description: MoneyTracker.buildDescription(entry),
                costHtml: `${sign}${await DSA5Payment._moneyToString(absCost)}`,
                totalHtml: await DSA5Payment._moneyToString(totalValue),
            };
        }));
        context.editRows = entryRows;
        context.isGM = game.user.isGM;
        return context;
    }

    static #deleteEntry(event, target) {
        const key = target.dataset.key;
        if (!key) return;
        this.document.update({ [`system.entries.${key}`]: _del });
    }
}
