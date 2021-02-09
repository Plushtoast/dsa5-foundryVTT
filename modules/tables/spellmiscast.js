import DSA5_Utility from "../system/utility-dsa5.js"

export default class Miscast {
    static getSpellMiscast() {
        let res = new Roll("2d6").roll().results[0]
        return DSA5_Utility.replaceDies(game.i18n.localize("SPELLMISCAST." + res))
    }

    static getLiturgyMiscast() {
        let res = new Roll("2d6").roll().results[0]
        return DSA5_Utility.replaceDies(game.i18n.localize("LITURGYMISCAST." + res))
    }

    static showBotchCard(table) {
        let result = Miscast[`get${table}Miscast`]()
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