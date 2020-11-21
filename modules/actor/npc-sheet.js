import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import ActorSheetDsa5 from "./actor-sheet.js";


export default class ActorSheetdsa5NPC extends ActorSheetDsa5 {
    static get defaultOptions() {
        const options = super.defaultOptions;
        mergeObject(options, {
            classes: options.classes.concat(["dsa5", "actor", "npc-sheet"]),
            width: 680,
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