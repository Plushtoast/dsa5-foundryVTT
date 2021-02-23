import ActorSheetdsa5Character from './character-sheet.js'

export default class ActorSheetdsa5NPC extends ActorSheetdsa5Character {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "actor", "npc-sheet"]),
            width: 770,
            height: 740,
        });
        return options;
    }

    get template() {
        if (!game.user.isGM && this.actor.limited) return "systems/dsa5/templates/actors/npc-limited.html";
        return "systems/dsa5/templates/actors/npc-sheet.html";

    }

    activateListeners(html) {
        super.activateListeners(html);
    }
}