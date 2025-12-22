export default class ItemLibraryIndexLoader {
  constructor({ debug = false } = {}) {
    this.debug = debug;
    this.workerName = "dsa5.itemlibrary-index";

    this._worker = null;
    this._enabled = true;
    this._initialized = false;

    this._buildToken = 0;
  }

  get enabled() {
    return this._enabled;
  }

  get buildToken() {
    return this._buildToken;
  }

  bumpBuildToken() {
    this._buildToken += 1;
    return this._buildToken;
  }

  async _ensureWorker() {
    if (!this._enabled) return null;
    if (this._worker) return this._worker;

    if (!game?.workers?.createWorker) {
      this._enabled = false;
      return null;
    }

    try {
      this._worker = await game.workers.createWorker(this.workerName, {
        debug: this.debug,
        loadPrimitives: false,
      });
      await this._worker.ready;
      return this._worker;
    } catch (err) {
      console.warn("DSA5 | ItemLibraryIndexLoader: failed to create worker", err);
      this._enabled = false;
      this._worker = null;
      return null;
    }
  }

  async _ensureFunctionsLoaded() {
    if (!this._enabled) return false;
    if (this._initialized) return true;

    const worker = await this._ensureWorker();
    if (!worker) return false;

    try {
      await worker.loadFunction("itemlibrary.ensureIndex", itemlibraryEnsureIndex);
      await worker.loadFunction("itemlibrary.addBatch", itemlibraryAddBatch);
      await worker.loadFunction("itemlibrary.search", itemlibrarySearch);
      await worker.loadFunction("itemlibrary.reset", itemlibraryReset);
      this._initialized = true;
      return true;
    } catch (err) {
      console.warn("DSA5 | ItemLibraryIndexLoader: failed to load worker functions", err);
      this._enabled = false;
      return false;
    }
  }

  async ensureIndex({ documentName, fields, fullTextSearch = false, token }) {
    const ok = await this._ensureFunctionsLoaded();
    if (!ok) return false;

    const worker = await this._ensureWorker();

    /** @type {(path: string) => string | undefined} */
    const getRoute = globalThis.foundry?.utils?.getRoute?.bind(globalThis.foundry.utils);
    const baseUrl = globalThis.document?.baseURI || globalThis.location?.href || "";
    const flexModuleUrl = getRoute
      ? getRoute("systems/dsa5/libs/flexsearch.bundle.module.min.js")
      : new URL("systems/dsa5/libs/flexsearch.bundle.module.min.js", baseUrl).toString();
    const flexIifeUrl = getRoute
      ? getRoute("systems/dsa5/bundle/libs/flexsearch.bundle.iife.min.js")
      : new URL("systems/dsa5/bundle/libs/flexsearch.bundle.iife.min.js", baseUrl).toString();

    await worker.executeFunction("itemlibrary.ensureIndex", [
      {
        documentName,
        fields,
        fullTextSearch,
        token,
        flexModuleUrl,
        flexIifeUrl,
      }
    ]);

    return true;
  }

  async addBatch({ documentName, batch, token }) {
    if (!batch?.length) return;
    const ok = await this._ensureFunctionsLoaded();
    if (!ok) return;

    const worker = await this._ensureWorker();
    await worker.executeFunction("itemlibrary.addBatch", [{ documentName, batch, token }]);
  }

  async search({ documentName, query, args, token }) {
    const ok = await this._ensureFunctionsLoaded();
    if (!ok) return [];

    const worker = await this._ensureWorker();
    return await worker.executeFunction("itemlibrary.search", [{ documentName, query, args, token }]);
  }

  async reset({ documentName, token }) {
    const ok = await this._ensureFunctionsLoaded();
    if (!ok) return;

    const worker = await this._ensureWorker();
    await worker.executeFunction("itemlibrary.reset", [{ documentName, token }]);
  }

  async terminate() {
    /**
     * Terminate the loader lifecycle without throwing.
     *
     * Callers may not await this method, so it must never reject.
     */
    try {
      const worker = this._worker;
      this._worker = null;
      this._initialized = false;
      void worker;

      try {
        await game?.workers?.retireWorker?.(this.workerName);
      } catch (err) {
        // ignore
      }
    } catch (err) {
    }
  }
}

async function itemlibraryEnsureIndex(payload) {
  const { documentName, fields, flexModuleUrl, flexIifeUrl, token } = payload;
  globalThis.__dsa5ItemLibraryIndexState = globalThis.__dsa5ItemLibraryIndexState || {
    indexes: {},
    config: {},
  };
  const state = globalThis.__dsa5ItemLibraryIndexState;

  let flex = globalThis.FlexSearch;
  if (!flex) {
    try {
      // eslint-disable-next-line no-undef
      const mod = await import(flexModuleUrl);
      flex = mod?.default ?? mod;
      globalThis.FlexSearch = flex;
    } catch (err) {
      // ignore
    }
  }
  if (!flex && typeof importScripts === "function") {
    importScripts(flexIifeUrl);
    flex = globalThis.FlexSearch;
  }
  if (!flex) throw new Error("FlexSearch could not be loaded in worker");

  const prev = state.config[documentName];
  const nextKey = JSON.stringify({ fields });
  if (prev?.key === nextKey && prev?.token === token && state.indexes[documentName]) return [{ ok: true }, []];
  delete state.indexes[documentName];

  state.config[documentName] = { key: nextKey, token };
  state.indexes[documentName] = new flex.Document({
    tokenize: "full",
    cache: true,
    document: {
      id: "uuid",
      store: false,
      tag: "type",
      index: fields,
    },
  });

  return [{ ok: true }, []];
}

async function itemlibraryAddBatch(payload) {
  const { documentName, batch, token } = payload;
  globalThis.__dsa5ItemLibraryIndexState = globalThis.__dsa5ItemLibraryIndexState || {
    indexes: {},
    config: {},
  };
  const state = globalThis.__dsa5ItemLibraryIndexState;

  if (token !== undefined && state.config?.[documentName]?.token !== token) return [{ ok: false, stale: true }, []];

  const index = state.indexes[documentName];
  if (!index) throw new Error(`Index not initialized for ${documentName}`);

  for (const doc of batch) {
    index.add(doc);
  }

  return [{ ok: true }, []];
}

async function itemlibrarySearch(payload) {
  const { documentName, query, args, token } = payload;
  globalThis.__dsa5ItemLibraryIndexState = globalThis.__dsa5ItemLibraryIndexState || {
    indexes: {},
    config: {},
  };
  const state = globalThis.__dsa5ItemLibraryIndexState;

  if (token !== undefined && state.config?.[documentName]?.token !== token) return [[], []];

  const index = state.indexes[documentName];
  if (!index) return [];

  const results =
    query === undefined || query === null || query === ""
      ? (typeof index.searchAsync === "function" ? await index.searchAsync(args) : index.search(args))
      : (typeof index.searchAsync === "function" ? await index.searchAsync(query, args) : index.search(query, args));

  const unique = new Set();
  for (const r of results || []) {
    for (const id of r.result || []) unique.add(id);
  }
  return [Array.from(unique), []];
}

async function itemlibraryReset(payload) {
  const { documentName, token } = payload;
  globalThis.__dsa5ItemLibraryIndexState = globalThis.__dsa5ItemLibraryIndexState || {
    indexes: {},
    config: {},
  };
  const state = globalThis.__dsa5ItemLibraryIndexState;

  if (token !== undefined && state.config?.[documentName]?.token !== token) return [{ ok: false, stale: true }, []];

  delete state.indexes[documentName];
  delete state.config[documentName];
  return [{ ok: true }, []];
}
