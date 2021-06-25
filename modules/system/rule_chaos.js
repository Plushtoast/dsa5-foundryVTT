import SpecialabilityRulesDSA5 from "./specialability-rules-dsa5.js"

export default class RuleChaos {
    static multipleDefenseValue(actor, item) {
        let multipleDefense = -3

        if ((item.type == "dodge" || getProperty(item, "data.combatskill.value") == game.i18n.localize("LocalizedIDs.wrestle")) && SpecialabilityRulesDSA5.hasAbility(actor, game.i18n.localize("LocalizedIDs.masterfulDodge")))
            multipleDefense = -2
        else if (SpecialabilityRulesDSA5.hasAbility(actor, game.i18n.localize("LocalizedIDs.masterfulParry")))
            multipleDefense = -2

        return multipleDefense
    }
}