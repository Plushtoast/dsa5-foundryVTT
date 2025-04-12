export default class Select2Dialog extends foundry.applications.api.DialogV2 {
  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('.select2').select2();
  }
}
