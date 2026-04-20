/**
 * GroupAPI — public registry for modules to extend the Group Actor sheet.
 *
 * Modules can add helper buttons to dedicated sections of the group sheet
 * (e.g. travel-camp, members, custom). Helpers appear as action buttons
 * inside the corresponding tab.
 *
 * @example Registering a helper (in your module's init or ready hook):
 * ```js
 * Hooks.once('ready', () => {
 *   const GroupAPI = game.dsa5.apps.GroupAPI;
 *
 *   GroupAPI.registerHelper('my-module.campfire', {
 *     section: 'travel-camp',       // 'travel-camp' | 'members' | 'custom'
 *     label: 'MY_MODULE.campfire',   // localization key or plain text
 *     icon: 'fas fa-campground',     // optional Font Awesome icon class
 *     sort: 50,                      // optional sort order (default 100)
 *     gmOnly: false,                 // optional, hide from non-GM users
 *     visible(groupActor) {          // optional, return false to hide dynamically
 *       return groupActor.system.memberCount > 0;
 *     },
 *     async execute(groupActor, event, dataset) { // called when the button is clicked
 *       // your logic here
 *     },
 *   });
 * });
 * ```
 *
 * @example Unregistering a helper:
 * ```js
 * game.dsa5.apps.GroupAPI.unregisterHelper('my-module.campfire');
 * ```
 *
 * Helper definition properties:
 * | Property   | Type                          | Required | Description                                   |
 * |------------|-------------------------------|----------|-----------------------------------------------|
 * | section    | `string`                      | yes      | Sheet section: `'travel-camp'`, `'members'`, or `'custom'` |
 * | label      | `string`                      | yes      | Button label (localization key or plain text)  |
 * | execute    | `(groupActor: Actor, event: Event, dataset: DOMStringMap) => void` | yes | Called when the button is clicked |
 * | icon       | `string`                      | no       | CSS class for button icon (e.g. `'fas fa-fire'`) |
 * | sort       | `number`                      | no       | Sort order within its section (default `100`)  |
 * | gmOnly     | `boolean`                     | no       | If `true`, only visible to GMs (default `false`) |
 * | visible    | `(groupActor: Actor) => boolean` | no    | Dynamic visibility predicate                   |
 */
export default class GroupAPI {
  static #helpers = new Map();

  static registerHelper(id, definition) {
    if (this.#helpers.has(id)) {
      console.warn(`GroupAPI: helper "${id}" is already registered, overwriting.`);
    }
    definition.sort ??= 100;
    definition.gmOnly ??= false;
    this.#helpers.set(id, definition);
  }

  static unregisterHelper(id) {
    this.#helpers.delete(id);
  }

  static getHelpers(section) {
    return [...this.#helpers.values()]
      .filter((h) => h.section === section)
      .sort((a, b) => a.sort - b.sort);
  }

  static get helpers() {
    return this.#helpers;
  }
}
