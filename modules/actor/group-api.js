/**
 * GroupAPI — public registry for modules to extend the Group Actor sheet.
 *
 * Button helpers render as square icon cards ({@link .dsa-icon-card-grid} in theme.scss).
 * Panel helpers also get a tile; clicking it replaces the tab with that panel until closed.
 *
 * @example Button helper (e.g. dsa5-compendium Nahrungssuche):
 * ```js
 * Hooks.once('ready', () => {
 *   game.dsa5.apps.GroupAPI.registerHelper('dsa5-compendium.foodsearch', {
 *     section: 'gm-tools',
 *     label: 'FOODSEARCH.food',
 *     icon: 'systems/dsa5/icons/talents/Lebensmittelbearbeitung.webp',
 *     sort: 40,
 *     gmOnly: true,
 *     visible(groupActor) { return groupActor.system.memberCount > 0; },
 *     execute(groupActor) { /* open flow *\/ },
 *   });
 * });
 * ```
 *
 * @example Custom HTML panel (advanced integration):
 * ```js
 * GroupAPI.registerPanel('my-module.panel', {
 *   section: 'gm-tools',
 *   sort: 10,
 *   gmOnly: false,
 *   async renderHtml(groupActor) {
 *     return `<div class="my-panel" data-group-helper="my-module.panel">…</div>`;
 *   },
 *   execute(groupActor, event, dataset) { /* delegated clicks and change events *\/ },
 * });
 * ```
 *
 * Persist plugin state on `system.masterFunctions.{key}` via {@link GroupAPI.registerDataModel}.
 *
 * Sections displayed on the group sheet GM tools tab: `'gm-tools'` (also accepts legacy `'travel-camp'`).
 * Other sections (`members`, `custom`) are reserved for future tab placements.
 */
export default class GroupAPI {
  static #helpers = new Map();

  static #dataModels = new Map();

  static #GM_TOOL_SECTIONS = ['gm-tools', 'travel-camp'];

  static registerHelper(id, definition) {
    if (this.#helpers.has(id)) {
      console.warn(`GroupAPI: helper "${id}" is already registered, overwriting.`);
    }
    definition.sort ??= 100;
    definition.gmOnly ??= false;
    this.#helpers.set(id, definition);
  }

  /** Alias for helpers that inject custom HTML via {@link GroupAPI.prepareHelperEntries}. */
  static registerPanel(id, definition) {
    this.registerHelper(id, {
      execute: () => {},
      ...definition,
    });
  }

  static unregisterHelper(id) {
    this.#helpers.delete(id);
  }

  /**
   * Register an ethereal DataModel for a `system.masterFunctions` key.
   * The group actor schema only owns the bag; plugins own the slice.
   */
  static registerDataModel(id, Model) {
    if (this.#dataModels.has(id)) {
      console.warn(`GroupAPI: data model "${id}" is already registered, overwriting.`);
    }
    this.#dataModels.set(id, Model);
  }

  static unregisterDataModel(id) {
    this.#dataModels.delete(id);
  }

  static getDataModel(id) {
    return this.#dataModels.get(id) ?? null;
  }

  static get dataModels() {
    return this.#dataModels;
  }

  /**
   * Prepared DataModel for a master-function key, with schema defaults filled in memory.
   * Missing source keys are not persisted until {@link GroupAPI.updateMasterFunction}.
   */
  static getMasterFunction(groupActor, key) {
    const Model = this.getDataModel(key);
    if (!Model || !groupActor) return null;
    const existing = groupActor.system?.masterFunctions?.[key];
    const data = existing instanceof Model ? existing.toObject() : (existing ?? {});
    return new Model(foundry.utils.deepClone(data), { parent: groupActor.system, strict: false });
  }

  static async updateMasterFunction(groupActor, key, data = {}) {
    if (!groupActor || !key) return null;
    const Model = this.getDataModel(key);
    const live = this.getMasterFunction(groupActor, key);
    const sourceSlice = groupActor._source?.system?.masterFunctions?.[key];
    const base = foundry.utils.deepClone(live?.toObject?.() ?? (foundry.utils.isPlainObject(sourceSlice) ? sourceSlice : {}));
    const merged = foundry.utils.mergeObject(base, foundry.utils.expandObject(data), { inplace: false });
    const cleaned = Model ? Model.cleanData(merged) : merged;
    const prefix = `system.masterFunctions.${key}`;
    const update = {};
    for (const [field, value] of Object.entries(foundry.utils.flattenObject(cleaned))) {
      update[`${prefix}.${field}`] = value;
    }
    const Deletion = foundry.data.operators.ForcedDeletion;
    if (Deletion && foundry.utils.isPlainObject(sourceSlice) && foundry.utils.isPlainObject(cleaned)) {
      for (const extra of Object.keys(sourceSlice)) {
        if (!(extra in cleaned)) update[`${prefix}.${extra}`] = new Deletion();
      }
    }
    await groupActor.update(update);
    return this.getMasterFunction(groupActor, key);
  }

  static getHelpers(section) {
    return [...this.#helpers.values()]
      .filter((h) => h.section === section)
      .sort((a, b) => a.sort - b.sort);
  }

  static getHelperEntries(sections, groupActor) {
    const sectionList = Array.isArray(sections) ? sections : [sections];
    return [...this.#helpers.entries()]
      .filter(([, h]) => sectionList.includes(h.section) && h.visible?.(groupActor) !== false && (!h.gmOnly || game.user.isGM))
      .map(([id, h]) => ({ id, ...h }))
      .sort((a, b) => a.sort - b.sort);
  }

  static getGmToolEntries(groupActor) {
    return this.getHelperEntries(this.#GM_TOOL_SECTIONS, groupActor);
  }

  static #iconIsImage(icon) {
    if (!icon) return false;
    return icon.includes('/') || /\.(webp|png|jpg|jpeg|svg|gif)$/i.test(icon);
  }

  static async prepareHelperEntries(sections, groupActor) {
    const entries = this.getHelperEntries(sections, groupActor);
    const cards = [];
    const panels = [];
    for (const entry of entries) {
      cards.push({
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        hint: entry.hint,
        iconIsImg: this.#iconIsImage(entry.icon),
        isPanel: typeof entry.renderHtml === 'function',
      });
      if (typeof entry.renderHtml === 'function') {
        panels.push({
          id: entry.id,
          sort: entry.sort,
          html: await entry.renderHtml(groupActor),
        });
      }
    }
    return { cards, panels };
  }

  static async prepareGmToolEntries(groupActor) {
    return this.prepareHelperEntries(this.#GM_TOOL_SECTIONS, groupActor);
  }

  static get helpers() {
    return this.#helpers;
  }
}
