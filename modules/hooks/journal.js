import DSA5StatusEffects from "../status/status_effects.js";
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js";
import DSA5ChatListeners from "../system/chat_listeners.js";
import DSA5_Utility from "../system/utility-dsa5.js";
import { bindImgToCanvasDragStart } from "./imgTileDrop.js";

export default function() {
    Hooks.on("renderJournalSheet", (obj, html, data) => {
        html.find(".close").attr("data-tooltip", game.i18n.localize("SHEET.Close"));
        html.find(".entry-image").attr("data-tooltip", game.i18n.localize("SHEET.imageView"));
        html.find(".entry-text").attr("data-tooltip", game.i18n.localize("SHEET.textView"));
        html.find(".share-image").attr("data-tooltip", game.i18n.localize("SHEET.showToPlayers"));
        html.find(".import").attr("data-tooltip", game.i18n.localize("SHEET.import"));
        html.find(".panMapNote").attr("data-tooltip", game.i18n.localize("SHEET.panMapNote"));

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
}