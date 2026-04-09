import DSA5Payment from "../payment/payment.js";
import JournalTracker from "./journal_tracker.js";

export default class MoneyTracker extends JournalTracker {
    static configuration = {
        permission: "enableMoneyTracking",
        flagName: "moneyTrackerId",
        journalName: 'TRACKER.money',
        pageType: 'dsamoneytracker'
    }

    static buildDescription(description) {
        switch (description.type) {
            case 'payment':
                return description.next > description.previous
                    ? _loc('PAYMENT.wage')
                    : _loc('PAYMENT.wagePaid');
            case 'sheetChange':
                return _loc('TRACKER.sheetChange');
            case 'buy':
            case 'sell':
                return `${_loc(`MERCHANT.${description.type}`)} (${description.name}${description.amount != 1 ? ` x${description.amount}` : ''})`;
        }
    }

    static async _prepareEntryData(description, cost, actor) {
        if (!description.next) {
            description.next = DSA5Payment._actorsMoney(actor).sum
        }
        return {
            created: Date.now(),
            type: description.type,
            name: description.name || '',
            amount: description.amount || 1,
            previous: description.previous ?? null,
            next: description.next ?? null,
            cost,
            total: description.next ?? null,
        };
    }
}