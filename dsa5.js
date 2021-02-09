import ActorSheetdsa5 from "./modules/actor/actor-sheet.js"
import ActorSheetdsa5Character from "./modules/actor/character-sheet.js";
import ActorSheetdsa5Creature from "./modules/actor/creature-sheet.js";
import ActorSheetdsa5NPC from "./modules/actor/npc-sheet.js";
import Actordsa5 from "./modules/actor/actor-dsa5.js";
import Itemdsa5 from "./modules/item/item-dsa5.js";
import ItemSheetdsa5 from "./modules/item/item-sheet.js";
import initHooks from "./modules/hooks/init.js";
import MacroDSA5 from "./modules/system/macroControl.js";
import LazyImporter from "./modules/importer/lazy_importer.js"
import DSA5 from "./modules/system/config-dsa5.js"
import DSA5ItemLibrary from "./modules/system/itemlibrary.js"
import DSA5_Utility from "./modules/system/utility-dsa5.js"
import DSA5Initializer from "./modules/system/initializer.js"
import AdvantageRulesDSA5 from "./modules/system/advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "./modules/system/specialability-rules-dsa5.js"
import ChatMessageDSA5Roll from "./modules/chat/ChatMessageDSA5.js";


Hooks.once("init", async function() {
    console.log("Initializing DSA5 system")

    CONFIG.statusEffects = DSA5.statusEffects
    game.dsa5 = {
        apps: {
            ActorSheetdsa5,
            ActorSheetdsa5Character,
            ActorSheetdsa5Creature,
            ActorSheetdsa5NPC,
            ItemSheetdsa5,
            DSA5_Utility,
            DSA5Initializer
        },
        entities: {
            Actordsa5,
            Itemdsa5
        },
        macro: MacroDSA5,
        config: DSA5,
        itemLibrary: new DSA5ItemLibrary(),
        lazy: {
            LazyImporter
        }
    }

    CONFIG.Actor.entityClass = Actordsa5;
    CONFIG.Item.entityClass = Itemdsa5;
    CONFIG.ChatMessage.template = "systems/dsa5/templates/chat/chat-message.html"
    CONFIG.ChatMessage.entityClass = ChatMessageDSA5Roll
});
Hooks.once("setup", async function() {
    AdvantageRulesDSA5.setupFunctions()
    SpecialabilityRulesDSA5.setupFunctions()
})
initHooks();