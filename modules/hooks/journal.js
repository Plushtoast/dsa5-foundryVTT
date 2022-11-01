import DSA5StatusEffects from "../status/status_effects.js";
import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js";
import { bindImgToCanvasDragStart } from "./imgTileDrop.js";

export default function() {
    Hooks.on("renderJournalSheet", (obj, html, data) => {
        html.find(".close").attr("data-tooltip", game.i18n.localize("SHEET.Close"));
        html.find(".entry-image").attr("data-tooltip", game.i18n.localize("SHEET.imageView"));
        html.find(".entry-text").attr("data-tooltip", game.i18n.localize("SHEET.textView"));
        html.find(".share-image").attr("data-tooltip", game.i18n.localize("SHEET.showToPlayers"));
        html.find(".import").attr("data-tooltip", game.i18n.localize("SHEET.import"));
        html.find(".panMapNote").attr("data-tooltip", game.i18n.localize("SHEET.panMapNote"));
    })

    Hooks.on("renderJournalPageSheet", (obj, html, data) => {
        DSA5ChatAutoCompletion.bindRollCommands(html)
        DSA5StatusEffects.bindButtons(html)
        html.find('img').mousedown(ev => { if (ev.button == 2) game.dsa5.apps.DSA5_Utility.showArtwork({ name: obj.name, uuid: "", img: $(ev.currentTarget).attr("src") }) })
        bindImgToCanvasDragStart(html)
    })  

    Hooks.on("getJournalSheetHeaderButtons", (sheet, buttons) => {
        if (!sheet.document.sceneNote) return

        buttons.unshift({
            class: "panMapNote",
            icon: "fas fa-map-pin",
            onclick: async() => sheet.document.panToNote()
        })
    })
}