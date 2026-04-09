import { JournalListDataModel } from './journallistdatamodel.js';

const { TextEditor } = foundry.applications.ux;

export class DSAQuestLogEntry extends JournalListDataModel {
    static SETTING_NAME = 'questlogJournals';
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
                    done: new BooleanField({ initial: false, label: 'DSAQUESTLOG.FIELDS.quests.objectives.done.label' }),
                    visible: new BooleanField({ initial: true, label: 'DSAQUESTLOG.FIELDS.quests.objectives.visible.label' }),
                })),
                linkedPages: new TypedObjectField(new SchemaField({
                    uuid: new DocumentUUIDField({ type: 'JournalEntryPage', label: 'DSAQUESTLOG.FIELDS.quests.linkedPages.uuid.label', hint: 'DSAQUESTLOG.FIELDS.quests.linkedPages.uuid.hint' }),
                })),
            })),
        };
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
        entry.preparedObjectives = Object.entries(entry.objectives || {})
            .filter(([, objective]) => objective && (objective.visible || game.user.isGM))
            .map(([objectiveKey, objective]) => ({
                objectiveKey,
                ...objective,
            }));
        entry.doneObjectives = entry.preparedObjectives.filter(objective => objective.done).length;
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
        entry.preparedLinkedPages = (await Promise.all(Object.entries(entry.linkedPages || {})
            .filter(([, reference]) => this.#referenceUuid(reference))
            .map(([linkKey, reference]) => {
                return this.resolvePageReference(linkKey, reference);
            }))).filter(Boolean);
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

    static createPageReference(uuid = '') {
        return { uuid };
    }

    static async resolvePageReference(linkKey, reference) {
        const uuid = this.#referenceUuid(reference);
        const page = uuid ? await fromUuid(uuid) : null;

        return {
            linkKey,
            uuid,
            label: page?.name || _loc('DSAQUESTLOG.missingLink'),
            subtitle: page?.parent?.name || '',
            missing: !page,
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
}