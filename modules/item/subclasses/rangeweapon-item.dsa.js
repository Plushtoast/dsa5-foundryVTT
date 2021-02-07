import DSA5StatusEffects from "../../status/status_effects.js";
import AdvantageRulesDSA5 from "../../system/advantage-rules-dsa5.js";
import DSA5 from "../../system/config-dsa5.js";
import DiceDSA5 from "../../system/dice-dsa5.js";
import Itemdsa5 from "../item-dsa5.js";

export default class RangeweaponItemDSA5 extends Itemdsa5 {
    static chatData(data) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("combatskill", data.combatskill.value),
            this._chatLineHelper("reach", data.reach.value)
        ]
        if (data.effect.value != "")
            res.push(this._chatLineHelper("effect", data.effect.value))

        return res
    }
    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor.data, game.i18n.localize('LocalizedIDs.restrictedSenseSight'), -2))
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

        if (actor.data.type != "creature") {
            let itemData = item.data.data ? item.data.data : item.data

            if (itemData.ammunitiongroup.value == "-") {
                testData.extra.ammo = duplicate(item)
                if ((testData.extra.ammo.data.quantity.value <= 0)) {
                    ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))
                    return
                }
            } else {
                testData.extra.ammo = duplicate(actor.getEmbeddedEntity("OwnedItem", itemData.currentAmmo.value))
                if (!testData.extra.ammo || itemData.currentAmmo.value == "" || testData.extra.ammo.data.quantity.value <= 0) {
                    ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))
                    return
                }
            }
        }

        let data = {
            rollMode: options.rollMode
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
                testData.situationalModifiers.push({
                    name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
                    value: Number(html.find('[name="targetMovement"]').val())
                }, {
                    name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
                    value: Number(html.find('[name="shooterMovement"]').val())
                }, {
                    name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
                    value: Number(html.find('[name="mountedOptions"]').val())
                }, {
                    name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
                    value: html.find('[name="quickChange"]').is(":checked") ? -4 : 0
                })
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