import { DSAQuestLogEntry } from '../../data/journal/dsaquestlog.js';

export class QuestLogFeature {
    static #parent;
    static #lastSelectedQuest = null;

    #search;

    constructor(parent) {
        QuestLogFeature.#parent = parent;
    }

    get element() {
        return QuestLogFeature.#parent.element;
    }

    static actions = {
        selectQuest: QuestLogFeature.selectQuest,
        newQuest: QuestLogFeature.newQuest,
        editQuest: QuestLogFeature.editQuest,
        toggleQuestVisibility: QuestLogFeature.toggleQuestVisibility,
        openQuestReference: QuestLogFeature.openQuestReference,
        toggleQuestObjectiveDone: QuestLogFeature.toggleQuestObjectiveDone,
        toggleObjectiveVisibility: QuestLogFeature.toggleObjectiveVisibility,
    };

    async _preparePartContext(context, _options) {
        const settings = game.settings.get('dsa5', DSAQuestLogEntry.SETTING_NAME) || { activated: [] };
        const journals = (await Promise.all((settings.activated || []).map(async journal => {
            try {
                return await fromUuid(journal.uuid);
            } catch (_error) {
                return null;
            }
        }))).filter(Boolean);

        const quests = [];
        let selectedQuest = null;
        for (const journal of journals) {
            for (const page of journal.pages || []) {
                if (page.type !== 'dsaquestlog') continue;
                for (const [questKey, rawQuest] of Object.entries(page.system?.quests || {})) {
                    if (!rawQuest || !DSAQuestLogEntry.isVisibleToUser(rawQuest)) continue;
                    const quest = foundry.utils.deepClone(rawQuest);
                    await DSAQuestLogEntry.prepareQuestEntry(quest, { page, key: questKey });
                    quest.uuid = page.uuid;
                    quest.juuid = page.parent?.uuid;
                    quest.questKey = questKey;
                    quests.push(quest);

                    if (
                        QuestLogFeature.#lastSelectedQuest &&
                        QuestLogFeature.#lastSelectedQuest.pageUuid === page.uuid &&
                        QuestLogFeature.#lastSelectedQuest.questKey === questKey
                    ) {
                        selectedQuest = quest;
                    }
                }
            }
        }

        const groupedQuests = QuestLogFeature.#groupQuests(quests);

        if (selectedQuest && !quests.some(quest => quest.uuid === selectedQuest.uuid && quest.questKey === selectedQuest.questKey)) {
            selectedQuest = null;
        }

        context.questGroups = groupedQuests;
        context.detailData = selectedQuest;
    }

    static #groupQuests(quests) {
        const collator = new Intl.Collator(game.i18n?.lang, { sensitivity: 'base', numeric: true });
        const groups = new Map();
        for (const quest of quests) {
            const key = quest.groupLabel || _loc('DSAQUESTLOG.ungrouped');
            if (!groups.has(key)) groups.set(key, []);
            groups.get(key).push(quest);
        }

        for (const entries of groups.values()) {
            entries.sort((a, b) => {
                if (!!a.pinToTop !== !!b.pinToTop) return a.pinToTop ? -1 : 1;
                const statusOrder = DSAQuestLogEntry.STATUS_SORT_ORDER[a.status] - DSAQuestLogEntry.STATUS_SORT_ORDER[b.status];
                if (statusOrder) return statusOrder;
                return (a.title || '').localeCompare(b.title || '', game.i18n?.lang, { sensitivity: 'base' });
            });
        }

        return Array.from(groups.entries())
            .sort(([left], [right]) => collator.compare(left, right))
            .map(([group, questsInGroup]) => ({ group, quests: questsInGroup }));
    }

    static updateSelectionUI(clickedElement) {
        const listItem = clickedElement.closest('.persona-list-item');
        if (!listItem) return;

        const listContainer = listItem.closest('.questlog-list');
        listContainer?.querySelectorAll('.persona-list-item.selected').forEach(item => item.classList.remove('selected'));
        listItem.classList.add('selected');
    }

    static async selectQuest(event, target) {
        const listItem = target.closest('.persona-list-item');
        if (!listItem) return;

        const page = await fromUuid(listItem.dataset.questUuid);
        const questKey = listItem.dataset.questKey;
        const entry = page?.system?.quests?.[questKey];
        if (!page || !entry) return;

        const quest = foundry.utils.deepClone(entry);
        await DSAQuestLogEntry.prepareQuestEntry(quest, { page, key: questKey });
        QuestLogFeature.#lastSelectedQuest = { pageUuid: page.uuid, questKey };
        QuestLogFeature.updateSelectionUI(listItem);
        await QuestLogFeature.displayQuestDetails(quest, listItem);
    }

    static async displayQuestDetails(quest, target) {
        const container = target.closest('.personae-two-column')?.querySelector('.persona-details-container');
        if (!container) return;

        const detailHTML = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/questlog-detail.hbs', quest);
        container.innerHTML = detailHTML;
    }

    static async newQuest() {
        await DSAQuestLogEntry.startCreation(QuestLogFeature.#parent, QuestLogFeature.#parent?.actualTimeComponents?.() ?? game.time.calendar.timeToComponents(game.time.worldTime));
    }

    static async editQuest(event, target) {
        const page = await fromUuid(target.dataset.questUuid);
        const questKey = target.dataset.questKey;
        if (!page || !questKey) return;

        await QuestLogFeature.#parent.openDocumentSheet(page, { currentKey: questKey });
    }

    static async toggleQuestVisibility(event, target) {
        if (!game.user.isGM) return;
        const page = await fromUuid(target.dataset.questUuid);
        const questKey = target.dataset.questKey;
        const entry = page?.system?.quests?.[questKey];
        if (!page || !entry) return;

        await page.update({ [`system.quests.${questKey}.visible`]: !entry.visible });
    }

    static async toggleQuestObjectiveDone(event, target) {
        if (!game.user.isGM) return;
        const page = await fromUuid(target.dataset.questUuid);
        const { questKey, objectiveKey } = target.dataset;
        const objective = page?.system?.quests?.[questKey]?.objectives?.[objectiveKey];
        if (!page || !objective) return;

        await page.update({ [`system.quests.${questKey}.objectives.${objectiveKey}.done`]: !objective.done });
    }

    static async toggleObjectiveVisibility(event, target) {
        if (!game.user.isGM) return;
        const page = await fromUuid(target.dataset.questUuid);
        const { questKey, objectiveKey } = target.dataset;
        const objective = page?.system?.quests?.[questKey]?.objectives?.[objectiveKey];
        if (!page || !objective) return;

        await page.update({ [`system.quests.${questKey}.objectives.${objectiveKey}.visible`]: !objective.visible });
    }

    static async openQuestReference(event, target) {
        const uuid = target.dataset.uuid || target.dataset.pageUuid;
        const entryKey = target.dataset.entryKey;
        await QuestLogFeature.openReference({ uuid, entryKey });
    }

    static async openReference({ uuid, entryKey = null }) {
        const document = await fromUuid(uuid);
        if (!document) return;

        if (document.documentName === 'JournalEntryPage') {
            await QuestLogFeature.#parent.openDocumentSheet(document.parent, { pageId: document.id });
            return;
        }

        if (document.documentName === 'JournalEntry') {
            await QuestLogFeature.#parent.openDocumentSheet(document);
            return;
        }

        await QuestLogFeature.#parent.openDocumentSheet(document, { currentKey: entryKey });
    }

    onRenderListeners() {
        this.#search ??= new foundry.applications.ux.SearchFilter({
            inputSelector: 'input.questSearch[type=search]',
            contentSelector: '.questlog-list',
            callback: this.#onSearchFilter.bind(this),
        });
        this.#search.bind(this.element);
    }

    _tearDown() {
        this.#search?.unbind();
    }

    #onSearchFilter(_event, query, rgx, html) {
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

        for (const group of html.querySelectorAll('.faction-group')) {
            const visibleChildren = Array.from(group.querySelectorAll('.persona-list-item')).some(item => !item.hidden);
            group.hidden = !visibleChildren;
        }
    }
}