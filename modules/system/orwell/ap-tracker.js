
import JournalTracker from './journal_tracker.js';
import { localize } from '../helpers/localizer.js';

export default class APTracker extends JournalTracker {
  static configuration = {
    permission: 'enableAPTracking',
    flagName: 'apTrackerId',
    journalName: 'TRACKER.adventurePoints'
  }

  static async _prepareRow(description, cost, actor) {
    return this.getRow(
      this._buildDescription(description),
      `<p>${this._buildChange(description)}</p>`,
      cost,
      `${actor.system.details.experience.spent}/${actor.system.details.experience.total}`,
    );
  }

  static _buildChange(description) {
    if (description.state) {
      return description.state > 0 ? '<em class="fas fa-plus">&nbsp;</em>' : '<em class="fas fa-minus">&nbsp;</em>';
    }

    const symbol = description.next > description.previous ? 'angles-up' : 'angles-down';
    return `${description.previous}&nbsp;<em class="fas fa-${symbol}">&nbsp;</em>&nbsp;${description.next}`;
  }

  static getRow(description, change, cost, total, cssClass = '') {
    return `<div class="row-section ${cssClass}">
              <div class="col fourty">
                  ${description}
              </div>
              <div class="col third center">
                  ${change}
              </div>
              <div class="col ten center">
                  ${cost}
              </div>
              <div class="col five center">
                  ${total}
              </div>
          </div>`;
  }

  static startRow() {
    return this.getRow(
      localize('Description'),
      localize('attributeChange'),
      localize('cost'),
      localize('Total'),
      'table-title',
    )
  }

  static _buildDescription(description) {
    switch (description.type) {
      case 'attribute':
        return localize(`CHAR.${description.attr.toUpperCase()}`);
      case 'permanentLoss':
        return `${localize(description.attr)} (${localize('permanentCost')})`;
      case 'point':
        return localize(description.attr);
      case 'item':
        return description.item['toAnchor'] ? description.item.toAnchor().outerHTML : `${localize('TYPES.Item.' + description.item.type)}: ${description.item.name}`;
      case 'sum':
        return localize('MASTER.awardXP');
    }
  }
}
