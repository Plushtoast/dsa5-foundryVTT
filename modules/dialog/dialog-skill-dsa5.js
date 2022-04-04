import DSA5Dialog from "./dialog-dsa5.js";
import DialogShared from "./dialog-shared.js";

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
            }
        }
        mergeObject(nonOpposedButton, buttons)
        return nonOpposedButton
    }

    activateListeners(html){
        super.activateListeners(html)

        let targets = this.readTargets();
        // not great
        const that = this
        this.checkTargets = setInterval(function() {
            targets = that.compareTargets(html, targets);
        }, 500);
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