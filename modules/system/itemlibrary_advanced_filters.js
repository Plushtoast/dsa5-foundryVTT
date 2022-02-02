import DSA5 from "./config-dsa5.js"
import DSA5_Utility from "./utility-dsa5.js"

let ADVANCEDFILTERS = {}

Hooks.once("ready", () => {

    Promise.all([DSA5_Utility.allSkillsList(), DSA5_Utility.allCombatSkills()]).then((result) => {
        const skills = result[0].reduce((prev, now) => ({...prev, [now]: now }), {})
        const range = result[1].filter(x => x.data.weapontype.value == "range").sort((a, b) => a.name.localeCompare(b.name)).reduce((prev, now) => ({...prev, [now.name]: now.name }), {})
        const melee = result[1].filter(x => x.data.weapontype.value == "melee").sort((a, b) => a.name.localeCompare(b.name)).reduce((prev, now) => ({...prev, [now.name]: now.name }), {})

        mergeObject(ADVANCEDFILTERS, {
            ammunition: [
                { label: "ammunitiongroup", attr: "ammunitiongroup.value", type: "select", options: DSA5.ammunitiongroups }
            ],
            equipment: [
                { label: "equipmentType", attr: "equipmentType.value", type: "select", options: DSA5.equipmentTypes }
            ],
            rangeweapon: [
                { label: "combatskill", attr: "combatskill.value", type: "select", options: range },
                { label: "ammunitiongroup", attr: "ammunitiongroup.value", type: "select", options: DSA5.ammunitiongroups }
            ],
            meleeweapon: [
                { label: "combatskill", attr: "combatskill.value", type: "select", options: melee },
                { label: "guidevalue", attr: "guidevalue.value", type: "select", options: DSA5.combatskillsGuidevalues },
                { label: "reach", attr: "reach.value", type: "select", options: DSA5.meleeRanges }
            ],
            poison: [
                { label: "resistanceModifier", attr: "resistance.value", type: "select", options: DSA5.magicResistanceModifiers },
            ],
            disease: [
                { label: "resistanceModifier", attr: "resistance.value", type: "select", options: DSA5.magicResistanceModifiers },
            ],
            consumable: [
                { label: "equipmentType", attr: "equipmentType.value", type: "select", options: DSA5.equipmentTypes }
            ],
            application: [
                { label: "skill", attr: "skill", type: "select", options: skills }
            ],
            trait: [
                { label: "traitType", attr: "traitType.value", type: "select", options: DSA5.traitCategories }
            ],
            career: [
                { label: "mageLevel", attr: "mageLevel.value", type: "select", options: DSA5.mageLevels }
            ],
            specialability: [
                { label: "Category", attr: "category.value", type: "select", options: DSA5.specialAbilityCategories }
            ],
            liturgy: [
                { label: "resistanceModifier", attr: "resistanceModifier.value", type: "select", options: DSA5.magicResistanceModifiers },
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "distribution", attr: "distribution.value", type: "text" }
            ],
            spell: [
                { label: "resistanceModifier", attr: "resistanceModifier.value", type: "select", options: DSA5.magicResistanceModifiers },
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "distribution", attr: "distribution.value", type: "text" },
                { label: "feature", attr: "feature", type: "text" }
            ],
            ritual: [
                { label: "resistanceModifier", attr: "resistanceModifier.value", type: "select", options: DSA5.magicResistanceModifiers },
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "distribution", attr: "distribution.value", type: "text" },
                { label: "feature", attr: "feature", type: "text" }
            ],
            ceremony: [
                { label: "resistanceModifier", attr: "resistanceModifier.value", type: "select", options: DSA5.magicResistanceModifiers },
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "distribution", attr: "distribution.value", type: "text" }

            ],
            spellextension: [
                { label: "Category", attr: "category", type: "select", options: { "spell": "spell", "liturgy": "liturgy", "ritual": "ritual", "ceremony": "ceremony" } }
            ],
            magictrick: [
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "feature", attr: "feature.value", type: "text" }
            ],
            blessing: [
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "feature", attr: "feature.value", type: "text" }
            ],
            npc: [
                { label: "species", attr: "details.species.value", type: "text" },
                { label: "career", attr: "details.career.value", type: "text" },
                { label: "culture", attr: "details.culture.value", type: "text" }
            ],
            character: [
                { label: "species", attr: "details.species.value", type: "text" },
                { label: "career", attr: "details.career.value", type: "text" },
                { label: "culture", attr: "details.culture.value", type: "text" }
            ],
            creature: [
                { label: "creatureClass", attr: "creatureClass.value", type: "text" },
                { label: "sizeCategory", attr: "status.size.value", type: "select", options: DSA5.sizeCategories }
            ],
            armor: [
                { label: "protection", attr: "protection.value", type: "select", options: { "0": "0", "1": "1", "2": "2", "3": "3", "4": "4", "5": "5", "6": "6", "7": "7" } },
                { label: "encumbrance", attr: "encumbrance.value", type: "select", options: { "0": "0", "1": "1", "2": "2", "3": "3", "4": "4" } }
            ],
            plant: [
                { label: "PLANT.landscape", attr: "location.landscape", type: "text" },
                { label: "PLANT.region", attr: "location.region", type: "text" },
            ],
            magicalsign: [],
            patron: [],
            demonmark: []
        })
    })
})

export default ADVANCEDFILTERS