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

  unmount() {
    this._hoverToken++;
    game.tooltip.deactivate();
    this.close({ animate: false });
  }

  async setContextFromHost({ step, tab } = {}) {
    if (!this.rendered) await this.mount();
    if (tab) await this.changeTab(tab, 'sheet');
    const category = tab || $(this.element).find('.tab.active')[0]?.dataset.tab;
    if (category) await this.filterItems(category);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#bindEmbedSettingsMenu();
  }

  #bindEmbedSettingsMenu() {
    if (this._embedSettingsMenu) return;
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
    ui.context.menuItems = EMBED_SETTING_KEYS.map(({ key, icon, dialog }) => {
      const active = !dialog && this.#getEmbedSettingValue(key);
      return {
        name: key,
        label: _loc(`Library.${key}`),
        icon: `<i class="fas ${icon}" aria-hidden="true"></i>${active ? "<i class='fas fa-check' aria-hidden='true'></i>" : ''}`,
        onClick: () => this.applyLibrarySetting(key),
      };
    });
  }
}
