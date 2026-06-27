/**
 * GroupAPI — public registry for modules to extend the Group Actor sheet.
 *
 * Button helpers render as square icon cards ({@link .dsa-icon-card-grid} in theme.scss).
 * Panel helpers inject custom HTML instead of a card — use for richer embedded UIs.
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
 *   gmOnly: true,
 *   async renderHtml(groupActor) {
 *     return `<div class="my-panel" data-group-helper="my-module.panel">…</div>`;
 *   },
 *   execute(groupActor, event, dataset) { /* optional delegated clicks *\/ },
 * });
 * ```
 *
 * Sections displayed on the group sheet GM tools tab: `'gm-tools'` (also accepts legacy `'travel-camp'`).
 * Other sections (`members`, `custom`) are reserved for future tab placements.
 */
export default class GroupAPI {
  static #helpers = new Map();

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
    return Promise.all(entries.map(async (entry) => {
      if (typeof entry.renderHtml === 'function') {
        return {
          id: entry.id,
          sort: entry.sort,
          isHtml: true,
          html: await entry.renderHtml(groupActor),
        };
      }

      return {
        id: entry.id,
        label: entry.label,
        icon: entry.icon,
        hint: entry.hint,
        iconIsImg: this.#iconIsImage(entry.icon),
        isHtml: false,
      };
    }));
  }

  static async prepareGmToolEntries(groupActor) {
    return this.prepareHelperEntries(this.#GM_TOOL_SECTIONS, groupActor);
  }

  static get helpers() {
    return this.#helpers;
  }
}
