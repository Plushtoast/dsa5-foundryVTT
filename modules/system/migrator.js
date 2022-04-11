import DSA5_Utility from "./utility-dsa5.js"

async function setupDefaulTokenConfig() {
    if (!game.settings.get("dsa5", "defaultConfigFinished")) {
        console.log("Configuring default token settings")
        let defaultToken = game.settings.get("core", "defaultToken")

        defaultToken.displayName = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
        defaultToken.displayBars = CONST.TOKEN_DISPLAY_MODES.OWNER_HOVER
        defaultToken.disposition = CONST.TOKEN_DISPOSITIONS.NEUTRAL
        defaultToken.bar1 = { attribute: "status.wounds" }
        await game.settings.set("core", "defaultToken", defaultToken)
        await game.settings.set("dsa5", "defaultConfigFinished", true)
    }
}

async function migrateDSA(currentVersion, migrationVersion) {
    await showPatchViewer()
    await game.settings.set("dsa5", "migrationVersion", migrationVersion)
}

export async function showPatchViewer() {
    await fetch("systems/dsa5/lazy/updatenotes.json").then(async r => r.json()).then(async json => {
        const patchViewer = new PatchViewer(json)
        patchViewer.render(true)
    })
}

export default function migrateWorld() {
    Hooks.once("ready", async function() {
        if (!game.user.isGM) return

        await setupDefaulTokenConfig()
        const currentVersion = await game.settings.get("dsa5", "migrationVersion")
        const NEEDS_MIGRATION_VERSION = 16
        const needsMigration = currentVersion < NEEDS_MIGRATION_VERSION

        if (!needsMigration) return;

        migrateDSA(currentVersion, NEEDS_MIGRATION_VERSION)
    })
};

class PatchViewer extends Application {
    constructor(json, app) {
        super(app)
        this.json = json
    }

    static get defaultOptions() {
        const options = super.defaultOptions;
        options.tabs = [{ navSelector: ".tabs", contentSelector: ".content", initial: "newcontent" }]
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "largeDialog", "patches"]),
            width: 740,
            height: 740,
            title: "Changelog"
        });
        options.template = 'systems/dsa5/templates/system/patchviewer.html'
        options.resizable = true
        return options;
    }
    async getData() {
        let version = this.json["notes"][this.json["notes"].length - 1]
        const patchName = this.json["default"].replace(/VERSION/g, version.version)
        let msg = `<h1>CHANGELOG</h1><p>${patchName}. </br><b>Important updates</b>: ${version.text}</p><p>For details or proposals visit our wiki page at <a href="https://github.com/Plushtoast/dsa5-foundryVTT/wiki" target="_blank">Github</a> or show the <a style="text-decoration: underline;color:#ff6400;" class="showPatchViewer">Full Changelog in Foundry</a>. Have fun.</p>`
        await ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))

        const lang = game.i18n.lang
        const changelog = await renderTemplate(`systems/dsa5/lazy/patchhtml/changelog_${lang}_${version.version}.html`)
        const news = await renderTemplate(`systems/dsa5/lazy/patchhtml/news_${lang}_${version.version}.html`)

        const prevVersions = [this.json["notes"][this.json["notes"].length - 2]]
        const prevChangeLogs = await Promise.all(prevVersions.map(async(x) => await renderTemplate(`systems/dsa5/lazy/patchhtml/changelog_${lang}_${x.version}.html`)))
        const prevNews = await Promise.all(prevVersions.map(async(x) => await renderTemplate(`systems/dsa5/lazy/patchhtml/news_${lang}_${x.version}.html`)))

        return {
            patchName,
            changelog,
            news,
            prevVersions,
            prevChangeLogs,
            prevNews
        }
    }
}