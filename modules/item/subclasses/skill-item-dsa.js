import DSA5StatusEffects from "../../status/status_effects.js";
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js";
import DSA5 from "../../system/config-dsa5.js";
import DiceDSA5 from "../../system/dice-dsa5.js";
import SpecialabilityRulesDSA5 from "../../system/specialability-rules-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";

export default class SkillItemDSA5 extends Itemdsa5 {

    static chatData(data, name) {
        return [
            this._chatLineHelper("Description", game.i18n.localize(`SKILLdescr.${name}`)),
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...AdvantageRulesDSA5.getTalentBonus(actor.data, source.name))
        situationalModifiers.push(...SpecialabilityRulesDSA5.getTalentBonus(actor.data, source.name))
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
            difficultyLabels: (DSA5.skillDifficultyLabels)
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
                testData.situationalModifiers = actor._parseModifiers('[name = "situationalModifiers"]')
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