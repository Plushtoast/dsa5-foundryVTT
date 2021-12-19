import { DSA5CombatTracker } from "./combat_tracker.js"

export default function() {
    game.keybindings.register("dsa5", "masterMenu", {
        name: "gmMenu",
        hint: game.i18n.localize("KEYBINDINGS.masterMenu"),
        editable: [{ key: "KeyM" }],
        onDown: () => game.dsa5.apps.gameMasterMenu.render(true),
        restricted: true
    })
    game.keybindings.register("dsa5", "journalBrowser", {
        name: "Book.Wizard",
        hint: game.i18n.localize("KEYBINDINGS.journalBrowser"),
        editable: [{ key: "KeyJ" }],
        onDown: () => game.dsa5.apps.journalBrowser.render(true)
    })
    game.keybindings.register("dsa5", "library", {
        name: "ItemLibrary",
        hint: game.i18n.localize("KEYBINDINGS.library"),
        editable: [{ key: "KeyL" }],
        onDown: () => game.dsa5.itemLibrary.render(true)
    })
    game.keybindings.register("dsa5", "attacktest", {
        name: "attacktest",
        hint: game.i18n.localize("KEYBINDINGS.attack"),
        editable: [{ key: "KeyB" }],
        onDown: () => DSA5CombatTracker.runActAttackDialog()
    })
}