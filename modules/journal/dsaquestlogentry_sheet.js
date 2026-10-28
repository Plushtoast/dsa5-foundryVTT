import { DSAQuestLogEntry } from "../data/journal/dsaquestlog.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";
import JournalListUx from "./journal-list-ux.js";
import JournalStatusPicker from "./journal-status-picker.js";
import ImageFrameDialog from "../dialog/image-frame-dialog.js";
import DSA5_Utility from "../system/helpers/utility-dsa5.js";

export class DSAQuestLogEntrySheet extends CalendarListJournalSheet {
    static objectKey = 'quests';
    static settingName = DSAQuestLogEntry.SETTING_NAME;
    static #SORT_DRAG_TYPE = 'dsaQuestNestedSort';

    static DEFAULT_OPTIONS = {
        actions: {
            addObjective: this.#addObjective,
            removeObjective: this.#removeObjective,
            toggleObjectiveVisibility: this.#toggleObjectiveVisibility,
            setQuestStatus: this.#setQuestStatus,
            setObjectiveStatus: this.#setObjectiveStatus,
            togglePlayerOwner: this.#togglePlayerOwner,
            addLinkedDocument: this.#addLinkedDocument,
            removeLinkedDocument: this.#removeLinkedDocument,
            openLinkedDocument: this.#openLinkedDocument,
            toggleLinkedDocumentVisibility: this.#toggleLinkedDocumentVisibility,
            openInvolvedPerson: this.#openInvolvedPerson,
            openInvolvedItem: this.#openInvolvedItem,
            openInvolvedNote: this.#openInvolvedNote,
            pickQuestImage: this.#pickQuestImage,
            configureQuestImageFrame: this.#configureQuestImageFrame,
            showQuestImage: this.#showQuestImage,
            clearQuestImage: this.#clearQuestImage,
        },
        position: {
            width: 1080,
            height: 760,
        },
    };

    static EDIT_PARTS = {
        header: super.EDIT_PARTS.header,
        content: {
            classes: ['flex1', 'scrollable', 'standard-form'],
            template: 'systems/dsa5/templates/journal/questlogentry_edit.hbs',
            templates: [...CalendarListJournalSheet.listUxPartials, JournalStatusPicker.PARTIAL],
            scrollable: ['', '.scrollable', '.persona-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/questlogentry_view.hbs',
            templates: [...CalendarListJournalSheet.listUxPartials, JournalStatusPicker.PARTIAL],
        },
    };

    get listUxDescriptor() {
        const collator = JournalListUx.collator();
        return {
            typeKey: 'quest',
            entryHeadingClass: 'questlog-detail-name',
            searchPlaceholder: 'Book.search',
            addTooltip: 'DSAQUESTLOG.createQuest',
            editItemSelector: '.persona-list-item',
            viewItemSelector: '.persona-detail-view',
            editSearch: { selectors: ['.persona-list-name', '.persona-list-meta', '.questlog-summary'] },
            viewSearch: { selectors: ['.questlog-detail-name', '.persona-detail-subtitle', '.persona-detail-content'] },
            getGroupInfo: entry => {
                const label = entry.groupLabel || entry.chapter?.trim() || _loc('DSAQUESTLOG.ungrouped');
                return [{ key: label, label }];
            },
            compareGroups: (left, right) => collator.compare(left, right),
            compare: (a, b, sort) => {
                if (sort === 'name') return JournalListUx.comparePinThenTitle(a, b, 'title');
                return this.constructor.sortEntryPairs([, a], [, b]);
            },
            filters: [{
                key: 'statuses',
                type: 'set',
                icon: 'fa-filter',
                options: () => DSAQuestLogEntry.questStatusOptions().map(option => ({
                    key: option.key,
                    label: _loc(option.label),
                    icon: option.icon,
                })),
                predicate: (entry, uxState) => JournalListUx.isEnabled(uxState.filters?.statuses, entry.dataset.questStatus),
            }],
            sortModes: [
                { key: 'status', label: 'JOURNALLIST.sortByStatus' },
                { key: 'name', label: 'JOURNALLIST.sortByName' },
            ],
        };
    }

    static sortEntryPairs([, a], [, b]) {
        if (!!a.pinToTop !== !!b.pinToTop) return a.pinToTop ? -1 : 1;
        const statusOrder = (DSAQuestLogEntry.STATUS_SORT_ORDER[a.status] ?? 99) - (DSAQuestLogEntry.STATUS_SORT_ORDER[b.status] ?? 99);
        if (statusOrder) return statusOrder;
        return JournalListUx.collator().compare(a.title || '', b.title || '');
    }

    async _prepareEntries(context, _options) {
        for (const [questKey, entry] of Object.entries(context.sortedEntries)) {
            if (this.isView) await DSAQuestLogEntry.prepareQuestEntry(entry, { page: this.document, key: questKey });
            else this.#prepareEditEntry(entry);
            entry.questKey = questKey;
            entry.questUuid = this.document.uuid;
        }
    }

    #prepareEditEntry(entry) {
        entry.statusName = _loc(DSAQuestLogEntry.STATUS_CHOICES[entry.status] || DSAQuestLogEntry.STATUS_CHOICES[1]);
        entry.preparedSummary = entry.summary?.trim();
        entry.groupLabel = entry.chapter?.trim() || _loc('DSAQUESTLOG.ungrouped');

        const objectives = Object.values(entry.objectives || {}).filter(objective => objective && (objective.visible || game.user.isGM));
        entry.totalObjectives = objectives.length;
        entry.doneObjectives = objectives.filter(objective => objective.status === 1).length;
        entry.progressText = `${entry.doneObjectives}/${entry.totalObjectives}`;
    }

    async _afterRegistrationChange() {
        await game.dsa5?.apps?.CalendarPicker?.refreshParts?.(['questlog', 'config']);
    }

    async _onRenderEditable(_context, _options) {
        this.#bindNestedSortDragDrop();
    }

    async _onRender(context, options) {
        await super._onRender(context, options);
        DSAQuestLogEntry.hydrateQuestMedia(this.element);
    }

    async _onDetailRendered(_key) {
        this.#bindNestedSortDragDrop();
        DSAQuestLogEntry.hydrateQuestMedia(this.element);
        JournalStatusPicker.bind(this.element);
    }

    #bindNestedSortDragDrop() {
        if (this.isView || !(this.isEditable || game.user.isGM)) return;
        if (!this.element?.querySelector('.quest-sortable-item')) return;

        new foundry.applications.ux.DragDrop.implementation({
            dragSelector: '.quest-sortable-handle',
            dropSelector: '.quest-sortable-item',
            permissions: {
                dragstart: () => true,
                drop: () => true,
            },
            callbacks: {
                dragstart: this.#onNestedSortDragStart.bind(this),
                dragover: this.#onNestedSortDragOver.bind(this),
                drop: this.#onNestedSortDrop.bind(this),
                dragend: this.#clearNestedSortIndicators.bind(this),
            },
        }).bind(this.element);
    }

    #onNestedSortDragStart(event) {
        const item = event.currentTarget.closest('.quest-sortable-item');
        const list = item?.closest('[data-sort-collection]');
        if (!item || !list) return;

        event.dataTransfer.setData('text/plain', JSON.stringify({
            type: DSAQuestLogEntrySheet.#SORT_DRAG_TYPE,
            questKey: list.dataset.questKey,
            collection: list.dataset.sortCollection,
            key: item.dataset.sortKey,
        }));
        event.dataTransfer.effectAllowed = 'move';
        item.classList.add('dragging');
    }

    #onNestedSortDragOver(event) {
        const target = event.currentTarget;
        if (!(target instanceof HTMLElement)) return;

        this.#clearNestedSortIndicators({ keepDragging: true });
        const rect = target.getBoundingClientRect();
        const midY = rect.top + (rect.height / 2);
        target.classList.add(event.clientY < midY ? 'drag-over-before' : 'drag-over-after');
    }

    #clearNestedSortIndicators({ keepDragging = false } = {}) {
        this.element?.querySelectorAll('.quest-sortable-item').forEach(el => {
            el.classList.remove('drag-over-before', 'drag-over-after');
            if (!keepDragging) el.classList.remove('dragging');
        });
    }

    async #onNestedSortDrop(event) {
        this.#clearNestedSortIndicators();

        let dragData;
        try {
            dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
        } catch {
            return;
        }
        if (dragData?.type !== DSAQuestLogEntrySheet.#SORT_DRAG_TYPE) return;

        const target = event.currentTarget;
        const list = target?.closest('[data-sort-collection]');
        if (!list) return;
        if (list.dataset.sortCollection !== dragData.collection || list.dataset.questKey !== dragData.questKey) return;

        const items = [...list.querySelectorAll('.quest-sortable-item')];
        const keys = items.map(el => el.dataset.sortKey);
        const fromIndex = keys.indexOf(dragData.key);
        const toIndex = keys.indexOf(target.dataset.sortKey);
        if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return;

        const rect = target.getBoundingClientRect();
        const midY = rect.top + (rect.height / 2);
        const [movedKey] = keys.splice(fromIndex, 1);
        const adjustedToIndex = keys.indexOf(target.dataset.sortKey);
        keys.splice(event.clientY < midY ? adjustedToIndex : adjustedToIndex + 1, 0, movedKey);

        if (this.isEditable && this.form) await this.submit();

        const quest = this.document.system.quests[dragData.questKey];
        const collection = quest?.[dragData.collection];
        if (!collection) return;

        const update = DSAQuestLogEntry.buildTypedObjectSortUpdate(
            `system.quests.${dragData.questKey}.${dragData.collection}`,
            collection,
            keys,
        );
        if (!foundry.utils.isEmpty(update)) await this.document.update(update);
    }

    async newEntry() {
        const id = foundry.utils.randomID();
        this.currentKey = id;
        await this.document.update({
            system: {
                quests: {
                    [id]: DSAQuestLogEntry.createEntryData(game.time.calendar.timeToComponents(game.time.worldTime)),
                },
            },
        });
    }

    async renderDetail(key) {
        const quest = foundry.utils.duplicate(this.document.system.quests[key] || {});
        quest.playerOwners = Array.isArray(quest.playerOwners) ? quest.playerOwners : [];
        const availableMonths = this.#availableMonths();
        const availablePlayers = DSAQuestLogEntry.getAssignablePlayers().map(player => ({
            ...player,
            selected: quest.playerOwners.includes(player.id),
        }));
        const yearSuffix = game.time.calendar.translate(CONFIG.time.worldCalendarConfig.years.yearSuffix);
        const currentWorldYear = game.time.calendar.timeToComponents(game.time.worldTime).year;
        const objectiveEntries = DSAQuestLogEntry.sortedTypedObjectEntries(quest.objectives)
            .filter(([, objective]) => objective && (objective.visible || game.user.isGM))
            .map(([objectiveKey, objective]) => ({
                objectiveKey,
                ...objective,
                ...DSAQuestLogEntry.prepareObjectiveState(objective),
                statusOptions: DSAQuestLogEntry.objectiveStatusOptions(objective.status),
            }));
        const linkedDocumentEntries = DSAQuestLogEntry.sortedTypedObjectEntries(quest.linkedPages).map(([linkKey, link]) => ({
            linkKey,
            uuid: link?.uuid || link?.pageUuid || '',
            visible: link?.visible !== false,
        }));
        await JournalStatusPicker.preload();
        await DSAQuestLogEntry.prepareVisibility(quest);
        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/journal/questlogentry_edit_detail.hbs', {
            elem: quest,
            key,
            isGM: game.user.isGM,
            document: this.document,
            availableMonths,
            availablePlayers,
            objectiveEntries,
            linkedDocumentEntries,
            yearSuffix,
            currentWorldYear,
        });
    }

    #availableMonths() {
        return game.time.calendar.months.values.map((month, index) => ({
            label: game.time.calendar.translate(month.name),
            value: index,
        }));
    }

    static async #addObjective(event, target) {
        const questKey = target.dataset.key;
        const objectiveKey = foundry.utils.randomID();
        const quest = this.document.system.quests[questKey];
        await this.document.update({
            [`system.quests.${questKey}.objectives.${objectiveKey}`]: {
                text: _loc('DSAQUESTLOG.newObjectivePlaceholder'),
                status: 0,
                visible: false,
                sort: DSAQuestLogEntry.nextSortValue(quest?.objectives),
            },
        });
    }

    static async #removeObjective(event, target) {
        const { key, objectiveKey } = target.dataset;
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}`]: _del });
    }

    static async #setQuestStatus(event, target) {
        if (!game.user.isGM) return;
        const { key } = target.dataset;
        const status = Number(target.dataset.status);
        const quest = this.document.system.quests[key];
        if (!quest || Number.isNaN(status)) return;
        await this.document.update({ [`system.quests.${key}.status`]: status });
    }

    static async #toggleObjectiveVisibility(event, target) {
        const { key, objectiveKey } = target.dataset;
        const objective = this.document.system.quests[key]?.objectives?.[objectiveKey];
        if (!objective) return;
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.visible`]: !objective.visible });
    }

    static async #setObjectiveStatus(event, target) {
        const { key, objectiveKey } = target.dataset;
        const status = Number(target.dataset.status);
        const objective = this.document.system.quests[key]?.objectives?.[objectiveKey];
        if (!objective || Number.isNaN(status)) return;
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.status`]: status });
    }

    static async #togglePlayerOwner(event, target) {
        const { key, userId } = target.dataset;
        const quest = this.document.system.quests[key];
        if (!quest || !userId) return;

        const currentOwners = Array.isArray(quest.playerOwners) ? [...quest.playerOwners] : [];
        const hasOwner = currentOwners.includes(userId);
        const playerOwners = hasOwner ? currentOwners.filter(id => id !== userId) : [...currentOwners, userId];
        const update = {
            [`system.quests.${key}.playerOwners`]: playerOwners,
        };

        if (!hasOwner && Number(quest.audience ?? 0) !== 1) {
            update[`system.quests.${key}.audience`] = 1;
        }

        await this.document.update(update);
    }

    static async #addLinkedDocument(event, target) {
        const questKey = target.dataset.key;
        const linkKey = foundry.utils.randomID();
        const quest = this.document.system.quests[questKey];
        await this.document.update({
            [`system.quests.${questKey}.linkedPages.${linkKey}`]: {
                ...DSAQuestLogEntry.createDocumentReference(),
                sort: DSAQuestLogEntry.nextSortValue(quest?.linkedPages),
            },
        });
    }

    static async #removeLinkedDocument(event, target) {
        const { key, linkKey } = target.dataset;
        await this.document.update({ [`system.quests.${key}.linkedPages.${linkKey}`]: _del });
    }

    static async #openLinkedDocument(event, target) {
        const document = await fromUuid(target.dataset.uuid);
        if (!document) return;
        if (document.documentName === 'JournalEntryPage') return document.parent?.sheet?.render(true, { pageId: document.id });

        document.sheet?.render(true);
    }

    static async #toggleLinkedDocumentVisibility(event, target) {
        const { key, linkKey } = target.dataset;
        const reference = this.document.system.quests[key]?.linkedPages?.[linkKey];
        if (!reference) return;

        await this.document.update({ [`system.quests.${key}.linkedPages.${linkKey}.visible`]: reference.visible === false });
    }

    static async #openInvolvedPerson(event, target) {
        const uuid = target.dataset.uuid;
        const opened = await DSAQuestLogEntry.openInvolvedPersonJournal(uuid);
        if (opened) return;
        const actor = uuid ? await fromUuid(uuid) : null;
        if (actor?.documentName === 'Actor') actor.sheet?.render(true);
    }

    static async #openInvolvedItem(event, target) {
        await DSAQuestLogEntry.openInvolvedItem(target.dataset.uuid);
    }

    static async #openInvolvedNote(event, target) {
        await DSAQuestLogEntry.openInvolvedNote(target.dataset.uuid);
    }

    static async #pickQuestImage(event, target) {
        const questKey = target.dataset.key;
        const quest = this.document.system.quests[questKey];
        if (!quest) return;

        const FilePicker = foundry.applications.apps.FilePicker;
        const current = quest.image || '';
        const picker = new FilePicker.implementation({
            type: 'image',
            current,
            callback: (path) => this.document.update(DSAQuestLogEntry.questImageUpdate(questKey, path)),
            document: this.document,
            position: {
                top: this.position.top + 40,
                left: this.position.left + 10,
            },
        });
        await picker.browse();
    }

    static async #configureQuestImageFrame(event, target) {
        const questKey = target.dataset.key;
        const quest = this.document.system.quests[questKey];
        const imageSrc = quest?.image;
        if (!imageSrc) {
            ui.notifications.warn('DSAQUESTLOG.questImageFrameNeedImage', { localize: true });
            return;
        }

        return ImageFrameDialog.configure({
            id: `dsa-quest-image-frame-${this.document.id}-${questKey}`,
            title: 'DSAQUESTLOG.FIELDS.quests.imageFrame.label',
            imageSrc,
            preset: 'banner',
            frame: quest.imageFrame,
            onSave: (frame) => this.document.update(DSAQuestLogEntry.questImageFrameUpdate(questKey, frame)),
        });
    }

    static #showQuestImage(event, target) {
        const questKey = target.dataset.key;
        const quest = this.document.system.quests[questKey];
        if (!quest?.image) {
            ui.notifications.warn('DSAQUESTLOG.questImageFrameNeedImage', { localize: true });
            return;
        }
        return DSA5_Utility.showArtwork({
            img: quest.image,
            name: quest.title,
            uuid: this.document.uuid,
            isOwner: true,
        });
    }

    static #clearQuestImage(event, target) {
        const questKey = target.dataset.key;
        return this.document.update(DSAQuestLogEntry.questImageUpdate(questKey, ''));
    }
}
