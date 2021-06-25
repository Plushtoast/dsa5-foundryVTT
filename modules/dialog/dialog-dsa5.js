import DSA5CombatDialog from './dialog-combat-dsa5.js'
import DialogShared from './dialog-shared.js'
import DSA5SpellDialog from './dialog-spell-dsa5.js'

export default class DSA5Dialog extends DialogShared {
    static getDialogForItem(type) {
        switch (type) {
            case "rangeweapon":
            case "meleeweapon":
            case "dodge":
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
            let val = Number($(ev.currentTarget).val())
            let factor = ev.ctrlKey ? 10 : 1
            switch (ev.button) {
                case 0:
                    val += factor
                    break;
                case 2:
                    val -= factor
                    break;
            }
            $(ev.currentTarget).val(val)
        });
        html.find('.modifiers option').mousedown(ev => {
            ev.preventDefault();
            $(ev.currentTarget).prop('selected', !$(ev.currentTarget).prop('selected'));
            return false;
        });
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            resizable: true
        });
        return options;
    }
}