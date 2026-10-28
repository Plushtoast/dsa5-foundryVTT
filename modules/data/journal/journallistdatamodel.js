import { DSADataModel } from '../abstract.js';
import { JournalEntryTargetHelper } from '../../system/calendar/journalentrytargethelper.js';

export class JournalListDataModel extends DSADataModel {
    static PAGE_COLLECTIONS = {
        dsacalendar: 'calendarentries',
        dsapersonaedramatis: 'personae',
        dsaquestlog: 'quests',
        citydetails: 'details',
    };

    static VISIBILITY_PARTIAL = 'systems/dsa5/templates/journal/parts/visibility-control.hbs';

    static createDateSnapshot(dateContext, { includeDay = false } = {}) {
        const snapshot = {
            dayOfMonth: dateContext.dayOfMonth + 1,
            month: dateContext.month,
            year: dateContext.year,
        };

        if (includeDay) snapshot.day = dateContext.day;
        return snapshot;
    }

    static async createEntry(page, entryOptions) {
        const { entryCollection } = this.CREATION_CONFIG;
        const currentKey = foundry.utils.randomID();
        await page.update({
            system: {
                [entryCollection]: {
                    [currentKey]: this.createEntryData(entryOptions),
                },
            },
        });
        return currentKey;
    }

    static async startCreation(picker, entryOptions) {
        if (!game.user.isGM) return;

        const config = this.CREATION_CONFIG;
        const defaultName = _loc(config.defaultName);

        if (picker?.rendered) {
            await picker.close();
        }

        const target = await JournalEntryTargetHelper.chooseTarget({
            pageType: config.pageType,
            defaultName,
            dialogTitle: _loc(config.dialogTitle),
        });
        if (!target) return;

        const { journal, page } = await JournalEntryTargetHelper.ensureTarget(target, {
            pageType: config.pageType,
            defaultName,
        });
        if (!journal || !page) {
            ui.notifications.error('DSAJOURNALTARGET.targetCreationFailed', { localize: true });
            return;
        }

        await JournalEntryTargetHelper.registerJournal(journal, {
            settingName: this.SETTING_NAME,
            refresh: () => game.dsa5?.apps?.CalendarPicker?.refreshParts?.(config.refreshParts || []),
        });

        const currentKey = await this.createEntry(page, entryOptions);
        page.sheet.render({ force: true, currentKey });
    }

    static visibleActorsField() {
        const { ArrayField, StringField } = foundry.data.fields;
        return new ArrayField(new StringField({ required: true, blank: false }), {
            initial: [],
            label: 'JOURNALLIST.visibleActors.label',
            hint: 'JOURNALLIST.visibleActors.hint',
        });
    }

    static normalizeActorUuids(value) {
        if (!Array.isArray(value)) return [];
        return [...new Set(value.filter(uuid => typeof uuid === 'string' && uuid))];
    }

    static isGloballyVisible(entry) {
        if (!entry?.visible) return false;
        const audience = Number(entry?.audience ?? 0);
        return audience !== 1 && audience !== 2;
    }

    static isSharedWithPlayers(entry) {
        if (this.isGloballyVisible(entry)) return true;
        if (this.normalizeActorUuids(entry?.visibleActors).length) return true;
        return !!entry?.visible && Number(entry?.audience ?? 0) === 1 && Array.isArray(entry?.playerOwners) && entry.playerOwners.length > 0;
    }

    static userOwnsActor(user, actor) {
        if (!user || !actor) return false;
        if (typeof actor.testUserPermission === 'function') {
            return actor.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
        }
        return user.character?.uuid === actor.uuid;
    }

    static userOwnsAnyActor(user, actorUuids = []) {
        for (const uuid of actorUuids) {
            let actor;
            try {
                actor = fromUuidSync(uuid);
            } catch (_error) {
                continue;
            }
            if (this.userOwnsActor(user, actor)) return true;
        }
        return false;
    }

    static isVisibleToUser(entry, user = game.user) {
        if (!entry) return false;
        if (user?.isGM) return true;
        if (this.isGloballyVisible(entry)) return true;
        if (this.userOwnsAnyActor(user, this.normalizeActorUuids(entry.visibleActors))) return true;
        if (entry.visible && Number(entry.audience ?? 0) === 1) return (entry.playerOwners || []).includes(user.id);
        return false;
    }

    static visibilityIcon(entry) {
        return this.isSharedWithPlayers(entry) ? 'fa-eye' : 'fa-eye-slash';
    }

    static #playerActorsCache;
    static #playerActorsCacheAt = 0;

    static async listPlayerActors() {
        const now = Date.now();
        if (this.#playerActorsCache && (now - this.#playerActorsCacheAt) < 2000) return this.#playerActorsCache;

        const byUuid = new Map();
        const tracked = await game.dsa5?.apps?.gameMasterMenu?.getTrackedHeros?.() ?? [];
        for (const actor of tracked) {
            if (!actor || actor.type === 'group' || actor.type === 'vehicle') continue;
            byUuid.set(actor.uuid, actor);
        }
        for (const actor of game.actors ?? []) {
            if (!actor.hasPlayerOwner || actor.type === 'group' || actor.type === 'vehicle') continue;
            if (!byUuid.has(actor.uuid)) byUuid.set(actor.uuid, actor);
        }
        this.#playerActorsCache = [...byUuid.values()];
        this.#playerActorsCacheAt = now;
        return this.#playerActorsCache;
    }

    static async getVisibilityActors(entry = {}) {
        const selected = new Set(this.normalizeActorUuids(entry.visibleActors));
        const actors = await this.listPlayerActors();
        return actors.map(actor => ({
            uuid: actor.uuid,
            name: actor.name,
            img: actor.img,
            selected: selected.has(actor.uuid),
        }));
    }

    static async preloadVisibilityPartial() {
        await foundry.applications.handlebars.loadTemplates([this.VISIBILITY_PARTIAL]);
    }

    static async prepareVisibility(entry) {
        if (!entry) return entry;
        await this.preloadVisibilityPartial();
        entry.isGM = game.user.isGM;
        entry.visibilityActors = game.user.isGM ? await this.getVisibilityActors(entry) : [];
        entry.visibilityIcon = this.visibilityIcon(entry);
        entry.isVisibleToPlayers = this.isSharedWithPlayers(entry);
        entry.visibilityPartial = entry.isVisibleToPlayers && !this.isGloballyVisible(entry);
        return entry;
    }

    static async ensurePlayerReadable(document) {
        if (!document || !game.user.isGM) return;

        const OBSERVER = CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER;
        const INHERIT = CONST.DOCUMENT_OWNERSHIP_LEVELS.INHERIT ?? -1;
        const journal = document.documentName === 'JournalEntry' ? document : document.parent;
        const page = document.documentName === 'JournalEntryPage' ? document : null;

        if (journal) {
            const current = Number(journal.ownership?.default ?? CONST.DOCUMENT_OWNERSHIP_LEVELS.NONE);
            if (current < OBSERVER && current !== INHERIT) {
                await journal.update({ 'ownership.default': OBSERVER });
            }
        }

        if (page) {
            const pageDefault = page.ownership?.default;
            if (pageDefault !== undefined && Number(pageDefault) !== INHERIT && Number(pageDefault) < OBSERVER) {
                await page.update({ 'ownership.default': INHERIT });
            }
        }
    }

    static collectionForPage(page) {
        return this.PAGE_COLLECTIONS[page?.type] || null;
    }

    static async toggleVisible(page, collection, key) {
        const entry = page?.system?.[collection]?.[key];
        if (!page || !entry || !key) return;

        const visible = !entry.visible;
        const update = { [`system.${collection}.${key}.visible`]: visible };
        if (visible && collection === 'quests') update[`system.${collection}.${key}.audience`] = 0;
        if (visible || this.normalizeActorUuids(entry.visibleActors).length) {
            await this.ensurePlayerReadable(page);
        }
        await page.update(update);
    }

    static async toggleActor(page, collection, key, actorUuid) {
        const entry = page?.system?.[collection]?.[key];
        if (!page || !entry || !key || !actorUuid) return;

        const current = this.normalizeActorUuids(entry.visibleActors);
        const visibleActors = current.includes(actorUuid)
            ? current.filter(uuid => uuid !== actorUuid)
            : [...current, actorUuid];
        if (!current.includes(actorUuid)) await this.ensurePlayerReadable(page);
        await page.update({ [`system.${collection}.${key}.visibleActors`]: visibleActors });
    }

    static async resolveVisibilityTarget(target, fallbackPage = null) {
        const actorUuid = target?.dataset?.actorUuid;
        const pageUuid = target?.dataset?.questUuid || target?.dataset?.personaUuid || target?.dataset?.uuid;
        const key = target?.dataset?.questKey || target?.dataset?.key;
        const page = pageUuid ? await fromUuid(pageUuid) : fallbackPage;
        if (!page || !key) return null;

        const collection = this.collectionForPage(page);
        if (!collection) return null;
        return { page, collection, key, actorUuid };
    }

    static async onToggleVisibility(event, target) {
        event?.stopPropagation?.();
        if (!game.user.isGM) return;
        const resolved = await this.resolveVisibilityTarget(target);
        if (!resolved) return;
        await this.toggleVisible(resolved.page, resolved.collection, resolved.key);
    }

    static async onToggleActorVisibility(event, target) {
        event?.stopPropagation?.();
        if (!game.user.isGM) return;
        const resolved = await this.resolveVisibilityTarget(target);
        if (!resolved?.actorUuid) return;
        await this.toggleActor(resolved.page, resolved.collection, resolved.key, resolved.actorUuid);
    }
}