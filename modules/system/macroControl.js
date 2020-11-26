export default class MacroDSA5 {
    static itemMacro(itemName, itemType, bypassData) {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        let item = actor ? actor.items.find(i => i.name === itemName && i.type == itemType) : null;

        if (!item) return ui.notifications.warn(`${game.i18n.localize("Error.MacroItemMissing")} ${itemName}`);
        //item = item.data;

        switch (item.type) {
            case "meleeweapon":

                actor.setupWeapon(item, bypassData.mod, bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });

                return
            case "rangeweapon":
                actor.setupWeapon(item, "attack", bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });
                return
            case "skill":
                return actor.setupSkill(item.data, bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });
            case "combatskill":
                return actor.setupCombatskill(item, bypassData.mod, bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });

            case "spell":
            case "liturgy":
                return actor.setupSpell(item.data, bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });
        }
    }
}