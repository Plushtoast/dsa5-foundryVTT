import DSA5_Utility from "../system/utility-dsa5.js"

export default class CombatTables {
    static async getDefenseBotch(weaponless = false) {
        let res = await new Roll("2d6").evaluate({ async: true })
        if (weaponless && res < 7)
            res += 5
        return DSA5_Utility.replaceDies(game.i18n.localize("DEFENSEBOTCH." + res.total))
    }
    static async getMeleeBotch(weaponless = false) {
        let res = await new Roll("2d6").evaluate({ async: true })
        if (weaponless && res < 7)
            res += 5
        return DSA5_Utility.replaceDies(game.i18n.localize("MELEEBOTCH." + res.total))
    }
    static async getRangeBotch() {
        let res = await new Roll("2d6").evaluate({ async: true })
        return DSA5_Utility.replaceDies(game.i18n.localize("RANGEBOTCH." + res.total))
    }

    //TODO blind and whisper missing
    static async showBotchCard(table, weaponless) {
        let result = await CombatTables[`get${table}Botch`](weaponless == "true")
        let title = `${game.i18n.localize("TABLENAMES." + table)}`
        let options = {}
        renderTemplate(`systems/dsa5/templates/tables/tableCard.html`, { result: result, title: title }).then(html => {
            let chatOptions = {
                user: game.user.id,
                content: html,
                whisper: options.whisper,
                blind: options.blind,
            }
            ChatMessage.create(chatOptions)
        })
    }
}