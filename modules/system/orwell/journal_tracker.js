import DSA5_Utility from '../helpers/utility-dsa5.js';

export default class JournalTracker {
    static get config() {
        return this.configuration;
    }

    static async track(actor, description, cost) {
        if (game.settings.get('dsa5', this.config.permission) && actor.hasPlayerOwner) {
            let journal = game.journal.find((e) => foundry.utils.getProperty(e.flags, `dsa5.${this.config.flagName}`) == actor.id);
            const hasActiveGM = game.users?.some((user) => user.active && user.isGM);
            const canCreateJournal = game.user?.can?.('JOURNAL_CREATE');

            if (game.user.isGM || journal?.isOwner || (!hasActiveGM && canCreateJournal)) {
                if (!journal) journal = await this.createJournal(actor);
                else await this.updateJournalName(actor);

                const page = await this.getPage(journal);
                await this.addEntry(page, actor, description, cost);
            } else {
                if (!hasActiveGM) {
                    ui.notifications?.warn(_loc('TRACKER.requiresGM'));
                    return;
                }
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
        const folder = await DSA5_Utility.getFolderForType('JournalEntry', null, _loc(this.config.journalName));

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

    static async updateJournalName(actor) {
        const journal = game.journal.find((e) => foundry.utils.getProperty(e.flags, `dsa5.${this.config.flagName}`) == actor.id);
        if (!journal) return;
        if (journal.name === actor.name) return;
        if (game.user.isGM || journal.isOwner) {
            await journal.update({ name: actor.name });
        }
    }

    static async getPage(journal) {
        const name = new Date().toLocaleDateString(game.i18n.lang);
        let page = journal.pages.find((x) => x.name == name && x.type === this.config.pageType);

        if (!page) {
            let pageName = name;
            if (journal.pages.some((x) => x.name === pageName)) {
                pageName = `${name} (${_loc(this.config.journalName)})`;
            }
            page = (
                await journal.createEmbeddedDocuments('JournalEntryPage', [
                    {
                        name: pageName,
                        type: this.config.pageType,
                        system: {
                            entries: {},
                        },
                    },
                ])
            )[0];
        }
        return page;
    }

    static async addEntry(page, actor, description, cost) {
        const entry = await this._prepareEntryData(description, cost, actor);
        const key = foundry.utils.randomID();
        await page.update({ [`system.entries.${key}`]: entry });
    }

    static async _prepareEntryData(description, cost, actor) {
        throw new Error('Method not implemented');
    }
}