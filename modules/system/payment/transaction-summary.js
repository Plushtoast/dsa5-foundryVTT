import QueryOrchestrator from '../queries/query-orchestrator.js';
import DSA5Payment from './payment.js';
import DSA5_Utility from '../helpers/utility-dsa5.js';

const { renderTemplate } = foundry.applications.handlebars;

export default class TransactionSummaryService {
  static QUERY_TYPE = 'dsa5.transactionSummary';
  static FLAG_KEY = 'transactionSummary';
  static TEMPLATE = 'systems/dsa5/templates/chat/payment/transaction-summary.hbs';
  static #merchantSessions = new Map();

  static register() {
    QueryOrchestrator.registerQuery(this.QUERY_TYPE, {
      flagKey: this.FLAG_KEY,
      renderMessage: this.renderMessage.bind(this),
      handleQuery: async () => undefined,
    });
  }

  static notificationMode(mode = undefined) {
    return Number(mode ?? game.settings.get('dsa5', 'merchantNotification') ?? 0);
  }

  static shouldCreateSummary(mode = undefined) {
    return DSA5_Utility.isActiveGM(true) && this.notificationMode(mode) > 0;
  }

  static notificationRecipients(mode = undefined) {
    return this.notificationMode(mode) === 2 ? ChatMessage.getWhisperRecipients('GM').map((user) => user.id) : undefined;
  }

  static async moneyString(amount) {
    const numericAmount = Number(amount) || 0;
    return await DSA5Payment._moneyToString(numericAmount);
  }

  static async normalizeTransferItem({ item, quantity, totalPrice }) {
    const count = Number(quantity) || 0;
    if (!item?.name || count <= 0) return undefined;

    const resolvedPrice = Number(totalPrice ?? DSA5_Utility.itemPrice(item) * count) || 0;
    let linkHtml = item.name;
    if (item?.uuid && typeof item.toAnchor === 'function') {
      linkHtml = item.toAnchor({ icon: false }).outerHTML;
    }

    return {
      name: item.name,
      img: item.img,
      quantity: count,
      priceHtml: await this.moneyString(resolvedPrice),
      linkHtml,
    };
  }

  static async normalizeTransferGroup(group) {
    const items = [];
    for (const item of group.items || []) {
      const normalized = await this.normalizeTransferItem(item);
      if (normalized) items.push(normalized);
    }

    const actorName = group.actorName || '';
    const heading = group.heading
      || (actorName ? _loc('PAYMENT.receivedHeading', { name: actorName }) : '');

    return {
      actorName,
      heading,
      items,
    };
  }

  static participantsHtml(state) {
    return `${state.sourceName} <i class="fas fa-right-left"></i> ${state.targetName}`;
  }

  static async renderMessage(state) {
    const transfers = [];
    for (const transfer of state.transfers || []) {
      const normalized = await this.normalizeTransferGroup(transfer);
      if (normalized.items.length) transfers.push(normalized);
    }

    return await renderTemplate(this.TEMPLATE, {
      title: state.title,
      participantsHtml: this.participantsHtml(state),
      transfers,
    });
  }

  static async createMessage(state, whisper = undefined) {
    const message = await QueryOrchestrator.createRequest({
      queryType: this.QUERY_TYPE,
      state,
      whisper,
    });
    return message.id;
  }

  static merchantSessionKey(source, target) {
    return ['merchant', source.id, target.id].sort().join(':');
  }

  static getMerchantSession(source, target) {
    if (!source?.id || !target?.id) return null;
    return this.#merchantSessions.get(this.merchantSessionKey(source, target)) || null;
  }

  static emptyTradeLog() {
    return {
      hasEntries: false,
      buys: { heading: '', lines: [] },
      sells: { heading: '', lines: [] },
    };
  }

  /**
   * Build buy/sell sections for the stall trade log.
   * Headings use the trading character (session source), e.g. "Alice bought" / "Alice sold".
   */
  static async listSessionLines(session) {
    if (!session?.transfers?.length) return this.emptyTradeLog();

    const traderName = session.sourceName || '';
    const buys = [];
    const sells = [];

    for (const transfer of session.transfers) {
      for (const entry of transfer.items || []) {
        const normalized = await this.normalizeTransferItem(entry);
        if (!normalized) continue;
        const line = {
          ...normalized,
          actorName: transfer.actorName,
          buy: !!transfer.buy,
        };
        if (transfer.buy) buys.push(line);
        else sells.push(line);
      }
    }

    return {
      hasEntries: buys.length > 0 || sells.length > 0,
      buys: {
        heading: _loc('MERCHANT.stall.tradeLogBought', { name: traderName }),
        lines: buys,
      },
      sells: {
        heading: _loc('MERCHANT.stall.tradeLogSold', { name: traderName }),
        lines: sells,
      },
    };
  }

  /** Buffer a line item; chat summary is emitted when the merchant sheet closes. */
  static async recordMerchantTransaction({ source, target, notify, item, receivedItem, amount, price, buy }) {
    const mode = this.notificationMode(notify);
    const sessionKey = this.merchantSessionKey(source, target);
    const existing = this.#merchantSessions.get(sessionKey) || {
      sourceId: source.id,
      targetId: target.id,
      sourceName: source.name,
      targetName: target.name,
      notify: mode,
      transfers: [],
    };

    existing.notify = mode;
    const receiverName = buy ? source.name : target.name;
    existing.transfers.push({
      actorName: receiverName,
      buy: !!buy,
      items: [{ item: receivedItem || item, quantity: amount, totalPrice: price }],
    });

    this.#merchantSessions.set(sessionKey, existing);
    Hooks.callAll('dsa5.merchantTransactionRecorded', {
      sourceId: source.id,
      targetId: target.id,
      sessionKey,
    });
  }

  /** Flush all open merchant sessions that involve this actor (sheet close). */
  static async finalizeSessionsForActor(actorId) {
    if (!actorId) return;
    const keys = [...this.#merchantSessions.entries()]
      .filter(([, session]) => session.sourceId === actorId || session.targetId === actorId)
      .map(([key]) => key);
    for (const key of keys) await this.finalizeMerchantSummary(key);
  }

  /** Drop session buffers without posting chat (non-GM sheet close). */
  static clearSessionsForActor(actorId) {
    if (!actorId) return;
    for (const [key, session] of this.#merchantSessions.entries()) {
      if (session.sourceId === actorId || session.targetId === actorId) {
        this.#merchantSessions.delete(key);
      }
    }
  }

  static async finalizeMerchantSummary(sessionKey) {
    const session = this.#merchantSessions.get(sessionKey);
    if (!session?.transfers?.length) {
      this.#merchantSessions.delete(sessionKey);
      return;
    }

    const shouldChat = this.shouldCreateSummary(session.notify);
    if (!shouldChat) {
      this.#merchantSessions.delete(sessionKey);
      return;
    }

    const traderName = session.sourceName || '';
    const buyMap = new Map();
    const sellMap = new Map();

    for (const transfer of session.transfers) {
      const itemMap = transfer.buy ? buyMap : sellMap;
      for (const item of transfer.items) {
        const name = item.item?.name || '';
        if (itemMap.has(name)) {
          const existing = itemMap.get(name);
          existing.quantity += Number(item.quantity) || 0;
          existing.totalPrice = String((Number(existing.totalPrice) || 0) + (Number(item.totalPrice) || 0));
        } else {
          itemMap.set(name, { ...item, quantity: Number(item.quantity) || 0 });
        }
      }
    }

    const aggregatedTransfers = [];
    if (buyMap.size) {
      aggregatedTransfers.push({
        heading: _loc('MERCHANT.stall.tradeLogBought', { name: traderName }),
        actorName: traderName,
        buy: true,
        items: [...buyMap.values()],
      });
    }
    if (sellMap.size) {
      aggregatedTransfers.push({
        heading: _loc('MERCHANT.stall.tradeLogSold', { name: traderName }),
        actorName: traderName,
        buy: false,
        items: [...sellMap.values()],
      });
    }

    await this.createMessage(
      {
        kind: 'merchant',
        status: 'completed',
        title: _loc('PAYMENT.summaryMerchantTitle'),
        sourceName: session.sourceName,
        targetName: session.targetName,
        transfers: aggregatedTransfers,
      },
      this.notificationRecipients(session.notify),
    );

    this.#merchantSessions.delete(sessionKey);
  }

  static async ensureTradeSummary(data) {
    return data?.id;
  }

  static async updateTradeOffer({ id, trader, offered }) {
    return { id, trader, offered };
  }

  static async updateTradeAcceptance({ id, trader, accepted }) {
    return { id, trader, accepted };
  }

  static async finalizeTradeSummary(tradeData, status, transfers = []) {
    const mode = this.notificationMode();
    if (!this.shouldCreateSummary(mode) || status !== 'completed' || !transfers.length) return;

    const source = DSA5_Utility.getSpeaker(tradeData.sourceId);
    const target = DSA5_Utility.getSpeaker(tradeData.targetId);
    if (!source || !target) return;

    await this.createMessage(
      {
        kind: 'trade',
        status: 'completed',
        title: _loc('PAYMENT.summaryTradeTitle'),
        sourceName: source.name,
        targetName: target.name,
        sessionId: tradeData.id,
        sourceId: tradeData.sourceId,
        targetId: tradeData.targetId,
        transfers,
      },
      this.notificationRecipients(mode),
    );
  }
}
