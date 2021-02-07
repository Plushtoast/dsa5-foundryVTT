import DSA5StatusEffects from "../../status/status_effects.js"
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js"
import DSA5 from "../../system/config-dsa5.js"
import DiceDSA5 from "../../system/dice-dsa5.js"
import DSA5_Utility from "../../system/utility-dsa5.js"
import Itemdsa5 from "../item-dsa5.js"

export default class TraitItemDSA5 extends Itemdsa5 {

    static chatData(data) {
        let res = []
        switch (data.traitType.value) {
            case "meleeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value)
                ]
            case "rangeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value),
                    this._chatLineHelper("reloadTime", data.reloadTime.value)
                ]
            case "armor":
                res = [
                    this._chatLineHelper("protection", data.damage.value),
                ]
            case "general":
                res = []
            case "familiar":
                res = [
                    this._chatLineHelper("APValue", data.APValue.value),
                    this._chatLineHelper("AsPCost", data.AsPCost.value),
                    this._chatLineHelper("duration", data.duration.value),
                    this._chatLineHelper("aspect", data.aspect.value)
                ]
        }
        if (data.effect.value != "")
            res.push(this._chatLineHelper("effect", data.effect.value))
        return res
    }
    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = source.data ? (source.data.data == undefined ? source : source.data) : source
        let traitType = source.data.traitType.value
        if (data.mode == "attack" && traitType == "meleeAttack") {
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
                targetWeaponSize: targetWeaponsize
            });
        } else if (data.mode == "attack" && traitType == "rangeAttack") {
            let targetSize = "average"
            if (game.user.targets.size) {
                game.user.targets.forEach(target => {
                    let tar = target.actor.data.data.size
                    if (tar)
                        targetSize = tar.value
                });
            }
            let rangeOptions = {...DSA5.rangeWeaponModifiers }
            delete rangeOptions[AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize('LocalizedIDs.senseOfRange')) ? "long" : "rangesense"]
            mergeObject(data, {
                rangeOptions: rangeOptions,
                sizeOptions: DSA5.rangeSizeCategories,
                visionOptions: DSA5.rangeVision,
                mountedOptions: DSA5.mountedRangeOptions,
                shooterMovementOptions: DSA5.shooterMovementOptions,
                targetMovementOptions: DSA5.targetMomevementOptions,
                targetSize: targetSize
            });
        }
    }
    static setupDialog(ev, options, item, actor) {
        let mode = options["mode"]
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