import DSA5_Utility from './utility-dsa5.js'

export default class DSA5Tutorial {

    static firstTimeMessage() {

        if (!(game.settings.get("dsa5", "firstTimeStart"))) {
            let msg = game.i18n.localize('WELCOME')
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg))
            DSA5Tutorial.firstTimeLanguage()
            game.settings.set("dsa5", "firstTimeStart", true)
        }
    }


    static firstTimeLanguage() {
        let langs = ["de", "en"]
        let data = {
            title: game.i18n.localize("DIALOG.firstTime"),
            content: game.i18n.localize("DIALOG.firstTimeWarning"),
            default: 'de',
            buttons: {}
        }
        for (let lang of langs) {
            data.buttons[lang] = {
                label: game.i18n.localize(lang),
                callback: dlg => {
                    DSA5Tutorial.setLanguage(lang)
                }
            }
        }

        new Dialog(data).render(true)
    }

    static setLanguage(lang) {
        game.settings.set("dsa5", "firstTimeStart", true)
        game.settings.set("core", "language", lang)
    }
}