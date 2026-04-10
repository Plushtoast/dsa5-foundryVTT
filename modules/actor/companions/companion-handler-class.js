import Riding from '../../system/automation/riding.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import CompanionConfig from './companion-config.js';
import { CompanionTrainingApp } from './companion-training-app.js';
import { CompanionSkillSelectionApp } from './companion-skill-selection-app.js';

export default class CompanionHandler {
    static COMPANION_TAB_ID = 'companion';

    static getCompanionTab() {
        return { id: this.COMPANION_TAB_ID, label: 'SHEET.Companion', icon: 'fas fa-paw' };
    }

    static getOwnerTab() {
        return { id: 'owner', label: 'SHEET.Owner', icon: 'fas fa-user-friends' };
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
            ui.notifications.warn(_loc("SHEET.TokenLinkWarning"));
            return false;
        }

        const familiarName = _loc("SHEET.FamiliarTrait");
        const isFamiliar = droppedActor.items.some(i => i.type === 'trait' && i.name === familiarName);
        let owners = droppedActor.getFlag('dsa5', 'owners') || [];

        if (isFamiliar && owners.length >= 1 && !owners.includes(sheet.actor.uuid)) {
            ui.notifications.warn(_loc("SHEET.FamiliarOwnerWarning"));
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

        const isHomunculus = droppedActor.items.some(i => i.type === 'trait' && i.name === _loc("SHEET.HomunculusCreation"));

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

                    ui.notifications.info(_loc("SHEET.LoyaltyAdded", {
                        name: droppedActor.name,
                        talent: loyaltyName,
                        val: initialLoyalty
                    }));
                } else {
                    ui.notifications.warn(_loc("SHEET.LoyaltyNotFound", {
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
        const companionTraitName = _loc("SHEET.CompanionTrait");

        if (!isFamiliar && !isHomunculus) {
            const hasCompanionTrait = droppedActor.items.some(i => i.type === 'trait' && i.name === companionTraitName);

            if (!hasCompanionTrait) {
                const traitData = {
                    name: companionTraitName,
                    type: "trait",
                    system: { traitType: { value: "general" } }
                };

                await droppedActor.createEmbeddedDocuments("Item", [traitData]);
                ui.notifications.info(_loc("SHEET.CompanionAdded", { name: droppedActor.name }));
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
            ui.notifications.warn(_loc("SHEET.NoPermissionRegeneration"));
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
                const companionTraitName = _loc("SHEET.CompanionTrait");
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
            openOwnerSheet: this._openOwnerSheetAction,
            openCompanion: this._openCompanionAction,
            toggleNatureOptions: this._toggleNatureOptionsAction,
            toggleCompanionDetails: this._toggleCompanionDetailsAction,
        };
    }

    static getOwnerSheetActions() {
        return {
            changeCompanionNature: this._changeCompanionNatureAction,
            companionEffect: { handler: this._companionEffectAction, buttons: [0, 2] },
            deleteAggregatedTest: this._deleteAggregatedTestAction,
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

        const dialogText = _loc("SHEET.loyaltyChangeText", { name: compActor.name });
        const newLoyaltyValue = isCurrentlyDomesticated ? 0 : 4;

        new foundry.applications.api.DialogV2({
            window: {
                title: "SHEET.loyaltyChangeTitle",
            },
            content: `<p>${dialogText}</p>`,
            buttons: [
                {
                    action: 'accept',
                    label: _loc("SHEET.Accept"),
                    icon: 'fas fa-check',
                    default: true,
                    callback: async () => {
                        if (isCurrentlyDomesticated) {
                            const domItems = compActor.items.filter(i => i.type === 'information' && i.name === zoologyDomName).map(i => i.id);
                            await compActor.deleteEmbeddedDocuments('Item', domItems);
                            await compActor.createEmbeddedDocuments('Item', [{ name: zoologyWildName, type: 'information' }]);
                        } else {
                            const wildItems = compActor.items.filter(i => i.type === 'information' && i.name === zoologyWildName).map(i => i.id);
                            await compActor.deleteEmbeddedDocuments('Item', wildItems);
                            await compActor.createEmbeddedDocuments('Item', [{ name: zoologyDomName, type: 'information' }]);
                        }

                        const loyaltyItem = compActor.items.find(i => i.type === 'skill' && i.name.startsWith(loyaltyName));
                        if (loyaltyItem) {
                            await compActor.updateEmbeddedDocuments('Item', [{
                                _id: loyaltyItem.id,
                                'system.talentValue.value': newLoyaltyValue,
                            }]);
                        }

                        this.render(true);
                    },
                },
                {
                    action: 'decline',
                    label: _loc("SHEET.Decline"),
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
            ui.notifications.warn(_loc("SHEET.NotPetOwner", { name: compActor.name }));
        }
        return true;
    }

    static async _openOwnerSheetAction(_ev, target) {
        const ownerActor = await CompanionHandler._resolveActor(target);
        if (!ownerActor) return;

        await ownerActor.sheet.render(true, { focus: true });

        setTimeout(() => {
            if (ownerActor.sheet.changeTab) {
                ownerActor.sheet.changeTab('companion', 'sheet');
            }
        }, 50);

        this.close();
    }

    static async _deleteAggregatedTestAction(_ev, target) {
        const itemId = target.dataset.itemId;
        const testItem = this.actor.items.get(itemId);
        if (!testItem) return;

        const confirmed = await foundry.applications.api.DialogV2.confirm({
            window: { title: _loc("SHEET.CancelProbe") },
            content: _loc("SHEET.CancelProbeText", { name: testItem.name }),
            modal: true,
        });

        if (!confirmed) return;

        await testItem.delete();
        ui.notifications.info(_loc("SHEET.ProbeCanceled", { name: testItem.name }));
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

    static async _openCompanionAction(ev, target) {
        await CompanionHandler.openCompanion(this, ev, target);
        this.close();
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
            ui.notifications.error(_loc("SHEET.MacroError", { name: item.name, error: err.message }));
            console.error(err);
        }
    }

    static async _trainCompanionAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const zoologyWildName = _loc("LocalizedIDs.zoologyWild");
        const abrichterName = _loc("SHEET.AnimalTrainer");
        const familiarName = _loc("SHEET.FamiliarTrait");

        const isFamiliar = compActor.items.some(i => i.type === 'trait' && i.name === familiarName);
        const isWild = !isFamiliar && compActor.items.some(i => i.type === 'information' && i.name === zoologyWildName);
        const hasAbrichter = this.actor.items.some(i => i.type === 'specialability' && i.name === abrichterName);

        if (isWild && !hasAbrichter) {
            ui.notifications.warn(_loc("SHEET.WildAnimalTrainerWarning"));
            return;
        }

        new CompanionTrainingApp(this.actor, compActor, { parentSheet: this }).render(true);
    }

    static async _companionRegenerationAction(ev, target) {
        await CompanionHandler.handleCompanionRegeneration(this, ev, target);
    }

    static async _toggleMountAction(_ev, target) {
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
                const reittierStr = _loc("TRAINING.Reittier") || "Reittier";
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
        const loyaltyName = _loc("LocalizedIDs.loyalty");
        const persuasionName = _loc("SHEET.Fast-Talk");
        const isLoyaltyRoll = skillItem.name === persuasionName || skillItem.name === loyaltyName;

        const testResult = await compActor.basicTest(setupData);
        if (!isLoyaltyRoll || !testResult?.result) return;

        const res = testResult.result;
        const desc = (res.description || '').toLowerCase();

        const isCrit = res.isCrit || res.successLevel >= 2 || desc.includes('kritisch') || desc.includes('spektakulär');
        const isBotch = res.isBotch || res.successLevel <= -2 || desc.includes('patzer') || desc.includes('schrecklich') || desc.includes('missgeschick');
        const isFail = res.successLevel < 0 || desc.includes('misserfolg') || desc.includes('fehlschlag') || isBotch;

        let loyaltyChanged = false;
        let newLoyalty = skillItem.system.talentValue.value;
        const chatMessages = [];

        if (isCrit || isBotch) {
            const roll = await new Roll('1d3+1').evaluate({ async: true });
            const change = roll.total;

            if (isCrit) {
                newLoyalty += change;
                chatMessages.push(_loc("SHEET.LoyaltyCritGain", { name: compActor.name, change }));
            } else {
                newLoyalty = Math.max(0, newLoyalty - change);
                chatMessages.push(_loc("SHEET.LoyaltyBotchLoss", { name: compActor.name, change }));
            }
            loyaltyChanged = true;
        }

        const familiarName = _loc("SHEET.FamiliarTrait");
        const zoologyWildName = _loc("LocalizedIDs.zoologyWild");

        const isFamiliar = compActor.items.some(i => i.type === 'trait' && i.name === familiarName);
        const isWild = !isFamiliar && compActor.items.some(i => i.type === 'information' && i.name === zoologyWildName);

        if (isWild && isFail) {
            const wildRoll = await new Roll('1d6').evaluate({ async: true });
            const d6 = wildRoll.total;
            let wildMsg = '';

            if (d6 === 1) wildMsg = _loc("SHEET.WildFail1", { name: compActor.name });
            else if (d6 === 2) wildMsg = _loc("SHEET.WildFail2", { name: compActor.name });
            else if (d6 >= 3 && d6 <= 5) {
                const krRoll = await new Roll('1d6').evaluate({ async: true });
                wildMsg = _loc("SHEET.WildFail35", { name: compActor.name, kr: krRoll.total });
            } else if (d6 === 6) {
                const krRoll = await new Roll('1d6').evaluate({ async: true });
                wildMsg = _loc("SHEET.WildFail6", { name: compActor.name, kr: krRoll.total });
            }

            chatMessages.push(wildMsg);
        }

        if (loyaltyChanged) {
            await skillItem.update({ 'system.talentValue.value': newLoyalty });
            setTimeout(() => this.render(false), 150);
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

        const familiars = [];
        const groupCompanions = [];
        const regularCompanions = [];

        if (sheetData.hasCompanions) {
            const familiarName = _loc("SHEET.FamiliarTrait");
            const homunculusName = _loc("SHEET.HomunculusCreation");
            const zoologyDom = _loc("LocalizedIDs.zoologyDomesticated");
            const hotbarCompUuid = actor.getFlag('dsa5', 'hotbarCompanion');
            const persuasionName = _loc("SHEET.Fast-Talk");
            const loyaltyName = _loc("LocalizedIDs.loyalty");
            const trickIndicator = "(Trick):";
            const trainingIndicator = _loc("SHEET.TrainingModuleIndicator");
            const trainingPrefix = _loc("SHEET.TrainingShortPrefix");
            const trickPrefix = _loc("SHEET.TrickShortPrefix");
            const reittierStr = _loc("TRAINING.Reittier") || "Reittier";
            const spellTypes = new Set(['spell', 'ritual', 'magictrick', 'magicalsign']);
            const prayerTypes = new Set(['liturgy', 'ceremony', 'blessing']);
            const persuasionSkill = actor.items.find(i => i.type === 'skill' && i.name === persuasionName) || null;
            const companions = (await Promise.all(companionUuids.map(cUuid => fromUuid(cUuid)))).filter(Boolean);
            const companionTestsByUuid = new Map(companions.map(comp => [comp.uuid, []]));
            const relevantTests = actor.items.filter(i => i.type === 'aggregatedTest' && (i.name.includes(trickIndicator) || i.name.includes(trainingIndicator)));

            for (const test of relevantTests) {
                for (const comp of companions) {
                    if (!test.name.includes(comp.name)) continue;

                    const isTraining = test.name.includes(trainingIndicator);
                    let shortName = test.name;

                    if (isTraining) {
                        const parts = test.name.split(trainingIndicator);
                        if (parts.length > 1) shortName = `${trainingPrefix} ${parts[1].trim()}`;
                    } else {
                        const parts = test.name.split(trickIndicator);
                        if (parts.length > 1) shortName = `${trickPrefix} ${parts[1].trim()}`;
                    }

                    companionTestsByUuid.get(comp.uuid).push({
                        item: test,
                        shortName,
                        isCompleted: (test.system.cummulatedQS?.value || 0) >= 10,
                        apCost: test.getFlag('dsa5', 'trainingApCost') || '?',
                        isTraining,
                    });
                }
            }

            for (const comp of companions) {
                const owners = comp.getFlag('dsa5', 'owners') || [];
                let isDomesticated = false;
                let isFamiliar = false;
                let isHomunculus = false;
                let hasSpells = false;
                let hasPrayers = false;
                let loyaltyItem = null;

                for (const item of comp.items) {
                    if (!isDomesticated && item.type === 'information' && item.name === zoologyDom) isDomesticated = true;
                    if (!isFamiliar && item.type === 'trait' && item.name === familiarName) isFamiliar = true;
                    if (!isHomunculus && item.type === 'trait' && item.name === homunculusName) isHomunculus = true;
                    if (!hasSpells && spellTypes.has(item.type)) hasSpells = true;
                    if (!hasPrayers && prayerTypes.has(item.type)) hasPrayers = true;
                    if (!loyaltyItem && item.type === 'skill' && item.name.startsWith(loyaltyName)) loyaltyItem = item;
                }

                if (isFamiliar || isHomunculus) hasSpells = true;

                const loyaltyData = isHomunculus
                    ? (persuasionSkill ? {
                        id: persuasionSkill.id,
                        actorUuid: actor.uuid,
                        value: persuasionSkill.system.talentValue.value,
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

                const rawEffects = comp.effects ? (typeof comp.effects.values === 'function' ? Array.from(comp.effects.values()) : comp.effects) : [];
                const activeEffects = rawEffects.map(e => {
                    const img = e.img || e.icon || (e.texture ? e.texture.src : null) || 'icons/svg/aura.svg';
                    let name = e.name || e.label;
                    if (!name && e.statuses) name = (typeof e.statuses.size !== 'undefined') ? Array.from(e.statuses)[0] : e.statuses[0];

                    return {
                        id: e.id || e._id,
                        img,
                        name: name || _loc('SHEET.Effect'),
                        value: e.flags?.dsa5?.value,
                        disabled: e.disabled === true,
                    };
                }).filter(e => e.disabled === false);

                const companionTests = companionTestsByUuid.get(comp.uuid);
                companionTests.sort((a, b) => {
                    if (a.isTraining && !b.isTraining) return -1;
                    if (!a.isTraining && b.isTraining) return 1;
                    return a.shortName.localeCompare(b.shortName);
                });

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

                let isMountPossible = false;
                const currentSpecies = comp.getFlag('dsa5', 'species');
                if (!currentSpecies) {
                    isMountPossible = true;
                } else {
                    for (const group of Object.values(CompanionHandler.COMPANION_SPECIES_DATA)) {
                        if (group[currentSpecies]?.trainingModules) {
                            if (group[currentSpecies].trainingModules.includes(reittierStr)) isMountPossible = true;
                            break;
                        }
                    }
                }

                comp.prepareCompanion = {
                    hasSpells,
                    hasPrayers,
                    hasNone: !hasSpells && !hasPrayers,
                    containerClass: (hasSpells && hasPrayers) ? 'third' : 'fourty',
                    lepClass: (hasSpells || hasPrayers) ? '' : 'soloBar',
                    loyalty: loyaltyData,
                    effects: activeEffects,
                    natureIcon: isDomesticated ? 'fa-house-chimney' : 'fa-mountain-sun',
                    natureTooltip: isDomesticated ? 'SHEET.domesticatedAnimal' : 'SHEET.wildAnimal',
                    otherNatureIcon: isDomesticated ? 'fa-mountain-sun' : 'fa-house-chimney',
                    otherNatureTooltip: isDomesticated ? 'SHEET.wildAnimal' : 'SHEET.domesticatedAnimal',
                    isDomesticated,
                    isMountPossible,
                    isMountActive: actor.system.horse?.actorId === comp.id && actor.system.horse?.isRiding === 1,
                    isHotbarControlled: comp.uuid === hotbarCompUuid,
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

                if (isFamiliar || isHomunculus) familiars.push(comp);
                else if (owners.length > 1) groupCompanions.push(comp);
                else regularCompanions.push(comp);
            }
        }

        sheetData.companionSections = [
            { label: 'SHEET.Familiar', contents: familiars },
            { label: 'SHEET.AnimalCompanion', contents: regularCompanions },
            { label: 'SHEET.GroupCompanion', contents: groupCompanions },
            { label: 'SHEET.SummonedCreatures', contents: [] },
        ];

    }

    static async prepareOwnersData(actor, sheetData) {
        const ownerUuids = actor.getFlag('dsa5', 'owners') || [];
        sheetData.petOwners = (await Promise.all(ownerUuids.map(ownerUuid => fromUuid(ownerUuid)))).filter(Boolean);
    }

    static activateListeners(sheet, html, actor) {

        // ---  Hover-Effekt ---
        html.querySelectorAll('.nature-toggle-container').forEach(el => {
            el.addEventListener('mouseenter', () => {
                el.querySelector('.toggle-nature-arrow').style.opacity = '1';
            });
            el.addEventListener('mouseleave', () => {
                el.querySelector('.toggle-nature-arrow').style.opacity = '0';
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

