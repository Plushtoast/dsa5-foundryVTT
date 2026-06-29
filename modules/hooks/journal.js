import DSA5StatusEffects from '../status/status_effects.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import { increaseFontSize } from '../system/helpers/font-size-picker.js';
import { bindImgToCanvasDragStart } from './imgTileDrop.js';

export { increaseFontSize };

export default function () {
  Hooks.on('updateJournalEntryPage', (page, changed) => {
    if (page.type !== 'dsapersonaedramatis') return;
    if (!foundry.utils.hasProperty(changed, 'system.personae')) return;
    game.dsa5?.apps?.CalendarPicker?.refreshPersonae?.();
  });

  Hooks.on('renderJournalEntryPageSheet', (app, jhtml, data, options) => {
    if (!app.isView) return;

    for (const child of jhtml.children) {
      const html = $(child);
      DSA5ChatAutoCompletion.bindRollCommands(html);
      DSA5StatusEffects.bindButtons(html);
      html.find('img').on('mousedown', (ev) => {
        if (ev.button == 2)
          game.dsa5.apps.DSA5_Utility.showArtwork({
            name: app.document.name,
            uuid: '',
            img: ev.currentTarget.getAttribute('src'),
          });
      });
      bindImgToCanvasDragStart(html);
    }
  });

  Hooks.on('getHeaderControlsJournalEntrySheet', (sheet, buttons) => {
    buttons.unshift({
      label: 'SHEET.increaseFontSize',
      icon: 'fas fa-arrows-up-down',
      onClick: async (event) => {
        increaseFontSize($(sheet.element).find('.journal-entry-pages'), 'journalFontSizeIndex', event.currentTarget);
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
