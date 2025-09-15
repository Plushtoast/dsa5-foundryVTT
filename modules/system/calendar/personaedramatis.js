import { DSAPersonaEntry } from "../../data/journal/dsapersonaedramatis.js";

export class PersonaeDramatis {
    #search;

    constructor(parent) {
        this.parent = parent;
    }

    get element() {
        return this.parent.element;
    }

    static actions = {
        selectActor: PersonaeDramatis.selectActor,
        editActor: PersonaeDramatis.editActor,
        showSheet: PersonaeDramatis.showSheet,
        toggleVisibility: PersonaeDramatis.toggleVisibility,
        switchList: PersonaeDramatis.switchList,
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

        context.personae = { 'personae0': [], 'personae1': [] };
        const personaeData = { 0: [], 1: [] };

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

                    personaeData[entry.type].push({
                        ...entry,
                        uuid: pageUuid,
                        juuid: parentUuid,
                        dramatisKey: key
                    });
                }
            }
        }

        for (const type of ['0', '1']) {
            const grouped = this._groupByFaction(personaeData[type]);
            context.personae[`personae${type}`] = grouped;
        }
    }

    _groupByFaction(personaeArray) {
        if (!Array.isArray(personaeArray) || personaeArray.length === 0) return [];

        const collator = new Intl.Collator(game.i18n?.lang || undefined, { sensitivity: 'base', numeric: true });
        const unknownFaction = game.i18n.localize("PERSONAE.UnknownFaction");

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

        PersonaeDramatis.updateSelectionUI(target);
        PersonaeDramatis.displayActorDetails(entry, page, personaDramatisKey);
    }

    static updateSelectionUI(clickedElement) {
        const listItem = clickedElement.closest('.persona-list-item');
        const personaeList = listItem.closest('.personae-list');

        personaeList.querySelectorAll('.persona-list-item.selected').forEach(item => {
            item.classList.remove('selected');
        });

        listItem.classList.add('selected');
    }

    static async displayActorDetails(entry, page, key) {
        const detailsContainer = document.getElementById('persona-details');
        if (!detailsContainer) return;

        const detailHTML = await PersonaeDramatis.generateActorDetailHTML(entry, page, key);
        detailsContainer.innerHTML = detailHTML;
    }

    static async generateActorDetailHTML(entry, page, key) {
        await DSAPersonaEntry.preparePersonaEntry(entry, page, key);

        return await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/system/calendar/persona-detail.hbs', entry);
    }

    static async editActor(event, target, options = {}) {
        const { entry, page } = await PersonaeDramatis.#entryFromTarget(target);

        if (!entry) return;

        if (!options.stay) this.close();
        page.sheet.render({ force: true, search: entry.name });
    }

    static async showSheet(event, target, options = {}) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        const actor = await fromUuid(uuid);
        if (!actor) return;

        if (!options.stay) this.close();
        actor.sheet.render(true);
    }

    static async toggleVisibility(event, target) {
        const { entry, page, personaDramatisKey } = await PersonaeDramatis.#entryFromTarget(target);

        if (!entry) return;

        await page.update({ [`system.personae.${personaDramatisKey}.visible`]: !entry.visible });
        const i = target.querySelector('i');
        i.classList.toggle('fa-eye', !entry.visible);
        i.classList.toggle('fa-eye-slash', entry.visible);
    }

    static switchList(event, target) {
        const listType = target.dataset.listType;
        const personaeList = target.closest('.personae-list-column');
        
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
        
        PersonaeDramatis.clearSelection();
        PersonaeDramatis.clearDetails();
    }

    static clearSelection() {
        document.querySelectorAll('.persona-list-item.selected').forEach(item => {
            item.classList.remove('selected');
        });
    }

    static clearDetails() {
        const detailsContainer = document.getElementById('persona-details');
        if (detailsContainer) {
            detailsContainer.innerHTML = `
                <div class="no-selection">
                    <div class="no-selection-content">
                        <i class="fas fa-user-circle"></i>
                        <h3>${game.i18n.localize("PERSONAE.SelectPersona")}</h3>
                        <p>${game.i18n.localize("PERSONAE.SelectPersonaHint")}</p>
                    </div>
                </div>
            `;
        }
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

                const isMatch = [name, faction].some(q => rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(q)));
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