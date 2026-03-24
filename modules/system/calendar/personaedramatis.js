import { DSAPersonaEntry } from "../../data/journal/dsapersonaedramatis.js";
export class PersonaeDramatis {
    static #parent;
    static #lastActiveListType = '0';
    static #lastSelectedActor = null;
    #search;

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
    }

    static #targetCollator() {
        return new Intl.Collator(game.i18n?.lang || undefined, { sensitivity: 'base', numeric: true });
    }

    static #defaultPersonaeName() {
        return _loc("PERSONAE.ImportantPersons");
    }

    static #collectPersonaeTargets() {
        const collator = this.#targetCollator();
        const journals = [];
        const pages = [];
        for (const journal of game.journal?.contents || []) {
            const personaePages = journal.pages.filter(page => page.type === 'dsapersonaedramatis');
            if (!personaePages.length) continue;

            journals.push({ journal, uuid: journal.uuid, name: journal.name });
            for (const page of personaePages) {
                pages.push({
                    journal,
                    page,
                    uuid: page.uuid,
                    name: page.name,
                    journalUuid: journal.uuid,
                    journalName: journal.name,
                });
            }
        }

        journals.sort((left, right) => collator.compare(left.name || '', right.name || ''));
        pages.sort((left, right) => {
            const journalSort = collator.compare(left.journalName || '', right.journalName || '');
            if (journalSort !== 0) return journalSort;
            return collator.compare(left.name || '', right.name || '');
        });
        return { journals, pages };
    }

    static #findExistingPersona(actorUuid) {
        if (!actorUuid) return null;

        for (const { journal, page } of this.#collectPersonaeTargets().pages) {
            for (const [key, entry] of Object.entries(page.system?.personae || {})) {
                if (entry?.actor_uuid !== actorUuid) continue;
                return { journal, page, key, entry };
            }
        }
        return null;
    }

    static async #refreshPersonaeRegistrationUI() {
        const picker = game.dsa5?.apps?.CalendarPicker;
        if (picker?.rendered) {
            await picker.render({ force: true, parts: ['personae', 'config'] });
        }
    }

    static async #registerJournalInCalendarActors(journal) {
        if (!journal) return;

        const settings = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME) || { activated: [] };
        settings.activated ||= [];
        if (settings.activated.some(entry => entry.uuid === journal.uuid)) return;

        settings.activated.push({ uuid: journal.uuid, name: journal.name });
        await game.settings.set('dsa5', DSAPersonaEntry.SETTING_NAME, settings);
        await this.#refreshPersonaeRegistrationUI();
    }

    static async #chooseActorDirectoryTarget(actor) {
        const targets = this.#collectPersonaeTargets();
        const modes = [];
        if (targets.pages.length) modes.push({ value: 'existing-page', label: _loc('PERSONAE.addActorToExistingPage') });
        if (targets.journals.length) modes.push({ value: 'new-page', label: _loc('PERSONAE.addActorToNewPage') });
        modes.push({ value: 'new-journal', label: _loc('PERSONAE.addActorToNewJournal') });

        const defaultName = this.#defaultPersonaeName();
        const content = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/personae-add-dialog.hbs', {
            actorName: actor.name || '',
            defaultName,
            modes,
            pages: targets.pages.map(target => ({
                value: target.uuid,
                label: `${target.journalName} / ${target.name}`,
            })),
            journals: targets.journals.map(target => ({
                value: target.uuid,
                label: target.name,
            })),
            labels: {
                hint: _loc('PERSONAE.addActorDialogHint', { actor: actor.name || '' }),
                targetMode: _loc('PERSONAE.targetMode'),
                selectPage: _loc('PERSONAE.selectPage'),
                selectJournalForPage: _loc('PERSONAE.selectJournalForPage'),
                pageName: _loc('PERSONAE.pageName'),
                journalName: _loc('PERSONAE.journalName'),
            },
        });

        try {
            return await foundry.applications.api.DialogV2.wait({
                window: {
                    title: _loc('PERSONAE.addActorDialogTitle'),
                },
                content,
                render: (event, dialog) => {
                    const modeSelect = dialog.element.querySelector('[name="mode"]');
                    const updateMode = () => {
                        const mode = modeSelect.value;
                        dialog.element.querySelectorAll('.personae-target-group').forEach(group => {
                            const visibleModes = group.dataset.mode.split(',');
                            group.hidden = !visibleModes.includes(mode);
                        });
                    };
                    modeSelect.addEventListener('change', updateMode);
                    updateMode();
                },
                buttons: [
                    {
                        action: 'ok',
                        icon: 'fa fa-check',
                        label: 'yes',
                        default: true,
                        callback: (event, button) => {
                            const data = new foundry.applications.ux.FormDataExtended(button.form).object;
                            if (data.mode === 'existing-page') {
                                return { mode: data.mode, pageUuid: data.pageUuid };
                            }
                            if (data.mode === 'new-page') {
                                return { mode: data.mode, journalUuid: data.journalUuid, pageName: data.pageName?.trim() };
                            }
                            return {
                                mode: data.mode,
                                journalName: data.journalName?.trim(),
                                pageName: data.pageName?.trim(),
                            };
                        },
                    },
                    {
                        action: 'cancel',
                        icon: 'fas fa-times',
                        label: 'cancel',
                        callback: () => false,
                    },
                ],
            });
        } catch (error) {
            return false;
        }
    }

    static async #ensureActorDirectoryTarget(target) {
        if (!target?.mode) return {};

        if (target.mode === 'existing-page') {
            const page = await fromUuid(target.pageUuid);
            return { journal: page?.parent, page };
        }

        if (target.mode === 'new-page') {
            const journal = await fromUuid(target.journalUuid);
            if (!journal) return {};

            const [page] = await journal.createEmbeddedDocuments('JournalEntryPage', [{
                name: target.pageName || this.#defaultPersonaeName(),
                type: 'dsapersonaedramatis',
            }]);
            return { journal, page };
        }

        const journal = await JournalEntry.create({
            name: target.journalName || this.#defaultPersonaeName(),
            pages: [{
                name: target.pageName || this.#defaultPersonaeName(),
                type: 'dsapersonaedramatis',
            }],
        });
        const page = journal?.pages.find(entry => entry.type === 'dsapersonaedramatis');
        return { journal, page };
    }

    static async #createPersonaEntry(page, actor) {
        const key = foundry.utils.randomID();
        await page.update({
            system: {
                personae: {
                    [key]: {
                        name: actor.name,
                        type: actor.type === 'creature' ? 1 : 0,
                        actor_uuid: actor.uuid,
                    }
                }
            }
        });
        return key;
    }

    static async addActorToPersonae(actor) {
        if (!game.user.isGM || !actor) return;

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

        const target = await this.#chooseActorDirectoryTarget(actor);
        if (!target) return;

        const { journal, page } = await this.#ensureActorDirectoryTarget(target);
        if (!journal || !page) {
            ui.notifications.error('PERSONAE.targetCreationFailed', {
                localize: true,
                format: {
                    actor: actor.name,
                }
            });
            return;
        }

        await this.#registerJournalInCalendarActors(journal);
        const currentKey = await this.#createPersonaEntry(page, actor);
        page.sheet.render({ force: true, currentKey });
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
        const collator = new Intl.Collator(game.i18n?.lang || undefined, { sensitivity: 'base', numeric: true });
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
        return sortedEntries.map(([faction, members]) => ({ faction, members }));
    }

    static async #entryFromTarget(target) {
        const { personaUuid, personaDramatisKey } = target.closest('[data-persona-uuid]')?.dataset;
        if (!personaUuid) return;

        const page = await fromUuid(personaUuid);
        if (!page) return;

        return { entry: page?.system.personae?.[personaDramatisKey], page, personaDramatisKey };
    }

    static async selectActor(event, target) {
        const { entry, page, personaDramatisKey } = await PersonaeDramatis.#entryFromTarget(target);
        if (!entry) return;

        PersonaeDramatis.#lastSelectedActor = {
            pageUuid: page.uuid,
            dramatisKey: personaDramatisKey
        };
        PersonaeDramatis.updateSelectionUI(target);
        PersonaeDramatis.displayActorDetails(entry, page, personaDramatisKey, target);
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
        const { page, personaDramatisKey } = await PersonaeDramatis.#entryFromTarget(target);
        if (!page) return;

        const contactId = target.dataset.contactUuid.replaceAll('.', '_');
        await page.update({ [`system.personae.${personaDramatisKey}.socialContact.${contactId}.level`]: newValue });
    }

    static async editActor(event, target, options = {}) {
        const { page, personaDramatisKey } = await PersonaeDramatis.#entryFromTarget(target);
        if (!personaDramatisKey || !page) return;

        if (!options.stay) this.close();
        page.sheet.render({ force: true, currentKey: personaDramatisKey });
    }

    static async showSheet(event, target, options = {}) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        const actor = await fromUuid(uuid);
        if (!actor) return;

        if (!options.stay) this.close();
        actor.sheet.render(true);
    }

    static async newPersona(event, target) {
        if (!game.user.isGM) return;

        this.close();

        const settings = game.settings.get('dsa5', DSAPersonaEntry.SETTING_NAME) || { activated: [] };
        settings.activated ||= [];
        const activatedJournals = settings.activated;
        if (activatedJournals.length === 0) {
            const newJournal = await JournalEntry.create({
                name: _loc("PERSONAE.ImportantPersons"), pages: [{
                    name: _loc("PERSONAE.ImportantPersons"), type: "dsapersonaedramatis",
                }]
            });
            await this.#registerJournalInCalendarActors(newJournal);
            newJournal.sheet.render(true);
        } else {
            let journalID;
            const content = `<p><div class="form-group">
                <label>${_loc("PERSONAE.selectJournal")}</label>
                <div class="form-fields">
                    <select name="journal">
                ${activatedJournals.map(id => `<option value="${id.uuid}">${id.name}</option>`).join('')}
                    </select>
                </div>
            </div></p>`
            try {
                journalID = await foundry.applications.api.DialogV2.wait({
                    window: {
                        title: 'PERSONAE.Add',
                    },
                    content,
                    buttons: [
                        {
                            action: 'ok',
                            icon: 'fa fa-check',
                            label: 'yes',
                            default: true,
                            callback: (event, button, dialog) => {
                                return button.form.elements.journal.value;
                            },
                        },
                        {
                            action: 'cancel',
                            icon: 'fas fa-times',
                            label: 'cancel',
                            callback: () => {
                                return false;
                            },
                        },
                    ],
                });
            } catch (error) {
                /* empty */
            }
            if (!journalID) return;

            const journal = await fromUuid(journalID);
            if (!journal) return;

            journal.sheet.render(true);
        }
    };

    static async toggleVisibility(event, target) {
        const { entry, page, personaDramatisKey } = await PersonaeDramatis.#entryFromTarget(target);
        if (!entry) return;

        await page.update({ [`system.personae.${personaDramatisKey}.visible`]: !entry.visible });
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
    }
}