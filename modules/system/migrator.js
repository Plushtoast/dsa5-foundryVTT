import DSA5_Utility from "./utility-dsa5.js"

async function setupDefaulTokenConfig() {
    if (!game.settings.get("dsa5", "defaultConfigFinished")) {
        console.log("Configuring default token settings")
        let defaultToken = game.settings.get("core", "defaultToken")

        defaultToken.displayName = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
        defaultToken.displayBars = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
        defaultToken.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL
        defaultToken.bar1 = { attribute: "status.wounds" }
        defaultToken.brightSight = 10
        defaultToken.dimSight = 20
        await game.settings.set("core", "defaultToken", defaultToken)
        await game.settings.set("dsa5", "defaultConfigFinished", true)
    }
}

async function migrateDSA(currentVersion, migrationVersion) {
    await fetch("systems/dsa5/lazy/updatenotes.json").then(async r => r.json()).then(async json => {
        let version = json["notes"][json["notes"].length - 1]
        let msg = `<h1>CHANGELOG</h1><p>${json["default"].replace(/VERSION/g, version.version)}. </br><b>Important updates</b>: ${version.text}</p><p>For details or proposals visit our wiki page at <a href="https://github.com/Plushtoast/dsa5-foundryVTT/wiki" target="_blank">Github</a>. Have fun.</p>`
        await ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))

        await game.settings.set("dsa5", "migrationVersion", migrationVersion)
    })
}

export default function migrateWorld() {
    Hooks.once("ready", async function() {
        if (!game.user.isGM) return

        await setupDefaulTokenConfig()
        const currentVersion = await game.settings.get("dsa5", "migrationVersion")
        const NEEDS_MIGRATION_VERSION = 7
        const needsMigration = currentVersion < NEEDS_MIGRATION_VERSION

        if (!needsMigration) return;

        migrateDSA(currentVersion, NEEDS_MIGRATION_VERSION)
    })
};