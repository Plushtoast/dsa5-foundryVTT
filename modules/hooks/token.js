import DSA5 from "../system/config-dsa5.js"


export default function() {
    // Adds tooltips to conditions in the condition menu
    Hooks.on("renderTokenHUD", async(obj, html) => {
        var index = 0
        for (let condition of html.find("img.effect-control")) {
            condition.title = game.i18n.localize(DSA5.statusEffects[index])
            index += 1
        }
    })
}