import { DefaultAppv2 } from '../../../actor/baseapp.js';
import ItemLibraryModuleOptions from './moduleOptions.js';

const { mergeObject } = foundry.utils;

export default class LibraryModulsFilter extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    id: "LibraryModulsFilter",
    position: {
      width: 600
    },
    window: {
      title: "DSASETTINGS.libraryModulsFilter",
      icon: "fa-regular fa-globe",
      minimizable: true,
      resizable: true,
    },
    classes: ["dsa5"],
  };

  static PARTS = {
    modules: {
      template: "systems/dsa5/templates/system/itemlibrary/librarymodulesfilter.hbs"
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options)

    mergeObject(data, {
      moduleOptions: ItemLibraryModuleOptions.collect(),
      rejectedModules: game.settings.get('dsa5', 'libraryModulsFilter'),
    });
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    $(this.element).find('.moduleSelector').on('change', (ev) => this.moduleFilterChanged(ev));
  }

  async moduleFilterChanged(ev) {
    const module = ev.currentTarget.id;

    const data = game.settings.get('dsa5', 'libraryModulsFilter');
    if (ev.currentTarget.checked) {
      delete data[module];
    } else {
      data[module] = true;
    }

    game.settings.set('dsa5', 'libraryModulsFilter', data);
  }
}
