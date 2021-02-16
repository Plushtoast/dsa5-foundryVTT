import DSA5_Utility from "./utility-dsa5.js"

/*async function migrateDSA() {
    for (let a of game.actors.entities) {
        try {
            const updateData = migrateActorData(a.data);
            if (!isObjectEmpty(updateData)) {
                console.log(`Migrating Actor entity ${a.name}`);
                await a.update(updateData, { enforceTypes: false });
            }
        } catch (err) {
            err.message = `Failed migration for Actor ${a.name}: ${err.message}`;
            console.error(err);
        }
    }


    game.settings.set("dsa5", "migrationVersion", 2)
}*/



/*function migrateActorData(actor) {
    const updateData = {};

    // Migrate Owned Items
    if (!actor.items) return updateData;
    let hasItemUpdates = false;
    const items = actor.items.map(i => {
        if (!isObjectEmpty(itemUpdate)) {
            hasItemUpdates = true;
            return mergeObject(i, itemUpdate, { enforceTypes: false, inplace: false });
        } else return i;
    });
    if (hasItemUpdates) updateData.items = items;
    return updateData;
}*/

async function migrateDSA(currentVersion, migrationVersion) {
    await fetch("systems/dsa5/lazy/updatenotes.json").then(async r => r.json()).then(async json => {
        for (let i = currentVersion; i < migrationVersion; i++) {
            let msg = `<h1>Changes</h1>${json["notes"][i]}.<br>For details or proposals check out our wiki page at <a href="https://github.com/Plushtoast/dsa5-foundryVTT" target="_blank">Github</a>. Have fun.`
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg, "roll"))
        }
        game.settings.set("dsa5", "migrationVersion", migrationVersion)
    })
}

export default function migrateWorld() {
    Hooks.once("ready", async function() {
        if (!game.user.isGM) return

        const currentVersion = game.settings.get("dsa5", "migrationVersion")
        const NEEDS_MIGRATION_VERSION = 2
        const needsMigration = currentVersion < NEEDS_MIGRATION_VERSION

        if (!needsMigration) return;

        migrateDSA(currentVersion, NEEDS_MIGRATION_VERSION)
    })
};