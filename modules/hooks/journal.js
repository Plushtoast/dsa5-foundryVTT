import DSA5StatusEffects from "../status/status_effects.js";
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js";
import DSA5ChatListeners from "../system/chat_listeners.js";
import DSA5_Utility from "../system/utility-dsa5.js";


export default function() {
    Hooks.on("renderJournalSheet", (obj, html, data) => {

        $(html).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(html).find(".entry-image").attr("title", game.i18n.localize("SHEET.imageView"));
        $(html).find(".entry-text").attr("title", game.i18n.localize("SHEET.textView"));
        $(html).find(".share-image").attr("title", game.i18n.localize("SHEET.showToPlayers"));
        $(html).find(".import").attr("title", game.i18n.localize("SHEET.import"));

        DSA5ChatAutoCompletion.bindRollCommands(html)

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })
        html.on('mousedown', "img", ev => {
            let name = obj.name
            if (ev.button == 2) game.dsa5.apps.DSA5_Utility.showArtwork({ name: name, uuid: "", img: $(ev.currentTarget).attr("src") })
            return false
        })
    })

    TextEditor._enrichHTML = TextEditor.enrichHTML
    TextEditor.enrichHTML = function(content, { secrets = false, entities = true, links = true, rolls = true, rollData = null } = {}) {
        let result = TextEditor._enrichHTML(content, { secrets, entities, links, rolls, rollData })
        return DSA5_Utility.customEntityLinks(DSA5_Utility.replaceConditions(result))
    }
}