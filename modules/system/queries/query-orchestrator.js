import DSA5_Utility from '../helpers/utility-dsa5.js';

const { duplicate } = foundry.utils;

export default class QueryOrchestrator {
  static #queries = new Map();
  static #messageQueues = new Map();

  static QUERY_TIMEOUT_MS = 120_000;
  /** Close/respond slightly before socket.io times out so the dialog can settle cleanly. */
  static QUERY_CLIENT_EXPIRY_BUFFER_MS = 1_500;
  static TERMINAL_STATES = new Set(['accepted', 'rejected', 'failed', 'skipped', 'success', 'critical', 'failure', 'botch', 'cancelled', 'error']);
  static STATUS_STYLES = {
    pending:   { icon: 'fa-spinner fa-spin',        colorClass: 'icon-gray' },
    accepted:  { icon: 'fa-check',                  colorClass: 'icon-green' },
    success:   { icon: 'fa-check',                  colorClass: 'icon-green' },
    critical:  { icon: 'fa-star',                   colorClass: 'icon-green' },
    rejected:  { icon: 'fa-times',                  colorClass: 'icon-red' },
    failure:   { icon: 'fa-times',                  colorClass: 'icon-red' },
    botch:     { icon: 'fa-skull-crossbones',        colorClass: 'icon-red' },
    cancelled: { icon: 'fa-ban',                    colorClass: 'icon-red' },
    failed:    { icon: 'fa-exclamation-triangle',   colorClass: 'icon-yellow' },
    error:     { icon: 'fa-exclamation-triangle',   colorClass: 'icon-yellow' },
    unowned:   { icon: 'fa-hand-paper',             colorClass: 'icon-yellow' },
    skipped:   { icon: 'fa-forward',                colorClass: 'icon-yellow' },
  };

  static RESULT_ROW_CLASSES = {
    critical: 'roll-request-row-critical',
    success: 'roll-request-row-success',
    botch: 'roll-request-row-botch',
    failure: 'roll-request-row-failure',
  };

  static RESULT_SUB_LABELS = {
    critical: 'CHARAbbrev.Crit',
    botch: 'CHARAbbrev.Botch',
  };

  static ICON_RESULT_STATUSES = new Set(['skipped', 'failure', 'botch']);

  static #DEFAULT_STYLE = { icon: 'fa-circle-question', colorClass: 'icon-gray' };

  static registerQuery(type, config) {
    CONFIG.queries ??= {};
    this.#queries.set(type, config);

    CONFIG.queries[type] = async (queryData, queryContext) => {
      const query = this.getQuery(type);
      return await query?.handleQuery?.(queryData, queryContext);
    };
  }

  static clientExpiryMs(timeoutMs = this.QUERY_TIMEOUT_MS) {
    const timeout = Number.isFinite(timeoutMs) ? timeoutMs : this.QUERY_TIMEOUT_MS;
    return Math.max(0, timeout - this.QUERY_CLIENT_EXPIRY_BUFFER_MS);
  }

  static isTimeoutError(error) {
    const message = error?.message || String(error || '');
    return /timed?\s*out|timeout/i.test(message);
  }

  static isSoftQueryFailure(error) {
    return this.isTimeoutError(error) || /disconnected/i.test(error?.message || '');
  }

  static notifyRequestExpired() {
    ui.notifications.warn('DSAQUERIES.NOTIFICATIONS.requestExpired', { localize: true });
  }

  static #activeQueryDialogs = new Set();

  /**
   * DialogV2.wait that registers the app so {@link #closeActiveQueryDialogs} / expiry can close it.
   * @param {object} config DialogV2.wait config
   * @param {{ signal?: AbortSignal }} [options]
   */
  static async waitDialog(config = {}, { signal } = {}) {
    let dialog;
    const closeOnAbort = () => { void dialog?.close(); };

    if (signal) {
      if (signal.aborted) return null;
      signal.addEventListener('abort', closeOnAbort, { once: true });
    }

    try {
      return await foundry.applications.api.DialogV2.wait({
        ...config,
        render: (event, app) => {
          dialog = app;
          this.#activeQueryDialogs.add(app);
          config.render?.(event, app);
        },
        close: (event, app) => {
          this.#activeQueryDialogs.delete(app);
          return config.close?.(event, app);
        },
      });
    } catch (error) {
      if (signal?.aborted) return null;
      throw error;
    } finally {
      signal?.removeEventListener('abort', closeOnAbort);
    }
  }

  static closeActiveQueryDialogs() {
    for (const app of [...this.#activeQueryDialogs]) {
      void app.close();
    }
    this.#activeQueryDialogs.clear();
  }

  static closeMatchingApplications(predicate) {
    for (const app of foundry.applications.instances.values()) {
      if (predicate(app)) void app.close();
    }
  }

  /** Close open DSA test dialogs for an actor (skill/spell/etc. roll windows). */
  static closeOpenTestDialogsForActor(actorId) {
    if (!actorId) return;
    this.closeMatchingApplications((app) => {
      const speakerActor = app.testData?.extra?.speaker?.actor ?? app.dialogData?.speaker?.actor;
      return speakerActor === actorId;
    });
  }

  /**
   * Race a query handler against the client expiry window.
   * On expiry: closes tracked query dialogs, runs onExpire, notifies, returns null.
   * @param {(signal: AbortSignal) => Promise<*>} execute
   * @param {{ timeout?: number }} [queryContext]
   * @param {{ onExpire?: (signal: AbortSignal) => void|Promise<void> }} [options]
   */
  static async runWithClientExpiry(execute, queryContext = {}, { onExpire } = {}) {
    const abortController = new AbortController();
    const timeoutMs = queryContext.timeout ?? this.QUERY_TIMEOUT_MS;
    const expiryMs = this.clientExpiryMs(timeoutMs);

    let expireTimer;
    const expired = new Promise((resolve) => {
      expireTimer = setTimeout(() => {
        abortController.abort('expired');
        resolve({ expired: true });
      }, expiryMs);
    });

    try {
      const outcome = await Promise.race([
        Promise.resolve()
          .then(() => execute(abortController.signal))
          .then((result) => ({ result })),
        expired,
      ]);

      if (outcome.expired || abortController.signal.aborted) {
        this.closeActiveQueryDialogs();
        await onExpire?.(abortController.signal);
        this.notifyRequestExpired();
        return null;
      }

      return outcome.result;
    } finally {
      clearTimeout(expireTimer);
    }
  }

  /**
   * Dispatch a user query. Timeout/disconnect leaves the chat card pending (returns null result path).
   * @param {object} options
   * @param {string} options.userId
   * @param {string} options.queryType
   * @param {object} options.payload
   * @param {(result: *) => void|Promise<void>} [options.onResult]
   * @param {(error: Error) => void|Promise<void>} [options.onHardError]
   * @param {string} [options.label]
   * @param {object} [options.queryOptions]
   * @returns {Promise<{ status: 'ok'|'expired'|'error', result?: *, error?: Error }>}
   */
  static async dispatchRecipientQuery({
    userId,
    queryType,
    payload,
    onResult,
    onHardError,
    label = queryType,
    queryOptions = {},
  }) {
    try {
      const result = await this.dispatchToRecipient(userId, queryType, payload, queryOptions);
      if (result == null) return { status: 'expired' };
      if (onResult) await onResult(result);
      return { status: 'ok', result };
    } catch (error) {
      if (this.isSoftQueryFailure(error)) {
        console.warn(`${label} query expired: ${error?.message || error}`);
        return { status: 'expired' };
      }
      console.error(`Failed to query ${label}`, error);
      if (onHardError) await onHardError(error);
      return { status: 'error', error };
    }
  }

  static getQuery(type) {
    return this.#queries.get(type);
  }

  static statusStyle(status) {
    const { icon, colorClass } = this.STATUS_STYLES[status] || this.#DEFAULT_STYLE;
    return { icon, colorClass, label: _loc(`DSAQUERIES.STATUS.${status}`) };
  }

  static statusFromSuccessLevel(successLevel = 0) {
    if (successLevel > 1) return 'critical';
    if (successLevel > 0) return 'success';
    if (successLevel < -1) return 'botch';
    if (successLevel < 0) return 'failure';
    return '';
  }

  static resultRowClass(status) {
    return this.RESULT_ROW_CLASSES[status] || '';
  }

  static allResultRowClasses() {
    return Object.values(this.RESULT_ROW_CLASSES).join(' ');
  }

  static isIconResultStatus(status) {
    return this.ICON_RESULT_STATUSES.has(status);
  }

  /**
   * Shared chat-row outcome presentation for roll request, group check, information, etc.
   * @param {{ status?: string, successLevel?: number, detail?: string }} [options]
   * @returns {{ status: string, resultRowClass: string, resultTooltip: string, resultSubLabel: string, resultIcon: string, resultIconClass: string }}
   */
  static outcomeDisplay({ status, successLevel, detail } = {}) {
    const resolvedStatus = status || this.statusFromSuccessLevel(successLevel) || '';
    const resultRowClass = this.resultRowClass(resolvedStatus);
    const subLabelKey = this.RESULT_SUB_LABELS[resolvedStatus];
    const resultSubLabel = subLabelKey ? _loc(subLabelKey) : '';
    const statusStyle = this.statusStyle(resolvedStatus);
    const useIcon = this.isIconResultStatus(resolvedStatus);

    let resultTooltip = '';
    if (resolvedStatus === 'critical') resultTooltip = _loc('CriticalSuccess');
    else if (resolvedStatus === 'botch') resultTooltip = _loc('CriticalFailure');
    else if (['success', 'failure', 'skipped'].includes(resolvedStatus)) {
      resultTooltip = statusStyle.label;
    }

    if (detail) {
      resultTooltip = resultTooltip ? `${resultTooltip} — ${detail}` : detail;
    }

    return {
      status: resolvedStatus,
      resultRowClass,
      resultTooltip,
      resultSubLabel,
      resultIcon: useIcon ? statusStyle.icon : '',
      resultIconClass: useIcon ? statusStyle.colorClass : '',
    };
  }

  static activeCharacterActors() {
    const actors = new Map();
    for (const user of game.users.filter((entry) => entry.active && entry.character)) {
      actors.set(user.character.id, user.character);
    }
    return Array.from(actors.values());
  }

  static resolveDesignatedUser(actor) {
    let activeOwner = null;

    for (const u of game.users) {
      if (u.isGM) continue;

      if (u.active && u.character?.id === actor.id) {
        return { designatedUser: u, status: 'pending' };
      }

      if (u.active && actor.testUserPermission(u, 'OWNER')) {
        activeOwner ??= u;
      }
    }

    if (activeOwner) return { designatedUser: activeOwner, status: 'pending' };
    return { designatedUser: null, status: 'unowned' };
  }

  static async createRequest({ queryType, state, whisper = undefined }) {
    const query = this.getQuery(queryType);
    if (!query) throw new Error(`Unknown query type ${queryType}`);

    const content = await query.renderMessage(state);
    const chatData = DSA5_Utility.chatDataSetup(content, 'roll');
    if (whisper) chatData.whisper = whisper;

    chatData.flags = {
      dsa5: {
        queryRequest: {
          type: queryType,
        },
        [query.flagKey]: state,
      },
    };

    return await ChatMessage.create(chatData);
  }

  static async enqueueMessageUpdate(messageId, callback) {
    const previous = this.#messageQueues.get(messageId) || Promise.resolve();
    const current = previous.catch(() => undefined).then(async () => {
      const message = game.messages.get(messageId);
      if (!message) return;

      const requestMeta = message.getFlag('dsa5', 'queryRequest');
      if (!requestMeta?.type) return;

      const query = this.getQuery(requestMeta.type);
      if (!query) return;

      const existingState = duplicate(message.getFlag('dsa5', query.flagKey) || {});
      const nextState = await callback(existingState, message, query);
      if (!nextState) return;

      const content = await query.renderMessage(nextState, message);
      await message.update({
        content,
        timestamp: Date.now(),
        [`flags.dsa5.${query.flagKey}`]: nextState,
      });
    });

    this.#messageQueues.set(messageId, current);
    return current;
  }

  static async buildRecipients(actors) {
    const recipients = [];
    const seen = new Set();

    for (const actor of actors.filter(Boolean)) {
      if (seen.has(actor.id)) continue;
      seen.add(actor.id);

      const { designatedUser, status } = this.resolveDesignatedUser(actor);
      recipients.push({
        actorId: actor.id,
        designatedUserId: designatedUser?.id || null,
        status,
        resultDetails: null,
      });
    }

    return recipients;
  }

  static async handleResult({ messageId, actorId, result }) {
    if (!game.user.isGM) {
      game.socket.emit('system.dsa5', {
        type: 'queryResult',
        payload: { messageId, actorId, result },
      });
      return;
    }

    await this.enqueueMessageUpdate(messageId, async (state) => {
      const recipient = state.recipients.find((entry) => entry.actorId === actorId);
      if (!recipient) return state;

      const linkedRollId = result.resultDetails?.messageId;
      const isLinkedRollRefresh = state.finalized
        && linkedRollId
        && recipient.resultDetails?.messageId === linkedRollId;

      if (state.finalized && !isLinkedRollRefresh) return state;
      if (this.TERMINAL_STATES.has(recipient.status) && !isLinkedRollRefresh) return state;

      recipient.status = result.status;
      recipient.resultDetails = result.resultDetails ?? null;
      recipient.designatedUserId = recipient.designatedUserId || result.userId || null;

      if (!state.finalized && this.canAutoFinalize(state)) state.finalized = true;
      return state;
    });
  }

  static canAutoFinalize(state) {
    return state.recipients.every((entry) => this.TERMINAL_STATES.has(entry.status));
  }

  static async finalizeRequest(messageId) {
    await this.enqueueMessageUpdate(messageId, async (state) => {
      state.finalized = true;
      return state;
    });
  }

  static attachRowContextMenu(html, selector, getMenuItems) {
    new foundry.applications.ux.ContextMenu(html[0] || html, selector, [], {
      eventName: 'contextmenu',
      onOpen: (target) => {
        const el = target instanceof HTMLElement ? target : target[0];
        const actorId = el?.dataset?.actorId;
        const status = el?.dataset?.status;
        const messageId = el?.closest('.message')?.dataset?.messageId;
        ui.context.menuItems = messageId ? (getMenuItems(messageId, actorId, status) || []) : [];
      },
      jQuery: false,
      fixed: true,
    });
  }

  static attachRowEllipsisMenu(html, buttonSelector, rowSelector, getMenuItems) {
    $(html).on('click', buttonSelector, async (event) => {
      const button = event.currentTarget;
      const row = button.closest(rowSelector);
      const actorId = row?.dataset?.actorId;
      const status = row?.dataset?.status;
      const messageId = button.closest('.message')?.dataset?.messageId;
      if (!messageId || !actorId) return;

      const items = getMenuItems(messageId, actorId, status) || [];
      if (!items.length) return;

      const container = button.closest('.dsa5') || button.closest('.message');
      const menu = new foundry.applications.ux.ContextMenu(container, '', items, { jQuery: false, fixed: true, eventName: 'none' });
      ui.context?.close();
      await menu.render(button, { animate: true });
      ui.context = menu;
    });
  }

  static async dispatchToRecipient(userId, queryType, payload, queryOptions = {}) {
    if (!userId) return undefined;

    const user = game.users.get(userId);
    if (!user) return undefined;

    if (typeof user.query !== 'function') {
      throw new Error(`User.query is unavailable for query ${queryType}`);
    }

    return await user.query(queryType, payload, { timeout: this.QUERY_TIMEOUT_MS, ...queryOptions });
  }
}