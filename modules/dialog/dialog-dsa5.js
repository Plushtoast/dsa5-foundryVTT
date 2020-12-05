import DSA5 from '../system/config-dsa5.js'

export default class DSA5Dialog extends Dialog {
    activateListeners(html) {
        super.activateListeners(html)
        html.find('.spellModifier').change(event => {
            let parent = $(event.currentTarget).parents(".skill-test")
            let castingTime = parent.find('.castingTime')
            let aspcost = parent.find('.aspcost')
            let reach = parent.find('.reach')

            let maxMods = parent.find('.maxMods')
            if (parent.find('.spellModifier:checked').length > Number(maxMods.text())) {
                event.currentTarget.checked = false
                maxMods.addClass("emphasize")
                setTimeout(function() {
                    maxMods.removeClass("emphasize")
                }, 600)
                return
            }

            let baseAsp = aspcost.data('base')
            let baseReach = reach.data('base')
            let baseCastingTime = castingTime.data('base')

            let newPosition = baseAsp
            let mod = 0
            parent.find('.spellModifier[data-cost]:checked').each(function(index, element) {
                newPosition = newPosition * (element.value < 0 ? 2 : 0.5)
                mod += Number(element.value)
            });
            if (newPosition < 1) {
                event.currentTarget.checked = false
            } else {
                aspcost.text(newPosition)
                aspcost.data('mod', mod)
            }

            mod = 0
            newPosition = baseCastingTime
            parent.find('.spellModifier[data-castingTime]:checked').each(function(index, element) {
                newPosition = newPosition * (element.value > 0 ? 2 : 0.5)
                mod += Number(element.value)
            });
            if (newPosition < 1) {
                event.currentTarget.checked = false
            } else {
                castingTime.text(newPosition)
                castingTime.data('mod', mod)
            }

            mod = 0
            let newReach = game.i18n.localize("ReverseSpellRanges." + baseReach)
            reach.text(baseReach)
            parent.find('.spellModifier[data-reach]:checked').each(function(index, element) {
                if (newReach == "self") {
                    element.checked = false
                } else if (newReach == "touch") {
                    reach.text("4 " + game.i18n.localize("step"))
                    mod += Number(element.value)
                } else {
                    let val = baseReach.split(" ")
                    reach.text(Number(val[0]) * 2 + " " + game.i18n.localize("step"))
                    mod += Number(element.value)
                }
            })
            reach.data('mod', mod)
        })

    }
}