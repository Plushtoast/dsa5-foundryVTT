import DSA5 from "./config-dsa5.js"
import DSA5_Utility from "./utility-dsa5.js"
import { mergeObject } from "./foundry.js"

let ADVANCEDFILTERS = {}

Hooks.once("ready", () => {

    Promise.all([DSA5_Utility.allSkillsList(), DSA5_Utility.allCombatSkills()]).then((result) => {
        const skills = result[0].reduce((prev, now) => ({...prev, [now]: now }), {})
        const range = result[1].filter(x => x.system.weapontype.value == "range").sort((a, b) => a.name.localeCompare(b.name)).reduce((prev, now) => ({...prev, [now.name]: now.name }), {})
        const melee = result[1].filter(x => x.system.weapontype.value == "melee").sort((a, b) => a.name.localeCompare(b.name)).reduce((prev, now) => ({...prev, [now.name]: now.name }), {})
        const allCombat = result[1].concat([{name: game.i18n.localize("LocalizedIDs.all")}]).sort((a, b) => a.name.localeCompare(b.name)).reduce((prev, now) => ({...prev, [now.name]: now.name }), {})

        const content =  []
        for(const [cat, value] of Object.entries(DSA5.specialAbilityCategories)){
            if(cat == "clerical")
                content.push(`</optgroup><optgroup label="${game.i18n.localize('SpecCategory.clerical')}">`)
            else if(cat == "magical")
                content.push(`</optgroup><optgroup label="${game.i18n.localize('SpecCategory.magical')}">`)

            content.push(`<option value="${cat}">${game.i18n.localize(value)}</option>`)
        }

        const specialabilies =
        `<div class="form-group">
            <label class="label-text">${game.i18n.localize('Category')}</label>
            <select name="category.value" data-dtype="String">
                <option value="">${game.i18n.localize('Library.noFilter')}</option>
                <optgroup label="${game.i18n.localize('SpecCategory.general')}">
                ${content.join("")}
                </optgroup>
            </select>
        </div>`

        const filters = {
            ammunition: [
                { label: "ammunitiongroup", attr: "ammunitiongroup.value", type: "select", options: DSA5.ammunitiongroups }
            ],
            equipment: [
                { label: "equipmentType", attr: "equipmentType.value", type: "select", options: DSA5.equipmentTypes },
                { label: "PLANT.region", attr: "region", type: "text" },
            ],
            rangeweapon: [
                { label: "TYPES.Item.combatskill", attr: "combatskill.value", type: "select", options: range },
                { label: "ammunitiongroup", attr: "ammunitiongroup.value", type: "select", options: DSA5.ammunitiongroups }
            ],
            meleeweapon: [
                { label: "TYPES.Item.combatskill", attr: "combatskill.value", type: "select", options: melee },
                { label: "guidevalue", attr: "guidevalue.value", type: "select", options: DSA5.combatskillsGuidevalues },
                { label: "reach", attr: "reach.value", type: "select", options: DSA5.meleeRanges }
            ],
            poison: [
                { label: "resistanceModifier", attr: "resistance.value", type: "select", options: DSA5.magicResistanceModifiers },
                { label: "COMBATSKILLCATEGORY.subcategory", attr: "subcategory", type: "select", options: DSA5.poisonSubTypes },
                { label: "poisonType", attr: "poisonType.value", type: "text" },
                { label: "PLANT.region", attr: "region", type: "text" },
            ],
            disease: [
                { label: "resistanceModifier", attr: "resistance.value", type: "select", options: DSA5.magicResistanceModifiers },
            ],
            consumable: [
                { label: "equipmentType", attr: "equipmentType.value", type: "select", options: DSA5.equipmentTypes }
            ],
            application: [
                { label: "TYPES.Item.skill", attr: "skill", type: "select", options: skills }
            ],
            trait: [
                { label: "traitType", attr: "traitType.value", type: "select", options: DSA5.traitCategories }
            ],
            career: [
                { label: "mageLevel", attr: "mageLevel.value", type: "select", options: DSA5.mageLevels }
            ],
            specialability: [
                { type: "prerendered", attr: "category.value", content: specialabilies },
                { label: "TYPES.Item.combatskill", attr: "list.value", type: "select", options: allCombat, notStrict: true },
                { label: "distribution", attr: "distribution", type: "text" }
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
                { label: "feature", attr: "feature.value", type: "text" },
                { label: "distribution", attr: "distribution", type: "text" }
            ],
            blessing: [
                { label: "targetCategory", attr: "targetCategory.value", type: "text" },
                { label: "feature", attr: "feature.value", type: "text" }
            ],
            npc: [
                { label: "TYPES.Item.species", attr: "details.species.value", type: "text" },
                { label: "TYPES.Item.career", attr: "details.career.value", type: "text" },
                { label: "TYPES.Item.culture", attr: "details.culture.value", type: "text" }
            ],
            character: [
                { label: "TYPES.Item.species", attr: "details.species.value", type: "text" },
                { label: "TYPES.Item.career", attr: "details.career.value", type: "text" },
                { label: "TYPES.Item.culture", attr: "details.culture.value", type: "text" }
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
                { label: "PLANT.healing", attr: "planttype.healing", type: 'checkbox' },
                { label: "PLANT.poison", attr: "planttype.poison", type: 'checkbox' },
                { label: "PLANT.physical", attr: "planttype.physical", type: 'checkbox' },
                { label: "PLANT.psychic", attr: "planttype.psychic", type: 'checkbox' },
                { label: "PLANT.crop", attr: "planttype.crop", type: 'checkbox' },
                { label: "PLANT.defensive", attr: "planttype.defensive", type: 'checkbox' },
                { label: "PLANT.supernatural", attr: "planttype.supernatural", type: 'checkbox' },
                { label: "PLANT.highNorth", attr: "availability.highNorth", type: 'range' },
                { label: "PLANT.grasLands", attr: "availability.grasLands", type: 'range' },
                { label: "PLANT.swamps", attr: "availability.swamps", type: 'range' },
                { label: "PLANT.woods", attr: "availability.woods", type: 'range' },
                { label: "PLANT.jungle", attr: "availability.jungle", type: 'range' },
                { label: "PLANT.mountains", attr: "availability.mountains", type: 'range' },
                { label: "PLANT.desert", attr: "availability.desert", type: 'range' },
                { label: "PLANT.maraskan", attr: "availability.maraskan", type: 'range' }
            ],
            magicalsign: [],
            patron: [],
            demonmark: [],
            essence: [],
            imprint: [
                { label: "Category", attr: "category", type: "text" }
            ]

        }

        for(const [key, value] of Object.entries(filters)){
            for(const filter of value){
                if(filter.type == "text")
                    filter.placeholder = `Library.advancedSearchPlaceholders.${key}.${filter.attr}`
            }
        }

        mergeObject(ADVANCEDFILTERS, filters)

        game.dsa5.advancedFilters = ADVANCEDFILTERS
    })
})

export default ADVANCEDFILTERS