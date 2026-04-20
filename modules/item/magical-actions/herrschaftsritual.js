import MagicalActionHandler from './base-magical-action-item.js';

export default class HerrschaftsritualAction extends MagicalActionHandler {
  applyDialogRestrictions(dialogData) {
    if (!super.applyDialogRestrictions(dialogData)) return;

    dialogData.canChangeCost = false;
    dialogData.canChangeRange = false;

    return true;
  }
}
