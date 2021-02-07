import DSA5StatusEffects from "../../status/status_effects.js";
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js";
import DSA5 from "../../system/config-dsa5.js";
import DiceDSA5 from "../../system/dice-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";

export default class MeleeweaponDSA5 extends Itemdsa5 {
    static chatData(data) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("atmod", data.atmod.value),
            this._chatLineHelper("pamod", data.pamod.value),
            this._chatLineHelper("combatskill", data.combatskill.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper("effect", data.effect.value))

        return res
    }
    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        let wrongHandDisabled = AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize('LocalizedIDs.ambidextrous'))
        source = source.data ? (source.data.data == undefined ? source : source.data) : source
        if (data.mode == "attack") {
            let targetWeaponsize = "short"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    let defWeapon = target.actor.items.filter(x => x.data.type == "meleeweapon" && x.data.data.worn.value)
                    if (defWeapon.length > 0)
                        targetWeaponsize = defWeapon[0].data.data.reach.value
                });
            }
            mergeObject(data, {
                weaponSizes: DSA5.meleeRanges,
                melee: true,
                wrongHandDisabled: wrongHandDisabled,
                offHand: !wrongHandDisabled && source.data.worn.offHand,
                targetWeaponSize: targetWeaponsize
            });
        } else if (data.mode == "parry") {
            mergeObject(data, {
                defenseCount: 0,
                showDefense: true,
                wrongHandDisabled: wrongHandDisabled && source.data.worn.offHand,
                melee: true
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
        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            data: data,
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = actor._parseModifiers('[name = "situationalModifiers"]')
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.visionModifier = Number(html.find('[name="vision"]').val())
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.defenseCount = Number(html.find('[name="defenseCount"]').val())
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? -2 : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
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