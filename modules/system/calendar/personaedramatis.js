import { DSAPersonaEntry } from "../../data/journal/dsapersonaedramatis.js";
import { JournalEntryTargetHelper } from "./journalentrytargethelper.js";
import ListKeyboardNavigation from "./list_keyboard_navigation.js";
export class PersonaeDramatis {
    static #parent;
    static #lastActiveListType = '0';
    static #lastSelectedActor = null;
    static #collapsedGroups = new Set();
    #search;
    #keyboardNavigation;

    constructor(parent) {
        PersonaeDramatis.#parent = parent;
    }

    get element() {
        return PersonaeDramatis.#parent.element;
    }

    get parent() {
        return PersonaeDramatis.#parent;
    }

    static TABS = {
        details: {
            tabs: [
                { id: 'description', label: 'Description' },
                { id: 'notes', label: 'Notes' },
                { id: 'slnotes', label: 'GM notes', onlyGM: true },
                { id: 'contacts', label: 'PERSONAE.FIELDS.personae.socialContact.label', onlyGM: true },
            ],
            initial: 'description',
        },
    }

    static actions = {
        selectActor: PersonaeDramatis.selectActor,
        editActor: PersonaeDramatis.editActor,
        showSheet: PersonaeDramatis.showSheet,
        toggleVisibility: PersonaeDramatis.toggleVisibility,
        switchList: PersonaeDramatis.switchList,
        newPersona: PersonaeDramatis.newPersona,
        togglePersonaGroup: PersonaeDramatis.togglePersonaGroup,
    }

    static #findExistingPersona(actorUuid) {
        if (!actorUuid) return null;

        for (const { journal, page } of JournalEntryTargetHelper.collectTargets('dsapersonaedramatis').pages) {
            for (const [key, entry] of Object.entries(page.system?.personae || {})) {
                if (entry?.actor_uuid !== actorUuid) continue;
                return { journal, page, key, entry };
            }
        }
        return null;
    }

    static async addActorToPersonae(actor) {
        if (!game.user.isGM || !actor) return;
        if (!DSAPersonaEntry.isValidActor(actor)) {
            ui.notifications.warn('PERSONAE.actorTypeNotAllowed', { localize: true });
            return;
        }

        const existing = this.#findExistingPersona(actor.uuid);
        if (existing) {
            ui.notifications.error('PERSONAE.actorAlreadyExists', {
                localize: true,
                format: {
                    actor: actor.name,
                    page: existing.page.name,
                    journal: existing.journal.name,
                }
            });
            return;
        }

        await DSAPersonaEntry.startCreation(
            game.dsa5?.apps?.CalendarPicker,
            { actor },
        );
    }

    async _preparePartContext(context, options) {
        const isGM = game.user.isGM;
        const actorSettings = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME) || { activated: [] };
        const activated = actorSettings.activated;
        const journals = (await Promise.all(activated.map(async j => {
            try {
                return await fromUuid(j.uuid);
            } catch (error) {
                ui.notifications?.error(`Failed to load journal with UUID ${j.name}.`);
                return null;
            }
        }))).filter(Boolean);
        context.personae = { personae0: [], personae1: [] };
        context.lastActiveListType = PersonaeDramatis.#lastActiveListType;
        const personaeData = { 0: [], 1: [] };
        let foundLastSelectedPersona = null;
        for (const journal of journals) {
            for (const page of journal.pages) {
                if (page.type !== 'dsapersonaedramatis') continue;

                const personae = page.system?.personae;
                if (!personae) continue;

                const pageUuid = page.uuid;
                const parentUuid = page.parent?.uuid;
                for (const key in personae) {
                    if (!Object.prototype.hasOwnProperty.call(personae, key)) continue;

                    const entry = personae[key];
                    if ((!entry.visible && !isGM) || !entry.actor_uuid) continue;

                    const personaEntry = {
                        ...entry,
                        uuid: pageUuid,
                        juuid: parentUuid,
                        dramatisKey: key
                    };
                    const actor = entry.actor_uuid ? fromUuidSync(entry.actor_uuid) : null;
                    personaEntry.garadan = DSAPersonaEntry.resolveGaradan(entry, actor);
                    const shouldShowGaradan = DSAPersonaEntry.shouldShowGaradan(personaEntry, { isGM });
                    if (shouldShowGaradan) {
                        personaEntry.garadanClass = DSAPersonaEntry.GARADAN_CLASSES[personaEntry.garadan] || '';
                    }
                    personaEntry.garadanVisible = shouldShowGaradan;
                    personaeData[entry.type].push(personaEntry);
                    if (PersonaeDramatis.#lastSelectedActor &&
                        pageUuid === PersonaeDramatis.#lastSelectedActor.pageUuid &&
                        key === PersonaeDramatis.#lastSelectedActor.dramatisKey) {
                        foundLastSelectedPersona = { entry, page, key };
                    }
                }
            }
        }
        for (const type of ['0', '1']) {
            const grouped = this._groupByFaction(personaeData[type]);
            context.personae[`personae${type}`] = grouped;
        }
        context.detailData = null;
        if (foundLastSelectedPersona) {
            try {
                context.detailData = await PersonaeDramatis.#prepareActorDetailData(
                    foundLastSelectedPersona.entry,
                    foundLastSelectedPersona.page,
                    foundLastSelectedPersona.key,
                    isGM
                );
            } catch (error) {
                console.warn('Failed to restore last selected actor details:', error);
                PersonaeDramatis.#lastSelectedActor = null;
            }
        } else if (PersonaeDramatis.#lastSelectedActor) {
            PersonaeDramatis.#lastSelectedActor = null;
        }
    }

    _groupByFaction(personaeArray) {
        if (!Array.isArray(personaeArray) || personaeArray.length === 0) return [];
        const collator = new Intl.Collator(game.i18n?.lang, { sensitivity: 'base', numeric: true });
        const unknownFaction = _loc("PERSONAE.UnknownFaction");
        const groups = new Map();
        for (const persona of personaeArray) {
            const faction = persona.faction || unknownFaction;
            let bucket = groups.get(faction);
            if (!bucket) {
                bucket = [];
                groups.set(faction, bucket);
            }
            bucket.push(persona);
        }
        for (const bucket of groups.values()) {
            bucket.sort((a, b) => collator.compare(a?.name || '', b?.name || ''));
        }
        const sortedEntries = Array.from(groups.entries()).sort(([fa], [fb]) => {
            if (fa === unknownFaction) return 1;
            if (fb === unknownFaction) return -1;
            return collator.compare(fa, fb);
        });
        return sortedEntries.map(([faction, members]) => ({
            faction,
            members,
            collapseKey: `${members[0]?.type ?? ''}:${faction}`,
            isCollapsed: PersonaeDramatis.#collapsedGroups.has(`${members[0]?.type ?? ''}:${faction}`),
        }));
    }

    static togglePersonaGroup(event, target) {
        const group = target.closest('.faction-group');
        const key = group?.dataset.groupKey;
        if (!group || !key) return;

        const collapsed = !group.classList.contains('collapsed');
        group.classList.toggle('collapsed', collapsed);
        target.setAttribute('aria-expanded', String(!collapsed));
        if (collapsed) PersonaeDramatis.#collapsedGroups.add(key);
        else PersonaeDramatis.#collapsedGroups.delete(key);
    }

    static async #entryFromTarget(target) {
        const { personaUuid, key } = target.closest('[data-persona-uuid]')?.dataset ?? {};
        if (!personaUuid) return {};

        const page = await fromUuid(personaUuid);
        if (!page) return {};

        return { entry: page?.system.personae?.[key], page, key };
    }

    static async selectActor(event, target) {
        const { entry, page, key } = await PersonaeDramatis.#entryFromTarget(target);
        if (!entry) return;

        PersonaeDramatis.#lastSelectedActor = {
            pageUuid: page.uuid,
            dramatisKey: key
        };
        PersonaeDramatis.updateSelectionUI(target);
        PersonaeDramatis.displayActorDetails(entry, page, key, target);
    }

    static updateSelectionUI(clickedElement) {
        const listItem = clickedElement.closest('.persona-list-item');
        const personaeList = listItem.closest('.personae-list');
        personaeList.querySelectorAll('.persona-list-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
        listItem.classList.add('selected');
    }

    static prepareTabs(entry) {
        const activeGroup = PersonaeDramatis.#parent.tabGroups.details || 'description';
        const tabs = PersonaeDramatis.TABS.details.tabs.reduce((tabs, tab, index) => {
            if (tab.onlyGM && (!game.user.isGM || entry.type === 1)) return tabs;
            tabs[tab.id] = {
                cssClass: activeGroup === tab.id ? 'active' : '',
                group: 'details',
                id: tab.id,
                label: tab.label
            }
            return tabs;
        }, {});
        if (!tabs[activeGroup]) {
            const firstTab = Object.values(tabs)[0];
            if (firstTab) {
                firstTab.cssClass = 'active';
            }
        } return tabs;
    }

    static async #prepareActorDetailData(entry, page, key, isGM) {
        const heros = await DSAPersonaEntry.getHeros();
        await DSAPersonaEntry.preparePersonaEntry(entry, page, key, heros);
        entry.garadanVisible = DSAPersonaEntry.shouldShowGaradan(entry, { isGM });
        const tabs = PersonaeDramatis.prepareTabs(entry);
        return {
            ...entry,
            canChangeRelation: isGM,
            tabs,
            selectedPersonaUuid: page.uuid,
            selectedDramatisKey: key
        };
    }

    static async displayActorDetails(entry, page, key, target) {
        const container = target.closest('.personae-two-column');
        const detailsContainer = container.querySelector('.persona-details-container');
        if (!detailsContainer) return;

        const detailData = await PersonaeDramatis.#prepareActorDetailData(entry, page, key, game.user.isGM);
        const detailHTML = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/persona-detail.hbs', detailData);
        detailsContainer.innerHTML = detailHTML;
        PersonaeDramatis.#setupDetailListeners(container);
    }

    static #visibleListItems() {
        const list = PersonaeDramatis.#parent.element.querySelector('.tab[data-tab="personae"].active .personae-list');
        const activeList = list?.dataset.activeList || '0';
        const activeContent = list?.querySelector(`.list-content[data-list-type="${activeList}"]:not(.hidden)`);
        if (!activeContent) return [];

        return Array.from(activeContent.querySelectorAll('.faction-group:not(.collapsed):not([hidden]) .persona-list-item:not([hidden])'));
    }

    static #notesChanged(event) {
        const target = event.target;
        const newValue = target.value;
        const { documentUuid } = target.dataset;
        const name = target.name;
        if (game.user.isGM) {
            this.updateNotes({ documentUuid, name, newValue });
        } else {
            game.socket.emit('system.dsa5', {
                type: 'personaNotesChanged',
                payload: {
                    documentUuid, name, newValue
                },
            });
        }
    }

    static async updateNotes(data) {
        const document = await fromUuid(data.documentUuid);
        if (!document) return;

        await document.update({ [data.name]: data.newValue });
    }

    static async updateContactRelationshipLevel(event) {
        const target = event.target;
        const newValue = target.value;
        const section = target.closest('.relationship-section');
        section.querySelector('.relationship-value').textContent = `${newValue}/9`;
        section.querySelector('.relationship-label').textContent = _loc(`PERSONAE.FIELDS.personae.socialContact.level.choices.${newValue}`);
        target.className = target.className.replace(/level-\d+/g, '');
        target.classList.add(`level-${newValue}`);
        const { page, key } = await PersonaeDramatis.#entryFromTarget(target);
        if (!page) return;

        const contactId = target.dataset.contactUuid.replaceAll('.', '_');
        await page.update({ [`system.personae.${key}.socialContact.${contactId}.level`]: newValue });
    }

    static async editActor(event, target, options = {}) {
        const { page, key } = await PersonaeDramatis.#entryFromTarget(target);
        if (!key || !page) return;

        await PersonaeDramatis.#parent.openDocumentSheet(page, { currentKey: key, close: !options.stay });
    }

    static async showSheet(event, target, options = {}) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;

        await PersonaeDramatis.#parent.openDocumentSheet(uuid, { close: !options.stay });
    }

    static async newPersona(event, target) {
        await DSAPersonaEntry.startCreation(this, {});
    }

    static async toggleVisibility(event, target) {
        const { entry, page, key } = await PersonaeDramatis.#entryFromTarget(target);
        if (!entry) return;

        await page.update({ [`system.personae.${key}.visible`]: !entry.visible });
        const i = target.querySelector('i');
        i.classList.toggle('fa-eye', !entry.visible);
        i.classList.toggle('fa-eye-slash', entry.visible);
        this.element.querySelector('.persona-list-item.selected')?.classList.toggle('invisible', entry.visible);
        this.element.querySelector('.persona-list-item.selected .persona-hidden')?.classList.toggle('dsahidden', !entry.visible);
    }
    static switchList(event, target) {
        const listType = target.dataset.listType;
        const personaeList = target.closest('.personae-list-column');
        PersonaeDramatis.#setActiveList(listType, personaeList, { clearSelection: true });
    }
    static #setActiveList(listType, personaeList, { clearSelection = true } = {}) {
        if (!personaeList) return;

        PersonaeDramatis.#lastActiveListType = listType;
        personaeList.querySelectorAll('.list-switch-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.listType === listType);
        });
        personaeList.querySelectorAll('.list-content').forEach(content => {
            content.classList.toggle('hidden', content.dataset.listType !== listType);
        });
        const mainList = personaeList.querySelector('.personae-list');
        if (mainList) {
            mainList.dataset.activeList = listType;
        }
        if (clearSelection) {
            PersonaeDramatis.clearSelection();
            PersonaeDramatis.clearDetails(personaeList);
            PersonaeDramatis.#lastSelectedActor = null;
        }
    }

    static clearSelection() {
        document.querySelectorAll('.persona-list-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }

    static clearDetails(target) {
        const detailsContainer = target.closest('.personae-two-column').querySelector('.persona-details-container');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="no-selection">
                    <div class="no-selection-content">
                        <i class="fas fa-user-circle"></i>
                        <h3>${_loc("PERSONAE.SelectPersona")}</h3>
                        <p>${_loc("PERSONAE.SelectPersonaHint")}</p>
                    </div>
                </div>
            `;
        }
    }

    static async #openLinkedPersona(event) {
        const link = event.target.closest('.content-link, .documentName-link');
        if (!link) return;

        const { uuid, type } = link.dataset;
        if (type != 'Actor' || !uuid) return;

        const listItem = PersonaeDramatis.#parent.element.querySelector(`.persona-list-item[data-actor-uuid="${uuid}"]`);
        if (!listItem) return;

        event.preventDefault();
        event.stopPropagation();
        const listType = listItem.closest('.list-content')?.dataset.listType;
        if (listType) {
            const personaeListColumn = PersonaeDramatis.#parent.element.querySelector('.personae-list-column');
            PersonaeDramatis.#setActiveList(listType, personaeListColumn, { clearSelection: false });
        }
        await PersonaeDramatis.selectActor(event, listItem);
    }

    static #setupDetailListeners(element) {
        const detailsContainer = element.querySelector('.persona-details-container');
        if (!detailsContainer) return;

        detailsContainer.querySelectorAll('.relationship-slider').forEach(slider => {
            slider.addEventListener('input', async (event) => PersonaeDramatis.updateContactRelationshipLevel(event));
        });
        const notesEdit = detailsContainer.querySelector('.notes-edit');
        if (notesEdit) {
            notesEdit.addEventListener('change', PersonaeDramatis.#notesChanged.bind(PersonaeDramatis));
        }
        detailsContainer.querySelectorAll('.content-link, .documentName-link').forEach(link => {
            link.addEventListener('click', (event) => PersonaeDramatis.#openLinkedPersona(event));
        });
    }

    onRenderListeners() {
        this.#search ??= new foundry.applications.ux.SearchFilter({
            inputSelector: "input.actorsearch[type=search]",
            contentSelector: ".personae-list",
            callback: this.#onSearchFilter.bind(this)
        });
        this.#search.bind(this.element);
        this.element.addEventListener('click', (event) => {
            const switchBtn = event.target.closest('.list-switch-btn');
            if (switchBtn) {
                PersonaeDramatis.switchList(event, switchBtn);
            }
        });
        PersonaeDramatis.#setupDetailListeners(this.element);
        this.#keyboardNavigation ??= new ListKeyboardNavigation({
            parent: PersonaeDramatis.#parent,
            tabId: 'personae',
            getItems: () => PersonaeDramatis.#visibleListItems(),
            selectItem: (event, item) => PersonaeDramatis.selectActor(event, item),
            detailTabsSelector: '.tab[data-tab="personae"].active .persona-details-container nav.tabs [data-group][data-tab]',
        });
        this.#keyboardNavigation.bind(this.element);
    }

    #onSearchFilter(_event, query, rgx, html) {
        const activeList = html.dataset.activeList || '0';
        const activeListContent = html.querySelector(`.list-content[data-list-type="${activeList}"]`);
        if (!activeListContent) return;

        const factionGroups = activeListContent.querySelectorAll('.faction-group');
        factionGroups.forEach(factionGroup => {
            let visibleItemsInFaction = 0;
            const personaItems = factionGroup.querySelectorAll('.persona-list-item');
            personaItems.forEach(entry => {
                if (!query) {
                    entry.hidden = false;
                    visibleItemsInFaction++;
                    return;
                }
                const name = entry.querySelector('.persona-list-name')?.textContent || '';
                const faction = factionGroup.querySelector('.faction-name')?.textContent || '';
                const tags = entry.dataset.personaTags || '';
                const isMatch = [name, faction, tags].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
                entry.hidden = !isMatch;
                if (isMatch) visibleItemsInFaction++;
            });
            factionGroup.hidden = visibleItemsInFaction === 0;
        });
    }

    _tearDown(options) {
        this.#search?.unbind();
        this.#keyboardNavigation?.unbind();
    }
}