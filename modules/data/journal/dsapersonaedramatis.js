import MerchantTemplate from "../actor/templates/merchant.js";
import { JournalListDataModel } from './journallistdatamodel.js';
const { TextEditor } = foundry.applications.ux;
export class DSAPersonaEntry extends JournalListDataModel {
    static SETTING_NAME = 'calendarActors';
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
        5: 'laeufer',
        6: 'boronsrad'
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
        const GaradanChoices = foundry.utils.deepClone(MerchantTemplate.GARADAN_CHOICES);
        GaradanChoices[0] = "-";
        return {
            personae: new TypedObjectField(new SchemaField({
                name: new StringField({ required: true, initial: 'New Entry', label: "PERSONAE.FIELDS.personae.name.label" }),
                type: new NumberField({ required: true, initial: 0, choices: DSAPersonaEntry.TYPE_CHOICES, label: "PERSONAE.FIELDS.personae.type.label" }),
                notes: new HTMLField({ label: "PERSONAE.FIELDS.personae.notes.label" }),
                description: new HTMLField({ label: "PERSONAE.FIELDS.personae.description.label" }),
                actor_uuid: new DocumentUUIDField({ type: "Actor", label: "PERSONAE.FIELDS.personae.actor_uuid.label", hint: "PERSONAE.FIELDS.personae.actor_uuid.hint" }),
                visible: new BooleanField({ initial: false, label: "PERSONAE.FIELDS.personae.visible.label" }),
                showSpecies: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.showSpecies.label" }),
                showCulture: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.showCulture.label" }),
                showProfession: new BooleanField({ initial: true, label: "PERSONAE.FIELDS.personae.showProfession.label" }),
                showActorDescription: new BooleanField({ initial: false, label: "PERSONAE.FIELDS.personae.showActorDescription.label", hint: "PERSONAE.FIELDS.personae.showActorDescription.hint" }),
                faction: new StringField({ label: "PERSONAE.FIELDS.personae.faction.label", hint: "PERSONAE.FIELDS.personae.faction.hint" }),
                tags: new StringField({ label: "PERSONAE.FIELDS.personae.tags.label", hint: "PERSONAE.FIELDS.personae.tags.hint" }),
                img: new FilePathField({ categories: ["IMAGE"], label: "PERSONAE.FIELDS.personae.img.label" }),
                subtitle: new StringField({ label: "PERSONAE.FIELDS.personae.subtitle.label" }),
                garadan: new NumberField({
                    initial: 0,
                    label: 'Garadan',
                    choices: GaradanChoices,
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
        if (actor) {
            entry.name = actor.name;
            entry.type = actor.type === 'creature' ? 1 : 0;
            entry.actor_uuid = actor.uuid;
        }
        return entry;
    }

    async _preUpdate(changed, options, user) {
        await this.#fillActorFields(changed);
        await super._preUpdate(changed, options, user);
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);
        game.dsa5?.apps?.CalendarPicker?.refreshPersonae?.();
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        game.dsa5?.apps?.CalendarPicker?.refreshPersonae?.();
    }

    async #fillActorFields(changed) {
        for (const [key, entry] of Object.entries(changed.system?.personae || {})) {
            if (!entry) continue;
            if (!entry.actor_uuid) continue;
            const actor = await fromUuid(entry.actor_uuid);
            if (!actor) continue;
            if (entry.actor_uuid === this.personae?.[key]?.actor_uuid) continue;
            entry.img = actor.img;
            const isCreature = actor.type === "creature";
            entry.name = actor.name;
            entry.type = isCreature ? 1 : 0;
            entry.garadan = actor.system.merchant?.garadan || 1;
            if (isCreature) {
                const creatureData = this.#splitOutsideBrackets(actor.system.creatureClass?.value || "");
                entry.faction = creatureData[0] || "";
                entry.subtitle = creatureData[1] || "";
            } else {
                entry.faction = this.parent.name;
                entry.subtitle = actor.system.details?.career.value || "";
            }
        }
    }

    #splitOutsideBrackets(s = "") {
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
        return parts.map(p => p.trim());
    }

    static async preparePersonaEntry(entry, document, key, heros) {
        entry.actor = entry.actor_uuid ? await fromUuid(entry.actor_uuid) : null;
        if (!entry.actor) return;
        entry.preparedTags = [];
        entry.isGM = game.user.isGM;
        const isCreature = entry.actor.type === "creature";
        if (isCreature) {
            if (entry.showSpecies && entry.actor.system.creatureClass.value) entry.preparedTags.push(entry.actor.system.creatureClass.value);
        } else {
            entry.garadanClass = DSAPersonaEntry.GARADAN_CLASSES[entry.garadan] || '';
            if (entry.showSpecies && entry.actor.system.details?.species.value) entry.preparedTags.push(entry.actor.system.details.species.value);
            if (entry.showCulture && entry.actor.system.details?.culture.value) entry.preparedTags.push(entry.actor.system.details.culture.value);
            if (entry.showProfession && entry.actor.system.details?.career.value) entry.preparedTags.push(entry.actor.system.details.career.value);
        }
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
        entry.preparedNotes = await TextEditor.enrichHTML(entry.notes || "", { secrets: game.user.isGM });
        entry.uuid = document.uuid;
        entry.dramatisKey = key;
        await this.prepareContacts(entry, heros);
    }
    static async prepareContacts(entry, heros) {
        if (!game.user.isGM) return;
        if (entry.type === 1) return;
        entry.contacts = {};
        for (let [uuid, hero] of heros) {
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
}