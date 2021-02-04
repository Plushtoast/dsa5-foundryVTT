export default class MacroDSA5 {

    static weaponLessMacro(char) {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        this.runWeaponless(actor, char)
    }

    static weaponLessMacroId(char, actorId) {
        let actor = game.actors.get(actorId)
        this.runWeaponless(actor, char)
    }

    static itemMacroById(actorId, itemName, itemType, bypassData) {
        let actor = game.actors.get(actorId)
        let item = actor ? actor.items.find(i => i.name === itemName && i.type == itemType) : null;
        this.runItem(actor, item, itemName, bypassData)
    }

    static itemMacro(itemName, itemType, bypassData) {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        let item = actor ? actor.items.find(i => i.name === itemName && i.type == itemType) : null;
        this.runItem(actor, item, itemName, bypassData)
    }

    static charMacroById(char, actorId) {
        let actor = game.actors.get(actorId)
        this.runChar(actor, char)
    }

    static charMacro(char) {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        this.runChar(actor, char)
    }

    static runWeaponless(actor, char) {
        if (!actor) return ui.notifications.error(game.i18n.format("DSAError.MacroItemMissing", { item: char }));
        let characteristic = char.split("Weaponless")[0]
        actor.setupWeaponless(characteristic, event).then(setupData => {
            actor.basicTest(setupData)
        });
    }

    static runChar(actor, char) {
        if (!actor) return ui.notifications.error(game.i18n.format("DSAError.MacroItemMissing", { item: char }));

        actor.setupStatus(char).then(setupData => {
            actor.basicTest(setupData)
        });
    }

    static runItem(actor, item, itemName, bypassData) {
        if (!actor) return ui.notifications.error(game.i18n.format("DSAError.MacroItemMissing", { item: itemName }));
        //item = item.data;

        switch (item.type) {
            case "trait":
                actor.setupWeaponTrait(item, bypassData.mod, bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });
                return
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
            case "ceremony":
            case "ritual":
            case "spell":
            case "liturgy":
                return actor.setupSpell(item.data, bypassData).then(setupData => {
                    actor.basicTest(setupData)
                });
        }
    }
}