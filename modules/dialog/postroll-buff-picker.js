import PostRollBuffs from '../system/rolls/postroll-buffs.js';

export class PostRollBuffPicker extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: 'dsa-postroll-buff-picker',
    tag: 'form',
    window: {
      title: 'DIALOG.postRollBuffPickerTitle',
      icon: 'fa-solid fa-wand-magic-sparkles',
    },
    position: {
      width: 420,
    },
    actions: {
      apply: this._onApply,
      cancel: this._onCancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/postroll-buff-picker.hbs',
    },
  };

  constructor(message, matches, onApply) {
    super();
    this.message = message;
    this.matches = Array.isArray(matches) ? matches : [];
    this.onApply = typeof onApply === 'function' ? onApply : null;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const preselectSingle = this.matches.length === 1;

    data.matches = this.matches.map((m, index) => {
      return {
        index,
        label: this._formatLabel(m),
        effectUuid: m.effectUuid,
        fp: m.fp,
        qs: m.qs,
        rerollDice: m.rerollDice,
        charges: m.charges,
        checked: preselectSingle,
        rootID: foundry.utils.randomID()
      };
    });

    return data;
  }

  _formatLabel(match) {
    const fpLabel = game.i18n.localize('CHARAbbrev.FP');
    const qsLabel = game.i18n.localize('CHARAbbrev.QS');
    const parts = [];
    if (match.fp) parts.push(`${fpLabel} ${match.fp > 0 ? '+' : ''}${match.fp}`);
    if (match.qs) parts.push(`${qsLabel} ${match.qs > 0 ? '+' : ''}${match.qs}`);
    if (match.rerollDice) parts.push(game.i18n.format('DIALOG.postRollRerollDice', { count: match.rerollDice }));
    const charges = match.charges?.max ? ` [${match.charges.value ?? 0}/${match.charges.max}]` : '';
    return `${match.effectName} (${parts.join(', ')})${charges}`;
  }

  static async _onCancel(_event, _target) {
    this.close();
  }

  static async _onApply(event, _target) {
    event?.preventDefault();

    const form = this.element?.tagName === 'FORM' ? this.element : this.element?.querySelector('form');
    if (!form) return;

    const fd = new foundry.applications.ux.FormDataExtended(form).object;
    const selectedRaw = fd.selected;
    const selected = Array.isArray(selectedRaw) ? selectedRaw : (selectedRaw != null ? [selectedRaw] : []);
    const indexes = selected.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    const chosen = indexes.map((i) => this.matches[i]).filter(Boolean);

    if (chosen.length === 0) {
      ui.notifications.warn('DIALOG.noSelection', { localize: true });
      return;
    }

    if (this.onApply) {
      await this.onApply(chosen);
    }

    this.close();
  }
}
