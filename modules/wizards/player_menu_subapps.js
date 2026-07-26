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
      scrollable: ['']
    }
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
        qualifies: () => PlayerMenuSubApp.hasAnyNamedItem(actor, [game.i18n.localize('LocalizedIDs.arcanovi')]),
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

  async _onRender(html) {}

  async render() {
    await game.dsa5.apps.playerMenu.render(true);
  }

  async activateTab() {
    await game.dsa5.apps.playerMenu.changeTab(this.tabName, 'sheet');
  }

  get actor() {
    return game.dsa5.apps.playerMenu.actor;
  }

  async _onDrop(data) {}
}
