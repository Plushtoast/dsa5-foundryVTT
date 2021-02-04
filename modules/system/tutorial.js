import DSA5_Utility from './utility-dsa5.js'

export default class DSA5Tutorial {
    static firstTimeMessage() {
        if (!(game.settings.get("dsa5", "firstTimeStart"))) {
            let msg = game.i18n.localize('WELCOME')
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg))
            game.settings.set("dsa5", "firstTimeStart", true)
        }
    }
}