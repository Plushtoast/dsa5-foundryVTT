const INDEX_PATH = 'systems/dsa5/lazy/module_contents_index.json';
const DATA_PATH = 'systems/dsa5/lazy/module_contents.json.gz';

export default class ModuleDetailsDataLoader {
  static #indexPromise;
  static #dataPromise;

  static async loadIndex() {
    this.#indexPromise ??= foundry.utils.fetchJsonWithTimeout(INDEX_PATH).catch((error) => {
      console.warn('DSA5 | Failed to load module details index', error);
      return { modules: {} };
    });

    return await this.#indexPromise;
  }

  static async loadData() {
    this.#dataPromise ??= this.#loadCompressedJson(DATA_PATH);
    return await this.#dataPromise;
  }

  static async #loadCompressedJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      throw new Error(`Failed to load ${path}: ${response.status}`);
    }

    const fallbackResponse = response.clone();
    const compressed = await response.arrayBuffer();

    try {
      if (typeof DecompressionStream !== 'function') {
        throw new Error('DecompressionStream is not available');
      }

      const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream('gzip'));
      const jsonText = await new Response(stream).text();
      return JSON.parse(jsonText);
    } catch (error) {
      console.warn('DSA5 | Falling back to direct module details parsing', error);
      const jsonText = await fallbackResponse.text();
      return JSON.parse(jsonText);
    }
  }
}