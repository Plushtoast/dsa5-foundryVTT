import * as initHandleBars from "./handlebars.js";
import * as initDiceSoNice from "./dicesonice.js";
import * as initActorHooks from "./actor.js";
import * as macroSupport from "./macro_support.js";
import * as chatlogHooks from './chatlog.js'
import * as ready from './ready.js'
import * as chatContext from './chat_context.js'
import * as statusEffects from './statuseffect.js'
import * as sideBar from './sidebar.js'
import * as configuration from './configuration.js'

export default function() {

    initHandleBars.default();
    initDiceSoNice.default();
    initActorHooks.default();
    macroSupport.default();
    chatlogHooks.default()
    ready.default()
    chatContext.default()
    statusEffects.default()
    sideBar.default()

}

Hooks.once("init", () => {
    loadTemplates([
        "systems/dsa5/templates/actors/actor-main.html",
        "systems/dsa5/templates/actors/actor-talents.html",
        "systems/dsa5/templates/items/item-description.html",
        "systems/dsa5/templates/dialog/dialog-constant.html",
        "systems/dsa5/templates/chat/roll/test-card.html",
        "systems/dsa5/templates/items/item-equipment.html",
        "systems/dsa5/templates/actors/actor-combat.html",
        "systems/dsa5/templates/actors/actor-equipment.html",
        "systems/dsa5/templates/actors/actor-notes.html",
        "systems/dsa5/templates/chat/post-item.html",
        "systems/dsa5/templates/items/item-stat.html",
        "systems/dsa5/templates/actors/creature/creature-main.html",
        "systems/dsa5/templates/actors/creature/creature-loot.html",
        "systems/dsa5/templates/actors/creature/creature-combat.html",
        "systems/dsa5/templates/actors/creature/creature-notes.html",
        "systems/dsa5/templates/actors/creature/creature-magic.html",
        "systems/dsa5/templates/actors/creature/creature-religion.html",
        "systems/dsa5/templates/actors/parts/characteristics-small.html",
        "systems/dsa5/templates/actors/parts/characteristics-large.html",
        "systems/dsa5/templates/actors/npc/npc-main.html",
        "systems/dsa5/templates/actors/character/actor-magic.html",
        "systems/dsa5/templates/actors/character/actor-religion.html",
        "systems/dsa5/templates/actors/character/actor-aggregatedtests.html",
        "systems/dsa5/templates/actors/parts/creature-derived-attributes-small.html",
        "systems/dsa5/templates/actors/parts/creature-derived-attributes-large.html",
        "systems/dsa5/templates/actors/parts/status_effects.html"
    ]);

    configuration.default()
});

Hooks.once('setup', function() {
    if (!["de"].includes(game.i18n.lang)) {
        console.warn(`DSA5 - ${game.i18n.lang} is not a supported language. Falling back to default language.`)
        game.i18n.setLanguage("de").then(() => {
            //This is unfortunately a litte to late for items to be initialized properly
            setupKnownEquipmentModifiers()
        })
    } else {
        setupKnownEquipmentModifiers()
    }
})

function setupKnownEquipmentModifiers() {
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.INI').toLowerCase()] = ["status", "initiative", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.GS').toLowerCase()] = ["status", "speed", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.AsP').toLowerCase()] = ["status", "astralenergy", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.LeP').toLowerCase()] = ["status", "wounds", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.KaP').toLowerCase()] = ["status", "karmaenergy", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.AW').toLowerCase()] = ["status", "dodge", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.SK').toLowerCase()] = ["status", "soulpower", "gearmodifier"]
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.ZK').toLowerCase()] = ["status", "toughness", "gearmodifier"]
    let attrs = ["MU", "KL", "IN", "CH", "FF", "GE", "KO", "KK"]
    for (let k of attrs) {
        game.dsa5.config.knownShortcuts[game.i18n.localize(`CHARAbbrev.${k}`).toLowerCase()] = ["characteristics", k.toLowerCase(), "value"]
    }
}