import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"
import OpposedDsa5 from "../system/opposed-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js"
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js"

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        data.items = [];
        data.flags = {}

        if (!data.img || data.img == "icons/svg/mystery-man.svg")
            data.img = "icons/svg/mystery-man-black.svg"

        let skills = await DSA5_Utility.allSkills() || [];
        let combatskills = await DSA5_Utility.allCombatSkills() || [];
        let moneyItems = await DSA5_Utility.allMoneyItems() || [];

        moneyItems = moneyItems.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        data.items.push(...skills);
        data.items.push(...combatskills);

        data.items.push(...moneyItems.map(m => {
            m.data.quantity.value = 0
            return m
        }));

        super.create(data, options);
    }

    prepareDerivedData() {
        const data = this.data
        try {
            let equipmentModifiers = {}
            for (let i of data.items.filter(x => ["meleeweapon", "rangeweapon", "armor"].includes(x.type) && x.data.worn.value)) {
                this._addGearAndAbilityModifiers(equipmentModifiers, i)
            }
            data.data.equipmentModifiers = equipmentModifiers
            this._applyModiferTransformations(equipmentModifiers)

            //This gets called by every user and creates multiple instances
            data.canAdvance = data.type == "character" || data.items.find(x => x.name == "Vertrauter" && x.type == "trait") != undefined
            if (data.canAdvance) {
                data.data.details.experience.current = data.data.details.experience.total - data.data.details.experience.spent;
                data.data.details.experience.description = DSA5_Utility.experienceDescription(data.data.details.experience.total)
            }

            if (data.type == "character" || data.type == "npc") {
                data.data.status.wounds.current = data.data.status.wounds.initial + data.data.characteristics["ko"].value * 2;
                data.data.status.soulpower.value = (data.data.status.soulpower.initial ? data.data.status.soulpower.initial : 0) + Math.round((data.data.characteristics["mu"].value + data.data.characteristics["kl"].value + data.data.characteristics["in"].value) / 6);
                data.data.status.toughness.value = (data.data.status.toughness.initial ? data.data.status.toughness.initial : 0) + Math.round((data.data.characteristics["ko"].value + data.data.characteristics["ko"].value + data.data.characteristics["kk"].value) / 6);
                data.data.status.fatePoints.max = Number(data.data.status.fatePoints.current) + Number(data.data.status.fatePoints.modifier);
                data.data.status.initiative.value = Math.round((data.data.characteristics["mu"].value + data.data.characteristics["ge"].value) / 2) + (data.data.status.initiative.modifier || 0);
            }

            if (data.type == "creature") {
                data.data.status.wounds.current = data.data.status.wounds.initial
                data.data.status.astralenergy.current = data.data.status.astralenergy.initial
                data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial
                data.data.status.initiative.value = data.data.status.initiative.current + (data.data.status.initiative.modifier || 0);
            }

            data.data.status.initiative.value + data.data.status.initiative.gearmodifier

            data.data.status.wounds.max = data.data.status.wounds.current + data.data.status.wounds.modifier + data.data.status.wounds.advances + data.data.status.wounds.gearmodifier
            data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances + data.data.status.astralenergy.gearmodifier
            data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances + data.data.status.karmaenergy.gearmodifier

            let guide = data.data.guidevalue
            if (guide && data.type != "creature") {
                if (data.data.characteristics[guide.value]) {
                    data.data.status.astralenergy.current = data.data.status.astralenergy.initial + data.data.characteristics[guide.value].value
                    data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances
                    data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial + data.data.characteristics[guide.value].value
                    data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances
                }
            }

            data.data.status.speed.max = data.data.status.speed.initial + (data.data.status.speed.modifier || 0) + data.data.status.speed.gearmodifier
            data.data.status.soulpower.max = data.data.status.soulpower.value + data.data.status.soulpower.modifier + data.data.status.soulpower.gearmodifier
            data.data.status.toughness.max = data.data.status.toughness.value + data.data.status.toughness.modifier + data.data.status.toughness.gearmodifier
            data.data.status.dodge.value = Math.round(data.data.characteristics["ge"].value / 2) + data.data.status.dodge.gearmodifier

            let encumbrance = this.hasCondition('encumbered')
            encumbrance = encumbrance ? Number(encumbrance.flags.dsa5.value) : 0
            data.data.status.initiative.value -= (Math.min(4, encumbrance)) + SpecialabilityRulesDSA5.abilityStep(data, game.i18n.localize('LocalizedIDs.combatReflexes'))
            data.data.status.dodge.max = Number(data.data.status.dodge.value) + Number(data.data.status.dodge.modifier) + SpecialabilityRulesDSA5.abilityStep(data, game.i18n.localize('LocalizedIDs.improvedDodge')) + (Number(game.settings.get("dsa5", "higherDefense")) / 2)


            if (game.user.isGM) {
                let pain = Math.floor((1 - data.data.status.wounds.value / data.data.status.wounds.max) * 4)
                pain -= AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.ruggedFighter'))

                if (pain > 0)
                    pain += AdvantageRulesDSA5.vantageStep(this, game.i18n.localize('LocalizedIDs.sensitiveToPain'))

                if (data.type != "creature" && data.data.status.wounds.value <= 5)
                    pain = 4

                pain = Math.max(Math.min(4, pain), 0)

                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.blind')))
                    this.addCondition("blind")
                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.mute')))
                    this.addCondition("mute")
                if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.deaf')))
                    this.addCondition("deaf")

                this.addCondition("inpain", pain, true)
            }
        } catch (error) {
            console.error("Something went wrong with preparing actor data: " + error + error.stack)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error + error.stack)
        }

    }

    prepareBaseData() {
        const data = this.data;
        for (let ch of Object.values(data.data.characteristics)) {
            ch.value = ch.initial + ch.advances + (ch.modifier || 0);
            ch.bonus = Math.floor(ch.value / 10)
            ch.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E") })
            ch.refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E", 0) })
        }

        let gearModifyableCalculatedAttributes = ["initiative", "speed", "astralenergy", "karmaenergy", "wounds", "dodge", "soulpower", "toughness"]
        for (let k of gearModifyableCalculatedAttributes) {
            data.data.status[k].gearmodifier = 0
        }
    }

    /** Gets called on sheet render */
    prepare() {
        let preparedData = duplicate(this.data)
        if (preparedData.canAdvance) {
            const attrs = ["wounds", "astralenergy", "karmaenergy"]
            for (const k of attrs) {
                preparedData.data.status[k].cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(preparedData.data.status[k].advances, "D") })
                preparedData.data.status[k].refund = game.i18n.format("refundCost", { cost: DSA5_Utility._calculateAdvCost(preparedData.data.status[k].advances, "D", 0) })
            }
        }
        mergeObject(preparedData, this.prepareItems())
        return preparedData;
    }

    static canAdvance(actorData) {
        return actorData.canAdvance
    }

    static _calculateCombatSkillValues(i, actorData) {
        if (i.data.weapontype.value == "melee") {
            let vals = i.data.guidevalue.value.split('/').map(x =>
                Number(actorData.data.characteristics[x].initial) + Number(actorData.data.characteristics[x].modifier) + Number(actorData.data.characteristics[x].advances)
            );
            let parryChar = Math.max(...vals);
            i.data.parry.value = Math.ceil(i.data.talentValue.value / 2) + Math.max(0, Math.floor((parryChar - 8) / 3)) + Number(game.settings.get("dsa5", "higherDefense"))
            let attackChar = actorData.data.characteristics.mu.initial + actorData.data.characteristics.mu.modifier + actorData.data.characteristics.mu.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        } else {
            i.data.parry.value = 0;
            let attackChar = actorData.data.characteristics.ff.initial + actorData.data.characteristics.ff.modifier + actorData.data.characteristics.ff.advances;
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

    prepareItems() {
        let actorData = duplicate(this.data)
        let combatskills = [];
        let advantages = [];
        let disadvantages = []
        let aggregatedtests = []

        let specAbs = {
            general: [],
            Combat: [],
            fatePoints: [],
            magical: [],
            staff: [],
            clerical: [],
            language: [],
            animal: []
        }

        let armor = [];
        let rangeweapons = [];
        let meleeweapons = [];

        let magic = {
            hasSpells: false,
            hasPrayers: false,
            liturgy: [],
            spell: [],
            ritual: [],
            ceremony: [],
            blessing: [],
            magictrick: []
        }

        let traits = {
            rangeAttack: [],
            meleeAttack: [],
            general: [],
            animal: [],
            familiar: [],
            armor: []
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
                toggle: true,
                toggleName: game.i18n.localize("equipped"),
                show: false,
                dataType: "meleeweapon"
            },
            rangeweapons: {
                items: [],
                toggle: true,
                toggleName: game.i18n.localize("equipped"),
                show: false,
                dataType: "rangeweapon"
            },
            armor: {
                items: [],
                toggle: true,
                toggleName: game.i18n.localize("equipped"),
                show: false,
                dataType: "armor"
            },
            ammunition: {
                items: [],
                show: false,
                dataType: "ammunition"
            },
        };

        for (let t in DSA5.equipmentTypes) {
            inventory[t] = {
                items: [],
                show: false,
                dataType: t
            }
        }

        inventory["poison"] = {
            items: [],
            show: false,
            dataType: "poison"
        }

        inventory["misc"].show = true

        const money = {
            coins: [],
            total: 0,
            show: true
        }

        actorData.items = actorData.items.sort((a, b) => (a.sort || 0) - (b.sort || 0))

        let totalArmor = 0;
        let totalWeight = 0;
        let encumbrance = 0;
        let skills = {
            body: [],
            social: [],
            knowledge: [],
            trade: [],
            nature: []
        }

        for (let i of actorData.items) {
            switch (i.type) {
                case "skill":
                    skills[i.data.group.value].push(this._perpareItemAdvancementCost(i))
                    break;
                case "aggregatedTest":
                    aggregatedtests.push(i)
                    break
                case "ritual":
                case "spell":
                    magic.hasSpells = true
                    magic[i.type].push(this._perpareItemAdvancementCost(i))
                    break;
                case "liturgy":
                case "ceremony":
                    magic.hasPrayers = true
                    magic[i.type].push(this._perpareItemAdvancementCost(i))
                    break;
                case "blessing":
                    magic.hasPrayers = true
                    magic.blessing.push(i)
                    break;
                case "magictrick":
                    magic.hasSpells = true
                    magic.magictrick.push(i)
                    break;
                case "trait":
                    switch (i.data.traitType.value) {
                        case "rangeAttack":
                            i = Actordsa5._prepareRangeTrait(i)
                            break
                        case "meleeAttack":
                            i = Actordsa5._prepareMeleetrait(i)
                            break
                        case "familiar":
                            magic.hasSpells = magic.hasSpells || (i.name == game.i18n.localize('LocalizedIDs.familiar'))
                            break
                        case "armor":
                            totalArmor += Number(i.data.at.value);
                            break
                    }
                    traits[i.data.traitType.value].push(i)
                    break
                case "combatskill":
                    combatskills.push(Actordsa5._calculateCombatSkillValues(i, actorData));
                    break;
                case "ammunition":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    inventory.ammunition.items.push(i);
                    inventory.ammunition.show = true;
                    totalWeight += Number(i.weight);
                    break;
                case "meleeweapon":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.meleeweapons.items.push(Actordsa5._prepareitemStructure(i));
                    inventory.meleeweapons.show = true;
                    totalWeight += Number(i.weight);
                    break;
                case "rangeweapon":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.rangeweapons.items.push(Actordsa5._prepareitemStructure(i));
                    inventory.rangeweapons.show = true;
                    totalWeight += Number(i.weight);
                    break;
                case "armor":
                    i.toggleValue = i.data.worn.value || false;
                    inventory.armor.items.push(Actordsa5._prepareitemStructure(i));
                    inventory.armor.show = true;
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    totalWeight += parseFloat((i.data.weight.value * (i.toggleValue ? Math.max(0, i.data.quantity.value - 1) : i.data.quantity.value)).toFixed(3))

                    if (i.data.worn.value) {
                        encumbrance += Number(i.data.encumbrance.value);
                        totalArmor += Number(i.data.protection.value);
                        armor.push(i);
                    }
                    break;
                case "poison":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    inventory["poison"].items.push(i);
                    inventory["poison"].show = true;
                    totalWeight += Number(i.weight);
                    break
                case "equipment":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
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

            /*} catch (error) {
                console.error("Something went wrong with preparing item " + i.name + ": " + error)
                ui.notifications.error("Something went wrong with preparing item " + i.name + ": " + error)
                    // ui.notifications.error("Deleting " + i.name);
                    // this.deleteEmbeddedEntity("OwnedItem", i._id);
            }*/
        }

        for (let wep of inventory.rangeweapons.items) {
            if (wep.data.worn.value)
                rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, inventory.ammunition.items, combatskills, this));
        }

        for (let wep of inventory.meleeweapons.items) {
            if (wep.data.worn.value)
                meleeweapons.push(Actordsa5._prepareMeleeWeapon(wep, combatskills, actorData, inventory.meleeweapons.items.filter(x => x._id != wep._id)))
        }

        money.coins = money.coins.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);

        //TODO move the encumbrance calculation to a beeter location
        encumbrance = Math.max(0, encumbrance - SpecialabilityRulesDSA5.abilityStep(this.data, game.i18n.localize('LocalizedIDs.inuredToEncumbrance')))

        let carrycapacity = (actorData.data.characteristics.kk.value + actorData.data.characteristics.kk.modifier + actorData.data.characteristics.kk.advances) * 2;
        if (actorData.type != "creature" || actorData.canAdvance) {
            encumbrance += Math.max(0, Math.ceil((totalWeight - carrycapacity - 4) / 4))
        }
        totalWeight = parseFloat(totalWeight.toFixed(3))


        this.addCondition("encumbered", encumbrance, true)

        //CHAR cannot be clerical and magical at the same time
        magic.hasPrayers = magic.hasPrayers && !magic.hasSpells
        this.data.isMage = magic.hasSpells
        this.data.isPriest = magic.hasPrayers

        specAbs.magical = specAbs.magical.concat(specAbs.staff)

        return {
            totalweight: totalWeight,
            totalArmor: totalArmor,
            money: money,
            encumbrance: encumbrance,
            carrycapacity: carrycapacity,
            wornRangedWeapons: rangeweapons,
            wornMeleeWeapons: meleeweapons,
            advantages: advantages,
            disadvantages: disadvantages,
            specAbs: specAbs,
            aggregatedtests: aggregatedtests,
            wornArmor: armor,
            inventory,
            equipmentModifiers: actorData.data.equipmentModifiers,
            languagePoints: {
                used: actorData.data.freeLanguagePoints ? actorData.data.freeLanguagePoints.used : 0,
                available: actorData.data.freeLanguagePoints ? actorData.data.freeLanguagePoints.value : 0
            },
            schips: schips,
            guidevalues: DSA5.characteristics,
            magic: magic,
            traits: traits,
            combatskills: combatskills,
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

    _applyModiferTransformations(equipmentModifiers) {
        for (const [key, value] of Object.entries(equipmentModifiers)) {
            let shortCut = game.dsa5.config.knownShortcuts[key.toLowerCase()]
            if (shortCut)
                this.data.data[shortCut[0]][shortCut[1]][shortCut[2]] += value.value
            else
                console.warn(`Item Modifier ${key} from ${value.sources.join(",")} for ${this.data.name} can not be applied.`)
        }
    }

    _addGearAndAbilityModifiers(equipmentModifiers, i) {
        if (!i.data.effect || i.data.effect.value == undefined)
            return

        for (let mod of i.data.effect.value.split(",").map(x => x)) {
            let vals = mod.replace(/(\s+)/g, ' ').trim().split(" ")
            if (vals.length == 2) {
                if (Number(vals[0]) != undefined) {
                    if (equipmentModifiers[vals[1]] == undefined) {
                        equipmentModifiers[vals[1]] = {
                            value: Number(vals[0]),
                            sources: [i.name]
                        }
                    } else {
                        equipmentModifiers[vals[1]].value += Number(vals[0])
                        equipmentModifiers[vals[1]].sources.push(i.name)
                    }
                }
            }
        }
    }

    async _updateAPs(APValue) {
        if (Actordsa5.canAdvance(this.data)) {
            if (!isNaN(APValue) && !(APValue == null)) {
                await this.update({
                    "data.details.experience.spent": Number(this.data.data.details.experience.spent) + Number(APValue),
                });
            } else {
                ui.notifications.error(game.i18n.localize("DSAError.APUpdateError"))
            }
        }
    }

    async checkEnoughXP(cost) {
        if (!Actordsa5.canAdvance(this.data))
            return true
        if (isNaN(cost) || cost == null)
            return true

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
                            callback: html => {
                                resolve([false, 0])
                            }
                        }
                    }

                }).render(true)
            })
            if (result) {
                await this.update({
                    "data.details.experience.total": Number(newXp)
                });
                return true
            }
        }

        ui.notifications.error(game.i18n.localize("DSAError.NotEnoughXP"))
        return false
    }

    setupWeaponTrait(item, mode, options) {
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");
        let testData = {
            opposable: true,
            source: item,
            mode: mode,
            extra: {
                actor: this.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            // Prefilled dialog data
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.visionModifier = Number(html.find('[name="vision"]').val())
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.defenseCount = Number(html.find('[name="defenseCount"]').val())
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? -2 : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupWeapon(item, mode, options) {
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            opposable: true,
            source: item,
            mode: mode,
            extra: {
                actor: this.data,
                options: options
            }
        };

        if (item.type == "rangeweapon" && this.data.type != "creature") {
            let itemData = item.data.data ? item.data.data : item.data

            if (itemData.ammunitiongroup.value == "-") {
                testData.extra.ammo = duplicate(item)
                if ((testData.extra.ammo.data.quantity.value <= 0)) {
                    ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))
                    return
                }
            } else {
                testData.extra.ammo = duplicate(this.getEmbeddedEntity("OwnedItem", itemData.currentAmmo.value))
                if (!testData.extra.ammo || itemData.currentAmmo.value == "" || testData.extra.ammo.data.quantity.value <= 0) {
                    ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"))
                    return
                }
            }
        }

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.visionModifier = Number(html.find('[name="vision"]').val())
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.defenseCount = Number(html.find('[name="defenseCount"]').val())
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? -2 : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
                if (item.type == "rangeweapon") {
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("target") + " " + html.find('[name="targetMovement"] option:selected').text(),
                        value: Number(html.find('[name="targetMovement"]').val())
                    }, {
                        name: game.i18n.localize("shooter") + " " + html.find('[name="shooterMovement"] option:selected').text(),
                        value: Number(html.find('[name="shooterMovement"]').val())
                    }, {
                        name: game.i18n.localize("mount") + " " + html.find('[name="mountedOptions"] option:selected').text(),
                        value: Number(html.find('[name="mountedOptions"]').val())
                    }, {
                        name: game.i18n.localize("rangeMovementOptions.QUICKCHANGE"),
                        value: html.find('[name="quickChange"]').is(":checked") ? -4 : 0
                    })
                }
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    setupCombatskill(item, mode, options = {}) {
        let title = game.i18n.localize(item.name) + " " + game.i18n.localize(mode + "test");

        let testData = {
            opposable: true,
            source: item,
            mode: mode,
            extra: {
                actor: this.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/combatskill-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/combatskill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    applyDamage(amount) {
        this.update({ "data.status.wounds.value": Math.max(0, this.data.data.status.wounds.value - amount) })
    }

    applyMana(amount, type) {
        let val = type == "AsP" ? "data.status.astralenergy.value" : "data.status.karmaenergy.value"
        this.update({ val: Math.max(0, this.data[val] - amount) })
    }

    setupWeaponless(statusId, options = {}) {
        let title = game.i18n.localize(statusId + "Weaponless");

        let testData = {
            opposable: true,
            mode: statusId,
            source: DSA5.defaultWeapon,
            extra: {
                weaponless: true,
                statusId: statusId,
                actor: this.data,
                options: options
            }
        };
        testData.source.data.name = statusId
        testData.source.data.data.combatskill = {
            value: game.i18n.localize("Combatskill.wrestle")
        }
        testData.source.data.type = "meleeweapon"
        testData.source.data.data.damageThreshold.value = 14

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/status-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
                testData.rangeModifier = html.find('[name="distance"]').val()
                testData.sizeModifier = DSA5.rangeSizeModifier[html.find('[name="size"]').val()]
                testData.visionModifier = Number(html.find('[name="vision"]').val())
                testData.opposingWeaponSize = html.find('[name="weaponsize"]').val()
                testData.defenseCount = Number(html.find('[name="defenseCount"]').val())
                testData.narrowSpace = html.find('[name="narrowSpace"]').is(":checked")
                testData.doubleAttack = html.find('[name="doubleAttack"]').is(":checked") ? -2 : 0
                testData.wrongHand = html.find('[name="wrongHand"]').is(":checked") ? -4 : 0
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

    useFateOnRoll(message, type) {
        if (this.data.data.status.fatePoints.value > 0) {
            let data = message.data.flags.data
            let cardOptions = this.preparePostRollAction(message);

            let infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.faitepointUsed")}</b></h3>
                ${game.i18n.format("CHATFATE." + type, { character: '<b>' + this.name + '</b>' })}<br>
                <b>${game.i18n.localize("CHATFATE.PointsRemaining")}</b>: ${this.data.data.status.fatePoints.value - 1}`;

            let newTestData = data.preData
            switch (type) {
                case "rerollDamage":
                    cardOptions.fatePointDamageRerollUsed = true;
                    if (data.originalTargets && data.originalTargets.size > 0) {
                        game.user.targets = data.originalTargets;
                        game.user.targets.user = game.user;
                    }
                    if (!data.defenderMessage && data.startMessagesList) {
                        cardOptions.startMessagesList = data.startMessagesList;
                    }
                    let newRoll = []
                    let smallestIndex = 0
                    let smallest = 500
                    let index = 0
                    for (let k of data.postData.damageRoll.terms) {
                        if (k.class == 'Die') {
                            if (Number(k.results[0].result) < smallest) {
                                smallest = k.results[0].result
                                smallestIndex = index
                            }
                        }
                        index += 1
                    }
                    let oldDamageRoll = duplicate(data.postData.damageRoll)
                    let term = oldDamageRoll.terms[smallestIndex]
                    newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                    newRoll = new Roll(newRoll.join("+")).roll()
                    DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)
                    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
                    oldDamageRoll.total = oldDamageRoll.total - oldDamageRoll.results[smallestIndex] + newRoll.results[0]
                    oldDamageRoll.results[smallestIndex] = newRoll.results[0]
                    oldDamageRoll.terms[smallestIndex].results[0].result = newRoll.result[0]

                    newTestData.damageRoll = oldDamageRoll

                    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                    message.update({
                        "flags.data.fatePointDamageRerollUsed": true
                    });
                    this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })

                    break
                case "isTalented":
                    cardOptions.talentedRerollUsed = true;
                    if (data.originalTargets && data.originalTargets.size > 0) {
                        game.user.targets = data.originalTargets;
                        game.user.targets.user = game.user;
                    }
                    if (!data.defenderMessage && data.startMessagesList) {
                        cardOptions.startMessagesList = data.startMessagesList;
                    }
                    infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.faitepointUsed")}</b></h3>
                        ${game.i18n.format("CHATFATE." + type, { character: '<b>' + this.name + '</b>' })}<br>`;
                    renderTemplate('systems/dsa5/templates/dialog/isTalentedReroll-dialog.html', { testData: newTestData, postData: data.postData }).then(html => {
                        new DSA5Dialog({
                            title: game.i18n.localize("CHATFATE.selectDice"),
                            content: html,
                            buttons: {
                                Yes: {
                                    icon: '<i class="fa fa-check"></i>',
                                    label: game.i18n.localize("Ok"),
                                    callback: dlg => {

                                        let diesToReroll = dlg.find('.dieSelected').map(function() { return Number($(this).attr('data-index')) }).get()
                                        if (diesToReroll.length > 0) {

                                            let newRoll = []
                                            for (let k of diesToReroll) {
                                                let term = newTestData.roll.terms[k * 2]
                                                newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                                            }
                                            newRoll = new Roll(newRoll.join("+")).roll()
                                            DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

                                            ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
                                            let ind = 0
                                            for (let k of diesToReroll) {
                                                newTestData.roll.results[k * 2] = newRoll.results[ind * 2]
                                                newTestData.roll.terms[k * 2].results[0].result = newRoll.results[ind * 2]
                                                ind += 1
                                            }
                                            this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                            message.update({
                                                "flags.data.talentedRerollUsed": true
                                            });
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
                    break
                case "reroll":
                    cardOptions.fatePointDamageRerollUsed = true;
                    if (data.originalTargets && data.originalTargets.size > 0) {
                        game.user.targets = data.originalTargets;
                        game.user.targets.user = game.user;
                    }
                    if (!data.defenderMessage && data.startMessagesList) {
                        cardOptions.startMessagesList = data.startMessagesList;
                    }
                    renderTemplate('systems/dsa5/templates/dialog/fateReroll-dialog.html', { testData: newTestData, postData: data.postData }).then(html => {

                        new DSA5Dialog({
                            title: game.i18n.localize("CHATFATE.selectDice"),
                            content: html,
                            buttons: {
                                Yes: {
                                    icon: '<i class="fa fa-check"></i>',
                                    label: game.i18n.localize("Ok"),
                                    callback: dlg => {

                                        let diesToReroll = dlg.find('.dieSelected').map(function() { return Number($(this).attr('data-index')) }).get()
                                        if (diesToReroll.length > 0) {

                                            let newRoll = []
                                            for (let k of diesToReroll) {
                                                let term = newTestData.roll.terms[k * 2]
                                                newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]")
                                            }
                                            newRoll = new Roll(newRoll.join("+")).roll()
                                            DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode)

                                            ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
                                            let ind = 0
                                            for (let k of diesToReroll) {
                                                newTestData.roll.results[k * 2] = newRoll.results[ind * 2]
                                                newTestData.roll.terms[k * 2].results[0].result = newRoll.results[ind * 2]
                                                ind += 1
                                            }
                                            this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                                            message.update({
                                                "flags.data.fatePointRerollUsed": true
                                            });
                                            this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })
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

                    break
                case "addQS":
                    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
                    game.user.targets.forEach(t => t.setTarget(false, { user: game.user, releaseOthers: false, groupSelection: true }));

                    cardOptions.fatePointAddQSUsed = true;
                    newTestData.qualityStep = 1

                    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                    message.update({
                        "flags.data.fatePointAddQSUsed": true
                    });
                    this.update({ "data.status.fatePoints.value": this.data.data.status.fatePoints.value - 1 })
                    break
            }
        }
    }
    setupRegeneration(statusId, options = {}) {
        let title = game.i18n.localize("regenerationTest");

        let testData = {
            source: {
                type: "regeneration"
            },
            opposable: false,
            extra: {
                statusId: statusId,
                actor: this.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/regeneration-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                testData.situationalModifiers = []
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

    setupStatus(statusId, options = {}) {
        let char = this.data.data.status[statusId];
        let title = game.i18n.localize(statusId) + " " + game.i18n.localize("Test");

        let testData = {
            source: char,
            opposable: false,
            extra: {
                statusId: statusId,
                actor: this.data,
                options: options
            }
        };

        testData.source.type = "status"

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/status-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
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

    setupCharacteristic(characteristicId, options = {}) {
        let char = this.data.data.characteristics[characteristicId];
        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

        let testData = {
            opposable: false,
            source: char,
            extra: {
                characteristicId: characteristicId,
                actor: this.data,
                options: options
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
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

    setupSpell(spell, options = {}) {
        let sheet = "spell"
        if (spell.type == "ceremony" || spell.type == "liturgy")
            sheet = "liturgy"

        let title = spell.name + " " + game.i18n.localize(`${spell.type}Test`);

        let testData = {
            opposable: false,
            source: spell,
            extra: {
                actor: this.data,
                options: options,
            }
        };

        let data = {
            rollMode: options.rollMode,
            spellCost: spell.data.AsPCost.value,
            maintainCost: spell.data.maintainCost.value,
            spellCastingTime: spell.data.castingTime.value,
            spellReach: spell.data.range.value,
            canChangeCost: spell.data.canChangeCost.value == "true",
            canChangeRange: spell.data.canChangeRange.value == "true",
            canChangeCastingTime: spell.data.canChangeCastingTime.value == "true",
            hasSKModifier: spell.data.resistanceModifier.value == "SK",
            hasZKModifier: spell.data.resistanceModifier.value == "ZK",
            maxMods: Math.floor(Number(spell.data.talentValue.value) / 4)
        }

        let dialogOptions = {
            title: title,
            template: `/systems/dsa5/templates/dialog/${sheet}-dialog.html`,

            data: data,
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = 0
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
                testData.calculatedSpellModifiers = {
                    castingTime: html.find(".castingTime").text(),
                    cost: html.find(".aspcost").text(),
                    reach: html.find(".reach").text(),
                    maintainCost: html.find(".maintainCost").text()
                }
                testData.situationalModifiers.push({
                    name: game.i18n.localize("removeGestureOrFormula"),
                    value: html.find('[name="removeGestureOrFormula"]').is(":checked") ? -2 : 0
                }, {
                    name: game.i18n.localize("castingTime"),
                    value: html.find(".castingTime").data("mod")
                }, {
                    name: game.i18n.localize("cost"),
                    value: html.find(".aspcost").data('mod')
                }, {
                    name: game.i18n.localize("reach"),
                    value: html.find(".reach").data('mod')
                }, {
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0
                }, {
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0
                }, {
                    name: game.i18n.localize("maintainedSpells"),
                    value: Number(html.find('[name="maintainedSpells"]').val()) * -1
                })
                if (spell.type == "ceremony") {
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("CEREMONYMODIFIER.artefact"),
                        value: html.find('[name="artefactUsage"]').is(":checked") ? 1 : 0
                    }, {
                        name: game.i18n.localize("place"),
                        value: html.find('[name="placeModifier"]').val()
                    }, {
                        name: game.i18n.localize("time"),
                        value: html.find('[name="timeModifier"]').val()
                    })
                } else if (spell.type == "ritual") {
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("RITUALMODIFIER.rightClothes"),
                        value: html.find('[name="rightClothes"]').is(":checked") ? 1 : 0
                    }, {
                        name: game.i18n.localize("RITUALMODIFIER.rightEquipment"),
                        value: html.find('[name="rightEquipment"]').is(":checked") ? 1 : 0
                    }, {
                        name: game.i18n.localize("place"),
                        value: html.find('[name="placeModifier"]').val()
                    }, {
                        name: game.i18n.localize("time"),
                        value: html.find('[name="timeModifier"]').val()
                    })
                }
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/spell-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    _parseModifiers(search) {
        let res = []
        $(search + " option:selected").each(function() {
            res.push({
                name: $(this).text().trim(),
                value: Number($(this).val())
            })
        })
        return res
    }

    setupSkill(skill, options = {}) {
        let title = skill.name + " " + game.i18n.localize("Test");

        let testData = {
            opposable: true,
            source: skill,
            extra: {
                actor: this.data,
                options: options,
            }
        };

        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/skill-dialog.html",
            data: {
                rollMode: options.rollMode
            },
            callback: (html) => {
                cardOptions.rollMode = html.find('[name="rollMode"]').val();
                testData.testModifier = Number(html.find('[name="testModifier"]').val());
                testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
                testData.situationalModifiers = this._parseModifiers('[name = "situationalModifiers"]')
                return { testData, cardOptions };
            }
        };

        let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/skill-card.html", title)

        return DiceDSA5.setupDialog({
            dialogOptions: dialogOptions,
            testData: testData,
            cardOptions: cardOptions
        });
    }

    static _prepareitemStructure(item) {
        if (item.data.structure && item.data.structure.max != 0) {
            item.structureMax = item.data.structure.max
            item.structureCurrent = item.data.structure.value
        }
        return item
    }

    static _prepareMeleetrait(item) {
        item.attack = Number(item.data.at.value)
        return this._parseDmg(item)
    }
    static _prepareMeleeWeapon(item, combatskills, actorData, wornWeapons = null) {
        let skill = combatskills.filter(i => i.name == item.data.combatskill.value)[0]
        item.attack = Number(skill.data.attack.value) + Number(item.data.atmod.value)
        item.parry = Number(skill.data.parry.value) + Number(item.data.pamod.value) + (item.data.combatskill.value == game.i18n.localize('LocalizedIDs.shields') ? Number(item.data.pamod.value) : 0)

        if (!/\(2H/.test(item.name)) {
            if (!wornWeapons)
                wornWeapons = actorData.items.filter(x => (x.type == "meleeweapon" && x.data.worn.value && x._id != item._id))
            item.parry += Math.max(0, ...wornWeapons.map(x => x.data.pamod.offhandMod))
            item.attack += Math.max(0, ...wornWeapons.map(x => x.data.atmod.offhandMod))
        }

        item = this._parseDmg(item)
        if (item.data.guidevalue.value != "-") {
            let val = Math.max(...(item.data.guidevalue.value.split("/").map(x => Number(actorData.data.characteristics[x].value))));
            let extra = val - Number(item.data.damageThreshold.value)

            if (extra > 0) {
                item.extraDamage = extra;
                item.damageAdd = eval(item.damageAdd + " + " + Number(extra))
                item.damageAdd = (item.damageAdd > 0 ? "+" : "") + item.damageAdd
            }
        }

        return item;
    }

    static _prepareRangeTrait(item) {
        item.attack = Number(item.data.at.value)
        return this._parseDmg(item)
    }

    static _parseDmg(item) {
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/, "d"))
        let damageDie = "",
            damageTerm = ""
        for (let k of parseDamage.terms) {
            if (typeof(k) == 'object') {
                damageDie = k.number + "d" + k.faces
            } else {
                damageTerm += k
            }
        }
        damageTerm = eval(damageTerm)
        item.damagedie = damageDie ? damageDie : "0d6"
        item.damageAdd = damageTerm != undefined ? (Number(damageTerm) > 0 ? "+" : "") + damageTerm : ""
        return item
    }


    static _prepareRangeWeapon(item, ammunitions, combatskills, actor) {
        let skill = combatskills.filter(i => i.name == item.data.combatskill.value)[0];
        item.attack = Number(skill.data.attack.value)

        if (item.data.ammunitiongroup.value != "-") {
            if (ammunitions)
                item.ammo = ammunitions.filter(x => x.data.ammunitiongroup.value == item.data.ammunitiongroup.value)
            else
                item.ammo = actorData.inventory.ammunition.items.filter(x => x.data.ammunitiongroup.value == item.data.ammunitiongroup.value)
        }
        item.LZ = Math.max(0, Number(item.data.reloadTime.value) - SpecialabilityRulesDSA5.abilityStep(actor, `${game.i18n.localize('LocalizedIDs.quickload')} (${game.i18n.localize(item.data.combatskill.value)})`))

        return this._parseDmg(item)
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
            cardOptions.speaker.scene = canvas.scene._id
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
        let result = DiceDSA5.rollTest(testData);

        result.postFunction = "basicTest";
        if (testData.extra)
            mergeObject(result, testData.extra);

        if (game.user.targets.size) {
            cardOptions.isOpposedTest = testData.opposable
            if (cardOptions.isOpposedTest)
                cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
            else {
                game.user.updateTokenTargets([]);
            }
        }

        if (testData.extra.ammo && !testData.extra.ammoDecreased) {
            testData.extra.ammoDecreased = true
            testData.extra.ammo.data.quantity.value--;
            this.updateEmbeddedEntity("OwnedItem", { _id: testData.extra.ammo._id, "data.quantity.value": testData.extra.ammo.data.quantity.value });
        }

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(msg => {
                OpposedDsa5.handleOpposedTarget(msg)
            })
        return { result, cardOptions };
    }


    async addCondition(effect, value = 1, absolute = false, auto = true) {
        if (absolute && value <= 0) {
            return this.removeCondition(effect, value, auto, absolute)
        }

        if (typeof(effect) === "string")
            effect = duplicate(CONFIG.statusEffects.find(e => e.id == effect))
        if (!effect)
            return "No Effect Found"

        if (!effect.id)
            return "Conditions require an id field"

        let existing = this.hasCondition(effect.id)

        if (existing && existing.flags.dsa5.value == null)
            return existing
        else if (existing) {
            return await DSA5StatusEffects.updateEffect(this, existing, value, absolute, auto)
        } else if (!existing) {
            return await DSA5StatusEffects.createEffect(this, effect, value, auto)
        }
    }

    async _dependentEffects(statusId, effect, delta) {
        if (effect.flags.dsa5.value == 4 && ["encumbered", "stunned", "feared", "inpain", "confused"].includes(statusId))
            await this.addCondition("incapacitated")

        if (effect.flags.dsa5.value == 4 && (statusId == "paralysed"))
            await this.addCondition("rooted")

        if (statusId == "unconscious")
            await this.addCondition("prone")

        //if (game.combat && (effect.id == "blinded" || effect.id == "deafened"))
        //    effect.flags.dsa5.roundReceived = game.combat.round

        if (delta > 0 && statusId == "inpain" && !this.hasCondition("bloodrush") && AdvantageRulesDSA5.hasVantage(this, game.i18n.localize('LocalizedIDs.frenzy'))) {
            await this.addCondition("bloodrush")
            let msg = `${game.i18n.format("CHATNOTIFICATION.gainsBloodrush", {character: "<b>" + this.name + "</b>"})}`;
            ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
        }
    }

    async removeCondition(effect, value = 1, auto = true, absolute = false) {
        if (typeof(effect) === "string")
            effect = duplicate(CONFIG.statusEffects.find(e => e.id == effect))
        if (!effect)
            return "No Effect Found"

        if (!effect.id)
            return "Conditions require an id field"

        let existing = this.hasCondition(effect.id)

        if (existing && existing.flags.dsa5.value == null) {
            return this.deleteEmbeddedEntity("ActiveEffect", existing._id)
        } else if (existing) {
            return await DSA5StatusEffects.removeEffect(this, existing, value, absolute, auto)
        }
    }

    hasCondition(conditionKey) {
        if (this.data != undefined) {
            if (this.data.effects == undefined)
                return false

            return this.data.effects.find(i => getProperty(i, "flags.core.statusId") == conditionKey)
        }
        return false
    }
}