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
    return {
      name: item.name,
      quantity: count,
      priceHtml: await this.moneyString(resolvedPrice),
      linkHtml: item?.uuid ? item.toAnchor().outerHTML : item.name,
    };
  }

  static async normalizeTransferGroup(group) {
    const items = [];
    for (const item of group.items || []) {
      const normalized = await this.normalizeTransferItem(item);
      if (normalized) items.push(normalized);
    }

    return {
      actorName: group.actorName,
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

  static async recordMerchantTransaction({ source, target, notify, item, receivedItem, amount, price, buy }) {
    const mode = this.notificationMode(notify);
    if (!this.shouldCreateSummary(mode)) return;

    const sessionKey = this.merchantSessionKey(source, target);
    const existing = this.#merchantSessions.get(sessionKey) || {
      sourceName: source.name,
      targetName: target.name,
      notify: mode,
      transfers: [],
      timeout: null,
    };

    const receiverName = buy ? source.name : target.name;
    existing.transfers.push({
      actorName: receiverName,
      items: [{ item: receivedItem || item, quantity: amount, totalPrice: price }],
    });

    this.#merchantSessions.set(sessionKey, existing);

    this.resetMerchantFinalizeTimer(sessionKey);
  }

  static resetMerchantFinalizeTimer(sessionKey) {
    const session = this.#merchantSessions.get(sessionKey);
    if (!session) return;

    if (session.timeout) clearTimeout(session.timeout);
    session.timeout = setTimeout(() => {
      this.finalizeMerchantSummary(sessionKey);
    }, 30000);
  }

  static async finalizeMerchantSummary(sessionKey) {
    const session = this.#merchantSessions.get(sessionKey);
    if (!session?.transfers?.length) return;

    const byActor = new Map();
    for (const transfer of session.transfers) {
      if (!byActor.has(transfer.actorName)) {
        byActor.set(transfer.actorName, new Map());
      }
      const itemMap = byActor.get(transfer.actorName);
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
    for (const [actorName, itemMap] of byActor) {
      aggregatedTransfers.push({ actorName, items: [...itemMap.values()] });
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

    if (session.timeout) clearTimeout(session.timeout);
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