import Riding from '../../system/automation/riding.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import CompanionConfig from './companion-config.js';
import { CompanionTrainingApp } from './companion-training-app.js';
import { CompanionSkillSelectionApp } from './companion-skill-selection-app.js';

export default class CompanionHandler {
    static COMPANION_TAB_ID = 'companion';

    static getCompanionTab() {
        return { id: this.COMPANION_TAB_ID, label: 'COMPANIONS.Companion', icon: 'fas fa-paw' };
    }

    static getOwnerTab() {
        return { id: 'owner', label: 'COMPANIONS.Owner', icon: 'fas fa-user-friends' };
    }

    static getCompanionPart() {
        return {
            template: 'systems/dsa5/templates/actors/companions/actor-companion.hbs',
            scrollable: [''],
            templates: [
                'systems/dsa5/templates/actors/parts/horse.hbs',
                'systems/dsa5/templates/actors/companions/companion-card.hbs',
            ],
        };
    }

    static getOwnerPart() {
        return {
            template: 'systems/dsa5/templates/actors/companions/actor-owner.hbs',
            scrollable: [''],
        };
    }

    static withSheetTab(baseTabs, tab, insertBefore = 'notes') {
        const tabs = foundry.utils.deepClone(baseTabs || {});
        tabs.sheet ??= { tabs: [], initial: tab.id };
        tabs.sheet.tabs ??= [];

        if (!tabs.sheet.tabs.some((entry) => entry.id === tab.id)) {
            const insertIndex = tabs.sheet.tabs.findIndex((entry) => entry.id === insertBefore);
            if (insertIndex === -1) tabs.sheet.tabs.push({ ...tab });
            else tabs.sheet.tabs.splice(insertIndex, 0, { ...tab });
        }

        return tabs;
    }

    static prepareTabVisibility(actor, tabs) {
        const ownerTabId = this.getOwnerTab().id;
        if (tabs[ownerTabId] && !this.shouldShowOwnerTab(actor)) {
            delete tabs[ownerTabId];
        }
        return tabs;
    }

    static shouldShowOwnerTab(actor) {
        return (actor.getFlag('dsa5', 'owners') || []).length > 0;
    }

    static async prepareCompanionPartContext(sheet, context) {
        await this.prepareCompanionsData(sheet.actor, context);
        return context;
    }

    static async prepareOwnerPartContext(sheet, context) {
        await this.prepareOwnersData(sheet.actor, context);
        return context;
    }

    static attachCompanionPartListeners(sheet, element) {
        this.activateListeners(sheet, element, sheet.actor);
    }

    static attachOwnerPartListeners(sheet, element) {
        this.activateListeners(sheet, element, sheet.actor);
    }

    static expandedCompanions = new Set();

    // --- Dynamische Datenstruktur mit Lokalisierung ---
    static get COMPANION_SPECIES_DATA() {
        return CompanionConfig.companionSpeciesData;
    }

    static async setCompanion(sheet, uuid) {
        const droppedActor = await fromUuid(uuid);
        if (!droppedActor) return false;

        if (!droppedActor.prototypeToken.actorLink) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.TokenLinkWarning"));
            return false;
        }

        const familiarName = _loc("LocalizedIDs.familiar");
        const isFamiliar = droppedActor.items.some(i => i.type === 'trait' && i.name === familiarName);
        let owners = droppedActor.getFlag('dsa5', 'owners') || [];

        if (isFamiliar && owners.length >= 1 && !owners.includes(sheet.actor.uuid)) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.FamiliarOwnerWarning"));
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

        const isHomunculus = droppedActor.items.some(i => i.type === 'trait' && i.name === _loc("COMPANIONS.HomunculusCreation"));

        if (!isHomunculus) {
            const loyaltyName = _loc("LocalizedIDs.loyalty");
            const loyaltyItem = droppedActor.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));

            const initialLoyalty = isFamiliar ? 4 : 0;

            if (!loyaltyItem) {
                const [loyaltyItemData] = await DSA5_Utility.collectIndexedCompendiumEntries({
                    documentName: 'Item',
                    fields: ['name', 'type'],
                    filterEntry: (entry) => entry.type === 'skill' && entry.name === loyaltyName,
                    mapEntry: async (entry, { getDocument }) => (await getDocument(entry._id)).toObject(),
                });

                if (loyaltyItemData) {
                    loyaltyItemData.system.talentValue.value = initialLoyalty;
                    await droppedActor.createEmbeddedDocuments("Item", [loyaltyItemData]);

                    ui.notifications.info(_loc("COMPANIONS.Loyalty.Added", {
                        name: droppedActor.name,
                        talent: loyaltyName,
                        val: initialLoyalty
                    }));
                } else {
                    ui.notifications.warn(_loc("COMPANIONS.Loyalty.NotFound", {
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
        const companionTraitName = _loc("LocalizedIDs.companion");

        if (!isFamiliar && !isHomunculus) {
            const hasCompanionTrait = droppedActor.items.some(i => i.type === 'trait' && i.name === companionTraitName);

            if (!hasCompanionTrait) {
                const traitData = {
                    name: companionTraitName,
                    type: "trait",
                    system: { traitType: { value: "general" } }
                };

                await droppedActor.createEmbeddedDocuments("Item", [traitData]);
                ui.notifications.info(_loc("COMPANIONS.Notification.CompanionAdded", { name: droppedActor.name }));
            }
        }

        await sheet.render({ force: true });

        if (currentTab && sheet.tabGroups?.sheet !== currentTab) {
            sheet.changeTab(currentTab, 'sheet');
        }

        return true;
    }
    static async handleCompanionRegeneration(sheet, ev, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        const actor = await fromUuid(uuid);
        if (actor && actor.isOwner) {
            const setup = await actor.setupRegeneration("regenerate", {});
            if (setup) await actor.basicTest(setup);
        } else {
            ui.notifications.warn(_loc("COMPANIONS.Notification.NoPermissionRegeneration"));
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
                const companionTraitName = _loc("LocalizedIDs.companion");
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

    static getSheetActions() {
        return {
            openLinkedSheet: this._openLinkedSheetAction,
            toggleNatureOptions: this._toggleNatureOptionsAction,
            toggleCompanionDetails: this._toggleCompanionDetailsAction,
        };
    }

    static getOwnerSheetActions() {
        return {
            changeCompanionNature: this._changeCompanionNatureAction,
            companionEffect: { handler: this._companionEffectAction, buttons: [0, 2] },
            rollCompanionAggregatedProbe: this._rollCompanionAggregatedProbeAction,
            removeCompanion: this._removeCompanionAction,
            openSkillSelection: this._openSkillSelectionAction,
            executeCompanionSkill: this._executeCompanionSkillAction,
            trainCompanion: this._trainCompanionAction,
            companionRegeneration: this._companionRegenerationAction,
            toggleMount: this._toggleMountAction,
            toggleHotbarControl: this._toggleHotbarControlAction,
            finishTrickTraining: this._finishTrickTrainingAction,
            editAggregatedTest: this._editAggregatedTestAction,
            companionSkillSelect: this._companionSkillSelectAction,
            companionItemEdit: this._companionItemEditAction,
        };
    }

    static _toggleNatureOptionsAction(_ev, target) {
        const container = target.closest('.nature-toggle-container');
        const optionsDiv = container?.querySelector('.nature-options');
        if (!container || !optionsDiv) return;

        $(optionsDiv).fadeToggle(150);
        target.classList.toggle('fa-chevron-right');
        target.classList.toggle('fa-chevron-left');
    }

    static async _changeCompanionNatureAction(_ev, target) {
        const container = target.closest('.nature-toggle-container');
        const compActor = await CompanionHandler._resolveActor(container);
        if (!container || !compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const isCurrentlyDomesticated = container.dataset.isDomesticated === 'true';
        const zoologyDomName = _loc("LocalizedIDs.zoologyDomesticated");
        const zoologyWildName = _loc("LocalizedIDs.zoologyWild");
        const loyaltyName = _loc("LocalizedIDs.loyalty");

        const dialogText = _loc("COMPANIONS.Loyalty.changeText", { name: compActor.name });
        const newLoyaltyValue = isCurrentlyDomesticated ? 0 : 4;

        new foundry.applications.api.DialogV2({
            window: {
                title: "COMPANIONS.Loyalty.changeTitle",
            },
            content: `<p>${dialogText}</p>`,
            buttons: [
                {
                    action: 'accept',
                    label: _loc("ok"),
                    icon: 'fas fa-check',
                    default: true,
                    callback: async () => {
                        if (isCurrentlyDomesticated) {
                            const domItems = compActor.items.filter(i => i.type === 'information' && i.name === zoologyDomName).map(i => i.id);
                            await compActor.deleteEmbeddedDocuments('Item', domItems, { render: false });
                            await compActor.createEmbeddedDocuments('Item', [{ name: zoologyWildName, type: 'information' }], { render: false });
                        } else {
                            const wildItems = compActor.items.filter(i => i.type === 'information' && i.name === zoologyWildName).map(i => i.id);
                            await compActor.deleteEmbeddedDocuments('Item', wildItems, { render: false });
                            await compActor.createEmbeddedDocuments('Item', [{ name: zoologyDomName, type: 'information' }], { render: false });
                        }

                        const loyaltyItem = compActor.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
                        if (loyaltyItem) {
                            await compActor.updateEmbeddedDocuments('Item', [{
                                _id: loyaltyItem.id,
                                'system.talentValue.value': newLoyaltyValue,
                            }]);
                        } else {
                            compActor.sheet?.render();
                        }

                        this.render();
                    },
                },
                {
                    action: 'decline',
                    label: _loc("cancel"),
                    icon: 'fas fa-times',
                    callback: () => {
                        container.querySelector('.nature-options').style.display = 'none';
                        container.querySelector('.toggle-nature-arrow').classList.replace('fa-chevron-left', 'fa-chevron-right');
                    },
                },
            ],
        }).render(true);
    }

    static async _companionEffectAction(ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        const effectId = target.dataset.effectId;
        if (!compActor || !effectId || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const effect = compActor.effects.get(effectId);
        if (!effect) return;

        if (ev.button === 2) {
            await effect.delete();
            return;
        }

        effect.sheet.render(true);
    }

    static async _resolveActor(target, datasetKey = 'uuid') {
        const uuid = target.dataset[datasetKey] || target.closest(`[data-${datasetKey.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}]`)?.dataset[datasetKey];
        return uuid ? fromUuid(uuid) : null;
    }

    static _warnIfNotPetOwner(compActor) {
        if (compActor?.isOwner) return false;
        if (compActor) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.NotPetOwner", { name: compActor.name }));
        }
        return true;
    }

    static async _openLinkedSheetAction(_ev, target) {
        const actor = await CompanionHandler._resolveActor(target);
        if (!actor) return;

        await actor.sheet.render(true, { focus: true, tab: { sheet: target.dataset.tab } });
        this.close();
    }

    static async _rollCompanionAggregatedProbeAction(_ev, target) {
        const itemId = target.dataset.itemId;
        const aggregatedItem = this.actor.items.get(itemId);
        if (!aggregatedItem) return;

        const aggregated = aggregatedItem.toObject();
        const which = target.dataset.which || "";
        const attr = aggregated.system.talent[`value${which}`];
        const skill = this.actor.items.find(i => i.name === attr && i.type === 'skill');

        let infoMsg = `<h3 class="center"><b>${_loc('TYPES.Item.aggregatedTest')}</b></h3>`;

        if (aggregated.system.usedTestCount.value >= aggregated.system.allowedTestCount.value) {
            infoMsg += `${_loc('Aggregated.noMoreAllowed')}`;
            ChatMessage.create(game.dsa5.apps.DSA5_Utility.chatDataSetup(infoMsg));
            return;
        }

        const options = {
            moreModifiers: [
                { name: _loc('failedTests'), value: -1 * aggregated.system.previousFailedTests.value, selected: true },
                { name: _loc('Modifier'), value: aggregated.system.baseModifier, selected: true },
            ],
        };

        const tokenId = this.getTokenId();
        const setupData = await this.actor.setupSkill(skill, options, tokenId);
        const res = await this.actor.basicTest(setupData);

        if (res.result.successLevel > 0) {
            aggregated.system.cummulatedQS.value = Math.min(10, res.result.qualityStep + aggregated.system.cummulatedQS.value);
        } else {
            aggregated.system.previousFailedTests.value += 1;
        }
        aggregated.system.usedTestCount.value += 1;

        await this.actor.updateEmbeddedDocuments('Item', [aggregated]);
        const updated = this.actor.items.get(itemId);
        updated.postItem();
        if (aggregated.system.cummulatedQS.value >= 10) {
            updated.sheet.postFinishedItem();
        }
    }
    static async _removeCompanionAction(ev, target) {
        await CompanionHandler.removeCompanion(this, ev, target);
    }

    static async _openSkillSelectionAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        new CompanionSkillSelectionApp(this.actor, compActor, { parentSheet: this }).render(true);
    }

    static async _executeCompanionSkillAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        const itemId = target.dataset.itemId;
        if (!compActor || !itemId) return;

        const item = compActor.items.get(itemId);
        if (!item) return;

        const macroCode = item.getFlag('dsa5', 'onUseEffect');
        if (!macroCode) return;

        try {
            const tokenId = compActor.getActiveTokens()[0]?.id || null;
            const token = canvas.tokens.get(tokenId);
            const speaker = ChatMessage.getSpeaker({ actor: compActor, token });

            const AsyncFunction = Object.getPrototypeOf(async function () { }).constructor;
            const fn = new AsyncFunction('item', 'actor', 'token', 'speaker', macroCode);

            await fn.call(item, item, compActor, token, speaker);
        } catch (err) {
            ui.notifications.error(_loc("COMPANIONS.Notification.MacroError", { name: item.name, error: err.message }));
            console.error(err);
        }
    }

    static async _trainCompanionAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const zoologyWildName = _loc("LocalizedIDs.zoologyWild");
        const abrichterName = _loc("COMPANIONS.Training.AnimalTrainer");
        const familiarName = _loc("LocalizedIDs.familiar");

        const isFamiliar = compActor.items.some(i => i.type === 'trait' && i.name === familiarName);
        const isWild = !isFamiliar && compActor.items.some(i => i.type === 'information' && i.name === zoologyWildName);
        const hasAbrichter = this.actor.items.some(i => i.type === 'specialability' && i.name === abrichterName);

        if (isWild && !hasAbrichter) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.WildAnimalTrainerWarning"));
            return;
        }

        new CompanionTrainingApp(this.actor, compActor, { parentSheet: this }).render(true);
    }

    static async _companionRegenerationAction(ev, target) {
        await CompanionHandler.handleCompanionRegeneration(this, ev, target);
    }

    static async _toggleMountAction(_ev, target) {
        await CompanionConfig.ensureLoaded();
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const isCurrentlyRiding = this.actor.system.horse?.actorId === compActor.id && this.actor.system.horse?.isRiding === 1;

        if (isCurrentlyRiding) {
            await compActor.setFlag('dsa5', 'isMountActive', false);

            if (typeof Riding !== 'undefined') {
                await Riding.clearMount(this.actor);
            } else {
                await this.actor.update({
                    "system.horse.isRiding": 0,
                    "system.horse.actorId": "",
                    "system.horse.actorLink": false,
                    "system.horse.token": {},
                });
            }

            return;
        }

        await compActor.setFlag('dsa5', 'isMountActive', true);

        if (typeof Riding !== 'undefined') {
            await this.actor.update({
                "system.horse.isRiding": Riding.probablyDriving(compActor),
                "system.horse.actorId": compActor.id,
                "system.horse.actorLink": compActor.prototypeToken?.actorLink ?? true,
            });

            await Riding.addRidingCondition(this.actor);

            const ridingName = _loc('RIDING.riding');
            const ridingDesc = _loc('RIDING.ridingDescription');
            const ridingEffect = this.actor.effects.find(e => e.name === ridingName || e.flags?.dsa5?.description === ridingDesc);

            if (ridingEffect) {
                const knownTrainings = compActor.items.filter(i => i.type === 'trait' && i.system?.traitType?.value === 'training');
                const reittierStr = CompanionConfig.trainingNames.Reittier;
                const hasReittier = knownTrainings.some(t => t.name.includes(reittierStr));

                let effectValue = 0;
                if (!hasReittier) effectValue = -1;
                else if (knownTrainings.length >= 2) effectValue = 1;

                if (effectValue !== 0) {
                    const newChanges = foundry.utils.duplicate(ridingEffect.changes);
                    const ridingSkillName = _loc("LocalizedIDs.riding") || "Reiten";

                    if (!newChanges.some(c => c.key === 'system.skillModifiers.step' && c.value.includes(ridingSkillName))) {
                        newChanges.push({
                            key: 'system.skillModifiers.step',
                            mode: 0,
                            value: `${ridingSkillName} ${effectValue}`,
                        });
                        await ridingEffect.update({ changes: newChanges });
                    }
                }
            }
        }
    }

    static async _toggleHotbarControlAction(_ev, target) {
        const card = target.closest('.companion-header-ui');
        const compActor = await CompanionHandler._resolveActor(card);
        if (!compActor) return;
        if (CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const newUuid = card.dataset.uuid;
        const currentUuid = this.actor.getFlag('dsa5', 'hotbarCompanion');

        if (currentUuid === newUuid) {
            await this.actor.unsetFlag('dsa5', 'hotbarCompanion');
        } else {
            await this.actor.setFlag('dsa5', 'hotbarCompanion', newUuid);
        }
    }

    static async _finishTrickTrainingAction(_ev, target) {
        await CompanionTrainingApp.finishTraining(this.actor, target);
    }

    static _editAggregatedTestAction(_ev, target) {
        const item = this.actor.items.get(target.dataset.itemId);
        if (item) item.sheet.render(true);
    }

    static async _companionSkillSelectAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target, 'actorUuid');
        const itemId = target.closest('.item')?.dataset.itemId;
        if (!compActor || !itemId || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const skillItem = compActor.items.get(itemId);
        if (!skillItem) return;

        const rollerTokenId = compActor.getActiveTokens()[0]?.id || null;
        const setupData = await compActor.setupSkill(skillItem, {}, rollerTokenId);
        const isLoyaltyRoll = skillItem.name === _loc("LocalizedIDs.Fast-Talk") || skillItem.name === _loc("LocalizedIDs.loyalty");

        const testResult = await compActor.basicTest(setupData);
        if (!isLoyaltyRoll || !testResult?.result) return;

        const res = testResult.result;
        const desc = (res.description || '').toLowerCase();

        const isCrit = res.isCrit || res.successLevel >= 2 || desc.includes('kritisch') || desc.includes('spektakulär');
        const isBotch = res.isBotch || res.successLevel <= -2 || desc.includes('patzer') || desc.includes('schrecklich') || desc.includes('missgeschick');
        const isFail = res.successLevel < 0 || desc.includes('misserfolg') || desc.includes('fehlschlag') || isBotch;

        const chatMessages = [];

        if (isCrit || isBotch) {
            const change = (await new Roll('1d3+1').evaluate()).total;

            if (isCrit) {
                await skillItem.update({ 'system.talentValue.value': skillItem.system.talentValue.value + change });
                chatMessages.push(_loc("COMPANIONS.Loyalty.CritGain", { name: compActor.name, change }));
            } else {
                await skillItem.update({ 'system.talentValue.value': Math.max(0, skillItem.system.talentValue.value - change) });
                chatMessages.push(_loc("COMPANIONS.Loyalty.BotchLoss", { name: compActor.name, change }));
            }
        }

        const isFamiliar = compActor.items.some(i => i.type === 'trait' && i.name === _loc("LocalizedIDs.familiar"));
        const isWild = !isFamiliar && compActor.items.some(i => i.type === 'information' && i.name === _loc("LocalizedIDs.zoologyWild"));

        if (isWild && isFail) {
            const d6 = (await new Roll('1d6').evaluate()).total;

            if (d6 <= 2) {
                chatMessages.push(_loc(`COMPANIONS.WildFail.${d6}`, { name: compActor.name }));
            } else {
                const kr = (await new Roll('1d6').evaluate()).total;
                chatMessages.push(_loc(`COMPANIONS.WildFail.${d6 === 6 ? '6' : '35'}`, { name: compActor.name, kr }));
            }
        }

        if (chatMessages.length > 0) {
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: compActor }),
                content: chatMessages.join('<br><br>'),
            });
        }
    }

    static async _companionItemEditAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target, 'actorUuid') || await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        const itemId = target.closest('.item')?.dataset.itemId;
        if (!compActor || !itemId) return;

        const item = compActor.items.get(itemId);
        if (item) item.sheet.render(true);
    }

    static _toggleCompanionDetailsAction(_ev, target) {
        const card = target.closest('.companion-header-ui');
        const uuid = card?.dataset.uuid;
        const details = card?.querySelectorAll('.companion-details');
        if (!uuid || !details?.length) return;

        $(details).slideToggle(200);

        if (CompanionHandler.expandedCompanions.has(uuid)) {
            CompanionHandler.expandedCompanions.delete(uuid);
        } else {
            CompanionHandler.expandedCompanions.add(uuid);
        }

        target.classList.toggle('fa-minimize');
        target.classList.toggle('fa-maximize');
    }

    static async prepareCompanionsData(actor, sheetData) {
        const companionUuids = actor.getFlag('dsa5', 'companions') || [];
        sheetData.hasCompanions = companionUuids.length > 0;

        if (sheetData.hasCompanions) await CompanionConfig.ensureLoaded();

        const sections = { familiar: [], group: [], regular: [] };

        if (sheetData.hasCompanions) {
            const trickIndicator = "(Trick):";
            const trainingIndicator = _loc("COMPANIONS.Training.ModuleIndicator");
            const ctx = {
                familiarName: _loc("LocalizedIDs.familiar"),
                homunculusName: _loc("COMPANIONS.HomunculusCreation"),
                zoologyDom: _loc("LocalizedIDs.zoologyDomesticated"),
                hotbarCompUuid: actor.getFlag('dsa5', 'hotbarCompanion'),
                loyaltyName: _loc("LocalizedIDs.loyalty"),
                trainingIndicator,
                trainingPrefix: _loc("COMPANIONS.Training.ShortPrefix"),
                trickIndicator,
                trickPrefix: _loc("COMPANIONS.Trick.ShortPrefix"),
                reittierStr: CompanionConfig.trainingNames.Reittier,
                spellTypes: new Set(['spell', 'ritual', 'magictrick', 'magicalsign']),
                prayerTypes: new Set(['liturgy', 'ceremony', 'blessing']),
                persuasionSkill: actor.items.find(i => i.type === 'skill' && i.name === _loc("LocalizedIDs.Fast-Talk")) || null,
                actor,
            };

            const companions = (await Promise.all(companionUuids.map(cUuid => fromUuid(cUuid)))).filter(Boolean);
            const companionTestsByUuid = new Map(companions.map(comp => [comp.uuid, []]));
            const relevantTests = actor.items.filter(i => i.type === 'aggregatedTest' && (i.name.includes(trickIndicator) || i.name.includes(trainingIndicator)));

            for (const test of relevantTests) {
                const comp = companions.find(c => test.name.includes(c.name));
                if (!comp) continue;

                const isTraining = test.name.includes(trainingIndicator);
                const [indicator, prefix] = isTraining
                    ? [trainingIndicator, ctx.trainingPrefix]
                    : [trickIndicator, ctx.trickPrefix];
                const parts = test.name.split(indicator);
                const shortName = parts.length > 1 ? `${prefix} ${parts[1].trim()}` : test.name;

                companionTestsByUuid.get(comp.uuid).push({
                    item: test,
                    shortName,
                    isCompleted: (test.system.cummulatedQS?.value || 0) >= 10,
                    apCost: test.getFlag('dsa5', 'trainingApCost') || '?',
                    isTraining,
                });
            }

            for (const comp of companions) {
                const type = CompanionHandler.#prepareOneCompanion(comp, actor, ctx, companionTestsByUuid);
                sections[type].push(comp);
            }
        }

        sheetData.companionSections = [
            { label: 'familiar', contents: sections.familiar },
            { label: 'SHEET.AnimalCompanion', contents: sections.regular },
            { label: 'COMPANIONS.Group.Companion', contents: sections.group },
            { label: 'COMPANIONS.Group.SummonedCreatures', contents: [] },
        ];
    }

    static #prepareOneCompanion(comp, actor, ctx, companionTestsByUuid) {
        let isDomesticated = false;
        let isFamiliar = false;
        let isHomunculus = false;
        let hasSpells = false;
        let hasPrayers = false;
        let loyaltyItem = null;

        for (const item of comp.items) {
            if (!isDomesticated && item.type === 'information' && item.name === ctx.zoologyDom) isDomesticated = true;
            if (!isFamiliar && item.type === 'trait' && item.name === ctx.familiarName) isFamiliar = true;
            if (!isHomunculus && item.type === 'trait' && item.name === ctx.homunculusName) isHomunculus = true;
            if (!hasSpells && ctx.spellTypes.has(item.type)) hasSpells = true;
            if (!hasPrayers && ctx.prayerTypes.has(item.type)) hasPrayers = true;
            if (!loyaltyItem && item.type === 'skill' && item.name.startsWith(ctx.loyaltyName)) loyaltyItem = item;
        }

        if (isFamiliar || isHomunculus) hasSpells = true;

        const loyaltyData = isHomunculus
            ? (ctx.persuasionSkill ? {
                id: ctx.persuasionSkill.id,
                actorUuid: actor.uuid,
                value: ctx.persuasionSkill.system.talentValue.value,
                char1: 'mu',
                char2: 'in',
                char3: 'ch',
            } : null)
            : (loyaltyItem ? {
                id: loyaltyItem.id,
                actorUuid: comp.uuid,
                value: loyaltyItem.system.talentValue.value,
                char1: loyaltyItem.system.characteristic1.value,
                char2: loyaltyItem.system.characteristic2.value,
                char3: loyaltyItem.system.characteristic3.value,
            } : null);

        const activeEffects = Array.from(comp.effects).filter(e => !e.disabled).map(e => ({
            id: e.id,
            img: e.img || 'icons/svg/aura.svg',
            name: e.name || _loc('SHEET.Effect'),
            value: e.flags?.dsa5?.value,
        }));

        const companionTests = companionTestsByUuid.get(comp.uuid);
        companionTests.sort((a, b) =>
            a.isTraining !== b.isTraining ? (a.isTraining ? -1 : 1) : a.shortName.localeCompare(b.shortName)
        );

        const savedHotbar = comp.getFlag('dsa5', 'skillHotbar') || Array(14).fill(null);
        const hotbarItems = savedHotbar.map(itemId => {
            if (!itemId) return null;
            const item = comp.items.get(itemId);
            if (!item) return null;

            return {
                id: item.id,
                name: item.name,
                img: item.img,
                tooltip: `<div class='itemTooltip'><h1>${item.name}</h1>${item.system.description?.value || ''}</div>`,
            };
        });

        const currentSpecies = comp.getFlag('dsa5', 'species');
        const isMountPossible = !currentSpecies
            || !!Object.values(CompanionHandler.COMPANION_SPECIES_DATA).find(
                group => group[currentSpecies]?.trainingModules?.includes(ctx.reittierStr)
            );

        comp.prepareCompanion = {
            hasSpells,
            hasPrayers,
            hasNone: !hasSpells && !hasPrayers,
            containerClass: (hasSpells && hasPrayers) ? 'third' : 'fourty',
            lepClass: (hasSpells || hasPrayers) ? '' : 'soloBar',
            loyalty: loyaltyData,
            effects: activeEffects,
            natureIcon: isDomesticated ? 'fa-house-chimney' : 'fa-mountain-sun',
            natureTooltip: isDomesticated ? 'COMPANIONS.domesticatedAnimal' : 'COMPANIONS.wildAnimal',
            otherNatureIcon: isDomesticated ? 'fa-mountain-sun' : 'fa-house-chimney',
            otherNatureTooltip: isDomesticated ? 'COMPANIONS.wildAnimal' : 'COMPANIONS.domesticatedAnimal',
            isDomesticated,
            isMountPossible,
            isMountActive: actor.system.horse?.actorId === comp.id && actor.system.horse?.isRiding === 1,
            isHotbarControlled: comp.uuid === ctx.hotbarCompUuid,
            isFamiliar,
            isHomunculus,
            showNatureIcon: !isFamiliar && !isHomunculus,
            isExpanded: CompanionHandler.expandedCompanions.has(comp.uuid),
            hasEffects: activeEffects.length > 0,
            hotbarItems,
            hotbarRow1: hotbarItems.slice(0, 7),
            hotbarRow2: hotbarItems.slice(7, 14),
            trainingTests: companionTests,
        };

        const owners = comp.getFlag('dsa5', 'owners') || [];
        if (isFamiliar || isHomunculus) return 'familiar';
        if (owners.length > 1) return 'group';
        return 'regular';
    }

    static async prepareOwnersData(actor, sheetData) {
        const ownerUuids = actor.getFlag('dsa5', 'owners') || [];
        sheetData.petOwners = (await Promise.all(ownerUuids.map(ownerUuid => fromUuid(ownerUuid)))).filter(Boolean);
    }

    static activateListeners(sheet, html, actor) {
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

