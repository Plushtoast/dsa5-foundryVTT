export default class MagicalActionHandler {
  applyDialogRestrictions(_dialogData) {
    return game.settings.get('dsa5', 'magischeHandlungen');
  }

  getBurgerMenuItems(_dialogState) {
    return [];
  }
}