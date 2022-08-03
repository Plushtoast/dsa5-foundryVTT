import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5Dialog from "./dialog-dsa5.js";
import DialogShared from "./dialog-shared.js";
import DSA5 from "../system/config-dsa5.js";
import Actordsa5 from "../actor/actor-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";

export default class DSA5SkillDialog extends DialogShared {
    static getRollButtons(testData, dialogOptions, resolve, reject) {
        let buttons = DSA5Dialog.getRollButtons(testData, dialogOptions, resolve, reject);
        buttons.rollButton.label = game.i18n.localize("Opposed")
        const nonOpposedButton = {
            nonOpposedButton: {
                label: game.i18n.localize("Roll"),
                callback: (html) => {
                    game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html)
                    testData.opposable = false
                    resolve(dialogOptions.callback(html))
                },
            },
            routineRoll: {
                label: game.i18n.localize("ROLL.routine"),
                callback: (html) => {
                    game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html)
                    testData.routine = true
                    mergeObject(testData.extra.options, {
                        cheat: true,
                        predefinedResult: [{ val: 2, index: 0 }, { val: 2, index: 1 }, { val: 2, index: 2 }]
                    })
                    resolve(dialogOptions.callback(html))
                },
            }
        }
        mergeObject(nonOpposedButton, buttons)
        return nonOpposedButton
    }

    activateListeners(html) {
        super.activateListeners(html)

        html.on("change", "input,select", ev => this.rememberFormData(ev))

        let targets = this.readTargets();
        // not great
        const that = this
        this.checkTargets = setInterval(function() {
            targets = that.compareTargets(html, targets);
        }, 500);

        this.rememberFormData()
        html.on('mousedown', '.quantity-click', ev => this.rememberFormData(ev))

        html.find(".modifiers option").mousedown((ev) => {
            this.rememberFormData(ev)
        })
    }

    rememberFormData(ev) {
        const data = new FormDataExtended(this.element.find('form')[0]).toObject()
        data.situationalModifiers = Actordsa5._parseModifiers(this._element)
        this.calculateRoutine(data)
    }

    calculateRoutine(data) {
        const actor = DSA5_Utility.getSpeaker(this.dialogData.speaker)
        const routineButton = this.element.find('.routineRoll')
        if (!actor) return routineButton.prop("disabled", true)

        const routineAllowed = true
        for (let i = 0; i < 3; i++) {
            if (actor.data.data.characteristics[data[`characteristics${i}`]].max * data[`ch${i}`].max < 13) {
                routineAllowed = false
                break
            }
        }

        const fw = this.dialogData.source.data.talentValue.value + data.fw + DiceDSA5._situationalModifiers(data, "FW")
        const mod = DSA5.skillDifficultyModifiers[data.testDifficulty] + DiceDSA5._situationalModifiers(data)
        const requiredFw = Math.clamped(10 - mod * 3, 1, 19)
        const enoughFw = fw >= requiredFw
        const canRoutine = routineAllowed && enoughFw
        const routine = game.i18n.localize('ROLL.routine')
        routineButton.prop("disabled", !canRoutine)
        routineButton.html(canRoutine ? `${routine} (${game.i18n.localize('CHARAbbrev.FW')} ${Math.round(fw/2)})` : routine)
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            width: 700,
            resizable: true,
        });
        return options;
    }
}