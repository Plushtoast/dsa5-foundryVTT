import DSA5StatusEffects from '../status/status_effects.js';
import DSA5ChatAutoCompletion from '../system/chat_autocompletion.js';
import DSA5 from '../system/config-dsa5.js';
import { tinyNotification } from '../system/view_helper.js';
import { bindImgToCanvasDragStart } from './imgTileDrop.js';

export default function () {
  Hooks.on('renderJournalEntryPageSheet', (obj, html, data, options) => {
    html = $(html);
    DSA5ChatAutoCompletion.bindRollCommands(html);
    DSA5StatusEffects.bindButtons(html);
    html.find('img').on('mousedown', (ev) => {
      if (ev.button == 2)
        game.dsa5.apps.DSA5_Utility.showArtwork({
          name: obj.name,
          uuid: '',
          img: $(ev.currentTarget).attr('src'),
        });
    });
    bindImgToCanvasDragStart(html);
  });

  Hooks.on('getHeaderControlsJournalEntrySheet', (sheet, buttons) => { 
    buttons.unshift({
      label: 'SHEET.increaseFontSize',
      icon: 'fas fa-arrows-up-down',
      onClick: async () => {
        increaseFontSize($(sheet.element).find('.journal-entry-pages'))
      },
    });

    if (!sheet.document.sceneNote && !sheet.document.pages.some((x) => x.sceneNote)) return;

    buttons.unshift({
      label: 'SHEET.panMapNote',
      icon: 'fas fa-map-pin',
      onClick: async () => {
        const currentPage = sheet.pageIndex;
        const pages = Array.from(sheet.document.pages);

        let doc;
        if (pages[currentPage].sceneNote) doc = pages[currentPage];
        else if (sheet.document.sceneNote) doc = sheet.document;
        else {
          doc = pages.find((x) => x.sceneNote);
          if (!doc) return;
        }
        canvas.notes.panToNote(doc.sceneNote);
      },
    });
  });
}

export async function increaseFontSize(element) {
  new FontPicker(element).render(true);
}

function setOuterFontSize(element) {
  const index = game.settings.get('dsa5', 'journalFontSizeIndex');
  const size = DSA5.journalFontSizes[index - 1] || 14;
  tinyNotification(game.i18n.format('CHATNOTIFICATION.fontsize', { size }));
  element.css('fontSize', `${size}px`);
}

class FontPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'SHEET.increaseFontSize',
      icon: 'fas fa-arrows-up-down',
    },
    actions: {
      changeSize: this._changeSize,
    }
  }

  constructor(element) {
    super()
    this.connected_element = element;
  }

  static PARTS = {
    size: {
      template: 'systems/dsa5/templates/dialog/fontSize.hbs',
    }
  }

  static async _changeSize(ev, target) {
    const newSize = target.dataset.size;
    
    if (newSize == "-1") {
      await game.settings.set('dsa5', 'journalFontSizeIndex', 0);
      this.connected_element.css('fontSize', '');
      tinyNotification(game.i18n.format('CHATNOTIFICATION.fontsize', { size: 'Default ' }));
    } else {
      const newIndex = DSA5.journalFontSizes.findIndex((x) => x == newSize);
      await game.settings.set('dsa5', 'journalFontSizeIndex', newIndex);
      setOuterFontSize(this.connected_element);
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options)
    data.fonts = DSA5.journalFontSizes
    data.currentSize = game.settings.get('dsa5', 'journalFontSizeIndex')
    return data
  }
}