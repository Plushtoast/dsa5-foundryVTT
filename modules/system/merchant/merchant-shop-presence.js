import QueryOrchestrator from '../queries/query-orchestrator.js';

/**
 * Tracks who currently has a merchant player-view / limited shop sheet open.
 * Players ping join/leave; GM opening the shop also queries active users.
 */
export default class MerchantShopPresence {
  static QUERY_TYPE = 'dsa5.merchantShopPresence';
  static SOCKET_TYPE = 'merchantShopPresence';
  static GM_AVATAR = 'systems/dsa5/icons/categories/DSA-Auge.webp';

  /** @type {Map<string, Map<string, object>>} merchantId → userId → viewer */
  static #byMerchant = new Map();

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      handleQuery: this.handleQuery.bind(this),
    });
    Hooks.on('userConnected', (user, connected) => {
      if (connected) return;
      this.#removeUserEverywhere(user.id);
    });
  }

  static handleQuery({ merchantId } = {}) {
    if (!merchantId || !this.isLocallyViewing(merchantId)) return null;
    return this.buildLocalViewer();
  }

  static socketListener(data) {
    if (data?.type !== this.SOCKET_TYPE) return false;
    this.#handleRemote(data.payload || {});
    return true;
  }

  static buildLocalViewer() {
    if (game.user.isGM) {
      return {
        userId: game.user.id,
        isGM: true,
        img: this.GM_AVATAR,
        name: game.user.name,
      };
    }
    const actor = game.user.character;
    return {
      userId: game.user.id,
      isGM: false,
      actorId: actor?.id || null,
      img: actor?.img || game.user.avatar || 'icons/svg/mystery-man.svg',
      name: actor?.name || game.user.name,
    };
  }

  static isLocallyViewing(merchantId) {
    if (!merchantId) return false;
    for (const app of foundry.applications.instances.values()) {
      if (app.actor?.id !== merchantId) continue;
      if (typeof app.tracksShopPresence === 'function' && app.tracksShopPresence()) return true;
    }
    return false;
  }

  static viewersFor(merchantId) {
    const map = this.#byMerchant.get(merchantId);
    if (!map?.size) return [];
    return [...map.values()]
      .filter((viewer) => viewer.userId !== game.user.id)
      .sort((a, b) => {
        if (a.isGM !== b.isGM) return a.isGM ? -1 : 1;
        return String(a.name || '').localeCompare(String(b.name || ''), game.i18n.lang);
      });
  }

  /**
   * Call from merchant player-view sheet render. Joins once, GM also queries.
   * @param {string} merchantId
   * @param {{ didJoin?: boolean, closing?: boolean }} state sheet instance flag bag
   */
  static async ensureJoined(merchantId, state = {}) {
    if (!merchantId || state.closing) return;
    const viewer = this.buildLocalViewer();
    this.#set(merchantId, viewer);
    if (state.didJoin) return;
    state.didJoin = true;
    if (game.user.isGM) await this.#queryOthers(merchantId);
    this.#broadcast('join', merchantId, viewer);
    this.#refreshSheets(merchantId);
  }

  static async leave(merchantId, state = {}) {
    if (!merchantId || !state.didJoin) return;
    state.didJoin = false;
    this.#delete(merchantId, game.user.id);
    this.#broadcast('leave', merchantId, { userId: game.user.id });
    // Do not refresh locally here: a still-open sheet would re-run ensureJoined and re-join.
  }

  static #handleRemote({ action, merchantId, viewer } = {}) {
    if (!merchantId) return;
    if (action === 'join' && viewer?.userId) {
      const wasKnown = this.#byMerchant.get(merchantId)?.has(viewer.userId);
      this.#set(merchantId, viewer);
      this.#refreshSheets(merchantId);
      if (!wasKnown && viewer.userId !== game.user.id && this.isLocallyViewing(merchantId)) {
        this.#broadcast('join', merchantId, this.buildLocalViewer());
      }
      return;
    }
    if (action === 'leave' && viewer?.userId) {
      this.#delete(merchantId, viewer.userId);
      this.#refreshSheets(merchantId);
    }
  }

  static async #queryOthers(merchantId) {
    const users = game.users.filter((user) => user.active && user.id !== game.user.id);
    const results = await Promise.all(users.map(async (user) => {
      try {
        return await QueryOrchestrator.dispatchToRecipient(user.id, this.QUERY_TYPE, { merchantId }, { timeout: 4000 });
      } catch {
        return null;
      }
    }));
    for (const viewer of results) {
      if (viewer?.userId) this.#set(merchantId, viewer);
    }
  }

  static #broadcast(action, merchantId, viewer) {
    game.socket.emit('system.dsa5', {
      type: this.SOCKET_TYPE,
      payload: { action, merchantId, viewer },
    });
  }

  static #set(merchantId, viewer) {
    if (!merchantId || !viewer?.userId) return;
    let map = this.#byMerchant.get(merchantId);
    if (!map) {
      map = new Map();
      this.#byMerchant.set(merchantId, map);
    }
    map.set(viewer.userId, viewer);
  }

  static #delete(merchantId, userId) {
    const map = this.#byMerchant.get(merchantId);
    if (!map) return;
    map.delete(userId);
    if (!map.size) this.#byMerchant.delete(merchantId);
  }

  static #removeUserEverywhere(userId) {
    for (const [merchantId, map] of this.#byMerchant) {
      if (!map.has(userId)) continue;
      map.delete(userId);
      if (!map.size) this.#byMerchant.delete(merchantId);
      this.#refreshSheets(merchantId);
    }
  }

  static #refreshSheets(merchantId) {
    for (const app of foundry.applications.instances.values()) {
      if (app.actor?.id !== merchantId) continue;
      if (typeof app.tracksShopPresence !== 'function' || !app.tracksShopPresence()) continue;
      // Epic/Garadan player view has no header part; static PARTS.header still exists.
      if (!app.rendered || !app.parts?.header) continue;
      app.render({ parts: ['header'] });
    }
  }
}
