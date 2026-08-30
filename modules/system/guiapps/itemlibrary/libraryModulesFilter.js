import { DefaultAppv2 } from '../../../actor/baseapp.js';
import ItemLibraryModuleOptions from './moduleOptions.js';

const { mergeObject } = foundry.utils;

export default class LibraryModulsFilter extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    id: 'LibraryModulsFilter',
    settingNamespace: 'dsa5',
    settingKey: 'libraryModulsFilter',
    position: {
      width: 600
    },
    window: {
      title: 'DSASETTINGS.libraryModulsFilter',
      icon: 'fa-regular fa-globe',
      minimizable: true,
      resizable: true,
    },
    classes: ['dsa5'],
  };

  static PARTS = {
    modules: {
      template: 'systems/dsa5/templates/system/itemlibrary/librarymodulesfilter.hbs'
    }
  }

  static open(options = {}) {
    const id = options.id || this.DEFAULT_OPTIONS.id;
    const existing = foundry.applications.instances.get(id);
    if (existing) {
      existing.bringToTop();
      return existing;
    }
    return new this(options).render(true);
  }

  get settingNamespace() {
    return this.options.settingNamespace || 'dsa5';
  }

  get settingKey() {
    return this.options.settingKey || 'libraryModulsFilter';
  }

  getRejectedModules() {
    return foundry.utils.duplicate(game.settings.get(this.settingNamespace, this.settingKey) || {});
  }

  async setRejectedModules(data) {
    await game.settings.set(this.settingNamespace, this.settingKey, data);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options)

    mergeObject(data, {
      moduleOptions: ItemLibraryModuleOptions.collect(),
      rejectedModules: this.getRejectedModules(),
    });
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    $(this.element).find('.moduleSelector').on('change', (ev) => this.moduleFilterChanged(ev));
  }

  async moduleFilterChanged(ev) {
    const module = ev.currentTarget.id;

    const data = this.getRejectedModules();
    if (ev.currentTarget.checked) {
      delete data[module];
    } else {
      data[module] = true;
    }

    await this.setRejectedModules(data);
  }
}
