export default class TestModuleLoader {
  static #entries = new Map();

  static #resolveUrl(path) {
    if (/^https?:\/\//.test(path)) return path;
    const getRoute = globalThis.foundry?.utils?.getRoute?.bind(globalThis.foundry.utils);
    if (getRoute) return getRoute(path);
    const baseUrl = globalThis.document?.baseURI || globalThis.location?.href || '';
    return new URL(path, baseUrl).toString();
  }

  static register(id, { url, bind }) {
    this.#entries.set(id, {
      url,
      bind,
      status: 'idle',
      bound: false,
      module: undefined,
      promise: undefined,
      error: undefined,
    });
  }

  static async load(id) {
    const entry = this.#entries.get(id);
    if (!entry) throw new Error(`Test module not registered: ${id}`);
    if (entry.status === 'loaded') return entry.module;
    if (entry.status === 'loading') return entry.promise;

    entry.status = 'loading';
    entry.promise = import(this.#resolveUrl(entry.url))
      .then((mod) => {
        entry.module = mod.default ?? mod;
        entry.status = 'loaded';
        entry.error = undefined;
        return entry.module;
      })
      .catch((err) => {
        entry.status = 'failed';
        entry.error = err;
        entry.promise = undefined;
        throw err;
      });

    return entry.promise;
  }

  static async ensureBound(id) {
    const entry = this.#entries.get(id);
    if (!entry) throw new Error(`Test module not registered: ${id}`);

    const mod = await this.load(id);
    if (!entry.bound && entry.bind) {
      await entry.bind(mod);
      entry.bound = true;
    }
    return mod;
  }

  static installStubs(target, id, methods) {
    for (const method of methods) {
      if (target[method]?._testModuleStub === id) continue;

      const stub = async (...args) => {
        await this.ensureBound(id);
        return target[method](...args);
      };
      stub._testModuleStub = id;
      target[method] = stub;
    }
  }

  static getLoadState(id) {
    const entry = this.#entries.get(id);
    if (!entry) return null;
    return {
      status: entry.status,
      bound: entry.bound,
      url: entry.url,
      error: entry.error?.message,
    };
  }

  static getLoadStates() {
    return Object.fromEntries(
      [...this.#entries.keys()].map((id) => [id, this.getLoadState(id)]),
    );
  }
}
