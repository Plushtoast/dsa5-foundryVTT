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
import * as journals from './journal.js'
import * as tokenHUD from './tokenHUD.js'
import * as migrateWorld from '../system/migrator.js'
import VantageSheetDSA5 from "./../item/sheets/item-vantage-dsa5.js"
import SpellSheetDSA5 from "./../item/sheets/item-spell-dsa5.js";
import SpecialAbilitySheetDSA5 from "./../item/sheets/item-specialability-dsa5.js";
import MeleeweaponSheetDSA5 from "./../item/sheets/item-meleeweapon-dsa5.js";
import DiseaseSheetDSA5 from "./../item/sheets/item-disease-sheet.js";
import PoisonSheetDSA5 from "./../item/sheets/item-poison-dsa5.js";
import ConsumableSheetDSA from "./../item/sheets/item-consumable-dsa5.js";
import ItemSpeciesDsa5 from "./../item/sheets/item-species-dsa5.js";
import ItemCareerDsa5 from "./../item/sheets/item-career-dsa5.js";
import ItemCultureDsa5 from "./../item/sheets/item-culture-dsa5.js"
import ActorSheetdsa5Character from "./../actor/character-sheet.js";
import ActorSheetdsa5Creature from "./../actor/creature-sheet.js";
import ActorSheetdsa5NPC from "./../actor/npc-sheet.js";
import ItemSheetdsa5 from "./../item/item-sheet.js";
import SpellExtensionSheetDSA5 from "./../item/sheets/item-spellextension-dsa5.js"

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
    journals.default()
    tokenHUD.default()
    migrateWorld.default()
}

Hooks.once("init", () => {
    loadTemplates([
        "systems/dsa5/templates/actors/actor-main.html",
        "systems/dsa5/templates/actors/actor-talents.html",
        "systems/dsa5/templates/items/item-description.html",
        "systems/dsa5/templates/dialog/default-dialog.html",
        "systems/dsa5/templates/dialog/enhanced-default-dialog.html",
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
        "systems/dsa5/templates/actors/parts/status_effects.html",
        "systems/dsa5/templates/actors/parts/purse.html",
        "systems/dsa5/templates/actors/parts/healthbar.html"
    ]);

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dsa5", ActorSheetdsa5Character, { types: ["character"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5Creature, { types: ["creature"] });
    Actors.registerSheet("dsa5", ActorSheetdsa5NPC, { types: ["npc"] });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("dsa5", ItemSheetdsa5, { makeDefault: true });
    Items.registerSheet("dsa5", ItemSpeciesDsa5, { makeDefault: true, types: ["species"] });
    Items.registerSheet("dsa5", ItemCareerDsa5, { makeDefault: true, types: ["career"] });
    Items.registerSheet("dsa5", ItemCultureDsa5, { makeDefault: true, types: ["culture"] });
    Items.registerSheet("dsa5", VantageSheetDSA5, { makeDefault: true, types: ["advantage", "disadvantage"] });
    Items.registerSheet("dsa5", SpellSheetDSA5, { makeDefault: true, types: ["ritual", "ceremony", "liturgy", "spell"] });
    Items.registerSheet("dsa5", SpecialAbilitySheetDSA5, { makeDefault: true, types: ["specialability"] });
    Items.registerSheet("dsa5", MeleeweaponSheetDSA5, { makeDefault: true, types: ["meleeweapon"] });
    Items.registerSheet("dsa5", PoisonSheetDSA5, { makeDefault: true, types: ["poison"] });
    Items.registerSheet("dsa5", DiseaseSheetDSA5, { makeDefault: true, types: ["disease"] });
    Items.registerSheet("dsa5", ConsumableSheetDSA, { makeDefault: true, types: ["consumable"] });
    Items.registerSheet("dsa5", SpellExtensionSheetDSA5, { makeDefault: true, types: ["spellextension"] });
    Items.unregisterSheet("dsa5", ItemSheetdsa5, { types: ["spellextension", "consumable", "species", "career", "culture", "advantage", "specialability", "disadvantage", "ritual", "ceremony", "liturgy", "spell", "disease", "poison", "meleeweapon"] });

    configuration.default()
});

Hooks.once('setup', function() {
    if (!["de", "en"].includes(game.i18n.lang)) {
        console.warn(`DSA5 - ${game.i18n.lang} is not a supported language. Falling back to default language.`)
        game.settings.set("core", "language", "de")
    }
    setupKnownEquipmentModifiers()
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
    game.dsa5.config.knownShortcuts[game.i18n.localize('CHARAbbrev.FtP').toLowerCase()] = ["status", "fatePoints", "gearmodifier"]
    let attrs = ["MU", "KL", "IN", "CH", "FF", "GE", "KO", "KK"]
    for (let k of attrs) {
        game.dsa5.config.knownShortcuts[game.i18n.localize(`CHARAbbrev.${k}`).toLowerCase()] = ["characteristics", k.toLowerCase(), "value"]
    }
}