import QueryOrchestrator from './query-orchestrator.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import MagicAnalysisService from '../magic-analysis/magic-analysis.js';
import InformationQueryService from './information-query.js';
import RollRequestService from './roll-request.js';
import { bindClickListener } from '../helpers/view_helper.js';
import ItemEnchantment from '../../item/item-enchantment.js';
const { renderTemplate } = foundry.applications.handlebars;
const { duplicate } = foundry.utils;

export default class MagicAnalysisQueryService {
  static QUERY_TYPE = 'dsa5.magicAnalysis';
  static FLAG_KEY = 'magicAnalysisRequest';
  static TEMPLATE = 'systems/dsa5/templates/chat/magic-analysis/magic-analysis-request.hbs';

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: this.handleQuery.bind(this),
    });
  }

  static async openStartDialog({ informationUuid, parentUuid, parentItem } = {}) {
    const analysisContext = await MagicAnalysisService.resolveAnalysisContext({
      informationUuid,
      parentUuid,
      parentItem,
    });
    if (!analysisContext) {
      ui.notifications.warn(_loc('MAGICANALYSIS.noLinkedInfo'));
      return;
    }

    if (!game.users.some((user) => user.active && user.isGM)) {
      ui.notifications.warn(_loc('DSAQUERIES.NOTIFICATIONS.noGMOnline'));
      return;
    }

    if (!game.user.isGM) {
      const { actor } = DSA5ChatAutoCompletion._getActor();
      if (!actor) return;
      await this.createRequest({ actor, analysisContext });
      return;
    }

    const actors = ActorPickerDialog.buildActorPickerData()
      .filter((a) => a.isPlayerOwned || a.isActiveCharacter)
      .map((a) => ({ ...a, preselected: true }));

    ActorPickerDialog.open({
      actors,
      showSourceToggle: true,
      title: 'MAGICANALYSIS.dialogTitle',
      entryFilter: (entry) => entry.isPlayerOwned || entry.isActiveCharacter,
      callback: ({ actorIds }) => {
        for (const actorId of actorIds) {
          const actor = game.actors.get(actorId);
          if (actor) this.createRequest({ actor, analysisContext });
        }
      },
    });
  }

  static initProgress(actor) {
    const progress = MagicAnalysisService.initProgress();
    progress.passiveMaxQS = MagicAnalysisService._systemEffectValue(actor, 'skillModifiers.magicAnalysis.max');
    progress.stackBonus = MagicAnalysisService._systemEffectValue(actor, 'skillModifiers.magicAnalysis.stack');
    return progress;
  }

  static buildSteps(actor, progress, { finalized = false, magiekundeDone = false } = {}) {
    const steps = [];
    // Helpers are optional and only usable before the Magiekunde check is completed.
    const helpersLocked = finalized || magiekundeDone;

    for (const helper of MagicAnalysisService._listAvailableHelpers(actor)) {
      const progressKey = `${helper.key}QS`;
      const rolled = progress[progressKey] != null;
      const isEnchantment = helper.source === 'enchantment';
      const eligible = !rolled && (isEnchantment
        ? helper.charged
        : (helper.config.type === 'spell' ? actor.system.isMage : actor.system.isPriest));
      const canRoll = !helpersLocked && eligible;

      const step = {
        stepId: isEnchantment
          ? `helper-${helper.key}-ench-${helper.sourceItemId}-${helper.enchantmentId}`
          : `helper-${helper.key}`,
        type: 'helper',
        helperKey: helper.key,
        source: helper.source || 'spell',
        name: helper.name,
        optional: true,
        status: rolled ? 'success' : (canRoll ? 'pending' : 'skipped'),
        resultDetails: rolled ? { qualityStep: progress[progressKey] } : null,
        canRoll,
      };

      if (isEnchantment) {
        step.sourceItemId = helper.sourceItemId;
        step.enchantmentId = helper.enchantmentId;
      } else {
        step.spellId = helper.item.id;
      }

      steps.push(step);
    }

    progress.totalMaxQS = MagicAnalysisService._computeTotalMaxQS(progress);
    // Magiekunde is available as soon as rules allow any QS (e.g. Analytiker alone,
    // or after at least one helper raised the cap) — helpers are not required first.
    steps.push({
      stepId: 'magiekunde',
      type: 'magiekunde',
      name: MagicAnalysisService._magiekundeSkill(),
      optional: false,
      status: 'pending',
      resultDetails: null,
      canRoll: !finalized && !magiekundeDone && progress.totalMaxQS > 0,
    });

    return steps;
  }

  static refreshAnalysisState(state) {
    const actor = game.actors.get(state.actorId);
    if (!actor) return state;

    const completedHelpers = (state.steps || []).filter(
      (step) => step.type === 'helper' && step.resultDetails != null,
    );
    const completedMagiekunde = (state.steps || []).find(
      (step) => step.type === 'magiekunde' && step.resultDetails != null,
    );

    state.progress.totalMaxQS = MagicAnalysisService._computeTotalMaxQS(state.progress);
    state.steps = this.buildSteps(actor, state.progress, {
      finalized: state.finalized,
      magiekundeDone: !!completedMagiekunde,
    });

    for (const completed of completedHelpers) {
      if (state.steps.some((step) => step.stepId === completed.stepId)) continue;
      const magiekundeIdx = state.steps.findIndex((step) => step.type === 'magiekunde');
      state.steps.splice(magiekundeIdx >= 0 ? magiekundeIdx : state.steps.length, 0, {
        ...completed,
        optional: true,
        canRoll: false,
      });
    }

    if (completedMagiekunde) {
      const magiekunde = state.steps.find((step) => step.type === 'magiekunde');
      if (magiekunde) {
        magiekunde.status = completedMagiekunde.status;
        magiekunde.resultDetails = completedMagiekunde.resultDetails;
        magiekunde.canRoll = false;
      }
    }

    state.notPossible = state.progress.totalMaxQS === 0 && !state.steps.some((step) => step.canRoll);
    return state;
  }

  static async createRequest({ actor, analysisContext }) {
    const { informationUuid, parentUuid, infoContent } = analysisContext;

    const progress = this.initProgress(actor);
    const { designatedUser, status } = QueryOrchestrator.resolveDesignatedUser(actor);

    const state = {
      informationUuid,
      parentUuid: parentUuid || null,
      itemName: infoContent.name,
      actorId: actor.id,
      infoContent,
      progress,
      steps: this.buildSteps(actor, progress),
      finalized: false,
      notPossible: false,
      recipients: [{
        actorId: actor.id,
        designatedUserId: designatedUser?.id || null,
        status,
        resultDetails: null,
      }],
    };

    this.refreshAnalysisState(state);

    return QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
    });
  }

  static #resolveLinkUuid(state) {
    return state.parentUuid || state.informationUuid || state.itemUuid;
  }

  static #buildQueryPayload(state, { messageId, stepId, byGM = false } = {}) {
    return {
      messageId,
      stepId,
      actorId: state.actorId,
      ...(byGM ? { byGM: true } : {}),
    };
  }

  static async renderMessage(state) {
    const actor = game.actors.get(state.actorId);
    const actorEntry = state.recipients?.[0]
      ? {
        ...state.recipients[0],
        actorName: actor?.name || state.actorId,
        actorImg: RollRequestService.getActorPortrait(actor),
        designatedUserName: game.users.get(state.recipients[0].designatedUserId)?.name || '',
      }
      : null;

    const steps = (state.steps || []).map((step) => {
      const outcome = QueryOrchestrator.outcomeDisplay({ status: step.status });
      const rollTooltip = step.optional
        ? _loc('MAGICANALYSIS.rollOptional')
        : _loc('MAGICANALYSIS.rollRequired');
      const gmRollTooltip = step.optional
        ? `${_loc('DSAQUERIES.COMMANDS.rollOnBehalf')} (${_loc('MAGICANALYSIS.optional')})`
        : _loc('DSAQUERIES.COMMANDS.rollOnBehalf');
      return {
        ...step,
        resultLabel: outcome.resultIcon ? '' : this.buildStepResultLabel(step),
        resultIcon: outcome.resultIcon,
        resultIconClass: outcome.resultIconClass,
        resultTooltip: outcome.resultTooltip,
        resultSubLabel: outcome.resultSubLabel,
        resultRowClass: outcome.resultRowClass,
        rollTooltip,
        gmRollTooltip,
        canGMRoll: !state.finalized && step.canRoll,
      };
    });

    let itemLink = '';
    const linkUuid = this.#resolveLinkUuid(state);
    if (linkUuid) {
      const item = await fromUuid(linkUuid);
      if (item) itemLink = (await item.toAnchor()).outerHTML;
    }

    return await renderTemplate(this.TEMPLATE, {
      finalized: state.finalized,
      notPossible: state.notPossible,
      itemLink,
      actorEntry,
      steps,
      totalMaxQs: state.progress?.totalMaxQS || 0,
      approval: state.approval || null,
    });
  }

  static handleRenderMessage(msg, html) {
    const state = foundry.utils.getProperty(msg.message, 'flags.dsa5.magicAnalysisRequest');
    if (!state) return;

    const actor = game.actors.get(state.actorId);
    const recipient = state.recipients?.[0];
    const designatedUserId = recipient?.designatedUserId;
    const isOwner = !!actor?.isOwner;
    const isDesignated = designatedUserId === game.user.id;
    const canSelfRoll = isDesignated || (isOwner && !game.user.isGM);

    if (!game.user.isGM) {
      html.find('.roll-request-gm').remove();
    }

    const resultPlayerId = state.approval?.playerId || designatedUserId;
    if (!InformationQueryService.canViewInformationResult(resultPlayerId)) {
      html.find('.magic-analysis-result-block').remove();
    }

    html.find('.magic-analysis-step-row').each((_idx, element) => {
      const row = $(element);
      const rollBtn = row.find('.magic-analysis-action[data-action="roll"]');
      const gmBtn = row.find('.magic-analysis-action[data-action="rollOnBehalf"]');

      if (game.user.isGM) {
        // Avoid duplicate dice: GM uses roll-on-behalf; players use the owner roll button.
        rollBtn.remove();
      } else if (canSelfRoll) {
        gmBtn.remove();
      } else {
        rollBtn.remove();
        gmBtn.remove();
      }
    });
  }

  static buildStepResultLabel(step) {
    if (QueryOrchestrator.isIconResultStatus(step.status)) return '';
    if (['success', 'critical'].includes(step.status)) {
      const qs = step.resultDetails?.qualityStep;
      return `${_loc('CHARAbbrev.QS')} ${qs ?? 0}`;
    }
    return '';
  }

  static applyHelperResult(progress, helperKey, qualityStep) {
    const config = MagicAnalysisService.HELPER_SPELLS[helperKey];
    const cap = MagicAnalysisService._computeSpellCap(config.rule, qualityStep);
    const progressKey = `${helperKey}QS`;

    if (config.rule === 'analys') {
      progress.useAnalysCap = true;
      progress.spellsMaxQS = 0;
    }
    progress[progressKey] = cap;
    if (config.rule !== 'analys' && cap > progress.spellsMaxQS) progress.spellsMaxQS = cap;
    return cap;
  }

  static async #rollEnchantmentHelper(actor, step) {
    const sourceItem = actor.items.get(step.sourceItemId);
    if (!sourceItem) return { userId: game.user.id, status: 'error' };

    const result = await ItemEnchantment.roll(sourceItem, step.enchantmentId, {
      options: { subtitle: ` (${_loc('MAGICANALYSIS.subtitle')})` },
    });
    if (!result) return { userId: game.user.id, status: 'cancelled' };

    const config = MagicAnalysisService.HELPER_SPELLS[step.helperKey];
    const cap = MagicAnalysisService._computeSpellCap(config.rule, result.result.qualityStep);
    return {
      userId: game.user.id,
      status: 'success',
      resultDetails: {
        qualityStep: cap,
        rawQualityStep: result.result.qualityStep,
        successLevel: result.result.successLevel,
      },
    };
  }

  static async handleQuery(payload, queryContext = {}) {
    return QueryOrchestrator.runWithClientExpiry(
      () => this.#executeAnalysisQuery(payload),
      queryContext,
      {
        onExpire: () => QueryOrchestrator.closeOpenTestDialogsForActor(payload.actorId),
      },
    );
  }

  static async #executeAnalysisQuery(payload) {
    const actor = game.actors.get(payload.actorId);
    const message = game.messages.get(payload.messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const step = state.steps?.find((entry) => entry.stepId === payload.stepId);
    if (!actor || !step) {
      return { userId: game.user.id, status: 'error' };
    }

    if (state.finalized || !step.canRoll) {
      return { userId: game.user.id, status: 'error' };
    }

    const magiekundeDone = state.steps.some(
      (entry) => entry.type === 'magiekunde' && entry.resultDetails != null,
    );
    if (step.type === 'helper' && magiekundeDone) {
      return { userId: game.user.id, status: 'error' };
    }
    if (step.type === 'magiekunde' && MagicAnalysisService._computeTotalMaxQS(state.progress) <= 0) {
      return { userId: game.user.id, status: 'error' };
    }

    try {
      if (step.type === 'helper') {
        if (step.source === 'enchantment') {
          return await this.#rollEnchantmentHelper(actor, step);
        }

        const spell = actor.items.get(step.spellId);
        if (!spell) return { userId: game.user.id, status: 'error' };

        const setupData = await actor.setupSpell(spell, {
          subtitle: ` (${_loc('MAGICANALYSIS.subtitle')})`,
          speaker: MagicAnalysisService._getSpeaker(actor.id),
        }, undefined);

        const result = await actor.basicTest(setupData);
        if (!result) return { userId: game.user.id, status: 'cancelled' };

        const config = MagicAnalysisService.HELPER_SPELLS[step.helperKey];
        const cap = MagicAnalysisService._computeSpellCap(config.rule, result.result.qualityStep);
        return {
          userId: game.user.id,
          status: 'success',
          resultDetails: {
            qualityStep: cap,
            rawQualityStep: result.result.qualityStep,
            successLevel: result.result.successLevel,
          },
        };
      }

      if (step.type === 'magiekunde') {
        const skillName = MagicAnalysisService._magiekundeSkill();
        const skill = actor.items.find((i) => i.name === skillName && i.type === 'skill');
        if (!skill) return { userId: game.user.id, status: 'error' };

        const totalMaxQS = MagicAnalysisService._computeTotalMaxQS(state.progress);
        const setupData = await actor.setupSkill(skill, {
          subtitle: ` (${_loc('MAGICANALYSIS.subtitle')})`,
          speaker: MagicAnalysisService._getSpeaker(actor.id),
          modifier: state.infoContent?.modifier || 0,
        }, undefined);

        setupData.testData.opposable = false;
        const result = await actor.basicTest(setupData);
        if (!result) return { userId: game.user.id, status: 'cancelled' };

        let qs = result.result.qualityStep || 0;
        if (qs > totalMaxQS) qs = totalMaxQS;
        result.result.qualityStep = qs;

        const successLevel = result.result.successLevel || 0;
        const status = successLevel > 1 ? 'critical' : successLevel < -1 ? 'botch' : successLevel > 0 ? 'success' : 'failure';

        return {
          userId: game.user.id,
          status,
          resultDetails: { qualityStep: qs, successLevel },
          rollResult: result,
        };
      }

      return { userId: game.user.id, status: 'error' };
    } catch {
      return { userId: game.user.id, status: 'cancelled' };
    }
  }

  static async completeMagiekunde(messageId, state, rollResult) {
    const actor = game.actors.get(state.actorId);
    const recipient = state.recipients?.[0];
    const rolledQS = rollResult.result.qualityStep || 0;
    const successLevel = rollResult.result.successLevel || 0;
    const playerId = recipient?.designatedUserId || rollResult.userId || game.user.id;
    const playerUser = game.users.get(playerId);
    const skillName = state.infoContent?.skill || MagicAnalysisService._magiekundeSkill();

    const approvalData = await InformationQueryService.buildApprovalData(state.infoContent, {
      rolledQS,
      successLevel,
    });

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => {
      currentState.finalized = true;
      const magiekunde = currentState.steps.find((entry) => entry.type === 'magiekunde');
      if (magiekunde) {
        magiekunde.status = successLevel > 1 ? 'critical' : successLevel < -1 ? 'botch' : successLevel > 0 ? 'success' : 'failure';
        magiekunde.resultDetails = { qualityStep: rolledQS, successLevel };
        magiekunde.canRoll = false;
      }

      currentState.approval = {
        phase: 'pending',
        actorName: actor?.name || '',
        playerName: playerUser?.name || '',
        skillName,
        playerId,
        ...approvalData,
      };

      this.refreshAnalysisState(currentState);
      return currentState;
    });

    if (game.user.isGM) {
      void this.#promptAndApplyApproval(messageId);
    }
  }

  static async #promptAndApplyApproval(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (state.approval?.phase !== 'pending') return;

    let itemLink = '';
    const linkUuid = this.#resolveLinkUuid(state);
    if (linkUuid) {
      const item = await fromUuid(linkUuid);
      if (item) itemLink = (await item.toAnchor()).outerHTML;
    }

    const approval = state.approval;
    const dialogData = {
      actorName: approval.actorName,
      playerName: approval.playerName,
      itemLink,
      skillName: approval.skillName,
      qsEntries: approval.qsEntries,
      critText: approval.critText,
      botchText: approval.botchText,
      failText: approval.failText,
      critIncluded: approval.critIncluded,
      botchIncluded: approval.botchIncluded,
      failIncluded: approval.failIncluded,
      rolledQS: approval.rolledQS,
    };

    const infoName = state.itemName || state.infoContent?.name || '';
    const result = await InformationQueryService.promptApprovalDialog({
      dialogData,
      infoName,
      approvalData: approval,
    });

    if (result.status === 'approved') {
      await this.#applyApproval(messageId, result.selected);
    } else if (result.status !== 'expired') {
      await this.#rejectApproval(messageId);
    }
  }

  static async #applyApproval(messageId, selected) {
    if (!game.user.isGM) return;

    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (state.approval?.phase !== 'pending') return;

    const infoName = state.itemName || state.infoContent?.name || '';
    const resultHtml = await InformationQueryService.buildApprovedResultHtml(
      state.infoContent,
      selected,
      infoName,
    );

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => {
      if (currentState.approval?.phase !== 'pending') return currentState;
      currentState.approval.phase = 'approved';
      currentState.approval.resultHtml = resultHtml;
      return currentState;
    });
  }

  static async #rejectApproval(messageId) {
    if (!game.user.isGM) return;

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => {
      if (currentState.approval?.phase !== 'pending') return currentState;
      currentState.approval.phase = 'rejected';
      return currentState;
    });
  }

  static #serializeStepResult(result) {
    return {
      userId: result.userId,
      status: result.status,
      resultDetails: result.resultDetails ?? null,
      rollResult: result.rollResult ? {
        result: {
          qualityStep: result.rollResult.result?.qualityStep,
          successLevel: result.rollResult.result?.successLevel,
          messageId: result.rollResult.result?.messageId,
        },
      } : undefined,
    };
  }

  static async #submitStepResult(messageId, stepId, result) {
    if (!game.user.isGM) {
      game.socket.emit('system.dsa5', {
        type: 'magicAnalysisStepResult',
        payload: { messageId, stepId, result: this.#serializeStepResult(result) },
      });
      return;
    }

    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const step = state.steps?.find((entry) => entry.stepId === stepId);

    if (step?.type === 'magiekunde' && result.rollResult) {
      await this.completeMagiekunde(messageId, state, result.rollResult);
      return;
    }

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => {
      if (currentState.finalized) return currentState;

      const currentStep = currentState.steps.find((entry) => entry.stepId === stepId);
      if (!currentStep) return currentState;

      if (currentStep.type === 'helper' && result.status === 'success') {
        this.applyHelperResult(
          currentState.progress,
          currentStep.helperKey,
          result.resultDetails?.rawQualityStep ?? result.resultDetails?.qualityStep ?? 0,
        );
      }

      currentStep.status = result.status;
      currentStep.resultDetails = result.resultDetails ?? null;
      currentStep.canRoll = false;

      this.refreshAnalysisState(currentState);
      return currentState;
    });
  }

  static async handleRemoteStepResult({ messageId, stepId, result }) {
    if (!game.user.isGM) return;
    await this.#submitStepResult(messageId, stepId, result);
  }

  static async triggerRollFromCard(messageId, stepId, byGM = false) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    if (!state?.actorId) return;

    const result = await this.handleQuery(this.#buildQueryPayload(state, { messageId, stepId, byGM }));
    if (!result || result.status === 'cancelled') return;
    await this.#submitStepResult(messageId, stepId, result);
  }

  static async finalizeRequest(messageId) {
    await QueryOrchestrator.finalizeRequest(messageId);
  }

  static chatListeners(element) {
    bindClickListener(element, (ev) => this.#onChatActionClick(ev));
  }

  static #onChatActionClick(ev) {
    const button = ev.target.closest('.magic-analysis-action');
    if (!button) return;

    const action = button.dataset.action;
    const messageId = button.closest('.message')?.dataset.messageId;
    if (!messageId) return;

    switch (action) {
      case 'roll':
      case 'rollOnBehalf': {
        const stepId = button.dataset.stepId;
        if (!stepId) return;
        if (action === 'roll') void this.triggerRollFromCard(messageId, stepId);
        else if (game.user.isGM) void this.triggerRollFromCard(messageId, stepId, true);
        break;
      }
      case 'finalize':
        if (!game.user.isGM) return;
        void this.finalizeRequest(messageId);
        break;
    }
  }
}
