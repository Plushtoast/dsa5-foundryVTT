export default function() {
    game.settings.register("dsa5", "meleeBotchTableEnabled", {
        name: "SETTINGS.meleeBotchTableEnabled",
        hint: "SETTINGS.meleeBotchTableEnabledHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "rangeBotchTableEnabled", {
        name: "SETTINGS.rangeBotchTableEnabled",
        hint: "SETTINGS.rangeBotchTableEnabledHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "defenseBotchTableEnabled", {
        name: "SETTINGS.defenseBotchTableEnabled",
        hint: "SETTINGS.defenseBotchTableEnabledHint",
        scope: "world",
        config: true,
        default: false,
        type: Boolean
    });
    game.settings.register("dsa5", "higherDefense", {
        name: "SETTINGS.higherDefense",
        hint: "SETTINGS.higherDefenseHint",
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
        name: "SETTINGS.statusEffectCounterColor",
        hint: "SETTINGS.statusEffectCounterColorHint",
        scope: "client",
        config: true,
        default: "#FFFFFF",
        type: String
    });
    game.settings.register("dsa5", "defaultDimVision", {
        name: "SETTINGS.defaultDimVision",
        hint: "SETTINGS.defaultDimVisionHint",
        scope: "world",
        config: true,
        default: 20,
        type: Number
    });
    game.settings.register("dsa5", "defaultBrightVision", {
        name: "SETTINGS.defaultBrightVision",
        hint: "SETTINGS.defaultBrightVisionHint",
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
        default: 1,
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
    game.settings.register("dsa5", "capQSat", {
        name: "SETTINGS.capQSat",
        hint: "SETTINGS.capQSatHint",
        scope: "world",
        config: true,
        default: 6,
        type: Number
    });
}