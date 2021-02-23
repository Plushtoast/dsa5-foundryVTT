export default function() {
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
    game.settings.register("dsa5", "statusEffectCounterColor", {
        name: "DSASETTINGS.statusEffectCounterColor",
        hint: "DSASETTINGS.statusEffectCounterColorHint",
        scope: "client",
        config: true,
        default: "#FFFFFF",
        type: String
    });
    game.settings.register("dsa5", "defaultDimVision", {
        name: "DSASETTINGS.defaultDimVision",
        hint: "DSASETTINGS.defaultDimVisionHint",
        scope: "world",
        config: true,
        default: 20,
        type: Number
    });
    game.settings.register("dsa5", "defaultBrightVision", {
        name: "DSASETTINGS.defaultBrightVision",
        hint: "DSASETTINGS.defaultBrightVisionHint",
        scope: "world",
        config: true,
        default: 10,
        type: Number
    });
    game.settings.register("dsa5", "migrationVersion", {
        name: "migrationVersion",
        hint: "migrationVersion",
        scope: "world",
        config: false,
        default: 2,
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

    game.settings.register("dsa5", "talentModifierEnabled", {
        name: "DSASETTINGS.talentModifierEnabled",
        hint: "DSASETTINGS.talentModifierEnabledHint",
        scope: "client",
        config: true,
        default: false,
        type: Boolean
    });

}