import { DefaultAppv2 } from '../actor/baseapp.js';
import { applyTokenDisposition, getDispositionOptions } from '../system/helpers/token_disposition.js';

export class TokenDispositionDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    window: { title: 'DIALOG.tokenDispositionTitle' },
    position: { width: 340 },
    classes: ['dsa5'],
    actions: {
      setDisposition: TokenDispositionDialog.#setDisposition,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/token-disposition-dialog.hbs',
    },
  };

  constructor(tokens) {
    super();
    this.tokens = tokens;
  }

  static show(tokens) {
    if (!tokens?.length) {
      ui.notifications.warn('DIALOG.tokenDispositionNoTokens', { localize: true });
      return;
    }
    new TokenDispositionDialog(tokens).render(true);
  }

  async _prepareContext() {
    return {
      dispositions: getDispositionOptions(),
      tokenCount: this.tokens.length,
      ariaLabel: game.i18n.localize('DIALOG.tokenDispositionTitle'),
      describedBy: 'token-disposition-hint token-disposition-count',
    };
  }

  static async #setDisposition(_ev, target) {
    const disposition = Number(target.dataset.disposition);
    await applyTokenDisposition(this.tokens, disposition);
    this.close();
  }
}
