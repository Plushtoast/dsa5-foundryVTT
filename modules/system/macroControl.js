import DSA5ChatListeners from "./chat_listeners.js";
import RequestRoll from "./request-roll.js";

export default class MacroDSA5 {
    static weaponLessMacro(char) {
        const speaker = ChatMessage.getSpeaker();
        let actor;
        if (speaker.token) actor = game.actors.tokens[speaker.token];
        if (!actor) actor = game.actors.get(speaker.actor);

        this.runWeaponless(actor, char, speaker.token)
    }

    static weaponLessMacroId(char, actorId) {
        let actor = game.actors.get(actorId)
        this.runWeaponless(actor, char)
    }

    static requestRoll(skill, modifier = 0) {
        RequestRoll.showRQMessage(skill, modifier)
    }

    static requestGC(skill, modifier = 0, options = {}) {
        RequestRoll.showGCMessage(skill, modifier, options)
    }

    static rollCh(skill, options = {}) {
        DSA5ChatListeners.check3D20(undefined, skill, options)
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
        this.runItem(actor, item, itemName, bypassData, speaker.token)
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

        this.runChar(actor, char, speaker.token)
    }

    static runWeaponless(actor, char, tokenId) {
        if (!actor) return ui.notifications.error(game.i18n.format("DSAError.MacroItemMissing", { item: char }));
        let characteristic = char.split("Weaponless")[0]
        actor.setupWeaponless(characteristic, {}, tokenId).then(setupData => {
            actor.basicTest(setupData)
        });
    }

    static runChar(actor, char, tokenId) {
        if (!actor) return ui.notifications.error(game.i18n.format("DSAError.MacroItemMissing", { item: char }));

        actor.setupDodge({}, tokenId).then(setupData => {
            actor.basicTest(setupData)
        });
    }

    static runItem(actor, item, itemName, bypassData, tokenId) {
        if (!actor) return ui.notifications.error(game.i18n.format("DSAError.MacroItemMissing", { item: itemName }));

        switch (item.type) {
            case "combatskill":
            case "trait":
            case "meleeweapon":
                return actor.setupWeapon(item, bypassData.mod, bypassData, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            case "rangeweapon":
                return actor.setupWeapon(item, "attack", bypassData, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            case "skill":
                return actor.setupSkill(item.data, bypassData, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
            case "ceremony":
            case "ritual":
            case "spell":
            case "liturgy":
                return actor.setupSpell(item.data, bypassData, tokenId).then(setupData => {
                    actor.basicTest(setupData)
                });
        }
    }
}