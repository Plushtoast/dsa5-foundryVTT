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
import DSAActiveEffectConfig from "../status/active_effects.js";
import CreatureMerchantSheetDSA5 from "../actor/creature-merchant-sheet.js";
import CharacterMerchantSheetDSA5 from "../actor/character-merchant-sheet.js";
import DPS from "../system/derepositioningsystem.js";
import { SelectUserDialog } from "../dialog/addTargetDialog.js";
import DSAJournalSheet from "../journal/dsa_journal_sheet.js";
import DSA5 from "../system/config-dsa5.js";


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
        "systems/dsa5/templates/dialog/parts/spellmodifiers.html",
        "systems/dsa5/templates/dialog/parts/canChangeCastingTime.html",
        "systems/dsa5/templates/actors/parts/schipspart.html",
        "systems/dsa5/templates/chat/post-item.html",
        "systems/dsa5/templates/items/item-stat.html",
        "systems/dsa5/templates/items/item-extension.html",
        "systems/dsa5/templates/actors/creature/creature-main.html",
        "systems/dsa5/templates/actors/creature/creature-loot.html",
        "systems/dsa5/templates/actors/creature/creature-notes.html",
        "systems/dsa5/templates/actors/creature/creature-magic.html",
        "systems/dsa5/templates/actors/creature/creature-religion.html",
        "systems/dsa5/templates/actors/parts/characteristics-large.html",
        "systems/dsa5/templates/actors/parts/gearSearch.html",
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
        "systems/dsa5/templates/actors/parts/horse.html",
        "systems/dsa5/templates/actors/parts/healthbar.html",
        "systems/dsa5/templates/actors/merchant/merchant-commerce.html",
        "systems/dsa5/templates/items/item-header.html",
        "systems/dsa5/templates/items/item-effects.html",
        "systems/dsa5/templates/items/item-aoe.html",
        "systems/dsa5/templates/items/traditionArtifact.html",
        "systems/dsa5/templates/status/advanced_functions.html",
        "systems/dsa5/templates/actors/parts/information.html",
        "systems/dsa5/templates/actors/parts/combatskills.html",
        "systems/dsa5/templates/actors/parts/attributes.html",
        "systems/dsa5/templates/actors/parts/carryandpurse.html",
        "systems/dsa5/templates/actors/parts/specialabilities.html",
        "systems/dsa5/templates/actors/parts/experienceBox.html",
        "systems/dsa5/templates/actors/parts/spells.html",
        "systems/dsa5/templates/dialog/parts/expChoices.html",
        "systems/dsa5/templates/actors/parts/liturgies.html",
        "systems/dsa5/templates/items/browse/culture.html",
        "systems/dsa5/templates/items/browse/species.html",
        "systems/dsa5/templates/items/browse/career.html"
    ]);

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dsa5", ActorSheetdsa5Character, { types: ["character"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5Creature, { types: ["creature"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5NPC, { types: ["npc"], makeDefault: true });
    Actors.registerSheet("dsa5", MerchantSheetDSA5, { types: ["npc"] });
    Actors.registerSheet("dsa5", CreatureMerchantSheetDSA5, { types: ["creature"] })
    Actors.registerSheet("dsa5", CharacterMerchantSheetDSA5, { types: ["character"] })
    DocumentSheetConfig.registerSheet(ActiveEffect, "dsa5", DSAActiveEffectConfig, { makeDefault: true })
    Journal.registerSheet("dsa5", DSAJournalSheet, {makeDefault: true})

    ItemSheetdsa5.setupSheets()

    Hooks.call('registerDSAstyle', DSA5.styles)

    configuration.default()
    DPS.initDoorMinDistance()
    mergeObject(CONFIG.JournalEntry.noteIcons, DSA5.noteIcons)

    $('body').addClass(game.settings.get("dsa5", "globalStyle"))
})

Hooks.once('setup', () => {
    if (!["de", "en"].includes(game.i18n.lang)) {
        console.warn(`DSA5 - ${game.i18n.lang} is not a supported language. Falling back to default language.`)
        showForbiddenLanguageDialog()
    } else {
        const forceLanguage = game.settings.get("dsa5", "forceLanguage")
        if (["de", "en"].includes(forceLanguage) && game.i18n.lang != forceLanguage) showWrongLanguageDialog(forceLanguage)
    }
    
    BookWizard.initHook()

    initKeybindings.default()
    MastersMenu.registerButtons()
    SelectUserDialog.registerButtons()

    CONFIG.Canvas.lightAnimations.daylight = {
        label: "LIGHT.daylight",
        illuminationShader: DaylightIlluminationShader
    }

    AdvantageRulesDSA5.setupFunctions()
    SpecialabilityRulesDSA5.setupFunctions()
})

Hooks.once("i18nInit", () => {
    setupKnownEquipmentModifiers()
})

class ForbiddenLanguageDialog extends Dialog{
    async close(options = {}){
        if(!["de", "en"].includes(game.i18n.lang)) return

        return super.close(options)
    }
}

const showForbiddenLanguageDialog = () => {
    let data = {
        title: game.i18n.localize("language"),
        content: `<p>Your foundry language is not supported by this system. Due to technical reasons your foundry language setting has to be switched to either english or german.</p>`,
        buttons: {
            de: {
                icon: '<i class="fa fa-check"></i>',
                label: "en",
                callback: async() => { 
                    await game.settings.set("core", "language", "de") 
                    foundry.utils.debouncedReload()
                }
            },
            en: {
                icon: '<i class="fas fa-check"></i>',
                label: "de",
                callback: async() => { 
                    await game.settings.set("core", "language", "en") 
                    foundry.utils.debouncedReload()
                }
            },
            logout: {
                icon: '<i class="fas fa-door-closed"></i>',
                label: game.i18n.localize('SETTINGS.Logout'),
                callback: async() => { 
                    ui.menu.items.logout.onClick()
                }
            }            
        }
    }

    new ForbiddenLanguageDialog(data).render(true)
}

const showWrongLanguageDialog = (forceLanguage) => {
    let data = {
        title: game.i18n.localize("DSASETTINGS.forceLanguage"),
        content: game.i18n.format("DSAError.wrongLanguage", { lang: forceLanguage }),
        buttons: {
            ok: {
                icon: '<i class="fa fa-check"></i>',
                label: game.i18n.localize("ok"),
                callback: async() => { 
                    await game.settings.set("core", "language", forceLanguage) 
                    foundry.utils.debouncedReload()
                }
            },
            cancel: {
                icon: '<i class="fas fa-times"></i>',
                label: game.i18n.localize("cancel"),

            }
        }
    }
    new Dialog(data).render(true)
}

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
    for (const k of Object.keys(DSA5.characteristics)) {
        game.dsa5.config.knownShortcuts[game.i18n.localize(`CHARAbbrev.${k.toUpperCase()}`).toLowerCase()] = ["characteristics", k.toLowerCase(), "gearmodifier"]
    }
}

class DaylightIlluminationShader extends AdaptiveIlluminationShader {
    static fragmentShader =  `
    ${this.SHADER_HEADER}
    ${this.PERCEIVED_BRIGHTNESS}

    void main() {
        ${this.FRAGMENT_BEGIN}
        ${this.TRANSITION}
       
        // Darkness
        framebufferColor = max(framebufferColor, colorBackground);        
        // Elevation
        finalColor = mix(finalColor, max(finalColor, smoothstep( 0.1, 1.0, finalColor ) * 10.0), 1.0) * depth;        
        // Final
        gl_FragColor = vec4(finalColor, 1.0);
      }`;
}