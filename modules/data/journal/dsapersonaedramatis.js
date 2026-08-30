import MerchantConfig from "../../config/merchant-config.js";
import { JournalListDataModel } from './journallistdatamodel.js';
const { TextEditor } = foundry.applications.ux;
export class DSAPersonaEntry extends JournalListDataModel {
    static SETTING_NAME = 'calendarActors';
    static ACTOR_NOTES_FIELD = 'system.details.notes.value';
    static CREATION_CONFIG = {
        pageType: 'dsapersonaedramatis',
        entryCollection: 'personae',
        defaultName: 'PERSONAE.ImportantPersons',
        dialogTitle: 'PERSONAE.addActorFromDirectory',
        refreshParts: ['personae', 'config'],
    };

    static TYPE_CHOICES = {
        0: "PERSONAE.FIELDS.personae.type.choices.person",
        1: "PERSONAE.FIELDS.personae.type.choices.creature"
    }
    
    static GARADAN_CLASSES = {
        1: 'bauer',
        2: 'springer',
        3: 'turm',
        4: 'koenig',
        6: 'boronsrad'
    }

    static _migrateData(source) {
        super._migrateData(source);
        for (const entry of Object.values(source.personae || {})) {
            if (Number(entry?.garadan) === 5) entry.garadan = 2;
        }
    }

    static SOCIAL_CONTACT_LEVELS = {
        1: "PERSONAE.FIELDS.personae.socialContact.level.choices.1",
        2: "PERSONAE.FIELDS.personae.socialContact.level.choices.2",
        3: "PERSONAE.FIELDS.personae.socialContact.level.choices.3",
        4: "PERSONAE.FIELDS.personae.socialContact.level.choices.4",
        5: "PERSONAE.FIELDS.personae.socialContact.level.choices.5",
        6: "PERSONAE.FIELDS.personae.socialContact.level.choices.6",
        7: "PERSONAE.FIELDS.personae.socialContact.level.choices.7",
        8: "PERSONAE.FIELDS.personae.socialContact.level.choices.8",
        9: "PERSONAE.FIELDS.personae.socialContact.level.choices.9"
    }

    static defineSchema() {
        const { TypedObjectField, SchemaField, DocumentUUIDField, StringField, NumberField, BooleanField, HTMLField, FilePathField } = foundry.data.fields;
        const GaradanChoices = foundry.utils.deepClone(MerchantConfig.GARADAN_CHOICES);
        return {
            personae: new TypedObjectField(new SchemaField({
                name: new StringField({ required: true, initial: 'New Entry', label: "PERSONAE.FIELDS.personae.name.label" }),
                type: new NumberField({ required: true, initial: 0, choices: DSAPersonaEntry.TYPE_CHOICES, label: "PERSONAE.FIELDS.personae.type.label" }),
                notes: new HTMLField({ label: "PERSONAE.FIELDS.personae.notes.label" }),
                description: new HTMLField({ label: "PERSONAE.FIELDS.personae.description.label" }),
                actor_uuid: new DocumentUUIDField({ type: "Actor", label: "PERSONAE.FIELDS.personae.actor_uuid.label", hint: "PERSONAE.FIELDS.personae.actor_uuid.hint" }),
                visible: new BooleanField({ initial: false, label: "PERSONAE.FIELDS.personae.visible.label" }),
                important: new BooleanField({ initial: false, label: "PERSONAE.FIELDS.personae.important.label", hint: "PERSONAE.FIELDS.personae.important.hint" }),
                showSpecies: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.showSpecies.label" }),
                showCulture: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.showCulture.label" }),
                showProfession: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.showProfession.label" }),
                showActorDescription: new BooleanField({ initial: false, label: "PERSONAE.FIELDS.personae.showActorDescription.label", hint: "PERSONAE.FIELDS.personae.showActorDescription.hint" }),
                linkActorNotes: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.linkActorNotes.label", hint: "PERSONAE.FIELDS.personae.linkActorNotes.hint" }),
                faction: new StringField({ label: "PERSONAE.FIELDS.personae.faction.label", hint: "PERSONAE.FIELDS.personae.faction.hint" }),
                tags: new StringField({ label: "PERSONAE.FIELDS.personae.tags.label", hint: "PERSONAE.FIELDS.personae.tags.hint" }),
                img: new FilePathField({ categories: ["IMAGE"], label: "PERSONAE.FIELDS.personae.img.label" }),
                subtitle: new StringField({ label: "PERSONAE.FIELDS.personae.subtitle.label" }),
                garadan: new NumberField({
                    initial: 0,
                    label: 'Garadan',
                    choices: GaradanChoices,
                }),
                showGaradanGMOnly: new BooleanField({
                    initial: true,
                    label: 'PERSONAE.FIELDS.personae.showGaradanGMOnly.label',
                    hint: 'PERSONAE.FIELDS.personae.showGaradanGMOnly.hint',
                }),
                socialContact: new TypedObjectField(new SchemaField({
                    level: new NumberField({ label: "PERSONAE.FIELDS.personae.socialContact.level.label", initial: 5, choices: DSAPersonaEntry.SOCIAL_CONTACT_LEVELS }),
                })),
            })),
        }
    }

    static createEntryData(options = {}) {
        const { actor, ...overrides } = options;
        const entry = { ...overrides };
        if (this.isValidActor(actor)) {
            entry.name = actor.name;
            entry.type = actor.type === 'creature' ? 1 : 0;
            entry.actor_uuid = actor.uuid;
            if (overrides.linkActorNotes === undefined) entry.linkActorNotes = this.isActorNotesLinkable(actor);
            if (this.supportsGaradan(entry)) entry.garadan = this.resolveGaradan(entry, actor);
        }
        return entry;
    }

    static isValidActor(actor) {
        return !!actor && actor.type !== 'group';
    }

    async _preUpdate(changed, options, user) {
        if (!options.dsaSkipPersonaFill) await this.#fillActorFields(changed);
        await super._preUpdate(changed, options, user);
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);
        if (!options.dsaSkipPersonaRefresh) DSAPersonaEntry.refreshCalendarPicker();
        if (!options.dsaSkipPersonaSync) void this.#syncActorGaradan(changed);
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        DSAPersonaEntry.refreshCalendarPicker();
    }

    static refreshCalendarPicker() {
        void game.dsa5?.apps?.CalendarPicker?.refreshPersonae?.();
    }

    static #getPersonaeChanges(changed = {}) {
        return changed.personae ?? changed.system?.personae ?? {};
    }

    async #fillActorFields(changed) {
        for (const [key, entry] of Object.entries(DSAPersonaEntry.#getPersonaeChanges(changed))) {
            if (!entry) continue;
            if (!entry.actor_uuid) continue;
            const actor = await fromUuid(entry.actor_uuid);
            if (!actor) continue;
            if (entry.actor_uuid === this.personae?.[key]?.actor_uuid) continue;
            entry.img = actor.img;
            const isCreature = actor.type === "creature";
            entry.name = actor.name;
            entry.type = isCreature ? 1 : 0;
            entry.garadan = DSAPersonaEntry.resolveGaradan(entry, actor);
            entry.linkActorNotes = DSAPersonaEntry.isActorNotesLinkable(actor);
            if (isCreature) {
                const creatureData = DSAPersonaEntry.splitOutsideCommas(actor.system.creatureClass?.value || "");
                entry.faction = creatureData[0] || "";
                entry.subtitle = creatureData[1] || "";
            } else {
                entry.faction = this.parent.name;
                entry.subtitle = actor.system.details?.career.value || "";
            }
        }
    }

    async #syncActorGaradan(changed) {
        for (const [key, entry] of Object.entries(DSAPersonaEntry.#getPersonaeChanges(changed))) {
            if (!entry || entry.garadan === undefined) continue;

            const persona = { ...this.personae?.[key], ...entry };
            if (!DSAPersonaEntry.supportsGaradan(persona)) continue;

            const actorUuid = persona.actor_uuid;
            if (!actorUuid) continue;

            const actor = await fromUuid(actorUuid);
            if (!actor || actor.pack) continue;

            const garadan = DSAPersonaEntry.resolveGaradan(persona);
            const current = DSAPersonaEntry.resolveGaradan({ garadan: actor.system.merchant?.garadan });
            if (garadan === current) continue;

            await actor.update({ 'system.merchant.garadan': garadan });
        }
    }

    static splitOutsideCommas(s = "") {
        const parts = [];
        let buf = "";
        const stack = [];
        for (let i = 0; i < s.length; i++) {
            const ch = s[i];
            if (ch === '(' || ch === '[' || ch === '{') {
                stack.push(ch);
                buf += ch;
                continue;
            }
            if (ch === ')' || ch === ']' || ch === '}') {
                if (stack.length) stack.pop();
                buf += ch;
                continue;
            }
            if (ch === ',' && stack.length === 0) {
                parts.push(buf);
                buf = "";
                continue;
            }
            buf += ch;
        }
        if (buf !== "" || s.endsWith(',')) parts.push(buf);
        return parts.map(p => p.trim()).filter(Boolean);
    }

    static parseFactions(factionString, unknownLabel) {
        const factions = DSAPersonaEntry.splitOutsideCommas(factionString || "");
        return factions.length ? factions : [unknownLabel];
    }

    static async preparePersonaEntry(entry, document, key, heros) {
        entry.actor = entry.actor_uuid ? await fromUuid(entry.actor_uuid) : null;
        entry.actorMissing = !!entry.actor_uuid && !entry.actor;
        entry.preparedTags = [];
        entry.isGM = game.user.isGM;
        if (entry.actor) {
            const isCreature = entry.actor.type === "creature";
            entry.garadan = this.resolveGaradan(entry, entry.actor);
            entry.garadanClass = this.shouldShowGaradan(entry, { isGM: entry.isGM }) ? DSAPersonaEntry.GARADAN_CLASSES[entry.garadan] || '' : '';
            if (isCreature) {
                if (entry.showSpecies && entry.actor.system.creatureClass.value) entry.preparedTags.push(entry.actor.system.creatureClass.value);
            } else {
                if (entry.showSpecies && entry.actor.system.details?.species.value) entry.preparedTags.push(entry.actor.system.details.species.value);
                if (entry.showCulture && entry.actor.system.details?.culture.value) entry.preparedTags.push(entry.actor.system.details.culture.value);
                if (entry.showProfession && entry.actor.system.details?.career.value) entry.preparedTags.push(entry.actor.system.details.career.value);
            }
            entry.garadanVisible = this.shouldShowGaradan(entry, { isGM: entry.isGM });
            entry.preparedTags.push(...entry.tags?.split(',').map(t => t.trim()).filter(t => t) || []);
            if (entry.showActorDescription) {
                if (isCreature) {
                    entry.preparedDescription = await TextEditor.enrichHTML(entry.actor.system.description?.value || "", { secrets: game.user.isGM });
                } else {
                    entry.preparedDescription = await TextEditor.enrichHTML(entry.actor.system.details?.biography.value || "", { secrets: game.user.isGM });
                }
            } else {
                entry.preparedDescription = await TextEditor.enrichHTML(entry.description || "", { secrets: game.user.isGM });
            }
        } else {
            entry.garadan = this.resolveGaradan(entry);
            entry.garadanClass = this.shouldShowGaradan(entry, { isGM: entry.isGM }) ? DSAPersonaEntry.GARADAN_CLASSES[entry.garadan] || '' : '';
            entry.garadanVisible = this.shouldShowGaradan(entry, { isGM: entry.isGM });
            entry.preparedTags.push(...entry.tags?.split(',').map(t => t.trim()).filter(t => t) || []);
            entry.preparedDescription = await TextEditor.enrichHTML(entry.description || "", { secrets: game.user.isGM });
        }
        const linkNotes = this.shouldLinkActorNotes(entry, entry.actor);
        const notesSource = linkNotes
            ? (entry.actor.system.details?.notes?.value || "")
            : (entry.notes || "");
        entry.linkActorNotesActive = linkNotes;
        entry.notesValue = notesSource;
        entry.notesDocumentUuid = linkNotes ? entry.actor.uuid : document.uuid;
        entry.notesFieldName = linkNotes ? this.ACTOR_NOTES_FIELD : `system.personae.${key}.notes`;
        entry.preparedNotes = await TextEditor.enrichHTML(notesSource, { secrets: game.user.isGM });
        const unknownFaction = game.i18n.localize("PERSONAE.UnknownFaction");
        entry.preparedFactions = DSAPersonaEntry.parseFactions(entry.faction, unknownFaction);
        entry.preparedFactionDisplay = entry.preparedFactions.join(", ");
        entry.uuid = document.uuid;
        entry.dramatisKey = key;
        await this.prepareContacts(entry, heros);
    }
    static async prepareContacts(entry, heros) {
        if (!game.user.isGM) return;
        if (entry.type === 1) return;
        entry.contacts = {};
        for (const [uuid, hero] of heros) {
            if (entry.actor_uuid && entry.actor_uuid === uuid) continue;
            const slugified_uuid = uuid.replaceAll('.', '_');
            const exists = entry.socialContact[slugified_uuid];
            entry.contacts[slugified_uuid] = {
                uuid,
                name: hero.name,
                exists: !!exists,
                level: exists?.level || 5,
                img: hero.img,
                subtitle: hero.system.details?.career.value || '',
            };
        }
    }
    static async getHeros() {
        if (!game.user.isGM) return [];
        return (await game.dsa5.apps.gameMasterMenu.getTrackedHeros()).reduce((acc, hero) => {
            if (hero.type == "character") {
                acc.push([hero.uuid, hero]);
            }
            return acc;
        }, []);
    }

    static resolveGaradan(entry = {}, actor = null) {
        if (!this.supportsGaradan(entry)) return 0;
        const entryValue = Number(entry.garadan);
        let value = entry.garadan === undefined ? Number(actor?.system?.merchant?.garadan ?? 0) : entryValue;
        if (value === 5) value = 2;
        return Number.isFinite(value) && value > 0 ? value : 0;
    }

    static supportsGaradan(entry = {}) {
        return Number(entry.type) !== 1;
    }

    static shouldShowGaradan(entry = {}, { isGM = false } = {}) {
        if (!this.supportsGaradan(entry)) return false;
        if (!this.resolveGaradan(entry)) return false;
        if (!isGM && entry.showGaradanGMOnly !== false) return false;
        return true;
    }

    static isActorNotesLinkable(actor) {
        return !!actor && !actor.pack && !actor.inCompendium;
    }

    static shouldLinkActorNotes(entry = {}, actor = null) {
        return !!entry.linkActorNotes && this.isActorNotesLinkable(actor);
    }

    static async applyNotesUpdate({ documentUuid, name, newValue } = {}) {
        const document = await fromUuid(documentUuid);
        if (!document || !name) return false;

        if (document.documentName === 'Actor') {
            if (name !== this.ACTOR_NOTES_FIELD) return false;
            if (!this.isActorNotesLinkable(document)) return false;
        }

        await document.update({ [name]: newValue });
        return true;
    }
}