import QueryOrchestrator from '../queries/query-orchestrator.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import SpecialabilityRulesDSA5 from '../rules/specialability-rules-dsa5.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';
import RuleChaos from '../rules/rule_chaos.js';
import { CONJURATION_TYPES } from '../../config/conjuration-constants.js';

const { duplicate, getProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

const MAGICAL_TYPES = ['spell', 'ritual'];
const CLERICAL_TYPES = ['liturgy', 'ceremony'];
const CAST_TYPES = [...MAGICAL_TYPES, ...CLERICAL_TYPES];
const OPEN_PHASES = new Set(['assembling', 'rolling', 'costing', 'paying', 'selfControl']);

/**
 * Cooperative casting: Zauber bündeln, Liturgie vereinen, Beschwörerzirkel, Transmutationen.
 */
export default class CooperativeCasting {
  static QUERY_TYPE = 'dsa5.cooperativeCast';
  static FLAG_KEY = 'cooperativeCast';
  static TEMPLATE = 'systems/dsa5/templates/chat/cooperative-cast.hbs';
  static POST_FN = 'game.dsa5.apps.CooperativeCasting.postMemberRoll';
  static MAX_COMBINED_QS = 6;
  static MAX_CIRCLE_HELPERS = 7;

  static MODES = Object.freeze({
    SPELL_BUNDLING: 'spellBundling',
    LITURGY_UNITING: 'liturgyUniting',
    SUMMONING_CIRCLE: 'summoningCircle',
    TRANSMUTATION: 'transmutation',
  });

  static PHASES = Object.freeze({
    ASSEMBLING: 'assembling',
    ROLLING: 'rolling',
    COSTING: 'costing',
    PAYING: 'paying',
    SELF_CONTROL: 'selfControl',
    COMPLETE: 'complete',
    ABORTED: 'aborted',
  });

  static CIRCLE_MASTER_KEYS = Object.freeze({
    [CONJURATION_TYPES.DEMON]: 'circleMasterDemons',
    [CONJURATION_TYPES.ELEMENTAL]: 'circleMasterElementals',
    [CONJURATION_TYPES.GHOST]: 'circleMasterGhosts',
    [CONJURATION_TYPES.FAIRY]: 'circleMasterFairies',
    [CONJURATION_TYPES.UNDEAD]: 'circleMasterUndead',
    [CONJURATION_TYPES.GOLEM]: 'circleMasterGolems',
    [CONJURATION_TYPES.CHIMERA]: 'circleMasterTransmutations',
    [CONJURATION_TYPES.DAIMONID]: 'circleMasterTransmutations',
    [CONJURATION_TYPES.GOLEMID]: 'circleMasterElementals',
  });

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: this.handleQuery.bind(this),
      handleResult: this.handleResult.bind(this),
    });
  }

  // --- Math (U1) ---

  static maxMembers(sfStep) {
    const step = Math.max(0, Number(sfStep) || 0);
    return step > 0 ? step + 1 : 0;
  }

  static helperContribution(qualityStep, successLevel) {
    if (!(Number(successLevel) > 0)) return 0;
    return Math.floor(Math.max(0, Number(qualityStep) || 0) / 2);
  }

  static combinedQualityStep(leadQS, helperResults = []) {
    const lead = Math.max(0, Number(leadQS) || 0);
    let total = lead;
    for (const helper of helperResults) {
      total += this.helperContribution(helper?.qualityStep, helper?.successLevel);
    }
    return Math.min(this.MAX_COMBINED_QS, total);
  }

  static parseManaAmount(value) {
    if (value == null || value === '') return null;
    if (typeof value === 'number') return Number.isFinite(value) ? Math.round(value) : null;
    const match = String(value).replace(',', '.').match(/-?\d+(?:\.\d+)?/);
    if (!match) return null;
    const parsed = Number(match[0]);
    return Number.isFinite(parsed) ? Math.round(parsed) : null;
  }

  static listedItemCost(item) {
    return this.parseManaAmount(item?.system?.AsPCost?.value)
      ?? this.parseManaAmount(item?.system?.KaPCost?.value)
      ?? 0;
  }

  static evenSplit(total, memberIds = [], leadId) {
    const ids = [...memberIds].filter(Boolean);
    const n = ids.length;
    const amount = Math.max(0, Math.floor(Number(total) || 0));
    const shares = {};
    if (!n) return shares;
    const base = Math.floor(amount / n);
    const remainder = amount - base * n;
    for (const id of ids) shares[id] = base;
    const lead = ids.includes(leadId) ? leadId : ids[ids.length - 1];
    shares[lead] += remainder;
    return shares;
  }

  static selfControlModifier(extraSfHoldersBesideLead = 0) {
    return -2 + Math.max(0, Number(extraSfHoldersBesideLead) || 0);
  }

  static transmutationExtraPayerSlots(fw) {
    return Math.floor(Math.max(0, Number(fw) || 0) / 4);
  }

  static packPenaltyEase(successCount) {
    return Math.max(0, Number(successCount) || 0);
  }

  static circleMasterLocKey(typeId) {
    const key = this.CIRCLE_MASTER_KEYS[Number(typeId)];
    return key ? `LocalizedIDs.${key}` : null;
  }

  static bundlingAbilityKey(mode) {
    if (mode === this.MODES.LITURGY_UNITING) return 'LocalizedIDs.liturgyUniting';
    if (mode === this.MODES.SPELL_BUNDLING) return 'LocalizedIDs.spellBundling';
    return null;
  }

  static itemTypesForMode(mode) {
    if (mode === this.MODES.LITURGY_UNITING) return CLERICAL_TYPES;
    if (mode === this.MODES.SPELL_BUNDLING) return MAGICAL_TYPES;
    return CAST_TYPES;
  }

  static traditionKind(mode, itemType) {
    if (mode === this.MODES.LITURGY_UNITING || CLERICAL_TYPES.includes(itemType)) return 'clerical';
    return 'magical';
  }

  static manaTypeForMode(mode) {
    return mode === this.MODES.LITURGY_UNITING ? 'KaP' : 'AsP';
  }

  static usesSelfControl(mode) {
    return mode === this.MODES.SPELL_BUNDLING || mode === this.MODES.LITURGY_UNITING;
  }

  static usesHelperItemRolls(mode) {
    return mode === this.MODES.SPELL_BUNDLING || mode === this.MODES.LITURGY_UNITING;
  }

  // --- Eligibility ---

  static abilityStep(actor, locKey) {
    if (!actor || !locKey) return 0;
    try {
      return Number(SpecialabilityRulesDSA5.abilityStep(actor, locKey)) || 0;
    } catch {
      return 0;
    }
  }

  static hasAbility(actor, locKey) {
    if (!actor || !locKey) return false;
    try {
      return !!SpecialabilityRulesDSA5.hasAbility(actor, locKey);
    } catch {
      return false;
    }
  }

  static hasCircleMaster(actor, typeId) {
    return this.hasAbility(actor, this.circleMasterLocKey(typeId));
  }

  static canShowCircleHelpers(actor, typeId) {
    if (!actor || typeId == null) return false;
    if (!this.circleMasterLocKey(typeId)) return false;
    return this.hasCircleMaster(actor, typeId);
  }

  static actorTraditionTokens(actor, kind = 'magical') {
    if (!actor) return [];
    const traditionLabel = _loc('tradition');
    const field = kind === 'clerical' ? actor.system?.tradition?.clerical : actor.system?.tradition?.magical;
    const fromActor = DSA5_Utility.cleanTraditionTokens(field, traditionLabel);
    const fromSpecials = [...(actor.items ?? [])]
      .filter((item) => item.type === 'specialability' && String(item.name || '').startsWith(traditionLabel))
      .flatMap((item) => DSA5_Utility.cleanTraditionTokens(item.name, traditionLabel));
    return [...fromActor, ...fromSpecials];
  }

  static sameTradition(left, right, kind) {
    return DSA5_Utility.hasMatchingTradition(this.actorTraditionTokens(left, kind), this.actorTraditionTokens(right, kind));
  }

  static ownedCastItem(actor, name, types = CAST_TYPES) {
    if (!actor || !name) return null;
    return actor.items.find((item) => item.name === name && types.includes(item.type)) || null;
  }

  static itemFw(actor, name, types = CAST_TYPES) {
    return Number(this.ownedCastItem(actor, name, types)?.system?.talentValue?.value) || 0;
  }

  static knowsItem(actor, name, types = CAST_TYPES) {
    return !!this.ownedCastItem(actor, name, types);
  }

  static isIncapacitated(actor) {
    return !!(actor?.hasCondition?.('unconscious') || actor?.hasCondition?.('dead'));
  }

  static pickAusrichter({ mode, initiator, members, itemName, itemTypes }) {
    if (mode === this.MODES.LITURGY_UNITING) return initiator;
    if (!this.usesHelperItemRolls(mode)) return initiator;
    let lead = initiator;
    let best = this.itemFw(initiator, itemName, itemTypes);
    for (const member of members) {
      if (member.id === initiator?.id) continue;
      const fw = this.itemFw(member, itemName, itemTypes);
      if (fw > best) {
        best = fw;
        lead = member;
      }
    }
    return lead;
  }

  static isEligibleHelper(actor, { lead, mode, itemName, itemTypes, kind, requireItem = true } = {}) {
    if (!actor || actor.id === lead?.id) return false;
    if (this.isIncapacitated(actor)) return false;
    if (lead && !this.sameTradition(lead, actor, kind)) return false;
    if (requireItem && itemName && !this.knowsItem(actor, itemName, itemTypes)) return false;
    return true;
  }

  static pickerEntryFilter(context) {
    return (entry) => {
      const actor = game.actors.get(entry.id);
      return this.isEligibleHelper(actor, context);
    };
  }

  static matchesSpellBundling(item, actor) {
    if (!item || !MAGICAL_TYPES.includes(item.type)) return false;
    return this.abilityStep(actor, 'LocalizedIDs.spellBundling') > 0;
  }

  static matchesLiturgyUniting(item, actor) {
    if (!item || !CLERICAL_TYPES.includes(item.type)) return false;
    return this.abilityStep(actor, 'LocalizedIDs.liturgyUniting') > 0;
  }

  static matchesTransmutation(item, actor) {
    if (!item || !CAST_TYPES.includes(item.type)) return false;
    if (item.name !== _loc('LocalizedIDs.chimaeroform')) return false;
    return this.hasAbility(actor, 'LocalizedIDs.circleMasterTransmutations');
  }

  static #dialogDisplayedCost(dialog) {
    const root = dialog?.element;
    if (!root) return null;
    const text = root.querySelector('.aspcost')?.textContent
      ?? root.querySelector('[name="variableBaseCost"]')?.value;
    return this.parseManaAmount(text);
  }

  static async startFromRollDialog(dialogState, mode) {
    const dialog = dialogState?.dialog;
    const itemCost = this.#dialogDisplayedCost(dialog);
    if (dialog) {
      dialog._extraFlowStarted = true;
      await dialog.close();
    }
    return this.startFromItem(dialogState?.actor, dialogState?.source, mode, itemCost != null ? { itemCost } : {});
  }

  // --- Session ---

  static findActiveSession(actorId) {
    if (!actorId) return null;
    for (const message of game.messages) {
      const state = message.getFlag('dsa5', this.FLAG_KEY);
      if (!state || !OPEN_PHASES.has(state.phase)) continue;
      if (state.leadId === actorId) return message;
    }
    return null;
  }

  static notifyExistingSession(message) {
    ui.notifications.info('COOPCAST.alreadyActive', { localize: true });
    if (message?.id) ui.chat?.scrollBottom?.();
  }

  static whisperUserIds(actors = []) {
    const ids = new Set();
    for (const user of game.users) {
      if (user.isGM) ids.add(user.id);
    }
    for (const actor of actors.filter(Boolean)) {
      for (const user of game.users) {
        if (actor.testUserPermission(user, 'OWNER')) ids.add(user.id);
      }
    }
    if (!ids.size) ids.add(game.user.id);
    return [...ids];
  }

  static ownsManaFor(message) {
    const postFunction = getProperty(message, 'flags.data.preData.extra.options.postFunction');
    if (postFunction?.functionName !== this.POST_FN || !postFunction.requestMessageId) return false;
    const session = game.messages.get(postFunction.requestMessageId);
    const state = session?.getFlag('dsa5', this.FLAG_KEY);
    return !!(state && OPEN_PHASES.has(state.phase));
  }

  static async createSession({ mode, lead, members, item, extras = {} }) {
    const actors = members.filter(Boolean);
    const recipients = await QueryOrchestrator.buildRecipients(actors);
    const itemTypes = this.itemTypesForMode(mode);
    const sfKey = this.bundlingAbilityKey(mode);
    for (const recipient of recipients) {
      const actor = game.actors.get(recipient.actorId);
      recipient.isLead = recipient.actorId === lead.id;
      recipient.role = extras.assistantIds?.includes(recipient.actorId) ? 'assistant' : 'caster';
      recipient.knowsItem = this.knowsItem(actor, item.name, itemTypes);
      recipient.hasSf = sfKey ? this.hasAbility(actor, sfKey) : false;
      recipient.share = 0;
      recipient.paid = false;
      recipient.paidAmount = 0;
      recipient.sbStatus = null;
      recipient.contribution = 0;
    }

    const extraSf = recipients.filter((entry) => !entry.isLead && entry.hasSf).length;
    const state = {
      mode,
      phase: this.PHASES.ROLLING,
      leadId: lead.id,
      itemName: item.name,
      itemType: item.type,
      itemUuid: item.uuid || null,
      itemImg: item.img || null,
      itemCost: this.parseManaAmount(extras.itemCost) || this.listedItemCost(item) || 0,
      manaType: this.manaTypeForMode(mode),
      combinedQS: 0,
      finalcost: 0,
      castFailed: false,
      sharesCommitted: false,
      selfControlModifier: this.selfControlModifier(extraSf),
      autoFinalize: false,
      recipients,
      ...extras,
    };

    return QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
      whisper: this.whisperUserIds(actors),
    });
  }

  static async startFromItem(actor, item, mode, extras = {}) {
    if (!actor || !item) return;
    const existing = this.findActiveSession(actor.id);
    if (existing) return this.notifyExistingSession(existing);
    if (this.isIncapacitated(actor)) {
      ui.notifications.warn('COOPCAST.incapacitated', { localize: true });
      return;
    }

    let packMode = false;
    if (mode === this.MODES.TRANSMUTATION) {
      packMode = await this.#promptPackMode();
      if (packMode == null) return;
    }

    const itemTypes = this.itemTypesForMode(mode);
    const kind = this.traditionKind(mode, item.type);
    const max = this.#maxPicks(actor, item, mode);
    if (max <= 1 && this.usesHelperItemRolls(mode)) {
      ui.notifications.warn('COOPCAST.needSf', { localize: true });
      return;
    }

    const helperIds = await this.#pickHelpers({
      lead: actor,
      mode,
      itemName: item.name,
      itemTypes,
      kind,
      maxHelpers: Math.max(0, max - 1),
      allowWithoutItem: mode === this.MODES.TRANSMUTATION && packMode,
    });
    if (helperIds == null) return;

    const helpers = helperIds.map((id) => game.actors.get(id)).filter(Boolean);
    if (this.usesHelperItemRolls(mode) && !helpers.length) {
      ui.notifications.warn('COOPCAST.needHelpers', { localize: true });
      return;
    }
    if (helpers.some((helper) => this.isIncapacitated(helper))) {
      ui.notifications.warn('COOPCAST.incapacitated', { localize: true });
      return;
    }

    const members = [actor, ...helpers];
    const lead = this.pickAusrichter({ mode, initiator: actor, members, itemName: item.name, itemTypes });
    const assistantIds = mode === this.MODES.TRANSMUTATION && packMode
      ? helpers.filter((helper) => !this.knowsItem(helper, item.name, itemTypes)).map((helper) => helper.id)
      : [];

    return this.createSession({
      mode,
      lead,
      members,
      item,
      extras: {
        packMode,
        extraPayerSlots: mode === this.MODES.TRANSMUTATION ? this.transmutationExtraPayerSlots(this.itemFw(actor, item.name, itemTypes)) : 0,
        assistantIds,
        initiatorId: actor.id,
        ...extras,
      },
    });
  }

  static async startSummoningCircle({ lead, helpers, item, conjurationType, unknownCount = 0 }) {
    const existing = this.findActiveSession(lead.id);
    if (existing) {
      this.notifyExistingSession(existing);
      return existing;
    }
    return this.createSession({
      mode: this.MODES.SUMMONING_CIRCLE,
      lead,
      members: [lead, ...helpers],
      item,
      extras: {
        conjurationType,
        unknownCount,
        updateSummoning: true,
      },
    });
  }

  static #maxPicks(actor, item, mode) {
    if (mode === this.MODES.SUMMONING_CIRCLE) return this.MAX_CIRCLE_HELPERS + 1;
    if (mode === this.MODES.TRANSMUTATION) {
      return 1 + this.transmutationExtraPayerSlots(this.itemFw(actor, item.name, this.itemTypesForMode(mode))) + 8;
    }
    const key = this.bundlingAbilityKey(mode);
    return this.maxMembers(this.abilityStep(actor, key));
  }

  static async #promptPackMode() {
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: 'COOPCAST.transmutation' },
      content: `<p>${_loc('COOPCAST.packModeHint')}</p>`,
      yes: { label: 'COOPCAST.packMode' },
      no: { label: 'COOPCAST.singleMode' },
      rejectClose: false,
    });
    return confirmed;
  }

  static async #pickHelpers({ lead, mode, itemName, itemTypes, kind, maxHelpers, allowWithoutItem = false }) {
    if (maxHelpers <= 0) return [];
    const actorIds = await ActorPickerDialog.open({
      id: 'dsa-cooperative-cast',
      title: `COOPCAST.${mode}`,
      header: `<p>${_loc('COOPCAST.pickHelpers', { remaining: maxHelpers, item: itemName })}</p>`,
      showSourceToggle: true,
      entryFilter: this.pickerEntryFilter({
        lead,
        mode,
        itemName,
        itemTypes,
        kind,
        requireItem: !allowWithoutItem,
      }),
    });
    if (actorIds == null) return null;
    const helpers = actorIds.filter((id) => id !== lead.id);
    if (helpers.length > maxHelpers) {
      ui.notifications.warn('COOPCAST.tooMany', { localize: true, format: { max: maxHelpers } });
      return null;
    }
    return helpers;
  }

  // --- Card ---

  static async renderMessage(state) {
    return renderTemplate(this.TEMPLATE, this.getTemplateData(state));
  }

  static getTemplateData(state) {
    const isGM = game.user.isGM;
    const lead = game.actors.get(state.leadId);
    const canLead = isGM || !!lead?.isOwner;
    const costing = state.phase === this.PHASES.COSTING;
    const paying = state.phase === this.PHASES.PAYING;
    const rolling = state.phase === this.PHASES.ROLLING;
    const selfControl = state.phase === this.PHASES.SELF_CONTROL;
    const open = OPEN_PHASES.has(state.phase);

    const recipients = (state.recipients || []).map((entry) => {
      const actor = game.actors.get(entry.actorId);
      const { designatedUser } = QueryOrchestrator.resolveDesignatedUser(actor || { id: entry.actorId });
      const outcome = QueryOrchestrator.outcomeDisplay({
        status: this.#rowStatus(state, entry),
        successLevel: entry.resultDetails?.successLevel,
        detail: this.#rowDetail(state, entry),
      });
      const ownsActor = !!actor?.isOwner;
      const needsRoll = rolling && this.#needsItemRoll(state, entry) && !QueryOrchestrator.TERMINAL_STATES.has(entry.status);
      const unpaid = paying && !entry.paid;
      const resultLines = this.#resultLines(state, entry);
      const showShareInput = costing && canLead;
      return {
        ...entry,
        actorName: actor?.name || _loc('unknown'),
        actorImg: actor?.img || '',
        designatedUserName: designatedUser?.name || '',
        ...outcome,
        resultLines,
        resultLabel: resultLines.length || showShareInput ? '' : this.#rowLabel(state, entry, outcome),
        resultIcon: resultLines.length || showShareInput ? '' : outcome.resultIcon,
        share: Number(entry.share) || 0,
        canRoll: needsRoll && ownsActor,
        canPay: unpaid && ownsActor && (Number(entry.share) || 0) > 0,
        canSb: selfControl && ownsActor && this.usesSelfControl(state.mode) && !entry.sbStatus,
        canTreatWounds: rolling && ownsActor && entry.role === 'assistant' && !entry.resultDetails?.treatWoundsDone,
        canGMRoll: needsRoll && isGM && !ownsActor,
        canGMPay: unpaid && isGM && !ownsActor,
        canRemove: canLead && open && state.phase === this.PHASES.ROLLING && !entry.isLead && !QueryOrchestrator.TERMINAL_STATES.has(entry.status),
        canGMAction: isGM && open,
        showShareInput,
        selfControlTitle: this.selfControlTitle(),
        isLead: !!entry.isLead,
      };
    });

    const titleHintKey = `COOPCAST.${state.mode}Hint`;
    const combinedSummary = this.#combinedSummary(state);
    return {
      title: _loc(`COOPCAST.${state.mode}`),
      titleHint: game.i18n.has(titleHintKey) ? _loc(titleHintKey) : '',
      itemName: state.itemName,
      itemImg: state.itemImg || '',
      phaseHint: _loc('COOPCAST.phaseHint', { phase: _loc(`COOPCAST.PHASE.${state.phase}`) }),
      phaseLabel: _loc(`COOPCAST.PHASE.${state.phase}`),
      combinedSummary,
      combinedQS: state.combinedQS,
      finalcost: state.finalcost,
      manaType: state.manaType,
      manaAbbrev: _loc(`CHARAbbrev.${state.manaType}`),
      castFailed: state.castFailed,
      selfControlModifier: state.selfControlModifier,
      unknownCount: state.unknownCount || 0,
      packPenaltyEase: this.packPenaltyEase(this.#heilkundeSuccesses(state)),
      showCombined: !!combinedSummary,
      showCost: ['costing', 'paying', 'selfControl', 'complete', 'aborted'].includes(state.phase),
      canCommitShares: costing && canLead,
      canReassign: paying && canLead,
      canAbort: open && canLead,
      recipients,
      isGM,
    };
  }

  static selfControlTitle() {
    return `${_loc('LocalizedIDs.selfControl')} (${_loc('COOPCAST.remainConscious')})`;
  }

  static #combinedSummary(state) {
    if (!this.usesHelperItemRolls(state.mode)) return null;
    const rolled = (state.recipients || []).filter((entry) => (
      entry.role !== 'assistant' && QueryOrchestrator.TERMINAL_STATES.has(entry.status)
    ));
    if (!rolled.length) return null;
    const contributions = rolled.map((entry) => {
      const name = game.actors.get(entry.actorId)?.name || _loc('unknown');
      const qs = Number(entry.resultDetails?.qualityStep) || 0;
      const contrib = entry.isLead
        ? (Number(entry.resultDetails?.successLevel) > 0 ? qs : 0)
        : (Number(entry.contribution) || 0);
      return {
        text: entry.isLead
          ? _loc('COOPCAST.combinedQSLead', { name, qs: contrib })
          : _loc('COOPCAST.combinedQSHelper', { name, qs, contrib }),
      };
    });
    const lead = state.recipients.find((entry) => entry.isLead);
    const leadDone = lead && QueryOrchestrator.TERMINAL_STATES.has(lead.status);
    const outcome = !leadDone ? '' : (state.castFailed
      ? _loc('COOPCAST.combinedQSOutcomeFail')
      : _loc('COOPCAST.combinedQSOutcomeSuccess', { qs: state.combinedQS }));
    return {
      combinedQS: state.combinedQS,
      contributions,
      outcome,
      tooltip: [_loc('COOPCAST.combinedQSHint'), ...contributions.map((entry) => entry.text), outcome].filter(Boolean).join(' — '),
    };
  }

  static #resultLines(state, entry) {
    const lines = [];
    const push = (text, tooltip = '') => lines.push({ text, tooltip });
    if (entry.role === 'assistant') {
      if (entry.resultDetails?.treatWoundsDone) {
        push(entry.resultDetails.treatWoundsSuccess
          ? _loc('COOPCAST.treatWoundsSuccess')
          : _loc('COOPCAST.treatWoundsFail'));
      }
    } else if (QueryOrchestrator.TERMINAL_STATES.has(entry.status) && entry.resultDetails) {
      const qs = Number(entry.resultDetails.qualityStep) || 0;
      const success = Number(entry.resultDetails.successLevel) > 0;
      if (!success) {
        push(_loc('COOPCAST.rollLineFail'));
      } else if (entry.isLead || !this.usesHelperItemRolls(state.mode)) {
        push(_loc('COOPCAST.rollLineLead', { qs }), _loc('COOPCAST.combinedQSHint'));
      } else {
        push(_loc('COOPCAST.rollLineHelper', { qs, contrib: Number(entry.contribution) || 0 }), _loc('COOPCAST.combinedQSHint'));
      }
    }
    const mana = _loc(`CHARAbbrev.${state.manaType}`);
    const share = Number(entry.paid ? (entry.paidAmount || entry.share) : entry.share) || 0;
    if (entry.paid && share > 0) {
      push(_loc('COOPCAST.paidLine', { amount: share, mana }), _loc('COOPCAST.costHint'));
    } else if (state.phase === this.PHASES.PAYING && share > 0) {
      push(_loc('COOPCAST.paidLinePending', { amount: share, mana }), _loc('COOPCAST.costHint'));
    }
    if (entry.sbStatus) {
      push(
        entry.sbStatus === 'failure' || entry.sbStatus === 'botch'
          ? _loc('COOPCAST.sbFail')
          : _loc('COOPCAST.sbSuccess'),
        this.selfControlTitle(),
      );
    }
    return lines;
  }

  static #rowStatus(state, entry) {
    if (state.phase === this.PHASES.SELF_CONTROL) return entry.sbStatus || 'pending';
    if (state.phase === this.PHASES.PAYING) return entry.paid ? 'success' : entry.status;
    if (entry.role === 'assistant') {
      if (entry.resultDetails?.treatWoundsDone) return entry.resultDetails.treatWoundsSuccess ? 'success' : 'failure';
    }
    return entry.status;
  }

  static #rowDetail(state, entry) {
    const parts = [];
    if (entry.isLead) parts.push(_loc('COOPCAST.lead'));
    if (entry.role === 'assistant') parts.push(_loc('COOPCAST.assistant'));
    if (Number.isFinite(Number(entry.contribution)) && this.usesHelperItemRolls(state.mode) && QueryOrchestrator.TERMINAL_STATES.has(entry.status)) {
      parts.push(`${_loc('CHARAbbrev.QS')} ${entry.isLead ? (entry.resultDetails?.qualityStep || 0) : entry.contribution}`);
    }
    if (entry.paid) parts.push(_loc('COOPCAST.paid'));
    if (entry.sbStatus === 'failure') parts.push(_loc('COOPCAST.stunned'));
    return parts.join(' — ');
  }

  static #rowLabel(state, entry, outcome) {
    if (state.phase === this.PHASES.COSTING || state.phase === this.PHASES.PAYING) {
      return `${Number(entry.share) || 0} ${_loc(`CHARAbbrev.${state.manaType}`)}`;
    }
    if (outcome.resultLabel) return outcome.resultLabel;
    if (QueryOrchestrator.TERMINAL_STATES.has(entry.status) && entry.resultDetails) {
      return `${_loc('CHARAbbrev.QS')} ${entry.resultDetails.qualityStep || 0}`;
    }
    return '';
  }

  static #needsItemRoll(state, entry) {
    if (entry.role === 'assistant') return false;
    if (this.usesHelperItemRolls(state.mode)) return true;
    return entry.isLead;
  }

  static #heilkundeSuccesses(state) {
    return (state.recipients || []).filter((entry) => entry.role === 'assistant' && entry.resultDetails?.treatWoundsSuccess).length;
  }

  static chatListeners(html) {
    html.on('click', '.coopcast-action', async (event) => {
      const button = event.currentTarget;
      const action = button.dataset.action;
      const actorId = button.dataset.actorId;
      const messageId = $(button).closest('.message').attr('data-message-id');
      if (!messageId) return;

      switch (action) {
        case 'roll':
          await this.triggerFromCard(messageId, actorId, 'itemRoll');
          break;
        case 'treatWounds':
          await this.triggerFromCard(messageId, actorId, 'treatWounds');
          break;
        case 'selfControl':
          await this.triggerFromCard(messageId, actorId, 'selfControl');
          break;
        case 'pay':
          await this.triggerFromCard(messageId, actorId, 'payShare');
          break;
        case 'rollOnBehalf':
          if (!game.user.isGM) return;
          await this.triggerFromCard(messageId, actorId, 'itemRoll', { byGM: true });
          break;
        case 'payOnBehalf':
          if (!game.user.isGM) return;
          await this.triggerFromCard(messageId, actorId, 'payShare', { byGM: true });
          break;
        case 'shiftShare':
          this.#shiftShareInCard(button.closest('.message'), actorId, Number(button.dataset.dir) || 0);
          break;
        case 'commitShares':
          await this.commitSharesFromCard(messageId, button.closest('.message'));
          break;
        case 'reassign':
          await this.reopenCosting(messageId);
          break;
        case 'abort':
          await this.abortSession(messageId);
          break;
        case 'remove':
          await this.removeMember(messageId, actorId);
          break;
      }
    });

    if (game.user.isGM) {
      QueryOrchestrator.attachRowEllipsisMenu(html, '.coopcast-menu', '.coopcast-row[data-actor-id]', (messageId, actorId, status) => {
        if (QueryOrchestrator.TERMINAL_STATES.has(status) && status !== 'pending') {
          return [
            { label: _loc('DSAQUERIES.COMMANDS.payOnBehalf'), icon: '<i class="fas fa-coins"></i>', onClick: () => this.triggerFromCard(messageId, actorId, 'payShare', { byGM: true }) },
          ];
        }
        return [
          { label: _loc('DSAQUERIES.COMMANDS.resend'), icon: '<i class="fas fa-rotate-right"></i>', onClick: () => this.resendToActor(messageId, actorId) },
          { label: _loc('DSAQUERIES.COMMANDS.rollOnBehalf'), icon: '<i class="fas fa-dice"></i>', onClick: () => this.triggerFromCard(messageId, actorId, 'itemRoll', { byGM: true }) },
          { label: _loc('COOPCAST.remove'), icon: '<i class="fas fa-user-minus"></i>', onClick: () => this.removeMember(messageId, actorId) },
        ];
      });
    }

    html.on('mousedown', 'input.coopcast-share', (ev) => RuleChaos.quantityClick(ev));
    html.on('contextmenu', 'input.coopcast-share', (ev) => ev.preventDefault());
  }

  // --- Queries / rolls ---

  static async handleQuery(payload, queryContext = {}) {
    return QueryOrchestrator.runWithClientExpiry(
      () => this.#executeQuery(payload),
      queryContext,
    );
  }

  static async handleResult({ messageId, actorId, result }) {
    if (!result) return;
    if (!game.user.isGM) {
      game.socket.emit('system.dsa5', {
        type: 'queryResult',
        payload: { messageId, actorId, result },
      });
      return;
    }

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      this.#applyResultToState(state, actorId, result);
      this.#refreshDerived(state);
      return state;
    });

    const state = game.messages.get(messageId)?.getFlag('dsa5', this.FLAG_KEY);
    if (state?.needsRefund) await this.refundPaid(messageId);
    if (result.action === 'selfControl' && !(Number(result.resultDetails?.successLevel) > 0)) {
      const actor = game.actors.get(actorId);
      if (actor && !actor.hasCondition('stunned')) await actor.addCondition('stunned', 1, false, false);
    }
    if (['paying', 'selfControl'].includes(state?.phase) && ['payShare', 'itemRoll'].includes(result.action)) {
      await this.dispatchPendingQueries(messageId);
    }
  }

  static async postMemberRoll(postFunction, payload) {
    if (!postFunction?.requestMessageId) return;
    const result = this.#rollResultFromPayload(payload, postFunction.action || 'itemRoll');
    if (postFunction.byGM) result.resultDetails = { ...result.resultDetails, byGM: true };
    await this.handleResult({
      messageId: postFunction.requestMessageId,
      actorId: postFunction.actorId,
      result,
    });
    if (postFunction.updateSummoning) {
      game.dsa5.apps.playerMenu?.postConjurationRoll?.(postFunction, payload);
    }
  }

  static #rollOutcomeData(payload) {
    if (!payload || typeof payload !== 'object') return {};
    const inner = payload.result;
    if (inner && typeof inner === 'object' && ('qualityStep' in inner || 'preData' in inner || 'successLevel' in inner)) return inner;
    return payload;
  }

  static #spellCostFromData(data) {
    const mods = data?.preData?.calculatedSpellModifiers;
    const candidates = [mods?.finalcost, mods?.cost, data?.finalcost];
    for (const candidate of candidates) {
      const parsed = this.parseManaAmount(candidate);
      if (parsed != null && parsed > 0) return parsed;
    }
    return this.parseManaAmount(candidates.find((value) => value != null)) || 0;
  }

  static #rollResultFromPayload(payload, action) {
    const data = this.#rollOutcomeData(payload);
    const successLevel = Number(data.successLevel) || 0;
    return {
      userId: game.user.id,
      action,
      status: QueryOrchestrator.statusFromSuccessLevel(successLevel) || (successLevel > 0 ? 'success' : 'failure'),
      resultDetails: {
        qualityStep: Number(data.qualityStep) || 0,
        successLevel,
        messageId: data.messageId,
        finalcost: this.#spellCostFromData(data),
        permanentCost: Number(data.preData?.source?.system?.permanentCost?.value) || 0,
      },
    };
  }

  static #applyResultToState(state, actorId, result) {
    const recipient = state.recipients.find((entry) => entry.actorId === actorId);
    if (!recipient) return;

    const action = result.action || 'itemRoll';
    const details = result.resultDetails || {};
    const previousSuccess = Number(recipient.resultDetails?.successLevel) || 0;
    const isRefresh = QueryOrchestrator.isLinkedRollRefresh(recipient, result);

    if (action === 'payShare') {
      if (details.paid) {
        recipient.paid = true;
        recipient.paidAmount = Number(details.paidAmount) || Number(recipient.share) || 0;
      }
      return;
    }

    if (action === 'selfControl') {
      recipient.sbStatus = result.status;
      recipient.resultDetails = { ...(recipient.resultDetails || {}), ...details, sbDone: true };
      return;
    }

    if (action === 'treatWounds') {
      recipient.resultDetails = {
        ...(recipient.resultDetails || {}),
        ...details,
        treatWoundsDone: true,
        treatWoundsSuccess: Number(details.successLevel) > 0,
      };
      return;
    }

    if (QueryOrchestrator.TERMINAL_STATES.has(recipient.status) && !isRefresh && action === 'itemRoll') return;

    recipient.status = result.status;
    recipient.designatedUserId = recipient.designatedUserId || result.userId || null;
    recipient.resultDetails = { ...(recipient.resultDetails || {}), ...details };
    recipient.contribution = recipient.isLead
      ? Math.max(0, Number(details.qualityStep) || 0)
      : this.helperContribution(details.qualityStep, details.successLevel);

    if (recipient.isLead) {
      const parsedCost = this.parseManaAmount(details.finalcost);
      if (parsedCost != null) state.finalcost = parsedCost;
      const newSuccess = Number(details.successLevel) || 0;
      const flipped = isRefresh && ((previousSuccess > 0) !== (newSuccess > 0)) && ['paying', 'selfControl', 'complete'].includes(state.phase);
      state.castFailed = !(newSuccess > 0) || newSuccess < -1;
      if (newSuccess < -1) state.castFailed = true;
      if (details.permanentCost) state.permanentCost = Number(details.permanentCost) || 0;
      if (flipped) {
        state.needsRefund = true;
        state.phase = this.PHASES.COSTING;
        state.sharesCommitted = false;
        for (const entry of state.recipients) {
          entry.paid = false;
        }
      }
    }
  }

  static #refreshDerived(state) {
    if (this.usesHelperItemRolls(state.mode)) {
      const lead = state.recipients.find((entry) => entry.isLead);
      const helpers = state.recipients.filter((entry) => !entry.isLead && entry.role !== 'assistant');
      const leadQS = lead?.status && QueryOrchestrator.TERMINAL_STATES.has(lead.status)
        ? (Number(lead.resultDetails?.successLevel) > 0 ? Number(lead.resultDetails?.qualityStep) || 0 : 0)
        : 0;
      state.combinedQS = this.combinedQualityStep(leadQS, helpers.map((entry) => ({
        qualityStep: entry.resultDetails?.qualityStep,
        successLevel: entry.resultDetails?.successLevel,
      })));
      if (lead && (Number(lead.resultDetails?.successLevel) || 0) < -1) {
        state.castFailed = true;
        state.combinedQS = 0;
      } else if (lead && QueryOrchestrator.TERMINAL_STATES.has(lead.status)) {
        state.castFailed = !(Number(lead.resultDetails?.successLevel) > 0);
      }
    } else {
      const lead = state.recipients.find((entry) => entry.isLead);
      state.combinedQS = Number(lead?.resultDetails?.qualityStep) || 0;
      if (lead && QueryOrchestrator.TERMINAL_STATES.has(lead.status)) {
        state.castFailed = !(Number(lead.resultDetails?.successLevel) > 0);
      }
    }

    if (state.phase === this.PHASES.ROLLING && this.#rollsComplete(state)) {
      state.phase = this.PHASES.COSTING;
      if (!(Number(state.finalcost) > 0)) state.finalcost = Number(state.itemCost) || 0;
      this.#defaultShares(state);
    }

    if (state.phase === this.PHASES.PAYING && state.recipients.every((entry) => entry.paid || (Number(entry.share) || 0) === 0)) {
      if (this.usesSelfControl(state.mode)) state.phase = this.PHASES.SELF_CONTROL;
      else state.phase = this.PHASES.COMPLETE;
    }

    if (state.phase === this.PHASES.SELF_CONTROL && state.recipients.every((entry) => entry.sbStatus)) {
      state.phase = this.PHASES.COMPLETE;
    }
  }

  static #rollsComplete(state) {
    return state.recipients
      .filter((entry) => this.#needsItemRoll(state, entry))
      .every((entry) => QueryOrchestrator.TERMINAL_STATES.has(entry.status));
  }

  static #defaultShares(state) {
    const payers = this.#payerIds(state);
    const shares = this.evenSplit(state.finalcost, payers, state.leadId);
    for (const entry of state.recipients) entry.share = shares[entry.actorId] || 0;
  }

  static #shiftShareInCard(messageEl, actorId, dir) {
    const inputs = [...(messageEl?.querySelectorAll?.('.coopcast-share') || [])];
    const current = inputs.find((input) => input.dataset.actorId === actorId);
    if (!current) return;
    const cur = Math.max(0, Math.floor(Number(current.value) || 0));
    const others = inputs.filter((input) => input !== current);
    if (dir > 0) {
      const donor = others.sort((a, b) => (Number(b.value) || 0) - (Number(a.value) || 0))[0];
      if (!donor || (Number(donor.value) || 0) <= 0) return;
      donor.value = Math.max(0, (Number(donor.value) || 0) - 1);
      current.value = cur + 1;
      return;
    }
    if (cur <= 0) return;
    const lead = inputs.find((input) => input.closest('.coopcast-row')?.dataset.isLead === 'true') || others[0];
    const receiver = lead && lead !== current ? lead : others[0];
    if (!receiver) return;
    current.value = cur - 1;
    receiver.value = (Number(receiver.value) || 0) + 1;
  }

  static #payerIds(state) {
    if (state.mode === this.MODES.TRANSMUTATION) {
      return state.recipients.filter((entry) => entry.knowsItem && entry.role !== 'assistant').map((entry) => entry.actorId);
    }
    return state.recipients.map((entry) => entry.actorId);
  }

  static async dispatchPendingQueries(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (!state.recipients) return;

    await Promise.all(state.recipients.map(async (recipient) => {
      if (!recipient.designatedUserId) return;
      const action = this.#pendingAction(state, recipient);
      if (!action) return;
      await QueryOrchestrator.dispatchRecipientQuery({
        userId: recipient.designatedUserId,
        queryType: this.QUERY_TYPE,
        payload: this.#queryPayload(state, recipient, messageId, action),
        label: `cooperative ${action} ${recipient.actorId}`,
        onResult: (result) => this.handleResult({ messageId, actorId: recipient.actorId, result }),
      });
    }));
  }

  static #pendingAction(state, recipient) {
    if (state.phase === this.PHASES.ROLLING) {
      if (recipient.role === 'assistant' && !recipient.resultDetails?.treatWoundsDone) return 'treatWounds';
      if (state.updateSummoning && this.#needsItemRoll(state, recipient)) return null;
      if (this.#needsItemRoll(state, recipient) && recipient.status === 'pending') return 'itemRoll';
    }
    if (state.phase === this.PHASES.PAYING && !recipient.paid && (Number(recipient.share) || 0) > 0) return 'payShare';
    if (state.phase === this.PHASES.SELF_CONTROL && !recipient.sbStatus) return 'selfControl';
    return null;
  }

  static #queryPayload(state, recipient, messageId, action, extra = {}) {
    return {
      messageId,
      actorId: recipient.actorId,
      action,
      mode: state.mode,
      itemName: state.itemName,
      itemType: state.itemType,
      modifier: action === 'selfControl' ? state.selfControlModifier : 0,
      manaType: state.manaType,
      share: recipient.share,
      skipPowerSource: extra.skipPowerSource || state.skipPowerSource,
      permanentCost: recipient.isLead ? (state.permanentCost || 0) : 0,
      unknownCount: state.unknownCount || 0,
      packEase: this.packPenaltyEase(this.#heilkundeSuccesses(state)),
      ...extra,
    };
  }

  static async triggerFromCard(messageId, actorId, action, extra = {}) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const recipient = state.recipients?.find((entry) => entry.actorId === actorId);
    if (!recipient) return;
    const result = await this.handleQuery(this.#queryPayload(state, recipient, messageId, action, extra));
    await this.handleResult({ messageId, actorId, result });
    if (action === 'payShare' && state.phase === this.PHASES.PAYING) {
      const next = game.messages.get(messageId)?.getFlag('dsa5', this.FLAG_KEY);
      if (next?.phase === this.PHASES.SELF_CONTROL) await this.dispatchPendingQueries(messageId);
    }
  }

  static async resendToActor(messageId, actorId) {
    const actor = game.actors.get(actorId);
    if (!actor) return;
    const { designatedUser, status } = QueryOrchestrator.resolveDesignatedUser(actor);
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      const recipient = state.recipients.find((entry) => entry.actorId === actorId);
      if (!recipient) return state;
      recipient.designatedUserId = designatedUser?.id || null;
      if (recipient.status === 'unowned') recipient.status = status;
      return state;
    });
    await this.dispatchPendingQueries(messageId);
  }

  static async #executeQuery(payload) {
    const actor = game.actors.get(payload.actorId);
    if (!actor) return { userId: game.user.id, status: 'error', action: payload.action };

    try {
      if (payload.action === 'payShare') return await this.#executePay(actor, payload);
      if (payload.action === 'selfControl') return await this.#executeSkillRoll(actor, payload, _loc('LocalizedIDs.selfControl'), payload.modifier, 'selfControl');
      if (payload.action === 'treatWounds') return await this.#executeSkillRoll(actor, payload, _loc('LocalizedIDs.treatWounds'), 0, 'treatWounds');
      return await this.#executeItemRoll(actor, payload);
    } catch {
      return payload.messageId ? null : { userId: game.user.id, status: 'cancelled', action: payload.action };
    }
  }

  static async #executeItemRoll(actor, payload) {
    const item = this.ownedCastItem(actor, payload.itemName, this.itemTypesForMode(payload.mode))
      || actor.items.find((entry) => entry.name === payload.itemName && CAST_TYPES.includes(entry.type));
    if (!item) return { userId: game.user.id, status: 'error', action: 'itemRoll' };

    const options = {
      postFunction: {
        functionName: this.POST_FN,
        requestMessageId: payload.messageId,
        actorId: payload.actorId,
        action: 'itemRoll',
        ...(payload.byGM ? { byGM: true } : {}),
        ...(payload.mode === this.MODES.SUMMONING_CIRCLE ? { updateSummoning: true } : {}),
      },
    };
    const mods = [];
    if (payload.unknownCount) {
      mods.push({ name: _loc('COOPCAST.unknownRitualPenalty'), value: -Number(payload.unknownCount), selected: true });
    }
    if (payload.packEase) {
      mods.push({ name: _loc('COOPCAST.packAssistEase'), value: Number(payload.packEase), selected: true });
    }
    if (mods.length) options.situationalModifiers = mods;

    const setupData = await actor.setupSpell(item, options, undefined);
    if (!setupData) return payload.messageId ? null : { userId: game.user.id, status: 'cancelled', action: 'itemRoll' };
    const rolled = await actor.basicTest(setupData);
    if (!rolled) return payload.messageId ? null : { userId: game.user.id, status: 'cancelled', action: 'itemRoll' };
    return this.#rollResultFromPayload(rolled, 'itemRoll');
  }

  static async #executeSkillRoll(actor, payload, skillName, modifier, action) {
    const skill = actor.items.find((item) => item.name === skillName && item.type === 'skill');
    if (!skill) return { userId: game.user.id, status: 'error', action };

    const options = {
      modifier,
      subtitle: action === 'selfControl' ? ` (${_loc('COOPCAST.remainConscious')})` : undefined,
      postFunction: {
        functionName: this.POST_FN,
        requestMessageId: payload.messageId,
        actorId: payload.actorId,
        action,
        ...(payload.byGM ? { byGM: true } : {}),
      },
    };
    const setupData = await actor.setupSkill(skill, options, undefined);
    if (!setupData) return payload.messageId ? null : { userId: game.user.id, status: 'cancelled', action };
    const rolled = await actor.basicTest(setupData);
    if (!rolled) return payload.messageId ? null : { userId: game.user.id, status: 'cancelled', action };
    return this.#rollResultFromPayload(rolled, action);
  }

  static async #executePay(actor, payload) {
    const share = Number(payload.share) || 0;
    if (share <= 0) {
      return { userId: game.user.id, action: 'payShare', status: 'success', resultDetails: { paid: true, paidAmount: 0 } };
    }
    const paid = await actor.applyMana(share, payload.manaType, {
      skipPowerSource: payload.manaType !== 'AsP' ? true : !!payload.skipPowerSource,
      permanentCost: payload.permanentCost || 0,
    });
    if (!paid) {
      return { userId: game.user.id, action: 'payShare', status: 'failed', resultDetails: { paid: false } };
    }
    return {
      userId: game.user.id,
      action: 'payShare',
      status: 'success',
      resultDetails: { paid: true, paidAmount: share },
    };
  }

  // --- Shares / abort ---

  static async commitSharesFromCard(messageId, messageEl) {
    const inputs = messageEl?.querySelectorAll?.('.coopcast-share') || [];
    const shares = {};
    for (const input of inputs) shares[input.dataset.actorId] = Math.max(0, Math.floor(Number(input.value) || 0));
    await this.commitShares(messageId, shares);
  }

  static async commitShares(messageId, shares = {}, { skipPowerSource = false } = {}) {
    let ready = false;
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      if (state.phase !== this.PHASES.COSTING) return state;
      const total = Object.values(shares).reduce((sum, value) => sum + (Number(value) || 0), 0);
      if (total !== Number(state.finalcost)) {
        ui.notifications.warn('COOPCAST.shareMismatch', { localize: true });
        return state;
      }
      for (const entry of state.recipients) {
        entry.share = Number(shares[entry.actorId]) || 0;
        entry.paid = entry.share === 0;
        entry.paidAmount = 0;
      }
      state.sharesCommitted = true;
      state.phase = this.PHASES.PAYING;
      state.skipPowerSource = skipPowerSource;
      ready = true;
      return state;
    });
    if (ready) await this.dispatchPendingQueries(messageId);
  }

  static async reopenCosting(messageId) {
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      if (state.phase !== this.PHASES.PAYING) return state;
      state.phase = this.PHASES.COSTING;
      state.sharesCommitted = false;
      return state;
    });
  }

  static async abortSession(messageId) {
    const paid = [];
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      for (const entry of state.recipients) {
        if (entry.paid && entry.paidAmount) paid.push({ actorId: entry.actorId, amount: entry.paidAmount, manaType: state.manaType });
        entry.paid = false;
      }
      state.phase = this.PHASES.ABORTED;
      return state;
    });
    for (const entry of paid) {
      const actor = game.actors.get(entry.actorId);
      if (actor) await actor.applyMana(-entry.amount, entry.manaType, { skipPowerSource: true });
    }
  }

  static async refundPaid(messageId) {
    const paid = [];
    let manaType = 'AsP';
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      manaType = state.manaType;
      for (const entry of state.recipients) {
        if (entry.paid && entry.paidAmount) paid.push({ actorId: entry.actorId, amount: entry.paidAmount });
        entry.paid = false;
        entry.paidAmount = 0;
      }
      if (state.needsRefund) {
        state.needsRefund = false;
        state.phase = this.PHASES.COSTING;
      }
      return state;
    });
    for (const entry of paid) {
      const actor = game.actors.get(entry.actorId);
      if (actor) await actor.applyMana(-entry.amount, manaType, { skipPowerSource: true });
    }
  }

  static async removeMember(messageId, actorId) {
    const refund = [];
    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (state) => {
      const recipient = state.recipients.find((entry) => entry.actorId === actorId);
      if (!recipient || recipient.isLead) return state;
      if (recipient.paid && recipient.paidAmount) {
        refund.push({ actorId, amount: recipient.paidAmount, manaType: state.manaType });
      }
      if (QueryOrchestrator.TERMINAL_STATES.has(recipient.status)) {
        recipient.contribution = 0;
        recipient.resultDetails = { ...(recipient.resultDetails || {}), qualityStep: 0, successLevel: 0 };
        recipient.status = 'skipped';
      } else {
        state.recipients = state.recipients.filter((entry) => entry.actorId !== actorId);
      }
      this.#refreshDerived(state);
      return state;
    });
    for (const entry of refund) {
      const actor = game.actors.get(entry.actorId);
      if (actor) await actor.applyMana(-entry.amount, entry.manaType, { skipPowerSource: true });
    }
  }

  static async pickCircleHelperIds(lead, ritualNames = []) {
    return this.#pickHelpers({
      lead,
      mode: this.MODES.SUMMONING_CIRCLE,
      itemName: ritualNames[0] || _loc('COOPCAST.summoningCircle'),
      itemTypes: CAST_TYPES,
      kind: 'magical',
      maxHelpers: this.MAX_CIRCLE_HELPERS,
      allowWithoutItem: true,
    });
  }

  static unknownRitualCount(lead, helperActors, ritualNames = []) {
    const names = ritualNames.filter(Boolean);
    if (!names.length) return 0;
    return helperActors.filter((helper) => !names.some((name) => this.knowsItem(helper, name, CAST_TYPES))).length;
  }

  static applyEvenSplitToState(state) {
    this.#defaultShares(state);
    return state;
  }
}
