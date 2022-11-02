import DSA5_Utility from './utility-dsa5.js'

export default class DSA5Tutorial {

    static async firstTimeMessage() {
        if (!(await game.settings.get("dsa5", "firstTimeStart"))) {
            await DSA5Tutorial.setupDefaultOptions()
            let msg = game.i18n.localize('WELCOME')
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg))
            DSA5Tutorial.firstTimeLanguage()
            await game.settings.set("dsa5", "firstTimeStart", true)
        }
    }

    static firstTimeLanguage() {
        const langs = ["de", "en"]
        let data = {
            title: game.i18n.localize("DIALOG.firstTime"),
            content: game.i18n.localize("DIALOG.firstTimeWarning"),
            default: 'de',
            buttons: {}
        }
        for (const lang of langs) {
            data.buttons[lang] = {
                label: game.i18n.localize(lang),
                callback: () => DSA5Tutorial.setLanguage(lang)
            }
        }

        new Dialog(data).render(true)
    }

    static async setLanguage(lang) {
        await game.settings.set("dsa5", "firstTimeStart", true)
        await game.settings.set("dsa5", "forceLanguage", lang)
        await game.settings.set("core", "language", lang)
        foundry.utils.debouncedReload()
    }

    static async setupDefaultOptions() {
        const settings = game.settings.get("core", Combat.CONFIG_SETTING)
        settings.skipDefeated = true
        await game.settings.set("core", Combat.CONFIG_SETTING, settings)
        await game.settings.set("core", "leftClickRelease", true)
    }
}