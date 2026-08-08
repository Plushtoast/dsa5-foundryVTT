export class PlayerMenuSubApp {
  static template = '';
  static rulePath = {};

  /**
   * Optional capability key so the default {@link addBadge} can evaluate a standard actor check.
   * Known values: `'alchemy' | 'smith' | 'artifact'`.
   * @type {string|null}
   */
  static capability = null;

  async _getData(data) {
    return {};
  }

  get name() {
    return `PLAYER.${this.tabName}`;
  }

  get tabName() {
    return this.constructor.name;
  }

  get part() {
    return {
      template: this.constructor.template,
      templates: ['systems/dsa5/templates/system/parts/detail-select.hbs'],
      scrollable: [''],
    };
  }

  addTab(tabs, activeTab, group) {
    const active = activeTab === this.tabName;
    tabs[this.tabName] = {
      id: this.tabName,
      label: this.name,
      group,
      icon: this.icon,
      active,
      cssClass: active ? "active" : ""
    };
  }

  /**
   * Header badge for this subapp when the actor qualifies.
   * Override for custom badges, or set {@link PlayerMenuSubApp.capability} to use a built-in check.
   * @param {Actor|null} actor
   * @returns {{label: string, icon?: string, tooltip?: string, tab?: string}|null}
   */
  addBadge(actor) {
    const capability = this.constructor.capability;
    if (!capability || !actor) return null;
    return PlayerMenuSubApp.capabilityBadge(capability, actor, this.tabName);
  }

  /**
   * @param {Actor} actor
   * @param {string} localizedIdKey Key under LocalizedIDs
   * @returns {number}
   */
  static skillFw(actor, localizedIdKey) {
    const name = game.i18n.localize(`LocalizedIDs.${localizedIdKey}`);
    const skill = actor?.items?.find((x) => x.type === 'skill' && x.name === name);
    return Number(skill?.system?.talentValue?.value) || 0;
  }

  /**
   * @param {Actor} actor
   * @param {string} localizedIdKey
   * @param {number} min
   */
  static hasSkillFwAbove(actor, localizedIdKey, min) {
    return PlayerMenuSubApp.skillFw(actor, localizedIdKey) > min;
  }

  /**
   * @param {Actor} actor
   * @param {string[]} names Localized item names
   * @param {string[]} [types]
   */
  static hasAnyNamedItem(actor, names, types = ['spell', 'ritual', 'liturgy', 'ceremony']) {
    if (!actor || !names?.length) return false;
    const nameSet = new Set(names);
    return actor.items.some((item) => types.includes(item.type) && nameSet.has(item.name));
  }

  /**
   * Artefaktzauberei requires Arcanovi and at least one spell to bind.
   * @param {Actor} actor
   */
  static canEnchantArtifacts(actor) {
    if (!actor) return false;
    const hasArcanovi = PlayerMenuSubApp.hasAnyNamedItem(actor, [game.i18n.localize('LocalizedIDs.arcanovi')]);
    const hasSpell = actor.items.some((item) => item.type === 'spell');
    return hasArcanovi && hasSpell;
  }

  /**
   * Shared capability → badge mapping used by subapps and the built-in Beschwörung tab.
   * @param {'conjurer'|'alchemy'|'smith'|'artifact'} capability
   * @param {Actor} actor
   * @param {string} tab
   */
  static capabilityBadge(capability, actor, tab) {
    const defs = {
      alchemy: {
        label: 'PLAYER.badge.alchemist',
        icon: 'fas fa-flask',
        qualifies: () => PlayerMenuSubApp.hasSkillFwAbove(actor, 'alchemy', 4),
      },
      smith: {
        label: 'PLAYER.badge.smith',
        icon: 'fas fa-hammer',
        qualifies: () => PlayerMenuSubApp.SMITH_SKILLS.some((key) => PlayerMenuSubApp.hasSkillFwAbove(actor, key, 4)),
      },
      artifact: {
        label: 'PLAYER.badge.artifactMage',
        icon: 'fas fa-gem',
        qualifies: () => PlayerMenuSubApp.canEnchantArtifacts(actor),
      },
    };

    const def = defs[capability];
    if (!def || !def.qualifies()) return null;
    return {
      label: def.label,
      icon: def.icon,
      tooltip: def.label,
      tab,
    };
  }

  /** Craft skills that count toward the Schmied badge. */
  static SMITH_SKILLS = ['metalworking'];

  constructor() {
    this._openPickers = new Set();
  }

  /**
   * Scope selector for this subapp's tab root (avoids colliding with summoning/other tabs).
   * @returns {string}
   */
  get detailSelectScope() {
    return `[data-tab="${this.tabName}"]`;
  }

  /**
   * Register the pick callback for this subapp's detail-selects.
   * Actual clicks are handled by {@link PlayerMenu} delegated binding so nested
   * Handlebars `data-field` on option buttons is not required (it often renders empty).
   * @param {JQuery} _html
   * @param {(field: string, id: string) => void|boolean|Promise<void>} onPick
   */
  bindDetailSelect(_html, onPick) {
    this._detailSelectOnPick = onPick;
  }

  /**
   * Handle a detail-select action for this subapp.
   * Field is always read from the outer `.dsa-detail-select` (reliable), never from nested option buttons.
   * @param {'toggle'|'pick'|'open'} action
   * @param {HTMLElement} target
   * @returns {Promise<boolean>} true if handled
   */
  async handleDetailSelect(action, target) {
    const select = target.closest('.dsa-detail-select');
    if (!select) return false;

    if (action === 'toggle') {
      const field = select.dataset.field;
      if (!field) return false;
      if (this._openPickers.has(field)) this._openPickers.delete(field);
      else this._openPickers.add(field);
      await this.render();
      return true;
    }

    if (action === 'pick') {
      const field = select.dataset.field;
      const id = target.dataset.id ?? '';
      if (!field) return false;
      this._openPickers.delete(field);
      await this._detailSelectOnPick?.(field, id);
      await this.render();
      return true;
    }

    if (action === 'open') {
      const uuid = target.dataset.uuid;
      if (!uuid) return false;
      const doc = await fromUuid(uuid);
      doc?.sheet?.render(true);
      return true;
    }

    return false;
  }

  async _onRender(html) {}

  async render() {
    await game.dsa5.apps.playerMenu.render(true);
  }

  async activateTab() {
    const menu = game.dsa5.apps.playerMenu;
    if (menu.tabGroups?.sheet === this.tabName) return;
    await menu.changeTab(this.tabName, 'sheet');
  }

  /**
   * Whether this subapp can consume the dropped document.
   * Override in subapps that accept item drops.
   * @param {Document} _data
   * @returns {boolean}
   */
  canAcceptDrop(_data) {
    return false;
  }

  get actor() {
    return game.dsa5.apps.playerMenu.actor;
  }

  async _onDrop(data) {}
}
