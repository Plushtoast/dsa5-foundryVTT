async function migrateDSA() {
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
}

function migrateActorData(actor) {
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
}


export default function migrateWorld() {
    Hook.once("ready", function() {
        if (!game.user.isGM) return

        const currentVersion = game.settings.get("dsa5", "migrationVersion")
        const NEEDS_MIGRATION_VERSION = 1

        const needsMigration = currentVersion <= NEEDS_MIGRATION_VERSION
        if (!needsMigration) return;

        migrateDSA()

    })
};