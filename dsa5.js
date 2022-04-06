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
import ChatMessageDSA5Roll from "./modules/chat/ChatMessageDSA5.js";
import DSA5ChatListeners from "./modules/system/chat_listeners.js";
import DSA5Payment from "./modules/system/payment.js"
import { DSA5CombatTracker, DSA5Combat, DSA5Combatant } from "./modules/hooks/combat_tracker.js";
import DSA5Hotbar from "./modules/system/hotbar.js"
import RollMemory from "./modules/system/roll_memory.js"
import SpecialabilityRulesDSA5 from "./modules/system/specialability-rules-dsa5.js"
import AdvantageRulesDSA5 from "./modules/system/advantage-rules-dsa5.js"
import Migrakel from "./modules/system/migrakel.js"
import DSA5Dialog from "./modules/dialog/dialog-dsa5.js"
import DPS from "./modules/system/derepositioningsystem.js"
import DSATables from "./modules/tables/dsatables.js"
import DSA5StatusEffects from './modules/status/status_effects.js'

Hooks.once("init", () => {
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
            DSA5Initializer,
            DSA5ChatListeners,
            DSA5Payment,
            SpecialabilityRulesDSA5,
            AdvantageRulesDSA5,
            Migrakel,
            DSA5Dialog,
            DSA5StatusEffects,
            DPS,
            DSATables
        },
        entities: {
            Actordsa5,
            Itemdsa5
        },
        macro: MacroDSA5,
        config: DSA5,
        memory: new RollMemory(),
        itemLibrary: new DSA5ItemLibrary(),
        lazy: {
            LazyImporter
        }
    }

    CONFIG.Actor.documentClass = Actordsa5;
    CONFIG.Item.documentClass = Itemdsa5;
    CONFIG.ChatMessage.template = "systems/dsa5/templates/chat/chat-message.html"
    CONFIG.ChatMessage.documentClass = ChatMessageDSA5Roll
    CONFIG.ui.combat = DSA5CombatTracker
    CONFIG.ui.hotbar = DSA5Hotbar
    CONFIG.Combat.documentClass = DSA5Combat
    CONFIG.Combatant.documentClass = DSA5Combatant
});

initHooks();