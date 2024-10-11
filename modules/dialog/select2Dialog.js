export default class Select2Dialog extends foundry.applications.api.DialogV2{
    _onRender(context, options) {
        super._onRender((context, options))

        const html = $(this.element)
        html.find('.select2').select2()
    }
}