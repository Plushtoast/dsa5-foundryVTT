import * as initHandleBars from "./handlebars.js";
import * as initDiceSoNice from "./dicesonice.js";
import * as initActorHooks from "./actor.js";
import * as macroSupport from "./macro_support.js";
import * as chatlogHooks from './chatlog.js'
import * as ready from './ready.js'
import * as token from './token.js'
import * as chatContext from './chat_context.js'

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
            "systems/dsa5/templates/chat/post-item.html",
            "systems/dsa5/templates/items/item-stat.html",
            "systems/dsa5/templates/actors/creature/creature-main.html",
            "systems/dsa5/templates/actors/creature/creature-loot.html",
            "systems/dsa5/templates/actors/creature/creature-combat.html",
            "systems/dsa5/templates/actors/creature/creature-notes.html",
            "systems/dsa5/templates/actors/parts/characteristics-small.html",
            "systems/dsa5/templates/actors/npc/npc-main.html",
            "systems/dsa5/templates/actors/character/actor-magic.html",
            "systems/dsa5/templates/actors/character/actor-religion.html"
        ]);
    });
    initHandleBars.default();
    initDiceSoNice.default();
    initActorHooks.default();
    macroSupport.default();
    chatlogHooks.default()
    ready.default()
    token.default()
    chatContext.default()
}