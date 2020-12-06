import ActorSheetdsa5 from "./modules/actor/actor-sheet.js"
import ActorSheetdsa5Character from "./modules/actor/character-sheet.js";
import ActorSheetdsa5Creature from "./modules/actor/creature-sheet.js";
import ActorSheetdsa5NPC from "./modules/actor/npc-sheet.js";
import Actordsa5 from "./modules/actor/actor-dsa5.js";
import Itemdsa5 from "./modules/item/item-dsa5.js";
import ItemSheetdsa5 from "./modules/item/item-sheet.js";
import registerHooks from "./modules/system/hooks.js";
import MacroDSA5 from "./modules/system/macroControl.js";
import LazyImporter from "./modules/importer/lazy_importer.js"
import DSA5 from "./modules/system/config-dsa5.js"


Hooks.once("init", async function() {

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dsa5", ActorSheetdsa5Character, { types: ["character"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5Creature, { types: ["creature"] });
    Actors.registerSheet("dsa5", ActorSheetdsa5NPC, { types: ["npc"] });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("dsa5", ItemSheetdsa5, { makeDefault: true });

    game.dsa5 = {
        apps: {
            ActorSheetdsa5,
            ActorSheetdsa5Character,
            ActorSheetdsa5Creature,
            ActorSheetdsa5NPC,
            ItemSheetdsa5
        },
        entities: {
            Actordsa5,
            Itemdsa5
        },
        macro: MacroDSA5,
        config: DSA5,
        lazy: {
            LazyImporter
        }
    }

    CONFIG.Actor.entityClass = Actordsa5;
    CONFIG.Item.entityClass = Itemdsa5;
    CONFIG.ChatMessage.template = "systems/dsa5/templates/chat/chat-message.html"
});

registerHooks();