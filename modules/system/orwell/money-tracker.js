import DSA5Payment from "../helpers/payment.js";
import JournalTracker from "./journal_tracker.js";
import { localize } from "../helpers/localizer.js";

export default class MoneyTracker extends JournalTracker {
    static configuration = {
        permission: "enableMoneyTracking",
        flagName: "moneyTrackerId",
        journalName: 'TRACKER.money'
    }

    static startRow() {
        return this.getRow(
            localize('Description'),
            localize('value'),
            localize('Total'),
            'table-title',
        )
    }

    static getRow(description, cost, total, cssClass = '') {
        return `<div class="row-section ${cssClass}">
              <div class="col two">
                  ${description}
              </div>
              <div class="col five center">
                  ${cost}
              </div>
              <div class="col third center">
                  ${total}
              </div>
          </div>`;
    }

    static buildDescription(description) {
        switch (description.type) {
            case 'payment':
                return description.next > description.previous
                    ? localize('PAYMENT.wage')
                    : localize('PAYMENT.wagePaid');
            case 'sheetChange':
                return localize('TRACKER.sheetChange');
            case 'buy':
            case 'sell':
                return `${localize(`MERCHANT.${description.type}`)} (${description.name}${description.amount != 1 ? ` x${description.amount}` : ''})`;
        }
    }

    static async _prepareRow(description, cost, actor) {
        if (!description.next) {
            description.next = DSA5Payment._actorsMoney(actor).sum
        }
        const absCost = Math.abs(cost);
        const sign = cost < 0 ? '-' : '';

        return this.getRow(
            this.buildDescription(description),
            `${sign}${await DSA5Payment._moneyToString(absCost)}`,
            await DSA5Payment._moneyToString(description.next),
        );
    }
}