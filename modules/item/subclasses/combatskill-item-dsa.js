import Actordsa5 from "../../actor/actor-dsa5.js";
import DiceDSA5 from "../../system/dice-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";

export default class CombatskillDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("Description", game.i18n.localize(`Combatskilldescr.${name}`)),
        ]
    }

    static setupDialog(ev, options, item, actor) {
        let mode = options.mode
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            opposable: true,
            source: item,
            mode: mode,
            extra: {
                actor: actor.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers('[name="situationalModifiers"]')
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }
}