const { renderTemplate } = foundry.applications.handlebars;

/**
 * Shared yes/no confirmation for destructive removals (items, depots, bulk inventory).
 */
export default class DeleteConfirmationDialog {
  static TEMPLATE = 'systems/dsa5/templates/dialog/delete-item-dialog.hbs';
  static DEFAULT_TITLE = 'DIALOG.deleteConfirmation';

  /**
   * @param {object} options
   * @param {string} options.message Localized HTML shown in the dialog body
   * @param {string} [options.title='DIALOG.deleteConfirmation']
   * @param {string} [options.id] Stable ApplicationV2 id so repeat opens focus the existing dialog
   * @returns {Promise<boolean>}
   */
  static async confirm({ message, title = this.DEFAULT_TITLE, id } = {}) {
    if (id) {
      const existing = foundry.applications.instances.get(id);
      if (existing) {
        existing.bringToTop();
        return false;
      }
    }

    const content = await renderTemplate(this.TEMPLATE, { message });
    const proceed = await foundry.applications.api.DialogV2.confirm({
      ...(id ? { id } : {}),
      window: { title },
      content,
      rejectClose: false,
      modal: true,
    });
    return !!proceed;
  }
}
