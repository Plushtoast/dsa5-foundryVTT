export default function() {
    Hooks.on("renderSettings", (app, html, data) => {
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
    })

    Hooks.on("renderCompendiumDirectory", (app, html, data) => {
        const button = $(`<button id="openLibrary"><i class="fas fa-university"></i>${game.i18n.localize("ItemLibrary")}</button>`);
        const headerActions = html.find(".header-actions")
        headerActions.append(button);
        button.click(() => { game.dsa5.itemLibrary.render(true) })

        html.find('li[data-pack="dsa5.money"]').remove()
    })

    Hooks.once("renderCompendiumDirectory", (app, html, data) => {        
        const toRemove = game.i18n.lang == "de" ? "en" : "de"
        const packsToRemove = game.packs.filter(p => getProperty(p.metadata, "flags.dsalang") == toRemove)

        for (let pack of packsToRemove) {
            let name = `${pack.metadata.packageName}.${pack.metadata.name}`
            game.packs.delete(name)
            game.data.packs = game.data.packs.filter(x => x.id != name)
            html.find(`li[data-pack="${name}"]`).remove()
        }
    })

    Hooks.on("renderActorDirectory", (app, html, data) => {
        if (game.user.isGM) return

        for (let act of app.documents.filter(x => x.isMerchant() && getProperty(x, "system.merchant.hidePlayer"))) {
            html.find(`[data-document-id="${act.id}"]`).remove()
        }
    })
}