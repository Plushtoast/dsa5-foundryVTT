import { ItemLibraryBase } from './itemlibrary.js';

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
    classes: ['dsa5', 'sheet', 'itemlibrary', 'itemlibrary-embedded'],
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/itemlibrary/parts/tabs-embed.hbs',
    },
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
}
