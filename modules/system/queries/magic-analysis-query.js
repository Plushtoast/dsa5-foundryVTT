import QueryOrchestrator from './query-orchestrator.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import DSA5ChatAutoCompletion from '../sidebar/chat_autocompletion.js';
import MagicAnalysisService from '../magic-analysis/magic-analysis.js';
import InformationQueryService from './information-query.js';
import RollRequestService from './roll-request.js';
import { bindClickListener } from '../helpers/view_helper.js';
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
      selectionMode: 'single',
      showSourceToggle: true,
      title: 'MAGICANALYSIS.dialogTitle',
      entryFilter: (entry) => entry.isPlayerOwned || entry.isActiveCharacter,
      callback: ({ actorIds }) => {
        const actor = game.actors.get(actorIds[0]);
        if (actor) this.createRequest({ actor, analysisContext });
      },
    });
  }

  static initProgress(actor) {
    const progress = MagicAnalysisService.initProgress();
    progress.passiveMaxQS = MagicAnalysisService._systemEffectValue(actor, 'skillModifiers.magicAnalysis.max');
    progress.stackBonus = MagicAnalysisService._systemEffectValue(actor, 'skillModifiers.magicAnalysis.stack');
    return progress;
  }

  static buildSteps(actor, progress, { finalized = false } = {}) {
    const steps = [];

    for (const helper of MagicAnalysisService._listAvailableHelpers(actor)) {
      const progressKey = `${helper.key}QS`;
      const rolled = progress[progressKey] != null;
      const canRoll = !rolled && (helper.config.type === 'spell' ? actor.system.isMage : actor.system.isPriest);
      steps.push({
        stepId: `helper-${helper.key}`,
        type: 'helper',
        helperKey: helper.key,
        spellId: helper.item.id,
        name: helper.item.name,
        status: rolled ? 'success' : (canRoll ? 'pending' : 'skipped'),
        resultDetails: rolled ? { qualityStep: progress[progressKey] } : null,
        canRoll: !finalized && canRoll && !rolled,
      });
    }

    progress.totalMaxQS = MagicAnalysisService._computeTotalMaxQS(progress);
    const pendingHelpers = steps.some((step) => step.type === 'helper' && step.canRoll);

    steps.push({
      stepId: 'magiekunde',
      type: 'magiekunde',
      name: MagicAnalysisService._magiekundeSkill(),
      status: 'pending',
      resultDetails: null,
      canRoll: !finalized && progress.totalMaxQS > 0 && !pendingHelpers,
    });

    return steps;
  }

  static refreshAnalysisState(state) {
    const actor = game.actors.get(state.actorId);
    if (!actor) return state;

    state.progress.totalMaxQS = MagicAnalysisService._computeTotalMaxQS(state.progress);
    state.steps = this.buildSteps(actor, state.progress, { finalized: state.finalized });
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

    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
    });

    await this.dispatch(message.id);
    return message;
  }

  static async dispatch(messageId) {
    const message = game.messages.get(messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const recipient = state.recipients?.[0];
    if (!recipient?.designatedUserId || recipient.status !== 'pending') return;

    const pendingStep = state.steps?.find((step) => step.canRoll);
    if (!pendingStep) return;

    await this.dispatchStepQuery(messageId, pendingStep.stepId, recipient.designatedUserId, state);
  }

  static async dispatchStepQuery(messageId, stepId, userId, state) {
    try {
      const result = await QueryOrchestrator.dispatchToRecipient(
        userId,
        this.QUERY_TYPE,
        this.#buildQueryPayload(state, { messageId, stepId }),
      );
      if (!result || result.status === 'cancelled') return;
      await this.#submitStepResult(messageId, stepId, result);
    } catch (error) {
      console.error(`Failed to dispatch magic analysis step ${stepId}`, error);
    }
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

    const steps = (state.steps || []).map((step) => ({
      ...step,
      resultLabel: this.buildStepResultLabel(step),
      canGMRoll: !state.finalized && game.user.isGM && step.canRoll,
    }));

    let itemLink = '';
    const linkUuid = this.#resolveLinkUuid(state);
    if (linkUuid) {
      const item = await fromUuid(linkUuid);
      if (item) itemLink = (await item.toAnchor()).outerHTML;
    }

    return await renderTemplate(this.TEMPLATE, {
      isGM: game.user.isGM,
      finalized: state.finalized,
      notPossible: state.notPossible,
      itemLink,
      actorEntry,
      steps,
      totalMaxQs: state.progress?.totalMaxQS || 0,
    });
  }

  static buildStepResultLabel(step) {
    if (step.status === 'skipped') return _loc('DSAQUERIES.STATUS.skipped');
    if (['success', 'critical'].includes(step.status)) {
      const qs = step.resultDetails?.qualityStep;
      return `${_loc('CHARAbbrev.QS')} ${qs ?? 0}`;
    }
    if (step.status === 'failure') return _loc('DSAQUERIES.STATUS.failure');
    if (step.status === 'botch') return _loc('DSAQUERIES.STATUS.botch');
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

  static async handleQuery(payload) {
    const actor = game.actors.get(payload.actorId);
    const message = game.messages.get(payload.messageId);
    const state = duplicate(message?.getFlag('dsa5', this.FLAG_KEY) || {});
    const step = state.steps?.find((entry) => entry.stepId === payload.stepId);
    if (!actor || !step) {
      return { userId: game.user.id, status: 'error' };
    }

    try {
      if (step.type === 'helper') {
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
    const skillName = state.infoContent?.skill || MagicAnalysisService._magiekundeSkill();
    const skill = actor?.items.find((i) => i.name === skillName && i.type === 'skill');

    await InformationQueryService.createInformationQuery(
      rollResult,
      state.informationUuid || state.itemUuid,
      { name: state.infoContent.name, system: state.infoContent },
      {
        actor,
        skill: skill || { name: skillName },
        virtualInfo: state.infoContent,
        parentUuid: state.parentUuid,
      },
    );

    await QueryOrchestrator.enqueueMessageUpdate(messageId, async (currentState) => {
      currentState.finalized = true;
      const magiekunde = currentState.steps.find((entry) => entry.type === 'magiekunde');
      if (magiekunde) {
        const successLevel = rollResult.result.successLevel || 0;
        magiekunde.status = successLevel > 1 ? 'critical' : successLevel < -1 ? 'botch' : successLevel > 0 ? 'success' : 'failure';
        magiekunde.resultDetails = {
          qualityStep: rollResult.result.qualityStep,
          successLevel,
        };
        magiekunde.canRoll = false;
      }
      this.refreshAnalysisState(currentState);
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

    if (!game.messages.get(messageId)?.getFlag('dsa5', this.FLAG_KEY)?.finalized) {
      await this.dispatch(messageId);
    }
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
    const stepId = button.dataset.stepId;
    const messageId = button.closest('.message')?.dataset.messageId;
    if (!messageId || !stepId) return;

    switch (action) {
      case 'roll':
        void this.triggerRollFromCard(messageId, stepId);
        break;
      case 'rollOnBehalf':
        if (!game.user.isGM) return;
        void this.triggerRollFromCard(messageId, stepId, true);
        break;
      case 'finalize':
        if (!game.user.isGM) return;
        void this.finalizeRequest(messageId);
        break;
    }
  }
}
