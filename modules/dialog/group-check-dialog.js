import Select2Dialog from './select2Dialog.js';
import RuleChaos from '../system/rules/rule_chaos.js';

export default class GroupCheckConfigDialog extends Select2Dialog {
  #bindOptions;

  constructor(data, bindOptions = {}) {
    super(data);
    this.#bindOptions = bindOptions;
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    $(this.element).on('mousedown', '.quantity-click', (ev) => RuleChaos.quantityClick(ev));
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.#bindOptions.onRender?.(this.element);
  }

  static initSelect2(root) {
    const $root = $(root);
    $root.find('select.select2').each(function () {
      const $el = $(this);
      if ($el.data('select2')) $el.select2('destroy');
      $el.select2({ width: '100%' });
    });
  }
}
