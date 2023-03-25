export default class Select2Dialog extends Dialog{
    activateListeners(html){
        super.activateListeners(html)
        html.find('.select2').select2()
    }
}