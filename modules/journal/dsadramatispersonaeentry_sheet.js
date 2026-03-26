import { DSAPersonaEntry } from "../data/journal/dsapersonaedramatis.js";
import { PersonaeDramatis } from "../system/calendar/personaedramatis.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";

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
        return a.name.localeCompare(b.name);
    }

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/personaentry_edit.hbs',
            scrollable: ['', '.scrollable', '.persona-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    /** @override */
    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/personaentry_view.hbs',
            templates: ['systems/dsa5/templates/system/calendar/persona-detail.hbs']
        },
    };

    async _prepareEntries(context, options) {
        if (this.isView) {
            const heros = await DSAPersonaEntry.getHeros();
            for (let key of Object.keys(context.sortedEntries)) {
                const entry = context.sortedEntries[key];
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

        const options = { actor };
        await this.newEntry(options);
        this.render(true);
    }
    
    static buildTOC(html, { includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const searchHeadings = element => {
            if ((element instanceof HTMLHeadingElement) && element.classList.contains("persona-detail-name")) {
                const node = cls._makeHeadingNode(element, { includeElement });
                let parent = stack.at(-1);
                if (node.level <= parent.level) {
                    stack.pop();
                    parent = stack.at(-1);
                }
                parent.children.push(node);
                stack.push(node);
            }
            for (const child of (element.children || [])) {
                searchHeadings(child);
            }
        };
        if (Array.isArray(html)) html.forEach(searchHeadings);
        else searchHeadings(html);
        return cls._flattenTOC(root.children);
    }

    async newEntry(options = {}) {
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

    onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(_event, query, rgx, html) : this.#editFilter(_event, query, rgx, html);
    }

    #viewFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll(".persona-detail-view")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }
            const name = entry.querySelector('.persona-detail-name').textContent || '';
            const isMatch = [name].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    #editFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll(".persona-list-item")) {
            if (!query) {
                entry.hidden = false;
                continue;
            }
            const name = entry.querySelector('.persona-list-name').textContent || '';
            const isMatch = [name].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
            entry.hidden = !isMatch;
        }
    }

    async renderDetail(key) {
        const entry = foundry.utils.duplicate(this.document.system.personae[key] || {});
        await this._prepareContacts(entry);
        const actor = await fromUuid(entry.actor_uuid);
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