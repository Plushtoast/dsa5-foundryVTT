import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import { showPatchViewer } from "../system/migrator.js"

export default function() {
    const redrawMasterMenu = () => {
        if (game.user.isGM) {
            game.dsa5.apps.gameMasterMenu.render()
        }
    }

    game.settings.register("dsa5", "meleeBotchTableEnabled", {
        name: "DSASETTINGS.meleeBotchTableEnabled",
        hint: "DSASETTINGS.meleeBotchTableEnabledHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "rangeBotchTableEnabled", {
        name: "DSASETTINGS.rangeBotchTableEnabled",
        hint: "DSASETTINGS.rangeBotchTableEnabledHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "defenseBotchTableEnabled", {
        name: "DSASETTINGS.defenseBotchTableEnabled",
        hint: "DSASETTINGS.defenseBotchTableEnabledHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "higherDefense", {
        name: "DSASETTINGS.higherDefense",
        hint: "DSASETTINGS.higherDefenseHint",
        scope: "world",
        config: true,
        default: "0",
        type: String,
        choices: {
            "0": "0",
            "2": "+2",
            "4": "+4",
        }
    });
    game.settings.register("dsa5", "informationDistribution", {
        name: "DSASETTINGS.informationDistribution",
        hint: "DSASETTINGS.informationDistributionHint",
        scope: "world",
        config: true,
        default: "0",
        type: String,
        choices: {
            0: game.i18n.localize('DSASETTINGS.information0'),
            1: game.i18n.localize('DSASETTINGS.information1'),
            2: game.i18n.localize('DSASETTINGS.information2')
        }
    });
    game.settings.register("dsa5", "enableItemDropToCanvas", {
        name: "DSASETTINGS.enableItemDropToCanvas",
        hint: "DSASETTINGS.enableItemDropToCanvasHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "statusEffectCounterColor", {
        name: "DSASETTINGS.statusEffectCounterColor",
        hint: "DSASETTINGS.statusEffectCounterColorHint",
        scope: "client",
        config: true,
        default: "#FFFFFF",
        type: String
    });

    game.settings.register("dsa5", "migrationVersion", {
        name: "migrationVersion",
        hint: "migrationVersion",
        scope: "world",
        config: false,
        default: 20,
        type: Number
    })
    game.settings.register("dsa5", "firstTimeStart", {
        name: "firstTimeStart",
        hint: "firstTimeStart",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    })
    game.settings.register("dsa5", "defaultConfigFinished", {
        name: "defaultConfigFinished",
        hint: "defaultConfigFinished",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    })
    game.settings.register("dsa5", "tokenizerSetup", {
        name: "tokenizerSetup",
        hint: "tokenizerSetup",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    })
    game.settings.register("dsa5", "diceSetup", {
        name: "diceSetup",
        hint: "diceSetup",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    })
    game.settings.register("dsa5", "capQSat", {
        name: "DSASETTINGS.capQSat",
        hint: "DSASETTINGS.capQSatHint",
        scope: "world",
        config: true,
        default: 6,
        type: Number
    });

    game.settings.register("dsa5", "hideEffects", {
        name: "DSASETTINGS.hideEffects",
        hint: "DSASETTINGS.hideEffectsHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "inventorySound", {
        name: "DSASETTINGS.inventorySound",
        hint: "DSASETTINGS.inventorySoundHint",
        scope: "client",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "talentModifierEnabled", {
        name: "DSASETTINGS.talentModifierEnabled",
        hint: "DSASETTINGS.talentModifierEnabledHint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "noConfirmationRoll", {
        name: "DSASETTINGS.noConfirmationRoll",
        hint: "DSASETTINGS.noConfirmationRollHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "lessRegeneration", {
        name: "DSASETTINGS.lessRegeneration",
        hint: "DSASETTINGS.lessRegenerationHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "limitCombatSpecAbs", {
        name: "DSASETTINGS.limitCombatSpecAbs",
        hint: "DSASETTINGS.limitCombatSpecAbsHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "allowPhysicalDice", {
        name: "DSASETTINGS.allowPhysicalDice",
        hint: "DSASETTINGS.allowPhysicalDiceHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "hideOpposedDamage", {
        name: "DSASETTINGS.hideOpposedDamage",
        hint: "DSASETTINGS.hideOpposedDamageHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "enableForeignSpellModifer", {
        name: "DSASETTINGS.enableForeignSpellModifer",
        hint: "DSASETTINGS.enableForeignSpellModiferHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "playerCanEditSpellMacro", {
        name: "DSASETTINGS.playerCanEditSpellMacro",
        hint: "DSASETTINGS.playerCanEditSpellMacroHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "enableDPS", {
        name: "DSASETTINGS.enableDPS",
        hint: "DSASETTINGS.enableDPSHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "iniTrackerSize", {
        name: "DSASETTINGS.iniTrackerSize",
        hint: "DSASETTINGS.iniTrackerSizeHint",
        scope: "client",
        config: true,
        default: 70,
        type: Number,
        range: {
            min: 30,
            max: 140,
            step: 5
        },
        onChange: async(val) => {
            game.dsa5.apps.tokenHotbar.constructor.defaultOptions.itemWidth = val
        }
    });


    game.settings.register("dsa5", "tokenhotbarSize", {
        name: "DSASETTINGS.tokenhotbarSize",
        hint: "DSASETTINGS.tokenhotbarSizeHint",
        scope: "client",
        config: true,
        default: 35,
        type: Number,
        range: {
            min: 15,
            max: 100,
            step: 5
        },
        onChange: async(val) => {
            game.dsa5.apps.tokenHotbar.constructor.defaultOptions.itemWidth = val
        }
    });

    game.settings.register("dsa5", "tokenhotbarLayout", {
        name: "DSASETTINGS.tokenhotbarLayout",
        hint: "DSASETTINGS.tokenhotbarLayoutHint",
        scope: "client",
        config: true,
        default: 0,
        type: Number,
        choices: {
            0: game.i18n.localize('DSASETTINGS.tokenhotbarLayout0'),
            2: game.i18n.localize('DSASETTINGS.tokenhotbarLayout1'),
            1: game.i18n.localize('DSASETTINGS.tokenhotbarLayout2'),
            3: game.i18n.localize('DSASETTINGS.tokenhotbarLayout3')
        }
    });

    game.settings.register("dsa5", "selfControlOnPain", {
        name: "DSASETTINGS.selfControlOnPain",
        hint: "DSASETTINGS.selfControlOnPainHint",
        scope: "world",
        config: true,
        default: 1,
        type: Number,
        choices: {
            0: game.i18n.localize('DSASETTINGS.selfControlOnPain0'),
            1: game.i18n.localize('DSASETTINGS.selfControlOnPain1'),
            2: game.i18n.localize('DSASETTINGS.selfControlOnPain2')
        }
    });

    game.settings.register("dsa5", "forceLanguage", {
        name: "DSASETTINGS.forceLanguage",
        hint: "DSASETTINGS.forceLanguageHint",
        scope: "world",
        config: true,
        default: "none",
        type: String,
        choices: {
            "none": "-",
            "de": "German",
            "en": "English"
        }
    });

    game.settings.register("dsa5", "tokenhotbarPosition", {
        name: "tokenhotbarPosition",
        scope: "client",
        config: false,
        default: {},
        type: Object
    });

    game.settings.register("dsa5", "iniTrackerPosition", {
        name: "iniTrackerPosition",
        scope: "client",
        config: false,
        default: {},
        type: Object
    });
    game.settings.register("dsa5", "soundConfig", {
        name: "DSASETTINGS.soundConfig",
        hint: "DSASETTINGS.soundConfigHint",
        scope: "world",
        config: true,
        default: "",
        type: String,
        onChange: async() => { DSA5SoundEffect.loadSoundConfig() }
    });

    game.settings.registerMenu("dsa5", "changelog", {
        name: "Changelog",
        label: "Changelog",
        hint: game.i18n.localize("DSASETTINGS.changelog"),
        type: ChangelogForm,
        restricted: false
    })

    game.settings.registerMenu("dsa5", "resetTokenbar", {
        name: game.i18n.localize("DSASETTINGS.resetTokenbar"),
        label: game.i18n.localize("DSASETTINGS.resetTokenbar"),
        hint: game.i18n.localize("DSASETTINGS.resetTokenbarHint"),
        type: ResetTokenbar,
        restricted: false
    })

    game.settings.register("dsa5", `breadcrumbs_${game.world.id}`, {
        name: "DSASETTINGS.breadcrumbs",
        hint: "DSASETTINGS.breadcrumbsHint",
        scope: "client",
        config: false,
        default: "",
        type: String
    });

    game.settings.register("dsa5", "groupschips", {
        name: "DSASETTINGS.groupschips",
        hint: "DSASETTINGS.groupschips",
        scope: "world",
        config: false,
        default: "0/0",
        type: String,
        onChange: async() => { redrawMasterMenu() }
    });

    game.settings.register("dsa5", "expandChatModifierlist", {
        name: "DSASETTINGS.expandChatModifierlist",
        hint: "DSASETTINGS.expandChatModifierlistHint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "indexWorldItems", {
        name: "DSASETTINGS.indexWorldItems",
        scope: "client",
        config: false,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "enableCombatFlow", {
        name: "DSASETTINGS.enableCombatFlow",
        hint: "DSASETTINGS.enableCombatFlowHint",
        scope: "client",
        config: true,
        default: true,
        type: Boolean,
        onchange: ev => {
            if (game.dsa5.apps.initTracker) {
                game.dsa5.apps.initTracker.close()
                game.dsa5.apps.initTracker = undefined
            }
        }
    });

    game.settings.register("dsa5", "enableCombatPan", {
        name: "DSASETTINGS.enableCombatPan",
        hint: "DSASETTINGS.enableCombatPanHint",
        scope: "client",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "sightAutomationEnabled", {
        name: "sightAutomationEnabled",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "disableDidYouKnow", {
        name: "DSASETTINGS.disableDidYouKnow",
        hint: "DSASETTINGS.disableDidYouKnowHint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "scrollingFontsize", {
        name: "DSASETTINGS.scrollingFontsize",
        hint: "DSASETTINGS.scrollingFontsizeHint",
        scope: "client",
        config: true,
        default: 16,
        type: Number,
        range: {
            min: 6,
            max: 50,
            step: 1
        }
    });

    game.settings.register("dsa5", "armorAndWeaponDamage", {
        name: "DSASETTINGS.armorAndWeaponDamage",
        hint: "DSASETTINGS.armorAndWeaponDamageHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "hideRegenerationToOwner", {
        name: "DSASETTINGS.hideRegenerationToOwner",
        hint: "DSASETTINGS.hideRegenerationToOwnerHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "indexDescription", {
        name: "DSASETTINGS.indexDescription",
        scope: "client",
        config: false,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "encumbranceForRange", {
        name: "DSASETTINGS.encumbranceForRange",
        hint: "DSASETTINGS.encumbranceForRangeHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "obfuscateTokenNames", {
        name: "DSASETTINGS.obfuscateTokenNames",
        hint: "DSASETTINGS.obfuscateTokenNamesHint",
        scope: "world",
        config: true,
        default: "0",
        type: String,
        choices: {
            "0": game.i18n.localize('no'),
            "1": game.i18n.localize('DSASETTINGS.yesNumbered'),
            "2": game.i18n.localize('DSASETTINGS.renameNumbered'),
            "3": game.i18n.localize('yes'),
            "4": game.i18n.localize('DSASETTINGS.rename')
        }
    });

    game.settings.register("dsa5", "merchantNotification", {
        name: "DSASETTINGS.merchantNotification",
        hint: "DSASETTINGS.merchantNotificationHint",
        scope: "world",
        config: true,
        default: "0",
        type: String,
        choices: {
            0: game.i18n.localize('no'),
            1: game.i18n.localize('yes'),
            2: game.i18n.localize('MERCHANT.onlyGM'),
        }
    });

    game.settings.register("dsa5", "sightOptions", {
        name: "sightOptions",
        scope: "world",
        config: false,
        default: "0.5|0.7|0.85|0.95",
        type: String
    });

    game.settings.register("dsa5", "trackedActors", {
        name: "sightOptions",
        scope: "world",
        config: false,
        default: {},
        type: Object
    });

    game.settings.register("dsa5", "expansionPermissions", {
        name: "expansionPermissions",
        scope: "world",
        config: false,
        default: {},
        type: Object
    });

}

class ChangelogForm extends FormApplication {
    render() {
        showPatchViewer()
    }
}

class ResetTokenbar extends FormApplication {
    async render() {
        await game.settings.set("dsa5", "tokenhotbarPosition", {})
        await game.settings.set("dsa5", "tokenhotbarLayout", 0)
        await game.settings.set("dsa5", "tokenhotbarSize", 35)
        game.dsa5.apps.tokenHotbar.resetPosition()
        game.dsa5.apps.tokenHotbar.render(true)
    }
}