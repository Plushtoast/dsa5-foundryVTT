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
import Actordsa5 from "../actor/actor-dsa5.js";

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
            const notHit = TrapState.isNotHitConsequence(entry.consequence);
            const display = QueryOrchestrator.outcomeDisplay({ status: entry.status });
            if (notHit) {
                display.resultTooltip = entry.consequence;
                display.resultSubLabel = '';
            } else if (entry.consequence && !display.resultTooltip) {
                display.resultTooltip = entry.consequence;
            }
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
        const areaTarget = stored.target || TrapAutomation.areaTargetFrom(this.behavior.system, this.region);
        const applyDamageInChat = game.settings.get('dsa5', 'applyDamageInChat');
        const offers = this.#offers(stored);
        const damageLines = (stored.flow?.lines || []).map((line) => ({
            ...line,
            hasAreaTemplate: Boolean(areaTarget) && TrapAutomation.lineOffersArea(line),
            canApply: TrapState.lineCanApply(line),
        }));
        const fallActions = damageLines.filter((line) => line.needsFall);
        const summaryLines = damageLines.filter((line) => !line.needsFall);
        const complexity = Number(this.behavior.system.complexity) || 0;
        return {
            behaviour: this.behavior.system,
            token: this.token,
            tokenAnchor: this.token.actor ? this.token.actor.toAnchor().outerHTML : this.token.name,
            trapName: this.behavior.name,
            trapImg: TrapAutomation.trapImg(this.behavior),
            strikes: TrapAutomation.strikesFrom(this.behavior.system),
            damageBadges: TrapAutomation.announceDamageBadges(this.behavior.system),
            detected,
            disarmed: Boolean(this.behavior.system.disarmed),
            triggered: Boolean(stored.triggered),
            countdown,
            offers,
            fallActions,
            damageLines: summaryLines,
            outcomes,
            applyDamageInChat,
            showNarration: detected && Boolean(this.behavior.system.description),
            enrichedGmdescription,
            enrichedDescription,
            isGM: secrets,
            disarmDuration: [1, 5, 5][complexity],
            payloadHint: (() => {
                try {
                    return TrapAutomation.hitExtrasMarkup(TrapAutomation.payloadFromBehavior(this.behavior)) || '';
                } catch (err) {
                    console.warn(err);
                    return '';
                }
            })(),
            passwordRequired: Boolean(this.behavior.system.passwordRequired),
            remainingCharges: this.behavior.system.remainingCharges,
            charges: this.behavior.system.charges,
        };
    }

    static combatReactionKeys(entry) {
        return String(entry?.reactions || 'nothing,dodge,parry').split(',').map((reaction) => reaction.trim()).filter(Boolean);
    }

    static lineCanApply(line) {
        if (!line || line.needsFall || line.needsChance || line.chanceMiss || line.applied) return false;
        return Number.isFinite(Number(line.total)) && Number(line.total) > 0;
    }

    static isDodgeSkillName(name) {
        const text = String(name || '').trim();
        if (!text) return false;
        return text === _loc('dodge') || text.toLowerCase() === 'dodge' || text === 'Ausweichen';
    }

    static signedModifier(value) {
        const amount = Number(value) || 0;
        if (amount > 0) return `+${amount}`;
        return String(amount);
    }

    static isNotHitConsequence(text) {
        return Boolean(text) && text === _loc('REGIONBEHAVIOR_DSATrap.consequenceNotHit');
    }

    static defenseOffers(stored = {}, behaviorDefenses = {}, { detected = true, system = {} } = {}) {
        const flow = stored.flow;
        const defenses = Object.keys(stored.defenses || {}).length ? stored.defenses : behaviorDefenses;
        if (!flow?.pending?.length) return [];
        return flow.pending.map((id) => {
            const entry = defenses[id] || {};
            const combatReactions = entry.type === 'combat' ? TrapState.combatReactionKeys(entry) : [];
            const rangeMalus = TrapAutomation.rangeDefenseMalus(system, entry);
            const modifier = TrapAutomation.defenseModifier(system, entry, {
                detected,
                damageLines: flow.lines || [],
            });
            const catchFormula = entry.type === 'chase'
                ? TrapFlow.catchDamage(system).map((line) => line.formula).filter(Boolean).join(', ')
                : '';
            const groupCheck = entry.type === 'group'
                ? TrapAutomation.groupCheckFrom({ ...system, defenses: { [id]: entry } })
                : null;
            const targetQs = groupCheck?.targetQs ?? entry.targetQs;
            const maxRolls = groupCheck?.maxRolls ?? entry.maxRolls;
            const unlimited = entry.type === 'group' && GroupCheck.isUnlimited(maxRolls);
            const modifierLabel = modifier ? TrapState.signedModifier(modifier) : '';
            const hasMeta = Boolean(
                entry.skill
                || entry.applications
                || modifierLabel
                || rangeMalus
                || entry.interval
                || targetQs
                || maxRolls
                || unlimited
                || entry.gs
                || entry.fw
                || entry.distanceFormula
                || catchFormula
            );
            return {
                id,
                label: TrapFlow.displayLabel(id, entry.label),
                type: entry.type,
                skill: entry.skill || '',
                applications: entry.applications || '',
                modifier,
                modifierLabel,
                usesReactionDialog: combatReactions.length > 0,
                combatReactions,
                rangeMalus,
                hasMeta,
                interval: entry.interval || '',
                targetQs,
                maxRolls,
                maxRollsLabel: entry.type === 'group'
                    ? GroupCheck.formatMaxRolls(maxRolls)
                    : '',
                gs: entry.gs,
                fw: entry.fw,
                distanceFormula: entry.distanceFormula || '',
                catchFormula,
            };
        });
    }

    #offers(stored = {}) {
        return TrapState.defenseOffers(stored, this.behavior?.system?.defenses || {}, {
            detected: this.behavior?.system?.detected,
            system: this.behavior?.system || {},
        });
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
            const shotIndex = Number(outcome.shotIndex || 0);
            const index = outcomes.findIndex((entry) => entry.mode === outcome.mode && Number(entry.shotIndex || 0) === shotIndex);
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

    async applyRollResult({ mode, actorId, status, skipActorMatch = false, qs = 0, reaction = '', shotIndex } = {}) {
        if (String(mode || '').startsWith('defense:')) {
            if (!TrapState.ROLL_OUTCOMES.has(status)) return;
            await this.#commitDefense({ id: mode.slice('defense:'.length), status, qs, reaction, shotIndex });
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

        if (options.mode === 'escape') await TrapState.#tickEscapeGroupCheck(data);

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

    static async #tickEscapeGroupCheck(data) {
        const options = data?.datasetOptions;
        const trapMessage = await fromUuid(options.message);
        if (!trapMessage) return;
        const trapState = await TrapState.fromMessage(trapMessage);
        if (!trapState) return;
        const count = (data.results || []).length;
        const spent = Number(trapMessage.flags?.dsa5?.trapData?.escapeRollsSpent) || 0;
        if (count <= spent) return;
        for (let i = spent; i < count; i++) await trapState.#spendEscapeAttempt();
        const live = game.messages.get(trapMessage.id) || trapMessage;
        await live.update({ 'flags.dsa5.trapData.escapeRollsSpent': count });
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
            case 'applyTrapChance':
                await trapState._handleChanceDamage(event);
                break;
            case 'applyTrapDamage':
                await trapState._handleApplyDamage(event);
                break;
            case 'placeTrapTemplate':
                await trapState._handlePlaceTemplate(event);
                break;
            case 'showTrap':
                await trapState._handleShow(event);
        }
    }

    async _handleSearch(event) {
        const { token, region, message, behavior } = this;
        const skill = _loc('LocalizedIDs.perception');

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
                        this.#startSkillRoll({
                            skillName: skill,
                            modifier: TrapState.perceptionModifier(behavior.system.stealth, 'notice'),
                            applications: _loc('REGIONBEHAVIOR_DSATrap.notice'),
                            mode: 'notice',
                        });
                    },
                },
                {
                    action: 'search',
                    icon: 'fa fa-magnifying-glass',
                    label: 'REGIONBEHAVIOR_DSATrap.search',
                    callback: () => {
                        this.#startSkillRoll({
                            skillName: skill,
                            modifier: TrapState.perceptionModifier(behavior.system.stealth, 'search'),
                            applications: _loc('REGIONBEHAVIOR_DSATrap.search'),
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
        const duration = [1, 5, 5][behavior.system.complexity];
        const headerHtml = `<b>${_loc('REGIONBEHAVIOR_DSATrap.disarmMessage', {
            duration
        })}</b>`;

        if (behavior.system.complexity > 1) {
            GroupCheck.openDialog({
                name: skill,
                modifier: behavior.system.difficulty,
                configuration: {},
                otherMessage: headerHtml,
                forceWhisperIDs: RollRequestService.buildTokenWhisper(token),
                datasetOptions: {
                    mode: 'disarm',
                    message: message.uuid,
                },
            });
        } else {
            this.#startSkillRoll({
                skillName: skill,
                modifier: behavior.system.difficulty,
                mode: 'disarm',
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
                target: TrapAutomation.areaTargetFrom(behavior.system, this.region),
            },
        });
    }

    async _handleFall(event) {
        const actor = TrapState.actorFromToken(this.token);
        if (!actor?.setupFallingDamage) return;
        const height = Number(event.currentTarget.dataset.height) || 1;
        actor.setupFallingDamage({
            fallingHeight: height,
            trapMessageUuid: this.message?.uuid || '',
            trapLineId: event.currentTarget.dataset.line || '',
        }, this.token?.id);
    }

    static async postFallingDamage(postFunction, payload) {
        const options = postFunction?.options || postFunction || {};
        if (!options.trapMessageUuid) return;
        const trapMessage = await fromUuid(options.trapMessageUuid);
        if (!trapMessage) return;
        const trapState = await TrapState.fromMessage(trapMessage);
        if (!trapState) return;
        const damage = Number(payload?.result?.chatCardDamage);
        if (!Number.isFinite(damage)) return;

        const stored = duplicate(trapMessage.flags?.dsa5?.trapData || {});
        const flow = stored.flow;
        if (!flow?.lines?.length) return;
        const line = flow.lines.find((entry) => entry.id === options.trapLineId)
            || flow.lines.find((entry) => entry.needsFall);
        if (!line) return;
        line.needsFall = false;
        line.total = damage;

        const ownerId = trapState.behavior.system.damages?.[line.sourceId || line.id]?.when;
        const outcomes = (stored.outcomes || []).map((entry) => {
            if (entry.mode !== ownerId || !['failure', 'botch'].includes(entry.status)) return entry;
            return {
                ...entry,
                consequence: trapState.#defenseConsequence({
                    id: entry.mode,
                    status: entry.status,
                    reaction: entry.reaction || '',
                    result: { lines: flow.lines, flow },
                }),
            };
        });
        await trapState.persistCard({ trapDataPatch: { flow, outcomes } });
    }

    async _handleChanceDamage(event) {
        const lineId = event.currentTarget.dataset.line;
        const stored = duplicate(this.message.flags?.dsa5?.trapData || {});
        const flow = stored.flow;
        const line = flow?.lines?.find((entry) => entry.id === lineId);
        if (!line?.needsChance) return;

        const die = Number(line.chanceDie) || 6;
        const roll = await new Roll(`1d${die}`).evaluate();
        const hit = TrapFlow.chanceHits(line, roll.total);
        const flavor = line.label || _loc('REGIONBEHAVIOR_DSATrap.modes.gas');
        await roll.toMessage({
            speaker: ChatMessage.getSpeaker({ token: this.token }),
            flavor,
            whisper: this.message.whisper,
        });

        line.needsChance = false;
        line.chanceRoll = roll.total;
        line.chanceHit = hit;
        line.chanceMiss = !hit;
        line.chanceLabel = hit
            ? _loc('REGIONBEHAVIOR_DSATrap.chanceHit')
            : _loc('REGIONBEHAVIOR_DSATrap.chanceMiss');

        if (hit && line.formula && Roll.validate(line.formula)) {
            const rolled = await TrapFlow.rollLine({ ...line, kind: line.kind === 'note' ? 'formula' : line.kind });
            Object.assign(line, rolled);
            await TrapAutomation.postRolledDamageLines({ behavior: this.behavior, token: this.token, lines: [line] });
        }

        await this.persistCard({ trapDataPatch: { flow } });
    }

    async _handlePlaceTemplate(event) {
        const stored = this.message.flags?.dsa5?.trapData || {};
        const target = stored.target || TrapAutomation.areaTargetFrom(this.behavior.system, this.region);
        if (!target) return;
        const tokenObject = this.token?.object ?? this.token;
        await game.dsa5.apps.DSARegionTemplate.placeFromTarget({
            name: `${this.behavior.name} (${event.currentTarget.dataset.label || _loc('AoE')})`,
            target,
            origin: tokenObject,
            messageId: this.message.id,
            originUuid: this.behavior.uuid,
        });
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
            await TrapAutomation.startBoulderChase({
                behavior,
                token,
                region: this.region,
                trapMessage: this.message,
            });
            await this.#commitDefense({ id, status: 'success', reaction: 'chase' });
            return;
        }
        if (reaction === 'dodge' && actor) {
            await this.#startCombatRoll(id, 'dodge', actor);
            return;
        }
        const skill = entry.skill || entry.label;
        await this.#startSkillRoll({
            skillName: skill,
            modifier: this.#defenseModifier(entry),
            applications: entry.applications || '',
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
            shotIndex: postFunction.shotIndex,
        });
    }

    async #startCombatRoll(id, reaction, actor, dataset = {}) {
        if (!actor) return;
        const defenses = this.behavior.system.defenses || this.message.flags?.dsa5?.trapData?.defenses || {};
        const entry = defenses[id] || {};
        const moreModifiers = TrapAutomation.rangeDefenseModifiers(this.behavior.system, entry);
        const stored = this.message.flags?.dsa5?.trapData || {};
        const defenseCount = Number(stored.flow?.defenseCount) || 0;
        const isRangeDefense = moreModifiers.length > 0;
        const postFunction = {
            functionName: 'game.dsa5.apps.TrapState.postCombatReaction',
            trapMessageUuid: this.message.uuid,
            defenseId: id,
            actorId: actor.id,
            reaction,
            shotIndex: Number(stored.flow?.shotIndex) || 0,
        };
        const options = {
            modifier: this.#defenseModifier(entry),
            moreModifiers,
            postFunction,
            skipDefaultOppose: true,
            isRangeDefense,
            defenseCount,
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
        if (stored.flow) {
            await this.persistCard({
                trapDataPatch: { flow: { ...stored.flow, defenseCount: defenseCount + 1 } },
            });
        }
        const rolled = await actor.basicTest(setupData);
        await TrapState.postCombatReaction(postFunction, rolled);
    }

    #defenseModifier(entry) {
        return TrapAutomation.defenseModifier(this.behavior.system, entry, {
            detected: this.behavior.system.detected,
            damageLines: this.message.flags?.dsa5?.trapData?.flow?.lines || [],
        });
    }

    async #commitDefense({ id, status, qs = 0, reaction = '', shotIndex } = {}) {
        const stored = this.message.flags?.dsa5?.trapData || {};
        let flow = stored.flow;
        const index = Number(shotIndex ?? flow?.shotIndex) || 0;
        const hasAttempt = (stored.outcomes || []).some((entry) => entry.mode === id && Number(entry.shotIndex || 0) === index);
        if (hasAttempt) {
            flow = TrapFlow.rewindShot(this.behavior.system, flow, id, index);
        } else if (flow?.resolvedIds?.includes(id)) {
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
        const consequence = this.#defenseConsequence({ id, status, reaction, result });
        await this.persistCard({
            outcome: { mode: id, status, actorName: this.token?.name || '', consequence, shotIndex: index },
            trapDataPatch: {
                flow: result.flow,
                target: stored.target || TrapAutomation.areaTargetFrom(this.behavior.system, this.region),
            },
        });
    }

    #defenseConsequence({ id, status, reaction = '', result }) {
        const success = ['success', 'critical'].includes(status) && reaction !== 'nothing';
        if (success) return _loc('REGIONBEHAVIOR_DSATrap.consequenceNotHit');
        const parts = [];
        const damages = this.behavior.system.damages || {};
        const lines = (result.lines || []).filter((line) => damages[line.sourceId || line.id]?.when === id);
        for (const line of lines) {
            if (line.needsFall) parts.push(line.label || _loc('REGIONBEHAVIOR_DSATrap.modes.fall'));
            else if (line.needsChance) parts.push(line.chanceLabel || line.label);
            else if (Number(line.total) > 0) {
                parts.push(_loc('REGIONBEHAVIOR_DSATrap.consequenceDamage', {
                    label: line.label || _loc('damage'),
                    total: line.total,
                }));
            }
        }
        const defenses = this.behavior.system.defenses || {};
        const pending = (result.flow?.pending || []).filter((entryId) => defenses[entryId]?.after === id);
        if (pending.length) {
            const names = pending.map((entryId) => TrapFlow.displayLabel(entryId, defenses[entryId]?.label));
            parts.push(_loc('REGIONBEHAVIOR_DSATrap.consequenceNext', { name: names.join(', ') }));
        }
        return parts.join(' — ');
    }

    async #spendEscapeAttempt() {
        const liveBehavior = this.behavior?.uuid ? await fromUuid(this.behavior.uuid) : this.behavior;
        const stored = liveBehavior?.flags?.dsa5?.countdown;
        if (!stored || stored.timedOut) return null;
        const next = TrapAutomation.spendEscapeInterval(stored);
        if (Number.isFinite(game.combat?.round)) next.lastRound = game.combat.round;
        await TrapAutomation.persistCountdown(liveBehavior, next, this.message);
        if (next.timedOut) await TrapAutomation.notifyTimeout(liveBehavior, next);
        return next;
    }

    async #startSkillRoll({ skillName, modifier = 0, applications = '', mode, label = '' } = {}) {
        const actor = TrapState.actorFromToken(this.token);
        if (!actor) {
            ui.notifications.error('DSAError.noProperActor', { localize: true });
            return;
        }
        const skill = actor.items.find((item) => item.type === 'skill' && item.name === skillName)
            || actor.items.find((item) => item.type === 'skill' && item.name === label);
        if (!skill) {
            const defenseId = String(mode || '').startsWith('defense:') ? mode.slice('defense:'.length) : '';
            if (defenseId && (TrapState.isDodgeSkillName(skillName) || TrapState.isDodgeSkillName(label))) {
                await this.#startCombatRoll(defenseId, 'dodge', actor);
                return;
            }
            ui.notifications.error('DSAError.elementNotFound', { format: { element: skillName || label }, localize: true });
            return;
        }
        const postFunction = {
            functionName: 'game.dsa5.apps.TrapState.postSkillRoll',
            trapMessageUuid: this.message.uuid,
            mode,
            actorId: actor.id,
            shotIndex: Number(this.message.flags?.dsa5?.trapData?.flow?.shotIndex) || 0,
        };
        const options = {
            modifier,
            postFunction,
            ...(applications ? { subtitle: ` (${applications})` } : {}),
        };
        const setupData = await actor.setupSkill(skill, options, this.token?.id);
        if (!setupData) return;
        setupData.testData.opposable = false;
        const rolled = await actor.basicTest(setupData);
        await TrapState.postSkillRoll(postFunction, rolled);
    }

    static async postSkillRoll(postFunction, payload) {
        const trapMessage = await fromUuid(postFunction.trapMessageUuid);
        if (!trapMessage) return;
        const trapState = await TrapState.fromMessage(trapMessage);
        if (!trapState) return;
        const rollResult = payload?.result && typeof payload.result === 'object' ? payload.result : (payload ?? {});
        const status = QueryOrchestrator.statusFromSuccessLevel(Number(rollResult.successLevel) || 0) || 'failure';
        await trapState.applyRollResult({
            mode: postFunction.mode,
            actorId: postFunction.actorId,
            status,
            qs: Number(rollResult.qualityStep) || 0,
            skipActorMatch: true,
            shotIndex: postFunction.shotIndex,
        });
    }

    async _handleApplyDamage(event) {
        const lineId = event.currentTarget.dataset.line;
        const mode = event.currentTarget.dataset.mode || 'value';
        const stored = duplicate(this.message.flags?.dsa5?.trapData || {});
        const line = stored.flow?.lines?.find((entry) => entry.id === lineId);
        if (!TrapState.lineCanApply(line)) return;
        const actor = TrapState.actorFromToken(this.token);
        if (!actor) return;
        const total = Number(line.total) || 0;
        const armor = mode === 'sp' ? 0 : (Actordsa5.armorValue(actor).armor || 0);
        const damage = Math.max(0, Math.round(total - armor));
        await actor.applyDamage(damage);
        line.applied = true;
        await this.persistCard({ trapDataPatch: { flow: stored.flow } });
    }

    async applyCatchDamage() {
        const lines = [];
        for (const entry of TrapFlow.catchDamage(this.behavior.system)) {
            lines.push(await TrapFlow.rollLine({ ...entry, kind: entry.kind || entry.type }));
        }
        if (!lines.length) return null;

        const stored = this.message.flags?.dsa5?.trapData || {};
        const flow = {
            ...(stored.flow || {}),
            caught: true,
            lines: [...(stored.flow?.lines || []).filter((entry) => !lines.some((line) => line.id === entry.id)), ...lines],
        };
        const total = lines.reduce((sum, line) => sum + (Number(line.total) || 0), 0);
        await TrapAutomation.postRolledDamageLines({ behavior: this.behavior, token: this.token, lines });
        await this.message.update({ 'flags.data.postData.chatCardDamage': total });
        const consequence = lines
            .filter((line) => Number(line.total) > 0)
            .map((line) => _loc('REGIONBEHAVIOR_DSATrap.consequenceDamage', {
                label: line.label || _loc('damage'),
                total: line.total,
            }))
            .join(' — ');
        await this.persistCard({
            outcome: {
                mode: 'catch',
                status: 'failure',
                actorName: this.token?.name || '',
                consequence,
            },
            trapDataPatch: { flow },
        });
        return { lines, total };
    }
}
