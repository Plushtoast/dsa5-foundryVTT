import { DSAQuestLogEntry } from "../data/journal/dsaquestlog.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";

export class DSAQuestLogEntrySheet extends CalendarListJournalSheet {
    static objectKey = 'quests';
    static settingName = DSAQuestLogEntry.SETTING_NAME;
    static #SORT_DRAG_TYPE = 'dsaQuestNestedSort';

    static DEFAULT_OPTIONS = {
        actions: {
            addObjective: this.#addObjective,
            removeObjective: this.#removeObjective,
            toggleObjectiveDone: this.#toggleObjectiveDone,
            toggleObjectiveVisibility: this.#toggleObjectiveVisibility,
            togglePlayerOwner: this.#togglePlayerOwner,
            addLinkedDocument: this.#addLinkedDocument,
            removeLinkedDocument: this.#removeLinkedDocument,
            openLinkedDocument: this.#openLinkedDocument,
            toggleLinkedDocumentVisibility: this.#toggleLinkedDocumentVisibility,
            toggleObjectiveState: this.#toggleObjectiveState,
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
            scrollable: ['', '.scrollable', '.persona-details-container'],
        },
        footer: super.EDIT_PARTS.footer,
    };

    static VIEW_PARTS = {
        content: {
            classes: ['flex1'],
            template: 'systems/dsa5/templates/journal/questlogentry_view.hbs',
        },
    };

    static sortEntryPairs([, a], [, b]) {
        if (!!a.pinToTop !== !!b.pinToTop) return a.pinToTop ? -1 : 1;
        const statusOrder = DSAQuestLogEntry.STATUS_SORT_ORDER[a.status] - DSAQuestLogEntry.STATUS_SORT_ORDER[b.status];
        if (statusOrder) return statusOrder;
        return (a.title || '').localeCompare(b.title || '', game.i18n?.lang, { sensitivity: 'base' });
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

    async _onDetailRendered(_key) {
        this.#bindNestedSortDragDrop();
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

    static buildTOC(html, { includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const searchHeadings = element => {
            if ((element instanceof HTMLHeadingElement) && element.classList.contains('questlog-detail-name')) {
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

    onSearchFilter(_event, query, rgx, html) {
        this.isView ? this.#viewFilter(_event, query, rgx, html) : this.#editFilter(_event, query, rgx, html);
    }

    #viewFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll('.persona-detail-view')) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const title = entry.querySelector('.questlog-detail-name')?.textContent || '';
            const subtitle = entry.querySelector('.persona-detail-subtitle')?.textContent || '';
            const content = entry.querySelector('.persona-detail-content')?.textContent || '';
            const isMatch = [title, subtitle, content].some(text => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(text)));
            entry.hidden = !isMatch;
        }
    }

    #editFilter(_event, query, rgx, html) {
        for (const entry of html.querySelectorAll('.persona-list-item')) {
            if (!query) {
                entry.hidden = false;
                continue;
            }

            const title = entry.querySelector('.persona-list-name')?.textContent || '';
            const meta = entry.querySelector('.persona-list-meta')?.textContent || '';
            const summary = entry.querySelector('.questlog-summary')?.textContent || '';
            const isMatch = [title, meta, summary].some(text => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(text)));
            entry.hidden = !isMatch;
        }
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
        const objectiveEntries = DSAQuestLogEntry.sortedTypedObjectEntries(quest.objectives)
            .filter(([, objective]) => objective && (objective.visible || game.user.isGM))
            .map(([objectiveKey, objective]) => ({
                objectiveKey,
                ...objective,
                ...DSAQuestLogEntry.prepareObjectiveState(objective),
            }));
        const linkedDocumentEntries = DSAQuestLogEntry.sortedTypedObjectEntries(quest.linkedPages).map(([linkKey, link]) => ({
            linkKey,
            uuid: link?.uuid || link?.pageUuid || '',
            visible: link?.visible !== false,
        }));

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
                visible: true,
                sort: DSAQuestLogEntry.nextSortValue(quest?.objectives),
            },
        });
    }

    static async #removeObjective(event, target) {
        const { key, objectiveKey } = target.dataset;
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}`]: _del });
    }

    static async #toggleObjectiveDone(event, target) {
        const { key, objectiveKey } = target.dataset;
        const objective = this.document.system.quests[key]?.objectives?.[objectiveKey];
        if (!objective) return;

        const nextState = DSAQuestLogEntry.nextObjectiveState(objective);
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.status`]: nextState });
    }

    static async #toggleObjectiveVisibility(event, target) {
        const { key, objectiveKey } = target.dataset;
        const objective = this.document.system.quests[key]?.objectives?.[objectiveKey];
        if (!objective) return;
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.visible`]: !objective.visible });
    }

    static async #toggleObjectiveState(event, target) {
        const { key, objectiveKey } = target.dataset;
        const objective = this.document.system.quests[key]?.objectives?.[objectiveKey];
        if (!objective) return;

        const nextState = DSAQuestLogEntry.nextObjectiveState(objective);
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.status`]: nextState });
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
}
