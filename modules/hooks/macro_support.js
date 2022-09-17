export default function() {

    Hooks.on("hotbarDrop", (bar, data, slot) => {
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

            return createHotBarMacro(command, item.name, item.img, slot)
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

            return createHotBarMacro(command, item.name, item.img, slot)

        } else if (data.type == "Item") {
            const item = fromUuidSync(data.uuid)
            const possibleItems = ["ritual", "ceremony", "meleeweapon", "rangeweapon", "skill", "combatskill", "spell", "liturgy", "char", "trait"]
            if (!possibleItems.includes(item.type))
                return

            if ((item.type == "meleeweapon" || item.type == "combatskill") && !['attack', 'parry'].includes(data.mod)) {
                return
            } else if ((item.type == "rangeweapon" || item.type == "trait") && !['attack'].includes(data.mod)) {
                return
            }
            let param = `{mod: "${data.mod}"}`
            let command
            if (game.user.isGM || data.actorId == undefined) {
                command = `game.dsa5.macro.itemMacro("${item.name}", "${item.type}", ${param});`;
            } else {
                command = `game.dsa5.macro.itemMacroById("${data.actorId}", "${item.name}", "${item.type}", ${param})`;
            }
            let name = data.mod == undefined ? item.name : `${item.name} - ${game.i18n.localize("CHAR." + data.mod.toUpperCase())}`
            return createHotBarMacro(command, name, item.img, slot)
        } else if (data.type == "Actor" || data.type == "JournalEntry") {
            const elem = fromUuidSync(data.uuid)
            let command = `(await fromUuid('${data.uuid}')).sheet.render(true)`

            return createHotBarMacro(command, elem.name, elem.img, slot)
        }
    });
}

function createHotBarMacro(command, name, img, slot) {
    let macro = game.macros.contents.find(m => (m.name === name) && (m.command === command));
    if (!macro) {
        Macro.create({
            name,
            type: "script",
            img,
            command
        }, { displaySheet: false }).then(macro => game.user.assignHotbarMacro(macro, slot))
    }else{
        game.user.assignHotbarMacro(macro, slot);
    }
    return false
}
    