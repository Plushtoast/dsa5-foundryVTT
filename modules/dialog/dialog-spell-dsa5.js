import DialogShared from "./dialog-shared.js";

export default class DSA5SpellDialog extends DialogShared {

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            resizable: true
        });
        return options;
    }

    static bigTimes = [
        5,
        30,
        120,
        480,
        960,
        1920
    ]

    prepareFormRecall(html) {
        super.prepareFormRecall(html)
        html.find('.spellModifier').trigger('change')
    }

    activateListeners(html) {
        super.activateListeners(html)
        html.find('.reloadButton').prop('disabled', Number(html.find('.castingTime').text()) < 2)

        html.find('.specAbs').mousedown(ev => {
            $(ev.currentTarget).toggleClass("active")
        })
        html.find('.modifiers option').mousedown(ev => {
            ev.preventDefault();
            $(ev.currentTarget).prop('selected', !$(ev.currentTarget).prop('selected'));
            return false;
        });

        html.find('.variableBaseCost').change(ev => {
            let parent = $(ev.currentTarget).parents(".skill-test")
            let oldVal = parent.find('.aspcost').attr("data-base")
            let newVal = $(ev.currentTarget).val()
            parent.find('.aspcost').attr("data-base", newVal)
            parent.find('.aspcost').text(Number(parent.find('.aspcost').text()) * newVal / oldVal)
        })

        html.find('.spellModifier').change(event => {
            let parent = $(event.currentTarget).parents(".skill-test")
            let castingTime = parent.find('.castingTime')
            let aspcost = parent.find('.aspcost')
            let reach = parent.find('.reach')
            let maintainCost = parent.find('.maintainCost')

            let bigCasts = parent.find('.ritual').length > 0

            let maxMods = parent.find('.maxMods')
            if (parent.find('.spellModifier:checked').length > Number(maxMods.text())) {
                event.currentTarget.checked = false
                maxMods.addClass("emphasize")
                setTimeout(function() {
                    maxMods.removeClass("emphasize")
                }, 600)
                return
            }

            let baseAsp = aspcost.attr('data-base')
            let baseReach = reach.attr('data-base')
            let baseCastingTime = castingTime.attr('data-base')

            let newPosition = baseAsp
            let newMaintainCost = maintainCost.attr('data-base')
            let mod = 0
            parent.find('.spellModifier[data-cost]:checked').each(function(index, element) {
                newPosition = newPosition * (element.value < 0 ? 0.5 : 2)
                if (newMaintainCost != "" && newMaintainCost != undefined) {
                    let maintains = String(newMaintainCost).split(" ")
                    maintains[0] = Number(maintains[0]) * (element.value < 0 ? 0.5 : 2)
                    newMaintainCost = maintains.join(" ")
                }
                mod += Number(element.value)
            });
            if (newPosition < 1) {
                event.currentTarget.checked = false
            } else {
                aspcost.text(newPosition)
                maintainCost.text(newMaintainCost)
                aspcost.attr('data-mod', mod)
            }

            mod = 0
            newPosition = baseCastingTime
            parent.find('.spellModifier[data-castingTime]:checked').each(function(index, element) {
                if (bigCasts) {
                    let ind = DSA5SpellDialog.bigTimes.indexOf(Number(newPosition))
                    if (ind != undefined) {
                        let newIndex = ind + (element.value > 0 ? 1 : -1)
                        if (newIndex < DSA5SpellDialog.bigTimes.length && newIndex >= 0) {
                            newPosition = DSA5SpellDialog.bigTimes[newIndex]
                        } else {
                            ui.notifications.error(game.i18n.localize("DSAError.CastingTimeLimit"))
                        }
                    } else {
                        ui.notifications.error(game.i18n.localize("DSAError.TimeCannotBeParsed"))
                    }
                } else {
                    newPosition = newPosition * (element.value > 0 ? 2 : 0.5)
                }

                mod += Number(element.value)
            });
            if (newPosition < 1) {
                event.currentTarget.checked = false
            } else {
                castingTime.text(newPosition)
                castingTime.attr('data-mod', mod)
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
                    newReach = Number(val[0])
                    if (isNaN(newReach)) {
                        event.currentTarget.checked = false
                        ui.notifications.error(game.i18n.localize("DSAError.RangeCannotBeParsed"))
                    } else {
                        reach.text((newReach * 2) + " " + game.i18n.localize("step"))
                        mod += Number(element.value)
                    }
                }
            })
            reach.attr('data-mod', mod)
            html.find('.reloadButton').prop('disabled', Number(html.find('.castingTime').text()) < 2)
        })
    }
}