import MagicalActionHandler from './base-magical-action-item.js';

export default class NoModificationsAction extends MagicalActionHandler {
  applyDialogRestrictions(dialogData) {
    if (!super.applyDialogRestrictions(dialogData)) return;

    dialogData.canChangeCost = false;
    dialogData.canChangeRange = false;
    dialogData.canChangeCastingTime = false;
    dialogData.maxMods = 0;

    return true;
  }
}
