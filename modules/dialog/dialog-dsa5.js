import DSA5CombatDialog from './dialog-combat-dsa5.js'
import DialogShared from './dialog-shared.js'
import DSA5SkillDialog from './dialog-skill-dsa5.js'
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
            case "skill":
                return DSA5SkillDialog
            
        }
        return DSA5Dialog
    }

    static getRollButtons(testData, dialogOptions, resolve, reject){
        let buttons = {
            rollButton: {
                label: game.i18n.localize("Roll"),
                callback: (html) => {
                    game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html)
                    resolve(dialogOptions.callback(html))
                },
            },
        }
        if (game.user.isGM) {
            mergeObject(buttons, {
                cheat: {
                    label: game.i18n.localize("DIALOG.cheat"),
                    callback: (html) => {
                        game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html)
                        resolve(dialogOptions.callback(html, { cheat: true }))
                    },
                },
            })
        }
        return buttons
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
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            resizable: true
        });
        return options;
    }
}