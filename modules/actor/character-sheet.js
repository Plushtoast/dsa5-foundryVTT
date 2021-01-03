import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import ActorSheetDsa5 from "./actor-sheet.js";


export default class ActorSheetdsa5Character extends ActorSheetDsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "actor", "character-sheet"]),
            width: 770,
            height: 740,
        });
        return options;
    }

    get template() {
        if (!game.user.isGM && this.actor.limited) return "systems/dsa5/templates/actors/actor-limited.html";
        return "systems/dsa5/templates/actors/actor-sheet.html";

    }

    activateListeners(html) {
        super.activateListeners(html);
        html.find('.schip').click(ev => {
            ev.preventDefault()
            let form = $(this.form)
            let elem = $(ev.currentTarget)
            let val = Number(ev.currentTarget.getAttribute("data-val"))
            form.parent().find('[name="data.status.fatePoints.value"]').val(val)
            form.find('.schip').addClass('fullSchip').filter(function() {
                return Number(this.getAttribute('data-val')) > val
            }).removeClass('fullSchip').addClass('emptySchip')
            if (elem.hasClass("lastPoint")) {
                if (elem.hasClass("emptySchip")) {
                    form.parent().find('[name="data.status.fatePoints.value"]').val(1)
                    elem.removeClass("emptySchip").addClass('fullSchip')
                } else {
                    form.parent().find('[name="data.status.fatePoints.value"]').val(0)
                    elem.removeClass("fullSchip").addClass('emptySchip')
                }
            } else if (val == 1) {
                elem.addClass('lastPoint')
            } else if (val > 1) {
                form.find('.lastPoint').removeClass('lastPoint')
            }
        })
    }
}