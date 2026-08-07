import { JournalListDataModel } from './journallistdatamodel.js';

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
        } = foundry.data.fields;

        const dateField = () => new SchemaField({
            dayOfMonth: new NumberField({ required: false, min: 1, step: 1 }),
            month: new NumberField({ required: false, min: 0, step: 1 }),
            year: new NumberField({ required: false, step: 1 }),
        });

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
            this.#migrateCollectionSort(quest?.objectives);
            this.#migrateCollectionSort(quest?.linkedPages);
        }
    }

    /** Assign IntegerSortField values from current key order when missing or all zero-colliding. */
    static #migrateCollectionSort(collection) {
        if (!collection || typeof collection !== 'object') return;
        const entries = Object.entries(collection).filter(([, value]) => value && typeof value === 'object');
        if (!entries.length) return;

        const hasExplicitSort = entries.some(([, value]) => Object.hasOwn(value, 'sort') && Number.isFinite(Number(value.sort)));
        if (hasExplicitSort) return;

        const density = CONST.SORT_INTEGER_DENSITY;
        entries.forEach(([, value], index) => {
            value.sort = index * density;
        });
    }

    static createEntryData(dateContext = game.time.calendar.timeToComponents(game.time.worldTime), overrides = {}) {
        return foundry.utils.mergeObject({
            title: _loc('DSAQUESTLOG.newEntryPlaceholder'),
            startDate: this.createDateSnapshot(dateContext),
        }, overrides);
    }

    _onUpdate(changed, options, userId) {
        super._onUpdate(changed, options, userId);
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
        entry.preparedDetails = await TextEditor.enrichHTML(entry.details || '', { secrets: game.user.isGM });
        entry.preparedGMNotes = await TextEditor.enrichHTML(entry.gmNotes || '', { secrets: game.user.isGM });
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
        entry.preparedLinkedDocuments = (await Promise.all(this.sortedTypedObjectEntries(entry.linkedPages)
            .filter(([, reference]) => this.#referenceUuid(reference) && (reference.visible !== false || game.user.isGM))
            .map(([linkKey, reference]) => {
                return this.resolveDocumentReference(linkKey, reference);
            }))).filter(Boolean);
        entry.preparedLinkedPages = entry.preparedLinkedDocuments;
        entry.uuid = page?.uuid;
        entry.questKey = key;
        return entry;
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
        if (!date?.dayOfMonth || Number.isNaN(Number(date.month)) || Number.isNaN(Number(date.year))) return '';
        const calendar = game.time.calendar;
        const month = calendar.months.values?.[date.month];
        const monthName = month ? calendar.translate(month.name) : date.month;
        const suffix = calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        return `${date.dayOfMonth}. ${monthName} ${date.year} ${suffix}`;
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