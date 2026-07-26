import { ItemLibraryBase } from './itemlibrary.js';

const EMBED_SETTING_KEYS = [
  { key: 'advanced', icon: 'fa-brain' },
  { key: 'indexWorldItems', icon: 'fa-globe' },
  { key: 'fullTextSearch', icon: 'fa-align-center' },
  { key: 'filterDuplicateItems', icon: 'fa-filter' },
  { key: 'moduleFilter', icon: 'fa-cubes', dialog: true },
];

export default class ItemLibraryEmbed extends ItemLibraryBase {
  static DEFAULT_OPTIONS = {
    id: 'DSA5ItemLibraryEmbed',
    tag: 'div',
    window: {
      frame: false,
      positioned: false,
      title: '',
    },
    position: {
      width: 'auto',
      height: 'auto',
    },
    classes: ['itemlibrary-embedded'],
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/itemlibrary/parts/tabs-embed.hbs',
    },
    header: {
      template: 'systems/dsa5/templates/system/itemlibrary/parts/header-embed.hbs',
    },
    Items: super.PARTS.Items,
    Religion: super.PARTS.Religion,
    Character: super.PARTS.Character,
    Actors: super.PARTS.Actors,
    JournalEntries: super.PARTS.JournalEntries,
  };

  constructor({ mountElement, hostApp, ...options } = {}) {
    super(options);
    this._mountElement = mountElement;
    this.hostApp = hostApp;
    this.viewMode = 'compact';
    this._parkFragment = null;
  }

  get embedded() {
    return true;
  }

  getMountTarget() {
    return this._mountElement ?? null;
  }

  getDefaultViewMode() {
    return 'compact';
  }

  async mount() {
    await this.whenReady();
    if (this.rendered) {
      this._attachToMountTarget();
      return this;
    }
    await this.render(true);
    return this;
  }

  setMountElement(mountElement) {
    this._mountElement = mountElement;
    if (this.rendered) this._attachToMountTarget();
  }

  /** Keep the app alive off-DOM so filters survive host re-renders / utility tab switches. */
  park() {
    if (!this.element) return;
    this._parkFragment ??= document.createDocumentFragment();
    if (this.element.parentNode !== this._parkFragment) {
      this._parkFragment.append(this.element);
    }
    this._mountElement = null;
  }

  unmount() {
    this._hoverToken++;
    game.tooltip.deactivate();
    this._parkFragment = null;
    this._embedSettingsMenu = null;
    this.close({ animate: false });
  }

  async setContextFromHost({ step, tab } = {}) {
    if (!this.rendered) await this.mount();
    else this._attachToMountTarget();

    const currentTab = this.tabGroups?.sheet;
    if (tab && tab !== currentTab) {
      await this.changeTab(tab, 'sheet');
      return;
    }

    if (tab) this.syncCategoryChipStates(tab);
    if (this.advancedFiltering) this._setAdvancedSidebarVisible(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#bindEmbedSettingsMenu();
  }

  #bindEmbedSettingsMenu() {
    // Re-bind after each render: host remounts move the element and can drop listeners.
    this._embedSettingsMenu = new foundry.applications.ux.ContextMenu(this.element, '[data-action="embedLibrarySettings"]', [], {
      onOpen: this.#onEmbedSettingsContext.bind(this),
      jQuery: false,
      fixed: true,
      eventName: 'click',
    });
  }

  #getEmbedSettingValue(key) {
    switch (key) {
      case 'advanced':
        return this.advancedFiltering;
      case 'indexWorldItems':
        return game.settings.get('dsa5', 'indexWorldItems');
      case 'fullTextSearch':
        return game.settings.get('dsa5', 'indexDescription');
      case 'filterDuplicateItems':
        return game.settings.get('dsa5', 'filterDuplicateItems');
      default:
        return false;
    }
  }

  #onEmbedSettingsContext() {
    // Foundry ContextMenu skips entries whose icon HTML is not a single element.
    // Use one <i> only; mark toggles via classes instead of appending a check icon.
    ui.context.menuItems = EMBED_SETTING_KEYS.map(({ key, icon, dialog }) => {
      const active = !dialog && this.#getEmbedSettingValue(key);
      return {
        name: key,
        label: _loc(`Library.${key}`),
        icon: `<i class="fas ${active ? 'fa-check' : icon}" aria-hidden="true"></i>`,
        classes: active ? 'active' : '',
        onClick: () => this.applyLibrarySetting(key),
      };
    });
  }
}
