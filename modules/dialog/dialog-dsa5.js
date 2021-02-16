import DSA5CombatDialog from './dialog-combat-dsa5.js'
import DSA5SpellDialog from './dialog-spell-dsa5.js'

export default class DSA5Dialog extends Dialog {
    static getDialogForItem(type) {
        switch (type) {
            case "rangeweapon":
            case "meleeweapon":
            case "trait":
                return DSA5CombatDialog
            case "spell":
            case "ritual":
            case "liturgy":
            case "ceremony":
                return DSA5SpellDialog
        }
        return DSA5Dialog
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find(".dieButton").click(ev => {
            let elem = $(ev.currentTarget)
            if (elem.attr("data-single") == "true") {
                elem.closest(".dialog-content").find(".dieButton").removeClass("dieSelected")
            }
            elem.toggleClass('dieSelected')
        })
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
        html.find('option').mousedown(ev => {
            ev.preventDefault();
            console.log("muh")
            $(ev.currentTarget).prop('selected', !$(ev.currentTarget).prop('selected'));
            return false;
        });

    }
}