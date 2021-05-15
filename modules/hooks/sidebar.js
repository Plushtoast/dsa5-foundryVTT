export default function() {
    Hooks.on("renderSidebarTab", async(app, html) => {
        if (app.options.id == "settings") {
            let button = $(`<button><i class="fas fa-bug"></i> ${game.i18n.localize("DSA5Error")}</button>`)
            button.click(() => { window.open("https://github.com/Plushtoast/dsa5-foundryVTT/issues", "_blank") })
            html.find("#settings-documentation").append(button)

            button = $(`<button><i class="fas fa-shopping-cart"></i> F-Shop</button>`)
            button.click(() => { window.open(game.i18n.localize("fshopLink"), "_blank") })
            html.find("#settings-documentation").append(button)
        }
    })

    Hooks.on("renderCompendiumDirectory", (app, html, data) => {
        const button = $(`<button><i class="fas fa-university"></i>${game.i18n.localize("ItemLibrary")}</button>`);
        html.find(".header-actions").append(button);
        button.click(() => { game.dsa5.itemLibrary.render(true) })

        html.find('li[data-pack="dsa5.money"]').hide()
        const packs = game.packs.filter(p => p.metadata.langs && !(p.metadata.langs.includes(game.i18n.lang)))

        for (let pack of packs) {
            let name = `${pack.metadata.package}.${pack.metadata.name}`
            game.packs.delete(name)
            html.find(`li[data-pack="${name}"]`).hide()
        }
    })

    Hooks.on("renderActorDirectory", (app, html, data) => {
        if(!game.user.isGM){
            for (let act of app.entities.filter(x => x.isMerchant() && getProperty(x.data, "data.merchant.hidePlayer"))) {
                html.find(`[data-entity-id="${act._id}"]`).remove()
            }
        }
    })
}