import DSA5_Utility from "../system/utility-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"
import Actordsa5 from "../actor/actor-dsa5.js"
import DSA5StatusEffects from "../status/status_effects.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js"
import DSA5 from "../system/config-dsa5.js"
import ItemRulesDSA5 from "../system/item-rules-dsa5.js"
import DSAActiveEffectConfig from "../status/active_effects.js"
import RuleChaos from "../system/rule_chaos.js"
import CreatureType from "../system/creature-type.js"
import DPS from "../system/derepositioningsystem.js"
import DSA5CombatDialog from "../dialog/dialog-combat-dsa5.js"
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js"
import DSA5SpellDialog from "../dialog/dialog-spell-dsa5.js"
import Riding from "../system/riding.js"

export default class Itemdsa5 extends Item {
    static defaultImages = {
        advantage: "systems/dsa5/icons/categories/Vorteil.webp",
        disadvantage: "systems/dsa5/icons/categories/Nachteil.webp",
        armor: "systems/dsa5/icons/categories/Armor.webp",
        meleeweapon: "systems/dsa5/icons/categories/Meleeweapon.webp",
        rangeweapon: "systems/dsa5/icons/categories/Rangeweapon.webp",
        equipment: "systems/dsa5/icons/categories/Equipment.webp",
        consumable: "systems/dsa5/icons/categories/consumable.webp",
        liturgy: "systems/dsa5/icons/categories/Liturgy.webp",
        spell: "systems/dsa5/icons/categories/Spell.webp",
        ammunition: "systems/dsa5/icons/categories/Munition.webp",
        career: "systems/dsa5/icons/categories/Career.webp",
        magictrick: "systems/dsa5/icons/categories/Spelltrick.webp",
        blessing: "systems/dsa5/icons/categories/Blessing.webp",
        combatskill: "systems/dsa5/icons/categories/Combat_Skill.webp",
        skill: "systems/dsa5/icons/categories/Skill.webp",
        Geweihte: "systems/dsa5/icons/categories/Geweihte.webp",
        Weltliche: "systems/dsa5/icons/categories/Weltliche.webp",
        Zauberer: "systems/dsa5/icons/categories/Zauberer.webp",
        ritual: "systems/dsa5/icons/categories/ritual.webp",
        ceremony: "systems/dsa5/icons/categories/ceremony.webp",
        abilityclerical: "systems/dsa5/icons/categories/ability_clerical.webp",
        abilityCombat: "systems/dsa5/icons/categories/ability_combat.webp",
        abilityfatePoints: "systems/dsa5/icons/categories/ability_fate_points.webp",
        abilitygeneral: "systems/dsa5/icons/categories/ability_general.webp",
        specialability: "systems/dsa5/icons/categories/ability_general.webp",
        abilitymagical: "systems/dsa5/icons/categories/ability_magical.webp",
        abilitylanguage: "systems/dsa5/icons/categories/Ability_Language.webp",
        abilitystaff: "systems/dsa5/icons/categories/ability_staff.webp",
        abilityceremonial: "systems/dsa5/icons/categories/ability_ceremonial.webp",
        abilityanimal: "systems/dsa5/icons/categories/ability_animal.webp",
        trait: "systems/dsa5/icons/categories/trait.webp",
        Tiere: "systems/dsa5/icons/categories/Tiere.webp",
        aggregatedTest: "systems/dsa5/icons/categories/aggregated_test.webp",
        poison: "systems/dsa5/icons/categories/poison.webp",
        disease: "systems/dsa5/icons/categories/disease.webp",
        spellextension: "systems/dsa5/icons/categories/Spellextension.webp",
        species: "icons/environment/people/group.webp",
        application: "systems/dsa5/icons/categories/Skill.webp",
        trick: "systems/dsa5/icons/categories/Tiere.webp",
        disadvantageanimal: "systems/dsa5/icons/categories/NachteilAnimal.webp",
        advantageanimal: "systems/dsa5/icons/categories/VorteilAnimal.webp",
        diseaseanimal: "systems/dsa5/icons/categories/diseaseAnimal.webp",
        effectwrapper: "icons/svg/aura.svg",
        liturgyTalisman: "systems/dsa5/icons/categories/LiturgieTalisman.webp",
        plant: "systems/dsa5/icons/categories/plant.webp",
        magicalsign: "systems/dsa5/icons/categories/magicalsign.webp",
        abilitypact: "systems/dsa5/icons/categories/ability_pact.webp",
        demonmark: "systems/dsa5/icons/categories/ability_pact.webp",
        patron: "systems/dsa5/icons/categories/ability_pact.webp",
        information: "systems/dsa5/icons/categories/DSA-Auge.webp",
        essence: "systems/dsa5/icons/categories/wesenszug.webp",
        imprint: "systems/dsa5/icons/categories/praegung.webp"
    }

    static defaultIcon(data) {
        if (!data.img || data.img == "") {
            if (data.type in this.defaultImages) {
                data.img = this.defaultImages[data.type]
            } else {
                data.img = "systems/dsa5/icons/blank.webp"
            }
        }
    }

    static async create(data, options) {
        this.defaultIcon(data)
        return await super.create(data, options)
    }

    static getSpecAbModifiers(html, mode) {
        let res = []
        for (let k of html.find(".specAbs")) {
            let step = Number($(k).attr("data-step"))
            if (step > 0) {
                const val = mode == "attack" ? $(k).attr("data-atbonus") : $(k).attr("data-pabonus")
                const reducedVal = val.split(",").reduce((prev, cur) => {
                    return prev + Number(cur)
                }, 0)
                res.push({
                    name: $(k).find("a").text(),
                    value: isNaN(reducedVal) ? Number(val.replace("*", "")) : Number(reducedVal) * step,
                    damageBonus: $(k).attr("data-tpbonus"),
                    dmmalus: $(k).attr("data-dmmalus") * step,
                    step: step,
                    specAbId: $(k).attr("data-id"),
                    type: /^\*/.test(val) ? "*" : undefined,
                })
            }
        }
        return res
    }

    static setupSubClasses() {
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
            species: SpeciesItemDSA5,
            effectwrapper: EffectWrapperItemDSA5,
            plant: PlantItemDSA5,
            magicalsign: MagicalSignItemDSA5,
            patron: PatronItemDSA5,
            demonmark: DemonmarkItemDSA5,
            information: InformationItemDSA5
        }
    }

    static buildSpeaker(actor, tokenId) {
        return {
            token: tokenId,
            actor: actor?.id,
            scene: canvas.scene?.id,
        }
    }

    static parseValueType(name, val) {
        let type = ""
        if (/^\*/.test(val)) {
            type = "*"
            val = val.substring(1).replace(",", ".")
        }
        return {
            name,
            value: Number(val),
            type,
        }
    }

    async addCondition(effect, value = 1, absolute = false, auto = true) {
        return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto)
    }

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        return DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute)
    }

    hasCondition(conditionKey) {
        return DSA5StatusEffects.hasCondition(this, conditionKey)
    }

    static getMiracleModifiers(actor, source, type, bonusAttribute) {
        const regex = new RegExp(`${game.i18n.localize('combatskill')} `, 'gi')
        const happyTalents = (getProperty(actor, "system.happyTalents.value") || "").split(/;|,/).map(x => x.replace(regex, '').trim())
        const result = []
        if (happyTalents.includes(source.name)) {
            const availableKaP = actor.system.status.karmaenergy.value
            const bonus = getProperty(actor, `system.miracle.${bonusAttribute}`) || 0
            if (availableKaP < 4) return []

            result.push({
                name: game.i18n.localize('LocalizedIDs.miracle'),
                value: 2 + bonus,
                type,
                selected: false
            })
            const miracleMight = game.i18n.localize('LocalizedIDs.miracleMight')
            if (availableKaP >= 6 && SpecialabilityRulesDSA5.hasAbility(actor, miracleMight)) {
                result.push({
                    name: miracleMight,
                    value: 3 + bonus,
                    type,
                    selected: false
                })
            }
        }
        return result
    }

    static getSkZkModifier(data, source) {
        let skMod = []
        let zkMod = []

        const hasSpellResistance = ["spell", "liturgy", "ceremony", "ritual"].includes(source.type) && source.system.effectFormula.value.trim() == ""
        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor) {
                    let spellResistance = 0
                    if (hasSpellResistance) {
                        const creatureTypes = CreatureType.detectCreatureType(target.actor)
                        spellResistance = creatureTypes.reduce((sum, x) => {
                            return sum + x.spellResistanceModifier(target.actor)
                        }, 0)
                    }
                    const itemResistSoulpower = getProperty(target.actor, `system.status.soulpower.${source.type}resist`) || 0
                    const itemResistToughness = getProperty(target.actor, `system.status.toughness.${source.type}resist`) || 0
                    skMod.push((target.actor.system.status.soulpower.max + itemResistSoulpower) * -1 - spellResistance)
                    zkMod.push((target.actor.system.status.toughness.max + itemResistToughness) * -1 - spellResistance)
                }
            })
        }

        mergeObject(data, {
            SKModifier: skMod.length > 0 ? Math.min(...skMod) : 0,
            ZKModifier: zkMod.length > 0 ? Math.min(...zkMod) : 0
        })
    }

    static parseEffect(effect, actor) {
        let itemModifiers = {}
        let regex = new RegExp(game.i18n.localize("CHARAbbrev.GS"), "gi")
        for (let mod of effect.split(/,|;/).map((x) => x.trim())) {
            let vals = mod.replace(/(\s+)/g, " ").trim().split(" ")
            vals[0] = vals[0].replace(regex, actor.system.status.speed.max)
            if (vals.length == 2) {
                if (!isNaN(vals[0]) ||
                    /(=)?[+-]\d([+-]\d)?/.test(vals[0]) ||
                    /(=)?\d[dDwW]\d/.test(vals[0]) ||
                    /=\d+/.test(vals[0]) ||
                    /\*\d(\.\d)*/.test(vals[0])
                ) {
                    if (itemModifiers[vals[1].toLowerCase()] == undefined) {
                        itemModifiers[vals[1].toLowerCase()] = [vals[0]]
                    } else {
                        itemModifiers[vals[1].toLowerCase()].push(vals[0])
                    }
                }
            }
        }
        return itemModifiers
    }


    static getDefenseMalus(situationalModifiers, actor) {
        let isRangeDefense = false
        if (actor.flags.oppose) {
            let message = game.messages.get(actor.flags.oppose.messageId)
            const preData = message.flags.data.preData
            isRangeDefense = !(getProperty(preData, "source.type") == "meleeweapon" || getProperty(preData, "source.system.traitType.value") == "meleeAttack")

            const regex = / \[(-)?\d{1,}\]/
            for (let mal of preData.situationalModifiers) {
                if (mal.dmmalus != undefined && mal.dmmalus != 0) {
                    situationalModifiers.push({
                        name: `${game.i18n.localize("MODS.defenseMalus")} - ${mal.name.replace(regex, "")}`,
                        value: mal.dmmalus,
                        selected: true,
                    })
                } else if (mal.type == "defenseMalus" && mal.value != 0) {
                    situationalModifiers.push({
                        name: mal.name.replace(regex, ""),
                        value: mal.value,
                        selected: true,
                    })
                }
            }
            if (message.flags.data.postData.halfDefense) {
                situationalModifiers.push({
                    name: `${game.i18n.localize("MODS.defenseMalus")} - ${game.i18n.localize("halfDefenseShort")}`,
                    value: 0.5,
                    type: "*",
                    selected: true,
                })
            }
        }
        return isRangeDefense
    }

    static changeChars(source, ch1, ch2, ch3) {
        source.system.characteristic1.value = ch1
        source.system.characteristic2.value = ch2
        source.system.characteristic3.value = ch3
    }

    static attackSpecAbs(combatSpecAbs, actor, path="effect.value"){
        const at = game.i18n.localize("LocalizedAbilityModifiers.at")
        const tp = game.i18n.localize("LocalizedAbilityModifiers.tp")
        const dm = game.i18n.localize("LocalizedAbilityModifiers.dm")
        const combatskills = []

        for (let com of combatSpecAbs) {
            const effects = Itemdsa5.parseEffect(getProperty(com.system, path), actor)
            const atbonus = effects[at] || 0
            const tpbonus = effects[tp] || 0
            const dmmalus = effects[dm] || 0
            const variantCount = ["","2","3"].map(x => getProperty(com, `system.effect.value${x}`)).filter(x => x).length
            if (atbonus != 0 || tpbonus != 0 || dmmalus != 0 || com.effects.size > 0) {
                const subCategory = game.i18n.localize(DSA5.combatSkillSubCategories[com.system.category.sub])
                combatskills.push({
                    name: com.name,
                    atbonus,
                    tpbonus,
                    dmmalus,
                    label: `${at.toUpperCase()}: ${atbonus}, ${tp.toUpperCase()}: ${tpbonus}, ${dm.toUpperCase()}: ${dmmalus}`,
                    steps: com.system.step.value,
                    category: {
                        id: com.system.category.sub,
                        css: `ab_${com.system.category.sub}`,
                        name: subCategory,
                    },
                    id: com.id,
                    actor: actor.id,
                    variantCount
                })
            }
        }
        return combatskills
    }

    static defenseSpecAbs(combatSpecAbs, actor, path="effect.value"){
        const combatskills = []
        const pa = game.i18n.localize("LocalizedAbilityModifiers.pa")

        for (let com of combatSpecAbs) {
            const effects = Itemdsa5.parseEffect(getProperty(com.system, path), actor)
            const pabonus = effects[pa] || 0
            if (pabonus != 0) {
                const subCategory = game.i18n.localize(DSA5.combatSkillSubCategories[com.system.category.sub])
                const variantCount = ["","2","3"].map(x => getProperty(com, `system.effect.value${x}`)).filter(x => x).length
                combatskills.push({
                    name: com.name,
                    pabonus,
                    tpbonus: 0,
                    dmmalus: 0,
                    label: `${pa}: ${pabonus}`,
                    steps: com.system.step.value,
                    category: {
                        id: com.system.category.sub,
                        css: `ab_${com.system.category.sub}`,
                        name: subCategory,
                    },
                    id: com.id,
                    actor: actor.id,
                    variantCount
                })
            }
        }
        return combatskills
    }

    static buildCombatSpecAbs(actor, categories, toSearch, mode) {
        let searchFilter
        if (toSearch) {
            toSearch.push(game.i18n.localize("LocalizedIDs.all"))
            toSearch = toSearch.map((x) => x.toLowerCase())
            searchFilter = (x, toSearch) => {
                return (
                    x.system.list.value
                    .split(/;|,/)
                    .map((x) => x.trim().toLowerCase())
                    .filter((y) => toSearch.includes(y.replace(/ \([a-zA-Z äüöÄÖÜ]*\)/, ""))).length > 0
                )
            }
        } else
            searchFilter = () => { return true }

        const combatSpecAbs = actor.items.filter((x) => {
            return (
                x.type == "specialability" &&
                categories.includes(x.system.category.value) &&
                x.system.effect.value != "" &&
                searchFilter(x, toSearch)
            )
        })

        if (mode == "attack") {
            return this.attackSpecAbs(combatSpecAbs, actor)
        } else {
            return this.defenseSpecAbs(combatSpecAbs, actor)
        }
    }

    static getCombatSkillModifier(actor, source, situationalModifiers) {
        if (source.type == "trait") return

        const combatskill = actor.items.find((x) => x.type == "combatskill" && x.name == source.system.combatskill.value)

        for (let ef of combatskill.effects) {
            for (let change of ef.changes) {
                switch (change.key) {
                    case "system.rangeStats.defenseMalus":
                    case "system.meleeStats.defenseMalus":
                        situationalModifiers.push({
                            name: `${combatskill.name} - ${game.i18n.localize("MODS.defenseMalus")}`,
                            value: change.value * -1,
                            type: "defenseMalus",
                            selected: true,
                        })
                        break
                }
            }
        }
    }

    static attackStatEffect(situationalModifiers, value) {
        if (value != 0) {
            value = isNaN(value) ? value : Number(value)
            situationalModifiers.push({
                name: game.i18n.localize("statuseffects"),
                value,
                selected: true,
            })
        }
    }

    static getTargetSizeAndModifier(actor, source, situationalModifiers){
        let targetSize = "average"
        game.user.targets.forEach((target) => {
            if (target.actor) {
                const size = getProperty(target.actor, "system.status.size.value")
                if(size) targetSize = size

                CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor)
            }
        })
        return targetSize
    }

    static prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatskills, currentAmmo = undefined) {
        situationalModifiers.push(
            ...AdvantageRulesDSA5.getVantageAsModifier(actor, game.i18n.localize("LocalizedIDs.restrictedSenseSight"), -2)
        )
        this.getCombatSkillModifier(actor, source, situationalModifiers)

        const targetSize = this.getTargetSizeAndModifier(actor, source, situationalModifiers)

        const defenseMalus = Number(actor.system.rangeStats.defenseMalus) * -1
        if (defenseMalus != 0) {
            situationalModifiers.push({
                name: `${game.i18n.localize("statuseffects")} - ${game.i18n.localize("MODS.defenseMalus")}`,
                value: defenseMalus,
                type: "defenseMalus",
                selected: true,
            })
        }

        const rangeOptions = {...DSA5.rangeWeaponModifiers }
        delete rangeOptions[
            AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize("LocalizedIDs.senseOfRange")) ? "long" : "rangesense"
        ]
        if (!SpecialabilityRulesDSA5.hasAbility(actor, game.i18n.localize("LocalizedIDs.extremeShot"))) delete rangeOptions["extreme"]
        const drivingArcher = SpecialabilityRulesDSA5.hasAbility(actor, game.i18n.localize("LocalizedIDs.drivingArcher"))
        const mountedArcher = SpecialabilityRulesDSA5.hasAbility(actor, game.i18n.localize("LocalizedIDs.mountedArcher"))
        let mountedOptions
        if(mountedArcher && Riding.isRiding(actor)){
            mountedOptions = duplicate(DSA5.mountedRangeOptionsSpecAb)
        }
        else if(drivingArcher){
            mountedOptions = duplicate(DSA5.drivingArcherOptions)
        }
        else {
            mountedOptions = duplicate(DSA5.mountedRangeOptions)
        }

        this.swarmModifiers(actor, "attack", situationalModifiers)

        mergeObject(data, {
            rangeOptions,
            rangeDistance: Object.keys(rangeOptions)[DPS.distanceModifier(game.canvas.tokens.get(tokenId), source, currentAmmo)],
            sizeOptions: DSA5.rangeSizeCategories,
            visionOptions: DSA5.rangeVision,
            mountedOptions,
            shooterMovementOptions: DSA5.shooterMovementOptions,
            targetMovementOptions: DSA5.targetMomevementOptions,
            targetSize,
            combatSpecAbs: combatskills,
            aimOptions: DSA5.aimOptions,
        })
    }

    static swarmModifiers(actor, mode, situationalModifiers) {
        if(actor.system.swarm?.count > 1) {
            if(mode == "attack") {
                    situationalModifiers.push({
                        name: `${game.i18n.localize("swarm.name")} - ${game.i18n.localize("MODS.defenseMalus")}`,
                        value: actor.system.swarm.parry,
                        type: "defenseMalus",
                        selected: true,
                    }, {
                        name: `${game.i18n.localize("swarm.name")} - ${game.i18n.localize("CHARAbbrev.AT")}`,
                        value: actor.system.swarm.attack,
                        selected: true,
                    }, {
                        name: `${game.i18n.localize("swarm.name")} - ${game.i18n.localize("CHARAbbrev.damage")}`,
                        value: actor.system.swarm.damage,
                        type: "dmg",
                        selected: true,
                    })                
            } else {
                situationalModifiers.push({
                    name: `${game.i18n.localize("swarm.name")} - ${game.i18n.localize("CHARAbbrev.PA")}`,
                    value: actor.system.swarm.parry,
                    selected: true,
                })
            }
        }
    }   

    static prepareMeleeAttack(situationalModifiers, actor, data, source, combatskills, wrongHandDisabled) {
        let targetWeaponSize = "short"
        
        game.user.targets.forEach((target) => {
            if (target.actor) {
                for(let x of target.actor.items){
                    if((x.type == "meleeweapon" && x.system.worn.value) || (x.type == "trait" && x.system.traitType.value == "meleeAttack" && x.system.pa)){
                        if(DSA5.meleeRangesArray.indexOf(x.system.reach.value) > DSA5.meleeRangesArray.indexOf(targetWeaponSize)) 
                            targetWeaponSize = x.system.reach.value

                        if(targetWeaponSize == "long") break
                    }
                }
            }
        })
        
        const targetSize = this.getTargetSizeAndModifier(actor, source, situationalModifiers)
        this.getCombatSkillModifier(actor, source, situationalModifiers)

        const defenseMalus = Number(actor.system.meleeStats.defenseMalus) * -1
        if (defenseMalus != 0) {
            situationalModifiers.push({
                name: `${game.i18n.localize("statuseffects")} - ${game.i18n.localize("MODS.defenseMalus")}`,
                value: defenseMalus,
                type: "defenseMalus",
                selected: true,
            })
        }

        this.swarmModifiers(actor, "attack", situationalModifiers)
        
        mergeObject(data, {
            visionOptions: DSA5.meleeRangeVision(data.mode),
            weaponSizes: DSA5.meleeRanges,
            melee: true,
            showAttack: true,
            targetWeaponSize,
            combatSpecAbs: combatskills,
            meleeSizeOptions: DSA5.meleeSizeCategories,
            targetSize,
            constricted: actor.hasCondition("constricted"),
            wrongHandDisabled,
            offHand: !wrongHandDisabled && getProperty(source, "system.worn.offHand"),
        })
    }

    static prepareMeleeParry(situationalModifiers, actor, data, source, combatskills, wrongHandDisabled) {
        const isRangeDefense = Itemdsa5.getDefenseMalus(situationalModifiers, actor)
        this.swarmModifiers(actor, "parry", situationalModifiers)
        mergeObject(data, {
            visionOptions: DSA5.meleeRangeVision(data.mode),
            showDefense: true,
            isRangeDefense,
            wrongHandDisabled: wrongHandDisabled && getProperty(source, "system.worn.offHand"),
            offHand: !wrongHandDisabled && getProperty(source, "system.worn.offHand") && !RuleChaos.isShield(source),
            melee: true,
            combatSpecAbs: combatskills,
            constricted: actor.hasCondition("constricted"),
        })
    }

    static _chatLineHelper(key, val) {
        return `<b>${game.i18n.localize(key)}</b>: ${val ? val : "-"}`
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        return null
    }

    setupEffect(ev, options = {}, tokenId) {
        return Itemdsa5.getSubClass(this.type).setupDialog(ev, options, this, tokenId)
    }

    static checkEquality(item, item2) {
        return item2.type == item.type && item.name == item2.name && item.system.description.value == item2.system.description.value
    }

    static async combineItem(item1, item2, actor) {
        item1 = duplicate(item1)
        item1.system.quantity.value += item2.system.quantity.value
        return await actor.updateEmbeddedDocuments("Item", [item1])
    }

    static areEquals(item, item2) {
        if (item.type != item2.type) return false

        return Itemdsa5.getSubClass(item.type).checkEquality(item, item2)
    }

    static async stackItems(stackOn, newItem, actor) {
        return await Itemdsa5.getSubClass(stackOn.type).combineItem(stackOn, newItem, actor)
    }

    _setupCardOptions(template, title, tokenId) {
        const speaker = ChatMessage.getSpeaker()
        return {
            speaker: {
                alias: speaker.alias,
                scene: speaker.scene,
            },
            flags: {
                img: speaker.token ? canvas.tokens.get(speaker.token).document.img : this.img,
            },
            title,
            template,
        }
    }

    async itemTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions)
        let result = await DiceDSA5.rollTest(testData)

        result.postFunction = "itemTest"

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            const opposed = ` - ${game.i18n.localize("Opposed")}`
            if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + "$") != opposed) cardOptions.title += opposed
        }

        if (!options.suppressMessage) DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage)

        return { result, cardOptions }
    }

    static chatData(data, name) {
        return []
    }

    static getSubClass(type) {
        return game.dsa5.config.ItemSubclasses[type] || Itemdsa5
    }

    async postItem() {
        Itemdsa5.getSubClass(this.type)._postItem(this)
    }

    static async _postItem(item) {
        let chatData = duplicate(item)

        const detailsObfuscated = getProperty(chatData, "system.obfuscation.details")
        const descriptionObfuscated = getProperty(chatData, "system.obfuscation.description")
        
        mergeObject(chatData, {
            properties: detailsObfuscated ? [] : Itemdsa5.getSubClass(item.type).chatData(duplicate(chatData.system), item.name),
            descriptionObfuscated
        })

        chatData.hasPrice = ("price" in chatData.system) && !detailsObfuscated
        if (chatData.hasPrice) {
            let price = chatData.system.price.value
            if (chatData.system.QL) price = Itemdsa5.getSubClass(chatData.type).consumablePrice(chatData)

            chatData.system.price.D = Math.floor(price / 10)
            price -= chatData.system.price.D * 10
            chatData.system.price.S = Math.floor(price)
            price -= chatData.system.price.S
            chatData.system.price.H = Math.floor(price / 0.1)
            price -= chatData.system.price.H * 0.1
            chatData.system.price.K = Math.round(price / 0.01)

            const prices = ["D", "S", "H", "K"].map(x =>
                    `${chatData.system.price[x]} <div data-tooltip="${game.i18n.localize(`Money-${x}`)}" class="chatmoney money-${x}"></div>`).join(",")
            chatData.properties.push(`<b>${game.i18n.localize("price")}</b>: ${prices}`)
        }

        if (item.pack) chatData.itemLink = item.link

        if (chatData.img.includes("/blank.webp")) chatData.img = null

        const html = await renderTemplate("systems/dsa5/templates/chat/post-item.html", chatData)
        const chatOptions = DSA5_Utility.chatDataSetup(html)
        ChatMessage.create(chatOptions)
    }
}

class PlantItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("effect", data.effect),
            this._chatLineHelper("PLANT.recipes", data.recipes),
            this._chatLineHelper("PLANT.usages", data.usages),
        ]

        return res
    }
}

class MagicalSignItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [this._chatLineHelper("AsPCost", data.asp)]
        if (data.category == 2) res.push(this._chatLineHelper("feature", data.feature))

        return res
    }
}

class DemonmarkItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("attributes", data.attribute),
            this._chatLineHelper("skills", data.skills),
            this._chatLineHelper("domains", data.domain),
        ]

        return res
    }
}

class PatronItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("skills", data.talents),
            this._chatLineHelper("culture", data.culture),
            this._chatLineHelper("Category", game.i18n.localize(`PATRON.${data.category}`)),
        ]

        return res
    }
}

class aggregatedTestItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let result = game.i18n.localize("Ongoing")
        if (data.cummulatedQS.value >= 10) {
            result = game.i18n.localize("Success")
        } else if (data.cummulatedQS.value >= 6) {
            result = game.i18n.localize("PartSuccess")
        } else if (data.allowedTestCount.value - data.usedTestCount.value <= 0) {
            result = game.i18n.localize("Failure")
        }
        return [
            this._chatLineHelper("cummulatedQS", `${data.cummulatedQS.value} / 10`),
            this._chatLineHelper("interval", data.interval.value),
            this._chatLineHelper("probes", `${data.usedTestCount.value} / ${data.allowedTestCount.value}`),
            this._chatLineHelper("result", result),
        ]
    }
}

class AmmunitionItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("ammunitiongroup", game.i18n.localize(data.ammunitiongroup.value))]
    }
}

class EffectWrapperItemDSA5 extends Itemdsa5 { }

class ArmorItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let properties = [
            this._chatLineHelper("protection", data.protection.value),
            this._chatLineHelper("encumbrance", data.encumbrance.value),
        ]
        if (data.effect.value != "") properties.push(this._chatLineHelper("effect", data.effect.value))

        return properties
    }
}

class CantripItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("feature", data.feature.value),
        ]
    }
}

class BlessingItemDSA5 extends CantripItemDSA5 {}

class SpellItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("AsPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value))),
        ]
    }

    static async getCallbackData(testData, html, actor) {
        testData.testDifficulty = 0
        testData.situationalModifiers = Actordsa5._parseModifiers(html)
        const formData = new FormDataExtended(html.find('form')[0]).object
        testData.calculatedSpellModifiers = {
            castingTime: html.find(".castingTime").text(),
            cost: html.find(".aspcost").text(),
            reach: html.find(".reach").text(),
            maintainCost: html.find(".maintainCost").text(),
        }
        testData.situationalModifiers.push({
            name: game.i18n.localize("removeGesture"),
            value: Number(formData.removeGesture) || 0,
        }, {
            name: game.i18n.localize("removeFormula"),
            value: Number(formData.removeFormula) || 0,
        }, {
            name: game.i18n.localize("castingTime"),
            value: html.find(".castingTime").data("mod"),
        }, {
            name: game.i18n.localize("cost"),
            value: html.find(".aspcost").data("mod"),
        }, {
            name: game.i18n.localize("reach"),
            value: html.find(".reach").data("mod"),
        }, {
            name: game.i18n.localize("zkModifier"),
            value: formData.zkModifier || 0,
        }, {
            name: game.i18n.localize("skModifier"),
            value: formData.skModifier || 0,
        }, {
            name: game.i18n.localize("maintainedSpells"),
            value: formData.maintainedSpells * -1,
        })
        testData.extensions = SpellItemDSA5.getSpecAbModifiers(html)
        testData.advancedModifiers = {
            chars: [0, 1, 2].map((x) => formData[`ch${x}`]),
            fws: formData.fw,
            qls: formData.qs,
        }
        Itemdsa5.changeChars(testData.source, ...[0, 1, 2].map((x) => formData[`characteristics${x}`]))
        await this.applyExtensions(testData.source, testData.extensions, actor)
    }

    static async applyExtensions(source, extensions, actor){
        RuleChaos.ensureNumber(source)
        const rollModifiers = Object.keys(DSA5SpellDialog.rollModifiers).map(x => `${x}.mod`)
        for(let extension of extensions){
            const item = fromUuidSync(extension.uuid)
            if(!item) continue

            for(let ef of item.effects){
                for(let change of ef.changes){
                    if(DSA5SpellDialog.rollChanges.includes(change.key)) continue
                    if(rollModifiers.includes(change.key)) continue

                    if(change.key == "macro.transform"){
                        await DSA5_Utility.callItemTransformationMacro(change.value, source, ef)
                    }
                    
                    else{
                        ef.apply(source, change)
                    }
                }
            }
        }
    }

    static getSpecAbModifiers(html) {
        let res = []
        for (let k of html.find(".specAbs.active")) {
            res.push({name: k.dataset.name, title: k.getAttribute('title'), uuid: k.dataset.uuid})
        }
        return res
    }

    static attackSpellMalus(source) {
        let res = []
        if (source.system.effectFormula.value)
            res.push({ name: game.i18n.localize("MODS.defenseMalus"), value: -4, type: "defenseMalus", selected: true, source: source.name })

        return res
    }

    static getPropertyModifiers(actor, item) {
        const isClerical = ["ceremony", "liturgy"].includes(item.type)
        const features = (getProperty(item, "system.feature") || "")
            .replace(/\(a-z äöü\-\)/gi, "")
            .split(",")
            .map((x) => x.trim())
        const res = []

        const cost = isClerical ? "KaPCost" : "AsPCost"
        const keys = ["FP", "step", "QL", "TPM", "FW", cost]
        for (const k of keys) {
            const type = k == "step" ? "" : k
            const modifiers = getProperty(actor.system.skillModifiers, `feature.${k}`)
            res.push(
                ...modifiers
                .filter((x) => features.includes(x.target))
                .map((f) => {
                    return {
                        name: f.source,
                        value: f.value,
                        type,
                        source: f.source
                    }
                })
            )
        }
        const conditional = getProperty(actor.system.skillModifiers, `conditional.${cost}`)
        res.push(...conditional.map(f => {
            return {
                name: f.target,
                value: f.value,
                type: cost
            }
        }))

        return res
    }

    static foreignSpellModifier(actor, source, situationalModifiers, data) {
        if (
            game.settings.get("dsa5", "enableForeignSpellModifer") && ["npc", "character"].includes(actor.type) && ["spell", "ritual"].includes(source.type)
        ) {
            const distributions = source.system.distribution.value.split(",").map((x) => x.trim().toLowerCase())
            const regx = new RegExp(`(${game.i18n.localize("tradition")}|\\\)|\\\()`, "g")
            const traditions = actor.system.tradition.magical
                .replace(regx, "")
                .split(",")
                .map((x) => x.trim().toLowerCase())
            traditions.push(game.i18n.localize("general").toLowerCase())

            data.isForeign = !distributions.some((x) => traditions.includes(x))
            if (data.isForeign) {
                situationalModifiers.push({
                    name: game.i18n.localize("DSASETTINGS.enableForeignSpellModifer"),
                    value: -2,
                    selected: true,
                })
            }
        }
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(
            ...ItemRulesDSA5.getTalentBonus(actor, source.name, [
                "advantage",
                "disadvantage",
                "specialability",
                "equipment",
            ]),
            ...AdvantageRulesDSA5.getVantageAsModifier(actor, game.i18n.localize("LocalizedIDs.magicalAttunement"), 1, true),
            ...AdvantageRulesDSA5.getVantageAsModifier(
                actor,
                game.i18n.localize("LocalizedIDs.magicalRestriction"), -1,
                true
            ),
            ...AdvantageRulesDSA5.getVantageAsModifier(actor, game.i18n.localize("LocalizedIDs.boundToArtifact"), -1, true),
            ...this.getPropertyModifiers(actor, source),
            ...this.attackSpellMalus(source)
        )

        this.foreignSpellModifier(actor, source, situationalModifiers, data)
        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor) CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor)
            })
        }
        situationalModifiers.push(...actor.getSkillModifier(source.name, source.type))
        for (const thing of actor.system.skillModifiers.global) {
            situationalModifiers.push({ name: thing.source, value: thing.value })
        }

        this.getSkZkModifier(data, source)
    }

    static setupDialog(ev, options, spell, actor, tokenId) {
        let sheet = "spell"
        if (spell.type == "ceremony" || spell.type == "liturgy") sheet = "liturgy"

        let title = spell.name + " " + game.i18n.localize(`${spell.type}Test`)  + (options.subtitle || "")

        let testData = {
            opposable: spell.system.effectFormula.value.length > 0,
            source: spell,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
            advancedModifiers: {
                chars: [0, 0, 0],
                fws: 0,
                qls: 0,
            },
            calculatedSpellModifiers: {
                castingTime: 0,
                cost: 0,
                reach: 0,
                maintainCost: 0,
            }
        }

        let data = {
            rollMode: options.rollMode,
            spellCost: spell.system.AsPCost.value,
            maintainCost: spell.system.maintainCost.value,
            spellCastingTime: spell.system.castingTime.value,
            spellReach: spell.system.range.value,
            canChangeCost: spell.system.canChangeCost.value == "true",
            canChangeRange: spell.system.canChangeRange.value == "true",
            canChangeCastingTime: spell.system.canChangeCastingTime.value == "true",
            hasSKModifier: spell.system.resistanceModifier.value == "SK",
            hasZKModifier: spell.system.resistanceModifier.value == "ZK",
            maxMods: Math.floor(Number(spell.system.talentValue.value) / 4),
            extensions: this.prepareExtensions(actor, spell),
            variableBaseCost: spell.system.variableBaseCost == "true",
            characteristics: [1, 2, 3].map((x) => spell.system[`characteristic${x}`].value),
        }

        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, spell) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, spell)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: `/systems/dsa5/templates/dialog/${sheet}-enhanced-dialog.html`,
            data,
            callback: async(html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                await this.getCallbackData(testData, html, actor)
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/spell-card.html", title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }

    static prepareExtensions(actor, spell) {
        return actor.items
            .filter((x) => x.type == "spellextension" && x.system.source == spell.name && x.system.category == spell.type)
            .map((x) => {
                x.shortName = x.name.split(" - ").length > 1 ? x.name.split(" - ")[1] : x.name
                x.descr = $(x.system.description.value).text() || ""
                return x
            })
    }
}

class LiturgyItemDSA5 extends SpellItemDSA5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("castingTime", data.castingTime.value),
            this._chatLineHelper("KaPCost", data.AsPCost.value),
            this._chatLineHelper("distribution", data.distribution.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("reach", data.range.value),
            this._chatLineHelper("targetCategory", data.targetCategory.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value))),
        ]
    }
}

class CeremonyItemDSA5 extends LiturgyItemDSA5 {
    static getCallbackData(testData, html, actor) {
        super.getCallbackData(testData, html, actor)
        testData.situationalModifiers.push({
            name: game.i18n.localize("CEREMONYMODIFIER.artefact"),
            value: html.find('[name="artefactUsage"]').is(":checked") ? 1 : 0,
        }, {
            name: game.i18n.localize("place"),
            value: html.find('[name="placeModifier"]').val(),
        }, {
            name: game.i18n.localize("time"),
            value: html.find('[name="timeModifier"]').val(),
        })
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        super.getSituationalModifiers(situationalModifiers, actor, data, source)
        mergeObject(data, {
            isCeremony: true,
            locationModifiers: DSA5.ceremonyLocationModifiers,
            timeModifiers: DSA5.ceremonyTimeModifiers,
        })
    }
}

class CombatskillDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("Description", game.i18n.localize(`Combatskilldescr.${name}`))]
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = item.name + " " + game.i18n.localize(mode + "test")

        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }

        let dialogOptions = {
            title,
            template: "systems/dsa5/templates/dialog/combatskill-dialog.html",
            data: {
                rollMode: options.rollMode,
            },
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class ConsumableItemDSA extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("qualityStep", data.QL),
            this._chatLineHelper("effect", DSA5_Utility.replaceDies(data.QLList.split("\n")[data.QL - 1])),
            this._chatLineHelper("charges", data.charges),
        ]
    }

    static consumablePrice(item) {
        let price = item.system.price.value
        if(isNaN(price)) {
            const priceTags = price.split(";")
            price = Number(priceTags[item.system.QL - 1])
            if(isNaN(price)) price = Number(priceTags.pop()) || 0

            return price
        } else {
            return (Number(price) * item.system.QL) || 0
        }        
    }

    static checkEquality(item, item2) {
        return (
            item.type == item2.type &&
            item.name == item2.name &&
            item.system.description.value == item2.system.description.value &&
            item.system.QL == item2.system.QL
        )
    }

    static async setupDialog(ev, options, item, actor) {
        let title = game.i18n.format("CHATNOTIFICATION.usesItem", { actor: item.actor.name, item: item.name })

        if (!item.isOwned) return

        let charges = (item.system.quantity.value - 1) * item.system.maxCharges + item.system.charges
        if (charges <= 0) {
            ui.notifications.error(game.i18n.localize("DSAError.NotEnoughCharges"))
            return
        }

        let newCharges = item.system.charges <= 1 ? item.system.maxCharges : item.system.charges - 1
        let newQuantity = item.system.charges <= 1 ? item.system.quantity.value - 1 : item.system.quantity.value

        let effect = DSA5_Utility.replaceDies(item.system.QLList.split("\n")[item.system.QL - 1], false)
        let msg = `<div><b>${title}</b></div><div>${item.system.description.value}</div><div><b>${game.i18n.localize(
            "effect"
        )}</b>: ${effect}</div>`
        if (newQuantity == 0) {
            await item.actor.deleteEmbeddedDocuments("Item", [item.id])
        } else {
            await item.update({
                "system.quantity.value": newQuantity,
                "system.charges": newCharges,
            })
        }
        await ChatMessage.create(DSA5_Utility.chatDataSetup(msg))
        await this._applyActiveEffect(item)
    }

    static async _applyActiveEffect(source) {
        let effects = source.effects.toObject()
        if (effects.length > 0) {
            const { msg, resistRolls, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(source.actor, effects, source, {
                qualityStep: source.system.QL,
            }, source.actor)
            
            const infoMsg = `${game.i18n.format("ActiveEffects.appliedEffect", {
                target: source.actor.token?.name || source.actor.name,
                source: effectNames.join(", ")
            })} ${msg || ""}`
            ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg))
        }
    }

    static async combineItem(item1, item2, actor) {
        item1 = duplicate(item1)
        let charges = (item1.system.quantity.value - 1) * item1.system.maxCharges + item1.system.charges
        let item2charges = (item2.system.quantity.value - 1) * item2.system.maxCharges + item2.system.charges
        let newQuantity = Math.floor((charges + item2charges) / item1.system.maxCharges) + 1
        let newCharges = (charges + item2charges) % item1.system.maxCharges
        if (newCharges == 0) {
            newQuantity -= 1
            newCharges = item1.system.maxCharges
        }
        item1.system.quantity.value = newQuantity
        item1.system.charges = newCharges
        return await actor.updateEmbeddedDocuments("Item", [item1])
    }
}

class InformationItemDSA5 extends Itemdsa5{
    static async _postItem(item){
        const html = await renderTemplate("systems/dsa5/templates/chat/informationRequestRoll.html", { item })
        const chatOptions = DSA5_Utility.chatDataSetup(html)
        ChatMessage.create(chatOptions)
    }
}

class DiseaseItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("stepValue", data.step.value),
            this._chatLineHelper("incubation", data.incubation.value),
            this._chatLineHelper("damage", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.damage.value))),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("source", DSA5_Utility.replaceDies(data.source.value)),
            this._chatLineHelper("treatment", data.treatment.value),
            this._chatLineHelper("antidot", data.antidot.value),
            this._chatLineHelper("resistanceModifier", data.resistance.value),
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = DSA5_Utility.toObjectIfPossible(source)
        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor)
                    situationalModifiers.push(
                        ...AdvantageRulesDSA5.getVantageAsModifier(
                            target.actor,
                            game.i18n.localize("LocalizedIDs.ResistanttoDisease"), -1,
                            false,
                            true
                        )
                    )
            })
        }
        this.getSkZkModifier(data, source)
        mergeObject(data, {
            hasSKModifier: source.system.resistance.value == "SK",
            hasZKModifier: source.system.resistance.value == "ZK",
        })
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let title = item.name + " " + game.i18n.localize(item.type) + " " + game.i18n.localize("Test")

        let testData = {
            opposable: false,
            source: item,
            extra: {
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }

        let data = {
            rollMode: options.rollMode,
        }
        let situationalModifiers = []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data["situationalModifiers"] = situationalModifiers

        if (options.manualResistance) {
            mergeObject(data, options.manualResistance)
        }

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/poison-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0,
                },
                {
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0,
                })
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = item._setupCardOptions(`systems/dsa5/templates/chat/roll/${item.type}-card.html`, title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class EquipmentItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("equipmentType", game.i18n.localize(`Equipment.${data.equipmentType.value}`))]
    }
}

class MeleeweaponDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("atmod", data.atmod.value),
            this._chatLineHelper("pamod", data.pamod.value),
            this._chatLineHelper("reach", game.i18n.localize(`Range-${data.reach.value}`)),
            this._chatLineHelper("TYPES.Item.combatskill", data.combatskill.value),
        ]
        if (data.effect.value != "") res.push(this._chatLineHelper(DSA5_Utility.replaceConditions("effect", data.effect.value)))

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        let wrongHandDisabled = AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize("LocalizedIDs.ambidextrous"))
        source = DSA5_Utility.toObjectIfPossible(source)

        let toSearch = [source.system.combatskill.value]
        let combatskills = Itemdsa5.buildCombatSpecAbs(actor, ["Combat"], toSearch, data.mode)

        if (data.mode == "attack") {
            this.prepareMeleeAttack(situationalModifiers, actor, data, source, combatskills, wrongHandDisabled)
        } else if (data.mode == "parry") {
            this.prepareMeleeParry(situationalModifiers, actor, data, source, combatskills, wrongHandDisabled)
        }
        this.attackStatEffect(situationalModifiers, actor.system.meleeStats[data.mode])

        if (["attack", "parry"].includes(data.mode)) situationalModifiers.push(...MeleeweaponDSA5.getMiracleModifiers(actor, { name: source.system.combatskill.value }, "", data.mode))
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = item.name + " " + game.i18n.localize(mode + "test")

        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }
        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, DSA5_Utility.toObjectIfPossible(item))
        let data = {
            rollMode: options.rollMode,
            mode,
            defenseCountString: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
        }
        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data.situationalModifiers = situationalModifiers
        if(options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers)

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode)
                Hooks.call("callbackDialogCombatDSA5", testData, actor, html, item, tokenId)
                testData.isRangeDefense = data.isRangeDefense
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class PoisonItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [
            this._chatLineHelper("stepValue", data.step.value),
            this._chatLineHelper("poisonType", data.poisonType.value),
            this._chatLineHelper("start", data.start.value),
            this._chatLineHelper("duration", data.duration.value),
            this._chatLineHelper("resistanceModifier", data.resistance.value),
            this._chatLineHelper("effect", DSA5_Utility.replaceConditions(DSA5_Utility.replaceDies(data.effect.value))),
        ]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        source = DSA5_Utility.toObjectIfPossible(source)
        if (game.user.targets.size) {
            game.user.targets.forEach((target) => {
                if (target.actor)
                    situationalModifiers.push(
                        ...AdvantageRulesDSA5.getVantageAsModifier(
                            target.actor,
                            game.i18n.localize("LocalizedIDs.poisonResistance"), -1,
                            false,
                            true
                        )
                    )
            })
        }
        this.getSkZkModifier(data, source)
        mergeObject(data, {
            hasSKModifier: source.system.resistance.value == "SK",
            hasZKModifier: source.system.resistance.value == "ZK",
        })
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let title = item.name + " " + game.i18n.localize(item.type) + " " + game.i18n.localize("Test")

        let testData = {
            opposable: false,
            source: item,
            extra: {
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }

        let data = {
            rollMode: options.rollMode,
        }

        let situationalModifiers = []
        this.getSituationalModifiers(situationalModifiers, actor, data, item)
        data.situationalModifiers = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/poison-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                testData.situationalModifiers = Actordsa5._parseModifiers(html)

                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0,
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0,
                })
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = item._setupCardOptions(`systems/dsa5/templates/chat/roll/${item.type}-card.html`, title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class RangeweaponItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = [
            this._chatLineHelper("damage", data.damage.value),
            this._chatLineHelper("TYPES.Item.combatskill", data.combatskill.value),
            this._chatLineHelper("reach", data.reach.value),
        ]
        if (data.effect.value != "") res.push(this._chatLineHelper(DSA5_Utility.replaceConditions("effect", data.effect.value)))

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, _source, tokenId) {
        if (data.mode == "attack") {
            const source = DSA5_Utility.toObjectIfPossible(_source)

            const toSearch = [source.system.combatskill.value]
            const combatskills = Itemdsa5.buildCombatSpecAbs(actor, ["Combat"], toSearch, data.mode)
            let currentAmmo = actor.items.get(source.system.currentAmmo.value)

            if (currentAmmo) {
                currentAmmo = currentAmmo.toObject(false)
                source.system.effect.attributes = (source.system.effect.attributes || "")
                    .split(",")
                    .concat((currentAmmo.system.effect.attributes || "").split(","))
                    .filter((x) => x != "")
                    .join(",")
                const poison = getProperty(currentAmmo.flags, "dsa5.poison")
                if (poison) mergeObject(_source.flags, { dsa5: { poison } })
            }

            this.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatskills, currentAmmo)

            if (currentAmmo) {
                if (currentAmmo.system.atmod) {
                    situationalModifiers.push({
                        name: `${currentAmmo.name} - ${game.i18n.localize("atmod")}`,
                        value: currentAmmo.system.atmod,
                        selected: true,
                        specAbId: source.system.currentAmmo.value,
                    })
                }
                if (currentAmmo.system.damageMod || currentAmmo.system.armorMod) {
                    const dmgMod = {
                        name: `${currentAmmo.name} - ${game.i18n.localize("MODS.damage")}`,
                        value: currentAmmo.system.damageMod.replace(/wWD/g, "d") || 0,
                        type: "dmg",
                        selected: true,
                        specAbId: source.system.currentAmmo.value,
                    }
                    if (currentAmmo.system.armorMod) dmgMod["armorPen"] = currentAmmo.system.armorMod
                    situationalModifiers.push(dmgMod)
                }
                if(currentAmmo.effects.length){
                    situationalModifiers.push({
                        name: `${currentAmmo.name} - ${game.i18n.localize("TYPES.Item.ammunition")}`,
                        value: 1,
                        type: 'effect',
                        selected: true,
                        specAbId: source.system.currentAmmo.value,
                    })
                }
            }
            situationalModifiers.push(...RangeweaponItemDSA5.getMiracleModifiers(actor, { name: source.system.combatskill.value }, "", data.mode))
        }
        this.attackStatEffect(situationalModifiers, actor.system.rangeStats[data.mode])
    }

    static async checkAmmunitionState(item, testData, actor, mode) {
        let hasAmmo = true
        if (mode != "damage") {
            let itemData = item.system
            if (itemData.ammunitiongroup.value == "infinite") {
                //Dont count ammo
            } else if (itemData.ammunitiongroup.value == "-") {
                testData.extra.ammo = duplicate(item)
                hasAmmo = testData.extra.ammo.system.quantity.value > 0
            } else {
                const ammoItem = actor.items.get(itemData.currentAmmo.value)
                if (ammoItem) {
                    testData.extra.ammo = ammoItem.toObject()
                    if (itemData.ammunitiongroup.value == "mag") {
                        hasAmmo = testData.extra.ammo.system.quantity.value > 1 || (testData.extra.ammo.system.mag.value > 0 && testData.extra.ammo.system.quantity.value > 0)

                    } else {
                        hasAmmo = testData.extra.ammo.system.quantity.value > 0
                    }
                } else {
                    hasAmmo = false
                }
            }
            if(!hasAmmo && actor.type == "creature") hasAmmo = true
        }
        if (!hasAmmo) ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))

        return hasAmmo
    }

    static async setupDialog(ev, options, item, actor, tokenId) {
        let mode = options.mode
        let title = item.name + " " + game.i18n.localize(mode + "test")

        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }

        if (!(await this.checkAmmunitionState(item, testData, actor, mode))) return

        let data = {
            rollMode: options.rollMode,
            mode,
        }
        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item, tokenId)
        data.situationalModifiers = situationalModifiers
        if(options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers)

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                DSA5CombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options)
                Hooks.call("callbackDialogCombatDSA5", testData, actor, html, item, tokenId)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class RitualItemDSA5 extends SpellItemDSA5 {
    static getCallbackData(testData, html, actor) {
        super.getCallbackData(testData, html, actor)
        testData.situationalModifiers.push({
            name: game.i18n.localize("RITUALMODIFIER.rightClothes"),
            value: html.find('[name="rightClothes"]').is(":checked") ? 1 : 0,
        }, {
            name: game.i18n.localize("RITUALMODIFIER.rightEquipment"),
            value: html.find('[name="rightEquipment"]').is(":checked") ? 1 : 0,
        }, {
            name: game.i18n.localize("place"),
            value: html.find('[name="placeModifier"]').val(),
        }, {
            name: game.i18n.localize("time"),
            value: html.find('[name="timeModifier"]').val(),
        })
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        super.getSituationalModifiers(situationalModifiers, actor, data, source)

        mergeObject(data, {
            isRitual: true,
            locationModifiers: DSA5.ritualLocationModifiers,
            timeModifiers: DSA5.ritualTimeModifiers,
        })
    }
}

class SkillItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("Description", game.i18n.localize(`SKILLdescr.${name}`))]
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source) {
        situationalModifiers.push(
            ...ItemRulesDSA5.getTalentBonus(actor, source.name, ["advantage", "disadvantage", "specialability", "equipment"]),
            ...actor.getSkillModifier(source.name, source.type),
            ...SkillItemDSA5.getMiracleModifiers(actor, source, "FW", "skill")
        )

        for (const thing of actor.system.skillModifiers.global) {
            situationalModifiers.push({ name: thing.source, value: thing.value })
        }
    }

    static setupDialog(ev, options, skill, actor, tokenId) {
        let title = skill.name + " " + game.i18n.localize("Test") + (options.subtitle || "")
        let testData = {
            opposable: true,
            source: skill,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }

        let data = {
            rollMode: options.rollMode,
            difficultyLabels: DSA5.skillDifficultyLabels,
            modifier: options.modifier || 0,
            characteristics: [1, 2, 3].map((x) => skill.system[`characteristic${x}`].value),
            situationalModifiers: actor ? DSA5StatusEffects.getRollModifiers(actor, skill) : []
        }

        if(options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers)
        this.getSituationalModifiers(data.situationalModifiers, actor, data, skill)

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/skill-dialog.html",
            data,
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val()
                testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()]
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.advancedModifiers = {
                    chars: [0, 1, 2].map((x) => Number(html.find(`[name="ch${x}"]`).val())),
                    fws: Number(html.find(`[name="fw"]`).val()),
                    qls: Number(html.find(`[name="qs"]`).val()),
                }
                Itemdsa5.changeChars(testData.source, ...[0, 1, 2].map((x) => html.find(`[name="characteristics${x}"]`).val()))
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/skill-card.html", title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class SpecialAbilityItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("rule", data.rule.value)]
    }
}

class SpeciesItemDSA5 extends Itemdsa5 {}

class SpellextensionItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("source", data.source), this._chatLineHelper("Category", game.i18n.localize(data.category))]
    }
}

class TraitItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        let res = []
        switch (data.traitType.value) {
            case "meleeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value),
                ]
                break
            case "rangeAttack":
                res = [
                    this._chatLineHelper("attack", data.at.value),
                    this._chatLineHelper("damage", data.damage.value),
                    this._chatLineHelper("reach", data.reach.value),
                    this._chatLineHelper("reloadTime", data.reloadTime.value),
                ]
                break
            case "armor":
                res = [this._chatLineHelper("protection", data.damage.value)]
                break
            case "general":
                res = []
                break
            case "familiar":
                res = [
                    this._chatLineHelper("APValue", data.APValue.value),
                    this._chatLineHelper("AsPCost", data.AsPCost.value),
                    this._chatLineHelper("duration", data.duration.value),
                    this._chatLineHelper("aspect", data.aspect.value),
                ]
                break
            case "trick":
                res = [this._chatLineHelper("APValue", data.APValue.value)]
                break
            case "entity":
                res = [
                    this._chatLineHelper("distribution", data.distribution),
                    this._chatLineHelper("CHARAbbrev.QL", data.AsPCost.value),
                ]
                break
            case "summoning":
                res = [
                    this._chatLineHelper("distribution", data.distribution),
                    this._chatLineHelper("conjuringDifficulty", data.at.value),
                ]
                break
        }
        if (data.effect.value != "") res.push(this._chatLineHelper("effect", data.effect.value))

        return res
    }

    static getSituationalModifiers(situationalModifiers, actor, data, source, tokenId) {
        source = DSA5_Utility.toObjectIfPossible(source)
        const traitType = source.system.traitType.value
        const combatskills = Itemdsa5.buildCombatSpecAbs(actor, ["Combat", "animal"], undefined, data.mode)

        if (data.mode == "attack" && traitType == "meleeAttack") {
            this.prepareMeleeAttack(situationalModifiers, actor, data, source, combatskills, false)
        } else if (data.mode == "attack" && traitType == "rangeAttack") {
            this.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatskills)
        } else if (data.mode == "parry") {
            this.prepareMeleeParry(situationalModifiers, actor, data, source, combatskills, false)
        }

        this.attackStatEffect(
            situationalModifiers,
            actor.system[traitType == "meleeAttack" ? "meleeStats" : "rangeStats"][data.mode]
        )
    }

    static setupDialog(ev, options, item, actor, tokenId) {
        let mode = options["mode"]
        let title = item.name + " " + game.i18n.localize(mode + "test")
        let testData = {
            opposable: true,
            source: item,
            mode,
            extra: {
                actor: actor.toObject(false),
                options,
                speaker: Itemdsa5.buildSpeaker(actor, tokenId),
            },
        }
        const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, item.toObject())
        let data = {
            rollMode: options.rollMode,
            mode,
            defenseCountString: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
        }

        const traitType = getProperty(item, "system.traitType.value")

        let situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : []
        this.getSituationalModifiers(situationalModifiers, actor, data, item, tokenId)
        data["situationalModifiers"] = situationalModifiers

        let dialogOptions = {
            title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data,
            callback: (html, options = {}) => {
                if (traitType == "meleeAttack") {
                    DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode)
                } else {
                    DSA5CombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options)
                }
                testData.isRangeDefense = data.isRangeDefense
                Hooks.call("callbackDialogCombatDSA5", testData, actor, html, item, tokenId)
                return { testData, cardOptions }
            },
        }

        let cardOptions = actor._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title, tokenId)

        return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions })
    }
}

class VantageItemDSA5 extends Itemdsa5 {
    static chatData(data, name) {
        return [this._chatLineHelper("effect", data.effect.value)]
    }
}
