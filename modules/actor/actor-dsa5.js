import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js"
import DiceDSA5 from "../system/dice-dsa5.js"
import OpposedDsa5 from "../system/opposed-dsa5.js";

export default class Actordsa5 extends Actor {
    static async create(data, options) {
        console.log(data)
        if (data instanceof Array)
            return super.create(data, options);

        if (data.items)
            return super.create(data, options);

        data.items = [];

        data.flags = {

        }

        if (!data.img || data.img == "icons/svg/mystery-man.svg") {
            switch (data.type) {
                case "character":
                    data.img = "icons/svg/mystery-man-black.svg";
                    break;
                default:
                    data.img = "icons/svg/mystery-man-black.svg";
            }
        }

        let skills = await DSA5_Utility.allSkills() || [];
        let combatskills = await DSA5_Utility.allCombatSkills() || [];
        let moneyItems = await DSA5_Utility.allMoneyItems() || [];

        moneyItems = moneyItems.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        //if (data.type == "character" || data.type == "npc") {
        data.items = data.items.concat(skills);
        data.items = data.items.concat(combatskills);
        //}

        data.items = data.items.concat(moneyItems.map(m => {
            m.data.quantity.value = 0
            return m
        }));

        super.create(data, options);


    }

    prepareBaseData() {
        for (let ch of Object.values(this.data.data.characteristics)) {
            ch.value = ch.initial + ch.advances + (ch.modifier || 0);
            ch.bonus = Math.floor(ch.value / 10)
            ch.cost = DSA5_Utility._calculateAdvCost(ch.advances, "characteristic")
        }

    }

    prepareData() {
        try {
            super.prepareData();
            const data = this.data;

            if (this.data.type == "character" || this.data.type == "npc") {
                data.data.status.wounds.current = data.data.status.wounds.initial + data.data.characteristics["ko"].value * 2;

                data.data.status.soulpower.value = (data.data.status.soulpower.initial ? data.data.status.soulpower.initial : 0) + Math.round((data.data.characteristics["mu"].value + data.data.characteristics["kl"].value + data.data.characteristics["in"].value) / 6);
                data.data.status.toughness.value = (data.data.status.toughness.initial ? data.data.status.toughness.initial : 0) + Math.round((data.data.characteristics["ko"].value + data.data.characteristics["ko"].value + data.data.characteristics["kk"].value) / 6);
                data.data.status.fatePoints.max = Number(data.data.status.fatePoints.current) + Number(data.data.status.fatePoints.modifier);

                data.data.status.initiative.value = Math.round((data.data.characteristics["mu"].value + data.data.characteristics["ge"].value) / 2) + (data.data.status.initiative.modifier || 0);
            }

            if (this.data.type == "character") {
                data.data.details.experience.current = data.data.details.experience.total - data.data.details.experience.spent;
                data.data.details.experience.description = DSA5_Utility.experienceDescription(data.data.details.experience.total)
            } else if (this.data.type == "creature") {
                data.data.status.wounds.current = data.data.status.wounds.initial
                data.data.status.astralenergy.current = data.data.status.astralenergy.initial
                data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial
                data.data.status.initiative.value = data.data.status.initiative.current + +(data.data.status.initiative.modifier || 0);
            }

            data.data.status.wounds.max = data.data.status.wounds.current + data.data.status.wounds.modifier + data.data.status.wounds.advances;
            data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances;
            data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances;

            var guide = data.data.guidevalue

            if (guide) {
                //if (guide.value != "-") {
                if (data.data.characteristics[guide.value]) {
                    data.data.status.astralenergy.current = data.data.status.astralenergy.initial + data.data.characteristics[guide.value].value
                    data.data.status.astralenergy.max = data.data.status.astralenergy.current + data.data.status.astralenergy.modifier + data.data.status.astralenergy.advances
                    data.data.status.karmaenergy.current = data.data.status.karmaenergy.initial + data.data.characteristics[guide.value].value
                    data.data.status.karmaenergy.max = data.data.status.karmaenergy.current + data.data.status.karmaenergy.modifier + data.data.status.karmaenergy.advances
                }
            }

            data.data.status.speed.max = data.data.status.speed.initial + (data.data.status.speed.modifier || 0)

            data.data.status.soulpower.max = data.data.status.soulpower.value + data.data.status.soulpower.modifier;
            data.data.status.toughness.max = data.data.status.toughness.value + data.data.status.toughness.modifier;
            this._calculateStatus(data, "dodge")


        } catch (error) {
            console.error("Something went wrong with preparing actor data: " + error + error.stack)
            ui.notifications.error(game.i18n.localize("ACTOR.PreparationError") + error + error.stack)
        }
    }

    _calculateStatus(data, attr) {
        switch (attr) {
            case "dodge":
                data.data.status.dodge.value = Math.round(data.data.characteristics["ge"].value / 2);
                data.data.status.dodge.max = data.data.status.dodge.value + data.data.status.dodge.modifier;
                return data.data.status.dodge.max
                break;
        }
    }

    prepare() {
        let preparedData = duplicate(this.data)
            // Call prepareItems first to organize and process OwnedItems
        mergeObject(preparedData, this.prepareItems())



        return preparedData;
    }



    static _calculateCombatSkillValues(i, actorData) {
        if (i.data.weapontype.value == "melee") {
            let vals = i.data.guidevalue.value.split('/').map(x =>
                actorData.data.characteristics[x].value + actorData.data.characteristics[x].modifier + actorData.data.characteristics[x].advances
            );
            let parryChar = Math.max(...vals);
            i.data.parry.value = Math.ceil(i.data.talentValue.value / 2) + Math.floor((parryChar - 8) / 3);
            let attackChar = actorData.data.characteristics.mu.value + actorData.data.characteristics.mu.modifier + actorData.data.characteristics.mu.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        } else {
            i.data.parry.value = 0;
            let attackChar = actorData.data.characteristics.ff.value + actorData.data.characteristics.ff.modifier + actorData.data.characteristics.ff.advances;
            i.data.attack.value = i.data.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
        }
        return i;
    }

    prepareItems() {
        let actorData = duplicate(this.data)
        let bodySkills = [];
        let socialSkills = [];
        let knowledgeSkills = [];
        let tradeSkills = [];
        let natureSkills = [];
        let combatskills = [];
        let advantages = [];
        let disadvantages = []
        let generalSpecialAbilites = []
        let combatSpecialAbilities = []
        let fatePointsAbilities = []
        let magicSpecialAbilities = []
        let clericSpecialAbilities = []
        let magicTricks = []
        let blessings = []

        let armor = [];
        let rangeweapons = [];
        let meleeweapons = [];

        let liturgies = []
        let spells = []
        let rituals = []
        let ceremonies = []
        let schips = []

        let equipmentModifiers = {}

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


        const money = {
            coins: [],
            total: 0,
            show: true
        }

        let meleeTraits = []
        let rangeTraits = []
        let armorTraits = []


        actorData.items = actorData.items.sort((a, b) => (a.sort || 0) - (b.sort || 0))

        let totalArmor = 0;

        let hasSpells = false
        let hasPrayers = false

        let totalWeight = 0;
        let encumbrance = 0;
        let carrycapacity = (actorData.data.characteristics.kk.value + actorData.data.characteristics.kk.modifier + actorData.data.characteristics.kk.advances) * 2;



        for (let i of actorData.items) {
            //try {
            //i.img = i.img || DEFAULT_TOKEN;

            // *********** TALENTS ***********
            switch (i.type) {
                case "skill":
                    this.prepareSkill(i);
                    switch (i.data.group.value) {
                        case "body":
                            bodySkills.push(i);
                            break;
                        case "social":
                            socialSkills.push(i);
                            break;
                        case "knowledge":
                            knowledgeSkills.push(i);
                            break;
                        case "trade":
                            tradeSkills.push(i);
                            break;
                        case "nature":
                            natureSkills.push(i);
                            break;
                    }
                    break;
                case "spell":
                    hasSpells = true
                    spells.push(i)
                    break;
                case "liturgy":
                    hasPrayers = true
                    liturgies.push(i)
                    break;
                case "ceremony":
                    hasPrayers = true
                    ceremonies.push(i)
                    break;
                case "ritual":
                    hasSpells = true
                    rituals.push(i)
                    break;
                case "blessing":
                    hasPrayers = true
                    blessings.push(i)
                    break;
                case "magictrick":
                    hasSpells = true
                    magicTricks.push(i)
                    break;
                case "trait":
                    if (i.data.traitType.value == "rangeAttack") {
                        rangeTraits.push(Actordsa5._prepareRangeTrait(i))
                    } else if (i.data.traitType.value == "meleeAttack") {
                        meleeTraits.push(Actordsa5._prepareMeleetrait(i))
                    } else if (i.data.traitType.value == "armor") {
                        armorTraits.push(i)
                        totalArmor += Number(i.data.at.value);
                    }

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
                    inventory.meleeweapons.items.push(i);
                    inventory.meleeweapons.show = true;
                    totalWeight += Number(i.weight);

                    break;
                case "rangeweapon":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.rangeweapons.items.push(i);
                    inventory.rangeweapons.show = true;
                    totalWeight += Number(i.weight);

                    break;
                case "armor":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    i.toggleValue = i.data.worn.value || false;
                    inventory.armor.items.push(i);
                    inventory.armor.show = true;
                    totalWeight += Number(i.weight);

                    if (i.data.worn.value) {
                        encumbrance += i.data.encumbrance.value;
                        totalArmor += i.data.protection.value;
                        this._addModifiers(equipmentModifiers, i)
                        armor.push(i);
                    }

                    break;
                case "equipment":
                    i.weight = parseFloat((i.data.weight.value * i.data.quantity.value).toFixed(3));
                    inventory[i.data.equipmentType.value].items.push(i);
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
                    switch (i.data.category.value) {
                        case "general":
                            generalSpecialAbilites.push(i)
                            break;
                        case "combat":
                            combatSpecialAbilities.push(i)
                            break
                        case "fatePoints":
                            fatePointsAbilities.push(i)
                            break;
                        case "magical":
                            magicSpecialAbilities.push(i)
                            break;
                        case "clerical":
                            clericSpecialAbilities.push(i)
                            break;
                    }
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
            if (wep.data.worn.value) {
                rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, inventory.ammunition, combatskills));
            }
        }
        let shields = inventory.meleeweapons.items.filter(x => (game.i18n.localize("ReverseCombatSkills." + x.data.combatskill.value) == "Shields" && x.data.worn.value))
        let shieldBonus = shields.length > 0 ? shields[0].data.pamod.value : 0
        for (let wep of inventory.meleeweapons.items) {
            if (wep.data.worn.value) {
                meleeweapons.push(Actordsa5._prepareMeleeWeapon(wep, combatskills, actorData, shieldBonus));
            }
        }

        if (equipmentModifiers.ini != undefined)
            this.data.data.status.initiative.value += equipmentModifiers.ini.value

        money.coins = money.coins.sort((a, b) => (a.data.price.value > b.data.price.value) ? -1 : 1);
        encumbrance += Math.max(0, Math.floor((totalWeight - carrycapacity) / 4));

        let pain = actorData.data.status.wounds.value <= 5 ? 4 : Math.floor((1 - actorData.data.status.wounds.value / actorData.data.status.wounds.max) * 4)

        /*this.update({
            "data.conditions.encumbered.value": encumbrance,
            "data.conditions.inpain.value": pain
        });*/
        this.data.data.conditions.inpain.value = pain
        this.data.data.conditions.encumbered.value = encumbrance

        //CHAR cannot be clerical and magical at the same time
        hasPrayers = hasPrayers && !hasSpells
        this.data.isMage = hasSpells
        this.data.isPriest = hasPrayers

        this._updateConditions()

        let eqModifierString = []
        for (var i in equipmentModifiers) {
            console.log(i)
            eqModifierString.push(i + " " + equipmentModifiers[i].value + " (" + equipmentModifiers[i].sources.join(", ") + ")")
        }

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
            generalSpecialAbilites: generalSpecialAbilites,
            combatSpecialAbilities: combatSpecialAbilities,
            fatePointsAbilities: fatePointsAbilities,
            clericSpecialAbilities: clericSpecialAbilities,
            wornArmor: armor,
            inventory,
            equipmentModifiers: eqModifierString.join(", "),
            rangeTraits: rangeTraits,
            meleeTraits: meleeTraits,
            armorTraits: armorTraits,
            magicSpecialAbilities: magicSpecialAbilities,
            blessings: blessings,
            magicTricks: magicTricks,
            hasPrayers: hasPrayers,
            schips: schips,
            guidevalues: DSA5.characteristics,
            hasSpells: hasSpells,
            spells: spells,
            rituals: rituals,
            ceremonies: ceremonies,
            liturgies: liturgies,
            combatskills: combatskills,
            allSkillsLeft: {
                body: bodySkills,
                social: socialSkills,
                nature: natureSkills
            },
            allSkillsRight: {
                knowledge: knowledgeSkills,
                trade: tradeSkills
            }
        }
    }

    _addModifiers(equipmentModifiers, i) {
        for (let mod of i.data.effect.value.toLowerCase().split(",").map(Function.prototype.call, String.prototype.trim)) {
            let vals = mod.split(" ")
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

    _updateConditions() {
        /*let r = {}
        for (let [key, val] of Object.entries(this.data.data.conditions)) {
            r["data.conditions." + key + ".max"] = (val.value || 0) + (val.modifier || 0)
        }
        this.update(r)*/
        for (let [key, val] of Object.entries(this.data.data.conditions)) {
            this.data.data.conditions[key].max = (val.value || 0) + (val.modifier || 0)
        }
    }

    /*getModifiers() {
        let r = []
        for (let [key, val] of Object.entries(this.data.data.conditions)) {
            if (val.max > 0) {
                r.push({
                    name: key,
                    value: (val.max * -1)
                })
            }

        }
        return r
    }*/

    static getModifiers(actor) {
        let r = []
        for (let [key, val] of Object.entries(actor.data.conditions)) {
            if (val.max > 0) {
                r.push({
                    name: "CONDITION." + key,
                    value: (val.max * -1),
                    selected: false
                })
            }

        }
        return r
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
            // Prefilled dialog data
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

    setupWeaponless(statusId, options = {}) {
        let title = game.i18n.localize(statusId + "Weaponless");

        let testData = {
            opposable: true,
            mode: statusId,
            source: DSA5.defaultWeapon,
            opposable: false,
            extra: {
                weaponless: true,
                statusId: statusId,
                actor: this.data,
                options: options
            }
        };
        testData.source.name = statusId
        testData.source.data.data.combatskill = {
            value: game.i18n.localize("Combatskill.wrestle")
        }
        testData.source.type = "meleeweapon"
        testData.source.data.data.damageThreshold.value = 14

        // Setup dialog data: title, template, buttons, prefilled data
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/status-dialog.html",
            // Prefilled dialog data
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

    setupStatus(statusId, options = {}) {
        let char = this.data.data.status[statusId];

        let title = game.i18n.localize(char.label) + " " + game.i18n.localize("Test");

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

        // Setup dialog data: title, template, buttons, prefilled data
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/status-dialog.html",
            // Prefilled dialog data
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

        // Setup dialog data: title, template, buttons, prefilled data
        let dialogOptions = {
            title: title,
            template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
            // Prefilled dialog data
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
        if (spell.type == "ceremony" || spell.type == "liturgy") {
            sheet = "liturgy"
            console.log(spell.type)
        }

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
                    reach: html.find(".reach").text()
                }
                testData.situationalModifiers.push({
                    name: game.i18n.localize("removeGestureOrFormula"),
                    value: html.find('[name="removeGestureOrFormula"]').is(":checked") ? -2 : 0
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("castingTime"),
                    value: html.find(".castingTime").data("mod")
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("cost"),
                    value: html.find(".aspcost").data('mod')
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("reach"),
                    value: html.find(".reach").data('mod')
                })

                testData.situationalModifiers.push({
                    name: game.i18n.localize("zkModifier"),
                    value: html.find('[name="zkModifier"]').val() || 0
                })

                testData.situationalModifiers.push({
                    name: game.i18n.localize("skModifier"),
                    value: html.find('[name="skModifier"]').val() || 0
                })
                testData.situationalModifiers.push({
                    name: game.i18n.localize("maintainedSpells"),
                    value: Number(html.find('[name="maintainedSpells"]').val()) * -1
                })
                if (spell.type == "ceremony") {
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("CEREMONYMODIFIER.artefact"),
                        value: html.find('[name="artefactUsage"]').is(":checked") ? 1 : 0
                    })

                    testData.situationalModifiers.push({
                        name: game.i18n.localize("place"),
                        value: html.find('[name="placeModifier"]').val()
                    })

                    testData.situationalModifiers.push({
                        name: game.i18n.localize("time"),
                        value: html.find('[name="timeModifier"]').val()
                    })
                } else if (spell.type == "ritual") {
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("RITUALMODIFIER.rightClothes"),
                        value: html.find('[name="rightClothes"]').is(":checked") ? 1 : 0
                    })
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("RITUALMODIFIER.rightEquipment"),
                        value: html.find('[name="rightEquipment"]').is(":checked") ? 1 : 0
                    })
                    testData.situationalModifiers.push({
                        name: game.i18n.localize("place"),
                        value: html.find('[name="placeModifier"]').val()
                    })

                    testData.situationalModifiers.push({
                        name: game.i18n.localize("time"),
                        value: html.find('[name="timeModifier"]').val()
                    })
                }
                console.log(testData)
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

    prepareSkill(skill) {

    }

    static _prepareMeleetrait(item) {
        item.attack = Number(item.data.at.value)
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/, "d"))
        let damageDie = ""
        let damageTerm = ""
        for (let k of parseDamage.terms) {
            if (typeof(k) == 'object') {
                damageDie = k.number + "d" + k.faces
            } else {
                damageTerm += k
            }
        }
        damageTerm = eval(damageTerm)
        item.damagedie = damageDie
        item.damageAdd = damageTerm != undefined ? "+" + damageTerm : ""
        return item
    }
    static _prepareMeleeWeapon(item, combatskills, actorData, shieldBonus) {
        let skill = combatskills.filter(i => i.name == item.data.combatskill.value)[0];
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/, "d"))
        let damageDie = ""
        let damageTerm = ""
        for (let k of parseDamage.terms) {
            if (typeof(k) == 'object') {
                damageDie = k.number + "d" + k.faces
            } else {
                damageTerm += k
            }
        }

        item.attack = Number(skill.data.attack.value) + Number(item.data.atmod.value);
        if (item.data.guidevalue.value != "-") {
            let val = Math.max(...(item.data.guidevalue.value.split("/").map(x => actorData.data.characteristics[x].value)));
            let extra = val - item.data.damageThreshold.value;


            if (extra > 0) {
                item.extraDamage = extra;
                damageTerm += "+" + extra
            }


        }
        damageTerm = eval(damageTerm)
        item.damagedie = damageDie
        item.damageAdd = damageTerm != undefined ? "+" + damageTerm : ""
        item.parry = Number(skill.data.parry.value) + Number(item.data.pamod.value) + Number(shieldBonus);
        //shield block gains double parry bonus
        //if (game.i18n.localize("ReverseCombatSkills." + skill.name) == "Shields")
        //    item.parry += item.data.pamod.value
        //else
        //    item.parry += shieldBonus
        return item;
    }

    static _prepareRangeTrait(item) {
        item.attack = Number(item.data.at.value)
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/, "d"))
        let damageDie = ""
        let damageTerm = ""
        for (let k of parseDamage.terms) {
            if (typeof(k) == 'object') {
                damageDie = k.number + "d" + k.faces
            } else {
                damageTerm += k
            }
        }
        damageTerm = eval(damageTerm)
        item.damagedie = damageDie
        item.damageAdd = damageTerm != undefined ? "+" + damageTerm : ""
        return item
    }
    static _prepareRangeWeapon(item, ammunition, combatskills) {
        let skill = combatskills.filter(i => i.name == item.data.combatskill.value)[0];
        item.attack = Number(skill.data.attack.value)
        let parseDamage = new Roll(item.data.damage.value.replace(/[Ww]/, "d"))
        let damageDie = ""
        let damageTerm = ""
        for (let k of parseDamage.terms) {
            if (typeof(k) == 'object') {
                damageDie = k.number + "d" + k.faces
            } else {
                damageTerm += k
            }
        }
        damageTerm = eval(damageTerm)
        item.damagedie = damageDie
        item.damageAdd = damageTerm != undefined ? "+" + damageTerm : ""
        return item;
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
            // img to be displayed next to the name on the test card - if it's a wildcard img, use the actor image
        }

        // If the test is coming from a token sheet
        if (this.token) {
            cardOptions.speaker.alias = this.token.data.name; // Use the token name instead of the actor name
            cardOptions.speaker.token = this.token.data._id;
            cardOptions.speaker.scene = canvas.scene._id
            cardOptions.flags.img = this.token.data.img; // Use the token image instead of the actor image
        } else // If a linked actor - use the currently selected token's data if the actor id matches
        {
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

        Hooks.call("dsa5:rollTest", result, cardOptions)

        //if (game.user.targets.size) {
        //  cardOptions.title += ` - ${game.i18n.localize("Opposed")}`;
        //  cardOptions.isOpposedTest = true
        //}

        if (!options.suppressMessage)
            DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage).then(msg => {
                OpposedDsa5.handleOpposedTarget(msg) // Send to handleOpposed to determine opposed status, if any.
            })
        return { result, cardOptions };
    }

    static async renderRollCard(chatOptions, testData, rerenderMessage) {
        testData.other = testData.other.join("<br>")

        let chatData = {
            title: chatOptions.title,
            testData: testData,
            hideData: game.user.isGM
        }

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
        else if (chatOptions.rollMode === "selfroll") chatOptions["whisper"] = [game.user];

        // All the data need to recreate the test when chat card is edited
        chatOptions["flags.data"] = {
            preData: chatData.testData.preData,
            postData: chatData.testData,
            template: chatOptions.template,
            rollMode: chatOptions.rollMode,
            title: chatOptions.title,
            hideData: chatData.hideData,
            isOpposedTest: chatOptions.isOpposedTest,
            attackerMessage: chatOptions.attackerMessage,
            defenderMessage: chatOptions.defenderMessage,
            unopposedStartMessage: chatOptions.unopposedStartMessage,
            startMessagesList: chatOptions.startMessagesList
        };

        if (!rerenderMessage) {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {
                // Emit the HTML as a chat message
                if (game.settings.get("wfrp4e", "manualChatCards")) {
                    let blank = $(html)
                    let elementsToToggle = blank.find(".display-toggle")

                    for (let elem of elementsToToggle) {
                        if (elem.style.display == "none")
                            elem.style.display = ""
                        else
                            elem.style.display = "none"
                    }
                    html = blank.html();
                }

                chatOptions["content"] = html;
                return ChatMessage.create(chatOptions, false);
            });
        } else // Update message 
        {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {

                // Emit the HTML as a chat message
                chatOptions["content"] = html;

                return rerenderMessage.update({
                    content: html,
                    ["flags.data"]: chatOptions["flags.data"]
                }).then(newMsg => {
                    ui.chat.updateMessage(newMsg);
                    return newMsg;
                });
            });
        }
    }
}