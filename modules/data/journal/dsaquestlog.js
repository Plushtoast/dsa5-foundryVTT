import { JournalListDataModel } from './journallistdatamodel.js';
import PartialCalendarDateField from '../fields/partial-calendar-date-field.js';
import { DSAPersonaEntry } from './dsapersonaedramatis.js';
import ImageFramePicker from '../../system/helpers/image-frame-picker.js';
import AlmanacNotification from '../../system/helpers/almanac-notification.js';

const { TextEditor } = foundry.applications.ux;

export class DSAQuestLogEntry extends JournalListDataModel {
    static SETTING_NAME = 'questlogJournals';
    static HOTBAR_ID = 'createQuest';
    static CREATION_CONFIG = {
        pageType: 'dsaquestlog',
        entryCollection: 'quests',
        defaultName: 'DSAQUESTLOG.defaultJournalName',
        dialogTitle: 'DSAQUESTLOG.createQuest',
        refreshParts: ['questlog', 'config'],
    };

    static AUDIENCE_CHOICES = {
        0: 'DSAQUESTLOG.AUDIENCE.0',
        1: 'DSAQUESTLOG.AUDIENCE.1',
        2: 'DSAQUESTLOG.AUDIENCE.2',
    };

    static STATUS_CHOICES = {
        0: 'DSAQUESTLOG.STATUS.0',
        1: 'DSAQUESTLOG.STATUS.1',
        2: 'DSAQUESTLOG.STATUS.2',
    };

    static PRIORITY_CHOICES = {
        0: 'DSAQUESTLOG.PRIORITY.0',
        1: 'DSAQUESTLOG.PRIORITY.1',
        2: 'DSAQUESTLOG.PRIORITY.2',
    };

    static NOTE_PLACEHOLDER_IMG = 'systems/dsa5/icons/backgrounds/library.webp';

    static STATUS_SORT_ORDER = {
        0: 1,
        1: 2,
    };

    static defineSchema() {
        const {
            TypedObjectField,
            SchemaField,
            StringField,
            NumberField,
            BooleanField,
            ArrayField,
            HTMLField,
            DocumentUUIDField,
            IntegerSortField,
            FilePathField,
            ObjectField,
        } = foundry.data.fields;

        const dateField = () => new PartialCalendarDateField();

        return {
            quests: new TypedObjectField(new SchemaField({
                title: new StringField({ required: true, initial: 'New Quest', label: 'DSAQUESTLOG.FIELDS.quests.title.label' }),
                summary: new StringField({ label: 'DSAQUESTLOG.FIELDS.quests.summary.label' }),
                details: new HTMLField({ label: 'DSAQUESTLOG.FIELDS.quests.details.label' }),
                gmNotes: new HTMLField({ label: 'DSAQUESTLOG.FIELDS.quests.gmNotes.label' }),
                status: new NumberField({ required: true, initial: 0, choices: DSAQuestLogEntry.STATUS_CHOICES, label: 'DSAQUESTLOG.FIELDS.quests.status.label' }),
                priority: new NumberField({ required: true, initial: 0, choices: DSAQuestLogEntry.PRIORITY_CHOICES, label: 'DSAQUESTLOG.FIELDS.quests.priority.label' }),
                audience: new NumberField({ required: true, initial: 0, choices: DSAQuestLogEntry.AUDIENCE_CHOICES, label: 'DSAQUESTLOG.FIELDS.quests.audience.label' }),
                playerOwners: new ArrayField(new StringField({ required: true }), { initial: [] }),
                visible: new BooleanField({ initial: true, label: 'DSAQUESTLOG.FIELDS.quests.visible.label' }),
                pinToTop: new BooleanField({ initial: false, label: 'DSAQUESTLOG.FIELDS.quests.pinToTop.label' }),
                chapter: new StringField({ label: 'DSAQUESTLOG.FIELDS.quests.chapter.label' }),
                location: new StringField({ label: 'DSAQUESTLOG.FIELDS.quests.location.label' }),
                tags: new StringField({ label: 'DSAQUESTLOG.FIELDS.quests.tags.label' }),
                startDate: dateField(),
                targetDate: dateField(),
                completionDate: dateField(),
                objectives: new TypedObjectField(new SchemaField({
                    text: new StringField({ required: true, initial: '', label: 'DSAQUESTLOG.FIELDS.quests.objectives.text.label' }),
                    status: new NumberField({ required: true, initial: 0, choices: DSAQuestLogEntry.STATUS_CHOICES, label: 'DSAQUESTLOG.FIELDS.quests.objectives.status.label' }),
                    visible: new BooleanField({ initial: true, label: 'DSAQUESTLOG.FIELDS.quests.objectives.visible.label' }),
                    sort: new IntegerSortField(),
                })),
                linkedPages: new TypedObjectField(new SchemaField({
                    uuid: new DocumentUUIDField({ required: false, blank: true, label: 'DSAQUESTLOG.FIELDS.quests.linkedPages.uuid.label', hint: 'DSAQUESTLOG.FIELDS.quests.linkedPages.uuid.hint' }),
                    visible: new BooleanField({ initial: true, label: 'DSAQUESTLOG.FIELDS.quests.linkedPages.visible.label' }),
                    sort: new IntegerSortField(),
                })),
                image: new FilePathField({
                    categories: ['IMAGE'],
                    required: false,
                    nullable: true,
                    blank: true,
                    initial: null,
                    label: 'DSAQUESTLOG.FIELDS.quests.image.label',
                    hint: 'DSAQUESTLOG.FIELDS.quests.image.hint',
                }),
                imageFrame: new ObjectField({
                    initial: {},
                    label: 'DSAQUESTLOG.FIELDS.quests.imageFrame.label',
                }),
            })),
        };
    }

    static _migrateData(source) {
        super._migrateData(source);

        for (const quest of Object.values(source.quests || {})) {
            for (const objective of Object.values(quest?.objectives || {})) {
                if (!objective || ('status' in objective) || !('done' in objective)) continue;
                objective.status = objective.done ? 1 : 0;
                delete objective.done;
            }
            this.#adoptInvolvedLinks(quest, 'involved');
            this.#adoptInvolvedLinks(quest, 'involvedItems');
        }
    }

    static #adoptInvolvedLinks(quest, collectionName) {
        const source = quest?.[collectionName];
        if (!source || typeof source !== 'object' || Array.isArray(source)) return;

        quest.linkedPages ??= {};
        const existing = new Set(Object.values(quest.linkedPages).map(reference => reference?.uuid || reference?.pageUuid).filter(Boolean));
        for (const [key, reference] of Object.entries(source)) {
            const uuid = reference?.uuid;
            if (!uuid || existing.has(uuid)) continue;
            const linkKey = key in quest.linkedPages ? foundry.utils.randomID() : key;
            const adopted = { uuid, visible: true };
            if (Object.hasOwn(reference, 'sort') && Number.isFinite(Number(reference.sort))) {
                adopted.sort = Number(reference.sort);
            }
            quest.linkedPages[linkKey] = adopted;
            existing.add(uuid);
        }
        delete quest[collectionName];
    }

    static createEntryData(dateContext = game.time.calendar.timeToComponents(game.time.worldTime), overrides = {}) {
        return foundry.utils.mergeObject({
            title: _loc('DSAQUESTLOG.newEntryPlaceholder'),
            startDate: this.createDateSnapshot(dateContext),
        }, overrides);
    }

    async _preUpdate(changed, options, user) {
        AlmanacNotification.captureQuests(this, changed, options);
        await super._preUpdate(changed, options, user);
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);
        AlmanacNotification.deliver(options);
        game.dsa5?.apps?.CalendarPicker?.refreshQuestlog?.();
    }

    _onCreate(data, options, userId) {
        super._onCreate(data, options, userId);
        game.dsa5?.apps?.CalendarPicker?.refreshQuestlog?.();
    }

    static async prepareQuestEntry(entry, { page = null, key = null } = {}) {
        entry.statusName = _loc(this.STATUS_CHOICES[entry.status] || this.STATUS_CHOICES[1]);
        entry.priorityName = _loc(this.PRIORITY_CHOICES[entry.priority] || this.PRIORITY_CHOICES[0]);
        entry.audience = this.#numericValue(entry.audience, 0);
        entry.playerOwners = Array.isArray(entry.playerOwners) ? entry.playerOwners : [];
        entry.preparedTags = entry.tags?.split(',').map(tag => tag.trim()).filter(Boolean) || [];
        entry.preparedSummary = entry.summary?.trim();
        entry.preparedDetails = await this.#enrichHtml(entry.details);
        entry.preparedGMNotes = await this.#enrichHtml(entry.gmNotes);
        entry.groupLabel = entry.chapter?.trim() || _loc('DSAQUESTLOG.ungrouped');
        entry.audienceLabel = _loc(this.AUDIENCE_CHOICES[entry.audience] || this.AUDIENCE_CHOICES[0]);
        entry.playerOwnerNames = this.resolvePlayerNames(entry.playerOwners);
        entry.isGM = game.user.isGM;
        entry.isVisibleToPlayers = !!entry.visible && entry.audience !== 2;
        entry.preparedAudienceBadges = this.prepareAudienceBadges(entry);
        entry.preparedObjectives = this.sortedTypedObjectEntries(entry.objectives)
            .filter(([, objective]) => objective && (objective.visible || game.user.isGM))
            .map(([objectiveKey, objective]) => ({
                objectiveKey,
                ...objective,
                ...this.prepareObjectiveState(objective),
            }));
        entry.doneObjectives = entry.preparedObjectives.filter(objective => objective.status === 1).length;
        entry.totalObjectives = entry.preparedObjectives.length;
        entry.progressText = `${entry.doneObjectives}/${entry.totalObjectives}`;
        entry.startDateLabel = this.formatDate(entry.startDate);
        entry.targetDateLabel = this.formatDate(entry.targetDate);
        entry.completionDateLabel = this.formatDate(entry.completionDate);
        entry.timelineBadges = [
            { icon: 'fa-play', tooltip: 'DSAQUESTLOG.startDate', value: entry.startDateLabel },
            { icon: 'fa-bullseye', tooltip: 'DSAQUESTLOG.targetDate', value: entry.targetDateLabel },
            { icon: 'fa-flag-checkered', tooltip: 'DSAQUESTLOG.completionDate', value: entry.completionDateLabel },
        ].filter(x => x.value);
        this.#prepareQuestImage(entry);
        const grouped = await this.prepareLinkedReferences(entry);
        entry.preparedInvolved = grouped.persons;
        entry.preparedInvolvedItems = grouped.items;
        entry.preparedInvolvedNotes = grouped.notes;
        entry.preparedLinkedDocuments = grouped.others;
        entry.uuid = page?.uuid;
        entry.questKey = key;
        return entry;
    }

    static async #enrichHtml(html) {
        if (!this.#htmlHasVisibleContent(html)) return '';
        return TextEditor.enrichHTML(html, { secrets: game.user.isGM });
    }

    static #htmlHasVisibleContent(html) {
        if (!html || !String(html).trim()) return false;
        const container = document.createElement('div');
        container.innerHTML = html;
        return Boolean(
            container.textContent?.replace(/\u00a0/g, ' ').trim()
            || container.querySelector('img, table, iframe, video, audio, hr, svg, canvas'),
        );
    }

    static getAssignablePlayers() {
        return game.users.filter(user => !user.isGM).map(user => ({
            id: user.id,
            name: user.name,
            active: user.active,
            isCurrent: user.id === game.user.id,
        }));
    }

    static resolvePlayerNames(playerOwners = []) {
        const users = new Map(this.getAssignablePlayers().map(user => [user.id, user.name]));
        return playerOwners.map(id => users.get(id)).filter(Boolean);
    }

    static isVisibleToUser(entry, user = game.user) {
        if (user?.isGM) return true;
        if (!entry?.visible) return false;

        const audience = this.#numericValue(entry?.audience, 0);
        if (audience === 2) return false;
        if (audience === 1) return (entry.playerOwners || []).includes(user.id);
        return true;
    }

    static prepareAudienceBadges(entry) {
        const badges = [];
        if (entry.audience !== 1) return badges;

        for (const name of entry.playerOwnerNames || []) {
            badges.push({ label: name, cssClass: 'owner' });
        }
        return badges;
    }

    static prepareObjectiveState(objective) {
        const status = this.#numericValue(objective.status, 0);
        if (status === 2) return { done: false, failed: true, state: 'failed', stateIcon: 'fa-times-circle', stateTooltip: 'DSAQUESTLOG.objectiveStateFailed' };
        if (status === 1) {
            return { done: true, failed: false, state: 'done', stateIcon: 'fa-check-circle', stateTooltip: 'DSAQUESTLOG.objectiveStateDone' };
        }
        return { done: false, failed: false, state: 'open', stateIcon: 'fa-circle', stateTooltip: 'DSAQUESTLOG.objectiveStateOpen' };
    }

    static nextObjectiveState(objective) {
        const status = this.#numericValue(objective.status, 0);
        if (status === 2) return 0;
        if (status === 1) return 2;
        return 1;
    }

    static createDocumentReference(uuid = '') {
        return { uuid, visible: true };
    }

    static #prepareQuestImage(entry) {
        entry.preparedImage = entry.image || '';
        entry.preparedImageVars = entry.preparedImage
            ? ImageFramePicker.buildBannerVars(entry.imageFrame)
            : '';
    }

    static questImageUpdate(questKey, path) {
        const update = { [`system.quests.${questKey}.image`]: path || null };
        if (!path) update[`system.quests.${questKey}.imageFrame`] = {};
        return update;
    }

    static questImageFrameUpdate(questKey, frame) {
        const normalized = ImageFramePicker.normalizeBanner(frame);
        if (ImageFramePicker.isDefault(normalized)) {
            return { [`system.quests.${questKey}.imageFrame`]: {} };
        }
        return { [`system.quests.${questKey}.imageFrame`]: normalized };
    }

    static hydrateQuestMedia(root) {
        ImageFramePicker.hydrateMediaFrames(root);
    }

    static isPersonaVisibleToUser(entry, user = game.user) {
        if (user?.isGM) return true;
        return !!entry?.visible;
    }

    static async prepareLinkedReferences(quest, { user = game.user } = {}) {
        const isGM = !!user?.isGM;
        const persons = [];
        const items = [];
        const notes = [];
        const others = [];

        for (const [linkKey, reference] of this.sortedTypedObjectEntries(quest?.linkedPages)) {
            const uuid = this.#referenceUuid(reference);
            if (!uuid) continue;

            const visible = reference.visible !== false;
            if (!visible && !isGM) continue;

            const type = foundry.utils.parseUuid(uuid)?.type || '';
            if (type === 'Actor') {
                const person = await this.#prepareInvolvedPerson(linkKey, uuid, { user, isGM, visible });
                if (person) persons.push(person);
                continue;
            }
            if (type === 'Item') {
                const item = await this.#prepareInvolvedItem(linkKey, uuid, { user, isGM, visible });
                if (item) items.push(item);
                continue;
            }
            if (this.#isJournalNoteType(type)) {
                const note = await this.#prepareInvolvedNote(linkKey, uuid, { user, isGM, visible });
                if (note) notes.push(note);
                continue;
            }

            others.push(await this.resolveDocumentReference(linkKey, reference));
        }

        return { persons, items, notes, others };
    }

    static async prepareInvolvedPersons(quest, { user = game.user } = {}) {
        return (await this.prepareLinkedReferences(quest, { user })).persons;
    }

    static async prepareInvolvedItems(quest, { user = game.user } = {}) {
        return (await this.prepareLinkedReferences(quest, { user })).items;
    }

    static async prepareInvolvedNotes(quest, { user = game.user } = {}) {
        return (await this.prepareLinkedReferences(quest, { user })).notes;
    }

    static async #prepareInvolvedPerson(linkKey, uuid, { user, isGM, visible }) {
        const persona = DSAPersonaEntry.findByActorUuid(uuid);
        const personaVisible = this.isPersonaVisibleToUser(persona?.entry, user);
        if (!persona || !personaVisible) {
            if (!isGM) return null;
        }

        const actor = await fromUuid(uuid);
        return {
            linkKey,
            uuid,
            name: persona?.entry?.name || actor?.name || _loc('DSAQUESTLOG.missingLink'),
            img: persona?.entry?.img || actor?.img || 'icons/svg/mystery-man.svg',
            subtitle: persona?.entry?.subtitle || '',
            important: !!persona?.entry?.important,
            personaPageUuid: persona?.page?.uuid || '',
            personaJournalUuid: persona?.journal?.uuid || '',
            dramatisKey: persona?.key || '',
            canOpenPersona: !!(persona && personaVisible),
            canOpen: !!(persona && personaVisible) || (isGM && !!actor),
            visible,
            missing: !actor,
            missingPersona: !persona,
        };
    }

    static isItemVisibleToUser(item, user = game.user) {
        if (!item) return false;
        if (user?.isGM) return true;
        return item.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER);
    }

    static #itemTypeLabel(item) {
        if (!item?.type) return '';
        const key = `TYPES.Item.${item.type}`;
        return game.i18n.has(key) ? _loc(key) : item.type;
    }

    static async #prepareInvolvedItem(linkKey, uuid, { user, isGM, visible }) {
        const item = await fromUuid(uuid);
        const canOpen = this.isItemVisibleToUser(item, user);
        if (!canOpen && !isGM) return null;

        return {
            linkKey,
            uuid,
            name: item?.name || _loc('DSAQUESTLOG.missingLink'),
            img: item?.img || 'icons/svg/item-bag.svg',
            subtitle: this.#itemTypeLabel(item),
            canOpen,
            visible,
            missing: !item,
        };
    }

    static async openInvolvedItem(uuid) {
        const item = uuid ? await fromUuid(uuid) : null;
        if (!this.isItemVisibleToUser(item)) return false;
        if (item.documentName !== 'Item') return false;

        await item.sheet?.render(true);
        return true;
    }

    static #isJournalNoteType(type) {
        return type === 'JournalEntry' || type === 'JournalEntryPage';
    }

    static isNoteVisibleToUser(document, user = game.user) {
        if (!document) return false;
        if (user?.isGM) return true;
        if (document.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return true;
        if (document.documentName === 'JournalEntryPage') {
            return document.parent?.testUserPermission(user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER) ?? false;
        }
        return false;
    }

    static async #prepareInvolvedNote(linkKey, uuid, { user, isGM, visible }) {
        const document = uuid ? await fromUuid(uuid) : null;
        const canOpen = this.isNoteVisibleToUser(document, user);
        if (!canOpen && !isGM) return null;

        const documentType = document?.documentName || foundry.utils.parseUuid(uuid)?.type || '';
        const parentName = document?.parent?.name || '';
        const subtitle = documentType === 'JournalEntryPage'
            ? parentName
            : this.#documentTypeLabel(documentType);

        return {
            linkKey,
            uuid,
            name: document?.name || _loc('DSAQUESTLOG.missingLink'),
            img: this.NOTE_PLACEHOLDER_IMG,
            subtitle,
            canOpen,
            visible,
            missing: !document,
            documentType,
        };
    }

    static async openInvolvedNote(uuid) {
        const document = uuid ? await fromUuid(uuid) : null;
        if (!this.isNoteVisibleToUser(document)) return false;

        if (document.documentName === 'JournalEntryPage') {
            await document.parent?.sheet?.render(true, { pageId: document.id });
            return true;
        }
        if (document.documentName === 'JournalEntry') {
            await document.sheet?.render(true);
            return true;
        }
        return false;
    }

    static async openInvolvedPersonJournal(actorUuid) {
        const found = DSAPersonaEntry.findByActorUuid(actorUuid);
        if (!found) return false;
        if (!this.isPersonaVisibleToUser(found.entry)) return false;

        const journal = found.journal;
        if (!journal?.testUserPermission(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER)) return false;

        await journal.sheet?.render(true, { pageId: found.page.id });
        return true;
    }

    static createPageReference(uuid = '') {
        return this.createDocumentReference(uuid);
    }

    /**
     * Keys for a TypedObjectField after reordering visible items.
     * Walks the collection in current sort order so non-listed keys keep their slots;
     * listed keys fill the visible slots in `orderedVisibleKeys` order.
     * @param {Record<string, unknown>} source
     * @param {string[]} orderedVisibleKeys
     * @returns {string[]}
     */
    static orderedTypedObjectKeys(source, orderedVisibleKeys) {
        const current = source || {};
        const visibleSet = new Set(orderedVisibleKeys);
        const resultKeys = [];
        let visibleIndex = 0;

        for (const [key] of this.sortedTypedObjectEntries(current)) {
            if (!visibleSet.has(key)) {
                resultKeys.push(key);
                continue;
            }
            const nextKey = orderedVisibleKeys[visibleIndex++];
            if (nextKey && nextKey in current) resultKeys.push(nextKey);
        }

        return resultKeys;
    }

    /** @deprecated Use orderedTypedObjectKeys */
    static reorderTypedObjectKeys(source, orderedVisibleKeys) {
        const current = foundry.utils.duplicate(source || {});
        return Object.fromEntries(this.orderedTypedObjectKeys(current, orderedVisibleKeys).map(key => [key, current[key]]));
    }

    static compareSort(a, b) {
        return (Number(a?.sort) || 0) - (Number(b?.sort) || 0);
    }

    static sortedTypedObjectEntries(collection) {
        return Object.entries(collection || {}).sort(([, a], [, b]) => this.compareSort(a, b));
    }

    static nextSortValue(collection) {
        const density = CONST.SORT_INTEGER_DENSITY;
        const sorts = Object.values(collection || {}).map(entry => Number(entry?.sort) || 0);
        return (sorts.length ? Math.max(...sorts) : -density) + density;
    }

    /**
     * Document update payload that assigns IntegerSortField values for the given visible order.
     * @param {string} basePath  e.g. system.quests.<id>.objectives
     * @param {Record<string, unknown>} source
     * @param {string[]} orderedVisibleKeys
     * @returns {Record<string, number>}
     */
    static buildTypedObjectSortUpdate(basePath, source, orderedVisibleKeys) {
        const density = CONST.SORT_INTEGER_DENSITY;
        const orderedKeys = this.orderedTypedObjectKeys(source, orderedVisibleKeys);
        const update = {};
        orderedKeys.forEach((key, index) => {
            update[`${basePath}.${key}.sort`] = index * density;
        });
        return update;
    }

    static async resolveDocumentReference(linkKey, reference) {
        const uuid = this.#referenceUuid(reference);
        const document = uuid ? await fromUuid(uuid) : null;
        const parsed = foundry.utils.parseUuid(uuid);
        const documentType = document?.documentName || parsed?.type || '';
        const documentTypeLabel = this.#documentTypeLabel(documentType);
        const parentName = document?.parent?.name || '';

        return {
            linkKey,
            uuid,
            label: document?.name || _loc('DSAQUESTLOG.missingLink'),
            subtitle: parentName,
            documentType,
            documentTypeLabel,
            visible: reference.visible !== false,
            missing: !document,
        };
    }

    static formatDate(date) {
        if (!date) return '';

        const calendar = game.time.calendar;
        const monthIndex = date.month;
        const hasMonth = Number.isInteger(monthIndex) && monthIndex >= 0;
        const month = hasMonth ? calendar.months.values?.[monthIndex] : null;
        const monthName = month ? calendar.translate(month.name) : null;

        const day = Number(date.dayOfMonth);
        const hasDay = Number.isInteger(day) && day >= 1 && !!monthName;

        const year = date.year;
        const hasYear = Number.isInteger(year) && !(year === 0 && !hasDay);
        if (year === 0 && monthIndex === 0 && !hasDay) return '';
        if (!hasDay && !monthName && !hasYear) return '';

        const parts = [];
        if (hasDay) parts.push(`${day}.`);
        if (monthName) parts.push(monthName);
        if (hasYear) {
            const suffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
            parts.push(`${year} ${suffix}`);
        }
        return parts.join(' ');
    }

    static #numericValue(value, fallback) {
        const numeric = Number(value);
        return Number.isFinite(numeric) ? numeric : fallback;
    }

    static #referenceUuid(reference) {
        if (!reference) return '';
        return reference.uuid || reference.pageUuid || '';
    }

    static #documentTypeLabel(documentType) {
        if (!documentType) return _loc('DSAQUESTLOG.unknownDocumentType');
        const label = CONFIG[documentType]?.documentClass?.metadata?.label || documentType;
        return game.i18n.has(label) ? _loc(label) : label;
    }
}