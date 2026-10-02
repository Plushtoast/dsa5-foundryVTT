import DSA5_Utility from "../system/helpers/utility-dsa5.js";
import { ChatMessageState } from "./chatmessage_state.js";

import TrapAutomation from "../system/automation/trap.js";
import TrapFlow from "../system/automation/trap-flow.js";
import GroupCheck from "../system/rolls/group-check.js";
import RollRequestService from "../system/queries/roll-request.js";
import QueryOrchestrator from "../system/queries/query-orchestrator.js";
import SpecialabilityRulesDSA5 from "../system/rules/specialability-rules-dsa5.js";
import ChatCardBump from "../system/sidebar/chat-card-bump.js";
import { DICE_CONSTANTS } from "../config/dice-constants.js";

const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor } = foundry.applications.ux;

export class TrapState extends ChatMessageState {
    static ROLL_OUTCOMES = new Set(['success', 'critical', 'failure', 'botch']);
    static TEMPLATE = 'systems/dsa5/templates/chat/trap/announce.hbs';

    constructor(behavior, token, region, name) {
        super();
        this.behavior = behavior;
        this.token = token;
        this.region = region;
        this.name = name;
    }

    /**
     * Scene token actor, forcing Foundry's lazy ActorDelta when `token.actor` is null.
     */
    static actorFromToken(token) {
        return DSA5_Utility.actorFromToken(token);
    }

    static canDisarm(actor) {
        if (!actor) return false;
        return SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.disarmTraps');
    }

    /** Stealth value, plus +1 ease for the Search application. */
    static perceptionModifier(stealth, mode) {
        const value = Number(stealth) || 0;
        return mode === 'search' ? value + 1 : value;
    }

    static regionVisibilityKey(visibility) {
        const value = Number(visibility);
        return Object.entries(CONST.REGION_VISIBILITY).find(([, v]) => v === value)?.[0];
    }

    static async #openSingleton(id, config) {
        const existing = foundry.applications.instances.get(id);
        if (existing) await existing.close({ animate: false });
        return new foundry.applications.api.DialogV2({ id, ...config }).render(true);
    }

    async #templateData(trapData = this.message?.flags?.dsa5?.trapData) {
        const stored = trapData || {};
        const defenses = stored.defenses || this.behavior?.system?.defenses || {};
        const damages = stored.damages || this.behavior?.system?.damages || {};
        const outcomes = (stored.outcomes || []).map((entry) => {
            const display = QueryOrchestrator.outcomeDisplay({ status: entry.status });
            return {
                ...entry,
                modeLabel: TrapFlow.displayLabel(entry.mode, defenses[entry.mode]?.label || damages[entry.mode]?.label),
                ...display,
            };
        });
        const detected = Boolean(this.behavior.system.detected);
        const countdown = stored.countdown || this.behavior.flags?.dsa5?.countdown || null;
        const secrets = game.user.isGM;
        const enrichedGmdescription = await TextEditor.enrichHTML(this.behavior.system.gmdescription || '', { secrets });
        const enrichedDescription = await TextEditor.enrichHTML(this.behavior.system.description || '', { secrets: true });
        return {
            behaviour: this.behavior.system,
            token: this.token,
            tokenAnchor: this.token.actor ? this.token.actor.toAnchor().outerHTML : this.token.name,
            trapName: this.behavior.name,
            trapImg: TrapAutomation.trapImg(this.behavior),
            strikes: TrapAutomation.strikesFrom(this.behavior.system),
            detected,
            disarmed: Boolean(this.behavior.system.disarmed),
            triggered: Boolean(stored.triggered),
            countdown,
            offers: this.#offers(stored),
            damageLines: stored.flow?.lines || [],
            outcomes,
            showNarration: detected && Boolean(this.behavior.system.description),
            enrichedGmdescription,
            enrichedDescription,
        };
    }

    static combatReactionKeys(entry) {
        return String(entry?.reactions || 'nothing,dodge,parry').split(',').map((reaction) => reaction.trim()).filter(Boolean);
    }

    static defenseOffers(stored = {}, behaviorDefenses = {}) {
        const flow = stored.flow;
        const defenses = Object.keys(stored.defenses || {}).length ? stored.defenses : behaviorDefenses;
        if (!flow?.pending?.length) return [];
        return flow.pending.map((id) => {
            const entry = defenses[id] || {};
            const combatReactions = entry.type === 'combat' ? TrapState.combatReactionKeys(entry) : [];
            return {
                id,
                label: TrapFlow.displayLabel(id, entry.label),
                type: entry.type,
                usesReactionDialog: combatReactions.length > 0,
                combatReactions,
            };
        });
    }

    #offers(stored = {}) {
        return TrapState.defenseOffers(stored, this.behavior?.system?.defenses || {});
    }

    async toMessage() {
        const content = await renderTemplate(TrapState.TEMPLATE, await this.#templateData({ outcomes: [], triggered: false }));

        const chatData = DSA5_Utility.chatDataSetup(content, DICE_CONSTANTS.CHAT_MODES.SELF, false, game.users.filter(x => x.isGM && x.active).map(x => x.id));

        chatData.flags = ChatCardBump.apply({
            dsa5: {
                trapData: {
                    behaviour: this.behavior.uuid,
                    token: this.token.uuid,
                    region: this.region.uuid,
                    name: this.name,
                    outcomes: [],
                    triggered: false,
                }
            }
        })
        const message = await ChatMessage.create(chatData);
        this.message = message;
        return message;
    }

    async persistCard({ outcome, triggered = false, trapDataPatch = {} } = {}) {
        if (!this.message) return;
        const trapData = duplicate(this.message.flags?.dsa5?.trapData || {});
        const outcomes = Array.isArray(trapData.outcomes) ? trapData.outcomes : [];
        if (outcome) {
            const index = outcomes.findIndex((entry) => entry.mode === outcome.mode);
            if (index >= 0) outcomes[index] = { ...outcomes[index], ...outcome };
            else outcomes.push(outcome);
        }
        trapData.outcomes = outcomes;
        if (triggered) trapData.triggered = true;
        Object.assign(trapData, trapDataPatch);

        const content = await renderTemplate(TrapState.TEMPLATE, await this.#templateData(trapData));
        await this.message.update({
            content,
            'flags.dsa5.trapData': trapData,
            'flags.dsa5.bumpCard': true,
        });
    }

    async applyRollResult({ mode, actorId, status, skipActorMatch = false, qs = 0, reaction = '' } = {}) {
        if (String(mode || '').startsWith('defense:')) {
            if (!TrapState.ROLL_OUTCOMES.has(status)) return;
            await this.#commitDefense({ id: mode.slice('defense:'.length), status, qs, reaction });
            return;
        }
        if (!TrapState.ROLL_OUTCOMES.has(status)) return;
        const { behavior, token } = this;
        const tokenActor = TrapState.actorFromToken(token);
        if (!skipActorMatch && actorId && tokenActor?.id !== actorId) return;

        const success = ['success', 'critical'].includes(status);
        const actor = game.actors.get(actorId) || (tokenActor?.id === actorId ? tokenActor : null);
        const actorName = actor?.name || token?.name || actorId || '';
        const updates = {};

        switch (mode) {
            case 'disarm':
                if (success && !behavior.system.disarmed) {
                    updates['system.disarmed'] = true;
                    await TrapAutomation.clearCountdown(behavior, this.message);
                    ui.notifications.info('REGIONBEHAVIOR_DSATrap.disarmedSuccess', {
                        format: { trap: behavior.name, actor: actorName },
                        localize: true,
                    });
                }
                break;
            case 'search':
            case 'notice':
                if (success && !behavior.system.detected) {
                    updates['system.detected'] = true;
                    ui.notifications.info('REGIONBEHAVIOR_DSATrap.trapDetected', {
                        format: { trap: behavior.name, actor: actorName },
                        localize: true,
                    });
                }
                break;
            case 'escape':
                if (success) {
                    await TrapAutomation.clearCountdown(behavior, this.message);
                } else {
                    const live = this.message?.id ? game.messages.get(this.message.id) : this.message;
                    const pending = live?.flags?.dsa5?.trapData?.pendingEscapeEffects || [];
                    const victim = tokenActor || actor;
                    if (pending.length && victim) {
                        await TrapAutomation.applyPayloadEffects(victim, pending, {
                            origin: behavior.uuid,
                            sourceName: behavior.name,
                            skipResistRolls: true,
                        });
                    }
                }
                break;
        }

        if (Object.keys(updates).length) await behavior.update(updates);
        await this.persistCard({
            outcome: { mode, status, actorName },
            trapDataPatch: mode === 'escape' ? { pendingEscapeEffects: [] } : {},
        });
    }

    static async applyGroupCheckResult(data) {
        const options = data?.datasetOptions;
        if (!options?.message || !options?.mode) return false;

        const verdict = GroupCheck.cumulativeOutcome(data);
        if (!verdict.complete) return false;

        const trapMessage = await fromUuid(options.message);
        if (!trapMessage) return false;

        const trapState = await TrapState.fromMessage(trapMessage);
        if (!trapState) return false;
        await trapState.applyRollResult({
            mode: options.mode,
            actorId: verdict.actorId,
            status: verdict.success ? 'success' : 'failure',
            skipActorMatch: true,
        });
        return true;
    }

    static chatListeners(html) {
        html.on('click', '.trap-handling', this._handleTrapHandling.bind(this));
    }

    static async fromMessage(message) {
        const trapData = message?.flags?.dsa5?.trapData;
        if (!trapData?.behaviour) return null;
        const behavior = await fromUuid(trapData.behaviour);
        const token = await fromUuid(trapData.token);
        if (!behavior || !token) return null;
        const region = trapData.region ? await fromUuid(trapData.region) : null;
        const name = trapData.name;

        const trapState = new TrapState(behavior, token, region, name);
        trapState.message = message;
        return trapState;
    }

    static async _handleTrapHandling(event) {
        const action = event.currentTarget.dataset.action;
        const messageId = event.currentTarget.closest('.message').dataset.messageId;
        const message = game.messages.get(messageId);
        const trapState = await TrapState.fromMessage(message);
        if (!trapState) return;

        switch (action) {
            case 'searchTrap':
                await trapState._handleSearch(event);
                break;
            case 'disarmTrap':
                await trapState._handleDisarm(event);
                break;
            case 'manualDisarm':
                await trapState._handleManualDisarm(event);
                break;
            case 'triggerTrap':
                await trapState._handleTrigger(event);
                break;
            case 'defendTrap':
                await trapState._handleDefense(event);
                break;
            case 'fallTrap':
                await trapState._handleFall(event);
                break;
            case 'showTrap':
                await trapState._handleShow(event);
        }
    }

    #requestRollOptions(message, token) {
        return {
            trapMessage: message,
            token,
        };
    }

    async _handleSearch(event) {
        const { token, region, message, behavior } = this;
        const skill = _loc('LocalizedIDs.perception');
        const rollOptions = this.#requestRollOptions(message, token);

        await TrapState.#openSingleton(`dsa-trap-search-${message.id}`, {
            window: {
                title: 'LocalizedIDs.perception'
            },
            position: {
                width: 400
            },
            content: await renderTemplate('systems/dsa5/templates/chat/trap/search.hbs', { token, region, message }),
            buttons: [
                {
                    action: 'notice',
                    icon: 'fa fa-eye',
                    label: 'REGIONBEHAVIOR_DSATrap.notice',
                    default: true,
                    callback: () => {
                        RollRequestService.createTrapRequest({
                            ...rollOptions,
                            name: skill,
                            modifier: TrapState.perceptionModifier(behavior.system.stealth, 'notice'),
                            mode: 'notice',
                        });
                    },
                },
                {
                    action: 'search',
                    icon: 'fa fa-magnifying-glass',
                    label: 'REGIONBEHAVIOR_DSATrap.search',
                    callback: () => {
                        RollRequestService.createTrapRequest({
                            ...rollOptions,
                            name: skill,
                            modifier: TrapState.perceptionModifier(behavior.system.stealth, 'search'),
                            mode: 'search',
                        });
                    },
                }
            ]
        });
    }

    async _handleShow(event) {
        const { token, region, message, behavior } = this;
        const visibility = Number(behavior.parent.visibility);
        const state = TrapState.regionVisibilityKey(visibility) || 'LAYER_UNLOCKED';

        await TrapState.#openSingleton(`dsa-trap-show-${message.id}`, {
            window: {
                title: 'REGIONBEHAVIOR_DSATrap.showTrap'
            },
            position: {
                width: 600
            },
            content: await renderTemplate('systems/dsa5/templates/chat/trap/showTrap.hbs', { token, region, message, state }),
            buttons: [
                {
                    action: 'showTrap',
                    icon: 'fa fa-mask',
                    label: 'REGIONBEHAVIOR_DSATrap.showTrap',
                    default: visibility === CONST.REGION_VISIBILITY.GAMEMASTER,
                    callback: () => {
                        behavior.parent.update({ visibility: CONST.REGION_VISIBILITY.GAMEMASTER });
                    },
                },
                {
                    action: 'showTrapAll',
                    icon: 'fa fa-users',
                    label: 'REGIONBEHAVIOR_DSATrap.showTrapAll',
                    default: visibility === CONST.REGION_VISIBILITY.ALWAYS,
                    callback: () => {
                        behavior.parent.update({ visibility: CONST.REGION_VISIBILITY.ALWAYS });
                    },
                },
                {
                    action: 'hideTrapAll',
                    icon: 'fa fa-eye-slash',
                    label: 'REGIONBEHAVIOR_DSATrap.hideTrapAll',
                    default: visibility === CONST.REGION_VISIBILITY.LAYER,
                    callback: () => {
                        behavior.parent.update({ visibility: CONST.REGION_VISIBILITY.LAYER });
                    },
                }
            ]
        });
    }

    async _handleDisarm(event) {
        const { token, region, message, behavior } = this;
        if (behavior.system.disarmed) {
            ui.notifications.warn(_loc("REGIONBEHAVIOR_DSATrap.alreadyDisarmed"));
            return;
        }
        if (!TrapState.canDisarm(token.actor)) {
            ui.notifications.warn('REGIONBEHAVIOR_DSATrap.missingDisarmAbility', {
                format: {
                    actor: token.actor?.name || token.name,
                    ability: _loc('LocalizedIDs.disarmTraps'),
                },
                localize: true,
            });
            return;
        }

        const skill = _loc('LocalizedIDs.lockpick');
        const rollOptions = this.#requestRollOptions(message, token);
        const duration = [1, 5, 5][behavior.system.complexity];
        const headerHtml = `<b>${_loc('REGIONBEHAVIOR_DSATrap.disarmMessage', {
            duration
        })}</b>`;

        if (behavior.system.complexity > 1) {
            GroupCheck.openDialog({
                name: skill,
                modifier: behavior.system.difficulty,
                configuration: { targetQs: 1 },
                otherMessage: headerHtml,
                forceWhisperIDs: RollRequestService.buildTokenWhisper(token),
                datasetOptions: {
                    mode: 'disarm',
                    message: message.uuid,
                },
            });
        } else {
            RollRequestService.createTrapRequest({
                ...rollOptions,
                name: skill,
                modifier: behavior.system.difficulty,
                mode: 'disarm',
                headerHtml,
            });
        }
    }

    async _handleManualDisarm(event) {
        const { token, region, message, behavior } = this;
        if (!game.user.isGM) return;

        if (behavior.system.disarmed) {
            ui.notifications.warn(_loc("REGIONBEHAVIOR_DSATrap.alreadyDisarmed"));
            return;
        }

        await TrapState.#openSingleton(`dsa-trap-manual-disarm-${message.id}`, {
            window: {
                title: 'REGIONBEHAVIOR_DSATrap.manualDisarm'
            },
            position: {
                width: 400
            },
            content: await renderTemplate('systems/dsa5/templates/chat/trap/manualDisarm.hbs', { token, region, message, behaviour: behavior.system }),
            buttons: [
                {
                    action: 'confirm',
                    icon: 'fa fa-check',
                    label: 'REGIONBEHAVIOR_DSATrap.confirmDisarm',
                    default: true,
                    callback: async (event, button, dialog) => {
                        await behavior.update({ "system.disarmed": true });
                        await TrapAutomation.clearCountdown(behavior, this.message);
                        await this.persistCard({
                            outcome: {
                                mode: 'manualDisarm',
                                status: 'success',
                                actorName: game.user.name,
                            },
                        });
                        ui.notifications.info("REGIONBEHAVIOR_DSATrap.manuallyDisarmed", {
                            format: { trap: behavior.name, gm: game.user.name },
                            localize: true,
                        });
                    },
                },
                {
                    action: 'cancel',
                    icon: 'fa fa-times',
                    label: 'cancel'
                }
            ]
        });
    }

    async _handleTrigger(event) {
        const { behavior, token, region } = this;
        const result = await TrapAutomation.trigger({ behavior, token, region, trapMessage: this.message, awaitDefense: true });
        if (!result) return;

        behavior.system.playSound();

        const description = await TextEditor.enrichHTML(behavior.system.description || '', { secrets: true });
        const tokenName = foundry.utils.escapeHTML(token.name);
        const trapName = foundry.utils.escapeHTML(behavior.name);
        ChatMessage.create(DSA5_Utility.chatDataSetup(`
            <div>
            <p>${_loc("REGIONBEHAVIOR_DSATrap.trapstart", { name: tokenName, trap: trapName })}</p>
            <p>${description}</p>
            </div>
        `));

        const whisper = [...new Set([
            ...(this.message.whisper || []),
            ...RollRequestService.buildTokenWhisper(token),
        ])];
        await this.message.update({ whisper });
        await this.persistCard({
            outcome: {
                mode: 'trigger',
                status: 'success',
                actorName: token.name,
            },
            triggered: true,
            trapDataPatch: {
                flow: result.flow,
                defenses: behavior.system.defenses,
                damages: behavior.system.damages,
            },
        });
    }

    async _handleFall(event) {
        const actor = TrapState.actorFromToken(this.token);
        if (!actor?.setupFallingDamage) return;
        const height = Number(event.currentTarget.dataset.height) || 1;
        actor.setupFallingDamage({ fallingHeight: height }, this.token?.id);
    }

    async _handleDefense(event) {
        const id = event.currentTarget.dataset.defense;
        const reaction = event.currentTarget.dataset.reaction || '';
        const { behavior, token } = this;
        const defenses = behavior.system.defenses || this.message.flags?.dsa5?.trapData?.defenses || {};
        const entry = defenses[id];
        if (!entry) return;
        const actor = TrapState.actorFromToken(token);
        if (entry.type === 'combat' && !reaction) {
            await this.#openCombatReactionDialog(id, entry);
            return;
        }
        if (reaction === 'nothing') {
            await this.#commitDefense({ id, status: 'failure', reaction: 'nothing' });
            return;
        }
        if (entry.type === 'group') {
            const resist = TrapAutomation.timerEscapeResist({
                ...behavior.system,
                name: entry.label,
            });
            await TrapAutomation.openEscapeCheck({ trapMessage: this.message, token, resist });
            return;
        }
        if (entry.type === 'chase') {
            await TrapAutomation.startBoulderChase({ behavior, token, region: this.region });
            await this.#commitDefense({ id, status: 'success', reaction: 'chase' });
            return;
        }
        if (reaction === 'dodge' && actor) {
            await this.#startCombatRoll(id, 'dodge', actor);
            return;
        }
        const skill = entry.skill || entry.label;
        await RollRequestService.createTrapRequest({
            trapMessage: this.message,
            token,
            name: skill,
            modifier: this.#defenseModifier(entry) + TrapAutomation.rangeDefenseMalus(behavior.system, entry),
            mode: `defense:${id}`,
            label: entry.label,
        });
    }

    async #openCombatReactionDialog(id, entry) {
        const actor = TrapState.actorFromToken(this.token);
        if (!actor) {
            ui.notifications.error('DSAError.noProperActor', { localize: true });
            return;
        }
        await game.dsa5.dialogs.ReactToAttackDialog.showTrapDialog({
            actor,
            tokenId: this.token.id,
            trapMessage: this.message,
            defenseId: id,
            allowedReactions: TrapState.combatReactionKeys(entry),
        });
    }

    static async resolveCombatReaction(trapConfig, dataset) {
        const trapState = await TrapState.fromMessage(trapConfig.trapMessage);
        if (!trapState) return;
        const actor = trapConfig.actor || TrapState.actorFromToken(trapState.token);
        const text = dataset?.value;
        if (text === 'doNothing') {
            await trapState.#commitDefense({ id: trapConfig.defenseId, status: 'failure', reaction: 'nothing' });
            return;
        }
        if (text === 'dodge') {
            await trapState.#startCombatRoll(trapConfig.defenseId, 'dodge', actor);
            return;
        }
        await trapState.#startCombatRoll(trapConfig.defenseId, 'parry', actor, dataset);
    }

    static async postCombatReaction(postFunction, payload) {
        const trapMessage = await fromUuid(postFunction.trapMessageUuid);
        if (!trapMessage) return;
        const trapState = await TrapState.fromMessage(trapMessage);
        if (!trapState) return;
        const rollResult = payload?.result && typeof payload.result === 'object' ? payload.result : (payload ?? {});
        const status = QueryOrchestrator.statusFromSuccessLevel(Number(rollResult.successLevel) || 0) || 'failure';
        await trapState.applyRollResult({
            mode: `defense:${postFunction.defenseId}`,
            actorId: postFunction.actorId,
            status,
            qs: Number(rollResult.qualityStep) || 0,
            skipActorMatch: true,
            reaction: postFunction.reaction || '',
        });
    }

    async #startCombatRoll(id, reaction, actor, dataset = {}) {
        if (!actor) return;
        const defenses = this.behavior.system.defenses || this.message.flags?.dsa5?.trapData?.defenses || {};
        const entry = defenses[id] || {};
        const moreModifiers = TrapAutomation.rangeDefenseModifiers(this.behavior.system, entry);
        const postFunction = {
            functionName: 'game.dsa5.apps.TrapState.postCombatReaction',
            trapMessageUuid: this.message.uuid,
            defenseId: id,
            actorId: actor.id,
            reaction,
        };
        const options = {
            modifier: this.#defenseModifier(entry),
            moreModifiers,
            situationalModifiers: moreModifiers,
            postFunction,
            skipDefaultOppose: true,
        };
        const tokenId = this.token?.id;
        let setupPromise;
        if (reaction === 'dodge') {
            setupPromise = actor.setupDodge(options, tokenId);
        } else if (dataset.value === 'parryWeaponless') {
            setupPromise = actor.setupWeaponless('parry', options, tokenId);
        } else {
            const result = actor.items.find((item) => ['meleeweapon', 'trait'].includes(item.type) && item.name == dataset.value);
            if (!result) return;
            setupPromise = actor.setupWeapon(result, 'parry', options, tokenId);
        }
        const setupData = await setupPromise;
        if (!setupData) return;
        const rolled = await actor.basicTest(setupData);
        await TrapState.postCombatReaction(postFunction, rolled);
    }

    #defenseModifier(entry) {
        return TrapAutomation.defenseModifier(this.behavior.system, entry, {
            detected: this.behavior.system.detected,
            damageLines: this.message.flags?.dsa5?.trapData?.flow?.lines || [],
        });
    }

    async #commitDefense({ id, status, qs = 0, reaction = '' } = {}) {
        const stored = this.message.flags?.dsa5?.trapData || {};
        let flow = stored.flow;
        if (flow?.resolvedIds?.includes(id)) {
            flow = TrapFlow.rewind(this.behavior.system, flow, id);
        }
        const result = await TrapAutomation.resolveDefense({
            behavior: this.behavior,
            token: this.token,
            trapMessage: this.message,
            flow,
            id,
            status,
            qs,
            reaction,
        });
        await this.persistCard({
            outcome: { mode: id, status, actorName: this.token?.name || '' },
            trapDataPatch: { flow: result.flow },
        });
    }
}
