import DSA5StatusEffects from "../status/status_effects.js";
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js";
import DSA5ChatListeners from "../system/chat_listeners.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { bindImgToCanvasDragStart } from "./imgTileDrop.js";

export default function() {
    Hooks.on("renderJournalSheet", (obj, html, data) => {
        html.find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        html.find(".entry-image").attr("title", game.i18n.localize("SHEET.imageView"));
        html.find(".entry-text").attr("title", game.i18n.localize("SHEET.textView"));
        html.find(".share-image").attr("title", game.i18n.localize("SHEET.showToPlayers"));
        html.find(".import").attr("title", game.i18n.localize("SHEET.import"));
        html.find(".panMapNote").attr("title", game.i18n.localize("SHEET.panMapNote"));

        DSA5ChatAutoCompletion.bindRollCommands(html)

        DSA5StatusEffects.bindButtons(html)
        html.on('click', '.chat-condition', ev => {
            DSA5ChatListeners.postStatus($(ev.currentTarget).attr("data-id"))
        })
        html.on('mousedown', "img", ev => {
            if (ev.button == 2) game.dsa5.apps.DSA5_Utility.showArtwork({ name: obj.name, uuid: "", img: $(ev.currentTarget).attr("src") })
        })
        bindImgToCanvasDragStart(html)
    })

    Hooks.on("getJournalSheetHeaderButtons", (sheet, buttons) => {
        if (sheet.document.sceneNote)
            buttons.unshift({
                class: "panMapNote",
                icon: "fas fa-map-pin",
                onclick: async() => sheet.document.panToNote()
            })
    })

    TextEditor._enrichHTML = TextEditor.enrichHTML
    TextEditor.enrichHTML = function(content, { secrets = false, documents = true, links = true, rolls = true, rollData = null } = {}) {
        let result = TextEditor._enrichHTML(content, { secrets, documents, links, rolls, rollData })
        return DSA5_Utility.customEntityLinks(DSA5_Utility.replaceConditions(result))
    }
}