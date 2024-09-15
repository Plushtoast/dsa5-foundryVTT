import DSA5 from "../system/config-dsa5.js";
import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import { showPatchViewer } from "../system/migrator.js"
const { duplicate, mergeObject } = foundry.utils

export function setupConfiguration() {
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
    game.settings.register("dsa5", "applyDamageInChat", {
        name: "DSASETTINGS.applyDamageInChat",
        hint: "DSASETTINGS.applyDamageInChatHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "notifyOnFadingEffects", {
        name: "DSASETTINGS.notifyOnFadingEffects",
        hint: "DSASETTINGS.notifyOnFadingEffectsHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });    
    game.settings.register("dsa5", "doubleDamageOptions", {
        name: "DSASETTINGS.doubleDamageOptions",
        hint: "DSASETTINGS.doubleDamageOptionsHint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean,
        requiresReload: true
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
            0: 'DSASETTINGS.information0',
            1: 'DSASETTINGS.information1',
            2: 'DSASETTINGS.information2'
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
        default: 29,
        type: Number
    })

    game.settings.register("dsa5", "journalFontSizeIndex", {
        name: "journalFontSizeIndex",
        hint: "journalFontSizeIndex",
        scope: "client",
        config: false,
        default: 5,
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
            if(game.dsa5.apps.initTracker) game.dsa5.apps.initTracker.constructor.defaultOptions.itemWidth = val
        }
    });

    game.settings.register("dsa5", "iniTrackerCount", {
        name: "DSASETTINGS.iniTrackerCount",
        hint: "DSASETTINGS.iniTrackerCountHint",
        scope: "client",
        config: true,
        default: 5,
        type: Number,
        range: {
            min: 3,
            max: 25,
            step: 1
        },
        onChange: async(val) => {
            if(game.dsa5.apps.initTracker) game.dsa5.apps.initTracker.constructor.defaultOptions.actorCount = val
        }
    });


    game.settings.register("dsa5", "tokenhotbarSize", {
        name: "DSASETTINGS.tokenhotbarSize",
        hint: "DSASETTINGS.tokenhotbarSizeHint",
        scope: "client",
        config: false,
        default: 35,
        type: Number,
        range: {
            min: 15,
            max: 100,
            step: 5
        },
        onChange: () => {
            game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar()       
        }
    });

    game.settings.register("dsa5", "tokenhotbarLayout", {
        name: "DSASETTINGS.tokenhotbarLayout",
        hint: "DSASETTINGS.tokenhotbarLayoutHint",
        scope: "client",
        config: false,
        default: 0,
        type: Number,
        choices: {
            0: 'DSASETTINGS.tokenhotbarLayout0',
            1: 'DSASETTINGS.tokenhotbarLayout1',
            2: 'DSASETTINGS.tokenhotbarLayout2',
            3: 'DSASETTINGS.tokenhotbarLayout3'
        },
        onChange: async(val) => {
            game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar()
        }
    });

    const moneyChoices = () => {
        const moneyChoices = {}
        for(let pack of game.packs){
            if(pack.metadata.type == "Item" && pack.index.some(x => x.type == "money"))
                moneyChoices[pack.metadata.id] = pack.metadata.id
        }
        return moneyChoices
    }

    game.settings.register("dsa5", "moneyKompendium", {
        name: "DSASETTINGS.moneyKompendium",
        hint: "DSASETTINGS.moneyKompendiumHint",
        scope: "world",
        config: true,
        default: "",
        type: new foundry.data.fields.StringField({choices: moneyChoices}),
        onChange: async(val) => {
            ui.notifications.info(game.packs.get(val).index.filter(x => x.type == "money").map(x => x.name).join(", "))
        }
    });
    
    game.settings.register("dsa5", "moneyHasWeight", {
        name: "DSASETTINGS.moneyHasWeight",
        hint: "DSASETTINGS.moneyHasWeightHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean,
        requiresReload: true
    });

    const styles = duplicate(DSA5.styles)
    for(let key of Object.keys(styles)){
        styles[key] = game.i18n.localize(styles[key])
    }
    game.settings.register("dsa5", "globalStyle", {
        name: "DSASETTINGS.globalStyle",
        hint: "DSASETTINGS.globalStyleHint",
        scope: "client",
        config: true,
        default: "dsa5-immersive",
        type: String,
        choices: styles,
        onChange: async(val) => {
            $('body').removeClass(Object.keys(styles).join(" ")).addClass(val)
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
            0: 'DSASETTINGS.selfControlOnPain0',
            1: 'DSASETTINGS.selfControlOnPain1',
            2: 'DSASETTINGS.selfControlOnPain2'
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

    game.settings.register("dsa5", "hotbarv3", {
        name: "DSASETTINGS.hotbarv3",
        hint: "DSASETTINGS.hotbarv3Hint",
        scope: "client",
        config: false,
        default: true,
        type: Boolean,
        onChange: () => {
            ui.hotbar.render(true)
        }
    });

    game.settings.register("dsa5", "libraryModulsFilter", {
        name: "libraryModulsFilter",
        scope: "client",
        config: false,
        default: {},
        type: Object
    });    

    game.settings.register("dsa5", "tokenhotbarPosition", {
        name: "tokenhotbarPosition",
        scope: "client",
        config: false,
        default: {},
        type: Object
    });

    game.settings.register("dsa5", "masterSettings", {
        name: "masterSettings",
        scope: "world",
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
        hint: "DSASETTINGS.changelog",
        type: ChangelogForm,
        restricted: false
    })

    game.settings.registerMenu("dsa5", "exportConfiguration", {
        name: "Export/Import Configuration",
        label: "Export/Import Configuration",
        hint: "DSASETTINGS.exportConfiguration",
        type: ExportForm,
        restricted: true
    })

    game.settings.registerMenu("dsa5", "configureTokenbar", {
        name: game.i18n.localize("DSASETTINGS.configureTokenbar"),
        label: game.i18n.localize("DSASETTINGS.configureTokenbar"),
        hint: "DSASETTINGS.configureTokenbarHint",
        type: ConfigureTokenHotbar,
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
        onChange: async() => {
            if (game.user.isGM) game.dsa5.apps.gameMasterMenu.render()
        }
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

    game.settings.register("dsa5", "filterDuplicateItems", {
        name: "DSASETTINGS.filterDuplicateItems",
        scope: "client",
        config: false,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "enableCombatFlow", {
        name: "DSASETTINGS.enableCombatFlow",
        hint: "DSASETTINGS.enableCombatFlowHint",
        scope: "client",
        config: true,
        default: true,
        type: Boolean,
        onchange: () => {
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

    game.settings.register("dsa5", "enableAPTracking", {
        name: "DSASETTINGS.enableAPTracking",
        hint: "DSASETTINGS.enableAPTrackingHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "sightAutomationEnabled", {
        name: "sightAutomationEnabled",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "lightSightCompensationEnabled", {
        name: "lightSightCompensationEnabled",
        scope: "world",
        config: false,
        default: false,
        type: Boolean
    });

    game.settings.register("dsa5", "randomWeaponSelection", {
        name: "DSASETTINGS.randomWeaponSelection",
        hint: "DSASETTINGS.randomWeaponSelectionHint",
        scope: "world",
        config: true,
        default: true,
        type: Boolean
    });

    game.settings.register("dsa5", "showWeaponsOnHover", {
        name: "DSASETTINGS.showWeaponsOnHover",
        hint: "DSASETTINGS.showWeaponsOnHoverHint",
        scope: "world",
        config: true,
        default: true,
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

    game.settings.register("dsa5", "disableTokenhotbar", {
        name: "DSASETTINGS.disableTokenhotbar",
        hint: "DSASETTINGS.disableTokenhotbarHint",
        scope: "client",
        config: false,
        default: true,
        type: Boolean,
        onChange: val => {
            if(val) game.dsa5.apps.tokenHotbar?.close()
            else game.dsa5.apps.tokenHotbar?.render(true)
        }
    });

    game.settings.register("dsa5", "disableTokenhotbarMaster", {
        name: "DSASETTINGS.disableTokenhotbarMaster",
        hint: "DSASETTINGS.disableTokenhotbarMasterHint",
        scope: "client",
        config: false,
        default: false,
        type: Boolean,
        onChange: () => { game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar() }
    });

    game.settings.register("dsa5", "masterCanvasControls", {
        name: "DSASETTINGS.masterCanvasControls",
        hint: "DSASETTINGS.masterCanvasControls",
        scope: "client",
        config: false,
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

    game.settings.register("dsa5", "tokenhotbaropacity", {
        name: "DSASETTINGS.tokenhotbaropacity",
        hint: "DSASETTINGS.tokenhotbaropacityHint",
        scope: "client",
        config: false,
        default: 0.75,
        type: Number,
        range: {
            min: 0,
            max: 1,
            step: 0.05
        },
        onChange: () => {
            game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar()       
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
            "0": 'no',
            "1": 'DSASETTINGS.yesNumbered',
            "2": 'DSASETTINGS.renameNumbered',
            "3": 'yes',
            "4": 'DSASETTINGS.rename'
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
            0: 'no',
            1: 'yes',
            2: 'MERCHANT.onlyGM'
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

    game.settings.register("dsa5", "enableMasterTokenFunctions", {
        name: "enableMasterTokenFunctions",
        scope: "world",
        config: false,
        default: {},
        type: Object,
        onChange: () => { game.dsa5.apps.tokenHotbar?.updateDSA5Hotbar() }
    });

    game.settings.register("dsa5", "selectedActors", {
        name: "selectedActors",
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


const exportSetting = (dlg) => {
    let toExport = Array.from(game.settings.settings)

    const exportOnlyDSA = dlg.find("[name=\"exportOnlyDSA\"]").is(":checked")

    if(exportOnlyDSA) toExport = toExport.filter(x => /^dsa5\./.test(x[0]))

    const exportData = {}
    const skipSettings = /(^dsa5\.(selectedActors|trackedActors|groupschips|tokenhotbarPosition|iniTrackerPosition|migrationVersion)$|^dsa5\.breadcrumbs_)/

    for(const key of toExport){
        if(skipSettings.test(key[0])) continue

        let keys = key[0].split(".")
        const scope = keys.shift()
        const setting = keys.join(".")

        exportData[key[0]] = game.settings.get(scope, setting)
    }
    const filename = `fvtt-DSA5-Configuration.json`

    saveDataToFile(JSON.stringify(exportData, null, 2), "text/json", filename)
}

const importSettings = async(dlg) => {
    const form = dlg.find("form")[0]
    if (!form.data.files.length)
            return ui.notifications?.error("You did not upload a data file!")

    readTextFromFile(form.data.files[0]).then(async (data) => {
        const json = JSON.parse(data)
        const availableKeys = Array.from(game.settings.settings).map(x => x[0])
        for(const key of Object.keys(json)){
            if(availableKeys.includes(key)){
                let keys = key.split(".")
                const scope = keys.shift()
                const setting = keys.join(".")
                await game.settings.set(scope, setting, json[key])
            }
        }
        game.settings.sheet.render(true)
    });
}

class ChangelogForm extends FormApplication {
    render() {
        showPatchViewer()
    }
}

class ExportForm extends FormApplication {
    async render(){
        const html = await renderTemplate('systems/dsa5/templates/dialog/exportConfiguration-dialog.html', {  })
        new Dialog({
            title: "Export configuration",
            content: html,
            buttons: {
                export: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("Export"),
                    callback: (dlg) => exportSetting(dlg)
                },
                import: {
                    icon: '<i class="fas fa-check"></i>',
                    label: game.i18n.localize("Import"),
                    callback: dlg => importSettings(dlg)
                }
            }
        }).render(true)
    }
}

class ConfigureTokenHotbar extends FormApplication {
    get template() {
        return "systems/dsa5/templates/dialog/configureTokenhotbar.html";
    }

    static get defaultOptions() {
        const options = super.defaultOptions
        mergeObject(options, {
            title: game.i18n.localize('DSASETTINGS.configureTokenbar'),
            width: 500
        });
        return options;
    }

    activateListeners(html){
        super.activateListeners(html)
        html.find('.resetTokenhotbar').click((ev) => this.resetTokenHotbar(ev))
        html.find('select, input').change(async(ev) => {
            const name = ev.currentTarget.name.split('.')
            let val = ev.currentTarget.dataset.dtype == "Number" ? Number(ev.currentTarget.value) : ev.currentTarget.value
            if(ev.currentTarget.type == "checkbox") val = ev.currentTarget.checked

            await game.settings.set(name[0], name[1], val)
            this.render()
        })
        html.find('.bags .slot').click(ev => this._onMasterFunctionClicked(ev))
    }

    async _onMasterFunctionClicked(ev) {
        const id = ev.currentTarget.dataset.id
        const setting = game.settings.get("dsa5", "enableMasterTokenFunctions")
        setting[id] = !setting[id]        
        $(ev.currentTarget).toggleClass("deactivated", setting[id])
        game.dsa5.apps.tokenHotbar.gmItems.find(x => x.id == id).disabled = setting[id]
        await game.settings.set("dsa5", "enableMasterTokenFunctions", setting)
    }

    async getData(options){
        const data = await super.getData(options)
        mergeObject(data, {
            tokenhotbarSize: game.settings.get("dsa5", "tokenhotbarSize"),
            tokenhotbarLayout: game.settings.get("dsa5", "tokenhotbarLayout"),
            disableTokenhotbarMaster: game.settings.get("dsa5", "disableTokenhotbarMaster"),
            disableTokenhotbar: game.settings.get("dsa5", "disableTokenhotbar"),
            tokenhotbaropacity: game.settings.get("dsa5", "tokenhotbaropacity"),
            masterCanvasControls: game.settings.get("dsa5", "masterCanvasControls"),
            hotbarv3: game.settings.get("dsa5", "hotbarv3"),
            isGM: game.user.isGM,
            gmButtons: game.dsa5.apps.tokenHotbar?.gmItems,
            layoutChoices: game.settings.settings.get("dsa5.tokenhotbarLayout").choices 
        })
        return data
    }

    async resetTokenHotbar(ev) {
        ev.preventDefault()
        ev.stopPropagation()
        await game.settings.set("dsa5", "tokenhotbarPosition", {})
        await game.settings.set("dsa5", "tokenhotbarLayout", 0)
        await game.settings.set("dsa5", "tokenhotbarSize", 35)
        game.dsa5.apps.tokenHotbar?.resetPosition()
        game.dsa5.apps.tokenHotbar?.render(true)
    }
}