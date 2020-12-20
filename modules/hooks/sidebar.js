export default function() {
    Hooks.on("renderSidebarTab", async(app, html) => {
        if (app.options.id == "settings") {
            let button = $(`<button><i class="fas fa-bug"></i> ${game.i18n.localize("DSA5Error")}</button>`)
            button.click(ev => { window.open("https://github.com/Plushtoast/dsa5-foundryVTT/issues", "_blank") })
            html.find("#settings-documentation").append(button)
        }
    })
}