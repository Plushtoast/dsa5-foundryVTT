import JournalListUx, { JOURNAL_LIST_UX_PARTIALS } from './journal-list-ux.js';
import JournalStatusPicker from './journal-status-picker.js';

export default class CalendarListJournalSheet extends foundry.applications.sheets.journal.JournalEntryPageHandlebarsSheet {
    #search;
    #collapsedGroups = new Set();

    static #pageTitleTOCPlaceholderSlug = '__dsa5-custom-journal-page-title';

    static settingName = null;
    static listUxPartials = JOURNAL_LIST_UX_PARTIALS;

    static DEFAULT_OPTIONS = {
        actions: {
            selectEntry: CalendarListJournalSheet.#selectEntry,
            toggleVisibility: CalendarListJournalSheet.#toggleVisibility,
            removeEntry: CalendarListJournalSheet.#removeEntry,
            addEntry: CalendarListJournalSheet.#addEntry,
            listMenu: CalendarListJournalSheet.#listMenu,
            toggleListGroup: CalendarListJournalSheet.#toggleListGroup,
            openStatusPicker: CalendarListJournalSheet.#openStatusPicker,
            editEvent: CalendarListJournalSheet.#editEvent,
        },
        position: {
            width: 1000,
            height: 700
        },
        includeTOC: true,
    };

    static sortEntryPairs([, a], [, b]) {
        return 0;
    }

    get listUxDescriptor() {
        return null;
    }

    _initializeApplicationOptions(options) {
        const applicationOptions = super._initializeApplicationOptions(options);
        for (const [key, handler] of Object.entries(applicationOptions.actions ?? {})) {
            const fn = typeof handler === 'object' ? handler.handler : handler;
            const commitAndRun = async function(event, target) {
                const skipSubmit = ['listMenu', 'toggleListGroup', 'openStatusPicker', 'editEvent', 'setQuestStatus', 'setObjectiveStatus'].includes(key);
                if (!skipSubmit && !this.isView && this.isEditable && this.form) await this.submit();
                return fn?.call(this, event, target);
            };
            applicationOptions.actions[key] = typeof handler === 'object'
                ? { ...handler, handler: commitAndRun }
                : commitAndRun;
        }
        return applicationOptions;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const entries = Object.entries(foundry.utils.duplicate(this.document.system[this.constructor.objectKey] || {}))
            .filter(([, value]) => value && (value.visible || game.user.isGM));

        context.sortedEntries = Object.fromEntries(entries);
        context.isGM = game.user.isGM;
        context.isRegistered = this.constructor.settingName
            ? game.settings.get('dsa5', this.constructor.settingName).activated.some(x => x.uuid == this.document.parent.uuid)
            : false;

        await this._prepareEntries(context, options);
        this.#applyListUxGrouping(context);

        if (!this.isView) {
            if (options.currentKey) this.currentKey = options.currentKey;

            if (this.currentKey && context.sortedEntries[this.currentKey]) {
                context.currentKey = this.currentKey;
                context.detailHTML = await this.renderDetail(this.currentKey);
            }
        }

        return context;
    }

    #applyListUxGrouping(context) {
        const descriptor = this.listUxDescriptor;
        const pairs = Object.entries(context.sortedEntries);
        if (!descriptor) {
            pairs.sort((a, b) => this.constructor.sortEntryPairs(a, b));
            context.sortedEntries = Object.fromEntries(pairs);
            context.entryGroups = JournalListUx.ungroupedEntries(pairs);
            Object.assign(context, this.#toolbarContext());
            return;
        }

        const uxState = JournalListUx.readState(descriptor.typeKey);
        context.listUxState = uxState;
        pairs.sort((left, right) => descriptor.compare(left[1], right[1], uxState.sort));
        context.sortedEntries = Object.fromEntries(pairs);

        const flatten = descriptor.ungroupOnSort && uxState.sort === descriptor.ungroupOnSort;
        context.entryGroups = flatten
            ? JournalListUx.ungroupedEntries(pairs)
            : JournalListUx.groupEntries(pairs, {
                getGroupInfo: entry => descriptor.getGroupInfo(entry),
                uniqueFirst: !!this.isView && !!descriptor.uniqueFirstInView,
                collapsedGroups: this.#collapsedGroups,
                compareGroups: descriptor.compareGroups,
            });
        Object.assign(context, this.#toolbarContext());
    }

    #toolbarContext() {
        const descriptor = this.listUxDescriptor;
        return {
            searchPlaceholder: descriptor?.searchPlaceholder || 'Book.search',
            addTooltip: descriptor?.addTooltip || 'Create',
            showAdd: !this.isView,
            showMenu: !!descriptor,
            search: this.#search?.query || '',
        };
    }

    async _onRender(context, options) {
        await super._onRender(context, options);

        this.#search ??= new foundry.applications.ux.SearchFilter({
            inputSelector: 'input[type=search]',
            contentSelector: '.eventscontainer',
            callback: this.onSearchFilter.bind(this)
        });
        if (options.search) {
            this.#search.query = options.search;
            options.search = null;
        }
        this.#search.bind(this.element);
        JournalStatusPicker.bind(this.element);
        this.#applyListUxFilters();
        if (this.options.includeTOC) this.toc = this.#buildTOC();
        JournalListUx.syncTocVisibility(this);
        this.#restoreSelection();

        if (this.isView) return;

        const registrationToggle = this.element.querySelector('.showInCalendar');
        if (registrationToggle && this.constructor.settingName) {
            registrationToggle.addEventListener('change', async event => {
                const isChecked = event.target.checked;
                const settings = game.settings.get('dsa5', this.constructor.settingName);
                if (isChecked) {
                    if (!settings.activated.some(x => x.uuid === this.document.parent.uuid)) {
                        settings.activated.push({ uuid: this.document.parent.uuid, name: this.document.parent.name });
                    }
                } else {
                    settings.activated = settings.activated.filter(x => x.uuid !== this.document.parent.uuid);
                }
                await game.settings.set('dsa5', this.constructor.settingName, settings);
                await this._afterRegistrationChange();
            });
        }

        await this._onRenderEditable(context, options);
    }

    onSearchFilter(_event, query, rgx, html) {
        this.#applyListUxFilters(html, query, rgx);
    }

    #applyListUxFilters(html = null, query = null, rgx = null) {
        const root = html || this.element?.querySelector('.eventscontainer');
        const descriptor = this.listUxDescriptor;
        if (!root) return;

        const searchInput = this.element?.querySelector('input[type=search]');
        if (query == null) {
            query = foundry.applications.ux.SearchFilter.cleanQuery(searchInput?.value || this.#search?.query || '');
            rgx = query ? new RegExp(RegExp.escape(query), 'i') : null;
        }

        if (!descriptor) return;

        const uxState = JournalListUx.readState(descriptor.typeKey);
        const search = this.isView ? descriptor.viewSearch : descriptor.editSearch;
        JournalListUx.applyDomFilters(root, {
            itemSelector: this.isView ? descriptor.viewItemSelector : descriptor.editItemSelector,
            query,
            rgx,
            searchSelectors: search?.selectors || [],
            datasetKeys: search?.datasetKeys || [],
            predicates: (descriptor.filters || [])
                .filter(filter => this.#filterIsActive(filter, uxState))
                .map(filter => entry => filter.predicate(entry, uxState)),
        });
        JournalListUx.syncTocVisibility(this);
    }

    #filterIsActive(filter, uxState) {
        if (filter.gmOnly && !game.user.isGM) return false;
        if (filter.type === 'set') return true;
        return !!uxState.filters?.[filter.key];
    }

    #restoreSelection() {
        if (this.isView || !this.currentKey) return;
        const selected = this.element?.querySelector(`[data-key="${CSS.escape(this.currentKey)}"]`);
        if (!selected) return;

        this.constructor.updateSelectionUI(selected);
        const group = selected.closest('.faction-group');
        if (group?.classList.contains('collapsed')) {
            group.classList.remove('collapsed');
            group.querySelector('[data-action="toggleListGroup"]')?.setAttribute('aria-expanded', 'true');
            this.#collapsedGroups.delete(group.dataset.groupKey);
        }
        if (!selected.hidden) selected.scrollIntoView({ block: 'nearest' });
    }

    static async #toggleVisibility(ev, target) {
        const key = target.dataset.key;
        const entry = this.document.system[this.constructor.objectKey][key];
        if (!entry) return;
        await this.document.update({ [`system.${this.constructor.objectKey}.${key}.visible`]: !entry.visible });
    }

    static async #selectEntry(event, target) {
        const detailsContainer = this.element.querySelector('.persona-details-container');
        if (!detailsContainer) return;

        const key = target.dataset.key;
        this.currentKey = key;

        if (!key) return;

        this.constructor.updateSelectionUI(target);

        detailsContainer.innerHTML = await this.renderDetail(key);
        await this._onDetailRendered(key);
    }

    static updateSelectionUI(clickedElement) {
        const listItem = clickedElement.closest('[data-key]');
        if (!listItem) return;

        const listContainer = listItem.closest('.eventscontainer, .personae-list, .questlog-list');
        listContainer?.querySelectorAll('.selected').forEach(item => item.classList.remove('selected'));
        listItem.classList.add('selected');
    }

    static #toggleListGroup(_event, target) {
        const group = target.closest('.faction-group');
        const key = group?.dataset.groupKey;
        if (!group || group.dataset.hideHeader === 'true') return;

        const collapsed = !group.classList.contains('collapsed');
        group.classList.toggle('collapsed', collapsed);
        target.closest('[data-action="toggleListGroup"]')?.setAttribute('aria-expanded', String(!collapsed));
        if (!key) return;
        if (collapsed) this.#collapsedGroups.add(key);
        else this.#collapsedGroups.delete(key);
    }

    static async #listMenu(event, target) {
        event.preventDefault();
        event.stopPropagation();

        const descriptor = this.listUxDescriptor;
        if (!descriptor) return;

        const uxState = JournalListUx.readState(descriptor.typeKey);
        const menuItems = [];

        for (const filter of descriptor.filters || []) {
            if (filter.gmOnly && !game.user.isGM) continue;
            if (filter.type === 'set') {
                for (const option of filter.options()) {
                    const active = JournalListUx.isEnabled(uxState.filters?.[filter.key], option.key);
                    menuItems.push({
                        label: option.label,
                        icon: CalendarListJournalSheet.#menuIcon(option.icon || filter.icon, active),
                        onClick: () => this.#toggleSetFilter(filter.key, option.key),
                    });
                }
                continue;
            }
            const active = !!uxState.filters?.[filter.key];
            menuItems.push({
                label: _loc(filter.label),
                icon: CalendarListJournalSheet.#menuIcon(filter.icon, active),
                onClick: () => this.#toggleFilter(filter.key),
            });
        }

        for (const mode of descriptor.sortModes || []) {
            menuItems.push({
                label: _loc(mode.label),
                icon: uxState.sort === mode.key ? '<i class="fas fa-check"></i>' : '<i class="fas fa-arrow-down-a-z"></i>',
                onClick: () => this.#setSortMode(mode.key),
            });
        }

        await JournalListUx.openListMenu(this.element, target, menuItems);
    }

    static #menuIcon(icon, active) {
        if (active) return '<i class="fas fa-check"></i>';
        const cls = !icon ? 'fas fa-filter' : (/\s/.test(icon) ? icon : `fas ${icon}`);
        return `<i class="${cls}"></i>`;
    }

    async #toggleFilter(filterKey) {
        const descriptor = this.listUxDescriptor;
        const uxState = JournalListUx.readState(descriptor.typeKey);
        await JournalListUx.writeState(descriptor.typeKey, {
            filters: { ...uxState.filters, [filterKey]: !uxState.filters?.[filterKey] },
        });
        const filter = (descriptor.filters || []).find(item => item.key === filterKey);
        if (filter?.rerender) await this.render();
        else this.#applyListUxFilters();
    }

    async #toggleSetFilter(filterKey, optionKey) {
        const descriptor = this.listUxDescriptor;
        const uxState = JournalListUx.readState(descriptor.typeKey);
        const current = { ...(uxState.filters?.[filterKey] || {}) };
        current[optionKey] = current[optionKey] === false;
        await JournalListUx.writeState(descriptor.typeKey, {
            filters: { ...uxState.filters, [filterKey]: current },
        });
        this.#applyListUxFilters();
    }

    async #setSortMode(sort) {
        const descriptor = this.listUxDescriptor;
        await JournalListUx.writeState(descriptor.typeKey, { sort });
        await this.render();
    }

    static #openStatusPicker(_event, target) {
        JournalStatusPicker.open(target);
    }

    static async #editEvent(_event, target) {
        const key = target.dataset.key;
        if (!key) return;

        const page = this.document;
        const editSheet = page?.sheet;
        if (this.isView && editSheet && editSheet !== this) {
            editSheet.currentKey = key;
            return editSheet.render({ force: true, currentKey: key });
        }

        this.currentKey = key;
        return this.render({ force: true, currentKey: key });
    }

    _tearDown(options) {
        super._tearDown(options);
        this.#search?.unbind();
    }

    #buildTOC() {
        const toc = this.constructor.buildTOC(this.element, this.listUxDescriptor);
        if (!this.isView || !this.page.title.show || !Object.keys(toc).length) return toc;

        return {
            [CalendarListJournalSheet.#pageTitleTOCPlaceholderSlug]: {
                text: this.page.name,
                level: this.page.title.level,
                slug: CalendarListJournalSheet.#pageTitleTOCPlaceholderSlug,
                children: [],
                order: -1,
            },
            ...toc,
        };
    }

    static buildTOC(html, descriptor = null) {
        return JournalListUx.buildToc(html, {
            entryHeadingClass: descriptor?.entryHeadingClass,
        });
    }

    async _prepareEntries(_context, _options) {
        // Implemented by subclasses when they need to enrich sorted entries.
    }

    async _onRenderEditable(_context, _options) {
        // Optional subclass hook.
    }

    async _onDetailRendered(_key) {
        // Optional subclass hook after edit-detail HTML is injected (initial render or list select).
    }

    async _afterRegistrationChange() {
        // Optional subclass hook.
    }

    static async #removeEntry(ev, target) {
        const key = target.dataset.key;
        await this.document.update({ [`system.${this.constructor.objectKey}.${key}`]: _del });
    }

    static async #addEntry(ev, target) {
        await this.newEntry();
    }
}
