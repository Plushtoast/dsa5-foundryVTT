import DSA5_Utility from '../helpers/utility-dsa5.js';

const { duplicate } = foundry.utils;

export default class QueryOrchestrator {
  static #queries = new Map();
  static #messageQueues = new Map();

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

  static resolveDesignatedUser(actor) {
    const ownerPredicate = (user) => user.active && !user.isGM && actor?.testUserPermission?.(user, 'OWNER');
    const anyOwnerPredicate = (user) => !user.isGM && actor?.testUserPermission?.(user, 'OWNER');
    const designatedUser = game.users.getDesignatedUser ? game.users.getDesignatedUser(ownerPredicate) : game.users.find(ownerPredicate);
    const hasAnyOwner = game.users.some(anyOwnerPredicate);

    return {
      designatedUser,
      status: designatedUser ? 'pending' : hasAnyOwner ? 'offline' : 'unowned',
    };
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
        [`flags.dsa5.${query.flagKey}`]: nextState,
      });
    });

    this.#messageQueues.set(messageId, current);
    return current;
  }

  static async dispatchToRecipient(userId, queryType, payload, queryOptions = {}) {
    if (!userId) return undefined;

    const user = game.users.get(userId);
    if (!user) return undefined;

    if (typeof user.query !== 'function') {
      throw new Error(`User.query is unavailable for query ${queryType}`);
    }

    return await user.query(queryType, payload, queryOptions);
  }
}