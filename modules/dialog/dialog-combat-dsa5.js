import DialogShared from "./dialog-shared.js";

export default class DSA5CombatDialog extends DialogShared {

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
        let specAbs = html.find('.specAbs')
        specAbs.mouseenter(ev => {
            if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
                let div = document.createElement('div')
                div.classList.add("hovermenu")
                let post = document.createElement('i')
                post.classList.add("fas", "fa-comment")
                post.title = game.i18n.localize('SHEET.PostItem')
                post.addEventListener('mousedown', this._postItem, false)
                div.appendChild(post)
                ev.currentTarget.appendChild(div)
            }
        });
        specAbs.mouseleave(ev => {
            let e = ev.toElement || ev.relatedTarget;
            if (e.parentNode == this || e == this)
                return;

            ev.currentTarget.querySelectorAll('.hovermenu').forEach(e => e.remove());
        });


        html.on("mousedown", ".specAbs", ev => {
            if (html.find('.opportunityAttack').is(":checked")) {
                ui.notifications.error(game.i18n.localize("DSAError.opposedAttackNoSpecAbs"))
                return
            }
            const elem = $(ev.currentTarget)
            let step = Number(elem.attr('data-step'))
            const maxStep = Number(elem.attr('data-maxStep'))
            const subcategory = Number(elem.attr('data-category'))

            if (ev.button == 0) {
                step = Math.min(maxStep, step + 1)
                if ([0, 1].includes(subcategory) && game.settings.get("dsa5", "limitCombatSpecAbs")) {
                    const siblings = elem.siblings(`[data-category="${subcategory}"]`)
                    siblings.removeClass('active').attr("data-step", 0)
                    siblings.find('.step').text(DialogShared.roman[0])
                }
            } else if (ev.button == 2) {
                step = Math.max(0, Math.min(maxStep, step - 1))
            }
            elem.attr('data-step', step)
            if (step > 0) {
                elem.addClass("active")
            } else {
                elem.removeClass("active")
            }
            elem.find('.step').text(DialogShared.roman[step])
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
    }

    _postItem(ev) {
        ev.stopPropagation()
        const elem = $(ev.currentTarget).closest('.specAbs')
        const actorId = elem.attr("data-actor")
        const id = elem.attr("data-id")

        const actor = game.actors.get(actorId)
        actor.items.get(id).postItem()

        return false
    }
}