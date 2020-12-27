import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5 from "./config-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js"
import Miscast from "../tables/spellmiscast.js"

export default class DiceDSA5 {
    static async setupDialog({ dialogOptions, testData, cardOptions, }) {
        let rollMode = game.settings.get("core", "rollMode");
        let skMod = 0
        let zkMod = 0
        var sceneStress = "challenging";

        mergeObject(testData, {
            testDifficulty: sceneStress,
            testModifier: 0,
        });

        mergeObject(dialogOptions.data, {
            testDifficulty: sceneStress,
            testModifier: (dialogOptions.data.modifier || 0)
        });

        let situationalModifiers = Actordsa5.getModifiers(testData.extra.actor)
        switch (testData.source.type) {
            case "skill":
                if (testData.source.data.burden.value == "no") {
                    this._removeModifiers(situationalModifiers, ["CONDITION.encumbered"])
                } else {
                    this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered"], testData.source.data.burden.value == "yes")
                }
                mergeObject(dialogOptions.data, {
                    difficultyLabels: (DSA5.skillDifficultyLabels)
                });
                break;
            case "rangeweapon":
                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                let targetSize = "average"
                if (game.user.targets.size) {
                    game.user.targets.forEach(target => {
                        let tar = target.actor.data.data.size
                        if (tar)
                            targetSize = tar.value
                    });
                }
                mergeObject(dialogOptions.data, {
                    rangeOptions: DSA5.rangeWeaponModifiers,
                    sizeOptions: DSA5.rangeSizeCategories,
                    visionOptions: DSA5.rangeVision,
                    mountedOptions: DSA5.mountedRangeOptions,
                    shooterMovementOptions: DSA5.shooterMovementOptions,
                    targetMovementOptions: DSA5.targetMomevementOptions,
                    targetSize: targetSize
                });
                break;
            case "regeneration":
                mergeObject(dialogOptions.data, {
                    regenerationInterruptOptions: DSA5.regenerationInterruptOptions,
                    regnerationCampLocations: DSA5.regnerationCampLocations
                });
                break
            case "trait":
                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                if (testData.mode == "attack" && testData.source.data.data.traitType.value == "meleeAttack") {
                    let targetWeaponsize = "short"
                    if (game.user.targets.size) {
                        game.user.targets.forEach(target => {
                            let defWeapon = target.actor.items.filter(x => x.data.type == "meleeweapon" && x.data.data.worn.value)
                            if (defWeapon.length > 0)
                                targetWeaponsize = defWeapon[0].data.data.reach.value
                        });
                    }
                    mergeObject(dialogOptions.data, {
                        weaponSizes: DSA5.meleeRanges,
                        melee: true,
                        targetWeaponSize: targetWeaponsize
                    });
                } else if (testData.mode == "attack" && testData.source.data.data.traitType.value == "rangeAttack") {
                    let targetSize = "average"
                    if (game.user.targets.size) {
                        game.user.targets.forEach(target => {
                            let tar = target.actor.data.data.size
                            if (tar)
                                targetSize = tar.value
                        });
                    }
                    mergeObject(dialogOptions.data, {
                        rangeOptions: DSA5.rangeWeaponModifiers,
                        sizeOptions: DSA5.rangeSizeCategories,
                        visionOptions: DSA5.rangeVision,
                        targetSize: targetSize
                    });
                }
                break
            case "meleeweapon":
                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                if (testData.mode == "attack") {
                    let targetWeaponsize = "short"
                    if (game.user.targets.size) {
                        game.user.targets.forEach(target => {
                            let defWeapon = target.actor.items.filter(x => x.data.type == "meleeweapon" && x.data.data.worn.value)
                            if (defWeapon.length > 0)
                                targetWeaponsize = defWeapon[0].data.data.reach.value
                        });
                    }
                    mergeObject(dialogOptions.data, {
                        weaponSizes: DSA5.meleeRanges,
                        melee: true,
                        targetWeaponSize: targetWeaponsize
                    });
                } else if (testData.mode == "parry") {
                    mergeObject(dialogOptions.data, {
                        defenseCount: 0,
                        showDefense: true,
                        melee: true
                    });
                } else {}
                break
            case "combatskill":
                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                break
            case "liturgy":
            case "spell":
                if (game.user.targets.size) {
                    game.user.targets.forEach(target => {
                        skMod = target.actor.data.data.status.soulpower.max
                        zkMod = target.actor.data.data.status.toughness.max
                    });
                }
                mergeObject(dialogOptions.data, {
                    SKModifier: skMod,
                    ZKModifier: zkMod
                });

                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                break;
            case "ceremony":
                if (game.user.targets.size) {
                    game.user.targets.forEach(target => {
                        skMod = target.actor.data.data.status.soulpower.max
                        zkMod = target.actor.data.data.status.toughness.max
                    });
                }
                mergeObject(dialogOptions.data, {
                    SKModifier: skMod,
                    ZKModifier: zkMod,
                    isCeremony: true,
                    locationModifiers: DSA5.ceremonyLocationModifiers,
                    timeModifiers: DSA5.ceremonyTimeModifiers
                })
                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                break
            case "ritual":
                if (game.user.targets.size) {
                    game.user.targets.forEach(target => {
                        skMod = target.actor.data.data.status.soulpower.max
                        zkMod = target.actor.data.data.status.toughness.max
                    });
                }
                mergeObject(dialogOptions.data, {
                    SKModifier: skMod,
                    ZKModifier: zkMod,
                    isRitual: true,
                    locationModifiers: DSA5.ritualLocationModifiers,
                    timeModifiers: DSA5.ritualTimeModifiers
                })
                this._enabledModifiers(situationalModifiers, ["CONDITION.encumbered", "CONDITION.inpain"], true)
                break
            case "status":
                break;
            default:
                mergeObject(dialogOptions.data, {
                    difficultyLabels: (DSA5.attributeDifficultyLabels)
                });
        }

        mergeObject(dialogOptions.data, {
            hasSituationalModifiers: situationalModifiers.length > 0,
            situationalModifiers: situationalModifiers
        })
        mergeObject(cardOptions, {
            user: game.user._id,
        })

        dialogOptions.data.rollMode = dialogOptions.data.rollMode || rollMode;
        if (CONFIG.Dice.rollModes)
            dialogOptions.data.rollModes = CONFIG.Dice.rollModes;
        else
            dialogOptions.data.rollModes = CONFIG.rollModes;


        if (!testData.extra.options.bypass) {
            // Render Test Dialog
            let html = await renderTemplate(dialogOptions.template, dialogOptions.data);
            return new Promise((resolve, reject) => {
                new DSA5Dialog({
                    title: dialogOptions.title,
                    content: html,
                    buttons: {
                        rollButton: {
                            label: game.i18n.localize("Roll"),
                            callback: html => resolve(dialogOptions.callback(html))
                        }
                    },
                    default: "rollButton"
                }).render(true);
            })
        } else {
            testData.testModifier = testData.extra.options.testModifier || testData.testModifier
            cardOptions.rollMode = testData.extra.options.rollMode || rollMode
            resolve({ testData, cardOptions })
        }
        reject()
    }

    static _enabledModifiers(modifiers, names, enabled) {
        for (var x in names) {
            if (modifiers[x])
                modifiers[x].selected = enabled
        }
    }
    static _removeModifiers(modifiers, names) {
        for (var x in names) {
            if (modifiers[x])
                delete modifiers[x]
        }
    }

    static _rollSingleD20(roll, res, id, modifier, testData) {
        let description = "";

        var chars = []
        res += modifier
        let res1 = res - roll.terms[0].results[0].result;
        let color = DSA5.dieColors[id] || id;

        chars.push({ char: id, res: roll.terms[0].results[0].result, suc: res1 >= 0, tar: res });
        let rollConfirm = new Roll("1d20").roll();
        let successLevel = res1 >= 0 ? 1 : -1

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            this._addRollDiceSoNice(testData, rollConfirm, color)
            chars.push({ char: id, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
            successLevel = res2 >= 0 ? 3 : 2
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            this._addRollDiceSoNice(testData, rollConfirm, color)
            chars.push({ char: id, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
            successLevel = res2 >= 0 ? -2 : -3
        }

        if (description == "") {
            description = game.i18n.localize(res1 >= 0 ? "Success" : "Failure");
        }

        return {
            //result: res,
            successLevel: successLevel,
            characteristics: chars,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
    }


    static rollRegeneration(testData) {
        let modifier = testData.testModifier + this._situationalModifiers(testData);
        let roll = testData.roll
        var chars = []


        chars.push({ char: "LeP", res: roll.terms[0].results[0].result, die: "d6" })

        let result = {
            rollType: "regeneration",
            LeP: Math.round(Math.max(0, Number(roll.terms[0].results[0].result) - Number(modifier)) * Number(testData.regenerationFactor)),
            preData: testData,
            modifiers: modifier,
            extra: {}
        }


        if (testData.extra.actor.isMage) {
            chars.push({ char: "AsP", res: roll.terms[2].results[0].result, die: "d6" })
            result["AsP"] = Math.round(Math.max(0, Number(roll.terms[2].results[0].result) + Number(modifier)) * Number(testData.regenerationFactor))
        } else if (testData.extra.actor.isPriest) {
            chars.push({ char: "KaP", res: roll.terms[2].results[0].result, die: "d6" })
            result["KaP"] = Math.round(Math.max(0, Number(roll.terms[2].results[0].result) + Number(modifier)) * Number(testData.regenerationFactor))
        }

        result["characteristics"] = chars

        return result
    }

    static rollStatus(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let modifier = testData.testModifier + this._situationalModifiers(testData);
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        var result = this._rollSingleD20(roll, testData.source.max, testData.extra.statusId, modifier, testData)
        result["rollType"] = "status"
        return result
    }

    static rollAttribute(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let modifier = testData.testModifier + testData.testDifficulty + this._situationalModifiers(testData);
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("Difficulty"), testData.testDifficulty)
        var result = this._rollSingleD20(roll, testData.source.value, testData.extra.characteristicId, modifier, testData)
        result["rollType"] = "attribute"
        return result
    }

    static rollTraitDamage(testData) {
        //let description = "";
        let modifier = testData.testModifier + this._situationalModifiers(testData);
        var chars = []

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)


        let roll = testData.roll ? testData.roll : new Roll(testData.source.data.data.damage.value.replace(/[Ww]/, "d")).roll()
        let damage = roll._total + modifier;

        for (let k of roll.terms) {
            if (k instanceof Die) {
                for (let l of k.results) {
                    chars.push({ char: testData.mode, res: l.result, die: "d" + k.faces })
                }
            }
        }


        return {
            rollType: "damage",
            damage: damage,
            characteristics: chars,

            preData: testData,
            modifiers: modifier,
            extra: {}
        }

    }

    static rollDamage(testData) {
        //let description = "";
        let modifier = testData.testModifier + this._situationalModifiers(testData);
        let weapon;
        var chars = []

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.data.combatskill.value), testData.extra.actor)

        if (testData.source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(testData.source.data, [skill], testData.extra.actor)
        } else {
            weapon = Actordsa5._prepareRangeWeapon(testData.source.data, [], [skill])

        }

        let roll = testData.roll ? testData.roll : new Roll(weapon.data.damage.value.replace(/[Ww]/, "d")).roll()
        let damage = roll._total + modifier;

        for (let k of roll.terms) {
            if (k instanceof Die) {
                for (let l of k.results) {
                    chars.push({ char: testData.mode, res: l.result, die: "d" + k.faces })
                }
            }
        }
        if (weapon.extraDamage)
            damage = Number(weapon.extraDamage) + Number(damage)


        return {
            rollType: "damage",
            damage: damage,
            characteristics: chars,

            preData: testData,
            modifiers: modifier,
            extra: {}
        }

    }

    static _situationalModifiers(testData) {
        return testData.situationalModifiers.reduce(function(_this, val) {
            return _this + Number(val.value)
        }, 0);
    }

    static _appendSituationalModifiers(testData, name, val) {
        testData.situationalModifiers.push({
            name: name,
            value: val
        })
    }

    static _getNarrowSpaceModifier(weapon, testData) {
        if (!testData.narrowSpace)
            return 0

        if (game.i18n.localize("ReverseCombatSkills." + weapon.data.combatskill.value) == "Shields") {
            return DSA5.narrowSpaceModifiers["shield" + weapon.data.reach.value][testData.mode]
        } else {
            return DSA5.narrowSpaceModifiers["weapon" + weapon.data.reach.value][testData.mode]
        }
    }

    static rollCombatTrait(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let modifier = testData.testModifier + this._situationalModifiers(testData) + testData.wrongHand

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("wrongHand"), testData.wrongHand)

        if (testData.source.data.data.traitType.value == "meleeAttack") {
            let weapon = {
                data: {
                    combatskill: {
                        value: "-"
                    },
                    reach: {
                        value: testData.source.data.data.reach.value
                    }
                }
            }

            let narrowSpaceModifier = this._getNarrowSpaceModifier(weapon, testData)
            modifier += narrowSpaceModifier
            this._appendSituationalModifiers(testData, game.i18n.localize("narrowSpace"), narrowSpaceModifier)
                //+ this._compareWeaponReach(weapon, testData)
            let weaponmodifier = this._compareWeaponReach(weapon, testData)

            modifier += weaponmodifier + testData.doubleAttack
            this._appendSituationalModifiers(testData, game.i18n.localize("doubleAttack"), testData.doubleAttack)
            this._appendSituationalModifiers(testData, game.i18n.localize("opposingWeaponSize"), weaponmodifier)


        } else {

            modifier += DSA5.rangeMods[testData.rangeModifier].attack + testData.sizeModifier + testData.visionModifier
            this._appendSituationalModifiers(testData, game.i18n.localize("distance"), DSA5.rangeMods[testData.rangeModifier].attack)
            this._appendSituationalModifiers(testData, game.i18n.localize("sizeCategory"), testData.sizeModifier)
            this._appendSituationalModifiers(testData, game.i18n.localize("sight"), testData.visionModifier)
        }
        var result = this._rollSingleD20(roll, Number(testData.source.data.data.at.value), testData.mode, modifier, testData)

        let success = result.successLevel > 0
        let doubleDamage = result.successLevel > 2

        switch (result.successLevel) {
            case 3:
                if (testData.mode == "attack")
                    result.description += ", " + game.i18n.localize("halfDefense") + ", " + game.i18n.localize("doubleDamage")
                else
                    result.description += ", " + game.i18n.localize("attackOfOpportunity")
                break;
            case -3:
                result.description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().result)
                break;
            case 2:
                if (testData.mode == "attack")
                    result.description += ", " + game.i18n.localize("halfDefense")
                break;
            case -2:
                break;
        }
        if (testData.mode == "attack" && success) {
            let damageRoll = new Roll(testData.source.data.data.damage.value.replace(/[Ww]/, "d")).roll()
            this._addRollDiceSoNice(testData, damageRoll, "black")
            let damage = damageRoll._total;

            for (let k of damageRoll.terms) {
                if (k instanceof Die) {
                    for (let l of k.results) {
                        result.characteristics.push({ char: "damage", res: l.result, die: "d" + k.faces })
                    }
                }
            }



            if (testData.source.data.data.traitType.value == "rangeAttack") {
                damage += DSA5.rangeMods[testData.rangeModifier].damage
            }

            if (doubleDamage) {
                damage = damage * 2
            }


            result["damage"] = damage
        }
        result["rollType"] = "weapon"

        return result
    }



    static rollWeapon(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let weapon;
        let modifier = testData.testModifier + this._situationalModifiers(testData) + testData.wrongHand

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("wrongHand"), testData.wrongHand)

        let source = testData.source.data.data == undefined ? testData.source : testData.source.data
        let combatskill = source.data.combatskill.value

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == combatskill), testData.extra.actor)

        if (source.type == "meleeweapon") {
            let shields = testData.extra.actor.items.filter(x => (x.type == "meleeweapon" && game.i18n.localize("ReverseCombatSkills." + x.data.combatskill.value) == "Shields" && x.data.worn.value))
            let shieldBonus = shields.length > 0 ? shields[0].data.pamod.value : 0

            weapon = Actordsa5._prepareMeleeWeapon(source, [skill], testData.extra.actor, shieldBonus)

            let narrowSpaceModifier = this._getNarrowSpaceModifier(weapon, testData)
            modifier += narrowSpaceModifier
            this._appendSituationalModifiers(testData, game.i18n.localize("narrowSpace"), narrowSpaceModifier)
                //+ this._compareWeaponReach(weapon, testData)
            if (testData.mode == "attack") {
                let weaponmodifier = this._compareWeaponReach(weapon, testData)

                modifier += weaponmodifier + testData.doubleAttack
                this._appendSituationalModifiers(testData, game.i18n.localize("doubleAttack"), testData.doubleAttack)
                this._appendSituationalModifiers(testData, game.i18n.localize("opposingWeaponSize"), weaponmodifier)
            } else {
                modifier += testData.defenseCount * -3
                this._appendSituationalModifiers(testData, game.i18n.localize("defenseCount"), testData.defenseCount * -3)
            }

        } else {
            weapon = Actordsa5._prepareRangeWeapon(source, [], [skill])

            modifier += DSA5.rangeMods[testData.rangeModifier].attack + testData.sizeModifier + testData.visionModifier
            this._appendSituationalModifiers(testData, game.i18n.localize("distance"), DSA5.rangeMods[testData.rangeModifier].attack)
            this._appendSituationalModifiers(testData, game.i18n.localize("sizeCategory"), testData.sizeModifier)
            this._appendSituationalModifiers(testData, game.i18n.localize("sight"), testData.visionModifier)
        }
        var result = this._rollSingleD20(roll, weapon[testData.mode], testData.mode, modifier, testData)

        let success = result.successLevel > 0
        let doubleDamage = result.successLevel > 2

        switch (result.successLevel) {
            case 3:
                if (testData.mode == "attack")
                    result.description += ", " + game.i18n.localize("halfDefense") + ", " + game.i18n.localize("doubleDamage")
                else
                    result.description += ", " + game.i18n.localize("attackOfOpportunity")
                break;
            case -3:
                result.description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().result)
                break;
            case 2:
                if (testData.mode == "attack")
                    result.description += ", " + game.i18n.localize("halfDefense")
                break;
            case -2:
                break;
        }

        if (testData.mode == "attack" && success) {
            let damageRoll = testData.damageRoll ? testData.damageRoll : new Roll(weapon.data.damage.value.replace(/[Ww]/, "d")).roll()
            this._addRollDiceSoNice(testData, damageRoll, "black")
            let damage = Number(damageRoll.total);

            for (let k of damageRoll.terms) {
                if (k instanceof Die || k.class == "Die") {
                    for (let l of k.results) {
                        result.characteristics.push({ char: "damage", res: l.result, die: "d" + k.faces })
                    }
                }
            }
            if (weapon.extraDamage)
                damage = Number(weapon.extraDamage) + Number(damage)

            if (source.type == "rangeweapon") {
                damage += DSA5.rangeMods[testData.rangeModifier].damage
            }

            if (doubleDamage) {
                damage = damage * 2
            }

            result["damage"] = damage
            result["damageRoll"] = damageRoll
        }
        result["rollType"] = "weapon"
        return result
    }

    static async _addRollDiceSoNice(testData, roll, color) {
        if (testData.rollMode) {
            for (var i = 0; i < roll.dice.length; i++) {
                roll.dice[i].options.colorset = color
            }
            this.showDiceSoNice(roll, testData.rollMode);
        }
    }

    static rollCombatskill(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let description = "";
        let modifier = testData.testModifier + this._situationalModifiers(testData);
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let source = Actordsa5._calculateCombatSkillValues(testData.source.data, testData.extra.actor)


        var res = modifier + source.data[testData.mode].value;

        var chars = []

        let res1 = res - roll.terms[0].results[0].result;

        chars.push({ char: testData.mode, res: roll.terms[0].results[0].result, suc: res1 >= 0, tar: res });
        let rollConfirm = new Roll("1d20").roll();
        rollConfirm.dice[0].options.colorset = testData.mode

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess") + ", " + game.i18n.localize("halfDefense");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 >= 0) {
                description += ", " + game.i18n.localize("doubleDamage")
                doubleDamage = true;

            }
            this._addRollDiceSoNice(testData, rollConfirm, testData.mode)
            chars.push({ char: testData.mode, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });

        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 < 0) {
                description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().result)
            }
            this._addRollDiceSoNice(testData, rollConfirm, testData.mode)
            chars.push({
                char: testData.mode,
                res: rollConfirm.terms[0].results[0].result,
                suc: res2 < 0,
                tar: res
            });

        }

        if (description == "") {
            description = game.i18n.localize(res1 >= 0 ? "Success" : "Failure");
        }

        return {
            rollType: "weapon",
            characteristics: chars,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
    }

    static rollSpell(testData) {
        let res = this._rollThreeD20(testData)
        res["rollType"] = testData.source.type
        if (res.successLevel >= 2) {
            let extraFps = new Roll("1d6").roll().results[0]
            res.description = res.description + ", " + game.i18n.localize("additionalFPs") + " " + extraFps
            res.result = res.result + extraFps
            res.preData.calculatedSpellModifiers.cost = res.preData.calculatedSpellModifiers.cost / 2
        } else if (res.successLevel <= -2) {
            res.description = res.description + " - " + (res.preData.source.type == "spell" ? Miscast.getSpellMiscast() : Miscast.getLiturgyMiscast())
        }

        if (res.successLevel < 0) {
            res.preData.calculatedSpellModifiers.cost = res.preData.calculatedSpellModifiers.cost / 2
        } else {
            if (testData.source.data.effectFormula.value != "") {
                let formula = testData.source.data.effectFormula.value.replace("QS", res.qualityStep).replace("W", "d").replace("w", "d")
                let rollEffect = new Roll(formula).roll()
                this._addRollDiceSoNice(testData, rollEffect, "black")
                res["effectResult"] = rollEffect._total
                res["calculatedEffectFormula"] = formula
                for (let k of rollEffect.terms) {
                    if (k instanceof Die) {
                        for (let l of k.results) {
                            res["characteristics"].push({ char: "effect", res: l.result, die: "d" + k.faces })
                        }
                    }
                }
            }
        }
        return res
    }

    static _rollThreeD20(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20+1d20+1d20").roll();
        let description = "";
        let successLevel = 0

        let modifier = testData.testModifier + testData.testDifficulty + this._situationalModifiers(testData);
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("Difficulty"), testData.testDifficulty)

        let fps = testData.source.data.talentValue.value;
        let tar1 = testData.extra.actor.data.characteristics[testData.source.data.characteristic1.value].value + modifier;
        let res1 = roll.terms[0].results[0].result - tar1;
        if (res1 > 0) {
            fps = fps - res1;
        }
        let tar2 = testData.extra.actor.data.characteristics[testData.source.data.characteristic2.value].value + modifier;
        let res2 = roll.terms[2].results[0].result - tar2;
        if (res2 > 0) {
            fps = fps - res2;
        }
        let tar3 = testData.extra.actor.data.characteristics[testData.source.data.characteristic3.value].value + modifier
        let res3 = roll.terms[4].results[0].result - tar3;
        if (res3 > 0) {
            fps = fps - res3;
        }

        if (roll.terms[0].results.filter(x => x.result == 1).length == 3) {
            description = game.i18n.localize("AstoundingSuccess");
            successLevel = 3
        } else if (roll.terms[0].results.filter(x => x.result == 1).length == 2) {
            description = game.i18n.localize("CriticalSuccess");
            successLevel = 2
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 3) {
            description = game.i18n.localize("AstoundingFailure");
            successLevel = -3
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 2) {
            description = game.i18n.localize("CriticalFailure");
            successLevel = -2
        } else {

            description = game.i18n.localize(fps >= 0 ? "Success" : "Failure");
            successLevel = fps >= 0 ? 1 : -1
        }


        return {
            result: fps,
            characteristics: [
                { char: testData.source.data.characteristic1.value, res: roll.terms[0].results[0].result, suc: res1 <= 0, tar: tar1 },
                { char: testData.source.data.characteristic2.value, res: roll.terms[2].results[0].result, suc: res2 <= 0, tar: tar2 },
                { char: testData.source.data.characteristic3.value, res: roll.terms[4].results[0].result, suc: res3 <= 0, tar: tar3 }
            ],
            qualityStep: (fps == 0 ? 1 : (fps > 0 ? Math.ceil(fps / 3) : 0)) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0),
            description: description,
            preData: testData,
            successLevel: successLevel,
            modifiers: modifier,
            extra: {}
        }
    }

    static rollTalent(testData) {
        let res = this._rollThreeD20(testData)
        res["rollType"] = "talent"
        return res
    }

    static rollTest(testData) {
        testData.function = "rollTest"

        let rollResults;
        switch (testData.source.type) {
            case "ceremony":
            case "ritual":
            case "liturgy":
            case "spell":
                rollResults = this.rollSpell(testData)
                break
            case "skill":
                rollResults = this.rollTalent(testData)
                break;
            case "combatskill":
                rollResults = this.rollCombatskill(testData)
                break;
            case "trait":
                if (testData.mode == "damage") {
                    rollResults = this.rollTraitDamage(testData)
                } else {
                    rollResults = this.rollCombatTrait(testData)
                }

                break
            case "regeneration":
                rollResults = this.rollRegeneration(testData)
                break
            case "meleeweapon":
            case "rangeweapon":
                if (testData.mode == "damage") {
                    rollResults = this.rollDamage(testData)
                } else {
                    rollResults = this.rollWeapon(testData)
                }

                break;
            case "status":
                rollResults = this.rollStatus(testData)
                break;
            default:
                rollResults = this.rollAttribute(testData)
        }


        mergeObject(rollResults, testData.extra)

        rollResults.other = [];

        return rollResults
    }

    static _compareWeaponReach(weapon, testData) {
        return Math.min(0, DSA5.meleeRangesArray.indexOf(weapon.data.reach.value) - DSA5.meleeRangesArray.indexOf(testData.opposingWeaponSize)) * 2
    }

    static async rollDices(testData, cardOptions) {
        if (!testData.roll) {
            let roll;
            switch (testData.source.type) {
                case "liturgy":
                case "spell":
                case "ceremony":
                case "ritual":
                case "skill":
                    roll = new Roll("1d20+1d20+1d20").roll();
                    for (var i = 0; i < roll.dice.length; i++) {
                        roll.dice[i].options.colorset = testData.source.data["characteristic" + (i + 1)].value
                    }
                    break;
                case "regeneration":
                    if (testData.extra.actor.isMage) {
                        roll = new Roll("1d6+1d6").roll()
                        roll.dice[1].options.colorset = "ge"
                    } else if (testData.extra.actor.isPriest) {
                        roll = new Roll("1d6+1d6").roll()
                        roll.dice[1].options.colorset = "in"
                    } else {
                        roll = new Roll("1d6").roll()
                    }
                    roll.dice[0].options.colorset = "mu"

                    break;
                case "meleeweapon":
                case "rangeweapon":
                case "weaponless":
                case "combatskill":
                    if (testData.mode == "damage") {
                        roll = new Roll(testData.source.data.data.damage.value.replace(/[Ww]/, "d")).roll()
                        for (var i = 0; i < roll.dice.length; i++) {
                            roll.dice[i].options.colorset = "black"
                        }

                    } else {
                        roll = new Roll("1d20[" + (testData.mode) + "]").roll()
                        roll.dice[0].options.colorset = testData.mode
                    }
                    break;
                case "trait":
                    if (testData.mode == "damage") {
                        roll = new Roll(testData.source.data.data.damage.value.replace(/[Ww]/, "d")).roll()
                        for (var i = 0; i < roll.dice.length; i++) {
                            roll.dice[i].options.colorset = "black"
                        }

                    } else {
                        roll = new Roll("1d20[" + (testData.mode) + "]").roll()
                        roll.dice[0].options.colorset = testData.mode
                    }
                    break
                case "status":
                    roll = new Roll("1d20").roll();
                    roll.dice[0].options.colorset = "in"
                    break;
                default:
                    roll = new Roll("1d20").roll();
                    roll.dice[0].options.colorset = testData.source.label.split('.')[1].toLowerCase()
            }

            this.showDiceSoNice(roll, cardOptions.rollMode);
            testData.roll = roll;
            testData.rollMode = cardOptions.rollMode
        }
        return testData;
    }


    static async showDiceSoNice(roll, rollMode) {
        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active) {
            let whisper = null;
            let blind = false;
            switch (rollMode) {
                case "blindroll":
                    blind = true;
                case "gmroll":
                    let gmList = game.users.filter(user => user.isGM);
                    let gmIDList = [];
                    gmList.forEach(gm => gmIDList.push(gm.data._id));
                    whisper = gmIDList;
                    break;
                case "roll":
                    let userList = game.users.filter(user => user.active);
                    let userIDList = [];
                    userList.forEach(user => userIDList.push(user.data._id));
                    whisper = userIDList;
                    break;
            }
            await game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
        }
    }

    static async renderRollCard(chatOptions, testData, rerenderMessage) {
        if (Array.isArray(testData.other)) {
            testData.other = testData.other.join("<br>")
        }

        let chatData = {
            title: chatOptions.title,
            testData: testData,
            hideData: game.user.isGM
        }

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
        else if (chatOptions.rollMode === "selfroll") chatOptions["whisper"] = [game.user];

        chatOptions["flags.data"] = {
            preData: chatData.testData.preData,
            postData: chatData.testData,
            template: chatOptions.template,
            rollMode: chatOptions.rollMode,
            isOpposedTest: chatOptions.isOpposedTest,
            title: chatOptions.title,
            hideData: chatData.hideData,
        };
        if (!rerenderMessage) {
            return renderTemplate(chatOptions.template, chatData).then(html => {
                chatOptions["content"] = html;
                return ChatMessage.create(chatOptions, false);
            });
        } else {
            return renderTemplate(chatOptions.template, chatData).then(html => {
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

    static async chatListeners(html) {
        html.on("click", '.expand-mods', event => {
            event.preventDefault()
            let elem = $(event.currentTarget)
            elem.find('i').toggleClass("fa-minus fa-plus")
            elem.siblings('ul,div').fadeToggle()
        })
    }
}