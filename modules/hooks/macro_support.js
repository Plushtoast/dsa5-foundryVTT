export default function() {

    Hooks.on("hotbarDrop", async(bar, data, slot) => {
        if (data.mod == "dodge") {
            let item = {
                name: game.i18n.localize(data.mod),
                img: "systems/dsa5/icons/categories/Dodge.webp"
            }
            let command
            if (game.user.isGM || data.actorId == undefined) {
                command = `game.dsa5.macro.charMacro("${data.mod}")`
            } else {
                command = `game.dsa5.macro.charMacroById("${data.mod}", "${data.actorId}")`
            }

            await createHotBarMacro(command, item.name, item.img, slot)
        } else if (data.mod == "attackWeaponless" || data.mod == "parryWeaponless") {
            let item = {
                name: game.i18n.localize(data.mod),
                img: "systems/dsa5/icons/categories/attack_weaponless.webp"
            }
            let command
            if (game.user.isGM || data.actorId == undefined) {
                command = `game.dsa5.macro.weaponLessMacro("${data.mod}")`
            } else {
                command = `game.dsa5.macro.weaponLessMacroId("${data.mod}", "${data.actorId}")`
            }

            await createHotBarMacro(command, item.name, item.img, slot)

        } else if (data.type == "Item") {
            let possibleItems = ["ritual", "ceremony", "meleeweapon", "rangeweapon", "skill", "combatskill", "spell", "liturgy", "char", "trait"]
            if (!possibleItems.includes(data.data.type))
                return

            if ((data.data.type == "meleeweapon" || data.data.type == "combatskill") && !['attack', 'parry'].includes(data.mod)) {
                return
            } else if ((data.data.type == "rangeweapon" || data.data.type == "trait") && !['attack'].includes(data.mod)) {
                return
            }
            let item = data.data
            let param = `{mod: "${data.mod}"}`
            let command
            if (game.user.isGM || data.actorId == undefined) {
                command = `game.dsa5.macro.itemMacro("${item.name}", "${item.type}", ${param});`;
            } else {
                command = `game.dsa5.macro.itemMacroById("${data.actorId}", "${item.name}", "${item.type}", ${param})`;
            }
            let name = data.mod == undefined ? item.name : `${item.name} - ${game.i18n.localize("CHAR." + data.mod.toUpperCase())}`
            await createHotBarMacro(command, name, item.img, slot)
        } else
        if (data.type == "Actor") {
            let actor = game.actors.get(data.id);
            let command = `game.actors.get("${data.id}").sheet.render(true)`

            await createHotBarMacro(command, actor.name, actor.data.img, slot)
        } else if (data.type == "JournalEntry") {
            let journal = game.journal.get(data.id);
            let command = `game.journal.get("${data.id}").sheet.render(true)`

            await createHotBarMacro(command, journal.name, item.img, slot)
        }
        return false;
    });
}

async function createHotBarMacro(command, name, img, slot) {
    let macro = game.macros.entities.find(m => (m.name === name) && (m.command === command));
    if (!macro) {
        macro = await Macro.create({
            name: name,
            type: "script",
            img: img,
            command: command
        }, { displaySheet: false })

    }
    game.user.assignHotbarMacro(macro, slot);
}