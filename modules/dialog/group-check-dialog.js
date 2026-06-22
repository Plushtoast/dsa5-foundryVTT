import Select2Dialog from './select2Dialog.js';

export default class GroupCheckConfigDialog extends Select2Dialog {
  #bindOptions;

  constructor(data, bindOptions = {}) {
    super(data);
    this.#bindOptions = bindOptions;
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
