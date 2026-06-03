import DSA5_Utility from '../helpers/utility-dsa5.js';

const { duplicate } = foundry.utils;

export default class QueryOrchestrator {
  static #queries = new Map();
  static #messageQueues = new Map();

  static QUERY_TIMEOUT_MS = 120_000;
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

  static #DEFAULT_STYLE = { icon: 'fa-circle-question', colorClass: 'icon-gray' };

  static registerQuery(type, config) {
    CONFIG.queries ??= {};
    this.#queries.set(type, config);

    CONFIG.queries[type] = async (queryData) => {
      const query = this.getQuery(type);
      return await query?.handleQuery?.(queryData);
    };
  }

  static getQuery(type) {
    return this.#queries.get(type);
  }

  static statusStyle(status) {
    const { icon, colorClass } = this.STATUS_STYLES[status] || this.#DEFAULT_STYLE;
    return { icon, colorClass, label: _loc(`DSAQUERIES.STATUS.${status}`) };
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
      if (!recipient || state.finalized) return state;

      recipient.status = result.status;
      recipient.resultDetails = result.resultDetails ?? null;
      recipient.designatedUserId = recipient.designatedUserId || result.userId || null;

      if (this.canAutoFinalize(state)) state.finalized = true;
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