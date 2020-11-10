import ActorSheetdsa5 from "./modules/actor/actor-sheet.js"
import ActorSheetdsa5Character from "./modules/actor/character-sheet.js";
import Actordsa5 from "./modules/actor/actor-dsa5.js";
import Itemdsa5 from "./modules/item/item-dsa5.js";
import ItemSheetdsa5 from "./modules/item/item-sheet.js";

import DSA5 from "./modules/system/config-dsa5.js"

Hooks.once("init", async function () {

    //Actors.unregisterSheet("core", ActorSheet);
    //Actors.registerSheet("dsa5", ActorSheetdsa5Character, { types: ["character"], makeDefault: true });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("dsa5", ItemSheetdsa5, { makeDefault: true });

    game.dsa5 = {
        apps : {
            ActorSheetdsa5,
            ActorSheetdsa5Character,
            ItemSheetdsa5
        },
        entities : {
            Actordsa5,
            Itemdsa5
        },
        config : DSA5
    }

    CONFIG.Actor.entityClass = Actordsa5;
    CONFIG.Item.entityClass = Itemdsa5;
});

//registerHooks()