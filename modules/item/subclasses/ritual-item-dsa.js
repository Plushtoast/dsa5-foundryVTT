import DSA5 from "../../system/config-dsa5.js";
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js";
import SpellItemDSA5 from "./spell-item-dsa.js";
export default class RitualItemDSA5 extends SpellItemDSA5 {
    static getCallbackData(testData, html, actor) {
        super.getCallbackData(testData, html, actor)
        testData.situationalModifiers.push({
            name: game.i18n.localize("RITUALMODIFIER.rightClothes"),
            value: html.find('[name="rightClothes"]').is(":checked") ? 1 : 0
        }, {
            name: game.i18n.localize("RITUALMODIFIER.rightEquipment"),
            value: html.find('[name="rightEquipment"]').is(":checked") ? 1 : 0
        }, {
            name: game.i18n.localize("place"),
            value: html.find('[name="placeModifier"]').val()
        }, {
            name: game.i18n.localize("time"),
            value: html.find('[name="timeModifier"]').val()
        })
    }
    static getSituationalModifiers(situationalModifiers, actor, data) {
        let skMod = 0
        let zkMod = 0
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.minorSpirits'), -1))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.magicalAttunement')))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.magicalRestriction'), -1))
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.boundToArtifact'), -1))
        if (game.user.targets.size) {
            game.user.targets.forEach(target => {
                skMod = target.actor.data.data.status.soulpower.max * -1
                zkMod = target.actor.data.data.status.toughness.max * -1
            });
        }
        mergeObject(data, {
            SKModifier: skMod,
            ZKModifier: zkMod,
            isRitual: true,
            locationModifiers: DSA5.ritualLocationModifiers,
            timeModifiers: DSA5.ritualTimeModifiers
        })
    }
}