export default class Select2Dialog extends foundry.applications.api.DialogV2 {
  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('.select2').each(function () {
      const $el = $(this);
      if (!$el.data('select2')) $el.select2({ width: '100%' });
    });
  }
}
