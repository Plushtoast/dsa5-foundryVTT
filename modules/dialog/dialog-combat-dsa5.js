export default class DSA5CombatDialog extends Dialog {

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            resizable: true
        });
        return options;
    }


    activateListeners(html) {
        super.activateListeners(html)
        let roman = ['', ' I', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX']
        html.find('.specAbs').mousedown(ev => {

            if (html.find('.opportunityAttack').is(":checked")) {
                ui.notifications.error(game.i18n.localize("DSAError.opposedAttackNoSpecAbs"))
                return
            }

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
        html.find(".opportunityAttack").change(ev => {
            if ($(ev.currentTarget).is(":checked")) {
                for (let k of html.find('.specAbs')) {
                    $(k).removeClass('active').attr("data-step", 0).find('.step').text('')
                }
            }
        })
        html.find('.modifiers option').mousedown(ev => {
            ev.preventDefault();
            $(ev.currentTarget).prop('selected', !$(ev.currentTarget).prop('selected'));
            return false;
        });
        html.find('.quantity-click').mousedown(ev => {
            let val = $(ev.currentTarget).val()
            switch (ev.button) {
                case 0:
                    if (ev.ctrlKey)
                        val += 10;
                    else
                        val++;
                    break;
                case 2:
                    if (ev.ctrlKey)
                        val -= 10;
                    else
                        val--;
                    break;
            }
            $(ev.currentTarget).val(val)
        });
    }
}