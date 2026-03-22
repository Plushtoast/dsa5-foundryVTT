import Riding from '../system/automation/riding.js';

const initCompanionTabs = () => {
    
    const registerV2Tab = (actorType, tabId, tabLabelKey, tabIcon, templatePath, checkCondition = null) => {
        const sheetClasses = Object.values(CONFIG.Actor.sheetClasses[actorType] || {});
        const dsa5SheetConfig = sheetClasses.find(s => s.default) || sheetClasses[0];
        
        if (dsa5SheetConfig && dsa5SheetConfig.cls) {
            const TargetClass = dsa5SheetConfig.cls;

            if (!TargetClass.hasOwnProperty('PARTS')) TargetClass.PARTS = foundry.utils.deepClone(TargetClass.PARTS || {});
            if (!TargetClass.PARTS[tabId]) TargetClass.PARTS[tabId] = { template: templatePath, scrollable: [''] };

            if (!TargetClass.hasOwnProperty('TABS')) TargetClass.TABS = foundry.utils.deepClone(TargetClass.TABS || {});
            if (TargetClass.TABS.sheet && TargetClass.TABS.sheet.tabs) {
                if (!TargetClass.TABS.sheet.tabs.some(t => t.id === tabId)) {
                    const notesIndex = TargetClass.TABS.sheet.tabs.findIndex(t => t.id === 'notes');
                    const newTabInfo = { id: tabId, label: tabLabelKey, icon: tabIcon };
                    
                    if (notesIndex !== -1) {
                        TargetClass.TABS.sheet.tabs.splice(notesIndex, 0, newTabInfo);
                    } else {
                        TargetClass.TABS.sheet.tabs.push(newTabInfo);
                    }
                }
            }

            // TAB EIN-/AUSBLENDEN
            const origKey = `_originalPrepareTabs_${tabId}`;
            if (!TargetClass.prototype[origKey]) {
                TargetClass.prototype[origKey] = TargetClass.prototype._prepareTabs;
                
                TargetClass.prototype._prepareTabs = function(group) {
                    const tabs = this[origKey] ? this[origKey](group) : {};
                    const shouldShow = checkCondition ? checkCondition(this.actor) : true;
                    
                    if (shouldShow) {
                        if (tabs[tabId]) {
                            tabs[tabId].label = game.i18n.localize(tabLabelKey) || tabLabelKey;
                            tabs[tabId].icon = tabIcon;
                        } else {
                            tabs[tabId] = { id: tabId, group: 'sheet', label: game.i18n.localize(tabLabelKey) || tabLabelKey, icon: tabIcon };
                        }
                    } else if (tabs[tabId]) {
                        delete tabs[tabId];
                    }
                    
                    return tabs;
                };
            }

            const origContextKey = `_originalPrepareContext_Companion`;
            if (!TargetClass.prototype[origContextKey]) {
                TargetClass.prototype[origContextKey] = TargetClass.prototype._prepareContext;
                TargetClass.prototype._prepareContext = async function(options) {
                    const context = this[origContextKey] ? await this[origContextKey](options) : {};
                    if (typeof CompanionHandler !== 'undefined' && CompanionHandler.prepareCompanionsData) {
                        await CompanionHandler.prepareCompanionsData(this.actor, context);
                    }
                    return context;
                };
            }


            const origRenderKey = `_originalOnRender_Companion`;
            if (!TargetClass.prototype[origRenderKey] && TargetClass.prototype._onRender) {
                TargetClass.prototype[origRenderKey] = TargetClass.prototype._onRender;
                TargetClass.prototype._onRender = async function(context, options) {
                    if (this[origRenderKey]) await this[origRenderKey](context, options);
                    
                    if (typeof CompanionHandler !== 'undefined' && CompanionHandler.activateListeners) {
                        CompanionHandler.activateListeners(this, this.element, this.actor);
                    }
                };
            }

        }
    };

    // 1. BESITZER-TAB (Kreaturen)
    registerV2Tab('creature', 'owner', 'SHEET.Owner', 'fas fa-user-friends', 'systems/dsa5/templates/actors/actor-owner.hbs', (actor) => {
        return (actor.getFlag('dsa5', 'owners') || []).length > 0;
    });

    // 2. BEGLEITER-TAB (Helden & NPCs)
    registerV2Tab('character', 'companion', 'SHEET.Companion', 'fas fa-paw', 'systems/dsa5/templates/actors/actor-companion.hbs', () => true);
    registerV2Tab('npc', 'companion', 'SHEET.Companion', 'fas fa-paw', 'systems/dsa5/templates/actors/actor-companion.hbs', () => true);
};


if (globalThis.game && globalThis.game.ready) {
    initCompanionTabs();
} else {
    Hooks.once("ready", initCompanionTabs);
}


export default class CompanionHandler {
  
  static trickCache = null;

    static async getAllTricks() {
        if (this.trickCache) return this.trickCache;
        const tricks = [];
        const seenNames = new Set();
        
        for (let pack of game.packs.filter(p => p.documentName === "Item")) {
            const index = await pack.getIndex({fields: ["name", "type", "system.traitType.value", "system.APValue.value"]});
            for (let entry of index) {
                if (entry.type === "trait") {
                    let isTrick = entry.system?.traitType?.value === "trick";
                    
                    if (!entry.system) {
                        const doc = await pack.getDocument(entry._id);
                        if (doc && doc.system?.traitType?.value === "trick") isTrick = true;
                    }

                    if (isTrick && !seenNames.has(entry.name)) {
                        seenNames.add(entry.name);
                        
                        let apCost = entry.system?.APValue?.value;
                        if (apCost === undefined) {
                            const doc = await pack.getDocument(entry._id);
                            apCost = doc?.system?.APValue?.value;
                        }
                        
                        tricks.push({ 
                            name: entry.name, 
                            uuid: entry.uuid, 
                            apCost: Number(apCost) || 0 
                        });
                    }
                }
            }
        }
        tricks.sort((a, b) => a.name.localeCompare(b.name));
        this.trickCache = tricks;
        return tricks;
    }
	
	static async getAllTrainings() {
        if (this.trainingCache) return this.trainingCache;
        const trainings = [];
        const seenNames = new Set();
        
        for (let pack of game.packs.filter(p => p.documentName === "Item")) {
            const index = await pack.getIndex({fields: ["name", "type", "system.traitType.value", "system.APValue.value"]});
            for (let entry of index) {
                if (entry.type === "trait") {
                    let isTraining = entry.system?.traitType?.value === "training";
                    
                    if (!entry.system) {
                        const doc = await pack.getDocument(entry._id);
                        if (doc && doc.system?.traitType?.value === "training") isTraining = true;
                    }

                    if (isTraining && !seenNames.has(entry.name)) {
                        seenNames.add(entry.name);
                        
                        let apCost = entry.system?.APValue?.value;
                        if (apCost === undefined) {
                            const doc = await pack.getDocument(entry._id);
                            apCost = doc?.system?.APValue?.value;
                        }
                        
                        trainings.push({ 
                            name: entry.name, 
                            uuid: entry.uuid, 
                            apCost: Number(apCost) || 0 
                        });
                    }
                }
            }
        }
        trainings.sort((a, b) => a.name.localeCompare(b.name));
        this.trainingCache = trainings;
        return trainings;
    }
  
  static expandedCompanions = new Set();
  static speciesImageCache = null;
  
  // --- Dynamische Datenstruktur mit Lokalisierung ---
    static get COMPANION_SPECIES_DATA() {
        const tr = (key) => game.i18n.localize(`TRAINING.${key}`);

        return {
            [game.i18n.localize("PETGROUP.Dogs")]: {
                [game.i18n.localize("PETSPECIES.Bornlaender")]: { trickMod: "3", trainingMod: "2", trainingModules: [tr("Huetetier"), tr("Renntier"), tr("Tragetier"), tr("Wachtier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Bosparaniel")]: { trickMod: "3", trainingMod: "0", trainingModules: [tr("Jagdtier"), tr("Suchtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.BunterHund")]: { trickMod: "2", trainingMod: "1", trainingModules: [tr("Tragetier"), tr("Wachtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.EspenerSaupacker")]: { trickMod: "2", trainingMod: "1", trainingModules: [tr("Jagdtier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.Firnlaeufer")]: { trickMod: "2", trainingMod: "2", trainingModules: [tr("Renntier"), tr("Suchtier"), tr("Tragetier"), tr("Wachtier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.GaretischesSchlappohr")]: { trickMod: "3", trainingMod: "3", trainingModules: [tr("Jagdtier"), tr("Suchtier"), tr("Tragetier")] },
                [game.i18n.localize("PETSPECIES.Maehnenwolf")]: { trickMod: "-2", trainingMod: "-2", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.NivesischerSteppenhund")]: { trickMod: "2", trainingMod: "1", trainingModules: [tr("Huetetier"), tr("Jagdtier"), tr("Suchtier"), tr("Tragetier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.OnjaroBracke")]: { trickMod: "2", trainingMod: "2", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Suchtier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.OrkischerKriegshund")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Wachtier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Rahjataenzer")]: { trickMod: "3", trainingMod: "2", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.SchwarzerOlporter")]: { trickMod: "0", trainingMod: "2", trainingModules: [tr("Huetetier"), tr("Tragetier"), tr("Suchtier"), tr("Wachtier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Siebenwindlaeufer")]: { trickMod: "3", trainingMod: "2", trainingModules: [tr("Jagdtier"), tr("Renntier")] },
                [game.i18n.localize("PETSPECIES.TherengarTerrier")]: { trickMod: "1", trainingMod: "1", trainingModules: [tr("Jagdtier"), tr("Suchtier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.Trollmops")]: { trickMod: "3", trainingMod: "-1", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Tuzaker")]: { trickMod: "2", trainingMod: "2", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.WehrheimerBluthund")]: { trickMod: "1", trainingMod: "1", trainingModules: [tr("Kampftier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.WeisserKoscher")]: { trickMod: "1", trainingMod: "1", trainingModules: [tr("Huetetier"), tr("Tragetier"), tr("Suchtier"), tr("Wachtier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.WinhallerWolfsjaeger")]: { trickMod: "1", trainingMod: "2", trainingModules: [tr("Jagdtier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.ZornbrechterBluthund")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Wachtier"), tr("Zugtier")] }
            },
            [game.i18n.localize("PETGROUP.Cats")]: {
                [game.i18n.localize("PETSPECIES.AlAnfaner")]: { trickMod: "-1", trainingMod: "-2", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Aranier")]: { trickMod: "-1", trainingMod: "-3", trainingModules: [tr("Kampftier"), tr("Renntier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Burgenkatz")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.ChaAyZhamorrah")]: { trickMod: "-2", trainingMod: "-4", trainingModules: [tr("Kampftier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Hexenkatz")]: { trickMod: "-1", trainingMod: "-3", trainingModules: [tr("Kampftier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Nuala")]: { trickMod: "-2", trainingMod: "-4", trainingModules: [tr("Kampftier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Scheunenkatz")]: { trickMod: "-1", trainingMod: "-3", trainingModules: [tr("Kampftier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Wildkatze")]: { trickMod: "-3", trainingMod: "-4", trainingModules: [tr("Kampftier")] }
            },
            [game.i18n.localize("PETGROUP.Donkeys")]: {
                [game.i18n.localize("PETSPECIES.Esel")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Grautier")]: { trickMod: "-1", trainingMod: "0", trainingModules: [tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Maulesel")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Reittier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Maultier")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Reittier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] }
            },
            [game.i18n.localize("PETGROUP.Horses")]: {
                [game.i18n.localize("PETSPECIES.ElenvinerVollblut")]: { trickMod: "-1", trainingMod: "1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Goldfelser")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier")] },
                [game.i18n.localize("PETSPECIES.Langmaehne")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Nordmaehne")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Shadif")]: { trickMod: "1", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.SvellttalerKaltblut")]: { trickMod: "1", trainingMod: "1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Teshkaler")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.TralloperRiese")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Tulamide")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Warunker")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Yaquirtaler")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zirkustier")] }
            },
            [game.i18n.localize("PETGROUP.Ponies")]: {
                [game.i18n.localize("PETSPECIES.BeilunkerZwergenpony")]: { trickMod: "0", trainingMod: "1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Ferkinapony")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Maraskanpony")]: { trickMod: "-1", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Orkpony")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Paavipony")]: { trickMod: "0", trainingMod: "0", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] }
            },
            [game.i18n.localize("PETGROUP.FarmAnimals")]: {
                [game.i18n.localize("PETSPECIES.Gans")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Wachtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Huhn")]: { trickMod: "1", trainingMod: "-1", trainingModules: [tr("Renntier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Rind")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Schaf")]: { trickMod: "-1", trainingMod: "-2", trainingModules: [tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Schwein")]: { trickMod: "0", trainingMod: "-2", trainingModules: [tr("Reittier"), tr("Suchtier"), tr("Tragetier"), tr("Zugtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Ziege")]: { trickMod: "-1", trainingMod: "-2", trainingModules: [tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] }
            },
            [game.i18n.localize("PETGROUP.Birds")]: {
                [game.i18n.localize("PETSPECIES.Adler")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Jagdtier"), tr("Kampftier")] },
                [game.i18n.localize("PETSPECIES.Falke")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Jagdtier"), tr("Kampftier")] },
                [game.i18n.localize("PETSPECIES.Papagei")]: { trickMod: "2", trainingMod: "-1", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Pfau")]: { trickMod: "0", trainingMod: "-1", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Rabe")]: { trickMod: "2", trainingMod: "1", trainingModules: [tr("Wachtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Singvogel")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Taube")]: { trickMod: "0", trainingMod: "1", trainingModules: [tr("Tragetier"), tr("Zirkustier")] }
            },
            [game.i18n.localize("PETGROUP.WildAnimals")]: {
                [game.i18n.localize("PETSPECIES.Affe")]: { trickMod: "2", trainingMod: "-2", trainingModules: [tr("Wachtier"), tr("Tragetier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Baer")]: { trickMod: "2", trainingMod: "-3", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Dachs")]: { trickMod: "-2", trainingMod: "-3", trainingModules: [tr("Suchtier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Eidechse")]: { trickMod: "-3", trainingMod: "-3", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Elch")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Elefant")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Flugechse")]: { trickMod: "-3", trainingMod: "-4", trainingModules: [tr("Jagdtier"), tr("Reittier")] },
                [game.i18n.localize("PETSPECIES.Frettchen")]: { trickMod: "1", trainingMod: "-2", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Gelbschwanzskorpion")]: { trickMod: "-6", trainingMod: "*", trainingModules: [] },
                [game.i18n.localize("PETSPECIES.Greifkatze")]: { trickMod: "-3", trainingMod: "-3", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Hippogriff")]: { trickMod: "-3", trainingMod: "-3", trainingModules: [tr("Kampftier"), tr("Reittier")] },
                [game.i18n.localize("PETSPECIES.Hornechse")]: { trickMod: "-4", trainingMod: "-5", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.IkanariaSchmetterling")]: { trickMod: "-7", trainingMod: "*", trainingModules: [] },
                [game.i18n.localize("PETSPECIES.Kamel")]: { trickMod: "-1", trainingMod: "1", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Renntier"), tr("Tragetier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Karen")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Krokodil")]: { trickMod: "-3", trainingMod: "-5", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Mammut")]: { trickMod: "-2", trainingMod: "-3", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Zirkustier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Meckerdrache")]: { trickMod: "*", trainingMod: "*", trainingModules: [] },
                [game.i18n.localize("PETSPECIES.Mungo")]: { trickMod: "1", trainingMod: "-2", trainingModules: [tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Nachtwind")]: { trickMod: "-3", trainingMod: "-3", trainingModules: [tr("Wachtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Pardel")]: { trickMod: "-1", trainingMod: "-1", trainingModules: [tr("Renntier"), tr("Jagdtier"), tr("Kampftier"), tr("Wachtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Riesenalk")]: { trickMod: "-4", trainingMod: "-4", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.Riesenhirschkaefer")]: { trickMod: "-4", trainingMod: "-5", trainingModules: [tr("Tragetier"), tr("Wachtier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Schildkroete")]: { trickMod: "1", trainingMod: "1", trainingModules: [tr("Wachtier"), tr("Zirkustier")] },
                [game.i18n.localize("PETSPECIES.Strauss")]: { trickMod: "-3", trainingMod: "-2", trainingModules: [tr("Reittier")] },
                [game.i18n.localize("PETSPECIES.Sumpfegel")]: { trickMod: "-7", trainingMod: "*", trainingModules: [] },
                [game.i18n.localize("PETSPECIES.Westwinddrache")]: { trickMod: "-7", trainingMod: "-7", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Wachtier")] },
                [game.i18n.localize("PETSPECIES.Wildschwein")]: { trickMod: "-2", trainingMod: "-2", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Suchtier"), tr("Tragetier"), tr("Wachtier"), tr("Zugtier")] },
                [game.i18n.localize("PETSPECIES.Wolf")]: { trickMod: "-2", trainingMod: "-2", trainingModules: [tr("Jagdtier"), tr("Kampftier"), tr("Tragetier"), tr("Wachtier"), tr("Suchtier")] },
                [game.i18n.localize("PETSPECIES.Wollnashorn")]: { trickMod: "-3", trainingMod: "-4", trainingModules: [tr("Kampftier"), tr("Reittier"), tr("Tragetier"), tr("Wachtier"), tr("Zugtier")] }
            }
        };
    }
  
  // Sucht die Bilder aller Tiere aus den Kompendien
    static async getSpeciesDataWithImages() {
        if (this.speciesImageCache) return this.speciesImageCache;
        
        const imageMap = new Map();
        for (let pack of game.packs.filter(p => p.documentName === "Actor")) {
            const index = await pack.getIndex({fields: ["name", "img"]});
            for (let entry of index) {
                if (!imageMap.has(entry.name)) imageMap.set(entry.name, entry.img);
            }
        }

        const enrichedData = {};
        for (const [group, speciesDict] of Object.entries(CompanionHandler.COMPANION_SPECIES_DATA)) {
            enrichedData[group] = [];
            for (const [speciesName, speciesInfo] of Object.entries(speciesDict)) {
                enrichedData[group].push({
                    name: speciesName,
                    modifier: speciesInfo.trickMod,
                    img: imageMap.get(speciesName) || "icons/svg/mystery-man-black.svg"
                });
            }
        }
        this.speciesImageCache = enrichedData;
        return enrichedData;
    }
  
  static async setCompanion(sheet, uuid) {
    const droppedActor = await fromUuid(uuid);
    if (!droppedActor) return false; 

    if (!droppedActor.prototypeToken.actorLink) {
      ui.notifications.warn(game.i18n.localize("SHEET.TokenLinkWarning"));
      return false;
    }

    const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
    const isFamiliar = droppedActor.items.some(i => i.type === 'trait' && i.name === familiarName);
    let owners = droppedActor.getFlag('dsa5', 'owners') || [];

    if (isFamiliar && owners.length >= 1 && !owners.includes(sheet.actor.uuid)) {
        ui.notifications.warn(game.i18n.localize("SHEET.FamiliarOwnerWarning"));
        return false;
    }

    let detectedSpecies = null;
    for (const speciesDict of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
        if (speciesDict[droppedActor.name] !== undefined) {
            detectedSpecies = droppedActor.name;
            break;
        }
    }
    
    if (detectedSpecies && !droppedActor.getFlag('dsa5', 'species')) {
        await droppedActor.setFlag('dsa5', 'species', detectedSpecies);
    }

    const currentTab = sheet.tabGroups?.sheet;
    let companions = sheet.actor.getFlag('dsa5', 'companions') || [];
    if (!companions.includes(uuid)) {
        companions = [...companions, uuid];
        await sheet.actor.update({ "flags.dsa5.companions": companions }, { render: false });
    }

    if (!owners.includes(sheet.actor.uuid)) {
        owners = [...owners, sheet.actor.uuid];
        await droppedActor.update({ "flags.dsa5.owners": owners }, { render: false });
    }

    const isHomunculus = droppedActor.items.some(i => i.type === 'trait' && i.name === game.i18n.localize("SHEET.HomunculusCreation"));
    
    if (!isHomunculus) {
        const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
        const loyaltyItem = droppedActor.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
        
        const initialLoyalty = isFamiliar ? 4 : 0;
        
        if (!loyaltyItem) {
            let loyaltyItemData = null;

            for (let pack of game.packs.filter(p => p.documentName === "Item")) {
                const index = await pack.getIndex();
                const entry = index.find(i => i.name === loyaltyName && i.type === "skill");
                
                if (entry) {
                    const doc = await pack.getDocument(entry._id);
                    loyaltyItemData = doc.toObject();
                    break;
                }
            }

            if (loyaltyItemData) {
                loyaltyItemData.system.talentValue.value = initialLoyalty;
                await droppedActor.createEmbeddedDocuments("Item", [loyaltyItemData]);
                
                ui.notifications.info(game.i18n.format("SHEET.LoyaltyAdded", {
                    name: droppedActor.name, 
                    talent: loyaltyName, 
                    val: initialLoyalty
                }));
            } else {
                ui.notifications.warn(game.i18n.format("SHEET.LoyaltyNotFound", {
                    talent: loyaltyName
                }));
            }
            
        } else if (isFamiliar && loyaltyItem.system.talentValue.value < 4) {
            await droppedActor.updateEmbeddedDocuments("Item", [{
                _id: loyaltyItem.id,
                "system.talentValue.value": 4
            }]);
            ui.notifications.info(`Die Loyalität von ${droppedActor.name} wurde auf 4 angehoben (Vertrautentier).`);
        }
    }
	
	// --- Eigenschaft "Begleiter" für Wildtiere und domestizierte Tiere ---
    const companionTraitName = game.i18n.localize("SHEET.CompanionTrait");
    
    if (!isFamiliar && !isHomunculus) {
        const hasCompanionTrait = droppedActor.items.some(i => i.type === 'trait' && i.name === companionTraitName);
        
        if (!hasCompanionTrait) {
            const traitData = {
                name: companionTraitName,
                type: "trait",
                system: { traitType: { value: "general" } }
            };
            
            await droppedActor.createEmbeddedDocuments("Item", [traitData]);
            ui.notifications.info(game.i18n.format("SHEET.CompanionAdded", {name: droppedActor.name}));
        }
    }

    await sheet.render({ force: true });

    if (currentTab && sheet.tabGroups?.sheet !== currentTab) {
        sheet.changeTab(currentTab, 'sheet');
    }

    return true;
  }
  
    // --- Tier-Bogen öffnen und Besitzer-Bogen schließen ---
  static async openCompanion(sheet, ev, target) {
    const uuid = target.dataset.uuid || target.closest('[data-uuid]')?.dataset.uuid;
    if (!uuid) return;
    const actor = await fromUuid(uuid);
    
    if (actor) {
        await actor.sheet.render(true, { focus: true });
        
        setTimeout(() => {
            if (actor.sheet.changeTab) {
                actor.sheet.changeTab('owner', 'sheet');
            }
        }, 50);
    }
  }
  


  static async handleCompanionRegeneration(sheet, ev, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const actor = await fromUuid(uuid);
    if (actor && actor.isOwner) {
        const setup = await actor.setupRegeneration("regenerate", {});
        if (setup) await actor.basicTest(setup);
    } else {
        ui.notifications.warn(game.i18n.localize("SHEET.NoPermissionRegeneration"));
    }
  }

  static async removeCompanion(sheet, ev, target) {
    const btn = target.closest('[data-uuid]');
    const uuid = btn ? btn.dataset.uuid : null;
    if (!uuid) return;

    const currentTab = sheet.tabGroups?.sheet;
    let companions = sheet.actor.getFlag('dsa5', 'companions') || [];
    companions = companions.filter(c => c !== uuid);
    await sheet.actor.update({ "flags.dsa5.companions": companions }, { render: false });

    const droppedActor = await fromUuid(uuid);
    if (droppedActor) {
        let owners = droppedActor.getFlag('dsa5', 'owners') || [];
        owners = owners.filter(o => o !== sheet.actor.uuid);
        await droppedActor.update({ "flags.dsa5.owners": owners }, { render: false });

        // ---  Trait "Begleiter" entfernen, wenn das Tier keine Besitzer mehr hat ---
        if (owners.length === 0) {
            const companionTraitName = game.i18n.localize("SHEET.CompanionTrait");
            const companionTraits = droppedActor.items.filter(i => i.type === 'trait' && i.name === companionTraitName).map(i => i.id);
            
            if (companionTraits.length > 0) {
                await droppedActor.deleteEmbeddedDocuments("Item", companionTraits);
            }
        }
    }

    await sheet.render({ force: true });

    if (currentTab === 'companion' || currentTab === 'owner') {
        sheet.changeTab('main', 'sheet');
    } else if (currentTab) {
        sheet.changeTab(currentTab, 'sheet');
    }
  }

  static async prepareCompanionsData(actor, sheetData, Riding) {
    if (Riding) {
        sheetData.horseSpeeds = Object.keys(Riding.speedKeys).reduce((acc, key) => {
        acc[key] = `RIDING.speeds.${key}`;
        return acc;
        }, {});
    }

    const companionUuids = actor.getFlag('dsa5', 'companions') || [];
    sheetData.hasCompanions = companionUuids.length > 0; 

    const familiars = [];
    const groupCompanions = [];
    const regularCompanions = [];

    if (sheetData.hasCompanions) {
        const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
        const homunculusName = game.i18n.localize("SHEET.HomunculusCreation");
        const zoologyDom = game.i18n.localize("LocalizedIDs.zoologyDomesticated");
        const hotbarCompUuid = actor.getFlag('dsa5', 'hotbarCompanion');

        for (const cUuid of companionUuids) {
            const comp = await fromUuid(cUuid);
            if (!comp) continue;
            
            const owners = comp.getFlag('dsa5', 'owners') || [];
            const isDomesticated = comp.items.some(i => i.type === 'information' && i.name === zoologyDom);
            
            // --- Tiertyp-Wechsel ---
            const natureIcon = isDomesticated ? 'fa-house-chimney' : 'fa-mountain-sun';
            const natureTooltip = isDomesticated ? 'SHEET.domesticatedAnimal' : 'SHEET.wildAnimal';
            
            const otherNatureIcon = isDomesticated ? 'fa-mountain-sun' : 'fa-house-chimney';
            const otherNatureTooltip = isDomesticated ? 'SHEET.wildAnimal' : 'SHEET.domesticatedAnimal';

            const isFamiliar = comp.items.some(i => i.type === 'trait' && i.name === familiarName);
            const isHomunculus = comp.items.some(i => i.type === 'trait' && i.name === homunculusName);
			
			let loyaltyData = null;
            let hasSpells = comp.items.some(i => ['spell', 'ritual', 'magictrick', 'magicalsign'].includes(i.type));
            if (isFamiliar || isHomunculus) {
                hasSpells = true;
            }
            
            const hasPrayers = comp.items.some(i => ['liturgy', 'ceremony', 'blessing'].includes(i.type));
            
			if (isHomunculus) {
				const persuasionName = game.i18n.localize("SHEET.Fast-Talk");
				const skillItem = actor.items.find(i => i.type === 'skill' && i.name === persuasionName);
				if (skillItem) {
					loyaltyData = {
						id: skillItem.id,
						actorUuid: actor.uuid,
						value: skillItem.system.talentValue.value,
						char1: 'mu', char2: 'in', char3: 'ch'
					};
				}
			} else {
				const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
				const loyaltyItem = comp.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
				if (loyaltyItem) {
					loyaltyData = {
						id: loyaltyItem.id,
						actorUuid: comp.uuid,
						value: loyaltyItem.system.talentValue.value,
						char1: loyaltyItem.system.characteristic1.value,
						char2: loyaltyItem.system.characteristic2.value,
						char3: loyaltyItem.system.characteristic3.value
					};
				}
			}
			
            let rawEffects = comp.effects ? (typeof comp.effects.values === 'function' ? Array.from(comp.effects.values()) : comp.effects) : [];
            const activeEffects = rawEffects.map(e => {
                const img = e.img || e.icon || (e.texture ? e.texture.src : null) || "icons/svg/aura.svg";
                let name = e.name || e.label;
                if (!name && e.statuses) name = (typeof e.statuses.size !== 'undefined') ? Array.from(e.statuses)[0] : e.statuses[0];
                let val = e.flags?.dsa5?.value;

                return { id: e.id || e._id, img: img, name: name || game.i18n.localize("SHEET.Effect"), value: val, disabled: e.disabled === true };
            }).filter(e => e.disabled === false);
			
			
            // Lokalisierte Suchbegriffe laden
            const trickIndicator = "(Trick):"; 
            const trainingIndicator = game.i18n.localize("SHEET.TrainingModuleIndicator");
            const trainingPrefix = game.i18n.localize("SHEET.TrainingShortPrefix");
            const trickPrefix = game.i18n.localize("SHEET.TrickShortPrefix"); // NEU

            const companionTests = actor.items.filter(i => 
                i.type === "aggregatedTest" && 
                i.name.includes(comp.name) && 
                (i.name.includes(trickIndicator) || i.name.includes(trainingIndicator))
            ).map(test => {
                const qs = test.system.cummulatedQS?.value || 0;
                const isCompleted = qs >= 10; 
                
                const isTraining = test.name.includes(trainingIndicator);
                let shortName = test.name;
                
                if (isTraining) {
                    const parts = test.name.split(trainingIndicator);
                    if (parts.length > 1) {
                        shortName = `${trainingPrefix} ${parts[1].trim()}`;
                    }
                } else {
                    const parts = test.name.split(trickIndicator);
                    if (parts.length > 1) {
                        shortName = `${trickPrefix} ${parts[1].trim()}`;
                    }
                }
                
                const apCost = test.getFlag("dsa5", "trainingApCost") || "?";

                return {
                    item: test,
                    shortName: shortName,
                    isCompleted: isCompleted,
                    apCost: apCost,
                    isTraining: isTraining 
                };
            });

            // Sortierung: Ausbildungsaufsätze immer nach oben, danach alphabetisch
            companionTests.sort((a, b) => {
                if (a.isTraining && !b.isTraining) return -1;
                if (!a.isTraining && b.isTraining) return 1;
                return a.shortName.localeCompare(b.shortName);
            });
			
			// --- Hotbar-Items für das Pet laden & in 2 Reihen aufteilen ---
            const savedHotbar = comp.getFlag('dsa5', 'skillHotbar') || Array(14).fill(null);
            const hotbarItems = savedHotbar.map(itemId => {
                if (!itemId) return null;
                const item = comp.items.get(itemId);
                if (!item) return null;
                
                const desc = item.system.description?.value || "";
                const tooltipHtml = `<div class='itemTooltip'><h1>${item.name}</h1>${desc}</div>`;
                
                return {
                    id: item.id,
                    name: item.name,
                    img: item.img,
                    tooltip: tooltipHtml
                };
            });
            
            const hotbarRow1 = hotbarItems.slice(0, 7);
            const hotbarRow2 = hotbarItems.slice(7, 14);
			
			// --- Prüfen, ob "Reittier" als Aufsatz möglich ist ---
            let isMountPossible = false;
            const currentSpecies = comp.getFlag('dsa5', 'species');
            const reittierStr = game.i18n.localize("TRAINING.Reittier") || "Reittier";
            
            if (!currentSpecies) {
                isMountPossible = true;
            } else {
                for (const group of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
                    if (group[currentSpecies] && group[currentSpecies].trainingModules) {
                        if (group[currentSpecies].trainingModules.includes(reittierStr)) {
                            isMountPossible = true;
                        }
                        break;
                    }
                }
            }
            
            // ---  Prüfen, ob dieses Pferd gerade vom Helden geritten wird ---
            const isMountActive = actor.system.horse?.actorId === comp.id && actor.system.horse?.isRiding === 1;

            comp.prepareCompanion = {
                hasSpells: hasSpells,
                hasPrayers: hasPrayers,
                hasNone: !hasSpells && !hasPrayers,
                containerClass: (hasSpells && hasPrayers) ? 'third' : 'fourty',
                lepClass: (hasSpells || hasPrayers) ? '' : 'soloBar',
                loyalty: loyaltyData,
                effects: activeEffects,
				natureIcon: natureIcon,
				natureTooltip: natureTooltip,
                otherNatureIcon: otherNatureIcon,
                otherNatureTooltip: otherNatureTooltip,
                isDomesticated: isDomesticated,
				isMountPossible: isMountPossible,
                isMountActive: isMountActive,
				isHotbarControlled: (comp.uuid === hotbarCompUuid),
				isFamiliar: isFamiliar,
				isHomunculus: isHomunculus,
				showNatureIcon: !isFamiliar && !isHomunculus,
				isExpanded: CompanionHandler.expandedCompanions.has(comp.uuid),
                hasEffects: activeEffects.length > 0,
				hotbarItems: hotbarItems,
				hotbarRow1: hotbarRow1,
                hotbarRow2: hotbarRow2,
				trainingTests: companionTests
            };

            if (isFamiliar || isHomunculus) {
			    familiars.push(comp);
			} else if (owners.length > 1) {
				groupCompanions.push(comp);
			} else {
				regularCompanions.push(comp);
			}
		}
    }
    
    sheetData.familiars = familiars;
    sheetData.groupCompanions = groupCompanions;
    sheetData.regularCompanions = regularCompanions;

    const ownerUuids = actor.getFlag('dsa5', 'owners') || [];
    const petOwners = [];
    for (const oUuid of ownerUuids) {
      const owner = await fromUuid(oUuid);
      if (owner) petOwners.push(owner);
    }
    sheetData.petOwners = petOwners;
  }

  static activateListeners(sheet, html, actor) {
	  
        const domElement = html.length ? html[0] : html;
        const sheetWindow = domElement.closest('.app, .application') || domElement;
        
        const scrollContainer = sheetWindow.querySelector('.sheet-body');
        
        if (scrollContainer) {
            const uniqueId = this.id || (this.actor ? this.actor.id : 'companion');
            window._petScrollStates = window._petScrollStates || {};
            
            const savedPos = window._petScrollStates[uniqueId];
            if (savedPos > 0) {
                requestAnimationFrame(() => {
                    scrollContainer.scrollTop = savedPos;
                });
                
                setTimeout(() => {
                    if (scrollContainer.scrollTop !== savedPos) {
                        scrollContainer.scrollTop = savedPos;
                    }
                }, 50);
            }

            let scrollTimeout;
            scrollContainer.addEventListener('scroll', ev => {
                const currentPos = scrollContainer.scrollTop;
                
                clearTimeout(scrollTimeout);
                scrollTimeout = setTimeout(() => {
                    const companionTab = sheetWindow.querySelector('.tab[data-tab="companion"]');
                    if (companionTab && companionTab.classList.contains('active')) {
                        window._petScrollStates[uniqueId] = currentPos;
                    }
                }, 50);
            }, { passive: true });
        }
    
    // ---  Hover-Effekt ---
    html.querySelectorAll('.nature-toggle-container').forEach(el => {
        el.addEventListener('mouseenter', () => {
            el.querySelector('.toggle-nature-arrow').style.opacity = '1';
        });
        el.addEventListener('mouseleave', () => {
            el.querySelector('.toggle-nature-arrow').style.opacity = '0';
        });
    });

    // ---  Pfeil auf-/zuklappen ---
    html.querySelectorAll('.toggle-nature-arrow').forEach(el => {
        el.addEventListener('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const container = ev.currentTarget.closest('.nature-toggle-container');
            const optionsDiv = container.querySelector('.nature-options');
            $(optionsDiv).fadeToggle(150);
            ev.currentTarget.classList.toggle('fa-chevron-right');
            ev.currentTarget.classList.toggle('fa-chevron-left');
        });
    });
	
	// --- Besitzer-Bogen öffnen und Tier-Bogen schließen ---
    html.querySelectorAll('[data-action="openOwnerSheet"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();

            const uuid = ev.currentTarget.dataset.uuid;
            if (!uuid) return;

            const ownerActor = await fromUuid(uuid);
            if (ownerActor) {
                // Besitzer-Bogen öffnen
                await ownerActor.sheet.render(true, { focus: true });

                setTimeout(() => {
                    if (ownerActor.sheet.changeTab) {
                        ownerActor.sheet.changeTab('companion', 'sheet');
                    }
                }, 50);

                // Den aktuellen Tier-Bogen schließen
                sheet.close();
            }
        });
    });
	
	// --- Sammelprobe abbrechen ---
    html.querySelectorAll('[data-action="deleteAggregatedTest"]').forEach(el => {
        el.addEventListener('click', async (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const itemId = ev.currentTarget.dataset.itemId;
            const testItem = actor.items.get(itemId); 
            
            if (!testItem) return;

            // Sicherheitsabfrage vor dem Löschen
            const confirmed = await foundry.applications.api.DialogV2.confirm({
                window: { title: game.i18n.localize("SHEET.CancelProbe") },
				content: game.i18n.format("SHEET.CancelProbeText", {name: testItem.name}),
                modal: true
            });

            if (confirmed) {
                await testItem.delete();
                ui.notifications.info(game.i18n.format("SHEET.ProbeCanceled", {name: testItem.name}));
            }
        });
    });

    // ---  Tiertyp wechseln mit DSA5 DialogV2 ---
    html.querySelectorAll('.change-nature-btn').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const container = ev.currentTarget.closest('.nature-toggle-container');
            const uuid = container.dataset.uuid;
            const compActor = await fromUuid(uuid);
            if (!compActor) return;

            const isCurrentlyDomesticated = container.dataset.isDomesticated === "true";
            const zoologyDomName = game.i18n.localize("LocalizedIDs.zoologyDomesticated");
            const zoologyWildName = game.i18n.localize("LocalizedIDs.zoologyWild");
            const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");

            const dialogText = game.i18n.format("SHEET.loyaltyChangeText", { name: compActor.name });
            const newLoyaltyValue = isCurrentlyDomesticated ? 0 : 4; // Wechselt zu Wild (0) oder Domestiziert (4)

            new foundry.applications.api.DialogV2({
                window: {
                    title: game.i18n.localize("SHEET.loyaltyChangeTitle"),
                },
                content: `<p>${dialogText}</p>`,
                buttons: [
                    {
                        action: 'accept',
                        label: game.i18n.localize("SHEET.Accept"),
                        icon: 'fas fa-check',
                        default: true,
                        callback: async () => {
                            // 1. Info-Item austauschen
                            if (isCurrentlyDomesticated) {
                                // Mache es zum Wildtier
                                const domItems = compActor.items.filter(i => i.type === 'information' && i.name === zoologyDomName).map(i => i.id);
                                await compActor.deleteEmbeddedDocuments("Item", domItems);
                                await compActor.createEmbeddedDocuments("Item", [{ name: zoologyWildName, type: "information" }]);
                            } else {
                                // Mache es zum domestizierten Tier
                                const wildItems = compActor.items.filter(i => i.type === 'information' && i.name === zoologyWildName).map(i => i.id);
                                await compActor.deleteEmbeddedDocuments("Item", wildItems);
                                await compActor.createEmbeddedDocuments("Item", [{ name: zoologyDomName, type: "information" }]);
                            }

                            // 2. Loyalität anpassen
                            const loyaltyItem = compActor.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
                            if (loyaltyItem) {
                                await compActor.updateEmbeddedDocuments('Item', [{
                                    _id: loyaltyItem.id,
                                    'system.talentValue.value': newLoyaltyValue
                                }]);
                            }
                            
                            // Sheet des Hauptcharakters aktualisieren, um die Änderung auf der Karte sofort zu sehen
                            sheet.render(true);
                        }
                    },
                    {
                        action: 'decline',
                        label: game.i18n.localize("SHEET.Decline"),
                        icon: 'fas fa-times',
                        callback: () => {
                            // Einfach schließen, nichts tun.
                            container.querySelector('.nature-options').style.display = 'none';
                            container.querySelector('.toggle-nature-arrow').classList.replace('fa-chevron-left', 'fa-chevron-right');
                        }
                    }
                ]
            }).render(true);
        });
    });
   
   html.querySelectorAll('[data-action="rollCompanionAggregatedProbe"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const itemId = ev.currentTarget.dataset.itemId;
            let aggregated = actor.items.get(itemId).toObject();
            const which = ev.currentTarget.dataset.which || "";
            const attr = aggregated.system.talent[`value${which}`];
            let skill = actor.items.find(i => i.name === attr && i.type === 'skill');
            
            let infoMsg = `<h3 class="center"><b>${game.i18n.localize('TYPES.Item.aggregatedTest')}</b></h3>`;
            
            if (aggregated.system.usedTestCount.value >= aggregated.system.allowedTestCount.value) {
                infoMsg += `${game.i18n.localize('Aggregated.noMoreAllowed')}`;
                ChatMessage.create(game.dsa5.apps.DSA5_Utility.chatDataSetup(infoMsg));
            } else {
                const options = {
                    moreModifiers: [
                        { name: game.i18n.localize('failedTests'), value: -1 * aggregated.system.previousFailedTests.value, selected: true },
                        { name: game.i18n.localize('Modifier'), value: aggregated.system.baseModifier, selected: true }
                    ]
                };
                
                const tokenId = actor.getActiveTokens()[0]?.id || null;
                
                actor.setupSkill(skill, options, tokenId).then(setupData => {
                    actor.basicTest(setupData).then(res => {
                        if (res.result.successLevel > 0) {
                            aggregated.system.cummulatedQS.value = Math.min(10, res.result.qualityStep + aggregated.system.cummulatedQS.value);
                        } else {
                            aggregated.system.previousFailedTests.value += 1;
                        }
                        aggregated.system.usedTestCount.value += 1;
                        
                        actor.updateEmbeddedDocuments('Item', [aggregated]).then(() => {
                            const updated = actor.items.get(itemId);
                            updated.postItem();
                            if (aggregated.system.cummulatedQS.value >= 10) {
                                updated.sheet.postFinishedItem();
                            }
                        });
                    });
                });
            }
        });
    });

    html.querySelectorAll('[data-action="openCompanion"]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        CompanionHandler.openCompanion(sheet, ev, el);
        sheet.close(); 
      });
    });

    html.querySelectorAll('[data-action="removeCompanion"]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        CompanionHandler.removeCompanion(sheet, ev, el);
      });
    });
	
	// --- Fähigkeitenauswahl öffnen ---
    html.querySelectorAll('[data-action="openSkillSelection"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            if (!compActor) return;

                if (!compActor.isOwner) {
                    return ui.notifications.warn(game.i18n.format("SHEET.NotPetOwner", { name: compActor.name }));
                }

            new CompanionSkillSelectionApp(actor, compActor, { parentSheet: sheet }).render(true);
        });
    });

    // --- Hotbar-Items im Pet-Tab auslösen ---
    html.querySelectorAll('[data-action="executeCompanionSkill"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();

            const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            const itemId = ev.currentTarget.dataset.itemId;
            
            if (!compActor || !itemId) return;
            const item = compActor.items.get(itemId);
            if (!item) return;

            const macroCode = item.getFlag('dsa5', 'onUseEffect');
            
            if (!macroCode) return; 

            try {
                const tokenId = compActor.getActiveTokens()[0]?.id || null;
                const token = canvas.tokens.get(tokenId);
                const speaker = ChatMessage.getSpeaker({ actor: compActor, token: token });
                
                const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;
                const fn = new AsyncFunction("item", "actor", "token", "speaker", macroCode);
                
                await fn.call(item, item, compActor, token, speaker);
            } catch (err) {
                ui.notifications.error(game.i18n.format("SHEET.MacroError", {name: item.name, error: err.message}));
                console.error(err);
            }
        });
    });
	
    // --- Knochen-Icon (Ausbildungs-GUI öffnen) ---
    html.querySelectorAll('[data-action="trainCompanion"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            if (!compActor) return;
                if (!compActor.isOwner) {
                    return ui.notifications.warn(game.i18n.format("SHEET.NotPetOwner", { name: compActor.name }));
                }

            const zoologyWildName = game.i18n.localize("LocalizedIDs.zoologyWild");
            const abrichterName = game.i18n.localize("SHEET.AnimalTrainer");
            const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
            
            //  Ein Tier ist nur ein Wildtier, wenn es KEIN Vertrauter ist!
            const isFamiliar = compActor.items.some(i => i.type === 'trait' && i.name === familiarName);
            const isWild = !isFamiliar && compActor.items.some(i => i.type === 'information' && i.name === zoologyWildName);
            
            const hasAbrichter = actor.items.some(i => i.type === 'specialability' && i.name === abrichterName);

            // Prüfung 1: Wildtier ohne SF Abrichter
            if (isWild && !hasAbrichter) {
                ui.notifications.warn(game.i18n.localize("SHEET.WildAnimalTrainerWarning"));
                return;
            }

            // Öffne die neue V2 App
            new CompanionTrainingApp(actor, compActor, { parentSheet: sheet }).render(true);
        });
    });


    html.querySelectorAll('[data-action="companionRegeneration"]').forEach(el => {
      el.addEventListener('click', ev => {
        ev.preventDefault();
        ev.stopPropagation();
        CompanionHandler.handleCompanionRegeneration(sheet, ev, el);
      });
    });
	
	html.querySelectorAll('[data-action="toggleMount"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            if (!compActor) return;
            if (!compActor.isOwner) {
                return ui.notifications.warn(game.i18n.format("SHEET.NotPetOwner", { name: compActor.name }));
            }

            const isCurrentlyRiding = actor.system.horse?.actorId === compActor.id && actor.system.horse?.isRiding === 1;

            if (isCurrentlyRiding) {
                // --- ABSTEIGEN ---
                await compActor.setFlag('dsa5', 'isMountActive', false);

                if (typeof Riding !== 'undefined') {
                    await Riding.clearMount(actor);
                } else {
                    await actor.update({
                        "system.horse.isRiding": 0,
                        "system.horse.actorId": "",
                        "system.horse.actorLink": false,
                        "system.horse.token": {}
                    });
                }

            } else {
                // --- AUFSTEIGEN ---
                await compActor.setFlag('dsa5', 'isMountActive', true);

                if (typeof Riding !== 'undefined') {
                    await actor.update({
                        "system.horse.isRiding": Riding.probablyDriving(compActor),
                        "system.horse.actorId": compActor.id,
                        "system.horse.actorLink": compActor.prototypeToken?.actorLink ?? true
                    });

                    await Riding.addRidingCondition(actor);

                    const ridingName = game.i18n.localize('RIDING.riding');
                    const ridingDesc = game.i18n.localize('RIDING.ridingDescription');
                    const ridingEffect = actor.effects.find(e => e.name === ridingName || e.flags?.dsa5?.description === ridingDesc);

                    if (ridingEffect) {
                        const knownTrainings = compActor.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "training");
                        const reittierStr = game.i18n.localize("TRAINING.Reittier") || "Reittier";
                        const hasReittier = knownTrainings.some(t => t.name.includes(reittierStr));
                        
                        let effectValue = 0;
                        if (!hasReittier) effectValue = -1;
                        else if (hasReittier && knownTrainings.length >= 2) effectValue = 1;

                        if (effectValue !== 0) {
                            const newChanges = foundry.utils.duplicate(ridingEffect.changes);
                            const ridingSkillName = game.i18n.localize("LocalizedIDs.riding") || "Reiten";
                            
                            if (!newChanges.some(c => c.key === "system.skillModifiers.step" && c.value.includes(ridingSkillName))) {
                                newChanges.push({
                                    key: "system.skillModifiers.step",
                                    mode: 0,
                                    value: `${ridingSkillName} ${effectValue}`
                                });
                                await ridingEffect.update({ changes: newChanges });
                            }
                        }
                    }
                }
            }
        });
    });

	html.querySelectorAll('[data-action="toggleHotbarControl"]').forEach(el => {
		el.addEventListener('click', async ev => {
			ev.preventDefault();
			const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            
            if (!compActor) return;
            if (!compActor.isOwner) {
                return ui.notifications.warn(game.i18n.format("SHEET.NotPetOwner", { name: compActor.name }));
            }

			const newUuid = card.dataset.uuid;
			const currentUuid = actor.getFlag('dsa5', 'hotbarCompanion');
			
			if (currentUuid === newUuid) {
				await actor.unsetFlag('dsa5', 'hotbarCompanion');
			} else {
				await actor.setFlag('dsa5', 'hotbarCompanion', newUuid);
			}
		});
    });
	
    html.querySelectorAll('.companion-effect-icon').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            const effectId = ev.currentTarget.dataset.effectId;
            if (compActor && effectId) {
                if (!compActor.isOwner) {
                    return ui.notifications.warn(game.i18n.format("SHEET.NotPetOwner", { name: compActor.name }));
                };

                const effect = compActor.effects.get(effectId);
                if (effect) effect.sheet.render(true);
            }
        })

        el.addEventListener('contextmenu', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const card = ev.currentTarget.closest('.companion-header-ui');
            const compActor = await fromUuid(card.dataset.uuid);
            const effectId = ev.currentTarget.dataset.effectId;
            if (compActor && effectId) {
                const effect = compActor.effects.get(effectId);
                if (effect) effect.delete();
            }
        });
    });
	
    // --- Trick & Ausbildung abschließen (Inklusive Trick-Matrix) ---
    html.querySelectorAll('[data-action="finishTrickTraining"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const itemId = ev.currentTarget.dataset.itemId;
            const compUuid = ev.currentTarget.dataset.companionUuid;
            
            const testItem = actor.items.get(itemId);
            const compActor = await fromUuid(compUuid);
            if (!testItem || !compActor) return;
            
            const trInd = game.i18n.localize("SHEET.TrainingModuleIndicator") || "(Ausbildungsaufsatz):";
            const isTraining = testItem.name.includes("(Ausbildungsaufsatz):") || testItem.name.includes(trInd);
            
            let itemName = testItem.name;
            if (isTraining) {
                const parts = testItem.name.split(testItem.name.includes(trInd) ? trInd : "(Ausbildungsaufsatz):");
                if(parts.length > 1) itemName = parts[1].trim();
            } else {
                const parts = testItem.name.split("(Trick):");
                if(parts.length > 1) itemName = parts[1].trim();
            }

            // --- TRICK-MATRIX ---
            const tr = (key) => game.i18n.localize(`TRAINING.${key}`);
            const tk = (key) => game.i18n.localize(`TRICK.${key}`);
            
            const TRAINING_TRICKS = {
                [tr("Huetetier")]: [tk("Ablegen"), tk("Komm"), tk("Laut"), tk("Sitz"), tk("Treiben")],
                [tr("Jagdtier")]: [tk("Apport"), tk("Fass1"), tk("Laut"), tk("Still"), tk("Such")],
                [tr("Kampftier")]: [tk("Aus"), tk("Fass1"), tk("Fass2")],
                [tr("Renntier")]: [tk("Komm"), tk("Sitz")],
                [tr("Wachtier")]: [tk("Ablegen"), tk("Komm"), tk("Laut"), tk("Sitz"), tk("Wache")],
                [tr("Zirkustier")]: [tk("Kunststueck")]
            };

            const knownTricks = compActor.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "trick");
            const knownTrainings = compActor.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "training");

            const freeTricksSet = new Set();
            knownTrainings.forEach(t => {
                for (const [key, tricks] of Object.entries(TRAINING_TRICKS)) {
                    if (key && t.name.startsWith(key)) {
                        tricks.forEach(trick => { if(trick) freeTricksSet.add(trick) });
                    }
                }
            });

            // 1. Limit prüfen (NUR FÜR TRICKS!)
            if (!isTraining) {
                const klValue = compActor.system.characteristics.kl.value || 0;
                let trainingBonus = 0; 
                knownTricks.forEach(trick => {
                    if (freeTricksSet.has(trick.name)) trainingBonus++;
                });
                
                const maxTricks = Math.round(klValue / 2) + trainingBonus;
                
                // Blockieren, wenn Limit erreicht UND Trick nicht "gratis" durch Ausbildung ist
                if (knownTricks.length >= maxTricks && !freeTricksSet.has(itemName)) {
                    ui.notifications.warn(game.i18n.format("SHEET.MaxTricksReached", {name: compActor.name}));
                    return;
                }
            }

            // 2. AP und UUID aus der Flag lesen und Item laden
            const trickUuid = testItem.getFlag("dsa5", "trainingTrickUuid");
            if (!trickUuid) {
                ui.notifications.warn(game.i18n.localize("SHEET.TrickNotFound"));
                return;
            }

            const trickItem = await fromUuid(trickUuid);
            if (!trickItem) {
                ui.notifications.warn(game.i18n.localize("SHEET.TrickNotFound"));
                return;
            }

            const apCost = Number(testItem.getFlag("dsa5", "trainingApCost")) || Number(trickItem.system.APValue?.value) || 0;
            const totalAP = compActor.system.details.experience.total || 0;
            const spentAP = compActor.system.details.experience.spent || 0;
            
            if ((totalAP - spentAP) < apCost) {
                ui.notifications.warn(game.i18n.format("SHEET.NotEnoughPetAP", {name: compActor.name, cost: apCost}));
                return;
            }
            
            // 3. AP abziehen, Item hinzufügen, Sammelprobe vom Helden löschen
            await compActor.update({ "system.details.experience.spent": spentAP + apCost });
            await compActor.createEmbeddedDocuments("Item", [trickItem.toObject()]);
            await testItem.delete(); 
            
            if (isTraining) {
                ui.notifications.info(game.i18n.format("SHEET.TrainingModuleFinished", {trainingName: itemName, petName: compActor.name}));
            } else {
                ui.notifications.info(game.i18n.format("SHEET.TrainingFinished", {trickName: itemName, petName: compActor.name}));
            };

            // --- 4. Automatisches Erlernen von Tricks bei Ausbildungen ---
            if (isTraining) {
                let tricksToGrant = [];
                for (const [key, tricks] of Object.entries(TRAINING_TRICKS)) {
                    if (key && itemName.startsWith(key)) {
                        tricksToGrant = tricks;
                        break;
                    }
                }

                if (tricksToGrant.length > 0) {
                    const allTricks = await CompanionHandler.getAllTricks(); 
                    const tricksToAdd = [];
                    const addedTrickNames = [];

                    for (const tName of tricksToGrant) {
                        if (!tName) continue;
                        
                        const alreadyKnows = compActor.items.some(i => i.type === "trait" && i.system?.traitType?.value === "trick" && i.name === tName);
                        
                        if (!alreadyKnows) {
                            const tData = allTricks.find(t => t.name === tName);
                            if (tData) {
                                const trickDoc = await fromUuid(tData.uuid);
                                if (trickDoc) {
                                    tricksToAdd.push(trickDoc.toObject());
                                    addedTrickNames.push(tName);
                                }
                            }
                        }
                    }

                    if (tricksToAdd.length > 0) {
                        await compActor.createEmbeddedDocuments("Item", tricksToAdd);
                        ui.notifications.info(game.i18n.format("SHEET.AutoLearnedTricks", {name: compActor.name, tricks: addedTrickNames.join(", ")}));
                    }
                }
            }
        });
    });
	
	// --- Item-Sheet der Sammelprobe öffnen ---
    html.querySelectorAll('[data-action="editAggregatedTest"]').forEach(el => {
        el.addEventListener('click', ev => {
            ev.preventDefault();
            const itemId = ev.currentTarget.dataset.itemId;
            const item = actor.items.get(itemId); // Das Item liegt auf dem Spieler-Charakter
            if (item) item.sheet.render(true);
        });
    });

    const activeTab = sheet.tabGroups?.sheet;
    if (activeTab === "companion" || activeTab === "owner") {
      const part = html.querySelector(`[data-application-part="${activeTab}"]`);
      if (part && !part.classList.contains("active")) {
        part.classList.add("active");
      }
    }

  html.querySelectorAll('[data-action="companionSkillSelect"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation();
            
            const uuid = ev.currentTarget.dataset.actorUuid;
            const itemId = ev.currentTarget.closest('.item').dataset.itemId;
            const compActor = await fromUuid(uuid); // Das ist das Tier!
            
            if (!compActor) return;
                if (!compActor.isOwner) {
                    return ui.notifications.warn(game.i18n.format("SHEET.NotPetOwner", { name: compActor.name }));
                }
            const skillItem = compActor.items.get(itemId);
            if (!skillItem) return;

            const rollerTokenId = compActor.getActiveTokens()[0]?.id || null;
            const setupData = await compActor.setupSkill(skillItem, {}, rollerTokenId);
            const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
            const persuasionName = game.i18n.localize("SHEET.Fast-Talk");
            const isLoyaltyRoll = skillItem.name === persuasionName || skillItem.name === loyaltyName;


            compActor.basicTest(setupData).then(async (testResult) => {
                if (!isLoyaltyRoll || !testResult || !testResult.result) return; 

                const res = testResult.result;
                const desc = (res.description || "").toLowerCase();
                
                const isCrit = res.isCrit || res.successLevel >= 2 || desc.includes("kritisch") || desc.includes("spektakulär");
                const isBotch = res.isBotch || res.successLevel <= -2 || desc.includes("patzer") || desc.includes("schrecklich") || desc.includes("missgeschick");
                const isFail = res.successLevel < 0 || desc.includes("misserfolg") || desc.includes("fehlschlag") || isBotch;

                let loyaltyChanged = false;
                let newLoyalty = skillItem.system.talentValue.value;
                let chatMessages = [];

                // --- REGEL 1: Krit oder Patzer (Alle Tiere) ---
                if (isCrit || isBotch) {
                    const roll = await new Roll("1d3+1").evaluate({async: true});
                    const change = roll.total;
                    
                    if (isCrit) {
                        newLoyalty += change;
                        chatMessages.push(game.i18n.format("SHEET.LoyaltyCritGain", {name: compActor.name, change: change}));
                    } else {
                        newLoyalty = Math.max(0, newLoyalty - change);
                        chatMessages.push(game.i18n.format("SHEET.LoyaltyBotchLoss", {name: compActor.name, change: change}));
                    }
                    loyaltyChanged = true;
                }

                // --- REGEL 2: Wildtier-Reaktion bei Misserfolg ---
                const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
                const zoologyWildName = game.i18n.localize("LocalizedIDs.zoologyWild");
                
                const isFamiliar = compActor.items.some(i => i.type === 'trait' && i.name === familiarName);
                const isWild = !isFamiliar && compActor.items.some(i => i.type === 'information' && i.name === zoologyWildName);

                if (isWild && isFail) {
                    const wildRoll = await new Roll("1d6").evaluate({async: true});
                    const d6 = wildRoll.total;
                    let wildMsg = "";
                    
                    if (d6 === 1) wildMsg = game.i18n.format("SHEET.WildFail1", {name: compActor.name});
                    else if (d6 === 2) wildMsg = game.i18n.format("SHEET.WildFail2", {name: compActor.name});
                    else if (d6 >= 3 && d6 <= 5) {
                        const krRoll = await new Roll("1d6").evaluate({async: true});
                        wildMsg = game.i18n.format("SHEET.WildFail35", {name: compActor.name, kr: krRoll.total});
                    } else if (d6 === 6) {
                        const krRoll = await new Roll("1d6").evaluate({async: true});
                        wildMsg = game.i18n.format("SHEET.WildFail6", {name: compActor.name, kr: krRoll.total});
                    }
                    
                    chatMessages.push(wildMsg);
                }

                if (loyaltyChanged) {
                    await skillItem.update({ 'system.talentValue.value': newLoyalty });
                    setTimeout(() => sheet.render(false), 150);
                }

                if (chatMessages.length > 0) {
                    ChatMessage.create({
                        speaker: ChatMessage.getSpeaker({actor: compActor}),
                        content: chatMessages.join("<br><br>")
                    });
                }
            });
        });
    });
    
    html.querySelectorAll('.companion-header-ui [data-action="itemEdit"]').forEach(el => {
        el.addEventListener('click', async ev => {
            ev.preventDefault();
            ev.stopPropagation(); 
            const card = ev.currentTarget.closest('.companion-header-ui');
            const uuid = card.dataset.uuid;
            const itemId = ev.currentTarget.closest('.item').dataset.itemId;
            const compActor = await fromUuid(uuid);
            if (compActor) {
                const item = compActor.items.get(itemId);
                if (item) item.sheet.render(true);
            }
        });
    });
    
    html.querySelectorAll('[data-action="toggleCompanionDetails"]').forEach(el => {
        el.addEventListener('click', ev => {
            ev.preventDefault();
            ev.stopPropagation();
            const card = ev.currentTarget.closest('.companion-header-ui');
            const uuid = card.dataset.uuid;
            const details = card.querySelectorAll('.companion-details');
            if (details.length > 0) {
                $(details).slideToggle(200); 
                
                //  Status speichern oder löschen
                if (CompanionHandler.expandedCompanions.has(uuid)) {
                    CompanionHandler.expandedCompanions.delete(uuid);
                } else {
                    CompanionHandler.expandedCompanions.add(uuid);
                }

                ev.currentTarget.classList.toggle('fa-minimize');
                ev.currentTarget.classList.toggle('fa-maximize');
            }
        });
    });

    html.querySelectorAll('.companion-skill-advances').forEach(el => {
        el.addEventListener('change', async ev => {
            ev.preventDefault();
            const input = ev.currentTarget;
            const compActor = await fromUuid(input.dataset.actorUuid);
            if (compActor) {
                await compActor.updateEmbeddedDocuments('Item', [{
                    _id: input.dataset.itemId,
                    'system.talentValue.value': Number(input.value)
                }]);
            }
        });
    });
  }
}

// ==========================================================
//                        AUSBILDUNG
// ==========================================================
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class CompanionTrainingApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, companion, options = {}) {
        super(options);
        this.actor = actor;       
        this.companion = companion; 
        this.loyaltyUnlocked = false; 
        this.parentSheet = options.parentSheet; 
        
        this.costB = [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 6, 8, 10, 14, 18, 24, 30, 36, 44, 52, 60, 68]; 

        this.options.window.title = `${game.i18n.localize("SHEET.Training")}: ${this.companion.name}`;
    }

    static DEFAULT_OPTIONS = {
        id: "companion-training",
        classes: ["dsa5", "sheet", "companion-training"],
        window: {
            title: "SHEET.Training",
            icon: "fas fa-paw",
            resizable: true,
            controls: []
        },
        position: {
            width: 650,
            height: 620
        }
    };

    static PARTS = {
        main: { 
            template: "systems/dsa5/templates/actors/actor-companion-training.hbs" 
        }
    };

    get title() {
        return `${game.i18n.localize("SHEET.train")}: ${this.companion.name}`;
    }

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.loyaltyUnlocked = this.loyaltyUnlocked;
        context.companion = this.companion;
        
        // --- 1. Grundstatus (Vertraute, Wild, Domestiziert) ---
        const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
        context.isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
        
        const zoologyWildName = game.i18n.localize("LocalizedIDs.zoologyWild");
        const isActuallyWild = this.companion.items.some(i => i.type === 'information' && i.name === zoologyWildName);
        
        // Regel: Vertrautentiere behandeln wie domestizierte Tiere
        context.isWild = isActuallyWild && !context.isFamiliar; 
        context.buttonLabel = context.isWild ? "LocalizedIDs.zoologyWild" : "LocalizedIDs.zoologyDomesticated";
        
        const currentSpecies = this.companion.getFlag('dsa5', 'species');
        context.currentSpecies = currentSpecies;
        
        if (currentSpecies) {
            context.speciesText = game.i18n.format("SHEET.SpeciesDetected", {species: currentSpecies});
        } else {
            context.speciesText = game.i18n.localize("SHEET.SpeciesUnknown");
        }
        
        const speciesData = await CompanionHandler.getSpeciesDataWithImages();
        context.speciesData = speciesData;
        
        context.currentSpeciesImg = "icons/svg/mystery-man-black.svg";
        if (currentSpecies) {
            for (const group of Object.values(speciesData)) {
                const found = group.find(s => s.name === currentSpecies);
                if (found) { context.currentSpeciesImg = found.img; break; }
            }
        }
        
        // --- 2. Bekannte Ausbildungen und Tricks auslesen ---
        const knownTricksItems = this.companion.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "trick");
        const knownTrainingItems = this.companion.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "training");
        
        // --- 3. Trick-Limit berechnen (inkl. Matrix für Gratis-Tricks) ---
        const klValue = this.companion.system.characteristics.kl.value || 0;
        const baseTricks = Math.round(klValue / 2);
        
        const tr = (key) => game.i18n.localize(`TRAINING.${key}`);
        const tk = (key) => game.i18n.localize(`TRICK.${key}`);
        
        // Trick-Matrix
        const TRAINING_TRICKS = {
            [tr("Huetetier")]: [tk("Ablegen"), tk("Komm"), tk("Laut"), tk("Sitz"), tk("Treiben")],
            [tr("Jagdtier")]: [tk("Apport"), tk("Fass1"), tk("Laut"), tk("Still"), tk("Such")],
            [tr("Kampftier")]: [tk("Aus"), tk("Fass1"), tk("Fass2")],
            [tr("Renntier")]: [tk("Komm"), tk("Sitz")],
            [tr("Wachtier")]: [tk("Ablegen"), tk("Komm"), tk("Laut"), tk("Sitz"), tk("Wache")],
            [tr("Zirkustier")]: [tk("Kunststueck")]
        };

        // Gratis-Tricks des Tiers durch Ausbildungen?
        const freeTricksSet = new Set();
        knownTrainingItems.forEach(t => {
            for (const [key, tricks] of Object.entries(TRAINING_TRICKS)) {
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

        context.trickLimitText = game.i18n.format(
            context.isWild ? "SHEET.TrickLimitWild" : "SHEET.TrickLimitDomesticated", 
            {currentTricks: currentTrickCount, maxTricks: maxTricks}
        );

        context.knownTricks = [];
        for (let t of knownTricksItems) {
            context.knownTricks.push({
                name: t.name,
                uuid: t.uuid,
                link: await TextEditor.enrichHTML(`@UUID[${t.uuid}]`, { async: true })
            });
        }
        
        context.isMaxReached = currentTrickCount >= maxTricks;
        context.companionName = this.companion.name;
		
		const knownTrickNames = knownTricksItems.map(t => t.name);

        // --- 4. Ausbildungs-Limit prüfen ---
        let trainingCount = 0;
        const reittierName = tr("Reittier") || "Reittier";
        knownTrainingItems.forEach(t => {
            // Reittier zählt nicht gegen das Limit
            if (!t.name.includes(reittierName) && !t.name.includes("Reittier")) {
                trainingCount++;
            }
        });

        const maxTrainings = context.isFamiliar ? 2 : 1;
        context.hasReachedMaxTraining = trainingCount >= maxTrainings;
        context.petName = this.companion.name;
		
        const allTricks = await CompanionHandler.getAllTricks();
        const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
        const tricksLabel = game.i18n.localize("SHEET.Tricks");
        const noReqsLabel = game.i18n.localize("SHEET.NoRequirements");
        const reqsLabel = game.i18n.localize("SHEET.Requirements");
        
        context.reqsLabel = reqsLabel;

        context.loyaltyItem = this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
        const currentLoyalty = context.loyaltyItem ? context.loyaltyItem.system.talentValue.value : 0;
        
        // DAS OBJEKT MIT DEN VORAUSSETZUNGEN (garantiert mit korrekten Arrays)
        const TRICK_REQUIREMENTS = {
            [game.i18n.localize("TRICK.Ablegen")]: { loyalty: 10, tricks: [game.i18n.localize("TRICK.Komm"), game.i18n.localize("TRICK.Sitz")] },
            [game.i18n.localize("TRICK.Anzeigen")]: { loyalty: 6, tricks: [game.i18n.localize("TRICK.Sitz")] },
            [game.i18n.localize("TRICK.Apport")]: { loyalty: 8, tricks: [] },
            [game.i18n.localize("TRICK.Aus")]: { loyalty: 8, tricks: [game.i18n.localize("TRICK.Fass1")] },
            [game.i18n.localize("TRICK.Fass1")]: { loyalty: 4, tricks: [] },
            [game.i18n.localize("TRICK.Fass2")]: { loyalty: 8, tricks: [game.i18n.localize("TRICK.Fass1")] },
            [game.i18n.localize("TRICK.Fass3")]: { loyalty: 10, tricks: [game.i18n.localize("TRICK.Fass2")] },
            [game.i18n.localize("TRICK.Komm")]: { loyalty: 4, tricks: [] },
            [game.i18n.localize("TRICK.Kunststueck")]: { loyalty: 4, tricks: [game.i18n.localize("TRICK.Sitz")] },
            [game.i18n.localize("TRICK.Laut")]: { loyalty: 6, tricks: [] },
            [game.i18n.localize("TRICK.Platz")]: { loyalty: 8, tricks: [game.i18n.localize("TRICK.Sitz")] },
            [game.i18n.localize("TRICK.Sitz")]: { loyalty: 6, tricks: [] },
            [game.i18n.localize("TRICK.Still")]: { loyalty: 8, tricks: [] },
            [game.i18n.localize("TRICK.Such")]: { loyalty: 8, tricks: [] },
            [game.i18n.localize("TRICK.Treiben")]: { loyalty: 10, tricks: [] },
            [game.i18n.localize("TRICK.Wache")]: { loyalty: 10, tricks: [] }
        };

        const availableTricks = [];
        const unavailableTricks = [];
        const trainingItems = this.actor.items.filter(i => i.type === "aggregatedTest");

        for (let t of allTricks) {
            if (knownTrickNames.includes(t.name)) continue;

            const reqs = TRICK_REQUIREMENTS[t.name] || { loyalty: 0, tricks: [] };
            
            // FILTER: Löscht leere Strings, falls ein Sprachschlüssel fehlt
            const requiredTricks = (reqs.tricks || []).filter(trick => trick && trick.trim() !== "");
            
            let meetsLoyalty = currentLoyalty >= reqs.loyalty;
            let meetsTricks = requiredTricks.every(reqTrick => knownTrickNames.includes(reqTrick));
            
            let reqTextArray = [];
            if (reqs.loyalty > 0) reqTextArray.push(`${loyaltyName} ${reqs.loyalty}`);
            if (requiredTricks.length > 0) reqTextArray.push(`${tricksLabel}: ${requiredTricks.join(", ")}`);
            
            let reqText = reqTextArray.length > 0 ? reqTextArray.join(" | ") : noReqsLabel;
            
            // --- Prüfen, ob die Probe schon beim Helden liegt ---
            const expectedWildName = game.i18n.format("SHEET.WildAnimalTraining", {petName: this.companion.name, trickName: t.name});
            const expectedDomName = game.i18n.format("SHEET.AnimalTraining", {petName: this.companion.name, trickName: t.name});
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
        for (let t of knownTrainingItems) {
            context.knownTrainings.push({
                name: t.name,
                uuid: t.uuid,
                link: await TextEditor.enrichHTML(`@UUID[${t.uuid}]`, { async: true })
            });
        }
        // --- 2. Verfügbare Ausbildungen für dieses Tier ermitteln ---
        const allTrainings = await CompanionHandler.getAllTrainings();
        let possibleTrainingNames = [];
        
        for (const group of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
            if (group[currentSpecies]) {
                possibleTrainingNames = group[currentSpecies].trainingModules || [];
                break;
            }
        }

        context.availableTrainings = [];
        
        for (let tName of possibleTrainingNames) {
            // Sonderfall: Tragetier oder Zugtier sind im Kompendium als ein Item zusammengefasst
            let searchStr = tName;
            if (tName === "Tragetier" || tName === "Zugtier") {
                searchStr = "Trage- oder Zugtier";
            }

            const matchingTrainings = allTrainings.filter(train => train.name.startsWith(searchStr));
            
            for (let tData of matchingTrainings) {
                if (context.availableTrainings.some(t => t.uuid === tData.uuid)) continue;
                
                // Prüfen, ob das Tier diesen Aufsatz schon exakt so gelernt hat
                if (knownTrainingNames.includes(tData.name)) continue; 
                
                // Prüfen, ob die Probe schon beim Helden liegt
                const expectedName = game.i18n.format("SHEET.TrainingTestName", {petName: this.companion.name, trainingName: tData.name});
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
        context.isMountPossible = possibleTrainingNames.includes(game.i18n.localize("TRAINING.Reittier"));
        
        return context;
    }
	
	async _refreshSheets() {
        this.render({ force: true });
        
        if (this.parentSheet && this.parentSheet.rendered) {
            this.parentSheet.render({ force: true });
        }
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;
		
		const activeTab = this._activeTab || "loyalty"; // Standard ist loyalty
        html.querySelectorAll('.tabs .item').forEach(t => t.classList.remove('active'));
        html.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });
        
        const tabBtn = html.querySelector(`.tabs .item[data-tab="${activeTab}"]`);
        const content = html.querySelector(`.tab-content[data-tab="${activeTab}"]`);
        if (tabBtn) tabBtn.classList.add('active');
        if (content) {
            content.classList.add('active');
            content.style.display = 'block';
        }

        // Tabs
        html.querySelectorAll('.tabs .item').forEach(el => {
            el.addEventListener('click', this._onChangeTab.bind(this));
        });
		
		// --- Tierart Selektor umschalten & entfernen ---
        const speciesToggleBtn = html.querySelector('[data-action="toggleSpeciesSelector"]');
        if (speciesToggleBtn) {
            // Linksklick: Menü öffnen/Schließen
            speciesToggleBtn.addEventListener('click', (ev) => {
                ev.preventDefault();
                const selector = html.querySelector('#speciesSelector');
                if (selector) selector.style.display = selector.style.display === 'none' ? 'block' : 'none';
            });

            // Rechtsklick: Ausgewählte Tierart löschen
            speciesToggleBtn.addEventListener('contextmenu', async (ev) => {
                ev.preventDefault();
                await this.companion.unsetFlag('dsa5', 'species');
                
                ui.notifications.info(game.i18n.format("SHEET.SpeciesRemoved", {name: this.companion.name}));
                
                await this._refreshSheets();
            });
        }

        // ---  Neue Tierart auswählen ---
        html.querySelectorAll('[data-action="selectSpecies"]').forEach(el => {
            el.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const newSpecies = ev.currentTarget.dataset.species;
                await this.companion.setFlag('dsa5', 'species', newSpecies);
                await this._refreshSheets();
            });
        });
		
        html.querySelectorAll('[data-action="toggleTrickDetails"]').forEach(el => {
            el.addEventListener('click', ev => {
                ev.preventDefault();
                const icon = ev.currentTarget;
                const details = icon.closest('.trick-container').querySelector('.trick-details');
                
                if (details) {
                    const isHidden = details.style.display === 'none' || details.style.display === '';
                    
                    if (isHidden) {
                        details.style.display = 'block';
                        icon.classList.remove('fa-chevron-right');
                        icon.classList.add('fa-chevron-down');
                    } else {
                        details.style.display = 'none';
                        icon.classList.remove('fa-chevron-down');
                        icon.classList.add('fa-chevron-right');
                    }
                }
            });
        });
		
		// --- Sammelprobe für einen Trick auf dem Helden erstellen ---
        html.querySelectorAll('[data-action="teachTrick"]').forEach(el => {
            el.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const trickName = ev.currentTarget.dataset.trick;
                
                // Prüfen, ob Wildtier oder Vertrauter
                const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
                const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
                const zoologyWildName = game.i18n.localize("LocalizedIDs.zoologyWild");
                const isWild = !isFamiliar && this.companion.items.some(i => i.type === 'information' && i.name === zoologyWildName);
                
                // Werte für die Probe festlegen
                const itemName = isWild ? 
                    game.i18n.format("SHEET.WildAnimalTraining", {petName: this.companion.name, trickName: trickName}) : 
                    game.i18n.format("SHEET.AnimalTraining", {petName: this.companion.name, trickName: trickName});
                const interval = isWild ? game.i18n.localize("SHEET.IntervalTwoDays") : game.i18n.localize("SHEET.IntervalOneDay");
                const allowedTestCount = isWild ? 5 : 7;
                
                // Trick-Modifikator der Tierart ermitteln
                let trickMod = 0;
                const currentSpecies = this.companion.getFlag('dsa5', 'species');
                for (const group of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
                    if (group[currentSpecies]) {
                        // Ersetzt eventuelle typografische Gedankenstriche durch echte Minuszeichen
                        let modStr = String(group[currentSpecies].trickMod).replace('–', '-');
                        trickMod = parseInt(modStr) || 0;
                        break;
                    }
                }
                
                // Vertraute erhalten einen Bonus von +2
                if (isFamiliar) trickMod += 2;
                
                const zoologyTalent = game.i18n.localize("SHEET.Zoology");

                const allTricks = await CompanionHandler.getAllTricks();
                const trickData = allTricks.find(t => t.name === trickName);
                const apCost = trickData ? trickData.apCost : "?";
                const trickUuid = trickData ? trickData.uuid : "";
                // --------------------------------------------

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
                ui.notifications.info(game.i18n.format("SHEET.ItemAdded", {item: itemName, actor: this.actor.name}));
                
                this._activeTab = "tricks"; 
                this.render(true);
            });
        });
		
		// --- Sammelprobe für eine AUSBILDUNG auf dem Helden erstellen ---
        html.querySelectorAll('[data-action="teachTraining"]').forEach(el => {
            el.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const trainingName = ev.currentTarget.dataset.training;
                
                // Prüfen, ob Vertrauter
                const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
                const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
                
                // Modifikator aus der Tierart-Tabelle holen
                let trainingMod = 0;
                const currentSpecies = this.companion.getFlag('dsa5', 'species');
                for (const group of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
                    if (group[currentSpecies]) {
                        // "trainingMod" statt "trickMod" auslesen und formatieren
                        let modStr = String(group[currentSpecies].trainingMod).replace('–', '-');
                        trainingMod = parseInt(modStr) || 0;
                        break;
                    }
                }
                
                // Vertraute erhalten einen pauschalen Bonus von +2
                if (isFamiliar) trainingMod += 2;
                
                const itemName = game.i18n.format("SHEET.TrainingTestName", {petName: this.companion.name, trainingName: trainingName});
                const interval = game.i18n.localize("SHEET.IntervalOneMonth");
                const allowedTestCount = 7;
                const zoologyTalent = game.i18n.localize("SHEET.Zoology");

                // Trick-Daten für die Flags laden
                const allTrainings = await CompanionHandler.getAllTrainings();
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
                ui.notifications.info(game.i18n.format("SHEET.ItemAdded", {item: itemName, actor: this.actor.name}));
                
                this._activeTab = "training"; 
                this.render(true);
            });
        });
		
        html.querySelectorAll('[data-action="openTrick"]').forEach(el => {
            el.addEventListener('click', async (ev) => {
                ev.preventDefault();
                const uuid = ev.currentTarget.dataset.uuid;
                const item = await fromUuid(uuid);
                if (item) item.sheet.render(true);
            });
        });

        html.querySelector('[data-action="rollTierkunde"]')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const tierkundeName = game.i18n.localize("LocalizedIDs.animalLore");
            const skillItem = this.actor.items.find(i => i.type === "skill" && i.name === tierkundeName);
            
            if (!skillItem) {
                ui.notifications.warn(game.i18n.format("SHEET.MissingTalent", {talent: tierkundeName}));
                return;
            }

            //  Prüfen, ob das Pet ein Vertrautentier ist
            const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
            const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
            
            //  Zusätzliche Modifikatoren vorbereiten
            let options = {};
            if (isFamiliar) {
                options.moreModifiers = [
                    { 
                        name: familiarName,
                        value: 2,        
                        selected: true
                    }
                ];
            }
            
            // Skill-Probe 
            const setupData = await this.actor.setupSkill(skillItem, options, null);
            const testResult = await this.actor.basicTest(setupData);
            
            if (testResult && testResult.result && testResult.result.successLevel > 0) {
                this.loyaltyUnlocked = true;
                this.render({ force: true });
            }
        });

        // --- Loyalität Steigern (AP vom Helden abziehen) ---
        html.querySelector('[data-action="advanceLoyalty"]')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
            const loyaltyItem = this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
            if(!loyaltyItem) return;

            const currentFW = loyaltyItem.system.talentValue.value;
            const cost = this.costB[currentFW];
            if (cost === undefined) return;

            const currentAP = this.actor.system.details.experience.spent;
            const totalAP = this.actor.system.details.experience.total;

            if (totalAP - currentAP < cost) return;

            let scrollPos = 0;
            const tab = this.parentSheet ? this.parentSheet.element[0].querySelector('.tab[data-tab="companion"]') : null;
            if (tab) scrollPos = tab.scrollTop;

            await this.companion.updateEmbeddedDocuments("Item", [{ _id: loyaltyItem.id, "system.talentValue.value": currentFW + 1 }]);
            await this.actor.update({ "system.details.experience.spent": currentAP + cost });

            await this.render({ force: true });
            
            setTimeout(() => {
                if (this.parentSheet && this.parentSheet.rendered) {
                    const newTab = this.parentSheet.element[0].querySelector('.tab[data-tab="companion"]');
                    if (newTab) newTab.scrollTop = scrollPos; // Scrollt sanft zurück
                }
                this.bringToTop(); 
            }, 150);
        });

        html.querySelector('[data-action="refundLoyalty"]')?.addEventListener('click', async (ev) => {
            ev.preventDefault();
            const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
            const loyaltyItem = this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
            if(!loyaltyItem) return;

            const currentFW = loyaltyItem.system.talentValue.value;
            if (currentFW <= 0) return;

            const refundedCost = this.costB[currentFW - 1]; 
            const currentAP = this.actor.system.details.experience.spent;

            let scrollPos = 0;
            const tab = this.parentSheet ? this.parentSheet.element[0].querySelector('.tab[data-tab="companion"]') : null;
            if (tab) scrollPos = tab.scrollTop;

            await this.companion.updateEmbeddedDocuments("Item", [{ _id: loyaltyItem.id, "system.talentValue.value": currentFW - 1 }]);
            
            await this.actor.update({ "system.details.experience.spent": Math.max(0, currentAP - refundedCost) });

            await this.render({ force: true });
            
            setTimeout(() => {
                if (this.parentSheet && this.parentSheet.rendered) {
                    const newTab = this.parentSheet.element[0].querySelector('.tab[data-tab="companion"]');
                    if (newTab) newTab.scrollTop = scrollPos;
                }
                this.bringToTop();
            }, 150);
        });
    }

    _onChangeTab(event) {
        event.preventDefault();
        const tabName = event.currentTarget.dataset.tab;
        
        if (tabName === "tricks") {
            const currentSpecies = this.companion.getFlag('dsa5', 'species');
            let isNotPossible = false;
            
            for (const speciesDict of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
                if (speciesDict[currentSpecies]?.trickMod === "*") {
                    isNotPossible = true;
                    break;
                }
            }
            if (isNotPossible) {
                ui.notifications.warn(game.i18n.localize("SHEET.TrickNotPossible"));
                return;
            }
        }

        if (tabName === "training") {
            const abrichterName = game.i18n.localize("SHEET.AnimalTrainer");
            const hasAbrichter = this.actor.items.some(i => i.type === 'specialability' && i.name === abrichterName);
            
            if (!hasAbrichter) {
                ui.notifications.warn(game.i18n.localize("SHEET.AnimalTrainingWarning"));
                return;
            }

            // Prüfung auf Wildtier und Loyalität >= 10
            const zoologyWildName = game.i18n.localize("LocalizedIDs.zoologyWild");
            const familiarName = game.i18n.localize("SHEET.FamiliarTrait");
            
            const isFamiliar = this.companion.items.some(i => i.type === 'trait' && i.name === familiarName);
            const isWild = !isFamiliar && this.companion.items.some(i => i.type === 'information' && i.name === zoologyWildName);

            if (isWild) {
                const loyaltyName = game.i18n.localize("LocalizedIDs.loyalty");
                const loyaltyItem = this.companion.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
                const loyaltyValue = loyaltyItem ? loyaltyItem.system.talentValue.value : 0;

                if (loyaltyValue < 10) {
                    ui.notifications.warn(game.i18n.localize("SHEET.WildAnimalLoyaltyWarning"));
                    return;
                }
            }
        }

        const html = this.element;
        
        html.querySelectorAll('.tabs .item').forEach(t => t.classList.remove('active'));
        event.currentTarget.classList.add('active');

        html.querySelectorAll('.tab-content').forEach(c => {
            c.classList.remove('active');
            c.style.display = 'none';
        });
        
        const activeContent = html.querySelector(`.tab-content[data-tab="${tabName}"]`);
        if (activeContent) {
            activeContent.classList.add('active');
            activeContent.style.display = 'block';
        }
		this._activeTab = tabName;
    }
}


// ==========================================================
//          HOTBAR-INTEGRATION FÜR DAS PET 
// ==========================================================

Hooks.on("renderDSA5Hotbar", async (app, html, data) => {
    let currentActor = app.actor;
    if (!currentActor) return;

    let mainActor = currentActor;
    let petActor = null;
    let isControllingPet = false;

    // 1. Prüfen: Ist der Held ausgewählt oder das Pet?
    let petUuid = mainActor.getFlag('dsa5', 'hotbarCompanion');
    
    if (petUuid) {
        petActor = await fromUuid(petUuid);
    } else {
        let ownerChar = game.user.character;
        if (!ownerChar) {
            const owners = currentActor.getFlag('dsa5', 'owners') || [];
            if (owners.length > 0) ownerChar = await fromUuid(owners[0]);
        }

        if (ownerChar) {
            const ownerPetUuid = ownerChar.getFlag('dsa5', 'hotbarCompanion');
            if (ownerPetUuid === currentActor.uuid) {
                isControllingPet = true;
                petActor = currentActor;
                mainActor = ownerChar;
            }
        }
    }

    if (!petActor || !mainActor) return;

    // 2. Status auf der Map prüfen
    const petTokens = petActor.getActiveTokens();
    const petIsActiveOnScene = petTokens.length > 0;

    // 3. Dynamische Werte für das Icon setzen
    let iconImg, tooltipText, statusIconHtml;

    if (isControllingPet) {
        iconImg = mainActor.img;
        tooltipText = game.i18n.format("SHEET.ControlActor", {name: mainActor.name});
        statusIconHtml = '<i class="fa-solid fa-arrows-to-eye"></i>'; 
    } else {
        iconImg = petActor.img;
        tooltipText = petIsActiveOnScene ? game.i18n.format("SHEET.ControlActor", {name: petActor.name}) : game.i18n.format("SHEET.SummonActor", {name: petActor.name});
        statusIconHtml = petIsActiveOnScene ? '<i class="fa-solid fa-arrows-to-eye"></i>' : '<i class="fa-solid fa-bell"></i>';
    }

    // 4. HTML zusammenbauen und einfügen
            const petHtml = `
            <div id="hotbar-pet-icon" class="weapon companion-hotbar-icon" data-uuid="${petActor.uuid}" data-pet-name="${petActor.name}" data-is-controlling-pet="${isControllingPet}" data-tooltip="${tooltipText}">
                <div class="companion-hotbar-wrapper">
                    <img src="${iconImg}" class="companion-hotbar-image">
                    <div class="status-icon companion-hotbar-status">
                        ${statusIconHtml}
                    </div>
                </div>
            </div>`;

    // 5. In das DOM injizieren
    const element = html.length ? html[0] : html; 
    const container = element.querySelector('.hotbar-avatar-container');
    
    if (container) {
        const existing = container.querySelector('#hotbar-pet-icon');
        if (existing) existing.remove();
        
        container.insertAdjacentHTML('beforeend', petHtml);

        // 6. Klick- und Hover-Logik
        const newIcon = container.querySelector('#hotbar-pet-icon');
        if (newIcon) {
            const statusOverlay = newIcon.querySelector('.status-icon');
            newIcon.addEventListener('mouseenter', () => { if (statusOverlay) statusOverlay.style.opacity = '1'; });
            newIcon.addEventListener('mouseleave', () => { if (statusOverlay) statusOverlay.style.opacity = '0'; });

            newIcon.addEventListener('click', async (ev) => {
                ev.preventDefault();
                
                if (newIcon.dataset.isSpawning === "true") return;
                const currentMainTokens = mainActor.getActiveTokens();
                const currentPetTokens = petActor.getActiveTokens();
                const isPetCurrentlyOnScene = currentPetTokens.length > 0;
                
                if (isControllingPet) {
                    // Zurück zum Helden wechseln
                    if (currentMainTokens.length > 0) {
                        currentMainTokens[0].control({releaseOthers: true});
                        canvas.animatePan({x: currentMainTokens[0].x, y: currentMainTokens[0].y});
                    } else {
                        mainActor.sheet.render(true, { focus: true });
                    }
                } else {
                    // Zum Pet wechseln ODER BESCHWÖREN
                    if (isPetCurrentlyOnScene) {
                        // Pet ist da -> Auswählen und hinspringen
                        currentPetTokens[0].control({releaseOthers: true});
                        canvas.animatePan({x: currentPetTokens[0].x, y: currentPetTokens[0].y});
                    } else {
                        // Pet ist NICHT da -> Beschwören (Spawnen)
                        if (currentMainTokens.length === 0) return;

                        // Button kurzzeitig sperren
                        newIcon.dataset.isSpawning = "true";

                        // Versetzt neben dem Spieler spawnen (1 Grid-Feld weiter rechts)
                        const spawnX = currentMainTokens[0].x + (canvas.grid?.size || 50);
                        const spawnY = currentMainTokens[0].y;

                        // Token-Daten aus dem Actor generieren
                        const tokenData = await petActor.getTokenDocument({
                            x: spawnX,
                            y: spawnY
                        });

                        // Token auf der aktuellen Szene erstellen
                        await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
                        ui.notifications.info(game.i18n.format("SHEET.ActorSummoned", {name: petActor.name}));
                        
                        // Sperre wieder aufheben
                        newIcon.dataset.isSpawning = "false";
                    }
                }
            });
        }
    }
});



const checkPetSceneStatus = async () => {
    const petIcon = document.querySelector('#hotbar-pet-icon');
    if (!petIcon) return; 

    if (petIcon.dataset.isControllingPet === "true") return;

    const petUuid = petIcon.dataset.uuid;
    const petName = petIcon.dataset.petName;
    if (!petUuid) return;

    const petActor = await fromUuid(petUuid);
    if (!petActor) return;

    const petIsActiveOnScene = petActor.getActiveTokens().length > 0;

    const statusIcon = petIcon.querySelector('.status-icon');
    if (statusIcon) {
        statusIcon.innerHTML = petIsActiveOnScene ? '<i class="fa-solid fa-arrows-to-eye"></i>' : '<i class="fa-solid fa-bell"></i>';
    }
    
    petIcon.setAttribute('data-tooltip', petIsActiveOnScene ? `${petName} steuern` : `${petName} rufen!`);
};

Hooks.on("createToken", (tokenDoc) => {
    const petIcon = document.querySelector('#hotbar-pet-icon');
    if (petIcon && tokenDoc.actor && petIcon.dataset.uuid === tokenDoc.actor.uuid) {
        checkPetSceneStatus();
    }
});

Hooks.on("deleteToken", (tokenDoc) => {
    const petIcon = document.querySelector('#hotbar-pet-icon');
    if (petIcon && tokenDoc.actor && petIcon.dataset.uuid === tokenDoc.actor.uuid) {
        checkPetSceneStatus();
    }
});

Hooks.on("canvasReady", () => {
    checkPetSceneStatus();
});



export class CompanionSkillSelectionApp extends HandlebarsApplicationMixin(ApplicationV2) {
    constructor(actor, companion, options = {}) {
        super(options);
        this.actor = actor;       
        this.companion = companion; 
        this.parentSheet = options.parentSheet; 
        this.options.window.title = `${game.i18n.localize("SHEET.SkillSelection")}: ${this.companion.name}`;
    }

    static DEFAULT_OPTIONS = {
        id: "companion-skill-selection",
        classes: ["dsa5", "sheet"],
        window: {
            title: "SHEET.SkillSelection",
            resizable: true,
        },
        position: { width: 450, height: 650 }
    };

    static PARTS = {
        main: { 
            template: "systems/dsa5/templates/actors/companion-skill-selection.hbs" 
        }
    };

    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.introText = game.i18n.format("SHEET.SkillSelectionIntro", { name: this.companion.name });

        // 1. Fähigkeiten auslesen & filtern
        const familiar = this.companion.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "familiar");
        const homunculus = this.companion.items.filter(i => i.type === "specialability" && i.system?.category?.value === "homunculus");
        const tricks = this.companion.items.filter(i => i.type === "trait" && i.system?.traitType?.value === "trick");
        const animalAbilities = this.companion.items.filter(i => i.type === "specialability" && i.system?.category?.value === "animal");

        context.categories = [
            { label: game.i18n.localize("SHEET.FamiliarAbilities"), items: familiar },
            { label: game.i18n.localize("SHEET.HomunculusAbilities"), items: homunculus },
            { label: game.i18n.localize("SHEET.Tricks"), items: tricks },
            { label: game.i18n.localize("SHEET.AnimalSpecialAbilities"), items: animalAbilities }
        ];

        // 2. Gespeicherte Hotbar laden
        const savedHotbar = this.companion.getFlag('dsa5', 'skillHotbar') || Array(14).fill(null);
        context.hotbar = savedHotbar.map((itemId, idx) => {
            return {
                index: idx,
                item: itemId ? this.companion.items.get(itemId) : null
            };
        });

        context.slice = (arr, start, end) => arr.slice(start, end);

        return context;
    }

    _onRender(context, options) {
        super._onRender(context, options);
        const html = this.element;

        // DRAG: Start
        html.querySelectorAll('.skill-drag').forEach(el => {
            el.addEventListener('dragstart', ev => {
                ev.dataTransfer.setData('text/plain', JSON.stringify({ id: ev.currentTarget.dataset.itemId }));
            });
        });

        // DROP: In die Hotbar
        html.querySelectorAll('.hotbar-slot').forEach(el => {
            el.addEventListener('dragover', ev => ev.preventDefault());
            el.addEventListener('drop', async ev => {
                ev.preventDefault();
                const data = JSON.parse(ev.dataTransfer.getData('text/plain'));
                const index = parseInt(ev.currentTarget.dataset.index);
                
                let hotbar = this.companion.getFlag('dsa5', 'skillHotbar') || Array(14).fill(null);
                hotbar[index] = data.id; 
                
                await this.companion.setFlag('dsa5', 'skillHotbar', hotbar);
                this.render(true); // GUI updaten
                if (this.parentSheet) this.parentSheet.render(false); // Bogen updaten
            });

            // RECHTSKLICK: Entfernen
            el.addEventListener('contextmenu', async ev => {
                ev.preventDefault();
                const index = parseInt(ev.currentTarget.dataset.index);
                let hotbar = this.companion.getFlag('dsa5', 'skillHotbar') || Array(14).fill(null);
                if (hotbar[index]) {
                    hotbar[index] = null;
                    await this.companion.setFlag('dsa5', 'skillHotbar', hotbar);
                    this.render(true);
                    if (this.parentSheet) this.parentSheet.render(false);
                }
            });
        });

        // LINKSKLICK: Item öffnen
        html.querySelectorAll('[data-action="openItemSheet"]').forEach(el => {
            el.addEventListener('click', async ev => {
                ev.preventDefault();
                const itemId = ev.currentTarget.dataset.itemId;
                const item = this.companion.items.get(itemId);
                if (item) item.sheet.render(true);
            });
        });
    }
}

