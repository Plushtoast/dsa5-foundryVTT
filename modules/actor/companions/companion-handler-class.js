import Riding from '../../system/automation/riding.js';
import OnUseEffect from '../../system/automation/onUseEffects.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import CompanionConfig from './companion-config.js';
import { CompanionTrainingApp } from './companion-training-app.js';
import { CompanionSkillSelectionApp } from './companion-skill-selection-app.js';
import CompanionHotbar from './companion-hotbar.js';
import { RollDialogBuilder } from '../../dialog/dialog-builder.js';
import { Trade } from '../trade.js';
import { CONJURATION_CONTROL_MODES } from '../../config/conjuration-constants.js';
import { SummoningFlow } from '../../wizards/summoning/summoning_flow.js';

const { SERVICES, REQUESTS } = CONJURATION_CONTROL_MODES;

export default class CompanionHandler {
    static COMPANION_TAB_ID = 'companion';

    /**
     * Link a summoned creature to its summoner on the companion tab.
     * Skips animal loyalty / Begleiter trait handling from setCompanion.
     * @param {Actor} summoner
     * @param {Actor} summoned
     * @param {{ controlMode?: string, conjurationType?: number|string, requestModifier?: number }} [options]
     */
    static async linkSummonedCompanion(summoner, summoned, options = {}) {
        if (!summoner || !summoned) return;

        const controlMode = options.controlMode || summoned.getFlag('dsa5', 'conjurationControlMode') || SERVICES;
        const conjurationType = options.conjurationType ?? summoned.getFlag('dsa5', 'conjurationType');
        const requestModifier = options.requestModifier ?? summoned.getFlag('dsa5', 'requestModifier');

        if (!summoned.prototypeToken.actorLink) {
            await summoned.update({ 'prototypeToken.actorLink': true }, { render: false });
        }

        const flagUpdate = {
            'flags.dsa5.summonedCompanion': true,
            'flags.dsa5.conjurationControlMode': controlMode,
        };
        if (conjurationType !== undefined && conjurationType !== null) {
            flagUpdate['flags.dsa5.conjurationType'] = Number(conjurationType);
        }
        if (controlMode === REQUESTS) {
            flagUpdate['flags.dsa5.requestModifier'] = Number(requestModifier ?? -2);
        }

        const owners = [...(summoned.system.companionData?.owners || [])];
        if (!owners.includes(summoner.uuid)) owners.push(summoner.uuid);

        await summoned.update({
            ...flagUpdate,
            'system.companionData.owners': owners,
        }, { render: false });

        if (!summoner.system.companions?.[summoned.id]) {
            await summoner.update({ [`system.companions.${summoned.id}`]: { uuid: summoned.uuid } }, { render: false });
        }
    }

    /**
     * Remove summoner ↔ summoned companion links and clear summoned flags when fully unlinked.
     * @param {Actor} summoned
     * @param {Actor|string} [owner] Optional owner actor or uuid; if omitted, unlink from all owners.
     */
    static async unlinkSummonedCompanion(summoned, owner) {
        if (!summoned) return;

        const ownerUuid = typeof owner === 'string' ? owner : owner?.uuid;
        const owners = [...(summoned.system.companionData?.owners || [])];
        const ownerUuids = ownerUuid ? [ownerUuid] : owners;

        for (const uuid of ownerUuids) {
            const ownerActor = await fromUuid(uuid);
            if (ownerActor?.system?.companions?.[summoned.id]) {
                await ownerActor.update({ [`system.companions.${summoned.id}`]: _del }, { render: false });
            }
        }

        if (!game.actors.get(summoned.id)) return;

        const remainingOwners = ownerUuid ? owners.filter(o => o !== ownerUuid) : [];
        const updates = { 'system.companionData.owners': remainingOwners };
        if (remainingOwners.length === 0) {
            updates['flags.dsa5.summonedCompanion'] = _del;
            updates['flags.dsa5.conjurationControlMode'] = _del;
            updates['flags.dsa5.conjurationType'] = _del;
            updates['flags.dsa5.requestModifier'] = _del;
        }
        await summoned.update(updates, { render: false });
    }

    /**
     * Services/requests counter exhausted: unlink from owners and notify.
     * @param {Actor} summoned
     */
    static async onSummonCounterExhausted(summoned) {
        if (!summoned?.getFlag('dsa5', 'summonedCompanion')) return;
        const controlMode = summoned.getFlag('dsa5', 'conjurationControlMode') || SERVICES;
        if (![SERVICES, REQUESTS].includes(controlMode)) return;

        const msgKey = controlMode === REQUESTS ? 'COMPANIONS.Request.Exhausted' : 'COMPANIONS.Service.Exhausted';
        ui.notifications.info(_loc(msgKey, { name: summoned.name }));
        await CompanionHandler.unlinkSummonedCompanion(summoned);
    }

    /**
     * The active effect carrying the Dienste/Bitten counter of a summoned companion.
     * @param {Actor} summoned
     * @returns {ActiveEffect|null}
     */
    static serviceCounterEffect(summoned) {
        return summoned?.effects.find(e => e.statuses.has('services')) ?? null;
    }

    /**
     * Write an absolute services/requests value. Reaching 0 deletes the counter and unlinks the summon.
     * @param {Actor} summoned
     * @param {number} value
     * @returns {Promise<number|null>} New counter value, or null if the actor has no counter.
     */
    static async setServiceCounter(summoned, value) {
        const effect = CompanionHandler.serviceCounterEffect(summoned);
        if (!effect) return null;

        const next = Number(value);
        if (!Number.isFinite(next) || next <= 0) {
            // The hook on deleteActiveEffect would exhaust a second time without this flag.
            await effect.delete({ fromServiceSpend: true });
            await CompanionHandler.onSummonCounterExhausted(summoned);
            return 0;
        }

        const condition = effect.system.condition || {};
        const auto = Number(condition.auto || 0);
        const max = Number(condition.max ?? 500);
        await effect.update({
            'system.condition.manual': next,
            'system.condition.value': Math.max(0, Math.min(max, next + auto)),
        });
        return next;
    }

    /**
     * Decrement the services/requests AE on a summoned companion. Deletes + exhausts at 0.
     * @param {Actor} summoned
     * @param {number} [amount]
     * @returns {Promise<number|null>} Remaining counter value, or null if no effect.
     */
    static async spendServiceCounter(summoned, amount = 1) {
        const effect = CompanionHandler.serviceCounterEffect(summoned);
        if (!effect) return null;

        const condition = effect.system.condition || {};
        const current = Number(condition.manual ?? condition.value ?? 0);
        return CompanionHandler.setServiceCounter(summoned, current - amount);
    }

    static prepareTabVisibility(actor, tabs) {
        if (actor.type === 'creature' && !actor.system.companionData?.owners?.length) {
            delete tabs[this.COMPANION_TAB_ID];
        }
        return tabs;
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
        element.querySelectorAll('.companion-skill-advances').forEach(el => {
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

        element.querySelectorAll('.companion-service-advances').forEach(el => {
            el.addEventListener('change', async ev => {
                ev.preventDefault();
                const input = ev.currentTarget;
                const compActor = await fromUuid(input.dataset.actorUuid);
                await CompanionHandler.setServiceCounter(compActor, Number(input.value));
            });
        });

        element.querySelectorAll('.companion-service-step').forEach(el => {
            el.addEventListener('click', async ev => {
                ev.preventDefault();
                const button = ev.currentTarget;
                const input = button.parentElement.querySelector('.companion-service-advances');
                const compActor = await fromUuid(button.dataset.actorUuid);
                await CompanionHandler.setServiceCounter(compActor, Number(input.value) + Number(button.dataset.step));
            });
        });

        CompanionHandler.#attachConjurationFavoriteHoverMenus(sheet, element);
    }

    /** Dynamically inject hovermenu X on favorite slots (same pattern as special abilities). */
    static #attachConjurationFavoriteHoverMenus(sheet, element) {
        const onDelete = (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            const favoriteId = ev.currentTarget.closest('.conjuration-favorite-slot')?.dataset.favoriteId;
            CompanionHandler.removeConjurationFavorite(sheet.actor, favoriteId);
        };

        element.querySelectorAll('.conjuration-favorite-slot').forEach((slot) => {
            slot.addEventListener('mouseenter', (ev) => {
                if (ev.currentTarget.getElementsByClassName('hovermenu').length) return;
                const div = document.createElement('div');
                div.classList.add('hovermenu');
                const del = document.createElement('i');
                del.classList.add('fas', 'fa-times');
                del.dataset.tooltip = 'COMPANIONS.Favorites.remove';
                del.addEventListener('click', onDelete, false);
                div.appendChild(del);
                ev.currentTarget.appendChild(div);
            });
            slot.addEventListener('mouseleave', (ev) => {
                ev.currentTarget.querySelectorAll('.hovermenu').forEach((menu) => menu.remove());
            });
        });
    }

    static attachOwnerPartListeners(sheet, element) {}

    static get COMPANION_SPECIES_DATA() {
        return CompanionConfig.companionSpeciesData;
    }

    static async setCompanion(sheet, uuid) {
        await CompanionConfig.ensureLoaded();
        const droppedActor = await fromUuid(uuid);
        if (!droppedActor) return false;

        if (!droppedActor.prototypeToken.actorLink) {
            const fix = await foundry.applications.api.DialogV2.confirm({
                window: { title: "COMPANIONS.Notification.TokenLinkWarning" },
                content: _loc("COMPANIONS.Notification.TokenLinkExplanation", { name: droppedActor.name }),
                yes: { label: _loc("COMPANIONS.Notification.TokenLinkEnableBtn"), icon: 'fas fa-link' },
                no: { label: _loc('cancel'), icon: 'fas fa-times' },
                rejectClose: false,
            });
            if (!fix) return false;
            await droppedActor.update({ 'prototypeToken.actorLink': true });
        }

        const familiarName = _loc("LocalizedIDs.familiar");
        const isFamiliar = droppedActor.items.some(i => i.type === 'trait' && i.name === familiarName);
        const owners = [...droppedActor.system.companionData.owners];

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

        if (detectedSpecies && !droppedActor.system.companionData.species) {
            await droppedActor.update({ 'system.companionData.species': detectedSpecies }, { render: false });
        }

        if (!sheet.actor.system.companions[droppedActor.id]) {
            await sheet.actor.update({ [`system.companions.${droppedActor.id}`]: { uuid } }, { render: false });
        }

        if (!owners.includes(sheet.actor.uuid)) {
            owners.push(sheet.actor.uuid);
            await droppedActor.update({ 'system.companionData.owners': owners }, { render: false });
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

        return true;
    }

    static getSheetActions() {
        return {
            openLinkedSheet: this._openLinkedSheetAction,
            toggleNatureOptions: this._toggleNatureOptionsAction,
        };
    }

    static getOwnerSheetActions() {
        return {
            changeCompanionNature: this._changeCompanionNatureAction,
            companionEffect: { handler: this._companionEffectAction, buttons: [0, 2] },
            memberContextMenu: this._companionContextMenuAction,
            memberCardLink: this._companionCardLinkAction,
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
            startSummoning: this._startSummoningAction,
            conjurationFavorite: { handler: this._conjurationFavoriteAction, buttons: [0, 2] },
        };
    }

    static async _startSummoningAction() {
        await SummoningFlow.open(this.actor);
    }

    /**
     * Cache a creature as summoning favorite (uuid/name/img) without loading it on sheet prep.
     * @param {Actor} owner
     * @param {Actor} creature
     */
    static async addConjurationFavorite(owner, creature) {
        if (!owner || !creature) return false;
        if (creature.type !== 'creature') {
            ui.notifications.warn(_loc('COMPANIONS.Favorites.notCreature'));
            return false;
        }

        const favorites = owner.system.conjurationFavorites || {};
        if (Object.values(favorites).some((fav) => fav.uuid === creature.uuid)) {
            ui.notifications.info(_loc('COMPANIONS.Favorites.already', { name: creature.name }));
            return false;
        }

        const id = foundry.utils.randomID();
        await owner.update({
            [`system.conjurationFavorites.${id}`]: {
                uuid: creature.uuid,
                name: creature.name,
                img: creature.img,
            },
        });
        ui.notifications.info(_loc('COMPANIONS.Favorites.added', { name: creature.name }));
        return true;
    }

    /**
     * @param {Actor} owner
     * @param {string} favoriteId
     */
    static async removeConjurationFavorite(owner, favoriteId) {
        if (!owner || !favoriteId) return false;
        if (!(favoriteId in (owner.system.conjurationFavorites || {}))) return false;
        await owner.update({ [`system.conjurationFavorites.${favoriteId}`]: _del });
        return true;
    }

    /** @param {Actor} owner @returns {Array<{id: string, uuid: string, name: string, img: string}>} */
    static listConjurationFavorites(owner) {
        const favorites = owner?.system?.conjurationFavorites || {};
        return Object.entries(favorites)
            .filter(([, fav]) => fav?.uuid)
            .map(([id, fav]) => ({ id, uuid: fav.uuid, name: fav.name, img: fav.img }));
    }

    /**
     * Left-click opens the favorite creature sheet; right-click starts summoning with it prefilled.
     * @param {PointerEvent} ev
     * @param {HTMLElement} target
     */
    static async _conjurationFavoriteAction(ev, target) {
        const uuid = target.dataset.uuid;
        if (!uuid) return;
        const creature = await fromUuid(uuid);
        if (!creature) {
            ui.notifications.warn('DSAError.notFound', { format: { category: 'Actor', name: uuid }, localize: true });
            return;
        }

        if (ev.button === 2) {
            await SummoningFlow.open(this.actor, null, { creature });
            return;
        }

        creature.sheet?.render(true);
    }

    static _toggleNatureOptionsAction(_ev, target) {
        const container = target.closest('.nature-toggle-container');
        const optionsDiv = container?.querySelector('.nature-options');
        if (!container || !optionsDiv) return;

        optionsDiv.hidden = !optionsDiv.hidden;
        target.classList.toggle('fa-chevron-right');
        target.classList.toggle('fa-chevron-left');
    }

    static async _changeCompanionNatureAction(_ev, target) {
        const container = target.closest('.nature-toggle-container');
        const compActor = await CompanionHandler._resolveActor(container);
        if (!container || !compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const isCurrentlyDomesticated = container.dataset.isDomesticated === 'true';
        const newLoyaltyValue = isCurrentlyDomesticated ? 0 : 4;
        const currentNatureName = _loc(isCurrentlyDomesticated ? 'LocalizedIDs.zoologyDomesticated' : 'LocalizedIDs.zoologyWild');
        const nextNatureName = _loc(isCurrentlyDomesticated ? 'LocalizedIDs.zoologyWild' : 'LocalizedIDs.zoologyDomesticated');

        new foundry.applications.api.DialogV2({
            window: {
                title: "COMPANIONS.Loyalty.changeTitle",
            },
            content: `<p>${_loc("COMPANIONS.Loyalty.changeText", { name: compActor.name })}</p>`,
            buttons: [
                {
                    action: 'accept',
                    label: 'ok',
                    icon: 'fas fa-check',
                    default: true,
                    callback: async () => {
                        const currentNatureItems = compActor.items
                            .filter(i => i.type === 'information' && i.name === currentNatureName)
                            .map(i => i.id);
                        await compActor.deleteEmbeddedDocuments('Item', currentNatureItems, { render: false });
                        await compActor.createEmbeddedDocuments('Item', [{ name: nextNatureName, type: 'information' }], { render: false });

                        const loyaltyItem = compActor.items.find(i => i.type === 'skill' && i.name.startsWith(_loc('LocalizedIDs.loyalty')));
                        if (loyaltyItem) {
                            await compActor.updateEmbeddedDocuments('Item', [{
                                _id: loyaltyItem.id,
                                'system.talentValue.value': newLoyaltyValue,
                            }]);
                        } else {
                            compActor.sheet?.render();
                        }
                    },
                },
                {
                    action: 'decline',
                    label: 'cancel',
                    icon: 'fas fa-times',
                    callback: () => {
                        container.querySelector('.nature-options').hidden = true;
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

        ev.button === 2 ? await effect.delete() : effect.sheet.render(true);
    }

    static async _resolveActor(target, datasetKey = 'uuid') {
        const uuid = target.dataset[datasetKey] || target.closest(`[data-${datasetKey.replace(/[A-Z]/g, match => `-${match.toLowerCase()}`)}]`)?.dataset[datasetKey];
        return uuid ? fromUuid(uuid) : null;
    }

    static _warnIfNotPetOwner(compActor) {
        if (compActor?.isOwner) return false;
        ui.notifications.warn(_loc("COMPANIONS.Notification.NotPetOwner", { name: compActor?.name }));
        return true;
    }

    static async _openLinkedSheetAction(_ev, target) {
        const actor = await CompanionHandler._resolveActor(target);
        if (!actor) return;

        await actor.sheet.render(true, { focus: true, tab: { sheet: target.dataset.tab } });
        this.close();
    }

    static async _companionCardLinkAction(_ev, target) {
        const actor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!actor) return;
        actor.sheet.render(true, { focus: true });
    }

    static async _companionContextMenuAction(_ev, target) {
        const card = target.closest('.companion-header-ui');
        const compActor = await CompanionHandler._resolveActor(card);
        if (!compActor) return;

        const app = this;
        const menu = new foundry.applications.ux.ContextMenu(this.element, '', [
            {
                label: _loc('COMPANIONS.TradeWithCompanion'),
                icon: '<i class="fas fa-hands-holding"></i>',
                onClick: () => CompanionHandler._tradeWithCompanionAction.call(app, _ev, card),
            },
            {
                label: _loc('SHEET.DeleteItem'),
                icon: '<i class="fas fa-trash"></i>',
                onClick: () => CompanionHandler._removeCompanionAction.call(app, _ev, card),
            },
        ], { jQuery: false, fixed: true, eventName: 'none' });
        ui.context?.close();
        await menu.render(target, { animate: true });
        ui.context = menu;
    }

    static async _removeCompanionAction(_ev, target) {
        const removedActor = await CompanionHandler._resolveActor(target);
        const removeId = removedActor?.id;
        if (removeId) {
            await this.actor.update({ [`system.companions.${removeId}`]: _del }, { render: false });
        }

        if (removedActor) {
            const owners = removedActor.system.companionData.owners.filter(o => o !== this.actor.uuid);

            if (owners.length === 0) {
                const companionTraitName = _loc("LocalizedIDs.companion");
                const companionTraits = removedActor.items.filter(i => i.type === 'trait' && i.name === companionTraitName).map(i => i.id);

                await removedActor.update({ 'system.companionData.owners': owners }, { render: false });
                if (companionTraits.length > 0) {
                    await removedActor.deleteEmbeddedDocuments("Item", companionTraits);
                }
            } else {
                await removedActor.update({ 'system.companionData.owners': owners });
            }
        }

        this.render({ force: true });
    }

    static async _tradeWithCompanionAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target);
        if (!compActor) return;

        const sourceId = RollDialogBuilder.buildSpeaker(this.actor, this.actor.token?.id);
        const targetId = RollDialogBuilder.buildSpeaker(compActor, compActor.token?.id);
        const app = new Trade(sourceId, targetId);
        app.startTrade();
    }

    static async _openSkillSelectionAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        new CompanionSkillSelectionApp(this.actor, compActor, { parentSheet: this }).render(true);
    }

    static async _executeCompanionSkillAction(ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        const itemId = target.dataset.itemId;
        if (!compActor || !itemId) return;

        const item = compActor.items.get(itemId);
        if (!item) return;

        const tokenId = compActor.getActiveTokens()[0]?.id || null;
        if (await CompanionHotbar.executeHotbarRoll(compActor, item, tokenId)) return;

        const onUse = new OnUseEffect(item);
        await onUse.executeOnUseEffect(OnUseEffect.buildExecutionOptions(ev));
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

    static async _companionRegenerationAction(_ev, target) {
        const actor = await CompanionHandler._resolveActor(target);
        if (!actor || !actor.isOwner) {
            ui.notifications.warn(_loc("COMPANIONS.Notification.NoPermissionRegeneration"));
            return;
        }
        const setup = await actor.setupRegeneration("regenerate", {});
        if (setup) await actor.basicTest(setup);
    }

    static async _toggleMountAction(_ev, target) {
        const compActor = await CompanionHandler._resolveActor(target.closest('.companion-header-ui'));
        if (!compActor || CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const isCurrentlyRiding = this.actor.system.horse?.actorId === compActor.id && this.actor.system.horse?.isRiding === 1;

        if (isCurrentlyRiding) await Riding.clearMount(this.actor);
        else await Riding.setHorse(this.actor, compActor);
    }

    static async _toggleHotbarControlAction(_ev, target) {
        const card = target.closest('.companion-header-ui');
        const compActor = await CompanionHandler._resolveActor(card);
        if (!compActor) return;
        if (CompanionHandler._warnIfNotPetOwner(compActor)) return;

        const compId = card.dataset.uuid && (await fromUuid(card.dataset.uuid))?.id;
        if (!compId) return;

        const entry = this.actor.system.companions[compId];
        if (!entry) return;

        const updates = { [`system.companions.${compId}.hotbar`]: !entry.hotbar };
        const oldHotbarId = Object.entries(this.actor.system.companions).find(([id, c]) => c.hotbar && id !== compId)?.[0];
        if (oldHotbarId) updates[`system.companions.${oldHotbarId}.hotbar`] = false;

        await this.actor.update(updates);
    }

    static async _finishTrickTrainingAction(_ev, target) {
        await CompanionTrainingApp.finishTraining(this.actor, target);
    }

    static _editAggregatedTestAction(_ev, target) {
        const item = this.actor.items.get(target.dataset.itemId);
        if (item) item.sheet.render(true);
    }

    static async _companionSkillSelectAction(_ev, target) {
        const card = target.closest('.companion-header-ui');
        const summonedActor = card ? await CompanionHandler._resolveActor(card) : null;
        const rollerActor = await CompanionHandler._resolveActor(target, 'actorUuid');
        const itemId = target.closest('.item')?.dataset.itemId;
        if (!rollerActor || !itemId || CompanionHandler._warnIfNotPetOwner(rollerActor)) return;

        const skillItem = rollerActor.items.get(itemId);
        if (!skillItem) return;

        const isSummonedRequests = summonedActor?.getFlag('dsa5', 'summonedCompanion')
            && summonedActor.getFlag('dsa5', 'conjurationControlMode') === REQUESTS;
        const isFastTalk = skillItem.name === _loc('LocalizedIDs.Fast-Talk');
        const rollOptions = {};
        if (isSummonedRequests && isFastTalk) {
            const requestModifier = Number(summonedActor.getFlag('dsa5', 'requestModifier') ?? -2);
            rollOptions.moreModifiers = [{
                name: _loc('PLAYER.requests'),
                value: requestModifier,
                selected: true,
            }];
        }

        const rollerTokenId = rollerActor.getActiveTokens()[0]?.id || null;
        const setupData = await rollerActor.setupSkill(skillItem, rollOptions, rollerTokenId);
        const isLoyaltyRoll = isFastTalk || skillItem.name === _loc('LocalizedIDs.loyalty');

        const rolled = await rollerActor.basicTest(setupData);
        if (!rolled) return;
        const { result } = rolled;

        if (isSummonedRequests && isFastTalk) {
            const remaining = await CompanionHandler.spendServiceCounter(summonedActor);
            if (remaining !== null && remaining > 0) {
                ui.notifications.info(_loc('COMPANIONS.Request.Spent', {
                    name: summonedActor.name,
                    remaining,
                }));
            }
        }

        if (!isLoyaltyRoll || !result) return;
        if (isSummonedRequests) return;

        const chatMessages = [];

        if (result.successLevel >= 2 || result.successLevel <= -2) {
            const change = (await new Roll('1d3+1').evaluate()).total;

            if (result.successLevel >= 2) {
                await skillItem.update({ 'system.talentValue.value': skillItem.system.talentValue.value + change });
                chatMessages.push(_loc("COMPANIONS.Loyalty.CritGain", { name: rollerActor.name, change }));
            } else {
                await skillItem.update({ 'system.talentValue.value': Math.max(0, skillItem.system.talentValue.value - change) });
                chatMessages.push(_loc("COMPANIONS.Loyalty.BotchLoss", { name: rollerActor.name, change }));
            }
        }

        const isFamiliar = rollerActor.items.some(i => i.type === 'trait' && i.name === _loc("LocalizedIDs.familiar"));
        const isWild = !isFamiliar && rollerActor.items.some(i => i.type === 'information' && i.name === _loc("LocalizedIDs.zoologyWild"));

        if (isWild && result.successLevel < 0) {
            const d6 = (await new Roll('1d6').evaluate()).total;

            if (d6 <= 2) {
                chatMessages.push(_loc(`COMPANIONS.WildFail.${d6}`, { name: rollerActor.name }));
            } else {
                const kr = (await new Roll('1d6').evaluate()).total;
                chatMessages.push(_loc(`COMPANIONS.WildFail.${d6 === 6 ? '6' : '35'}`, { name: rollerActor.name, kr }));
            }
        }

        if (chatMessages.length > 0) {
            ChatMessage.create({
                speaker: ChatMessage.getSpeaker({ actor: rollerActor }),
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


    static async prepareCompanionsData(actor, sheetData) {
        const companionUuids = Object.values(actor.system.companions).map(c => c.uuid);
        sheetData.hasCompanions = companionUuids.length > 0;

        if (sheetData.hasCompanions) await CompanionConfig.ensureLoaded();

        const sections = { familiar: [], group: [], regular: [], summoned: [] };

        if (sheetData.hasCompanions) {
            const trickIndicator = "(Trick):";
            const trainingIndicator = _loc("COMPANIONS.Training.ModuleIndicator");
            const ctx = {
                familiarName: _loc("LocalizedIDs.familiar"),
                homunculusName: _loc("COMPANIONS.HomunculusCreation"),
                zoologyDom: _loc("LocalizedIDs.zoologyDomesticated"),
                hotbarCompUuid: Object.values(actor.system.companions).find(c => c.hotbar)?.uuid,
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

        sheetData.canSummon = SummoningFlow.hasConjurationSkills(actor);
        sheetData.conjurationFavorites = CompanionHandler.listConjurationFavorites(actor);
        sheetData.companionSections = [
            { label: 'familiar', contents: sections.familiar, visible: sections.familiar.length > 0 },
            { label: 'SHEET.AnimalCompanion', contents: sections.regular, visible: sections.regular.length > 0 },
            { label: 'COMPANIONS.Group.Companion', contents: sections.group, visible: sections.group.length > 0 },
            {
                label: 'COMPANIONS.Group.SummonedCreatures',
                contents: sections.summoned,
                showSummoningTools: sheetData.canSummon,
                visible: sheetData.canSummon || sections.summoned.length > 0,
            },
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

        const isSummoned = !!comp.getFlag('dsa5', 'summonedCompanion');
        const controlMode = isSummoned
            ? (comp.getFlag('dsa5', 'conjurationControlMode') || SERVICES)
            : null;
        const requestModifier = isSummoned && controlMode === REQUESTS
            ? Number(comp.getFlag('dsa5', 'requestModifier') ?? -2)
            : null;

        const petLoyaltyData = loyaltyItem ? {
            id: loyaltyItem.id,
            actorUuid: comp.uuid,
            value: loyaltyItem.system.talentValue.value,
            char1: loyaltyItem.system.characteristic1.value,
            char2: loyaltyItem.system.characteristic2.value,
            char3: loyaltyItem.system.characteristic3.value,
        } : null;

        const ownerPersuasionData = ctx.persuasionSkill ? {
            id: ctx.persuasionSkill.id,
            actorUuid: actor.uuid,
            value: ctx.persuasionSkill.system.talentValue.value,
            char1: 'mu',
            char2: 'in',
            char3: 'ch',
        } : null;

        let loyaltyData = isHomunculus ? ownerPersuasionData : petLoyaltyData;
        let serviceCounter = null;
        let showLoyalty = !isSummoned && !!loyaltyData;
        let showRequests = false;
        let showServiceCounter = false;

        // Rules explanation for the Dienste / Bitten / Loyalität row, shown as an info tooltip.
        const controlModeHint = isSummoned ? _loc(`CONJURATION.controlMode.${controlMode}Hint`) : null;

        if (isSummoned) {
            const servicesEffect = CompanionHandler.serviceCounterEffect(comp);
            const counterFor = (labelKey) => servicesEffect ? {
                value: Number(servicesEffect.system.condition?.value ?? servicesEffect.system.condition?.manual ?? 0),
                effectId: servicesEffect.id,
                label: labelKey,
                hint: controlModeHint,
            } : null;

            if (controlMode === SERVICES) {
                loyaltyData = null;
                showLoyalty = false;
                serviceCounter = counterFor('PLAYER.services');
                showServiceCounter = !!serviceCounter;
            } else if (controlMode === REQUESTS) {
                loyaltyData = ownerPersuasionData;
                showRequests = !!loyaltyData;
                showLoyalty = false;
                serviceCounter = counterFor('PLAYER.requests');
                showServiceCounter = !!serviceCounter;
            } else {
                loyaltyData = petLoyaltyData;
                showLoyalty = !!loyaltyData;
            }
        }

        const activeEffects = Array.from(comp.effects).filter(e => !e.disabled).map(e => ({
            id: e.id,
            img: e.img || 'icons/svg/aura.svg',
            name: e.name || _loc('SHEET.Effect'),
            value: e.system?.condition?.value,
        }));

        const companionTests = companionTestsByUuid.get(comp.uuid);
        companionTests.sort((a, b) =>
            a.isTraining !== b.isTraining ? (a.isTraining ? -1 : 1) : a.shortName.localeCompare(b.shortName)
        );

        const savedHotbar = comp.system.companionData.skillHotbar;
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

        const currentSpecies = comp.system.companionData.species;
        const isMountPossible = !currentSpecies
            || !!Object.values(CompanionHandler.COMPANION_SPECIES_DATA).find(
                group => group[currentSpecies]?.trainingModules?.includes(ctx.reittierStr)
            );

        const owners = comp.system.companionData.owners;

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
            isSummoned,
            controlMode,
            controlModeHint,
            requestModifier,
            serviceCounter,
            showServiceCounter,
            showRequests,
            showLoyalty,
            showNatureIcon: !isFamiliar && !isHomunculus && !isSummoned,
            isTrainable: !isHomunculus && !isSummoned,
            hasEffects: activeEffects.length > 0,
            hotbarItems,
            hotbarRow1: hotbarItems.slice(0, 7),
            hotbarRow2: hotbarItems.slice(7, 14),
            trainingTests: companionTests,
        };

        if (isFamiliar || isHomunculus) return 'familiar';
        if (isSummoned) return 'summoned';
        if (owners.length > 1) return 'group';
        return 'regular';
    }

    static async prepareOwnersData(actor, sheetData) {
        const ownerUuids = actor.system.companionData.owners;
        sheetData.petOwners = (await Promise.all(ownerUuids.map(ownerUuid => fromUuid(ownerUuid)))).filter(Boolean);
    }
}
