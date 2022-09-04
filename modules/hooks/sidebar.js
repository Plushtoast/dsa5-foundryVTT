export default function() {
    Hooks.on("renderSidebarTab", (app, html) => {
        if (app.options.id == "settings") {
            let button = $(`<button id="reportADSABug"><i class="fas fa-bug"></i> ${game.i18n.localize("DSA5Error")}</button>`)
            button.click(() => { window.open("https://github.com/Plushtoast/dsa5-foundryVTT/issues", "_blank") })
            html.find("#settings-documentation").append(button)

            button = $(`<button><i class="fas fa-info-circle"></i> ${game.i18n.localize("DSA5Wiki")}</button>`)
            button.click(() => { window.open("https://github.com/Plushtoast/dsa5-foundryVTT/wiki", "_blank") })
            html.find("#settings-documentation").append(button)

            button = $(`<button class="fshopButton"><div></div> F-Shop</button>`)
            button.click(() => { window.open(game.i18n.localize("fshopLink"), "_blank") })
            html.find("#settings-documentation").append(button)

            const systemName = game.system.title.split("/")[game.i18n.lang == "de" ? 0 : 1]
            const version = html.find('#game-details .system span').html()
            html.find('#game-details .system').html(`${systemName}<span>${version}</span>`)
        }
    })

    Hooks.on("renderCompendiumDirectory", (app, html, data) => {
        const button = $(`<button id="openLibrary"><i class="fas fa-university"></i>${game.i18n.localize("ItemLibrary")}</button>`);
        html.find(".header-actions").append(button);
        button.click(() => { game.dsa5.itemLibrary.render(true) })

        html.find('li[data-pack="dsa5.money"]').hide()
        
        const toRemove = game.i18n.lang == "de" ? "en" : "de"
        const packs = game.packs.filter(p => getProperty(p.metadata, "flags.dsalang") == toRemove)

        for (let pack of packs) {
            let name = `${pack.metadata.packageName}.${pack.metadata.name}`
            game.packs.delete(name)
            html.find(`li[data-pack="${name}"]`).hide()
        }
    })

    Hooks.on("renderActorDirectory", (app, html, data) => {
        if (!game.user.isGM) {
            for (let act of app.documents.filter(x => x.isMerchant() && getProperty(x, "merchant.hidePlayer"))) {
                html.find(`[data-document-id="${act.id}"]`).remove()
            }
        }
    })
}