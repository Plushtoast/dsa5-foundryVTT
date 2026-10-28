import { DSAPersonaEntry } from "../data/journal/dsapersonaedramatis.js";
import { PersonaeDramatis } from "../system/calendar/personaedramatis.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";
import JournalListUx from "./journal-list-ux.js";

export class DSAPersonaeEntrySheet extends CalendarListJournalSheet {
    static objectKey = 'personae';
    static settingName = DSAPersonaEntry.SETTING_NAME;
    static DEFAULT_OPTIONS = {
        actions: {
            editActor: DSAPersonaeEntrySheet.#editActor,
            showSheet: DSAPersonaeEntrySheet.#showSheet,
            copyActorDescription: DSAPersonaeEntrySheet.#copyActorDescription,
            copyToken: DSAPersonaeEntrySheet.#copyToken,
            copyAvatar: DSAPersonaeEntrySheet.#copyAvatar,
        },
        position: {
            width: 960,
            height: 700
        },
    };

    static sortEntryPairs([, a], [, b]) {
        return JournalListUx.collator().compare(a.name || '', b.name || '');
    }

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/personaentry_edit.hbs',
            templates: [...CalendarListJournalSheet.listUxPartials],
            scrollable: ['', '.scrollable', '.persona-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    /** @override */
    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/personaentry_view.hbs',
            templates: ['systems/dsa5/templates/system/calendar/persona-detail.hbs', ...CalendarListJournalSheet.listUxPartials]
        },
    };

    get listUxDescriptor() {
        const unknownFaction = _loc('PERSONAE.UnknownFaction');
        const collator = JournalListUx.collator();
        return {
            typeKey: 'personae',
            entryHeadingClass: 'persona-detail-name',
            searchPlaceholder: 'Book.search',
            addTooltip: 'PERSONAE.Add',
            uniqueFirstInView: true,
            editItemSelector: '.persona-list-item',
            viewItemSelector: '.journal-list-entry',
            editSearch: {
                selectors: ['.persona-list-name', '.persona-list-meta'],
                datasetKeys: ['personaFactions', 'personaTags'],
            },
            viewSearch: {
                selectors: ['.persona-detail-name', '.persona-detail-subtitle', '.persona-detail-type'],
                datasetKeys: ['personaFactions', 'personaTags'],
            },
            getGroupInfo: entry => DSAPersonaEntry.parseFactions(entry.faction, unknownFaction).map(faction => ({ key: faction, label: faction })),
            compareGroups: (left, right) => {
                if (left === unknownFaction) return 1;
                if (right === unknownFaction) return -1;
                return collator.compare(left, right);
            },
            compare: (a, b) => collator.compare(a.name || '', b.name || ''),
            filters: [
                {
                    key: 'important',
                    label: 'PERSONAE.filterImportant',
                    icon: 'fa-star',
                    predicate: entry => entry.dataset.personaImportant === 'true',
                },
                {
                    key: 'visible',
                    label: 'PERSONAE.filterVisible',
                    icon: 'fa-eye',
                    gmOnly: true,
                    predicate: entry => entry.dataset.personaVisible === 'true',
                },
                {
                    key: 'hideEmptyFields',
                    label: 'PERSONAE.filterHideEmptyFields',
                    icon: 'fa-compress',
                    rerender: true,
                    predicate: () => true,
                },
            ],
            sortModes: [
                { key: 'name', label: 'JOURNALLIST.sortByName' },
            ],
        };
    }

    async _prepareEntries(context, options) {
        const heros = this.isView ? await DSAPersonaEntry.getHeros() : null;
        const unknownFaction = _loc('PERSONAE.UnknownFaction');
        for (const key of Object.keys(context.sortedEntries)) {
            const entry = context.sortedEntries[key];
            const actor = entry.actor_uuid ? await fromUuid(entry.actor_uuid) : null;
            entry.garadan = this.isView ? DSAPersonaEntry.resolveGaradan(entry, actor) : DSAPersonaEntry.resolveGaradan(entry);
            entry.garadanClass = DSAPersonaEntry.shouldShowGaradan(entry, { isGM: context.isGM }) ? DSAPersonaEntry.GARADAN_CLASSES[entry.garadan] || '' : '';
            entry.uuid = this.document.uuid;
            entry.preparedFactions = DSAPersonaEntry.parseFactions(entry.faction, unknownFaction);

            if (this.isView) {
                await DSAPersonaEntry.preparePersonaEntry(entry, this.document, key, heros);
            }
        }
    }

    async _prepareContacts(entry) {
        if (!game.user.isGM) return;

        const heros = await DSAPersonaEntry.getHeros();
        await DSAPersonaEntry.prepareContacts(entry, heros);
    }

    async _onRenderEditable(context, options) {
        new foundry.applications.ux.DragDrop.implementation({
            dropSelector: '.personae-list-column',
            permissions: {
                drop: this._canDragDrop.bind(this)
            },
            callbacks: {
                drop: this._onDrop.bind(this)
            }
        }).bind(this.element);
    }

    async _afterRegistrationChange() {
        await game.dsa5?.apps?.CalendarPicker?.refreshParts?.(['personae', 'config']);
    }

    _canDragDrop(event) {
        return !this.isView && (this.isEditable || game.user.isGM);
    }

    async _onDrop(event) {
        event.preventDefault();
        const entry = JSON.parse(event.dataTransfer.getData("text/plain"));
        if (entry.type !== "Actor") return;

        const actor = await fromUuid(entry.uuid);
        if (!actor) return;
        if (!DSAPersonaEntry.isValidActor(actor)) {
            ui.notifications.warn('PERSONAE.actorTypeNotAllowed', { localize: true });
            return;
        }

        const options = { actor };
        await this.newEntry(options);
        this.render(true);
    }
    
    async newEntry(options = {}) {
        if (options.actor && !DSAPersonaEntry.isValidActor(options.actor)) {
            ui.notifications.warn('PERSONAE.actorTypeNotAllowed', { localize: true });
            return;
        }

        const id = foundry.utils.randomID();
        this.currentKey = id;
        await this.document.update({
            system: {
                personae: {
                    [id]: DSAPersonaEntry.createEntryData(options)
                }
            }
        })
    }

    async renderDetail(key) {
        const entry = foundry.utils.duplicate(this.document.system.personae[key] || {});
        await this._prepareContacts(entry);
        const actor = await fromUuid(entry.actor_uuid);
        entry.garadan = DSAPersonaEntry.resolveGaradan(entry);
        entry.canLinkActorNotes = DSAPersonaEntry.isActorNotesLinkable(actor);
        entry.linkActorNotesActive = DSAPersonaEntry.shouldLinkActorNotes(entry, actor);
        await DSAPersonaEntry.prepareVisibility(entry);
        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/journal/personaentry_edit_detail.hbs', {
            elem: entry,
            document: this.document,
            isGM: game.user.isGM,
            key,
            actor
        });
    }

    static #editActor(event, target) {
        PersonaeDramatis.editActor(event, target, { stay: true });
    }

    static #showSheet(event, target) {
        PersonaeDramatis.showSheet(event, target, { stay: true });
    }

    static async #copyToken(event, target) {
        const key = target.dataset.key;
        const actorUuid = this.document.system.personae[key]?.actor_uuid;
        if (!actorUuid) return;

        const actor = await fromUuid(actorUuid);
        if (!actor) return;

        const token = actor.prototypeToken;
        if (!token) return;

        await this.document.update({ [`system.personae.${key}.img`]: token.texture.src });
    }

    static async #copyAvatar(event, target) {
        const key = target.dataset.key;
        const actorUuid = this.document.system.personae[key]?.actor_uuid;
        if (!actorUuid) return;

        const actor = await fromUuid(actorUuid);
        if (!actor) return;

        const img = actor.img;
        if (!img) return;

        await this.document.update({ [`system.personae.${key}.img`]: img });
    }
    static async #copyActorDescription(event, target) {
        const key = target.dataset.key;
        const actorUuid = this.document.system.personae[key]?.actor_uuid;
        if (!actorUuid) return;

        const actor = fromUuidSync(actorUuid);
        if (!actor) return;

        const isCreature = actor.type == "creature";
        const update = {};
        if(isCreature) {
            update[`system.personae.${key}.description`] = actor.system.description.value;
        } else {
            update[`system.personae.${key}.description`] = actor.system.details.biography.value;
        }
        await this.document.update(update);
    }
}