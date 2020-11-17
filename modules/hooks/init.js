import * as initHandleBars from "./handlebars.js";

export default function() {
    Hooks.once("init", () => {
        loadTemplates([
            "systems/dsa5/templates/actors/actor-main.html",
            "systems/dsa5/templates/actors/actor-talents.html",
            "systems/dsa5/templates/items/item-description.html",
            "systems/dsa5/templates/dialog/dialog-constant.html",
            "systems/dsa5/templates/chat/roll/test-card.html",
            "systems/dsa5/templates/items/item-equipment.html",
            "systems/dsa5/templates/actors/actor-combat.html",
            "systems/dsa5/templates/actors/actor-equipment.html",
            "systems/dsa5/templates/actors/actor-notes.html",
            "systems/dsa5/templates/chat/post-item.html"
        ]);
    });
    initHandleBars.default();
}