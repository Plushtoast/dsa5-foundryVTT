import DialogShared from "../dialog/dialog-shared.js"
import DSA5 from "./config-dsa5.js"
import CreatureType from "./creature-type.js"
import DiceDSA5 from "./dice-dsa5.js"
import DSA5_Utility from "./utility-dsa5.js"

export default class EquipmentDamage {
    static armorWearModifier(armorData, armorValue) {
        if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
            switch (EquipmentDamage.calculateWear(armorData)) {
                case 1:
                case 2:
                    armorValue -= 1
                    break
                case 3:
                case 4:
                    armorValue = 0
            }
        }
        return Math.max(0, Number(armorValue))
    }

    static armorGetsDamage(damage, attackData) {
        return (damage > 14 || attackData.successLevel > 2) && game.settings.get("dsa5", "armorAndWeaponDamage")
    }

    static armorEncumbranceModifier(armor) {
        if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
            if (EquipmentDamage.calculateWear(armor) > 1) return 1
        }
        return 0
    }

    static async showDamageToGear(preData, testData) {
        if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
            let actor = DSA5_Utility.getSpeaker(preData.extra.speaker)
            let attackSuccessLevel = 0
            const opposeMessageId = getProperty(actor, "flags.oppose.messageId")
            if (opposeMessageId) {
                const attackMessage = game.messages.get(opposeMessageId)
                if (attackMessage) attackSuccessLevel = getProperty(attackMessage, "flags.data.postData.successLevel") || 0
            }

            const source = preData.source
            if (
                source._id &&
                source.system.structure &&
                (testData.successLevel < -2 || attackSuccessLevel > 2) && ["meleeweapon", "rangeweapon", "armor"].includes(source.type)
            ) {
                actor = await DSA5_Utility.getSpeaker(testData.speaker)
                return actor.items.get(source._id).uuid
            }
        }
        return undefined
    }

    static breakingTest(item) {
        if (!item)
            return ui.notifications.warn(
                game.i18n.format("DSAError.notfound", { category: "", name: game.i18n.localize("equipment") })
            )
        if (item.system.structure.max <= 0)
            return ui.notifications.warn(game.i18n.format("DSAError.noBreakingStructure", { name: item.name }))

        let breakingResistance = 0
        let category
        if (item.type == "armor") {
            category = game.i18n.localize(`ARMORSUBCATEGORIES.${item.system.subcategory}`)
            breakingResistance =
                getProperty(item, "structure.breakPointRating") || DSA5.armorSubcategories[item.system.subcategory]
        } else {
            category = item.system.combatskill.value
            breakingResistance =
                getProperty(item, "structure.breakPointRating") ||
                DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${category}`)]
        }
        if (!breakingResistance) {
            ui.notifications.error(game.i18n.format("DSAError.noBreakingResistance", { item: item.name }))
            return
        }

        let magicalWarning = ""
        const attributes = getProperty(item, "effect.attributes") || ""
        if (attributes.includes(CreatureType.clerical))
            magicalWarning = `${game.i18n.format("WEAPON.attributeWarning", { domain: CreatureType.clerical })}<br/>`
        else if (attributes.includes(CreatureType.magical))
            magicalWarning = `${game.i18n.format("WEAPON.attributeWarning", { domain: CreatureType.magical })}<br/>`

        new DialogShared({
            title: game.i18n.localize("DSASETTINGS.armorAndWeaponDamage"),
            content: `${magicalWarning}<label for="threshold">${game.i18n.format("WEAR.check", {
                category,
            })}</label>: <input class="quantity-click" style="width:80px" dtype="number" name="threshold" type="number" value="${breakingResistance}"/>`,
            buttons: {
                Yes: {
                    icon: '<i class="fas fa-dice-d20"></i>',
                    label: game.i18n.localize("Roll"),
                    callback: (dlg) => {
                        EquipmentDamage.resolveBreakingTest(item, Number(dlg.find('[name="threshold"]').val()), category)
                    },
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel"),
                },
            },
            default: "Yes",
        }).render(true)
    }

    static async applyDamageLevelToItem(item, amount) {
        const damage = Math.ceil(item.system.structure.max * 0.25) * amount
        await item.update({ "system.structure.value": Math.max(0, item.system.structure.value - damage) })
    }

    static async resolveBreakingTest(item, threshold, category) {
        const roll = await DiceDSA5.manualRolls(
            await new Roll("1d20").evaluate({ async: true }),
            game.i18n.format("WEAR.check", { category })
        )
        await DiceDSA5.showDiceSoNice(roll, await game.settings.get("core", "rollMode"))
        const damage = roll.total > threshold ? 1 : 0
        await this.applyDamageLevelToItem(item, damage)
        const wear = EquipmentDamage.calculateWear(item.data)
        let infoMsg = await renderTemplate("systems/dsa5/templates/system/breakingtest.html", { wear, item, threshold, category, roll, result: game.i18n.localize(`WEAR.${item.type}.${wear}`) })
        ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg))
    }

    static damageTooltip(item) {
        if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
            const wear = this.calculateWear(item)
            return { msg: game.i18n.localize(`WEAR.${item.type}.${wear}`), css: `gearD damaged${wear}` }
        }
        return { msg: "", css: "" }
    }

    static weaponWearModifier(weaponData) {
        if (game.settings.get("dsa5", "armorAndWeaponDamage")) {
            switch (EquipmentDamage.calculateWear(weaponData)) {
                case 1:
                    weaponData.attack -= 1
                    if (weaponData.parry) weaponData.parry -= 1
                    break
                case 2:
                    weaponData.attack -= 2
                    if (weaponData.parry) weaponData.parry -= 2
                    break
                case 3:
                case 4:
                    weaponData.attack = 0
                    if (weaponData.parry) weaponData.parry = 0
            }
        }
    }

    static calculateWear(itemData) {
        if (!itemData.system.structure || Number(itemData.system.structure.max <= 0)) return 0

        return Math.floor((1 - itemData.system.structure.value / itemData.system.structure.max) * 4)
    }
}