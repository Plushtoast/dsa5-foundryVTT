export default class DSA5CombatDialog extends Dialog {
    constructor(data, options) {
        super(data, options);
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
        });
        return options;
    }


    activateListeners(html) {
        super.activateListeners(html)
        let roman = ['', ' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX']
        html.find('.specAbs').mousedown(ev => {

            let step = Number($(ev.currentTarget).attr('data-step'))
            let maxStep = Number($(ev.currentTarget).attr('data-maxStep'))


            if (ev.button == 0) {
                step = Math.min(maxStep, step + 1)
            } else if (ev.button == 2) {
                step = Math.max(0, Math.min(maxStep, step - 1))
            }
            $(ev.currentTarget).attr('data-step', step)
            if (step > 0) {
                $(ev.currentTarget).addClass("active")
            } else {
                $(ev.currentTarget).removeClass("active")
            }
            $(ev.currentTarget).find('.step').text(roman[step])
        });
    }
}