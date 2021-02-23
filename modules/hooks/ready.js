import RitualItemDSA5 from "../item/subclasses/ritual-item-dsa.js";
import SpellItemDSA5 from "../item/subclasses/spell-item-dsa.js";
import DiseaseItemDSA5 from "../item/subclasses/disease-item-dsa.js";
import DSA5Tutorial from "../system/tutorial.js";
import LiturgyItemDSA5 from "../item/subclasses/liturgy-item-dsa.js";
import CeremonyItemDSA5 from "../item/subclasses/ceremony-item-dsa.js";
import VantageItemDSA5 from "../item/subclasses/vantage-item-dsa.js";
import aggregatedTestItemDSA5 from "../item/subclasses/aggregatedTest-item-dsa.js";
import TraitItemDSA5 from "../item/subclasses/trait-item-dsa.js";
import BlessingItemDSA5 from "../item/subclasses/blessing-item-dsa.js";
import CantripItemDSA5 from "../item/subclasses/cantrip-item-dsa.js";
import SpecialAbilityItemDSA5 from "../item/subclasses/specialability-item-dsa.js";
import PoisonItemDSA5 from "../item/subclasses/poison-item-dsa.js";
import ArmorItemDSA5 from "../item/subclasses/armor-item-dsa.js";
import RangeweaponItemDSA5 from "../item/subclasses/rangeweapon-item.dsa.js";
import MeleeweaponDSA5 from "../item/subclasses/meleeweapon-item-dsa.js";
import AmmunitionItemDSA5 from "../item/subclasses/ammunition-item-dsa.js";
import EquipmentItemDSA5 from "../item/subclasses/equipment-item-dsa.js";
import CombatskillDSA5 from "../item/subclasses/combatskill-item-dsa.js";
import SkillItemDSA5 from "../item/subclasses/skill-item-dsa.js";
import ConsumableItemDSA from "../item/subclasses/consumable-item-dsa.js";
import SpellextensionItemDSA5 from "../item/subclasses/spellextension-item-dsa.js";
import SpeciesItemDSA5 from "../item/subclasses/species-item-dsa.js"

export default function() {
    Hooks.on("ready", async() => {
        game.socket.on("system.dsa5", data => {
            if (data.type == "target" && game.user.isGM) {
                let scene = game.scenes.get(data.payload.scene)
                let token = new Token(scene.getEmbeddedEntity("Token", data.payload.target))
                token.actor.update({
                    "flags.oppose": data.payload.opposeFlag
                })
            } else if (data.type == "updateMsg" && game.user.isGM) {
                game.messages.get(data.payload.id).update(data.payload.updateData)
            } else if (data.type == "deleteMsg" && game.user.isGM) {
                game.messages.get(data.payload.id).delete()
            } else if (game.user.isGM) {
                console.warn(`Unhandled socket data type ${data.type}`)
            }
        })



        if (game.modules.get("vtta-tokenizer") && game.modules.get("vtta-tokenizer").active && !game.settings.get("dsa5", "tokenizerSetup") && game.user.isGM) {
            game.settings.set("vtta-tokenizer", "default-frame-pc", "systems/dsa5/icons/backgrounds/token_green.webp")
            game.settings.set("vtta-tokenizer", "default-frame-npc", "systems/dsa5/icons/backgrounds/token_black.webp")
            game.settings.set("dsa5", "tokenizerSetup", true)
        }
        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active && !game.settings.get("dsa5", "diceSetup") && game.user.isGM) {
            game.settings.set("dice-so-nice", "immediatelyDisplayChatMessages", true)
            game.settings.set("dsa5", "diceSetup", true)
        }

        DSA5Tutorial.firstTimeMessage()

        game.dsa5.config.ItemSubclasses = {
            ritual: RitualItemDSA5,
            spell: SpellItemDSA5,
            liturgy: LiturgyItemDSA5,
            ceremony: CeremonyItemDSA5,
            advantage: VantageItemDSA5,
            disadvantage: VantageItemDSA5,
            aggregatedTest: aggregatedTestItemDSA5,
            trait: TraitItemDSA5,
            blessing: BlessingItemDSA5,
            magictrick: CantripItemDSA5,
            specialability: SpecialAbilityItemDSA5,
            disease: DiseaseItemDSA5,
            poison: PoisonItemDSA5,
            armor: ArmorItemDSA5,
            rangeweapon: RangeweaponItemDSA5,
            meleeweapon: MeleeweaponDSA5,
            ammunition: AmmunitionItemDSA5,
            equipment: EquipmentItemDSA5,
            combatskill: CombatskillDSA5,
            skill: SkillItemDSA5,
            consumable: ConsumableItemDSA,
            spellextension: SpellextensionItemDSA5,
            species: SpeciesItemDSA5
        }


    });
}