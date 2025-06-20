import DSA5_Utility from '../helpers/utility-dsa5.js';

export default class JournalTracker {
    static get config() {
        return this.configuration;
    }

    static async track(actor, description, cost) {
        if (game.settings.get('dsa5', this.config.permission) && actor.hasPlayerOwner) {
            let journal = game.journal.find((e) => foundry.utils.getProperty(e.flags, `dsa5.${this.config.flagName}`) == actor.id);

            if (game.user.isGM || journal?.isOwner) {
                if (!journal) journal = await this.createJournal(actor);

                const page = await this.getPage(journal);
                await this.addEntry(page, actor, description, cost);
            } else {
                const payload = {
                    actorId: actor.id,
                    cost,
                };

                if (description.item?.uuid) {
                    payload.uuid = description.item.uuid;
                    delete description.item;
                }
                payload.description = description;

                game.socket.emit('system.dsa5', {
                    type: this.config.flagName,
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

        this.track(actor, description, data.payload.cost);
    }

    static async createJournal(actor) {
        const folder = await DSA5_Utility.getFolderForType('JournalEntry', null, game.i18n.localize(this.config.journalName));

        let journal = game.journal.find((e) => foundry.utils.getProperty(e.flags, `dsa5.${this.config.flagName}`) == actor.id);

        if (!journal) {
            journal = await JournalEntry.create({
                name: actor.name,
                folder: folder.id,
                ownership: actor.ownership,
                flags: {
                    dsa5: {
                        [this.config.flagName]: actor.id,
                    },
                },
            });
        }
        return journal;
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
                        ${this.startRow()}
                    </div></div>`,
                        },
                    },
                ])
            )[0];
        }
        return page;
    }

    static async addEntry(page, actor, description, cost) {
        const row = await this._prepareRow(description, cost, actor);

        const html = $(page.text.content);
        html.find('.adventurePoints').append(row);

        await page.update({ 'text.content': html.prop('outerHTML') });
    }

    static getRow() {
        throw new Error('Method not implemented');
    }

    static startRow() {
        throw new Error('Method not implemented');
    }

    static async _prepareRow(description, cost, actor) {
        throw new Error('Method not implemented');
    }
}