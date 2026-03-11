import AdvantageData from './item/advantage.js';
import AggregatedtestData from './item/aggregatedtest.js';
import AmmunitionData from './item/ammunition.js';
import ApplicationData from './item/application.js';
import ArmorData from './item/armor.js';
import BlessingData from './item/blessing.js';
import BookData from './item/book.js';
import CareerData from './item/career.js';
import CeremonyData from './item/ceremony.js';
import CombatskillData from './item/combatskill.js';
import ConsumableData from './item/consumable.js';
import CultureData from './item/culture.js';
import DemonmarkData from './item/demonmark.js';
import DisadvantageData from './item/disadvantage.js';
import DiseaseData from './item/disease.js';
import EffectwrapperData from './item/effectwrapper.js';
import EquipmentData from './item/equipment.js';
import EssenceData from './item/essence.js';
import ImprintData from './item/imprint.js';
import InformationData from './item/information.js';
import LiturgyData from './item/liturgy.js';
import MagicalsignData from './item/magicalsign.js';
import MagictrickData from './item/magictrick.js';
import MeleeweaponData from './item/meleeweapon.js';
import MoneyData from './item/money.js';
import PatronData from './item/patron.js';
import PlantData from './item/plant.js';
import PoisonData from './item/poison.js';
import RangeweaponData from './item/rangeweapon.js';
import RitualData from './item/ritual.js';
import SkillData from './item/skill.js';
import SpecialabilityData from './item/specialability.js';
import SpeciesData from './item/species.js';
import SpellData from './item/spell.js';
import SpellextensionData from './item/spellextension.js';
import TraitData from './item/trait.js';
import TrapData from './item/trap.js';
import CharacterData from './actor/character.js';
import CreatureData from './actor/creature.js';
import NPCData from './actor/npc.js';
import DSAStringField from './fields/dsa_string_field.js';
import { ItemDataModel } from './baseitem.js';
import { ActorDataModel } from './baseactor.js';
import { DSACombatDataModel } from './combat/dsacombat.js';
import { DSACombatantDataModel } from './combatant/dsacombatant.js';
import DSAActiveEffectDataModel from './activeeffect/dsaeffect.js';

export const itemModels = {
    advantage: AdvantageData,
    aggregatedTest: AggregatedtestData,
    ammunition: AmmunitionData,
    application: ApplicationData,
    armor: ArmorData,
    blessing: BlessingData,
    book: BookData,
    career: CareerData,
    ceremony: CeremonyData,
    combatskill: CombatskillData,
    consumable: ConsumableData,
    culture: CultureData,
    demonmark: DemonmarkData,
    disadvantage: DisadvantageData,
    disease: DiseaseData,
    effectwrapper: EffectwrapperData,
    equipment: EquipmentData,
    essence: EssenceData,
    imprint: ImprintData,
    information: InformationData,
    liturgy: LiturgyData,
    magicalsign: MagicalsignData,
    magictrick: MagictrickData,
    meleeweapon: MeleeweaponData,
    money: MoneyData,
    patron: PatronData,
    plant: PlantData,
    poison: PoisonData,
    rangeweapon: RangeweaponData,
    ritual: RitualData,
    skill: SkillData,
    specialability: SpecialabilityData,
    species: SpeciesData,
    spell: SpellData,
    spellextension: SpellextensionData,
    trait: TraitData,
    trap: TrapData,
    ItemDataModel
}

export const ActorDataModels = {
    character: CharacterData,
    creature: CreatureData,
    npc: NPCData,
    ActorDataModel
}

export const fields = {
    DSAStringField
}

export const CombatDataModels = {
    dsacombat: DSACombatDataModel
}

export const CombatantDataModels = {
    dsacombatant: DSACombatantDataModel
}

export const ActiveEffectDataModels = {
    base: DSAActiveEffectDataModel
}