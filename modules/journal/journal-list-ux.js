export const JOURNAL_LIST_UX_PARTIALS = [
    'systems/dsa5/templates/journal/parts/list-toolbar.hbs',
    'systems/dsa5/templates/journal/parts/list-group.hbs',
    'systems/dsa5/templates/journal/parts/view-group.hbs',
    'systems/dsa5/templates/journal/parts/status-picker.hbs',
];

export default class JournalListUx {
    static SETTING_NAME = 'journalListUx';
    static OPEN_ONLY_SETTING = 'questlogFilterOpenOnly';
    static GROUP_HEADING_CLASS = 'journal-list-group-name';

    static DEFAULT_STATE = {
        quest: { filters: { statuses: {} }, sort: 'status' },
        personae: { filters: { important: false, visible: false, hideEmptyFields: true }, sort: 'name' },
        events: { filters: { categories: {} }, sort: 'date' },
        city: { filters: { kinds: {} }, sort: 'kind' },
    };

    static collator() {
        return new Intl.Collator(game.i18n?.lang, { sensitivity: 'base', numeric: true });
    }

    static readState(typeKey) {
        const stored = game.settings.get('dsa5', this.SETTING_NAME) || {};
        const defaults = this.DEFAULT_STATE[typeKey] || { filters: {}, sort: 'name' };
        const current = foundry.utils.mergeObject(foundry.utils.duplicate(defaults), stored[typeKey] || {}, { inplace: false });
        if (typeKey === 'quest' && !!game.settings.get('dsa5', this.OPEN_ONLY_SETTING)) {
            current.filters.statuses = { ...(current.filters.statuses || {}), 1: false, 2: false };
        }
        return current;
    }

    static async writeState(typeKey, patch = {}) {
        const all = foundry.utils.duplicate(game.settings.get('dsa5', this.SETTING_NAME) || {});
        const current = this.readState(typeKey);
        const next = foundry.utils.mergeObject(current, patch, { inplace: false });
        all[typeKey] = next;
        await game.settings.set('dsa5', this.SETTING_NAME, all);
        if (typeKey === 'quest') {
            const statuses = next.filters?.statuses || {};
            const onlyOpen = statuses[1] === false && statuses[2] === false && statuses[0] !== false;
            await game.settings.set('dsa5', this.OPEN_ONLY_SETTING, onlyOpen);
        }
        return next;
    }

    static isEnabled(map, key) {
        if (!map || typeof map !== 'object') return true;
        return map[key] !== false;
    }

    static comparePinThenTitle(a, b, titleKey = 'title') {
        if (!!a.pinToTop !== !!b.pinToTop) return a.pinToTop ? -1 : 1;
        return this.collator().compare(a[titleKey] || '', b[titleKey] || '');
    }

    /**
     * @param {[string, object][]} pairs
     * @param {{ getGroupInfo: Function, uniqueFirst?: boolean, collapsedGroups?: Set<string>, compareGroups?: Function }} options
     */
    static groupEntries(pairs, { getGroupInfo, uniqueFirst = false, collapsedGroups = new Set(), compareGroups = null } = {}) {
        const groups = new Map();
        const labels = new Map();

        for (const [key, entry] of pairs) {
            const item = { ...entry, key };
            let infos = getGroupInfo(entry) || [];
            if (!infos.length) infos = [{ key: '', label: '' }];
            if (uniqueFirst) infos = infos.slice(0, 1);

            for (const info of infos) {
                const groupKey = info.key ?? '';
                if (!groups.has(groupKey)) groups.set(groupKey, []);
                groups.get(groupKey).push(item);
                labels.set(groupKey, info.label ?? groupKey);
            }
        }

        const keys = Array.from(groups.keys());
        keys.sort((left, right) => (compareGroups ? compareGroups(left, right) : this.collator().compare(labels.get(left) || left, labels.get(right) || right)));

        return keys.map(groupKey => ({
            groupKey,
            groupLabel: labels.get(groupKey) || groupKey,
            entries: groups.get(groupKey),
            count: groups.get(groupKey).length,
            isCollapsed: collapsedGroups.has(groupKey),
            hideHeader: false,
        }));
    }

    static ungroupedEntries(pairs) {
        const entries = pairs.map(([key, entry]) => ({ ...entry, key }));
        return [{
            groupKey: '',
            groupLabel: '',
            entries,
            count: entries.length,
            isCollapsed: false,
            hideHeader: true,
        }];
    }

    static applyDomFilters(root, { itemSelector, groupSelector = '.faction-group', query, rgx, searchSelectors = [], datasetKeys = [], predicates = [] } = {}) {
        if (!root) return;

        for (const entry of root.querySelectorAll(itemSelector)) {
            const matchesFilters = predicates.every(predicate => predicate(entry));
            let matchesSearch = true;
            if (query && rgx) {
                const texts = searchSelectors.map(selector => entry.querySelector(selector)?.textContent || '');
                for (const datasetKey of datasetKeys) {
                    texts.push(entry.dataset[datasetKey] || '');
                }
                matchesSearch = texts.some(text => foundry.applications.ux.SearchFilter.testQuery(rgx, text));
            }
            entry.hidden = !(matchesFilters && matchesSearch);
        }

        if (!groupSelector) return;
        for (const group of root.querySelectorAll(groupSelector)) {
            if (group.dataset.hideHeader === 'true') continue;
            const visibleChildren = Array.from(group.querySelectorAll(itemSelector)).some(item => !item.hidden);
            group.hidden = !visibleChildren;
        }
    }

    static syncTocVisibility(pageSheet) {
        const pageId = pageSheet?.page?.id || pageSheet?.document?.id;
        const journalEl = pageSheet?.document?.parent?.sheet?.element;
        const tocRoot = journalEl?.querySelector(`.toc [data-page-id="${pageId}"]`);
        if (!tocRoot || !pageSheet.element) return;

        for (const item of tocRoot.querySelectorAll('li.heading[data-anchor]')) {
            const slug = item.dataset.anchor;
            if (!slug) continue;
            const heading = pageSheet.element.querySelector(`[data-anchor="${CSS.escape(slug)}"]`);
            const hiddenBlock = heading?.closest('[hidden], .persona-detail-view, .event-card, .citydetails-detail-view, .journal-list-entry, .faction-group');
            item.hidden = !heading || heading.hidden || hiddenBlock?.hidden === true;
        }
    }

    static async openListMenu(host, target, menuItems) {
        const menu = new foundry.applications.ux.ContextMenu(
            host,
            '',
            menuItems,
            { jQuery: false, fixed: true, eventName: 'none' },
        );
        ui.context?.close();
        await menu.render(target, { animate: true });
        ui.context = menu;
    }

    static buildToc(html, { groupHeadingClass = this.GROUP_HEADING_CLASS, entryHeadingClass, includeElement = true } = {}) {
        const cls = JournalEntryPage.implementation;
        const root = { level: 0, children: [] };
        const stack = [root];
        const isMatch = element => {
            if (!(element instanceof HTMLHeadingElement)) return false;
            if (groupHeadingClass && element.classList.contains(groupHeadingClass)) return true;
            return !!(entryHeadingClass && element.classList.contains(entryHeadingClass));
        };
        const searchHeadings = element => {
            if (isMatch(element)) {
                const node = cls._makeHeadingNode(element, { includeElement });
                while (stack.length > 1 && node.level <= stack.at(-1).level) stack.pop();
                stack.at(-1).children.push(node);
                stack.push(node);
            }
            for (const child of (element.children || [])) searchHeadings(child);
        };
        if (Array.isArray(html)) html.forEach(searchHeadings);
        else if (html) searchHeadings(html);
        const toc = cls._flattenTOC(root.children);
        if (includeElement) {
            for (const node of Object.values(toc)) {
                if (node.element) node.element.dataset.anchor = node.slug;
            }
        }
        return toc;
    }
}
