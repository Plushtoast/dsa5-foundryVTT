import DSA5StatusEffects from "../../status/status_effects.js";
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js";
import DSA5 from "../../system/config-dsa5.js";
import DiceDSA5 from "../../system/dice-dsa5.js";
import ItemRulesDSA5 from "../../system/item-rules-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";
import Actordsa5 from "../../actor/actor-dsa5.js";
export default class SkillItemDSA5 extends Itemdsa5 {

    static chatData(data, name) {
        return [
            this._chatLineHelper("Description", game.i18n.localize(`SKILLdescr.${name}`)),
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...ItemRulesDSA5.getTalentBonus(actor.data, source.name, ["advantage", "disadvantage", "specialability", "equipment"]))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.minorSpirits'), -1))
    }

    static setupDialog(ev, options, skill, actor) {
        let title = skill.name + " " + game.i18n.localize("Test");
        let testData = {
            opposable: true,
            source: skill,
            extra: {
                actor: actor.data,
                options: options,
            }
        };

        let data = {
            rollMode: options.rollMode,
            difficultyLabels: (DSA5.skillDifficultyLabels),
            modifier: options.modifier || 0,
            characteristics: [1, 2, 3].map(x => skill.data[`characteristic${x}`].value)
        }

        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, skill) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, skill)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/skill-dialog.html",
            data: data,

            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
                testData.situationalModifiers = Actordsa5._parseModifiers('[name="situationalModifiers"]')
                testData.advancedModifiers = {
                    chars: [0, 1, 2].map(x => Number(html.find(`[name="ch${x}"]`).val())),
                    fps: Number(html.find(`[name="fp"]`).val())
                }
                return { testData, cardOptions };
            }
        };

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/skill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }
}