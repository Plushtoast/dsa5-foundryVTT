import DSA5StatusEffects from "../../status/status_effects.js";
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js";
import DSA5 from "../../system/config-dsa5.js";
import DiceDSA5 from "../../system/dice-dsa5.js";
import SpecialabilityRulesDSA5 from "../../system/specialability-rules-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";
import Actordsa5 from "../../actor/actor-dsa5.js";
import DSA5_Utility from "../../system/utility-dsa5.js";

export default class MeleeweaponDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("atmod", data.atmod.value),
            this._chatLineHelper("pamod", data.pamod.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper(DSA5_Utility.replaceConditions("effect", data.effect.value)))

        return res
    }


    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        let wrongHandDisabled = AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize('LocalizedIDs.ambidextrous'))
        source = source.data ? (source.data.data == undefined ? source : source.data) : source

        let toSeach = [source.data.combatskill.value.toLowerCase(), game.i18n.localize("LocalizedIDs.all")]
        let combatSpecAbs = actor.items.filter(x => x.type == "specialability" && x.data.data.category.value == "Combat" && x.data.data.effect.value != "" && x.data.data.list.value.split(",").map(x => x.trim().toLowerCase()).filter(y => toSeach.includes(y)).length > 0)
        let combatskills = []
        if (data.mode == "attack") {
            let targetWeaponsize = "short"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    let defWeapon = target.actor.items.filter(x => x.data.type == "meleeweapon" && x.data.data.worn.value)
                    if (defWeapon.length > 0)
                        targetWeaponsize = defWeapon[0].data.data.reach.value
                });
            }
            for (let com of combatSpecAbs) {
                let effects = Itemdsa5.parseEffect(com.data.data.effect.value, actor)
                let bonus = effects[game.i18n.localize("LocalizedAbilityModifiers.at")] || 0
                let tpbonus = effects[game.i18n.localize("LocalizedAbilityModifiers.tp")] || 0
                if (bonus != 0 || tpbonus != 0)
                    combatskills.push({
                        name: com.name,
                        atbonus: bonus,
                        tpbonus: tpbonus,
                        label: `${game.i18n.localize("LocalizedAbilityModifiers.at")}: ${bonus}, ${game.i18n.localize("LocalizedAbilityModifiers.tp")}: ${tpbonus}`,
                        steps: com.data.data.step.value
                    })
            }
            mergeObject(data, {
                weaponSizes: DSA5.meleeRanges,
                melee: true,
                wrongHandDisabled: wrongHandDisabled,
                offHand: !wrongHandDisabled && source.data.worn.offHand,
                targetWeaponSize: targetWeaponsize,
                combatSpecAbs: combatskills,
                showAttack: true,
                constricted: actor.hasCondition("constricted")
            });
        } else if (data.mode == "parry") {
            for (let com of combatSpecAbs) {
                let effects = Itemdsa5.parseEffect(com.data.data.effect.value, actor)

                let bonus = effects[game.i18n.localize("LocalizedAbilityModifiers.pa")] || 0
                if (bonus != 0)
                    combatskills.push({
                        name: com.name,
                        pabonus: bonus,
                        tpbonus: 0,
                        label: `${game.i18n.localize("LocalizedAbilityModifiers.pa")}: ${bonus}`,
                        steps: com.data.data.step.value
                    })
            }
            mergeObject(data, {
                defenseCount: 0,
                showDefense: true,
                wrongHandDisabled: wrongHandDisabled && source.data.worn.offHand,
                melee: true,
                combatSpecAbs: combatskills,
                constricted: actor.hasCondition("constricted")
            });
        }
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
        let data = {
            rollMode: options.rollMode,
            mode: mode
        }
        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode: mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers


        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data: data,
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers('[name="situationalModifiers"]')
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.visionModifier = Number(html.find('[name="vision"]').val())
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.defenseCount = Number(html.find('[name="defenseCount"]').val())
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? (-2 + SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize('LocalizedIDs.twoWeaponCombat'))) : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
                let attackOfOpportunity = html.find('[name="opportunityAttack"]').is(":checked") ? -4 : 0
                testData.attackOfOpportunity = attackOfOpportunity != 0
                testData.situationalModifiers.push({
                    name: game.i18n.localize("opportunityAttack"),
                    value: attackOfOpportunity
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("attackFromBehind"),
                    value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0
                })
                testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, mode))

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