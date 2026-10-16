import JournalListUx from './journal-list-ux.js';

export default class DSAJournalSheet extends foundry.applications.sheets.journal.JournalEntrySheet {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'dsajournal']
  };

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const article of this.pagesInView || []) {
      const sheet = this.getPageSheet(article.dataset.pageId);
      if (sheet?.listUxDescriptor) JournalListUx.syncTocVisibility(sheet);
    }
  }
}
