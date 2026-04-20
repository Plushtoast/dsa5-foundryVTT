
import JournalTracker from './journal_tracker.js';

export default class APTracker extends JournalTracker {
  static configuration = {
    permission: 'enableAPTracking',
    flagName: 'apTrackerId',
    journalName: 'TRACKER.adventurePoints',
    pageType: 'dsaaptracker'
  }

  static async _prepareEntryData(description, cost, actor) {
    return {
      created: Date.now(),
      type: description.type,
      itemUuid: description.item?.uuid || null,
      itemType: description.item?.type || null,
      itemName: description.item?.name || null,
      attr: description.attr || null,
      state: description.state || null,
      previous: description.previous ?? null,
      next: description.next ?? null,
      cost,
      total: `${actor.system.details.experience.spent}/${actor.system.details.experience.total}`,
    };
  }

  static _buildChange(description) {
    if (description.state) {
      return description.state > 0 ? '<em class="fas fa-plus">&nbsp;</em>' : '<em class="fas fa-minus">&nbsp;</em>';
    }

    const symbol = description.next > description.previous ? 'angles-up' : 'angles-down';
    return `${description.previous}&nbsp;<em class="fas fa-${symbol}">&nbsp;</em>&nbsp;${description.next}`;
  }

  static _buildDescription(description) {
    switch (description.type) {
      case 'attribute':
        return _loc(`CHAR.${description.attr.toUpperCase()}`);
      case 'permanentLoss':
        return `${_loc(description.attr)} (${_loc('permanentCost')})`;
      case 'point':
        return _loc(description.attr);
      case 'item':
        return description.item['toAnchor'] ? description.item.toAnchor().outerHTML : `${_loc('TYPES.Item.' + description.item.type)}: ${description.item.name}`;
      case 'sum':
        return _loc('MASTER.awardXP');
    }
  }
}
