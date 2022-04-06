import DSA5 from "../system/config-dsa5.js"
import DSA5_Utility from "../system/utility-dsa5.js"

export default class DSATables {
    static async showBotchCard(dataset, options = {}) {
        const table = DSA5.systemTables.find(x => x.name == dataset.table)
        const tableResult = await DSATables.getRollTable(table.pack[game.i18n.lang], game.i18n.localize(`TABLENAMES.${dataset.table}`), dataset)
        const result = DSA5_Utility.replaceDies(DSA5_Utility.replaceConditions(tableResult.results[0].data.text))
        const title = `${game.i18n.localize("TABLENAMES." + dataset.table)}`
        const content = await renderTemplate(`systems/dsa5/templates/tables/tableCard.html`, { result, title })

        ChatMessage.create({
            user: game.user.id,
            content,
            whisper: options.whisper,
            blind: options.blind
        })
    }

    static async getRollTable(packName, name, options = {}) {
        const pack = game.packs.get(packName)
        const table = (await pack.getDocuments({ name: { $in: [name] } }))[0]
        let result = await table.draw({ displayChat: false })
        if (options.weaponless == "true" && result.roll.total < 7) {
            result.roll.editRollAtIndex([{ index: 0, val: result.roll.total + 5 }])
            result = await table.draw({ displayChat: false, roll: result.roll })
        }
        return result
    }

    static async tableEnabledFor(key) {
        const table = DSA5.systemTables.find(x => x.name == key)
        return (table ? game.settings.get(table.setting.module, table.setting.key) : false)
    }

    static rollCritBotchButton(table, weaponless) {
        const title = game.i18n.localize(`TABLENAMES.${table}`)
        return `, <a class="roll-button botch-roll" data-table="${table}" data-weaponless="${weaponless}}"><i class="fas fa-dice"></i>${title}</a>`
    }

    static async defaultBotch() {
        return ", " + game.i18n.localize("selfDamage") + (await new Roll("1d6+2").evaluate({ async: true })).total
    }

    static defaultAttackCrit(confirmed) {
        let res = ", " + game.i18n.localize("halfDefense")
        if (confirmed) res += ", " + game.i18n.localize("doubleDamage")
        return res
    }

    static defaultParryCrit() {
        return ", " + game.i18n.localize("attackOfOpportunity")
    }
}