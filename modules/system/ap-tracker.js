import DSA5_Utility from '../system/utility-dsa5.js';

export default class APTracker {
  static async track(actor, description, apCost) {
    if (game.settings.get('dsa5', 'enableAPTracking') && actor.hasPlayerOwner) {
      let journal = game.journal.find((e) => e.flags.dsa5?.apTrackerId == actor.id);
      if (game.user.isGM || journal?.isOwner) {
        if (!journal) journal = await APTracker.createJournal(actor);

        const page = await APTracker.getPage(journal);
        await APTracker.addEntry(page, actor, description, apCost);
      } else {
        const payload = {
          actorId: actor.id,
          apCost,
        };

        if (description.item?.uuid) {
          payload.uuid = description.item.uuid;
          delete description.item;
        }
        payload.description = description;

        game.socket.emit('system.dsa5', {
          type: 'apTracker',
          payload,
        });
      }
    }
  }

  static async receiveSocketEvent(data) {
    const actor = game.actors.get(data.payload.actorId);
    const description = data.payload.description;

    if (data.payload.uuid) {
      description.item = await fromUuid(data.payload.uuid);
    }

    APTracker.track(actor, description, data.payload.apCost);
  }

  static async addEntry(page, actor, description, apCost) {
    const row = APTracker.getRow(
      this.buildDescription(description),
      `<p>${this.buildChange(description)}</p>`,
      apCost,
      `${actor.system.details.experience.spent}/${actor.system.details.experience.total}`,
    );

    const html = $(page.text.content);
    html.find('.adventurePoints').append(row);

    await page.update({ 'text.content': html.prop('outerHTML') });
  }

  static buildChange(description) {
    if (description.state) {
      return description.state > 0 ? '<em class="fas fa-plus">&nbsp;</em>' : '<em class="fas fa-minus">&nbsp;</em>';
    }

    const symbol = description.next > description.previous ? 'angles-up' : 'angles-down';
    return `${description.previous}&nbsp;<em class="fas fa-${symbol}">&nbsp;</em>&nbsp;${description.next}`;
  }

  static buildDescription(description) {
    switch (description.type) {
      case 'attribute':
        return game.i18n.localize(`CHAR.${description.attr.toUpperCase()}`);
      case 'permanentLoss':
        return `${game.i18n.localize(description.attr)} (${game.i18n.localize('permanentCost')})`;
      case 'point':
        return game.i18n.localize(description.attr);
      case 'item':
        return description.item['toAnchor'] ? description.item.toAnchor().outerHTML : `${game.i18n.localize('TYPES.Item.' + description.item.type)}: ${description.item.name}`;
      case 'sum':
        return game.i18n.localize('MASTER.awardXP');
    }
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

  static async getPage(journal) {
    const name = new Date().toLocaleDateString(game.i18n.lang);
    let page = journal.pages.find((x) => x.name == name);

    if (!page) {
      page = (
        await journal.createEmbeddedDocuments('JournalEntryPage', [
          {
            name: name,
            type: 'text',
            text: {
              format: 1,
              content: `<div><div class="adventurePoints">
                        ${APTracker.getRow(
                          game.i18n.localize('Description'),
                          game.i18n.localize('attributeChange'),
                          game.i18n.localize('cost'),
                          game.i18n.localize('Total'),
                          'table-title',
                        )}
                    </div></div>`,
            },
          },
        ])
      )[0];
    }
    return page;
  }

  static async createJournal(actor) {
    const folder = await DSA5_Utility.getFolderForType('JournalEntry', null, game.i18n.localize('TRACKER.adventurePoints'));

    let journal = game.journal.find((e) => e.flags.dsa5?.apTrackerId == actor.id);

    if (!journal) {
      journal = await JournalEntry.create({
        name: actor.name,
        folder: folder.id,
        ownership: actor.ownership,
        flags: {
          dsa5: {
            apTrackerId: actor.id,
          },
        },
      });
    }
    return journal;
  }
}
