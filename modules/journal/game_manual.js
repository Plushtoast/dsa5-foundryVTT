export default function registerGameManual() {
  if (game.i18n.lang == 'de') {
    game.dsa5.apps.journalBrowser.manuals.push({
      id: 'Game Manual (Foundry VTT)',
      path: 'systems/dsa5/modules/journal/bookde.json',
      visible: true,
    });
  } else {
    game.dsa5.apps.journalBrowser.manuals.push({
      id: 'Game Manual (Foundry VTT)',
      path: 'systems/dsa5/modules/journal/booken.json',
      visible: true,
    });
  }
}
