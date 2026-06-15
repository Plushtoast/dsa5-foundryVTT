import CompanionConfig from './companion-config.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import APTracker from '../../system/orwell/ap-tracker.js';
import { tabSlider } from '../../system/helpers/view_helper.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { TextEditor } = foundry.applications.ux;

export class CompanionTrainingApp extends HandlebarsApplicationMixin(ApplicationV2) {
    static #traitCatalogsPromise = null;
    static speciesImageCache = null;
    #speciesSearch;

    constructor(actor, companion, options = {}) {
        super(options);
        this.actor = actor;       
        this.companion = companion; 
        this.loyaltyUnlocked = false;
        this.typePickingMode = false;
        this.parentSheet = options.parentSheet; 
    }

    static DEFAULT_OPTIONS = {
        id: "companion-training",
        classes: ["dsa5", "sheet", "companion-training", "dsa5-companion"],
        actions: {
            toggleSpeciesSelector: this.#onSpeciesSelectorAction,
            removeSpecies: this.#removeSpecies,
            selectSpecies: this.#selectSpecies,
            itemEdit: this.#editItem,
            toggleTrickDetails: this.#toggleTrickDetails,
            openTrick: this.#openTrick,
            teachTrick: this.#teachTrick,
            teachTraining: this.#teachTraining,
            rollTierkunde: this.#rollTierkunde,
            advanceLoyalty: this.#advanceLoyalty,
            refundLoyalty: this.#refundLoyalty,
        },
        window: {
            title: "COMPANIONS.Training.label",
            icon: "fas fa-paw",
            resizable: true,
            contentClasses: ["companion-training-container", "gap5px"],
        },
        position: {
            width: 650,
            height: 620
        }
    };

    static PARTS = {
        header: {
            template: "systems/dsa5/templates/actors/companions/training.hbs"
        },
        tabs: {
            template: "systems/dsa5/templates/system/dsatabs.hbs"
        },
        loyalty: {
            template: "systems/dsa5/templates/actors/companions/training-loyalty.hbs",
            scrollable: [""]
        },
        tricks: {
            template: "systems/dsa5/templates/actors/companions/training-tricks.hbs",
            scrollable: [""]
        },
        training: {
            template: "systems/dsa5/templates/actors/companions/training-training.hbs",
            scrollable: [""]
        }
    };

    static TABS = {
        sheet: {
            tabs: [
                { id: 'loyalty', label: 'COMPANIONS.Loyalty.label' },
                { id: 'tricks', label: 'COMPANIONS.Trick.label' },
                { id: 'training', label: 'COMPANIONS.Training.TabName' }
            ],
            initial: 'loyalty'
        }
    };

    get title() {
        return `${_loc("COMPANIONS.Training.label")}: ${this.companion.name}`;
    }

    static #ensureTraitCatalogs() {
        this.#traitCatalogsPromise ??= (async () => {
            const seenTricks = new Set();
            const seenTrainings = new Set();
            const tricks = [];
            const trainings = [];

            await DSA5_Utility.collectIndexedCompendiumEntries({
                documentName: 'Item',
                fields: ['name', 'type', 'system.traitType.value', 'system.APValue.value'],
                filterEntry: async (entry, { getDocument }) => {
                    if (entry.type !== 'trait') return false;
                    const traitType = entry.system?.traitType?.value ?? (await getDocument(entry._id))?.system?.traitType?.value;
                    if (traitType === 'trick' && !seenTricks.has(entry.name)) {
                        seenTricks.add(entry.name);
                        return true;
                    }
                    if (traitType === 'training' && !seenTrainings.has(entry.name)) {
                        seenTrainings.add(entry.name);
                        return true;
                    }
                    return false;
                },
                mapEntry: async (entry, { getDocument }) => {
                    const traitType = entry.system?.traitType?.value ?? (await getDocument(entry._id))?.system?.traitType?.value;
                    const apCost = entry.system?.APValue?.value ?? (await getDocument(entry._id))?.system?.APValue?.value;
                    const mapped = { name: entry.name, uuid: entry.uuid, apCost: Number(apCost) || 0 };

                    if (traitType === 'trick') tricks.push(mapped);
                    else trainings.push(mapped);

                    return mapped;
                },
            });

            tricks.sort((a, b) => a.name.localeCompare(b.name));
            trainings.sort((a, b) => a.name.localeCompare(b.name));
            return { tricks, trainings };
        })();
        return this.#traitCatalogsPromise;
    }

    static async getAllTricks() {
        return (await this.#ensureTraitCatalogs()).tricks;
    }

    static async getAllTrainings() {
        return (await this.#ensureTraitCatalogs()).trainings;
    }

    static async getSpeciesDataWithImages() {
        if (this.speciesImageCache) return this.speciesImageCache;

        const imageMap = new Map();
        const speciesImages = await DSA5_Utility.collectIndexedCompendiumEntries({
            documentName: 'Actor',
            fields: ['name', 'img'],
            filterEntry: (entry) => !imageMap.has(entry.name),
            mapEntry: (entry) => ({ name: entry.name, img: entry.img }),
        });

        for (const entry of speciesImages) {
            imageMap.set(entry.name, entry.img);
        }

        const pipClass = (val) => {
            const n = Number(val);
            if (Number.isNaN(n)) return 'pip-neutral';
            return n > 0 ? 'pip-positive' : n < 0 ? 'pip-negative' : 'pip-neutral';
        };

        const enrichedData = {};
        for (const [group, speciesDict] of Object.entries(CompanionConfig.companionSpeciesData)) {
            enrichedData[group] = [];
            for (const [speciesName, speciesInfo] of Object.entries(speciesDict)) {
                enrichedData[group].push({
                    name: speciesName,
                    trickMod: speciesInfo.trickMod,
                    trainingMod: speciesInfo.trainingMod,
                    trickModClass: pipClass(speciesInfo.trickMod),
                    trainingModClass: pipClass(speciesInfo.trainingMod),
                    trainingModules: speciesInfo.trainingModules || [],
                    img: imageMap.get(speciesName) || 'icons/svg/mystery-man-black.svg'
                });
            }
        }

        this.speciesImageCache = enrichedData;
        return enrichedData;
    }

    static async finishTraining(ownerActor, target) {
        await CompanionConfig.ensureLoaded();

        const testItem = ownerActor.items.get(target.dataset.itemId);
        const compActor = await fromUuid(target.dataset.companionUuid);
        if (!testItem || !compActor) return;

        const trainingIndicator = _loc("COMPANIONS.Training.ModuleIndicator") || "(Ausbildungsaufsatz):";
        const isTraining = testItem.name.includes(trainingIndicator);
        const separator = isTraining ? trainingIndicator : "(Trick):";
        const itemName = testItem.name.split(separator)[1]?.trim() || testItem.name;

        const trainingTricks = CompanionConfig.trainingTricks;
        const knownTrickNames = new Set();
        const knownTrainingNames = [];

        for (const item of compActor.items) {
            if (item.type !== 'trait') continue;
            const traitType = item.system?.traitType?.value;
            if (traitType === 'trick') knownTrickNames.add(item.name);
            else if (traitType === 'training') knownTrainingNames.push(item.name);
        }

        const freeTricksSet = new Set();
        for (const trainingName of knownTrainingNames) {
            for (const [key, tricks] of Object.entries(trainingTricks)) {
                if (key && trainingName.startsWith(key)) tricks.filter(Boolean).forEach(t => freeTricksSet.add(t));
            }
        }

        if (!isTraining) {
            const klValue = compActor.system.characteristics.kl.value || 0;
            const trainingBonus = [...knownTrickNames].filter(n => freeTricksSet.has(n)).length;
            const maxTricks = Math.round(klValue / 2) + trainingBonus;
            if (knownTrickNames.size >= maxTricks && !freeTricksSet.has(itemName)) {
                ui.notifications.warn(_loc("COMPANIONS.Notification.MaxTricksReached", { name: compActor.name }));
                return;
            }
        }

        const trickItem = await fromUuid(testItem.getFlag('dsa5', 'trainingTrickUuid'));
        if (!trickItem) {
            ui.notifications.warn(_loc("COMPANIONS.Trick.NotFound"));
            return;
        }

        const apCost = Number(testItem.getFlag('dsa5', 'trainingApCost')) || Number(trickItem.system.APValue?.value) || 0;
        const totalAP = compActor.system.details.experience.total || 0;
        const spentAP = compActor.system.details.experience.spent || 0;

        if ((totalAP - spentAP) < apCost) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.NotEnoughPetAP", { name: compActor.name, cost: apCost }));
            return;
        }

        await compActor.update({ "system.details.experience.spent": spentAP + apCost }, { render: false });
        await compActor.createEmbeddedDocuments('Item', [trickItem.toObject()], { render: false });
        await testItem.delete();

        if (!isTraining) {
            ui.notifications.info(_loc("COMPANIONS.Training.Finished", { trickName: itemName, petName: compActor.name }));
            return;
        }

        ui.notifications.info(_loc("COMPANIONS.Training.ModuleFinished", { trainingName: itemName, petName: compActor.name }));

        const grantedTricks = Object.entries(trainingTricks).find(([key]) => key && itemName.startsWith(key))?.[1] || [];
        if (grantedTricks.length === 0) return;

        const allTricks = await this.getAllTricks();
        const tricksByName = new Map(allTricks.map(t => [t.name, t]));
        const tricksToAdd = [];
        const addedTrickNames = [];

        for (const trickName of grantedTricks) {
            if (!trickName || knownTrickNames.has(trickName)) continue;

            const trickDocument = await fromUuid(tricksByName.get(trickName)?.uuid);
            if (!trickDocument) continue;

            tricksToAdd.push(trickDocument.toObject());
            addedTrickNames.push(trickName);
        }

        if (tricksToAdd.length > 0) {
            await compActor.createEmbeddedDocuments('Item', tricksToAdd);
            ui.notifications.info(_loc("COMPANIONS.Notification.AutoLearnedTricks", { name: compActor.name, tricks: addedTrickNames.join(', ') }));
        }
    }

    async _prepareContext(options) {
        await CompanionConfig.ensureLoaded();
        const context = await super._prepareContext(options);
        context.loyaltyUnlocked = this.loyaltyUnlocked;
        context.typePickingMode = this.typePickingMode;
        context.companion = this.companion;
        
        // --- 1. Grundstatus (Vertraute, Wild, Domestiziert) ---
        const familiarName = _loc("LocalizedIDs.familiar");
        context.isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
        
        const zoologyWildName = _loc("LocalizedIDs.zoologyWild");
        const isActuallyWild = this.companion.items.some(i => i.type === 'information' && i.name === zoologyWildName);
        
        // Regel: Vertrautentiere behandeln wie domestizierte Tiere
        context.isWild = isActuallyWild && !context.isFamiliar; 
        context.buttonLabel = context.isWild ? "LocalizedIDs.zoologyWild" : "LocalizedIDs.zoologyDomesticated";
        
        const currentSpecies = this.companion.system.companionData.species;
        context.currentSpecies = currentSpecies;
        
        const speciesData = await this.constructor.getSpeciesDataWithImages();
        context.speciesData = speciesData;
        
        context.currentSpeciesImg = "icons/svg/mystery-man-black.svg";
        context.currentSpeciesData = null;
        if (currentSpecies) {
            for (const group of Object.values(speciesData)) {
                const found = group.find(s => s.name === currentSpecies);
                if (found) {
                    context.currentSpeciesImg = found.img;
                    context.currentSpeciesData = found;
                    break;
                }
            }
        }
        
        // --- 2. Bekannte Ausbildungen und Tricks auslesen ---
        const knownTricksItems = this.companion.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "trick");
        const knownTrainingItems = this.companion.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "training");
        
        // --- 3. Trick-Limit berechnen (inkl. Matrix für Gratis-Tricks) ---
        const klValue = this.companion.system.characteristics.kl.value || 0;
        const baseTricks = Math.round(klValue / 2);
        
        const trainingTricks = CompanionConfig.trainingTricks;

        // Gratis-Tricks des Tiers durch Ausbildungen?
        const freeTricksSet = new Set();
        knownTrainingItems.forEach(t => {
            for (const [key, tricks] of Object.entries(trainingTricks)) {
                if (key && t.name.startsWith(key)) {
                    tricks.forEach(trick => { if(trick) freeTricksSet.add(trick) });
                }
            }
        });

        // Limit um die Gratis-Tricks erhöhen, die das Tier bereits gelernt hat
        let trainingBonus = 0;
        knownTricksItems.forEach(trick => {
            if (freeTricksSet.has(trick.name)) trainingBonus++;
        });

        const maxTricks = context.isWild ? baseTricks : (baseTricks + trainingBonus);
        const currentTrickCount = knownTricksItems.length;

        context.currentTrickCount = currentTrickCount;
        context.maxTricks = maxTricks;

        context.knownTricks = [];
        for (const t of knownTricksItems) {
            context.knownTricks.push({
                name: t.name,
                uuid: t.uuid,
                link: await TextEditor.enrichHTML(`@UUID[${t.uuid}]`, { async: true })
            });
        }
        
        context.isMaxReached = currentTrickCount >= maxTricks;
		
		const knownTrickNames = knownTricksItems.map(t => t.name);

        // --- 4. Ausbildungs-Limit prüfen ---
        let trainingCount = 0;
        const reittierName = CompanionConfig.trainingNames.Reittier;
        knownTrainingItems.forEach(t => {
            // Reittier zählt nicht gegen das Limit
            if (!t.name.includes(reittierName) && !t.name.includes("Reittier")) {
                trainingCount++;
            }
        });

        const maxTrainings = context.isFamiliar ? 2 : 1;
        context.hasReachedMaxTraining = trainingCount >= maxTrainings;
		
        const allTricks = await this.constructor.getAllTricks();
        const loyaltyName = _loc("LocalizedIDs.loyalty");
        const tricksLabel = _loc("COMPANIONS.Trick.label");
        const noReqsLabel = _loc("COMPANIONS.Trick.NoRequirements");

        context.loyaltyItem = this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
        const currentLoyalty = context.loyaltyItem ? context.loyaltyItem.system.talentValue.value : 0;
        
        const trickRequirements = CompanionConfig.trickRequirements;

        const availableTricks = [];
        const unavailableTricks = [];
        const trainingItems = this.actor.items.filter(i => i.type === "aggregatedTest");

        for (const t of allTricks) {
            if (knownTrickNames.includes(t.name)) continue;

            const reqs = trickRequirements[t.name] || { loyalty: 0, tricks: [] };
            
            // FILTER: Löscht leere Strings, falls ein Sprachschlüssel fehlt
            const requiredTricks = (reqs.tricks || []).filter(trick => trick && trick.trim() !== "");
            
            const meetsLoyalty = currentLoyalty >= reqs.loyalty;
            const meetsTricks = requiredTricks.every(reqTrick => knownTrickNames.includes(reqTrick));
            
            const reqTextArray = [];
            if (reqs.loyalty > 0) reqTextArray.push(`${loyaltyName} ${reqs.loyalty}`);
            if (requiredTricks.length > 0) reqTextArray.push(`${tricksLabel}: ${requiredTricks.join(", ")}`);
            
            const reqText = reqTextArray.length > 0 ? reqTextArray.join(" | ") : noReqsLabel;
            
            // --- Prüfen, ob die Probe schon beim Helden liegt ---
            const expectedWildName = _loc("COMPANIONS.Trick.WildAnimalTraining", {petName: this.companion.name, trickName: t.name});
            const expectedDomName = _loc("COMPANIONS.Trick.AnimalTraining", {petName: this.companion.name, trickName: t.name});
            const isTraining = trainingItems.some(i => i.name === expectedWildName || i.name === expectedDomName);
            const trickData = { name: t.name, uuid: t.uuid, reqText: reqText, isTraining: isTraining };

            if (meetsLoyalty && meetsTricks) {
                availableTricks.push(trickData);
            } else {
                unavailableTricks.push(trickData);
            }
        }

        context.availableTricks = availableTricks;
        context.unavailableTricks = unavailableTricks;
		
	// --- Bekannte Ausbildungen für das Template aufbereiten ---
        const knownTrainingNames = knownTrainingItems.map(t => t.name);
        
        context.knownTrainings = [];
        for (const t of knownTrainingItems) {
            context.knownTrainings.push({
                name: t.name,
                uuid: t.uuid,
                link: await TextEditor.enrichHTML(`@UUID[${t.uuid}]`, { async: true })
            });
        }
        // --- 2. Verfügbare Ausbildungen für dieses Tier ermitteln ---
        const allTrainings = await this.constructor.getAllTrainings();
        let possibleTrainingNames = [];
        
        for (const group of Object.values(CompanionConfig.companionSpeciesData)) {
            if (group[currentSpecies]) {
                possibleTrainingNames = group[currentSpecies].trainingModules || [];
                break;
            }
        }

        context.availableTrainings = [];
        
        for (const tName of possibleTrainingNames) {
            // Sonderfall: Tragetier oder Zugtier sind im Kompendium als ein Item zusammengefasst
            let searchStr = tName;
            if (tName === "Tragetier" || tName === "Zugtier") {
                searchStr = "Trage- oder Zugtier";
            }

            const matchingTrainings = allTrainings.filter(train => train.name.startsWith(searchStr));
            
            for (const tData of matchingTrainings) {
                if (context.availableTrainings.some(t => t.uuid === tData.uuid)) continue;
                
                // Prüfen, ob das Tier diesen Aufsatz schon exakt so gelernt hat
                if (knownTrainingNames.includes(tData.name)) continue; 
                
                // Prüfen, ob die Probe schon beim Helden liegt
                const expectedName = _loc("COMPANIONS.Training.TestName", {petName: this.companion.name, trainingName: tData.name});
                const isTraining = trainingItems.some(i => i.name === expectedName);
                
                context.availableTrainings.push({
                    name: tData.name,
                    uuid: tData.uuid,
                    isTraining: isTraining
                });
            }
        }
        
        context.availableTrainings.sort((a, b) => a.name.localeCompare(b.name));

        // --- 3. Regel-Booleans setzen ---
        context.isMountPossible = possibleTrainingNames.includes(CompanionConfig.trainingNames.Reittier);
        context.trainingBlockMessage = this.#getTrainingTabBlockMessage();
        context.tricksBlockMessage = this.#getTricksTabBlockMessage();
        
        return context;
    }

    _configureRenderParts(options) {
        if (this.typePickingMode) {
            const parts = foundry.utils.deepClone(this.constructor.PARTS);
            return { header: parts.header };
        }
        return super._configureRenderParts(options);
    }

    _replaceHTML(result, content, options) {
        super._replaceHTML(result, content, options);
        if (!this.typePickingMode) return;
        for (const partId of ['tabs', 'loyalty', 'tricks', 'training']) {
            content.querySelector(`[data-application-part="${partId}"]`)?.remove();
        }
    }

    _onRender(context, options) {
        super._onRender(context, options);
        if (this.typePickingMode) {
            this.#speciesSearch ??= new foundry.applications.ux.SearchFilter({
                inputSelector: 'input.speciesSearch[type=search]',
                contentSelector: '.species-selector-list',
                callback: this.#onSpeciesSearchFilter.bind(this),
            });
            this.#speciesSearch.bind(this.element);
            return;
        }
        tabSlider($(this.element));
    }

    _tearDown(options) {
        this.#speciesSearch?.unbind();
        super._tearDown(options);
    }

    #onSpeciesSearchFilter(_event, query, rgx, html) {
        for (const group of html.querySelectorAll('.species-group')) {
            let visible = 0;
            for (const item of group.querySelectorAll('.species-item')) {
                if (!query) {
                    item.hidden = false;
                    visible += 1;
                    continue;
                }
                const searchText = item.dataset.search || '';
                const isMatch = rgx?.test(foundry.applications.ux.SearchFilter.cleanQuery(searchText));
                item.hidden = !isMatch;
                if (isMatch) visible += 1;
            }
            group.hidden = visible === 0;
        }
    }

    static async #onSpeciesSelectorAction() {
        this.typePickingMode = !this.typePickingMode;
        await this.render({ force: true });
    }

    static async #removeSpecies() {
        await this.companion.update({ 'system.companionData.species': null });
        ui.notifications.info(_loc("COMPANIONS.Notification.SpeciesRemoved", {name: this.companion.name}));
        this.render({ force: true });
    }

    static async #selectSpecies(event, target) {
        const newSpecies = target.dataset.species;
        await this.companion.update({ 'system.companionData.species': newSpecies });
        this.typePickingMode = false;
        await this.render({ force: true });
    }

    static #toggleTrickDetails(event, target) {
        const details = target.closest('.trick-container')?.querySelector('.trick-details');
        if (!details) return;

        details.hidden = !details.hidden;
        target.classList.toggle('fa-chevron-right', details.hidden);
        target.classList.toggle('fa-chevron-down', !details.hidden);
    }

    static async #teachTrick(event, target) {
        const trickName = target.dataset.trick;

        const familiarName = _loc("LocalizedIDs.familiar");
        const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
        const zoologyWildName = _loc("LocalizedIDs.zoologyWild");
        const isWild = !isFamiliar && this.companion.items.some(i => i.type === 'information' && i.name === zoologyWildName);

        const itemName = isWild
            ? _loc("COMPANIONS.Trick.WildAnimalTraining", {petName: this.companion.name, trickName})
            : _loc("COMPANIONS.Trick.AnimalTraining", {petName: this.companion.name, trickName});
        const interval = isWild ? _loc("COMPANIONS.Interval.TwoDays") : _loc("COMPANIONS.Interval.OneDay");
        const allowedTestCount = isWild ? 5 : 7;

        let trickMod = 0;
        const currentSpecies = this.companion.system.companionData.species;
        for (const group of Object.values(CompanionConfig.companionSpeciesData)) {
            if (group[currentSpecies]) {
                const modStr = String(group[currentSpecies].trickMod).replace('–', '-');
                trickMod = Number.parseInt(modStr, 10) || 0;
                break;
            }
        }

        if (isFamiliar) trickMod += 2;

        const zoologyTalent = _loc("LocalizedIDs.Zoology");
        const allTricks = await this.constructor.getAllTricks();
        const trickData = allTricks.find(t => t.name === trickName);
        const apCost = trickData ? trickData.apCost : "?";
        const trickUuid = trickData ? trickData.uuid : "";

        const itemData = {
            name: itemName,
            type: "aggregatedTest",
            img: "systems/dsa5/icons/categories/aggregated_test.webp",
            system: {
                talent: { value: zoologyTalent },
                interval: { value: interval },
                allowedTestCount: { value: allowedTestCount },
                baseModifier: trickMod,
                cummulatedQS: { value: 0 },
                usedTestCount: { value: 0 }
            },
            flags: {
                "dsa5": {
                    trainingApCost: apCost,
                    trainingTrickUuid: trickUuid
                }
            }
        };

        await this.actor.createEmbeddedDocuments("Item", [itemData]);
        ui.notifications.info(_loc("COMPANIONS.Notification.ItemAdded", {item: itemName, actor: this.actor.name}));

        this.changeTab('tricks', 'sheet');
        this.render({ force: true });
    }

    static async #teachTraining(event, target) {
        const trainingName = target.dataset.training;
        const familiarName = _loc("LocalizedIDs.familiar");
        const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);

        let trainingMod = 0;
        const currentSpecies = this.companion.system.companionData.species;
        for (const group of Object.values(CompanionConfig.companionSpeciesData)) {
            if (group[currentSpecies]) {
                const modStr = String(group[currentSpecies].trainingMod).replace('–', '-');
                trainingMod = Number.parseInt(modStr, 10) || 0;
                break;
            }
        }

        if (isFamiliar) trainingMod += 2;

        const itemName = _loc("COMPANIONS.Training.TestName", {petName: this.companion.name, trainingName});
        const interval = _loc("COMPANIONS.Interval.OneMonth");
        const allowedTestCount = 7;
        const zoologyTalent = _loc("LocalizedIDs.Zoology");

        const allTrainings = await this.constructor.getAllTrainings();
        const trainingData = allTrainings.find(t => t.name === trainingName);
        const apCost = trainingData ? trainingData.apCost : "?";
        const trainingUuid = trainingData ? trainingData.uuid : "";

        const itemData = {
            name: itemName,
            type: "aggregatedTest",
            img: "systems/dsa5/icons/categories/aggregated_test.webp",
            system: {
                talent: { value: zoologyTalent },
                interval: { value: interval },
                allowedTestCount: { value: allowedTestCount },
                baseModifier: trainingMod,
                cummulatedQS: { value: 0 },
                usedTestCount: { value: 0 }
            },
            flags: {
                "dsa5": {
                    trainingApCost: apCost,
                    trainingTrickUuid: trainingUuid
                }
            }
        };

        await this.actor.createEmbeddedDocuments("Item", [itemData]);
        ui.notifications.info(_loc("COMPANIONS.Notification.ItemAdded", {item: itemName, actor: this.actor.name}));

        this.changeTab('training', 'sheet');
        this.render({ force: true });
    }

    static async #openTrick(event, target) {
        const uuid = target.dataset.uuid;
        const item = await fromUuid(uuid);
        if (item) item.sheet.render(true);
    }

    static async #rollTierkunde(event) {
        const tierkundeName = _loc("LocalizedIDs.Zoology");
        const skillItem = this.actor.items.find(i => i.type === "skill" && i.name === tierkundeName);

        if (!skillItem) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.MissingTalent", {talent: tierkundeName}));
            return;
        }

        const familiarName = _loc("LocalizedIDs.familiar");
        const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);

        const options = {};
        if (isFamiliar) {
            options.moreModifiers = [
                {
                    name: familiarName,
                    value: 2,
                    selected: true
                }
            ];
        }

        const setupData = await this.actor.setupSkill(skillItem, options, null);
        const testResult = await this.actor.basicTest(setupData);

        if (testResult?.result?.successLevel > 0) {
            this.loyaltyUnlocked = true;
            this.render({ force: true });
        }
    }

    static async #advanceLoyalty(event) {
        const loyaltyItem = this.#findLoyaltyItem();
        if (!loyaltyItem) return;

        const currentFW = loyaltyItem.system.talentValue.value;
        const cost = DSA5.advancementCosts.B[currentFW];
        if (cost === undefined) return;

        if (!(await this.actor.checkEnoughXP(cost))) return;

        await this.companion.updateEmbeddedDocuments("Item", [{ _id: loyaltyItem.id, "system.talentValue.value": currentFW + 1 }], { render: false });
        await this.actor._updateAPs(cost);
        await APTracker.track(this.actor, { type: 'item', item: loyaltyItem, previous: currentFW, next: currentFW + 1 }, cost);

        await this.render({ force: true });
    }

    static async #refundLoyalty(event) {
        const loyaltyItem = this.#findLoyaltyItem();
        if (!loyaltyItem) return;

        const currentFW = loyaltyItem.system.talentValue.value;
        if (currentFW <= 0) return;

        const cost = DSA5.advancementCosts.B[currentFW - 1] * -1;
        await this.companion.updateEmbeddedDocuments("Item", [{ _id: loyaltyItem.id, "system.talentValue.value": currentFW - 1 }], { render: false });
        await this.actor._updateAPs(cost);
        await APTracker.track(this.actor, { type: 'item', item: loyaltyItem, previous: currentFW, next: currentFW - 1 }, cost);

        await this.render({ force: true });
    }

    #findLoyaltyItem() {
        const loyaltyName = _loc("LocalizedIDs.loyalty");
        return this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
    }

    static #editItem(event, target) {
        const item = this.companion.items.get(target.dataset.itemId);
        if (item) item.sheet.render(true);
    }

    #getTricksTabBlockMessage() {
        const currentSpecies = this.companion.system.companionData.species;

        for (const speciesDict of Object.values(CompanionConfig.companionSpeciesData)) {
            if (speciesDict[currentSpecies]?.trickMod === '*') {
                return _loc("COMPANIONS.Trick.NotPossible");
            }
        }

        return null;
    }

    #getTrainingTabBlockMessage() {
        const trainerName = _loc("COMPANIONS.Training.AnimalTrainer");
        if (!this.actor.items.some(i => i.type === 'specialability' && i.name === trainerName))
            return _loc("COMPANIONS.Notification.AnimalTrainingWarning");

        const familiarName = _loc("LocalizedIDs.familiar");
        const wildName = _loc("LocalizedIDs.zoologyWild");
        const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
        const isWild = !isFamiliar && this.companion.items.some(i => i.type === 'information' && i.name === wildName);
        if (!isWild) return null;

        const loyaltyName = _loc("LocalizedIDs.loyalty");
        const loyaltyValue = this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName))?.system.talentValue.value ?? 0;
        return loyaltyValue < 10 ? _loc("COMPANIONS.Notification.WildAnimalLoyaltyWarning") : null;
    }
}

