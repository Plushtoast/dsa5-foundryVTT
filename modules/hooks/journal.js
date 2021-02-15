import DSA5ChatAutoCompletion from "../system/chat_autocompletion.js";


export default function() {
    Hooks.on("renderJournalSheet", (obj, html, data) => {

        $(html).find(".close").attr("title", game.i18n.localize("SHEET.Close"));
        $(html).find(".entry-image").attr("title", game.i18n.localize("SHEET.imageView"));
        $(html).find(".entry-text").attr("title", game.i18n.localize("SHEET.textView"));
        $(html).find(".share-image").attr("title", game.i18n.localize("SHEET.showToPlayers"));

        html.on('click', '.request-roll', ev => {
            DSA5ChatAutoCompletion.showRQMessage($(ev.currentTarget).attr("data-name"), Number($(ev.currentTarget).attr("data-modifier")) || 0)
        })
    })
}