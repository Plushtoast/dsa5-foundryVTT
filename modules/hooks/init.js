import * as initHandleBars from "./handlebars.js";

export default function(){
    Hooks.once("init", () => {
        loadTemplates([
            "systems/dsa5/templates/actors/actor-main.html",
            "systems/dsa5/templates/actors/actor-talents.html",
            "systems/dsa5/templates/items/item-description.html"
          ]);
    });
    initHandleBars.default();
}