export default function() {
    Hooks.on("renderSidebarTab", async(app, html) => {
        if (app.options.id == "settings") {
            let button = $(`<button><i class="fas fa-bug"></i> ${game.i18n.localize("DSA5Error")}</button>`)
            button.click(ev => { window.open("https://github.com/Plushtoast/dsa5-foundryVTT/issues", "_blank") })
            html.find("#settings-documentation").append(button)
        }
    })

    Hooks.on("renderCompendiumDirectory", (app, html, data) => {
        const button = $(`<button><i class="fas fa-university"></i>${game.i18n.localize("ItemLibrary")}</button>`);
        html.find(".header-actions").append(button);
        button.click(ev => { game.dsa5.itemLibrary.render(true) })
    })
}