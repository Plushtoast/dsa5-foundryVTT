import ActorSheetdsa5 from "./modules/actor/actor-sheet.js"
import ActorSheetdsa5Character from "./modules/actor/character-sheet.js";
import ActorSheetdsa5Creature from "./modules/actor/creature-sheet.js";
import ActorSheetdsa5NPC from "./modules/actor/npc-sheet.js";
import Actordsa5 from "./modules/actor/actor-dsa5.js";
import Itemdsa5 from "./modules/item/item-dsa5.js";
import ItemSheetdsa5 from "./modules/item/item-sheet.js";
import ItemSpeciesDsa5 from "./modules/item/sheets/item-species-dsa5.js";
import ItemCareerDsa5 from "./modules/item/sheets/item-career-dsa5.js";
import ItemCultureDsa5 from "./modules/item/sheets/item-culture-dsa5.js"
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
import VantageSheetDSA5 from "./modules/item/sheets/item-vantage-dsa5.js"
import SpellSheetDSA5 from "./modules/item/sheets/item-spell-dsa5.js";
import SpecialAbilitySheetDSA5 from "./modules/item/sheets/item-specialability-dsa5.js";
import MeleeweaponSheetDSA5 from "./modules/item/sheets/item-meleeweapon-dsa5.js";
import DiseaseSheetDSA5 from "./modules/item/sheets/item-disease-sheet.js";
import PoisonSheetDSA5 from "./modules/item/sheets/item-poison-dsa5.js";

Hooks.once("init", async function() {
    console.log("Initializing DSA5 system")

    CONFIG.statusEffects = DSA5.statusEffects

    Actors.unregisterSheet("core", ActorSheet);
    Actors.registerSheet("dsa5", ActorSheetdsa5Character, { types: ["character"], makeDefault: true });
    Actors.registerSheet("dsa5", ActorSheetdsa5Creature, { types: ["creature"] });
    Actors.registerSheet("dsa5", ActorSheetdsa5NPC, { types: ["npc"] });
    Items.unregisterSheet("core", ItemSheet);
    Items.registerSheet("dsa5", ItemSheetdsa5, { makeDefault: true });
    Items.registerSheet("dsa5", ItemSpeciesDsa5, { makeDefault: true, types: ["species"] });
    Items.registerSheet("dsa5", ItemCareerDsa5, { makeDefault: true, types: ["career"] });
    Items.registerSheet("dsa5", ItemCultureDsa5, { makeDefault: true, types: ["culture"] });
    Items.registerSheet("dsa5", VantageSheetDSA5, { makeDefault: true, types: ["advantage", "disadvantage"] });
    Items.registerSheet("dsa5", SpellSheetDSA5, { makeDefault: true, types: ["ritual", "ceremony", "liturgy", "spell"] });
    Items.registerSheet("dsa5", SpecialAbilitySheetDSA5, { makeDefault: true, types: ["specialability"] });
    Items.registerSheet("dsa5", MeleeweaponSheetDSA5, { makeDefault: true, types: ["meleeweapon"] });
    Items.registerSheet("dsa5", PoisonSheetDSA5, { makeDefault: true, types: ["poison"] });
    Items.registerSheet("dsa5", DiseaseSheetDSA5, { makeDefault: true, types: ["disease"] });
    Items.unregisterSheet("dsa5", ItemSheetdsa5, { types: ["species", "career", "culture", "advantage", "specialability", "disadvantage", "ritual", "ceremony", "liturgy", "spell", "disease", "poison", "meleeweapon"] });

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