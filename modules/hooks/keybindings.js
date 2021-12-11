import { DSA5CombatTracker } from "./combat_tracker.js"

export default function () {
  game.keybindings.register("dsa5", "masterMenu", {
    name: "gmMenu",
    hint: game.i18n.localize("KEYBINDINGS.masterMenu"),
    editable: [{key: "m"}],
    onDown: () => game.dsa5.apps.gameMasterMenu.render(true),
    restricted: true
  })
  game.keybindings.register("dsa5", "journalBrowser", {
    name: "Book.Wizard",
    hint: game.i18n.localize("KEYBINDINGS.journalBrowser"),
    editable: [{key: "j"}],
    onDown: () => game.dsa5.apps.journalBrowser.render(true)
  })
  game.keybindings.register("dsa5", "library", {
    name: "ItemLibrary",
    hint: game.i18n.localize("KEYBINDINGS.library"),
    editable: [{key: "l"}],
    onDown: () => game.dsa5.itemLibrary.render(true)
  })
  game.keybindings.register("dsa5", "attacktest", {
    name: "attacktest",
    hint: game.i18n.localize("KEYBINDINGS.attack"),
    editable: [{key: "b"}],
    onDown: () => DSA5CombatTracker.runActAttackDialog()
  })
}