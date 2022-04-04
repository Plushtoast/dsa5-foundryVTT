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
import * as initScene from './scene.js'
import * as initKeybindings from './keybindings.js'
import * as rollExtensions from './../system/dsarolls.js'

import ActorSheetdsa5Character from "./../actor/character-sheet.js";
import ActorSheetdsa5Creature from "./../actor/creature-sheet.js";
import ActorSheetdsa5NPC from "./../actor/npc-sheet.js";
import ItemSheetdsa5 from "./../item/item-sheet.js";
import MerchantSheetDSA5 from "../actor/merchant-sheet.js";
import BookWizard from "../wizards/adventure_wizard.js";
import MastersMenu from "../wizards/masters_menu.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DidYouKnow from "../system/didyouknow.js";
import DSAActiveEffectConfig from "../status/active_effects.js";
import TokenHotbar2 from "../system/tokenHotbar2.js";

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
    initScene.default()
    rollExtensions.default()
}

Hooks.once("init", () => {
    loadTemplates([
        "systems/dsa5/templates/actors/actor-main.html",
        "systems/dsa5/templates/actors/actor-talents.html",
        "systems/dsa5/templates/items/item-description.html",
        "systems/dsa5/templates/dialog/default-dialog.html",
        "systems/dsa5/templates/dialog/parts/targets.html",
        "systems/dsa5/templates/dialog/enhanced-default-dialog.html",
        "systems/dsa5/templates/dialog/default-combat-dialog.html",
        "systems/dsa5/templates/chat/roll/test-card.html",
        "systems/dsa5/templates/items/item-equipment.html",
        "systems/dsa5/templates/items/item-enchantment.html",
        "systems/dsa5/templates/actors/actor-combat.html",
        "systems/dsa5/templates/actors/actor-equipment.html",
        "systems/dsa5/templates/actors/actor-notes.html",
        "systems/dsa5/templates/chat/post-item.html",
        "systems/dsa5/templates/items/item-stat.html",
        "systems/dsa5/templates/items/item-extension.html",
        "systems/dsa5/templates/actors/creature/creature-main.html",
        "systems/dsa5/templates/actors/creature/creature-loot.html",
        "systems/dsa5/templates/actors/creature/creature-combat.html",
        "systems/dsa5/templates/actors/creature/creature-notes.html",
        "systems/dsa5/templates/actors/creature/creature-magic.html",
        "systems/dsa5/templates/actors/creature/creature-religion.html",
        "systems/dsa5/templates/actors/parts/characteristics-small.html",
        "systems/dsa5/templates/actors/parts/characteristics-large.html",
        "systems/dsa5/templates/actors/parts/magicalSigns.html",
        "systems/dsa5/templates/actors/parts/containerContent.html",
        "systems/dsa5/templates/actors/npc/npc-main.html",
        "systems/dsa5/templates/actors/character/actor-magic.html",
        "systems/dsa5/templates/actors/character/actor-religion.html",
        "systems/dsa5/templates/actors/character/actor-aggregatedtests.html",
        "systems/dsa5/templates/actors/parts/creature-derived-attributes-small.html",
        "systems/dsa5/templates/actors/parts/creature-derived-attributes-large.html",
        "systems/dsa5/templates/actors/parts/status_effects.html",
        "systems/dsa5/templates/actors/parts/purse.html",
        "systems/dsa5/templates/actors/parts/healthbar.html",
        "systems/dsa5/templates/actors/merchant/merchant-commerce.html",
        "systems/dsa5/templates/items/item-header.html",
        "systems/dsa5/templates/items/item-effects.html",
        "systems/dsa5/templates/status/advanced_functions.html"
    ]);

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dsa5", ActorSheetdsa5Character, { types: ["character"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5Creature, { types: ["creature"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5NPC, { types: ["npc"], makeDefault: true });
    Actors.registerSheet("dsa5", MerchantSheetDSA5, { types: ["npc"] });
    DocumentSheetConfig.registerSheet(ActiveEffect, "dsa5", DSAActiveEffectConfig, { makeDefault: true })

    ItemSheetdsa5.setupSheets()
    configuration.default()
})

Hooks.once('ready', () => {
    DidYouKnow.showOneMessage()
    TokenHotbar2.registerTokenHotbar()
})

Hooks.once('setup', () => {
    if (!["de", "en"].includes(game.i18n.lang)) {
        console.warn(`DSA5 - ${game.i18n.lang} is not a supported language. Falling back to default language.`)
        game.settings.set("core", "language", "de")
    }
    setupKnownEquipmentModifiers()

    BookWizard.initHook()

    initKeybindings.default()
    MastersMenu.registerButtons()

    CONFIG.Canvas.lightAnimations.daylight = {
        label: "LIGHT.daylight",
        illuminationShader: DaylightIlluminationShader
    }

    AdvantageRulesDSA5.setupFunctions()
    SpecialabilityRulesDSA5.setupFunctions()
})

function setupKnownEquipmentModifiers() {
    game.dsa5.config.knownShortcuts = {
        [game.i18n.localize('CHARAbbrev.INI').toLowerCase()]: ["status", "initiative", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.GS').toLowerCase()]: ["status", "speed", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.AsP').toLowerCase()]: ["status", "astralenergy", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.LeP').toLowerCase()]: ["status", "wounds", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.KaP').toLowerCase()]: ["status", "karmaenergy", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.AW').toLowerCase()]: ["status", "dodge", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.SK').toLowerCase()]: ["status", "soulpower", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.ZK').toLowerCase()]: ["status", "toughness", "gearmodifier"],
        [game.i18n.localize('CHARAbbrev.FtP').toLowerCase()]: ["status", "fatePoints", "gearmodifier"]
    }
    const attrs = ["MU", "KL", "IN", "CH", "FF", "GE", "KO", "KK"]
    for (const k of attrs) {
        game.dsa5.config.knownShortcuts[game.i18n.localize(`CHARAbbrev.${k}`).toLowerCase()] = ["characteristics", k.toLowerCase(), "gearmodifier"]
    }
}

class DaylightIlluminationShader extends AdaptiveIlluminationShader {
    static fragmentShader = `
    precision mediump float;
    uniform float time;
    uniform float intensity;
    uniform float alpha;
    uniform float ratio;
    uniform vec3 colorDim;
    uniform vec3 colorBright;
    varying vec2 vUvs;
    const float MU_TWOPI = 0.1591549431;

    void main() {
      float dist = distance(vUvs, vec2(0.5)) * 2.0;
      vec3 color = mix(colorDim, colorBright, smoothstep(clamp(0.8 - ratio, 0.0, 1.0), clamp(1.2 - ratio, 0.0, 1.0),1.0 - dist));
      vec3 fcolor = mix(color, max(color, smoothstep( 0.1, 1.0, color ) * 10.0), 1.0 - dist) * alpha;
      gl_FragColor = vec4(fcolor, 1.0);
    }`;
}