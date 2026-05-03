import { DSAQuestLogEntry } from "../data/journal/dsaquestlog.js";
import CalendarListJournalSheet from "./calendar_list_journal_sheet.js";

export class DSAQuestLogEntrySheet extends CalendarListJournalSheet {
    static objectKey = 'quests';
    static settingName = DSAQuestLogEntry.SETTING_NAME;

    static DEFAULT_OPTIONS = {
        actions: {
            addObjective: this.#addObjective,
            removeObjective: this.#removeObjective,
            toggleObjectiveDone: this.#toggleObjectiveDone,
            toggleObjectiveVisibility: this.#toggleObjectiveVisibility,
            togglePlayerOwner: this.#togglePlayerOwner,
            addLinkedPage: this.#addLinkedPage,
            removeLinkedPage: this.#removeLinkedPage,
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
        entry.doneObjectives = objectives.filter(objective => objective.done).length;
        entry.progressText = `${entry.doneObjectives}/${entry.totalObjectives}`;
    }

    async _afterRegistrationChange() {
        await game.dsa5?.apps?.CalendarPicker?.refreshParts?.(['questlog', 'config']);
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
        const objectiveEntries = Object.entries(quest.objectives || {})
            .filter(([, objective]) => objective && (objective.visible || game.user.isGM))
            .map(([objectiveKey, objective]) => ({
                objectiveKey,
                ...objective,
            }));
        const linkedPageEntries = Object.entries(quest.linkedPages || {}).map(([linkKey, link]) => ({
            linkKey,
            uuid: link?.uuid || link?.pageUuid || '',
        }));

        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/journal/questlogentry_edit_detail.hbs', {
            elem: quest,
            key,
            isGM: game.user.isGM,
            document: this.document,
            availableMonths,
            availablePlayers,
            objectiveEntries,
            linkedPageEntries,
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
        await this.document.update({
            [`system.quests.${questKey}.objectives.${objectiveKey}`]: {
                text: _loc('DSAQUESTLOG.newObjectivePlaceholder'),
                done: false,
                visible: true,
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
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.done`]: !objective.done });
    }

    static async #toggleObjectiveVisibility(event, target) {
        const { key, objectiveKey } = target.dataset;
        const objective = this.document.system.quests[key]?.objectives?.[objectiveKey];
        if (!objective) return;
        await this.document.update({ [`system.quests.${key}.objectives.${objectiveKey}.visible`]: !objective.visible });
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

    static async #addLinkedPage(event, target) {
        const questKey = target.dataset.key;
        const linkKey = foundry.utils.randomID();
        await this.document.update({ [`system.quests.${questKey}.linkedPages.${linkKey}`]: DSAQuestLogEntry.createPageReference() });
    }

    static async #removeLinkedPage(event, target) {
        const { key, linkKey } = target.dataset;
        await this.document.update({ [`system.quests.${key}.linkedPages.${linkKey}`]: _del });
    }
}