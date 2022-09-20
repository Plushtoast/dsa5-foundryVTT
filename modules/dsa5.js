import ActorSheetdsa5 from "./actor/actor-sheet.js";
import ActorSheetdsa5Character from "./actor/character-sheet.js";
import ActorSheetdsa5Creature from "./actor/creature-sheet.js";
import ActorSheetdsa5NPC from "./actor/npc-sheet.js";
import Actordsa5 from "./actor/actor-dsa5.js";
import Itemdsa5 from "./item/item-dsa5.js";
import ItemSheetdsa5 from "./item/item-sheet.js";
import initHooks from "./hooks/init.js";
import MacroDSA5 from "./system/macroControl.js";
import DSA5 from "./system/config-dsa5.js"
import DSA5ItemLibrary from "./system/itemlibrary.js"
import DSA5_Utility from "./system/utility-dsa5.js"
import DSA5Initializer from "./system/initializer.js"
import ChatMessageDSA5Roll from "./chat/ChatMessageDSA5.js";
import DSA5ChatListeners from "./system/chat_listeners.js";
import DSA5Payment from "./system/payment.js"
import { DSA5CombatTracker, DSA5Combat, DSA5Combatant } from "./hooks/combat_tracker.js";
import DSA5Hotbar from "./system/hotbar.js"
import RollMemory from "./system/roll_memory.js"
import SpecialabilityRulesDSA5 from "./system/specialability-rules-dsa5.js"
import AdvantageRulesDSA5 from "./system/advantage-rules-dsa5.js"
import Migrakel from "./system/migrakel.js"
import DSA5Dialog from "./dialog/dialog-dsa5.js"
import DPS from "./system/derepositioningsystem.js"
import DSATables from "./tables/dsatables.js"
import DiceDSA5 from "./system/dice-dsa5.js";
import DSA5StatusEffects from './status/status_effects.js'
import { MerchantSheetMixin } from './actor/merchantmixin.js'
import DSATour from './tours/dsa_tour.js'
import OpposeDSA from './system/opposed-dsa5.js'
import DSAActiveEffect from "./status/dsa_active_effects.js";
import EquipmentDamage from "./system/equipment-damage.js"
import DidYouKnow from "./system/didyouknow.js";
import MerchantSheetDSA5 from "./actor/merchant-sheet.js"
import { MeasuredTemplateDSA } from "./system/measuretemplate.js"
import RequestRoll from "./system/request-roll.js"

Hooks.once("init", () => {
    console.log("Initializing DSA5 system")

    CONFIG.statusEffects = DSA5.statusEffects
    game.dsa5 = {
        apps: {
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
            DSATables,
            RequestRoll,
            DiceDSA5,
            DSATour,
            OpposeDSA,
            EquipmentDamage,
            DidYouKnow, 
            MeasuredTemplateDSA
        },
        entities: {
            Actordsa5,
            Itemdsa5
        },
        sheets: {
            ActorSheetdsa5,
            ActorSheetdsa5Character,
            ActorSheetdsa5Creature,
            ActorSheetdsa5NPC,
            MerchantSheetMixin,
            MerchantSheetDSA5,
            ItemSheetdsa5,
        },
        macro: MacroDSA5,
        config: DSA5,
        memory: new RollMemory(),
        itemLibrary: new DSA5ItemLibrary()
    }

    CONFIG.Actor.documentClass = Actordsa5;
    CONFIG.Item.documentClass = Itemdsa5;
    CONFIG.ChatMessage.template = "systems/dsa5/templates/chat/chat-message.html"
    CONFIG.ChatMessage.documentClass = ChatMessageDSA5Roll
    CONFIG.ui.combat = DSA5CombatTracker
    CONFIG.ui.hotbar = DSA5Hotbar
    CONFIG.Combat.documentClass = DSA5Combat
    CONFIG.Combatant.documentClass = DSA5Combatant
    CONFIG.ActiveEffect.documentClass = DSAActiveEffect
});

initHooks();