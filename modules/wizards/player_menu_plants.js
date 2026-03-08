import { PlayerMenuSubApp } from './player_menu_subapps.js';
import { PLANT_SHELF_LIFE_MAP, SPECIFIC_PLANT_METHODS } from '../item/plant-config.js';
import PlantPreservationDialog from '../item/plant-preservation-dialog.js';

const { duplicate, mergeObject } = foundry.utils;

function getBaseClass() {
    return (typeof game !== "undefined" && game.dsa5?.apps?.PlayerMenuSubApp) 
        ? game.dsa5.apps.PlayerMenuSubApp 
        : Object;
}

export default class PlantHelper extends getBaseClass() {
    static baseData = { item: null };

    constructor(parent) {
        super(parent);
        this.productionData = duplicate(this.constructor.baseData);
        this._activeTab = "work";

        this._updateHookId = Hooks.on("updateItem", (item, changes) => {
            if (this.activePlant && item.id === this.activePlant._id && this.parent?.rendered) {
                
                this.activePlant = item.toObject();
                
                this.parent.render(false, { focus: false });

                setTimeout(() => {
                    for (const app of Object.values(ui.windows)) {
                        if (app.constructor.name === "PlantPreservationDialog") {
                            app.bringToTop();
                        }
                    }
                }, 50);
            }
        });

        this._deleteHookId = Hooks.on("deleteItem", (item, options, userId) => {
            if (this.activePlant && item.id === this.activePlant._id && this.parent?.rendered) {
                const nextStack = this.actor?.items.find(i => i.type === "plant" && i.name === this.activePlant.name && i.id !== item.id);
                this.activePlant = nextStack ? nextStack.toObject() : null;
                this.parent.render({ parts: [this.tabName] });
            }
        });
    }

    destroy() {
        if (this._updateHookId) Hooks.off("updateItem", this._updateHookId);
        if (this._deleteHookId) Hooks.off("deleteItem", this._deleteHookId);
    }

    get tabName() { return "PlantHelper"; }
    get name() { return "PLANT.processPlants"; }
    get icon() { return "fas fa-leaf"; }
    get actor() { return this.parent?.actor || game.user.character; }

    get activePlant() { return this.productionData.item; }
    set activePlant(item) { this.productionData.item = item; }

    static template = "systems/dsa5/templates/items/item-plant-work-gui.hbs";

    addTab(tabs, activeTab, group) { return; }


    async setupPlant(item, forceTabSwitch = true) {
        this.productionData = duplicate(this.constructor.baseData);
        this.activePlant = item.toObject ? item.toObject() : item;

        if (this.parent) {

            if (forceTabSwitch) {
                this.parent.tabGroups['sheet'] = this.tabName;
            }
            await this.parent.render(true);
        }
    }

    async _onDrop(data) {
        if (this.parent && this.parent.tabGroups?.['sheet'] !== this.tabName) {
            return false;
        }

        if (data.documentName === "Item" && data.type === "plant") {
            const droppedItem = await fromUuid(data.uuid);
            if (droppedItem) {

                await this.setupPlant(droppedItem, false);
                return true;
            }
        }
        return false;
    }

    async _getData(data) {
        const actor = this.actor;
        if (!actor) return { noActor: true };

        const context = { actor, createdItem: { productionData: this.productionData }, activeTab: this._activeTab };

        if (!this.activePlant) { return mergeObject(context, { noPlant: true }); }

        const plantData = this.activePlant;
        
        const samePlants = actor.items.filter(i => i.type === "plant" && i.name === plantData.name);
        const totalPlantQuantity = samePlants.reduce((acc, curr) => acc + (Number(curr.system.quantity?.value) || 0), 0);

        if (totalPlantQuantity <= 0) {
            this.activePlant = null;
            return mergeObject(context, { noPlant: true });
        }

        const unitToDays = { 'seconds': 1/86400, 'minutes': 1/1440, 'hours': 1/24, 'days': 1, 'weeks': 7, 'months': 30, 'years': 365 };
        const rawTimeValues = { "12h": 0.5, "24h": 1, "3d": 3, "1w": 7, "8w": 56, "1m": 30, "2m": 60, "3m": 90, "6m": 180, "8m": 240, "9m": 270, "10m": 300, "12m": 360, "120m": 3650, "840m": 25550, "45y": 16425, "years": 7300, "033h": 0.0333333 / 24, "22h": 22 / 24, "003h": 0.00333333 / 24, "222y": 222 * 365, "22d": 22 };

        const systemData = plantData.system || {};
        const mainPart = systemData.mainIngredient || "leaves";
        const mainStandardRawDays = rawTimeValues[PLANT_SHELF_LIFE_MAP[mainPart]?.raw] || 0.5;
        const manualVal = systemData.mundane?.shelfLife?.value;
        const currentUnit = systemData.processed?.shelfLife?.unit || systemData.shelfLife?.unit || "days";
        let harvestFactor = manualVal ? (manualVal * (unitToDays[currentUnit] || 1)) / mainStandardRawDays : 1.0;

        const methodMap = new Map();
        const checkedParts = Object.keys(systemData.plantPart || {}).filter(k => systemData.plantPart[k]);

        if (plantData.name === game.i18n.localize("PLANT.rush_cucumber")) {
            if (!checkedParts.includes("rush_cucumber")) checkedParts.push("rush_cucumber");
        }

        for (const p of checkedParts) {
            const pData = PLANT_SHELF_LIFE_MAP[p];
            if (pData?.methods) pData.methods.forEach(m => methodMap.set(m.m, { ...m, isSpec: false }));
        }

        const specificKey = Object.keys(SPECIFIC_PLANT_METHODS).find(k => game.i18n.localize(`PLANT.specificPlants.${k}`) === plantData.name);
        if (specificKey) SPECIFIC_PLANT_METHODS[specificKey].forEach(m => methodMap.set(m.m + "_spec", { ...m, isSpec: true }));

        const peraineSkill = actor.items.find(i => i.name === game.i18n.localize("PLANT.skillPlantPreservation"));
        const hasPreserveSkill = actor.items.some(i => i.name === game.i18n.localize("PLANT.skillPreservePlant"));
        const bonusFactor = 1.0 + (hasPreserveSkill ? 0.5 : 0) + (peraineSkill ? 0.5 : 0);

        const storedMethods = systemData.preservationDetails?.methods || {};
		

        const mappedMethods = await Promise.all(Array.from(methodMap.values()).map(async m => {
            const unitToDaysLocal = { 'seconds': 1/86400, 'minutes': 1/1440, 'hours': 1/24, 'days': 1, 'weeks': 7, 'months': 30, 'years': 365 };
            let displayLabel = "";
            let finalVal = 0;
            let finalUnit = "days";

            if (m.formula) {
                const minRoll = await new Roll(m.formula).evaluate({minimize: true});
                const maxRoll = await new Roll(m.formula).evaluate({maximize: true});
                
                const formulaMultiplier = unitToDaysLocal[m.unit] || 1; 
                const minDays = minRoll.total * formulaMultiplier * harvestFactor * bonusFactor;
                const maxDays = maxRoll.total * formulaMultiplier * harvestFactor * bonusFactor;
                
                let maxVal, maxUnit;
                if (maxDays < 1/1440) { maxVal = Math.round(maxDays * 86400); maxUnit = "seconds"; } 
                else if (maxDays < 1/24) { maxVal = Math.round(maxDays * 1440); maxUnit = "minutes"; } 
                else if (maxDays < 1) { maxVal = Math.round(maxDays * 24); maxUnit = "hours"; } 
                else if (maxDays >= 365) { maxVal = Math.round((maxDays / 365) * 10) / 10; maxUnit = "years"; } 
                else if (maxDays >= 30) { maxVal = Math.round((maxDays / 30) * 10) / 10; maxUnit = "months"; } 
                else if (maxDays >= 7) { maxVal = Math.round((maxDays / 7) * 10) / 10; maxUnit = "weeks"; } 
                else { maxVal = Math.round(maxDays * 10) / 10; maxUnit = "days"; }

                const minValInMaxUnit = minDays / (unitToDaysLocal[maxUnit] || 1);
                const minVal = Math.round(minValInMaxUnit * 10) / 10;
                
                if (minVal === maxVal) {
                    displayLabel = `${maxVal} ${game.i18n.localize(`PLANT.shelfLifeUnits.${maxUnit}${maxVal===1?'Single':'Plural'}`)}`;
                } else {
                    const localizedUnit = game.i18n.localize(`PLANT.shelfLifeUnits.${maxUnit}${maxVal===1?'Single':'Plural'}`);
                    displayLabel = game.i18n.format("PLANT.rangeBetween", { min: minVal, max: maxVal, unit: localizedUnit });
                }
                
                finalVal = maxVal; 
                finalUnit = maxUnit;
            } else {
                const targetDays = rawTimeValues[m.v] || 1;
                const total = targetDays * harvestFactor * bonusFactor;
                
                if (total < 1/1440) { finalVal = Math.round(total * 86400); finalUnit = "seconds"; } 
                else if (total < 1/24) { finalVal = Math.round(total * 1440); finalUnit = "minutes"; } 
                else if (total < 1) { finalVal = Math.round(total * 24); finalUnit = "hours"; } 
                else if (total >= 365) { finalVal = Math.round((total / 365) * 10) / 10; finalUnit = "years"; } 
                else if (total >= 30) { finalVal = Math.round((total / 30) * 10) / 10; finalUnit = "months"; } 
                else if (total >= 7) { finalVal = Math.round((total / 7) * 10) / 10; finalUnit = "weeks"; } 
                else { finalVal = Math.round(total * 10) / 10; finalUnit = "days"; }

                displayLabel = `${finalVal} ${game.i18n.localize(`PLANT.shelfLifeUnits.${finalUnit}${finalVal===1?'Single':'Plural'}`)}`;
            }

            const mDetails = storedMethods[m.m] || {};
            return { 
                label: game.i18n.localize(`PLANT.methods.${m.m}`), 
                numericValue: finalVal, 
                unit: finalUnit, 
                m: m.m + (m.isSpec ? "_spec" : ""), 
                displayLabel: displayLabel,
                linkedUuid: (mDetails.alternativeEffects || []).map(p => p.name).join(','), 
                extraUuids: (mDetails.extraProducts || []).map(p => p.name).join(','),
                altUuids: (mDetails.alternativeEffects || []).map(p => p.name).join(',')
            };
        }));

        const calculatedContext = {
            totalPlantQuantity,
            activeItem: { img: plantData.img, name: plantData.name },
            document: plantData,
            poisonRecipes: systemData.poisonRecipes || [],
            drugRecipes: systemData.drugRecipes || [],
            auxiliaryRecipes: systemData.auxiliaryRecipes || [],
            supernaturalMethods: this._getSupernaturalMethods(actor),
            isAlreadyPreservedProfane: systemData.plantState === "Haltbargemacht",
			isAlreadyPreservedSupernatural: Number(systemData.supernatural?.factor ?? 1) > 1,
            bonusFactorText: `+${Math.round((bonusFactor - 1) * 100)}%`,
            hasPreserveSkill,
            hasPeraineSkill: !!peraineSkill,
            peraineSkillImg: peraineSkill?.img || "",
            shelfLifeDetailText: game.i18n.format("PLANT.shelfLifeInfo", { 
                plant: plantData.name, 
                part: game.i18n.localize(`PLANT.${mainPart}`), 
                time: manualVal ? `${manualVal} ${game.i18n.localize(`PLANT.shelfLifeUnits.${currentUnit}${manualVal === 1 ? 'Single' : 'Plural'}`)}` : game.i18n.localize(`PLANT.times.${PLANT_SHELF_LIFE_MAP[mainPart]?.raw}`) 
            }),
            preservationMethods: mappedMethods
        };

        return mergeObject(context, calculatedContext);
    }

    _getSupernaturalMethods(actor) {
        const supernaturalMethods = [];
        
        // --- Dynamische Bestimmung des Schamanen-Icons ---
        let shamanIcon = "systems/dsa5/icons/traditionen/scharlatane.webp"; // Standard-Fallback !!!!!BILDER SIND PLATZHALTER!!!!
        
        // Liste der möglichen Traditionen als Sprachschlüssel ---- !!!!!BILDER SIND PLATZHALTER!!!! ----
        const shamanTraditions = {
            "PLANT.traditions.ferkinaschamanen": "systems/dsa5/icons/traditionen/geoden.webp",
            "PLANT.traditions.fjarningerschamanen": "systems/dsa5/icons/traditionen/scharlatane.webp",
            "PLANT.traditions.gjalskerschamanen": "systems/dsa5/icons/traditionen/scharlatane.webp",
            "PLANT.traditions.nivesenschamanen": "systems/dsa5/icons/traditionen/scharlatane.webp",
            "PLANT.traditions.tahayaschamanen": "systems/dsa5/icons/traditionen/scharlatane.webp",
            "PLANT.traditions.trollzackerschamanen": "systems/dsa5/icons/traditionen/scharlatane.webp",
            "PLANT.traditions.achazschamanen": "systems/dsa5/icons/traditionen/scharlatane.webp",
            "PLANT.traditions.tairachkult": "systems/dsa5/icons/traditionen/scharlatane.webp"
        };

        for (const [traditionKey, iconPath] of Object.entries(shamanTraditions)) {
            const locTraditionName = game.i18n.localize(traditionKey);
            
            if (actor.items.find(i => i.name === locTraditionName)) {
                shamanIcon = iconPath;
                break; 
            }
        }

        const checkList = [
            { nameKey: "PLANT.supernatural.sumusElixiere", traditionKey: "PLANT.supernatural.druiden", icon: "systems/dsa5/icons/traditionen/druiden.webp", isSchale: false }, 
            { nameKey: "PLANT.supernatural.liedDerPflanzen", traditionKey: "PLANT.supernatural.elfen", icon: "systems/dsa5/icons/traditionen/elfen.webp", isSchale: false }, 
            { nameKey: "PLANT.supernatural.wachskonservierung", traditionKey: "PLANT.supernatural.zibilja", icon: "systems/dsa5/icons/traditionen/zibiljas.webp", isSchale: false }, 
            { nameKey: "PLANT.supernatural.pflanzenkraft", traditionKey: "PLANT.supernatural.schamanen", icon: shamanIcon, isSchale: false }, 
            { nameKey: "PLANT.supernatural.konservierendeSchale", traditionKey: "PLANT.supernatural.zauberalchimist", icon: "systems/dsa5/icons/traditionen/zauberalchimisten.webp", isSchale: true }
        ];

        for (const entry of checkList) {
            const locName = game.i18n.localize(entry.nameKey);
            const locTradition = game.i18n.localize(entry.traditionKey);
            
            const item = actor.items.find(i => i.name === locName);
            
            if (item) {
                const testParts = [];
                for (let i = 1; i <= 3; i++) {
                    const char = item.system[`characteristic${i}`]?.value;
                    if (char) testParts.push({ label: char.toUpperCase(), class: `diet-${char.toLowerCase()}` });
                }

                supernaturalMethods.push({
                    name: item.name, 
                    img: item.img, 
                    id: item.id, 
                    uuid: item.uuid, 
                    tradition: locTradition,
                    traditionIcon: entry.icon,
                    testParts,
                    isSpell: ["spell", "ritual", "liturgy", "ceremony"].includes(item.type),
                    isSpecialAction: entry.isSchale, 
                    fw: item.system.talentValue?.value ?? (item.system.step?.value ?? "—"),
                    cost: entry.isSchale ? (item.system.AsPCost?.value ?? item.system.AsPCost ?? "—") : (item.system.AsPCost?.value || item.system.KaPCost?.value || "—"),
                    duration: item.system.castingTime?.value || item.system.duration?.value || "—"
                });
            }
        }
        return supernaturalMethods;
    }

    async _onRender(html) {
        const globalTooltip = document.getElementById('tooltip');
        if (globalTooltip) {
            globalTooltip.removeAttribute('style');
            globalTooltip.classList.remove('plant-dual-tooltip');
        }

        const root = $(html).find('.plant-work-gui-root').length ? $(html).find('.plant-work-gui-root') : $(html);
        
        root.find('.plant-processing-drop-zone.has-item').on('contextmenu', (ev) => {
            ev.preventDefault();
            this.activePlant = null;
            if (this.parent) {
                this.parent.activePlantItem = null; 
                this.parent.render(true); 
            }
        });

        new foundry.applications.ux.Tabs({
            navSelector: ".sheet-tabs[data-group='main']",
            contentSelector: ".content",
            initial: this._activeTab,
            callback: (event, tabs, tab) => { this._activeTab = tab; }
        }).bind(root[0]);

        this._bindTooltips(root[0]);
    }

    _bindTooltips(root) {
        const containers = root.querySelectorAll('.name-icon');
        
        containers.forEach(container => {
            const trigger = container.querySelector('.preservation-tooltip-trigger') || container.querySelector('.dsa5-tooltip-trigger');
            if (!trigger) return;
            trigger.removeAttribute('data-tooltip'); 
            container.style.cursor = "help";

            container.addEventListener('mouseenter', async (ev) => {
                const altDataAttr = trigger.dataset.altUuids || trigger.dataset.altNames || trigger.dataset.uuid || trigger.dataset.linkedUuid; 
                const extraDataAttr = trigger.dataset.extraUuids || trigger.dataset.extraNames;

                const findItemFlexible = async (query) => {
                    if (!query || query === "null" || query.trim() === "") return null;
                    const cleanQuery = query.trim();
                    
                    if (cleanQuery.includes('.')) {
                        try {
                            const item = await fromUuid(cleanQuery);
                            if (item) return item;
                        } catch (e) { }
                    }
                    
                    if (typeof this._findItemByName === 'function') {
                        const item = await this._findItemByName(cleanQuery);
                        if (item) return item;
                    }
                    
                    let localItem = game.items.find(i => i.name === cleanQuery);
                    if (localItem) return localItem;
                    
                    for (let pack of game.packs) {
                        if (pack.documentName === "Item") {
                            const match = pack.index.find(i => i.name === cleanQuery);
                            if (match) return await pack.getDocument(match._id);
                        }
                    }
                    return null;
                };

                const getBox = async (query, headerKey) => {
                    const item = await findItemFlexible(query);
                    if (!item) return "";
                    
                    let desc = item.system.description?.value || "";
                    if (foundry.applications?.ux?.TextEditor?.implementation?.enrichHTML) {
                        desc = await foundry.applications.ux.TextEditor.implementation.enrichHTML(desc, { async: true, secrets: false, relativeTo: item });
                    } else {
                        desc = await TextEditor.enrichHTML(desc, { async: true, secrets: false, relativeTo: item });
                    }
                    
                    return `<div class="itemTooltip" style="flex: 0 0 280px; background: #f4e6d7 !important; border: 1px solid #7a7971 !important; border-radius: 3px; padding: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.6); color: #532902 !important; margin: 0; display: flex !important; flex-direction: column; max-height: 80vh !important;"><div class="tooltip-header" style="font-size: 0.85em; font-weight: bold; border-bottom: 1px solid #7a7971; margin-bottom: 8px; padding-bottom: 4px; color: #532902; text-transform: uppercase; flex: 0 0 auto;">${game.i18n.localize("PLANT." + headerKey)}</div><h1 style="color: #532902 !important; font-size: 1.25em; margin: 0 0 8px 0; border: none; font-weight: bold; flex: 0 0 auto; font-family: inherit;">${item.name}</h1><div class="description" style="font-size: 0.95em; line-height: 1.4; color: #532902 !important; overflow-y: auto; scrollbar-width: thin;">${desc}</div></div>`;
                };

                let combinedHtml = "";
                
                if (altDataAttr) {
                    const queries = altDataAttr.split(',').filter(q => q.trim());
                    for (const q of queries) { combinedHtml += await getBox(q, "altEffectsTab"); }
                }
                
                if (extraDataAttr) {
                    const queries = extraDataAttr.split(',').filter(q => q.trim());
                    for (const q of queries) { combinedHtml += await getBox(q, "extraProductSingular"); }
                }

                if (!combinedHtml && trigger.dataset.name) {
                    const itemName = trigger.dataset.name; 
                    const item = await findItemFlexible(itemName);
                    if (item) {
                        let desc = item.system.description?.value || "";
                        if (foundry.applications?.ux?.TextEditor?.implementation?.enrichHTML) {
                            desc = await foundry.applications.ux.TextEditor.implementation.enrichHTML(desc, { async: true, secrets: false, relativeTo: item });
                        } else {
                            desc = await TextEditor.enrichHTML(desc, { async: true, secrets: false, relativeTo: item });
                        }
                        combinedHtml = `<div class="itemTooltip" style="flex: 0 0 280px; background: #f4e6d7 !important; border: 1px solid #7a7971 !important; border-radius: 3px; padding: 12px; box-shadow: 0 4px 15px rgba(0,0,0,0.6); color: #532902 !important; margin: 0; display: flex !important; flex-direction: column; max-height: 80vh !important;"><h1 style="color: #532902 !important; font-size: 1.25em; margin: 0 0 8px 0; border: none; font-weight: bold; flex: 0 0 auto; font-family: inherit;">${item.name}</h1><div class="description" style="font-size: 0.95em; line-height: 1.4; color: #532902 !important; overflow-y: auto; scrollbar-width: thin;">${desc}</div></div>`;
                    }
                }

                const nativeTooltipHtml = `<div class="native-style-tooltip" style="position: fixed; pointer-events: none; background: rgba(0, 0, 0, 0.9); color: #f0f0e0; padding: 6px 8px; border: 1px solid #191813; border-radius: 3px; font-size: 14px; font-family: 'Signika', sans-serif; font-weight: normal; text-transform: none; box-shadow: 0 0 6px rgba(0,0,0,0.7); z-index: 100000; max-width: 300px; text-align: center; line-height: 1.33; word-wrap: break-word;">${game.i18n.localize("PLANT.nopayAndCreate")}</div>`;

                const wrapperHtml = `
                    <div class="custom-tooltip-wrapper">
                        <div class="dual-tooltip-layout" style="display: flex; flex-direction: row-reverse; gap: 12px; flex-wrap: wrap; max-width: 950px; justify-content: flex-start; width: fit-content; align-items: flex-end; background: none !important;">${combinedHtml}</div>
                        ${nativeTooltipHtml}
                    </div>`;
                
                game.tooltip.activate(container, { html: wrapperHtml, cssClass: 'plant-dual-tooltip' });
            });

            container.addEventListener('mouseleave', () => {
                const tooltip = document.getElementById('tooltip');
                if (tooltip) { 
                    tooltip.removeAttribute('style'); 
                    tooltip.innerHTML = ""; 
                    tooltip.className = "";
                    tooltip.classList.remove('plant-dual-tooltip');
                }
                game.tooltip.deactivate();
            });

            container.addEventListener('mousemove', (ev) => {
                const tooltip = document.getElementById('tooltip');
                
                if (tooltip && tooltip.classList.contains('plant-dual-tooltip')) {
                    tooltip.style.setProperty('background', 'none', 'important');
                    tooltip.style.setProperty('background-color', 'transparent', 'important');
                    tooltip.style.setProperty('border', 'none', 'important');
                    tooltip.style.setProperty('box-shadow', 'none', 'important');
                    tooltip.style.setProperty('backdrop-filter', 'none', 'important');
                    tooltip.style.setProperty('max-width', 'none', 'important');
                    tooltip.style.setProperty('max-height', 'none', 'important');
                    tooltip.style.setProperty('overflow', 'visible', 'important');
                    tooltip.style.setProperty('padding', '0', 'important');
                    tooltip.style.display = "block"; 
                    tooltip.style.opacity = "1";
                    
                    const gap = 10;
                    
                    let x = ev.clientX - tooltip.offsetWidth - gap;
                    let y = ev.clientY - tooltip.offsetHeight - gap; 
                    
                    let isPergamentRight = false;
                    const layoutContainer = tooltip.querySelector('.dual-tooltip-layout');
                    
                    if (x < 15) {
                        x = ev.clientX + gap; 
                        isPergamentRight = true;
                        if (layoutContainer) layoutContainer.style.flexDirection = 'row'; 
                    } else {
                        if (layoutContainer) layoutContainer.style.flexDirection = 'row-reverse'; 
                    }
                    
                    let hitTopEdge = false;
                    if (y < 15) {
                        y = 15; 
                        hitTopEdge = true; 
                    }
                    
                    tooltip.style.left = `${x}px`; 
                    tooltip.style.top = `${y}px`;

                    const nativeTooltip = tooltip.querySelector('.native-style-tooltip');
                    if (nativeTooltip) {
                        if (hitTopEdge) {
                            if (isPergamentRight) {
                                let nLeft = ev.clientX - nativeTooltip.offsetWidth - 15;
                                if (nLeft < 15) nLeft = 15;
                                nativeTooltip.style.left = `${nLeft}px`;
                            } else {
                                nativeTooltip.style.left = `${ev.clientX + 15}px`;
                            }
                            nativeTooltip.style.top = `${ev.clientY - 10}px`; 
                        } else {
                            nativeTooltip.style.left = `${ev.clientX + 15}px`; 
                            nativeTooltip.style.top = `${ev.clientY + 15}px`;  
                        }
                    }
                }
            });
        });
    }
	
	async openActiveItemSheet(event, target) {
        const realItem = this.actor?.items.get(this.activePlant?._id);
        if (realItem) {
            realItem.sheet.render(true);
        } else {
            ui.notifications.warn(game.i18n.localize("PLANT.notInInventoryWarning"));
        }
    }

    async showDetails(event, target) {
        event.preventDefault(); 
        event.stopPropagation();
        const item = target.dataset.uuid ? await fromUuid(target.dataset.uuid) : await this._findItemByName(target.dataset.name);
        if (item) item.sheet.render(true);
    }

    static DEFAULT_OPTIONS = mergeObject(super.DEFAULT_OPTIONS || {}, {
        actions: {
            showDetails: async function(event, target) { 
                await this.showDetails(event, target); 
            },
            produceItem: async function(event, target) { await this.produceItem(event, target); },
            itemEdit: async function(event, target) {
                const itemId = target.closest('.item').dataset.itemId;
                this.actor?.items.get(itemId)?.sheet.render(true);
            },
            itemDropdown: function(event, target) {
                $(target.closest('.item')).find('.expandDetails').toggleClass('shown');
            },
            itemContextMenu: async function(event, target) {
                const itemId = target.closest('.item').dataset.itemId;
                this.actor?.items.get(itemId)?.sheet.render(true);
            },
            skillSelect: async function(event, target) {
                const itemId = target.closest('.item').dataset.itemId;
                const item = this.actor?.items.get(itemId);
                if (item && this.actor) this.actor.setupSkill(item, {}, this.actor.sheet.getTokenId());
            },
            onUseItem: async function(event, target) {
                const itemId = target.closest('.item').dataset.itemId;
                const item = this.actor?.items.get(itemId);
                if (item) item.use();
            }
        }
    });
	
	openPreservationDetails(event, target) {
        if (event) event.preventDefault();
        
        const realItem = this.actor?.items.get(this.activePlant?._id) || this.activePlant;
        
        if (realItem) {
            new PlantPreservationDialog({ item: realItem }).render(true);
        }
    }

    async _findItemByName(name) {
        let item = game.items.find(i => i.name === name);
        if (item) return item;
        for (let pack of game.packs) {
            if (pack.documentName !== "Item") continue;
            const index = await pack.getIndex();
            const entry = index.find(e => e.name === name);
            if (entry) return await pack.getDocument(entry._id);
        }
        return null;
    }

    async produceItem(event, target) {
        if (event.target.closest('[data-action="showDetails"]')) return;
        
        const plantData = this.activePlant; 
        const actor = this.actor;
        if (!actor || !plantData) return;


        const realPlantItem = actor.items.get(plantData._id);
        if (!realPlantItem) {
            ui.notifications.warn(game.i18n.localize("PLANT.notInInventoryProcessWarning"));
            return;
        }

        let recipeItem = target.dataset.name ? await this._findItemByName(target.dataset.name) : null;
        if (!recipeItem && target.dataset.uuid) {
            recipeItem = await fromUuid(target.dataset.uuid);
        }
        
        if (!recipeItem) return;

        const isActuallySpoiled = plantData.system.isSpoiled === true;
        const systemData = plantData.system;
        
        const isMatch = (r) => (r.uuid && r.uuid.includes(recipeItem.id)) || r.name === recipeItem.name;
        
        const isPoisonOrDrug = (systemData.poisonRecipes || []).some(isMatch) || (systemData.drugRecipes || []).some(isMatch);
        const isAuxiliary = (systemData.auxiliaryRecipes || []).some(isMatch);
        let mod = 0;
        
        if (isPoisonOrDrug) {
            const stepVal = recipeItem.system.step?.value ?? recipeItem.system.step ?? 0;
            mod = Math.ceil(stepVal / 2) * -1;
        } else if (isAuxiliary) {
            const diffValue = recipeItem.system.difficulty?.value ?? recipeItem.system.difficulty ?? 0;
            mod = diffValue;
        }

        const skillName = game.i18n.localize("PLANT.skillPlantLore");
        const skill = actor.items.find((x) => x.type == "skill" && x.name == skillName);
        if (!skill) {
            ui.notifications.error(game.i18n.format("PLANT.missingSkill", { actor: actor.name, skill: skillName }));
            return;
        }

        actor.setupSkill(skill, { modifier: mod, subtitle: ` (${plantData.name})` }, actor.sheet.getTokenId()).then(async (setupData) => {
            if (!setupData) return;
            setupData.testData.opposable = false;
            const res = await actor.basicTest(setupData);
            
            const currentQty = Number(realPlantItem.system.quantity?.value ?? 1);
            if (currentQty <= 1) { 
                await realPlantItem.delete(); 
                const nextStack = actor.items.find(i => i.type === "plant" && i.name === plantData.name && i.id !== realPlantItem.id);
                this.activePlant = nextStack ? nextStack.toObject() : null;
            } else {
                await realPlantItem.update({ "system.quantity.value": currentQty - 1 });
                this.activePlant.system.quantity.value = currentQty - 1; 
            }

            if (res.result.successLevel >= 0) {
                if (isActuallySpoiled) {
                    ChatMessage.create({
                        user: game.user.id, speaker: ChatMessage.getSpeaker({ actor: actor }),
                        content: `<b>${game.i18n.localize("PLANT.processingTitle")} ${plantData.name}</b><br><br>${plantData.name} ${game.i18n.localize("PLANT.spoiledMessage")}`
                    });
                } else {
                    const itemData = recipeItem.toObject();
                    delete itemData._id; 
                    await actor.createEmbeddedDocuments("Item", [itemData]);
                    ui.notifications.info(game.i18n.format("PLANT.itemAdded", { item: recipeItem.name }));
                }
            }
			if (this.parent) {
    this.parent.render(true);
		}
        });
    }
	
	async plantSkillSelect(event, target) {
        const itemId = target.closest('.item').dataset.itemId;
        const item = this.actor?.items.get(itemId);
        if (item && this.actor) {
            this.actor.setupSkill(item, {}, this.actor.sheet.getTokenId()).then(async (setupData) => {
                if (setupData) await this.actor.basicTest(setupData);
            });
        }
    }

    async plantOnUseItem(event, target) {
        const itemId = target.closest('.item').dataset.itemId;
        const item = this.actor?.items.get(itemId);
        if (item) item.use();
    }
	
	async applyPreserveFree(event, target) {
        const methodItem = target.closest('.preservation-item');
        const actionBtn = methodItem.querySelector('[data-action="applyPreserve"]');
        if (!actionBtn) return;
        await this._executePreservation(actionBtn.dataset.method, actionBtn.dataset.value, actionBtn.dataset.unit, false);
    }

    async applyPreserve(event, target) {
        await this._executePreservation(target.dataset.method, target.dataset.value, target.dataset.unit, true);
    }

    async _executePreservation(methodKey, resultValue, unit, shouldPay) {
        const plantData = this.activePlant;
        const actor = this.actor;
        if (!actor || !plantData) return;

        const realPlantItem = actor.items.get(plantData._id);
        if (!realPlantItem) {
            ui.notifications.warn(game.i18n.localize("PLANT.notInInventoryProcessWarning"));
            return;
        }

        const cleanMethodKey = methodKey.replace("_spec", "");
        const storedMethods = plantData.system.preservationDetails?.methods || {};
        const methodDetails = storedMethods[cleanMethodKey] || {};
        const altEffectItems = methodDetails.alternativeEffects || [];
        const extraProducts = methodDetails.extraProducts || [];
        
        const specificKey = Object.keys(SPECIFIC_PLANT_METHODS).find(k => game.i18n.localize(`PLANT.specificPlants.${k}`) === plantData.name);
        const specificData = specificKey ? SPECIFIC_PLANT_METHODS[specificKey].find(m => m.m === cleanMethodKey) : null;
        
        let baseValue = parseFloat(resultValue) || 0;
        let finalUnit = unit;

        if (specificData?.formula) {
            const roll = await new Roll(specificData.formula).evaluate();
            await roll.toMessage({ flavor: `${game.i18n.localize("PLANT.processingTitle")}: ${plantData.name}` });
            baseValue = roll.total;
            finalUnit = specificData.unit || unit;
        }

        const supernaturalFactor = Number(plantData.system.supernatural?.factor ?? 1);
        const unitToDays = { 'seconds': 1/86400, 'minutes': 1/1440, 'hours': 1/24, 'days': 1, 'weeks': 7, 'months': 30, 'years': 365 };
        const totalDaysRemaining = baseValue * (unitToDays[finalUnit] || 1) * supernaturalFactor;

        let newItemData = duplicate(plantData);
        delete newItemData._id;
		foundry.utils.setProperty(newItemData, "flags.dsa5.originalBasePlant", plantData.name);
        newItemData.system.quantity.value = 1;
        newItemData.system.mundane = { shelfLife: { value: baseValue } };
        newItemData.system.processed = { shelfLife: { unit: finalUnit } }; 
        newItemData.system.plantState = "Haltbargemacht";
        newItemData.system.preservationMethod = cleanMethodKey;
        newItemData.system.remaining = { shelfLife: { value: Math.round(totalDaysRemaining * 10) / 10 } };

        if (specificData?.p) {
            const altItem = altEffectItems.length > 0 ? await this._findItemByName(altEffectItems[0].name) : null;
            newItemData.name = altItem ? altItem.name : game.i18n.localize(`PLANT.products.${specificData.p}`);
        } else {
            newItemData.name = `${plantData.name} (${game.i18n.localize(`PLANT.states.${cleanMethodKey}`)})`;
        }

        if (altEffectItems.length > 0) {
            const altItem = await this._findItemByName(altEffectItems[0].name);
            if (altItem) {
                const altItemData = altItem.toObject();

                // 1. Text sicher extrahieren
                let newDesc = altItemData.system.description?.value 
                           || altItemData.system.effect?.value 
                           || altItemData.system.effect 
                           || "";
                
                if (typeof newDesc === "string" && newDesc.trim() !== "") {
                    newItemData.system.effect = newDesc;
                }

                // 2. Icon übernehmen (außer es ist ein Standard-Platzhalter wie der Consumable-Beutel)
                if (!["systems/dsa5/icons/categories/consumable.webp", "systems/dsa5/icons/categories/Equipment.webp"].includes(altItemData.img)) {
                    newItemData.img = altItemData.img;
                }

                // 3. Makro-Daten (args3) suchen 
                const effectWithArgs3 = altItem.effects.find(e => e.getFlag("dsa5", "args3"));
                
                if (effectWithArgs3) {
                    const args3Content = effectWithArgs3.getFlag("dsa5", "args3");
                    const isFood = altItemData.type === "consumable" && altItemData.system.equipmentType?.value === "food";

                    if (isFood) {
                        // A: Es ist ein Lebensmittel. Der Code wandert in onConsumeEffect.
                        if (!newItemData.flags) newItemData.flags = {};
                        if (!newItemData.flags.dsa5) newItemData.flags.dsa5 = {};
                        newItemData.flags.dsa5.onConsumeEffect = args3Content;
                    } else {
                        // B: Es ist kein Lebensmittel. Der Code wandert in die ActiveEffects (args3).
                        if (!newItemData.effects) newItemData.effects = [];
                        
                        if (newItemData.effects.length > 0) {
                            if (!newItemData.effects[0].flags) newItemData.effects[0].flags = {};
                            if (!newItemData.effects[0].flags.dsa5) newItemData.effects[0].flags.dsa5 = {};
                            newItemData.effects[0].flags.dsa5.args3 = args3Content;
                            newItemData.effects[0].flags.dsa5.advancedFunction = "2";
                        } else {
                            newItemData.effects.push({
                                name: newItemData.name,
                                icon: newItemData.img,
                                origin: `Item.${plantData._id}`, 
                                flags: {
                                    dsa5: {
                                        description: newItemData.name,
                                        auto: null,
                                        manual: 0,
                                        value: null,
                                        hideOnToken: false,
                                        hidePlayers: false,
                                        isAura: false,
                                        disposition: "0",
                                        auraRadius: "",
                                        borderColor: "",
                                        borderThickness: null,
                                        removeMessage: "",
                                        charges: { value: null, max: null },
                                        customDuration: "",
                                        advancedFunction: "2",
                                        resistRoll: "",
                                        args3: args3Content,
                                        onRemove: ""
                                    }
                                }
                            });
                        }
                    }
                }
            }
        }

        if (shouldPay) {
            if (!game.dsa5?.apps?.DSA5Payment) {
                ui.notifications.error("Zahlungs-System (DSA5Payment) konnte nicht gefunden werden!");
                return;
            }
            
            // "0.05" zieht exakt 5 Kreuzer ab (bei Silber-Standard)
            const paySuccess = await game.dsa5.apps.DSA5Payment.payMoney(actor, "0.05");
            
            // Wenn der Held nicht genug Geld hat, bricht die Herstellung ab
            if (!paySuccess) return; 
        }

        if (Number(realPlantItem.system.quantity?.value ?? 1) <= 1) { 
            await realPlantItem.delete(); 
            const nextStack = actor.items.find(i => i.type === "plant" && i.name === plantData.name && i.id !== realPlantItem.id);
            this.activePlant = nextStack ? nextStack.toObject() : null;
        } else { 
            await realPlantItem.update({ "system.quantity.value": Number(realPlantItem.system.quantity.value) - 1 }); 
            this.activePlant.system.quantity.value -= 1;
        }

        await actor.createEmbeddedDocuments("Item", [newItemData]);
        if (extraProducts.length > 0) {
            for (const p of extraProducts) {
                const pDoc = await this._findItemByName(p.name);
                if (pDoc) { let pData = pDoc.toObject(); delete pData._id; await actor.createEmbeddedDocuments("Item", [pData]); }
            }
        }
		if (this.parent) {
    this.parent.render(true);
	}

    }
}
