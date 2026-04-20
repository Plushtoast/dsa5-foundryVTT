import NoModificationsAction from './no-modifications.js';

export default class SchelmenstreicheAction extends NoModificationsAction {
  applyDialogRestrictions(dialogData) {
    super.applyDialogRestrictions(dialogData);
    dialogData.extensions = [];
  }
}
