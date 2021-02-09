import DSA5_Utility from "../system/utility-dsa5.js"

export default class CombatTables {
    static getDefenseBotch(weaponless = false) {
        let res = new Roll("2d6").roll().results[0]
        if (weaponless && res < 7)
            res += 5
        return DSA5_Utility.replaceDies(game.i18n.localize("DEFENSEBOTCH." + res))
    }
    static getMeleeBotch(weaponless = false) {
        let res = new Roll("2d6").roll().results[0]
        if (weaponless && res < 7)
            res += 5
        return DSA5_Utility.replaceDies(game.i18n.localize("MELEEBOTCH." + res))
    }
    static getRangeBotch() {
        let res = new Roll("2d6").roll().results[0]
        return DSA5_Utility.replaceDies(game.i18n.localize("RANGEBOTCH." + res))
    }

    //TODO blind and whisper missing
    static showBotchCard(table, weaponless) {
        let result = CombatTables[`get${table}Botch`](weaponless == "true")
        let title = `${game.i18n.localize("TABLENAMES." + table)}`
        let options = {}
        renderTemplate(`systems/dsa5/templates/tables/tableCard.html`, { result: result, title: title }).then(html => {
            let chatOptions = {
                user: game.user._id,
                content: html,
                whisper: options.whisper,
                blind: options.blind,
            }
            ChatMessage.create(chatOptions)
        })
    }
}