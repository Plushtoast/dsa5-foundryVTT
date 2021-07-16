import DSA5 from "./config-dsa5.js"
import DSA5_Utility from "./utility-dsa5.js"

let ADVANCEDFILTERS = {}

Hooks.once("ready", () => {

    Promise.all([DSA5_Utility.allSkillsList(), DSA5_Utility.allCombatSkills()]).then((result) => {
        let skills = {}
        let cskills = {}
        for (let sk of result[0]) { skills[sk] = sk }
        for (let sk of result[1]) { cskills[sk.name] = sk.name }

        mergeObject(ADVANCEDFILTERS, {
            ammunition: [
                { label: "ammunitiongroup", attr: "ammunitiongroup.value", type: "select", options: DSA5.ammunitiongroups }
            ],
            equipment: [
                { label: "equipmentType", attr: "equipmentType.value", type: "select", options: DSA5.equipmentTypes }
            ],
            rangeweapon: [
                { label: "combatskill", attr: "combatskill.value", type: "select", options: cskills },
                { label: "ammunitiongroup", attr: "ammunitiongroup.value", type: "select", options: DSA5.ammunitiongroups }
            ],
            meleeweapon: [
                { label: "combatskill", attr: "combatskill.value", type: "select", options: cskills },
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
                { label: "feature", attr: "feature.value", type: "text" }
            ],
            ritual: [
                { label: "resistanceModifier", attr: "resistanceModifier.value", type: "select", options: DSA5.magicResistanceModifiers },
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "distribution", attr: "distribution.value", type: "text" },
                { label: "feature", attr: "feature.value", type: "text" }
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
            ]


        })
    })


})

export default ADVANCEDFILTERS