import DSA5 from "../../system/config-dsa5.js";
import ItemRulesDSA5 from "../../system/item-rules-dsa5.js";
import LiturgyItemDSA5 from "./liturgy-item-dsa.js";

export default class CeremonyItemDSA5 extends LiturgyItemDSA5 {
    static getCallbackData(testData, html, actor) {
        super.getCallbackData(testData, html, actor)
        testData.situationalModifiers.push({
            name: game.i18n.localize("CEREMONYMODIFIER.artefact"),
            value: html.find('[name="artefactUsage"]').is(":checked") ? 1 : 0
        }, {
            name: game.i18n.localize("place"),
            value: html.find('[name="placeModifier"]').val()
        }, {
            name: game.i18n.localize("time"),
            value: html.find('[name="timeModifier"]').val()
        })
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        let skMod = 0
        let zkMod = 0
        situationalModifiers.push(...ItemRulesDSA5.getTalentBonus(actor.data, source.name, ["advantage", "disadvantage", "specialability", "equipment"]))
        if (game.user.targets.size) {
            game.user.targets.forEach(target => {
                skMod = target.actor.data.data.status.soulpower.max * -1
                zkMod = target.actor.data.data.status.toughness.max * -1
            });
        }
        mergeObject(data, {
            SKModifier: skMod,
            ZKModifier: zkMod,
            isCeremony: true,
            locationModifiers: DSA5.ceremonyLocationModifiers,
            timeModifiers: DSA5.ceremonyTimeModifiers
        })
    }
}