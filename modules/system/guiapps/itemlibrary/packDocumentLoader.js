/**
 * Loads compendium documents for the item library without extra getIndex fields.
 *
 * Modes:
 * - bulk: one getDocuments() per pack, all packs in parallel (default, fastest)
 * - chunked: ID chunks and limited concurrency (stabler on slow internet sockets)
 */
export default class ItemLibraryPackLoader {
  static WORKER_BATCH_SIZE = 200;

  static CHUNK_SIZES = {
    Item: 80,
    Actor: 20,
    JournalEntry: 20,
    ActiveEffect: 80,
  };

  static configuredMode() {
    try {
      return game.settings?.get('dsa5', 'libraryIndexLoadMode') || 'bulk';
    } catch (err) {
      return 'bulk';
    }
  }

  static resolveMode(setting = this.configuredMode()) {
    return setting === 'chunked' ? 'chunked' : 'bulk';
  }

  static packConcurrency(mode) {
    return this.resolveMode(mode) === 'bulk' ? Number.POSITIVE_INFINITY : 2;
  }

  static otherMode(mode = this.resolveMode()) {
    return this.resolveMode(mode) === 'bulk' ? 'chunked' : 'bulk';
  }

  static chunk(ids, size) {
    const chunks = [];
    const step = Math.max(1, size);
    for (let i = 0; i < ids.length; i += step) chunks.push(ids.slice(i, i + step));
    return chunks;
  }

  static async mapPool(items, limit, iterator, signal) {
    if (!items.length) return [];
    const results = new Array(items.length);
    let next = 0;
    const worker = async () => {
      while (next < items.length) {
        if (signal?.aborted) return;
        const i = next++;
        results[i] = await iterator(items[i], i);
      }
    };
    const n = Math.min(Math.max(limit, 1), items.length);
    await Promise.all(Array.from({ length: n }, () => worker()));
    return results;
  }

  static collectLoadIds(pack, { skipTypes = [] } = {}) {
    const skip = new Set(skipTypes);
    const ids = [];
    for (const entry of pack.index) {
      if (skip.has(entry.type)) continue;
      if (pack.has(entry._id)) continue;
      ids.push(entry._id);
    }
    return ids;
  }

  static skipTypesFor(documentName) {
    if (documentName === 'Item') return ['information'];
    if (documentName === 'ActiveEffect') return ['base'];
    return [];
  }

  static bulkQuery(documentName, skipTypes) {
    const skip = skipTypes ?? this.skipTypesFor(documentName);
    if (documentName === 'Item' && skip.includes('information')) {
      const types = game.system?.documentTypes?.Item;
      if (types) return { type__in: Object.keys(types).filter((x) => x !== 'information') };
    }
    if (documentName === 'ActiveEffect' && skip.includes('base')) {
      const types = game.system?.documentTypes?.ActiveEffect;
      if (types) return { type__in: Object.keys(types).filter((x) => x !== 'base') };
      return { type__in: ['enhancement'] };
    }
    return {};
  }

  /**
   * @param {CompendiumCollection} pack
   * @param {object} [options]
   * @param {string} [options.documentName]
   * @param {string[]} [options.skipTypes]
   * @param {'bulk'|'chunked'} [options.mode]
   * @param {AbortSignal} [options.signal]
   * @param {(loaded: number, total: number) => void} [options.onProgress]
   * @returns {Promise<object[]>}
   */
  static async loadPack(pack, { documentName, skipTypes, mode, signal, onProgress } = {}) {
    const skip = skipTypes ?? this.skipTypesFor(documentName ?? pack.documentName);
    const skipSet = new Set(skip);
    const resolved = this.resolveMode(mode);

    if (signal?.aborted) return [];
    if (!pack.index?.size && pack.getIndex) await pack.getIndex();
    if (signal?.aborted) return [];

    const ids = this.collectLoadIds(pack, { skipTypes: skip });
    if (!ids.length) {
      const total = this.#countIndexed(pack, skipSet);
      onProgress?.(total, total);
      return this.#contents(pack, skipSet);
    }

    if (resolved === 'bulk') {
      if (signal?.aborted) return [];
      await pack.getDocuments(this.bulkQuery(documentName ?? pack.documentName, skip));
      if (signal?.aborted) return [];
      const total = this.#countIndexed(pack, skipSet);
      onProgress?.(total, total);
      return this.#contents(pack, skipSet);
    }

    const chunkSize = this.CHUNK_SIZES[documentName] ?? this.CHUNK_SIZES[pack.documentName] ?? 50;
    const chunks = this.chunk(ids, chunkSize);
    let loaded = 0;
    for (const chunk of chunks) {
      if (signal?.aborted) return [];
      await pack.getDocuments({ _id__in: chunk });
      loaded += chunk.length;
      onProgress?.(loaded, ids.length);
    }

    return this.#contents(pack, skipSet);
  }

  static #countIndexed(pack, skipSet) {
    let n = 0;
    for (const entry of pack.index ?? []) {
      if (!skipSet.has(entry.type)) n++;
    }
    return n;
  }

  static #contents(pack, skipSet) {
    const documents = [];
    for (const doc of pack) {
      if (skipSet.has(doc.type)) continue;
      documents.push(doc);
    }
    return documents;
  }
}
