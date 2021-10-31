import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"
import OpposedDsa5 from "../system/opposed-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js"
import Itemdsa5 from "../item/item-dsa5.js";
import TraitRulesDSA5 from "../system/trait-rules-dsa5.js";
import RuleChaos from "../system/rule_chaos.js";
import { tinyNotification } from "../system/view_helper.js";
import EquipmentDamage from "../system/equipment-damage.js";

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return await super.create(data, options);

        if (data.items)
            return await super.create(data, options);

        data.items = [];
        //if (!data.flags) data.flags = []

        if (!data.img || data.img == "icons/svg/mystery-man.svg")
            data.img = "icons/svg/mystery-man-black.svg"

        const skills = await DSA5_Utility.allSkills() || [];
        const combatskills = await DSA5_Utility.allCombatSkills() || [];
        const moneyItems = await DSA5_Utility.allMoneyItems() || [];

        data.items.push(...skills, ...combatskills, ...moneyItems);

        if (data.type != "character")
            data.data = { status: { fatePoints: { current: 0, value: 0 } } }

        if (data.type != "creature" && [undefined, 0].includes(getProperty(data, "data.status.wounds.value")))
            mergeObject(data, { data: { status: { wounds: { value: 16 } } } })

        return await super.create(data, options);
    }

    prepareDerivedData() {
        const data = this.data
        try {
            let itemModifiers = {}
            let compensation = SpecialabilityRulesDSA5.hasAbility(this.data, game.i18n.localize('LocalizedIDs.inuredToEncumbrance'))
            for (let i of data.items.filter(x => (["meleeweapon", "rangeweapon", "armor", "equipment"].includes(x.type) && getProperty(x.data, "data.worn.value")) || ["advantage", "specialability", "disadvantage"].includes(x.type))) {
                compensation = this._addGearAndAbilityModifiers(itemModifiers, i, compensation)
            }
            data.itemModifiers = this._applyModiferTransformations(itemModifiers)

            for (let ch of Object.values(data.data.characteristics)) {
                ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
                ch.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E") })
                ch.refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E", 0) })
            }

            //We should iterate at some point over the items to prevent multiple loops

            const isFamiliar = RuleChaos.isFamiliar(data)
            const isPet = RuleChaos.isPet(data)
            data.canAdvance = (data.type == "character" || isFamiliar || isPet) && this.isOwner
            data.isMage = isFamiliar || data.items.some(x => ["ritual", "spell", "magictrick"].includes(x.type) || (x.type == "specialability" && ["magical", "staff"].includes(x.data.data.category.value)))
            data.isPriest = data.items.some(x => ["ceremony", "liturgy", "blessing"].includes(x.type) || (x.type == "specialability" && ["ceremonial", "clerical"].includes(x.data.data.category.value)))
            if (data.canAdvance) {
                data.data.details.experience.current = data.data.details.experience.total - data.data.details.experience.spent;
                data.data.details.experience.description = DSA5_Utility.experienceDescription(data.data.details.experience.total)
            }

            if (data.type == "character" || data.type == "npc") {
                data.data.status.wounds.current = data.data.status.wounds.initial + data.data.characteristics.ko.value * 2
                data.data.status.soulpower.value = (data.data.status.soulpower.initial || 0) + Math.round((data.data.characteristics.mu.value + data.data.characteristics.kl.value + data.data.characteristics.in.value) / 6)
                data.data.status.toughness.value = (data.data.status.toughness.initial || 0) + Math.round((data.data.characteristics.ko.value + data.data.characteristics.ko.value + data.data.characteristics.kk.value) / 6)
                data.data.status.initiative.value = Math.round((data.data.characteristics.mu.value + data.data.characteristics.ge.value) / 2) + (data.data.status.initiative.modifier || 0)
            }

            data.data.status.fatePoints.max = Number(data.data.status.fatePoints.current) + Number(data.data.status.fatePoints.modifier) + data.data.status.fatePoints.gearmodifier

            if (data.type == "creature") {
                data.data.status.wounds.current = data.data.status.wounds.initial
                data.data.status.astralenergy.current = data.data.status.astralenergy.initial
                data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial
                data.data.status.initiative.value = data.data.status.initiative.current + (data.data.status.initiative.modifier || 0)
            }

            data.data.status.wounds.max = data.data.status.wounds.current + data.data.status.wounds.modifier + data.data.status.wounds.advances + data.data.status.wounds.gearmodifier
            data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances + data.data.status.astralenergy.gearmodifier
            data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances + data.data.status.karmaenergy.gearmodifier

            data.data.status.regeneration.LePmax = data.data.status.regeneration.LePTemp + data.data.status.regeneration.LePMod
            data.data.status.regeneration.KaPmax = data.data.status.regeneration.KaPTemp + data.data.status.regeneration.KaPMod
            data.data.status.regeneration.AsPmax = data.data.status.regeneration.AsPTemp + data.data.status.regeneration.AsPMod

            let guide = data.data.guidevalue
            if (isFamiliar || (guide && data.type != "creature")) {
                data.data.status.astralenergy.current = data.data.status.astralenergy.initial
                data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial

                if (data.data.characteristics[guide.magical])
                    data.data.status.astralenergy.current += Math.round(data.data.characteristics[guide.magical].value * data.data.energyfactor.magical)

                if (data.data.characteristics[guide.clerical])
                    data.data.status.karmaenergy.current += Math.round(data.data.characteristics[guide.clerical].value * data.data.energyfactor.clerical)

                data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances + data.data.status.astralenergy.gearmodifier
                data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances + data.data.status.karmaenergy.gearmodifier
            }

            data.data.status.speed.max = data.data.status.speed.initial + (data.data.status.speed.modifier || 0) + data.data.status.speed.gearmodifier
            data.data.status.soulpower.max = data.data.status.soulpower.value + data.data.status.soulpower.modifier + data.data.status.soulpower.gearmodifier
            data.data.status.toughness.max = data.data.status.toughness.value + data.data.status.toughness.modifier + data.data.status.toughness.gearmodifier
            data.data.status.dodge.value = Math.round(data.data.characteristics.ge.value / 2) + data.data.status.dodge.gearmodifier

            let encumbrance = this.hasCondition('encumbered')
            encumbrance = encumbrance ? Number(encumbrance.data.flags.dsa5.value) : 0

            data.data.status.speed.max = Math.max(0, data.data.status.speed.max - (Math.min(4, encumbrance)))

            data.data.status.initiative.value += data.data.status.initiative.gearmodifier
            data.data.status.initiative.value -= (Math.min(4, encumbrance))
            const baseInit = Number((0.01 * data.data.status.initiative.value).toFixed(2))
            data.data.status.initiative.value *= data.data.status.initiative.multiplier || 1
            data.data.status.initiative.value += baseInit

            data.data.status.dodge.max = Number(data.data.status.dodge.value) + Number(data.data.status.dodge.modifier) + (Number(game.settings.get("dsa5", "higherDefense")) / 2)

            //Prevent double update with multiple GMs, still unsafe
            const activeGM = game.users.find(u => u.active && u.isGM)

            if (activeGM && game.user.id == activeGM.id) {
                const hasDefaultPain = data.type != "creature" || data.data.status.wounds.max >= 20
                let pain = 0
                if (data.data.status.wounds.max > 0) {
                    if (hasDefaultPain) {
                        pain = Math.floor((1 - data.data.status.wounds.value / data.data.status.wounds.max) * 4)
                        if (data.data.status.wounds.value <= 5) pain = 4
                    } else {
                        pain = Math.floor(5 - 5 * data.data.status.wounds.value / data.data.status.wounds.max)
                    }

                    if (pain < 4) pain -= AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.ruggedFighter')) - AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.ruggedAnimal')) + (SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize('LocalizedIDs.traditionKor')) ? 1 : 0)
                    if (pain > 0) pain += AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.sensitiveToPain')) + AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.fragileAnimal'))

                    pain = Math.max(Math.min(4, pain), 0)
                }

                const changePain = data.pain != pain
                data.pain = pain

                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.blind'))) this.addCondition("blind")
                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.mute'))) this.addCondition("mute")
                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.deaf'))) this.addCondition("deaf")
                if (!TraitRulesDSA5.hasTrait(this, game.i18n.localize('LocalizedIDs.painImmunity')) && changePain) this.addCondition("inpain", pain, true).then(() => data.pain = undefined)

                if (this.isMerchant()) { this.prepareMerchant() }

                data.data.status.speed.max = Math.max(0, data.data.status.speed.max - pain)
            }

            let paralysis = this.hasCondition("paralysed")
            if (paralysis)
                data.data.status.speed.max = Math.round(data.data.status.speed.max * (1 - paralysis.data.flags.dsa5.value * 0.25))
            if (this.hasCondition("fixated")) {
                data.data.status.speed.max = 0
                data.data.status.dodge.max = Math.max(0, data.data.status.dodge.max - 4)
            } else if (this.hasCondition("rooted") || this.hasCondition("incapacitated"))
                data.data.status.speed.max = 0
            else if (this.hasCondition("prone"))
                data.data.status.speed.max = Math.min(1, data.data.status.speed.max)


        } catch (error) {
            console.error("Something went wrong with preparing actor data: " + error + error.stack)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error + error.stack)
        }
    }

    async prepareMerchant() {
        if (getProperty(this, "data.data.merchant.merchantType") == "loot") {
            if (getProperty(this, "data.data.merchant.locked") && !this.hasCondition("locked")) {
                await this.addCondition(Actordsa5.lockedCondition())
            } else if (!getProperty(this, "data.data.merchant.locked")) {
                let ef = this.effects.find(x => getProperty(x, "data.flags.core.statusId") == "locked")
                if (ef) await this.deleteEmbeddedDocuments("ActiveEffect", [ef.id])
            }
        }
    }

    static lockedCondition() {
        return {
            label: game.i18n.localize("MERCHANT.locked"),
            icon: "icons/svg/padlock.svg",

            flags: {
                core: { statusId: "locked" },
                dsa5: {
                    value: null,
                    editable: true,
                    noEffect: true,
                    hidePlayers: true,
                    description: game.i18n.localize("MERCHANT.locked"),
                    custom: true
                }
            }
        }
    }

    applyActiveEffects() {
        const overrides = {};

        const changes = this.effects.reduce((changes, e) => {
            if (e.data.disabled) return changes;

            if (e.data.origin) {
                const id = e.data.origin.match(/[^.]+$/)[0]
                let item = this.items.get(id)
                if (item) {
                    let apply = true
                    switch (item.data.type) {
                        case "meleeweapon":
                        case "rangeweapon":
                        case "armor":
                            apply = item.data.data.worn.value
                            break
                        case "equipment":
                            apply = (item.data.data.worn.wearable && item.data.data.worn.value) || !item.data.data.worn.wearable
                            break
                        case "ammunition":
                        case "plant":
                        case "consumable":
                        case "combatskill":
                        case "poison":
                        case "spell":
                        case "liturgy":
                        case "ceremony":
                        case "ritual":
                            apply = false
                            break
                        case "specialability":
                            apply = item.data.data.category.value != "Combat"
                            break
                    }
                    e.notApplicable = !apply

                    if (!apply) return changes;
                }
            }

            return changes.concat(e.data.changes.map(c => {
                c = foundry.utils.duplicate(c);
                c.effect = e;
                c.priority = c.priority ? c.priority : (c.mode * 10);
                return c;
            }));
        }, []);
        changes.sort((a, b) => a.priority - b.priority);

        for (let change of changes) {
            const result = change.effect.apply(this, change);
            if (result !== null) overrides[change.key] = result;
        }

        this.overrides = foundry.utils.expandObject(overrides);
    }

    prepareBaseData() {
        const data = this.data;

        mergeObject(data, {
            data: {
                skillModifiers: {
                    FP: [],
                    step: [],
                    QL: [],
                    TPM: [],
                    FW: [],
                    botch: 20,
                    crit: 1,
                    global: [],
                    liturgy: {
                        FP: [],
                        step: [],
                        QL: [],
                        TPM: [],
                        FW: []
                    },
                    ceremony: {
                        FP: [],
                        step: [],
                        QL: [],
                        TPM: [],
                        FW: []
                    },
                    ritual: {
                        FP: [],
                        step: [],
                        QL: [],
                        TPM: [],
                        FW: []
                    },
                    spell: {
                        FP: [],
                        step: [],
                        QL: [],
                        TPM: [],
                        FW: []
                    },
                    skill: {
                        FP: [],
                        step: [],
                        QL: [],
                        TPM: [],
                        FW: []
                    }
                },
                status: {
                    initiative: {
                        multiplier: 1
                    }
                },
                totalArmor: 0,
                carryModifier: 0,
                aspModifier: 0,
                kapModifier: 0,
                immunities: [],
                meleeStats: {
                    parry: 0,
                    attack: 0,
                    damage: "0",
                    defenseMalus: 0,
                    botch: 20,
                    crit: 1
                },
                rangeStats: {
                    attack: 0,
                    damage: "0",
                    defenseMalus: 0,
                    botch: 20,
                    crit: 1
                }
            }
        })

        for (const k of DSA5.gearModifyableCalculatedAttributes)
            if (data.data.status[k]) data.data.status[k].gearmodifier = 0

        for (let ch of Object.values(data.data.characteristics))
            ch.gearmodifier = 0

    }

    getSkillModifier(name, sourceType) {
        let result = []
        const keys = ["FP", "step", "QL", "TPM", "FW"]
        for (const k of keys) {
            const type = k == "step" ? "" : k
            result.push(...this.data.data.skillModifiers[k].filter(x => x.target == name).map((f) => {
                return {
                    name: f.source,
                    value: f.value,
                    type
                }
            }))
            if (this.data.data.skillModifiers[sourceType]) {
                result.push(...this.data.data.skillModifiers[sourceType][k].map((f) => {
                    return {
                        name: f.source,
                        value: f.value,
                        type
                    }
                }))
            }
        }
        return result
    }

    prepareSheet(sheetInfo) {
        let preData = duplicate(this.data)
        let preparedData = { data: {} }
        mergeObject(preparedData, this.prepareItems(sheetInfo))
        if (preparedData.canAdvance) {
            const attrs = ["wounds", "astralenergy", "karmaenergy"]
            for (const k of attrs) {
                mergeObject(preparedData.data, {
                    status: {
                        [k]: {
                            cost: game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(preData.data.status[k].advances, "D") }),
                            refund: game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(preData.data.status[k].advances, "D", 0) })
                        }
                    }
                })
            }
        }

        return preparedData;
    }

    static canAdvance(actorData) {
        return actorData.canAdvance
    }

    static armorValue(actor) {
        const wornArmor = actor.items.filter(x => x.type == "armor" && x.data.data.worn.value == true).reduce((a, b) => a + EquipmentDamage.armorWearModifier(b.data, b.data.data.protection.value), 0)
        const animalArmor = actor.items.filter(x => x.type == "trait" && x.data.data.traitType.value == "armor").reduce((a, b) => a + Number(b.data.data.at.value), 0)
        return wornArmor + animalArmor + (actor.data.totalArmor || 0)
    }

    static _calculateCombatSkillValues(i, actorData) {
        if (i.data.weapontype.value == "melee") {
            const vals = i.data.guidevalue.value.split('/').map(x =>
                Number(actorData.data.characteristics[x].initial) + Number(actorData.data.characteristics[x].modifier) + Number(actorData.data.characteristics[x].advances) + Number(actorData.data.characteristics[x].gearmodifier)
            );
            const parryChar = Math.max(...vals);
            i.data.parry.value = Math.ceil(i.data.talentValue.value / 2) + Math.max(0, Math.floor((parryChar - 8) / 3)) + Number(game.settings.get("dsa5", "higherDefense"))
            const attackChar = actorData.data.characteristics.mu.initial + actorData.data.characteristics.mu.modifier + actorData.data.characteristics.mu.advances + actorData.data.characteristics.mu.gearmodifier;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        } else {
            i.data.parry.value = 0;
            let attackChar = actorData.data.characteristics.ff.initial + actorData.data.characteristics.ff.modifier + actorData.data.characteristics.ff.advances + actorData.data.characteristics.ff.gearmodifier;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        }
        i.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(i.data.talentValue.value, i.data.StF.value) })
        i.canAdvance = Actordsa5.canAdvance(actorData)
        return i;
    }

    _perpareItemAdvancementCost(item) {
        item.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(item.data.talentValue.value, item.data.StF.value) })
        item.refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(item.data.talentValue.value, item.data.StF.value, 0) })
        item.canAdvance = Actordsa5.canAdvance(this.data)
        return item
    }

    prepareItems(sheetInfo) {
        let actorData = this.toObject(false)
        let combatskills = [];
        let advantages = [];
        let disadvantages = []
        let aggregatedtests = []

        const specAbs = Object.fromEntries(Object.keys(DSA5.specialAbilityCategories).map(x => [x, []]))
        const traits = Object.fromEntries(Object.keys(DSA5.traitCategories).map(x => [x, []]))

        let armor = [];
        let rangeweapons = [];
        let meleeweapons = [];

        const magic = {
            hasSpells: this.data.isMage,
            hasPrayers: this.data.isPriest,
            liturgy: [],
            spell: [],
            ritual: [],
            ceremony: [],
            blessing: [],
            magictrick: []
        }

        const extensions = {
            spell: {},
            ritual: {},
            ceremony: {},
            liturgy: {}
        }

        let schips = []
        for (let i = 1; i <= Number(actorData.data.status.fatePoints.max); i++) {
            schips.push({
                value: i,
                cssClass: i <= Number(actorData.data.status.fatePoints.value) ? "fullSchip" : "emptySchip"
            })
        }

        const inventory = {
            meleeweapons: {
                items: [],
                show: false,
                dataType: "meleeweapon"
            },
            rangeweapons: {
                items: [],
                show: false,
                dataType: "rangeweapon"
            },
            armor: {
                items: [],
                show: false,
                dataType: "armor"
            },
            ammunition: {
                items: [],
                show: false,
                dataType: "ammunition"
            },
            plant: {
                items: [],
                show: false,
                dataType: "plant"
            },
            poison: {
                items: [],
                show: false,
                dataType: "poison"
            }
        };

        for (let t in DSA5.equipmentTypes) {
            inventory[t] = {
                items: [],
                show: false,
                dataType: t
            }
        }

        inventory["misc"].show = true

        const money = {
            coins: [],
            total: 0,
            show: true
        }

        actorData.items = actorData.items.sort((a, b) => { return a.name.localeCompare(b.name) })

        //we can later make equipment sortable
        //actorData.items = actorData.items.sort((a, b) => (a.sort || 0) - (b.sort || 0))

        let totalArmor = actorData.data.totalArmor || 0;
        let totalWeight = 0;

        let skills = {
            body: [],
            social: [],
            knowledge: [],
            trade: [],
            nature: []
        }

        let containers = new Map()
        for (let container of actorData.items.filter(x => x.type == "equipment" && x.data.equipmentType.value == "bags")) {
            containers.set(container._id, [])
        }

        let applications = new Map()
        let availableAmmunition = []

        for (let i of actorData.items) {
            try {
                let parent_id = getProperty(i, "data.parent_id")
                if (i.type == "ammunition") availableAmmunition.push(Actordsa5._prepareitemStructure(i));

                if (parent_id && parent_id != i._id) {
                    if (containers.has(parent_id)) {
                        containers.get(parent_id).push(i)
                        continue
                    }
                }
                if (sheetInfo.details && sheetInfo.details.includes(i._id)) i.detailed = "shown"

                switch (i.type) {
                    case "application":
                        if (applications.has(i.data.skill)) applications.get(i.data.skill).push(i)
                        else applications.set(i.data.skill, [i])
                        break
                    case "skill":
                        skills[i.data.group.value].push(this._perpareItemAdvancementCost(i))
                        break;
                    case "aggregatedTest":
                        aggregatedtests.push(i)
                        break
                    case "spellextension":
                        if (extensions[i.data.category][i.data.source]) {
                            extensions[i.data.category][i.data.source].push(i.name)
                        } else {
                            extensions[i.data.category][i.data.source] = [i.name]
                        }
                        break
                    case "ritual":
                    case "spell":
                    case "liturgy":
                    case "ceremony":
                        magic[i.type].push(Actordsa5.buildSpellChargeProgress(this._perpareItemAdvancementCost(i)))
                        break;
                    case "magictrick":
                    case "blessing":
                        magic[i.type].push(i)
                        break;
                    case "trait":
                        switch (i.data.traitType.value) {
                            case "rangeAttack":
                                i = Actordsa5._prepareRangeTrait(i)
                                break
                            case "meleeAttack":
                                i = Actordsa5._prepareMeleetrait(i)
                                break
                            case "armor":
                                totalArmor += Number(i.data.at.value);
                                break
                        }
                        traits[i.data.traitType.value].push(i)
                        break
                    case "combatskill":
                        combatskills.push(Actordsa5._calculateCombatSkillValues(i, this.data));
                        break;
                    case "ammunition":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory.ammunition.items.push(i)
                        inventory.ammunition.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "meleeweapon":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        i.toggleValue = i.data.worn.value || false;
                        i.toggle = true
                        inventory.meleeweapons.items.push(Actordsa5._prepareitemStructure(i));
                        inventory.meleeweapons.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "rangeweapon":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        i.toggleValue = i.data.worn.value || false;
                        i.toggle = true
                        inventory.rangeweapons.items.push(Actordsa5._prepareitemStructure(i));
                        inventory.rangeweapons.show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "armor":
                        i.toggleValue = i.data.worn.value || false;
                        inventory.armor.items.push(Actordsa5._prepareitemStructure(i));
                        inventory.armor.show = true;
                        i.toggle = true
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        totalWeight += parseFloat((i.data.weight.value * (i.toggleValue ? Math.max(0, i.data.quantity.value - 1) : i.data.quantity.value)).toFixed(3))

                        if (i.data.worn.value) {
                            i.data.protection.value = EquipmentDamage.armorWearModifier(i, i.data.protection.value)
                            totalArmor += Number(i.data.protection.value);
                            armor.push(i);
                        }
                        break;
                    case "plant":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory["plant"].items.push(i);
                        inventory["plant"].show = true;
                        totalWeight += Number(i.weight);
                        break
                    case "poison":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory["poison"].items.push(i);
                        inventory["poison"].show = true;
                        totalWeight += Number(i.weight);
                        break
                    case "consumable":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        inventory[i.data.equipmentType.value].items.push(Actordsa5._prepareConsumable(i));
                        inventory[i.data.equipmentType.value].show = true;
                        totalWeight += Number(i.weight);
                        break
                    case "equipment":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        i.toggle = getProperty(i, "data.worn.wearable") || false

                        if (i.toggle) i.toggleValue = i.data.worn.value || false

                        inventory[i.data.equipmentType.value].items.push(Actordsa5._prepareitemStructure(i));
                        inventory[i.data.equipmentType.value].show = true;
                        totalWeight += Number(i.weight);
                        break;
                    case "money":
                        i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                        money.coins.push(i);
                        totalWeight += Number(i.weight);
                        money.total += i.data.quantity.value * i.data.price.value;
                        break;
                    case "advantage":
                        advantages.push(i)
                        break;
                    case "disadvantage":
                        disadvantages.push(i)
                        break;
                    case "specialability":
                        specAbs[i.data.category.value].push(i)
                        break;
                }

            } catch (error) {
                this._itemPreparationError(i, error)
            }
        }

        for (let elem of inventory.bags.items) {
            totalWeight += this._setBagContent(elem, containers)
        }

        for (let [category, value] of Object.entries(extensions)) {
            for (let [spell, exts] of Object.entries(value)) {
                magic[category].find(x => x.name == spell).extensions = exts.join(", ")
            }
        }

        for (let wep of inventory.rangeweapons.items) {
            try {
                if (wep.data.worn.value) rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, availableAmmunition, combatskills, this));
            } catch (error) {
                this._itemPreparationError(wep, error)
            }
        }

        let wornweapons = inventory.meleeweapons.items.filter(x => x.data.worn.value)
        let regex2h = /\(2H/

        for (let wep of wornweapons) {
            try {
                meleeweapons.push(Actordsa5._prepareMeleeWeapon(wep, combatskills, actorData, wornweapons.filter(x => x._id != wep._id && !regex2h.test(x.name))))
            } catch (error) {
                this._itemPreparationError(wep, error)
            }
        }

        for (let [key, value] of Object.entries(skills)) {
            for (let skill of value) {
                skill.applications = applications.get(skill.name) || []
            }
        }

        money.coins = money.coins.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        const carrycapacity = actorData.data.characteristics.kk.value * 2 + actorData.data.carryModifier;
        //TODO move the encumbrance calculation to a better location
        let encumbrance = this.getArmorEncumbrance(this.data, armor)

        if ((actorData.type != "creature" || this.data.canAdvance) && !this.isMerchant()) {
            encumbrance += Math.max(0, Math.ceil((totalWeight - carrycapacity - 4) / 4))
        }
        this.addCondition("encumbered", encumbrance, true)

        totalWeight = parseFloat(totalWeight.toFixed(3))

        specAbs.magical.push(...specAbs.staff, ...specAbs.pact)
        specAbs.clerical.push(...specAbs.ceremonial)

        let guidevalues = duplicate(DSA5.characteristics)
        guidevalues["-"] = "-"


        return {
            isOwner: this.isOwner,
            totalWeight,
            armorSum: totalArmor,
            money,
            encumbrance,
            carrycapacity,
            wornRangedWeapons: rangeweapons,
            wornMeleeWeapons: meleeweapons,
            advantages,
            disadvantages,
            specAbs,
            aggregatedtests,
            wornArmor: armor,
            inventory,
            itemModifiers: this.data.itemModifiers,
            languagePoints: {
                used: actorData.data.freeLanguagePoints ? actorData.data.freeLanguagePoints.used : 0,
                available: actorData.data.freeLanguagePoints ? actorData.data.freeLanguagePoints.value : 0
            },
            schips,
            guidevalues,
            magic,
            traits,
            combatskills,
            canAdvance: this.data.canAdvance,
            sheetLocked: actorData.data.sheetLocked.value,
            allSkillsLeft: {
                body: skills.body,
                social: skills.social,
                nature: skills.nature
            },
            allSkillsRight: {
                knowledge: skills.knowledge,
                trade: skills.trade
            }
        }
    }

    getArmorEncumbrance(actorData, wornArmors) {
        const encumbrance = wornArmors.reduce((sum, a) => {
            a.calculatedEncumbrance = Number(a.data.encumbrance.value) + EquipmentDamage.armorEncumbranceModifier(a)
            a.damageToolTip = EquipmentDamage.damageTooltip(a)
            return sum += a.calculatedEncumbrance
        }, 0)
        return Math.max(0, encumbrance - SpecialabilityRulesDSA5.abilityStep(actorData, game.i18n.localize('LocalizedIDs.inuredToEncumbrance')))
    }

    _setBagContent(elem, containers, topLevel = true) {
        let totalWeight = 0
        if (containers.has(elem._id)) {
            elem.children = []
            let bagweight = 0
            if (!elem.toggleValue && topLevel) totalWeight -= elem.weight

            for (let child of containers.get(elem._id)) {
                child.weight = Number(parseFloat((child.data.weight.value * child.data.quantity.value).toFixed(3)))
                bagweight += child.weight
                elem.children.push(Actordsa5._prepareitemStructure(Actordsa5._prepareConsumable(child)))
                if (containers.has(child._id)) {
                    bagweight += this._setBagContent(child, containers, false)
                }

            }
            if (elem.toggleValue || !topLevel) totalWeight += bagweight
            elem.bagweight = `${bagweight.toFixed(3)}/${elem.data.capacity}`
        }
        return totalWeight
    }

    isMerchant() {
        return ["merchant", "loot"].includes(getProperty(this.data, "data.merchant.merchantType"))
    }

    _itemPreparationError(item, error) {
        console.error("Something went wrong with preparing item " + item.name + ": " + error)
        console.warn(error)
        console.warn(wep)
        ui.notifications.error("Something went wrong with preparing item " + item.name + ": " + error)
    }

    _applyModiferTransformations(itemModifiers) {
        for (const [key, value] of Object.entries(itemModifiers)) {
            let shortCut = game.dsa5.config.knownShortcuts[key.toLowerCase()]
            if (shortCut)
                this.data.data[shortCut[0]][shortCut[1]][shortCut[2]] += value.value
            else
                delete itemModifiers[key]
        }
        return itemModifiers
    }

    _addGearAndAbilityModifiers(itemModifiers, i, compensation) {
        const effect = getProperty(i, "data.data.effect.value")
        if (!effect) return compensation

        let notCompensated = true
        for (let mod of effect.split(/,|;/).map(x => x.trim())) {
            let vals = mod.replace(/(\s+)/g, ' ').trim().split(" ")
            if (vals.length == 2) {
                if (!isNaN(vals[0])) {
                    if (compensation && i.data.type == "armor" && [game.i18n.localize('CHARAbbrev.INI').toLowerCase(), game.i18n.localize('CHARAbbrev.GS').toLowerCase()].includes(vals[1].toLowerCase())) {
                        notCompensated = false
                    } else if (itemModifiers[vals[1]] == undefined) {
                        itemModifiers[vals[1]] = {
                            value: Number(vals[0]) * (i.data.data.step ? (Number(i.data.data.step.value) || 1) : 1),
                            sources: [i.name]
                        }
                    } else {
                        itemModifiers[vals[1]].value += Number(vals[0]) * (i.data.data.step ? (Number(i.data.data.step.value) || 1) : 1)
                        itemModifiers[vals[1]].sources.push(i.name)
                    }
                }
            }
        }

        return compensation && notCompensated
    }

    async _updateAPs(APValue, dataUpdate = {}) {
        if (Actordsa5.canAdvance(this.data)) {
            if (!isNaN(APValue) && !(APValue == null)) {
                const ap = Number(APValue)
                dataUpdate["data.details.experience.spent"] = Number(this.data.data.details.experience.spent) + ap
                await this.update(dataUpdate);
                const msg = game.i18n.format(ap > 0 ? "advancementCost" : "refundCost", { cost: Math.abs(ap) })
                tinyNotification(msg)

            } else {
                ui.notifications.error(game.i18n.localize("DSAError.APUpdateError"))
            }
        }
    }

    async checkEnoughXP(cost) {
        if (!Actordsa5.canAdvance(this.data)) return true
        if (isNaN(cost) || cost == null) return true

        if (Number(this.data.data.details.experience.total) - Number(this.data.data.details.experience.spent) >= cost) {
            return true
        } else if (Number(this.data.data.details.experience.total == 0)) {
            let selOptions = Object.entries(DSA5.startXP).map(([key, val]) => `<option value="${key}">${game.i18n.localize(val)} (${key})</option>`).join("")
            let template = `<p>${game.i18n.localize("DSAError.zeroXP")}</p><label>${game.i18n.localize('APValue')}: </label><select name ="APsel">${selOptions}</select>`
            let newXp = 0;
            let result = false;

            [result, newXp] = await new Promise((resolve, reject) => {
                new Dialog({
                    title: game.i18n.localize("DSAError.NotEnoughXP"),
                    content: template,
                    default: 'yes',
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("yes"),
                            callback: dlg => {
                                resolve([true, dlg.find('[name="APsel"]')[0].value])
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: game.i18n.localize("cancel"),
                            callback: () => {
                                resolve([false, 0])
                            }
                        }
                    }
                }).render(true)
            })
            if (result) {
                await this.update({ "data.details.experience.total": Number(newXp) });
                return true
            }
        }
        ui.notifications.error(game.i18n.localize("DSAError.NotEnoughXP"))
        return false
    }

    setupWeapon(item, mode, options, tokenId) {
        options["mode"] = mode
        return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId)
    }

    setupWeaponless(statusId, options = {}, tokenId) {
        let item = duplicate(DSA5.defaultWeapon)
        item.name = game.i18n.localize(`${statusId}Weaponless`)
        item.data.combatskill = { value: game.i18n.localize("LocalizedIDs.wrestle") }
        item.data.damageThreshold.value = 14
        options["mode"] = statusId
        return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId)
    }

    setupSpell(spell, options = {}, tokenId) {
        return Itemdsa5.getSubClass(spell.type).setupDialog(null, options, spell, this, tokenId)
    }

    setupSkill(skill, options = {}, tokenId) {
        return Itemdsa5.getSubClass(skill.type).setupDialog(null, options, skill, this, tokenId)
    }

    async applyDamage(amount) {
        const newVal = Math.min(this.data.data.status.wounds.max, this.data.data.status.wounds.value - amount)
        await this.update({ "data.status.wounds.value": newVal })
    }

    async applyRegeneration(LeP, AsP, KaP) {
        const update = {
            "data.status.wounds.value": Math.min(this.data.data.status.wounds.max, this.data.data.status.wounds.value + (LeP || 0)),
            "data.status.karmaenergy.value": Math.min(this.data.data.status.karmaenergy.max, this.data.data.status.karmaenergy.value + (KaP || 0)),
            "data.status.astralenergy.value": Math.min(this.data.data.status.astralenergy.max, this.data.data.status.astralenergy.value + (AsP || 0))
        }
        await this.update(update)
    }

    async applyMana(amount, type) {
        let state = type == "AsP" ? "astralenergy" : "karmaenergy"

        const newVal = Math.min(this.data.data.status[state].max, this.data.data.status[state].value - amount)
        if (newVal >= 0) {
            await this.update({
                [`data.status.${state}.value`]: newVal
            })
        } else {
            ui.notifications.error(game.i18n.localize(`DSAError.NotEnough${type}`))
        }
    }

    preparePostRollAction(message) {
        let data = message.data.flags.data;
        let cardOptions = {
            flags: { img: message.data.flags.img },
            rollMode: data.rollMode,
            speaker: message.data.speaker,
            template: data.template,
            title: data.title,
            user: message.data.user
        };
        if (data.attackerMessage)
            cardOptions.attackerMessage = data.attackerMessage;
        if (data.defenderMessage)
            cardOptions.defenderMessage = data.defenderMessage;
        if (data.unopposedStartMessage)
            cardOptions.unopposedStartMessage = data.unopposedStartMessage;
        return cardOptions;
    }

    resetTargetAndMessage(data, cardOptions) {
        if (data.originalTargets && data.originalTargets.size > 0) {
            game.user.targets = data.originalTargets;
            game.user.targets.user = game.user;
        }
        if (!data.defenderMessage && data.startMessagesList) {
            cardOptions.startMessagesList = data.startMessagesList;
        }
    }

    async fatererollDamage(infoMsg, cardOptions, newTestData, message, data, schipsource) {
        cardOptions.fatePointDamageRerollUsed = true;

        this.resetTargetAndMessage(data, cardOptions)

        let oldDamageRoll = duplicate(data.postData.damageRoll)
        let newRoll = await DiceDSA5.manualRolls(new Roll(oldDamageRoll.formula || oldDamageRoll._formula).evaluate({ async: false }), "CHATCONTEXT.rerollDamage")

        for (let i = 0; i < newRoll.dice.length; i++)
            newRoll.dice[i].options.colorset = "black"

        DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

        ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        newTestData.damageRoll = duplicate(newRoll)

        this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        await message.update({ "flags.data.fatePointDamageRerollUsed": true });
        await this.reduceSchips(schipsource)
    }

    async fateisTalented(infoMsg, cardOptions, newTestData, message, data) {
        cardOptions.talentedRerollUsed = true;

        this.resetTargetAndMessage(data, cardOptions)

        infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.faitepointUsed")}</b></h3>
            ${game.i18n.format("CHATFATE.isTalented", { character: '<b>' + this.name + '</b>' })}<br>`;
        renderTemplate('systems/dsa5/templates/dialog/isTalentedReroll-dialog.html', { testData: newTestData, postData: data.postData }).then(html => {
            new DSA5Dialog({
                title: game.i18n.localize("CHATFATE.selectDice"),
                content: html,
                buttons: {
                    Yes: {
                        icon: '<i class="fa fa-check"></i>',
                        label: game.i18n.localize("Ok"),
                        callback: async dlg => {
                            let diesToReroll = dlg.find('.dieSelected').map(function() { return Number($(this).attr('data-index')) }).get()
                            if (diesToReroll.length > 0) {

                                let newRoll = []
                                for (let k of diesToReroll) {
                                    let term = newTestData.roll.terms[k * 2]
                                    newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                                }
                                newRoll = await DiceDSA5.manualRolls(await new Roll(newRoll.join("+")).evaluate({ async: true }), "CHATCONTEXT.talentedReroll")
                                DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

                                let ind = 0
                                let changedRolls = []
                                for (let k of diesToReroll) {
                                    const characteristic = newTestData.source.data[`characteristic${k + 1}`]
                                    const attr = characteristic ? game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`) + " - " : ""

                                    changedRolls.push(`${attr}${newTestData.roll.terms[k * 2].results[0].result}/${newRoll.terms[ind * 2].results[0].result}`)
                                    newTestData.roll.terms[k * 2].results[0].result = Math.min(newRoll.terms[ind * 2].results[0].result, newTestData.roll.terms[k * 2].results[0].result)

                                    ind += 1
                                }
                                infoMsg += `<b>${game.i18n.localize('Roll')}</b>: ${changedRolls.join(", ")}`
                                ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

                                this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                await message.update({ "flags.data.talentedRerollUsed": true });
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    },
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async fatereroll(infoMsg, cardOptions, newTestData, message, data, schipsource) {
            cardOptions.fatePointDamageRerollUsed = true;
            this.resetTargetAndMessage(data, cardOptions)

            renderTemplate('systems/dsa5/templates/dialog/fateReroll-dialog.html', { testData: newTestData, postData: data.postData })
                .then(html => {
                        new DSA5Dialog({
                                    title: game.i18n.localize("CHATFATE.selectDice"),
                                    content: html,
                                    buttons: {
                                        Yes: {
                                            icon: '<i class="fa fa-check"></i>',
                                            label: game.i18n.localize("Ok"),
                                            callback: async dlg => {

                                                    let diesToReroll = dlg.find('.dieSelected').map(function() { return Number($(this).attr('data-index')) }).get()
                                                    if (diesToReroll.length > 0) {

                                                        let newRoll = []
                                                        for (let k of diesToReroll) {
                                                            let term = newTestData.roll.terms[k * 2]
                                                            newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                                                        }
                                                        newRoll = await DiceDSA5.manualRolls(await new Roll(newRoll.join("+")).evaluate({ async: true }), "CHATCONTEXT.Reroll")
                                                        DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

                                                        let ind = 0
                                                        let changedRolls = []
                                                        for (let k of diesToReroll) {
                                                            const characteristic = newTestData.source.data[`characteristic${k + 1}`]
                                                            const attr = characteristic ? `${game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`)} - ` : ""
                                    changedRolls.push(`${attr}${newTestData.roll.terms[k * 2].results[0].result}/${newRoll.terms[ind * 2].results[0].result}`)
                                    newTestData.roll.terms[k * 2].results[0].result = newRoll.terms[ind * 2].results[0].result
                                    ind += 1
                                }

                                infoMsg += `<br><b>${game.i18n.localize('Roll')}</b>: ${changedRolls.join(", ")}`
                                ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

                                this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                await message.update({ "flags.data.fatePointRerollUsed": true });
                                await this.reduceSchips(schipsource)
                            }
                        }
                    },
                    cancel: {
                        icon: '<i class="fas fa-times"></i>',
                        label: game.i18n.localize("cancel")
                    },
                },
                default: 'Yes'
            }).render(true)
        });
    }

    async fateaddQS(infoMsg, cardOptions, newTestData, message, data, schipsource) {
        ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
        game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true }));

        cardOptions.fatePointAddQSUsed = true;
        newTestData.qualityStep = 1

        this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
        await message.update({ "flags.data.fatePointAddQSUsed": true });
        await this.reduceSchips(schipsource)
    }

    async fateImprove(infoMsg, cardOptions, newTestData, message, data, schipsource) {
        ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

        this.resetTargetAndMessage(data, cardOptions)

        let rollType = message.data.flags.data.preData.source.type
        if (["spell", "liturgy", "ceremony", "ritual", "skill"].includes(rollType)) {
            renderTemplate('systems/dsa5/templates/dialog/fateImprove-dialog.html', { testData: newTestData, postData: data.postData }).then(html => {
                new DSA5Dialog({
                    title: game.i18n.localize("CHATFATE.selectDice"),
                    content: html,
                    buttons: {
                        Yes: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("Ok"),
                            callback: async dlg => {
                                let fws = [0, 0, 0]
                                let diesToUpgrade = dlg.find('.dieSelected').map(function () { return Number($(this).attr('data-index')) }).get()
                                if (diesToUpgrade.length == 1) {
                                    fws[diesToUpgrade] = 2
                                    const modifier = { name: game.i18n.localize("CHATCONTEXT.improveFate"), value: fws.join("|"), type: "roll" }
                                    newTestData.roll.terms[diesToUpgrade * 2].results[0].result = Math.max(1, newTestData.roll.terms[diesToUpgrade * 2].results[0].result - 2)
                                    newTestData.situationalModifiers.push(modifier)
                                    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                    await message.update({ "flags.data.fateImproved": true });
                                    await this.reduceSchips(schipsource)
                                }
                            }
                        },
                        cancel: {
                            icon: '<i class="fas fa-times"></i>',
                            label: game.i18n.localize("cancel")
                        },
                    },
                    default: 'Yes'
                }).render(true)
            });
        } else {
            const modifier = { name: game.i18n.localize("CHATCONTEXT.improveFate"), value: 2, type: "roll" }
            newTestData.situationalModifiers.push(modifier)
            newTestData.roll.terms[0].results[0].result = Math.max(1, newTestData.roll.terms[0].results[0].result - 2)
            this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
            await message.update({ "flags.data.fateImproved": true });
            await this.reduceSchips(schipsource)
        }
    }

    async reduceSchips(schipsource){
        if(schipsource == 0)
            await this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })
        else{
            const groupschips = game.settings.get("dsa5", "groupschips").split("/").map(x => Number(x))
            groupschips[0] = groupschips[0] - 1
            await game.settings.set("dsa5", "groupschips", groupschips.join("/"))
        }
    }

    async useFateOnRoll(message, type, schipsource) {
        if (DSA5_Utility.fateAvailable(this, schipsource == 1)) {
            let data = message.data.flags.data
            let cardOptions = this.preparePostRollAction(message);
            let fateAvailable
            let schipText
            if(schipsource == 0){
                fateAvailable = this.data.data.status.fatePoints.value - 1
                schipText = "PointsRemaining"
            }else{
                fateAvailable = game.settings.get("dsa5", "groupschips").split("/")[0]
                schipText = "GroupPointsRemaining"
            }
            let infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.faitepointUsed")}</b></h3>
                ${game.i18n.format("CHATFATE." + type, { character: '<b>' + this.name + '</b>' })}<br>
                <b>${game.i18n.localize(`CHATFATE.${schipText}`)}</b>: ${fateAvailable}`;

            let newTestData = data.preData
            newTestData.extra.actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker).toObject(false)

            this[`fate${type}`](infoMsg, cardOptions, newTestData, message, data, schipsource)
        }
    }

    setupRegeneration(statusId, options = {}, tokenId) {
        let title = game.i18n.localize("regenerationTest");

        let testData = {
            source: {
                type: "regenerate",
                data: {}
            },
            opposable: false,
            extra: {
                statusId: statusId,
                actor: this.toObject(false),
                options: options,
                speaker: {
                    token: tokenId,
                    actor: this.data._id
                }
            }
        };

        testData.extra.actor.isMage = this.data.isMage
        testData.extra.actor.isPriest = this.data.isPriest
        let situationalModifiers = DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source)
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/regeneration-dialog.html",
            data: {
                rollMode: options.rollMode,
                regenerationInterruptOptions: DSA5.regenerationInterruptOptions,
                regnerationCampLocations: DSA5.regnerationCampLocations,
                showAspModifier: this.data.isMage,
                showKapModifier: this.data.isPriest,
                situationalModifiers
            },
            callback: (html, options = {}) => {
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers.push({
                    name: game.i18n.localize("camplocation") + " - " + html.find('[name="regnerationCampLocations"] option:selected').text(),
                    value: html.find('[name="regnerationCampLocations"]').val()
                }, {
                    name: game.i18n.localize("interruption") + " - " + html.find('[name="regenerationInterruptOptions"] option:selected').text(),
                    value: html.find('[name="regenerationInterruptOptions"]').val()
                })
                testData.regenerationFactor = html.find('[name="badEnvironment"]').is(":checked") ? 0.5 : 1
                testData.AsPModifier = Number(html.find('[name="aspModifier"]').val() || 0);
                testData.KaPModifier = Number(html.find('[name="kapModifier"]').val() || 0);
                testData.LePModifier = Number(html.find('[name="lepModifier"]').val());
                testData.regenerationAsP = Number(this.data.data.status.regeneration.AsPmax)
                testData.regenerationKaP = Number(this.data.data.status.regeneration.KaPmax)
                testData.regenerationLeP = Number(this.data.data.status.regeneration.LePmax)
                mergeObject(testData.extra.options, options)
                this.update({"data.status.regeneration.LePTemp": 0,"data.status.regeneration.KaPTemp": 0,"data.status.regeneration.AsPTemp": 0})
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/regeneration-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupDodge(options = {}, tokenId) {
        const statusId = "dodge"
        let char = this.data.data.status[statusId];
        let title = game.i18n.localize(statusId) + " " + game.i18n.localize("Test");

        let testData = {
            source: {
                data: char,
                type: statusId
            },
            opposable: false,
            extra: {
                statusId: statusId,
                actor: this.toObject(false),
                options: options,
                speaker: {
                    token: tokenId,
                    actor: this.data._id
                }
            }
        };

        let toSearch = [game.i18n.localize(statusId)]
        let combatskills = Itemdsa5.buildCombatSpecAbs(this, ["Combat"], toSearch, "parry")
        let situationalModifiers = DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source)
        Itemdsa5.getDefenseMalus(situationalModifiers, this)

        const multipleDefenseValue = RuleChaos.multipleDefenseValue(this, testData.source)

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
            data: {
                rollMode: options.rollMode,
                combatSpecAbs: combatskills,
                showDefense: true,
                situationalModifiers,
                defenseCountString: game.i18n.format("defenseCount", { malus: multipleDefenseValue })
            },
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, "parry"))
                testData.situationalModifiers.push({
                    name: game.i18n.localize("attackFromBehind"),
                    value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0
                }, {
                    name: game.i18n.format("defenseCount", { malus: multipleDefenseValue }),
                    value: (Number(html.find('[name="defenseCount"]').val()) || 0) * multipleDefenseValue
                })
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };


        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/status-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupCharacteristic(characteristicId, options = {}, tokenId) {
        let char = this.data.data.characteristics[characteristicId];
        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

        let testData = {
            opposable: false,
            source: {
                type: "char",
                data: char,
            },
            extra: {
                characteristicId: characteristicId,
                actor: this.toObject(false),
                options: options,
                speaker: {
                    token: tokenId,
                    actor: this.data._id
                }
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
            data: {
                rollMode: options.rollMode,
                difficultyLabels: (DSA5.attributeDifficultyLabels),
                modifier: options.modifier || 0
            },
            callback: (html, options = {}) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
                testData.situationalModifiers = Actordsa5._parseModifiers(html)
                mergeObject(testData.extra.options, options)
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/characteristic-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    static _parseModifiers(html, search) {
        let res = []
        html.find('[name="situationalModifiers"] option:selected').each(function () {
            const val = $(this).val()
            let data = {
                name: $(this).text().trim().split("[")[0],
                value: isNaN(val) ? val : Number(val),
                type: $(this).attr("data-type")
            }
            if(data.type == "dmg"){
                data.damageBonus = data.value
                data.value = 0
            }
            if ($(this).attr("data-specAbId")) data.specAbId = $(this).attr("data-specAbId")
            if ($(this).attr("data-armorPen")) data.armorPen = $(this).attr("data-armorPen")

            res.push(data)
        })
        return res
    }

    static _prepareConsumable(item) {
        if (item.data.maxCharges) {
            item.consumable = true
            item.structureMax = item.data.maxCharges
            item.structureCurrent = item.data.charges
        }
        return item
    }

    static _prepareitemStructure(item) {
        if (item.data.structure && item.data.structure.max != 0) {
            item.structureMax = item.data.structure.max
            item.structureCurrent = item.data.structure.value
        }
        const enchants = getProperty(item, "flags.dsa5.enchantments")
        if(enchants && enchants.length > 0){
            item.enchantClass = "rar"
        }
        else if((item.data.effect && item.data.effect.value != "") || item.effects.length > 0){
            item.enchantClass = "common"
        }
        return item
    }

    static _prepareMeleetrait(item) {
        item.attack = Number(item.data.at.value)
        if (item.data.pa != 0) item.parry = item.data.pa

        return this._parseDmg(item)
    }

    static _prepareMeleeWeapon(item, combatskills, actorData, wornWeapons = null) {
        let skill = combatskills.find(i => i.name == item.data.combatskill.value)
        if (skill) {
            item.attack = Number(skill.data.attack.value) + Number(item.data.atmod.value)

            const vals = item.data.guidevalue.value.split('/').map(x =>{
                if (!actorData.data.characteristics[x]) return 0
                return Number(actorData.data.characteristics[x].initial) + Number(actorData.data.characteristics[x].modifier) + Number(actorData.data.characteristics[x].advances) + Number(actorData.data.characteristics[x].gearmodifier)
            })
            const baseParry = Math.ceil(skill.data.talentValue.value / 2) + Math.max(0, Math.floor((Math.max(...vals) - 8) / 3)) + Number(game.settings.get("dsa5", "higherDefense"))

            item.parry = baseParry + Number(item.data.pamod.value) + (item.data.combatskill.value == game.i18n.localize('LocalizedIDs.Shields') ? Number(item.data.pamod.value) : 0)

            let regex2h = /\(2H/
            if (!regex2h.test(item.name)) {
                if (!wornWeapons)
                    wornWeapons = duplicate(actorData.items).filter(x => (x.type == "meleeweapon" && x.data.worn.value && x._id != item._id && !regex2h.test(x.name)))

                if (wornWeapons.length > 0) {
                    item.parry += Math.max(...wornWeapons.map(x => x.data.pamod.offhandMod))
                    item.attack += Math.max(...wornWeapons.map(x => x.data.atmod.offhandMod))
                }
            }

            item = this._parseDmg(item)
            if (item.data.guidevalue.value != "-") {
                let val = Math.max(...(item.data.guidevalue.value.split("/").map(x => Number(actorData.data.characteristics[x].value))));
                let extra = val - Number(item.data.damageThreshold.value)

                if (extra > 0) {
                    item.extraDamage = extra;
                    item.damageAdd = Roll.safeEval(item.damageAdd + " + " + Number(extra))
                    item.damageAdd = (item.damageAdd > 0 ? "+" : "") + item.damageAdd
                }
            }
            EquipmentDamage.weaponWearModifier(item)
            item.damageToolTip = EquipmentDamage.damageTooltip(item)
        } else {
            ui.notifications.error(game.i18n.format("DSAError.unknownCombatSkill", { skill: item.data.combatskill.value, item: item.name }))
        }
        return item;
    }

    async _preCreate(data, options, user) {
        await super._preCreate(data, options, user)
        let update = {}

        if (!data.img)
            update.img = "icons/svg/mystery-man-black.svg"

        if (data.type == "character") {
            mergeObject(update, {
                token: {
                    vision: true,
                    actorLink: true
                }
            })
        }
        this.data.update(update)

    }

    static _prepareRangeTrait(item) {
        item.attack = Number(item.data.at.value)
        item.LZ = Number(item.data.reloadTime.value)
        if (item.LZ > 0) Actordsa5.buildReloadProgress(item)

        return this._parseDmg(item)
    }

    static calcLZ(item, actor) {
        if (item.data.combatskill.value == game.i18n.localize("LocalizedIDs.Throwing Weapons"))
            return Math.max(0, Number(item.data.reloadTime.value) - SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize("LocalizedIDs.quickdraw")))
        else if (item.data.combatskill.value == game.i18n.localize("LocalizedIDs.Crossbows") && SpecialabilityRulesDSA5.hasAbility(actor, `${game.i18n.localize('LocalizedIDs.quickload')} (${game.i18n.localize("LocalizedIDs.Crossbows")})`))
            return Math.max(0, Math.round(Number(item.data.reloadTime.value) * 0.5))

        return Math.max(0, Number(item.data.reloadTime.value) - SpecialabilityRulesDSA5.abilityStep(actor, `${game.i18n.localize('LocalizedIDs.quickload')} (${game.i18n.localize(item.data.combatskill.value)})`))
    }

    static _parseDmg(item, modification = undefined) {
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/g, "d"), { async: false })

        let damageDie = "",
            damageTerm = ""
        for (let k of parseDamage.terms) {
            if (k.faces) damageDie = k.number + "d" + k.faces
            else if (k.number) damageTerm += k.number
        }
        if (modification){
            let damageMod = getProperty(modification, "data.damageMod")
            if (Number(damageMod)) damageTerm += `+${Number(damageMod)}`
            else if(damageMod) item.damageBonusDescription = `, ${damageMod} ${game.i18n.localize('CHARAbbrev.damage')} ${modification.name}`
        }

        if (damageTerm) damageTerm = Roll.safeEval(damageTerm)

        item.damagedie = damageDie ? damageDie : "0d6"
        item.damageAdd = damageTerm != "" ? (Number(damageTerm) > 0 ? "+" : "") + damageTerm : ""

        return item
    }

    static buildReloadProgress(item) {
        const progress = item.data.reloadTime.progress / item.LZ
        item.title = game.i18n.format("WEAPON.loading", { status: `${item.data.reloadTime.progress}/${item.LZ}` })
        item.progress = `${item.data.reloadTime.progress}/${item.LZ}`
        if (progress >= 1) {
            item.title = game.i18n.localize("WEAPON.loaded")
        }
        this.progressTransformation(item, progress)
    }

    static progressTransformation(item, progress){
        if (progress >= 0.5) {
            item.transformRight = "181deg"
            item.transformLeft = `${Math.round(progress * 360 - 179)}deg`
        } else {
            item.transformRight = `${Math.round(progress * 360 + 1)}deg`
            item.transformLeft = 0
        }
    }

    static buildSpellChargeProgress(item) {
        item.LZ = Number(item.data.castingTime.modified) || 0
        if(item.LZ > 1){
            const progress = item.data.castingTime.progress / item.LZ
            item.title = game.i18n.format("SPELL.loading", { status: `${item.data.castingTime.progress}/${item.LZ}` })
            item.progress = `${item.data.castingTime.progress}/${item.LZ}`
            this.progressTransformation(item, progress)
        }
        return item
    }

    static _prepareRangeWeapon(item, ammunitions, combatskills, actor) {
        let skill = combatskills.find(i => i.name == item.data.combatskill.value)
        item.calculatedRange = item.data.reach.value

        let currentAmmo
        if (skill) {
            item.attack = Number(skill.data.attack.value)

            if (item.data.ammunitiongroup.value != "-") {
                if (!ammunitions) ammunitions = actorData.inventory.ammunition.items
                item.ammo = ammunitions.filter(x => x.data.ammunitiongroup.value == item.data.ammunitiongroup.value)

                currentAmmo = ammunitions.find(x => x._id == item.data.currentAmmo.value)
                if(currentAmmo){
                    const rangeMultiplier = Number(currentAmmo.data.rangeMultiplier) || 1
                    item.calculatedRange = item.calculatedRange.split("/").map(x => Math.round(Number(x) * rangeMultiplier)).join("/")
                    item.attack += (Number(currentAmmo.data.atmod) || 0)
                }
            }
            item.LZ = Actordsa5.calcLZ(item, actor)
            if (item.LZ > 0) Actordsa5.buildReloadProgress(item)

            EquipmentDamage.weaponWearModifier(item)
            item.damageToolTip = EquipmentDamage.damageTooltip(item)
        } else {
            ui.notifications.error(game.i18n.format("DSAError.unknownCombatSkill", { skill: item.data.combatskill.value, item: item.name }))
        }
        return this._parseDmg(item, currentAmmo)
    }

    _setupCardOptions(template, title) {
        let cardOptions = {
            speaker: {
                alias: this.data.token.name,
                actor: this.data._id,
            },
            title: title,
            template: template,
            flags: { img: this.data.token.randomImg ? this.data.img : this.data.token.img }
        }
        if (this.token) {
            cardOptions.speaker.alias = this.token.data.name;
            cardOptions.speaker.token = this.token.data._id;
            cardOptions.speaker.scene = canvas.scene.id
            cardOptions.flags.img = this.token.data.img;
        } else {
            let speaker = ChatMessage.getSpeaker()
            if (speaker.actor == this.data._id) {
                cardOptions.speaker.alias = speaker.alias
                cardOptions.speaker.token = speaker.token
                cardOptions.speaker.scene = speaker.scene
                cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token).data.img : cardOptions.flags.img
            }
        }
        return cardOptions
    }

    async basicTest({ testData, cardOptions }, options = {}) {
        testData = await DiceDSA5.rollDices(testData, cardOptions);
        let result = await DiceDSA5.rollTest(testData);

        result.postFunction = "basicTest";

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            if (cardOptions.isOpposedTest) cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
        }

        if (testData.extra.ammo && !testData.extra.ammoDecreased) {
            testData.extra.ammoDecreased = true
            testData.extra.ammo.data.quantity.value--;
            await this.updateEmbeddedDocuments("Item", [
                { _id: testData.extra.ammo._id, "data.quantity.value": testData.extra.ammo.data.quantity.value },
                { _id: testData.source._id, "data.reloadTime.progress": 0 }
            ]);
        } else if ((testData.source.type == "rangeweapon" || (testData.source.type == "trait" && testData.source.data.traitType.value == "rangeAttack")) && !testData.extra.ammoDecreased) {
            testData.extra.ammoDecreased = true
            await this.updateEmbeddedDocuments("Item", [{ _id: testData.source._id, "data.reloadTime.progress": 0 }]);
        } else if(["spell","liturgy"].includes(testData.source.type) && testData.extra.speaker.token != "emptyActor"){
            await this.updateEmbeddedDocuments("Item", [{ _id: testData.source._id, "data.castingTime.progress": 0, "data.castingTime.modified": 0 }]);
        }

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(async (msg) => {
                await OpposedDsa5.handleOpposedTarget(msg)
            })
        return { result, cardOptions };
    }

    async addCondition(effect, value = 1, absolute = false, auto = true) {
        if(effect == "bleeding") return await RuleChaos.bleedingMessage(this)
        return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto)
    }

    async _dependentEffects(statusId, effect, delta) {
        const effectData = duplicate(effect)

        if(effectData.flags.dsa5.value == 4){
            if (["encumbered", "stunned", "feared", "inpain", "confused", "trance"].includes(statusId))
                await this.addCondition("incapacitated")
            else if (statusId == "paralysed")
                await this.addCondition("rooted")
            else if (statusId == "drunken"){
                await this.addCondition("stunned")
                await this.removeCondition("drunken")
            }
        }

        if (statusId == "unconscious")
            await this.addCondition("prone")

        if (delta > 0 && statusId == "inpain" && !this.hasCondition("bloodrush") && AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.frenzy'))) {
            await this.addCondition("bloodrush")
            const msg = DSA5_Utility.replaceConditions(`${game.i18n.format("CHATNOTIFICATION.gainsBloodrush", { character: "<b>" + this.name + "</b>" })}`);
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        }
    }

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        return await DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute)
    }

    hasCondition(conditionKey) {
        return DSA5StatusEffects.hasCondition(this, conditionKey)
    }
}