export default class Miscast {
    static getSpellMiscast() {
        let res = new Roll("2d6").roll().results[0]
        let rand = new Roll("1d6").roll().results[0]
        return game.i18n.localize("SPELLMISCAST." + res).replace("1D6", rand)
    }

    static getLiturgyMiscast() {
        let res = new Roll("2d6").roll().results[0]
        let rand = new Roll("1d6").roll().results[0]
        let rand2 = new Roll("2d6").roll().results[0]
        return game.i18n.localize("LITURGYMISCAST." + res).replace("1D6", rand).replace("2D6", rand2)
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