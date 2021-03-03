import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5 from "./config-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js"
import Miscast from "../tables/spellmiscast.js"
import DSA5_Utility from "./utility-dsa5.js";
import AdvantageRulesDSA5 from "./advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "./specialability-rules-dsa5.js";
import TraitRulesDSA5 from "./trait-rules-dsa5.js";
import Itemdsa5 from "../item/item-dsa5.js"
import CombatTables from "../tables/combattables.js";
import DSA5StatusEffects from "../status/status_effects.js";
import DSA5ChatAutoCompletion from "./chat_autocompletion.js";

export default class DiceDSA5 {
    static async setupDialog({ dialogOptions, testData, cardOptions, }) {
        let rollMode = game.settings.get("core", "rollMode");
        let sceneStress = "challenging";

        mergeObject(testData, {
            testDifficulty: sceneStress,
            testModifier: (dialogOptions.data.modifier || 0)
        });

        mergeObject(dialogOptions.data, {
            testDifficulty: sceneStress,
            testModifier: (dialogOptions.data.modifier || 0)
        });

        let situationalModifiers
        if (dialogOptions.data.situationalModifiers) {
            situationalModifiers = dialogOptions.data.situationalModifiers
        } else {
            situationalModifiers = testData.extra.actor ? DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source) : []
        }

        if (testData.extra.options.moreModifiers != undefined) {
            situationalModifiers.push(...testData.extra.options.moreModifiers)
        }

        mergeObject(dialogOptions.data, {
            hasSituationalModifiers: situationalModifiers.length > 0,
            situationalModifiers: situationalModifiers,
            rollMode: dialogOptions.data.rollMode || rollMode,
            rollModes: CONFIG.Dice.rollModes ? CONFIG.Dice.rollModes : CONFIG.rollModes
        })
        mergeObject(cardOptions, {
            user: game.user._id,
        })

        if (!testData.extra.options.bypass) {
            let html = await renderTemplate(dialogOptions.template, dialogOptions.data);
            return new Promise((resolve, reject) => {
                let dialog = DSA5Dialog.getDialogForItem(testData.source.type)
                new dialog({
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

    static _rollSingleD20(roll, res, id, modifier, testData, combatskill = "") {
        let description = "";

        let chars = []
        res += modifier
        let res1 = res - roll.terms[0].results[0].result;
        let color = DSA5.dieColors[id] || id;

        chars.push({ char: id, res: roll.terms[0].results[0].result, suc: res1 >= 0, tar: res });
        let rollConfirm = new Roll("1d20").roll();
        let successLevel = res1 >= 0 ? 1 : -1

        let botch = /(\(|,)( )?i\)$/.test(testData.source.name) ? 19 : 20

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.weaponAptitude')} (${combatskill})`) && !(res2 >= 0)) {
                let a = rollConfirm.terms[0].results[0].result
                rollConfirm = new Roll("1d20").roll();
                res2 = res - rollConfirm.terms[0].results[0].result;
                description += ", " + game.i18n.format("usedWeaponExpertise", { a: a, b: rollConfirm.terms[0].results[0].result })
            }
            this._addRollDiceSoNice(testData, rollConfirm, color)
            chars.push({ char: id, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
            successLevel = res2 >= 0 ? 3 : 2
        } else if (roll.terms[0].results.filter(x => x.result >= botch).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.weaponAptitude')} (${combatskill})`) && !(res2 >= 0)) {
                let a = rollConfirm.terms[0].results[0].result
                rollConfirm = new Roll("1d20").roll();
                res2 = res - rollConfirm.terms[0].results[0].result;
                description += ", " + game.i18n.format("usedWeaponExpertise", { a: a, b: rollConfirm.terms[0].results[0].result })
            }
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
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);
        let roll = testData.roll
        let chars = []

        let lepBonus = AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.regenerationLP')) - AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakRegenerationLP'))

        chars.push({ char: "LeP", res: roll.terms[0].results[0].result, die: "d6" })

        let result = {
            rollType: "regeneration",
            LeP: Math.round(Math.max(0, Number(roll.terms[0].results[0].result) + Number(modifier) + lepBonus) * Number(testData.regenerationFactor)),
            preData: testData,
            modifiers: modifier,
            extra: {}
        }


        if (testData.extra.actor.isMage) {
            let aspBonus = AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.regenerationAE')) - AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakRegenerationAE'))
            chars.push({ char: "AsP", res: roll.terms[2].results[0].result, die: "d6" })
            result["AsP"] = Math.round(Math.max(0, Number(roll.terms[2].results[0].result) + Number(modifier) + aspBonus) * Number(testData.regenerationFactor))
        }
        if (testData.extra.actor.isPriest) {
            let aspBonus = AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.regenerationKP')) - AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakRegenerationKP'))
            chars.push({ char: "KaP", res: roll.terms[2].results[0].result, die: "d6" })
            result["KaP"] = Math.round(Math.max(0, Number(roll.terms[2].results[0].result) + Number(modifier) + aspBonus) * Number(testData.regenerationFactor))
        }

        result["characteristics"] = chars

        return result
    }

    static rollStatus(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let result = this._rollSingleD20(roll, testData.source.max, testData.extra.statusId, this._situationalModifiers(testData), testData)
        result["rollType"] = "status"
        if (testData.extra.statusId == "dodge" && result.successLevel == 3) {
            result["description"] += ", " + game.i18n.localize("attackOfOpportunity")
        } else if (testData.extra.statusId == "dodge" && result.successLevel == -3) {
            if (game.settings.get("dsa5", "defenseBotchTableEnabled")) {
                result["description"] += `, <a class="roll-button defense-botch" data-weaponless="true"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
            } else {
                result["description"] += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().total)
            }
        }
        return result
    }

    static rollAttribute(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("Difficulty"), testData.testDifficulty)
        let result = this._rollSingleD20(roll, testData.source.value, testData.extra.characteristicId, this._situationalModifiers(testData), testData)
        result["rollType"] = "attribute"
        return result
    }

    static rollTraitDamage(testData) {
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);
        let chars = []

        let roll = testData.roll ? testData.roll : new Roll(testData.source.data.data.damage.value.replace(/[Ww]/g, "d")).roll()
        let damage = roll.total + modifier;

        for (let k of roll.terms) {
            if (k instanceof Die || k.class == "Die") {
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
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);
        let weapon;
        let chars = []

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.data.combatskill.value), testData.extra.actor)

        if (testData.source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(testData.source.data, [skill], testData.extra.actor)
        } else {
            weapon = Actordsa5._prepareRangeWeapon(testData.source.data, [], [skill], testData.extra.actor)
        }

        let roll = testData.roll ? testData.roll : new Roll(weapon.data.damage.value.replace(/[Ww]/g, "d")).roll()
        let damage = roll.total + modifier;

        for (let k of roll.terms) {
            if (k instanceof Die || k.class == "Die") {
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

    static _situationalModifiers(testData, filter = "") {
        return testData.situationalModifiers.reduce(function(_this, val) {
            return _this + ((val.type == filter || (filter == "" && val.type == undefined)) ? Number(val.value) : 0)
        }, 0);
    }

    static _appendSituationalModifiers(testData, name, val) {
        let existing = testData.situationalModifiers.find(x => x.name == name)

        if (existing) {
            existing.value = val
        } else {
            testData.situationalModifiers.push({
                name: name,
                value: val
            })
        }
    }

    static _getNarrowSpaceModifier(weapon, testData) {
        if (!testData.narrowSpace)
            return 0

        if (game.i18n.localize('LocalizedIDs.shields') == weapon.data.combatskill.value) {
            return DSA5.narrowSpaceModifiers["shield" + weapon.data.reach.shieldSize][testData.mode]
        } else {
            return DSA5.narrowSpaceModifiers["weapon" + weapon.data.reach.value][testData.mode]
        }
    }

    static rollCombatTrait(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("wrongHand"), testData.wrongHand)
        let source = testData.source.data.data == undefined ? testData.source : testData.source.data
        if (source.data.traitType.value == "meleeAttack") {
            let weapon = { data: { combatskill: { value: "-" }, reach: { value: source.data.reach.value } } }

            this._appendSituationalModifiers(testData, game.i18n.localize("narrowSpace"), this._getNarrowSpaceModifier(weapon, testData))
            this._appendSituationalModifiers(testData, game.i18n.localize("doubleAttack"), testData.doubleAttack)
            this._appendSituationalModifiers(testData, game.i18n.localize("opposingWeaponSize"), this._compareWeaponReach(weapon, testData))
        } else {
            this._appendSituationalModifiers(testData, game.i18n.localize("distance"), DSA5.rangeMods[testData.rangeModifier].attack)
            this._appendSituationalModifiers(testData, game.i18n.localize("sizeCategory"), testData.sizeModifier)
            this._appendSituationalModifiers(testData, game.i18n.localize("sight"), testData.visionModifier)
        }
        let result = this._rollSingleD20(roll, Number(source.data.at.value), testData.mode, this._situationalModifiers(testData), testData)

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
                if (testData.mode == "attack" && source.data.traitType.value == "meleeAttack" && game.settings.get("dsa5", "meleeBotchTableEnabled")) {
                    result.description += `, <a class="roll-button melee-botch" data-weaponless="true"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else if (testData.mode == "attack" && game.settings.get("dsa5", "rangeBotchTableEnabled")) {
                    result.description += `, <a class="roll-button range-botch" data-weaponless="true"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else {
                    result.description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().total)
                }
                break;
            case 2:
                if (testData.mode == "attack")
                    result.description += ", " + game.i18n.localize("halfDefense")
                break;
            case -2:
                break;
        }
        if (testData.mode == "attack" && success) {
            DiceDSA5.evaluateDamage(testData, result, source, source.data.traitType.value == "rangeAttack", doubleDamage)
        }
        result["rollType"] = "weapon"
        let effect = DiceDSA5.parseEffect(source.data.effect.value)
        if (effect)
            result["parsedEffect"] = effect
        return result
    }

    static evaluateDamage(testData, result, weapon, isRangeWeapon, doubleDamage) {
        let damageRoll = testData.damageRoll ? testData.damageRoll : new Roll(weapon.data.damage.value.replace(/[Ww]/g, "d")).roll()
        let bonusDmg = testData.situationalModifiers.reduce(function(_this, val) {
            let number = 0
            if (val.damageBonus) {
                number = Number(eval(`${val.damageBonus}`.replace(/\d{1}[dDwW]\d/g, function(match) {
                    let roll = new Roll(match).roll()
                    DiceDSA5._addRollDiceSoNice(testData, roll, "ch")
                    return roll.total
                }))) * val.step
                val.damageBonus = number
            }
            return _this + number
        }, 0);
        this._addRollDiceSoNice(testData, damageRoll, "black")
        let damage = Number(damageRoll.total) + bonusDmg;
        let weaponBonus = 0
        let weaponroll = 0
        for (let k of damageRoll.terms) {
            if (k instanceof Die || k.class == "Die") {
                for (let l of k.results) {
                    weaponroll += Number(l.result)
                    result.characteristics.push({ char: "damage", res: l.result, die: "d" + k.faces })
                }
            } else if (!isNaN(k)) {
                weaponBonus += Number(k)
            }
        }

        let damageBonusDescription = [game.i18n.localize("Roll") + " " + weaponroll]
        if (weaponBonus != 0)
            damageBonusDescription.push(game.i18n.localize("weaponModifier") + " " + weaponBonus)

        damageBonusDescription.push(...testData.situationalModifiers.map(x => { return x.damageBonus ? `${x.name} ${x.damageBonus}` : "" }).filter(x => x != ""))


        if (weapon.extraDamage) {
            damage = Number(weapon.extraDamage) + Number(damage)
            damageBonusDescription.push(game.i18n.localize("damageThreshold") + " " + weapon.extraDamage)
        }


        if (isRangeWeapon) {
            let rangeDamageMod = DSA5.rangeMods[testData.rangeModifier].damage
            damage += rangeDamageMod
            if (rangeDamageMod != 0)
                damageBonusDescription.push(game.i18n.localize("distance") + " " + rangeDamageMod)
        }

        if (doubleDamage) {
            damage = damage * 2
            damageBonusDescription.push(game.i18n.localize("doubleDamage"))
        }

        result["damagedescription"] = damageBonusDescription.join(", ")
        result["damage"] = damage
        result["damageRoll"] = damageRoll
    }


    static rollWeapon(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let weapon;
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("wrongHand"), testData.wrongHand)


        let source = testData.source.data.data == undefined ? testData.source : testData.source.data
        let combatskill = source.data.combatskill.value

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == combatskill), testData.extra.actor)

        if (source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(source, [skill], testData.extra.actor)

            this._appendSituationalModifiers(testData, game.i18n.localize("narrowSpace"), this._getNarrowSpaceModifier(weapon, testData))

            if (testData.mode == "attack") {
                this._appendSituationalModifiers(testData, game.i18n.localize("doubleAttack"), testData.doubleAttack)
                this._appendSituationalModifiers(testData, game.i18n.localize("opposingWeaponSize"), this._compareWeaponReach(weapon, testData))
            } else {
                this._appendSituationalModifiers(testData, game.i18n.localize("defenseCount"), testData.defenseCount * -3)
            }

        } else {
            weapon = Actordsa5._prepareRangeWeapon(source, [], [skill], testData.extra.actor)
            this._appendSituationalModifiers(testData, game.i18n.localize("distance"), DSA5.rangeMods[testData.rangeModifier].attack)
            this._appendSituationalModifiers(testData, game.i18n.localize("sizeCategory"), testData.sizeModifier)
            this._appendSituationalModifiers(testData, game.i18n.localize("sight"), testData.visionModifier)

        }
        let result = this._rollSingleD20(roll, weapon[testData.mode], testData.mode, this._situationalModifiers(testData), testData, combatskill)

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
                if (testData.mode == "attack" && source.type == "meleeweapon" && game.settings.get("dsa5", "meleeBotchTableEnabled"))
                    result.description += `, <a class="roll-button melee-botch" data-weaponless="${source.data.combatskill.value == "Raufen"}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                else if (testData.mode == "attack" && game.settings.get("dsa5", "rangeBotchTableEnabled"))
                    result.description += `, <a class="roll-button range-botch" data-weaponless="false"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                else if (testData.mode != "attack" && game.settings.get("dsa5", "defenseBotchTableEnabled"))
                    result.description += `, <a class="roll-button defense-botch" data-weaponless="${source.data.combatskill.value == "Raufen"}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                else
                    result.description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().total)
                break;
            case 2:
                if (testData.mode == "attack")
                    result.description += ", " + game.i18n.localize("halfDefense")
                break;
            case -2:
                break;
        }

        if (testData.mode == "attack" && success) {
            DiceDSA5.evaluateDamage(testData, result, weapon, source.type == "rangeweapon", doubleDamage)
        }
        result["rollType"] = "weapon"
        let effect = DiceDSA5.parseEffect(weapon.data.effect ? weapon.data.effect.value : "")
        if (effect)
            result["parsedEffect"] = effect
        return result
    }

    static async _addRollDiceSoNice(testData, roll, color) {
        if (testData.rollMode) {
            for (let i = 0; i < roll.dice.length; i++) {
                roll.dice[i].options.colorset = color
            }
            this.showDiceSoNice(roll, testData.rollMode);
        }
    }

    static rollCombatskill(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let description = "";
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);

        let weaponSource = testData.source.data.data == undefined ? testData.source : testData.source.data
        let source = Actordsa5._calculateCombatSkillValues(weaponSource, testData.extra.actor)
        let res = modifier + source.data[testData.mode].value;
        let chars = []
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
                if (testData.mode == "attack" && source.data.weapontype.value == "melee" && game.settings.get("dsa5", "meleeBotchTableEnabled")) {
                    description += `, <a class="roll-button melee-botch" data-weaponless="${source.data.combatskill.value == "Raufen"}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else if (testData.mode == "attack" && game.settings.get("dsa5", "rangeBotchTableEnabled")) {
                    description += `, <a class="roll-button range-botch" data-weaponless="${source.data.combatskill.value == "Raufen"}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else if (testData.mode != "attack" && game.settings.get("dsa5", "defenseBotchTableEnabled")) {
                    description += `, <a class="roll-button defense-botch" data-weaponless="${source.data.combatskill.value == "Raufen"}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else {
                    description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().total)
                }
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

    static parseEffect(effectString) {
        if (!effectString)
            return ""

        let regex = /^[a-z]+\|[öäüÖÄÜa-zA-z ]+$/
        let result = []
        for (let k of effectString.split(";")) {
            if (regex.test(k.trim())) {
                let split = k.split("|")
                result.push(`<a class="roll-button roll-item" data-name="${split[1].trim()}" data-type="${split[0].trim()}"><i class="fas fa-dice"></i>${game.i18n.localize(split[0].trim())}: ${split[1].trim()}</a>`)
            }
            /*else {
                           result.push(k)
                       }*/
        }
        return result.join(", ")
    }

    static rollSpell(testData) {
        let res = this._rollThreeD20(testData)
        res["rollType"] = testData.source.type
        res.preData.calculatedSpellModifiers.finalcost = res.preData.calculatedSpellModifiers.cost
        if (res.successLevel >= 2) {
            let extraFps = new Roll("1d6").roll().results[0]
            res.description = res.description + ", " + game.i18n.localize("additionalFPs") + " " + extraFps
            res.result = res.result + extraFps
            res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.cost / 2)
        } else if (res.successLevel <= -2) {
            res.description += `, <a class="roll-button ${"spell" ? "spell":"liturgy"}-botch"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
        }

        if (res.successLevel < 0) {
            res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.cost / (SpecialabilityRulesDSA5.hasAbility(testData.extra.actor, game.i18n.localize('LocalizedIDs.traditionWitch')) ? 3 : 2))
        } else {
            if (testData.source.data.effectFormula.value != "") {
                let formula = testData.source.data.effectFormula.value.replace(game.i18n.localize('CHARAbbrev.QS'), res.qualityStep).replace(/[Ww]/g, "d")
                let rollEffect = testData.damageRoll ? testData.damageRoll : new Roll(formula).roll()
                this._addRollDiceSoNice(testData, rollEffect, "black")
                res["effectResult"] = rollEffect.total
                res["calculatedEffectFormula"] = formula
                for (let k of rollEffect.terms) {
                    if (k instanceof Die || k.class == "Die") {
                        for (let l of k.results) {
                            res["characteristics"].push({ char: "effect", res: l.result, die: "d" + k.faces })
                        }
                    }
                }
                res["damageRoll"] = rollEffect
            }
        }
        res.preData.calculatedSpellModifiers.finalcost = Number(res.preData.calculatedSpellModifiers.finalcost) + AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakKarmicBody')) + AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakAstralBody'))
        if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, game.i18n.localize('LocalizedIDs.minorSpirits'))) {
            let ghostroll = new Roll("1d20").roll()
            if (ghostroll.total <= res.preData.calculatedSpellModifiers.finalcost)
                res.description += ", " + game.i18n.localize("minorghostsappear")
        }
        return res
    }

    static _rollThreeD20(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20+1d20+1d20").roll();
        let description = [];
        let successLevel = 0

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("Difficulty"), testData.testDifficulty)
        let modifier = this._situationalModifiers(testData);

        let fps = testData.source.data.talentValue.value + testData.advancedModifiers.fps + this._situationalModifiers(testData, "FP");
        let tar = [1, 2, 3].map(x => testData.extra.actor.data.characteristics[testData.source.data[`characteristic${x}`].value].value + modifier + testData.advancedModifiers.chars[x - 1])
        let res = [0, 1, 2].map(x => roll.terms[x * 2].results[0].result - tar[x])
        for (let k of res) {
            if (k > 0)
                fps -= k
        }

        let failValue = 20
        if ((testData.source.type == "spell" || testData.source.type == "ritual") && AdvantageRulesDSA5.hasVantage(testData.extra.actor, game.i18n.localize('LocalizedIDs.wildMagic')))
            failValue = 19

        if (testData.source.type == "skill" && AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.incompetent')} (${testData.source.name})`)) {
            let reroll = new Roll("1d20").roll()
            let indexOfMinValue = res.reduce((iMin, x, i, arr) => x < arr[iMin] ? i : iMin, 0)
            let oldValue = roll.results[indexOfMinValue * 2]
            fps += Math.max(res[indexOfMinValue], 0)
            fps -= Math.max(0, reroll.total - tar[indexOfMinValue])
            roll.results[indexOfMinValue * 2] = reroll.total
            roll.terms[indexOfMinValue * 2].results[0].result = reroll.total
            this._addRollDiceSoNice(testData, reroll, roll.terms[indexOfMinValue * 2].options.colorset)
            description.push(game.i18n.format("CHATNOTIFICATION.unableReroll", { die: (indexOfMinValue + 1), oldVal: oldValue, newVal: reroll.total }))
        }
        if (testData.source.type == "skill" && TraitRulesDSA5.hasTrait(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.automaticSuccess')} (${testData.source.name})`)) {
            description.push(game.i18n.localize("TraitMsg.AutomaticSuccess"));
            successLevel = 1
        } else if (testData.source.type == "skill" && TraitRulesDSA5.hasTrait(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.automaticFail')} (${testData.source.name})`)) {
            description.push(game.i18n.localize("TraitMsg.AutomaticFailure"));
            successLevel = -1
        } else if (roll.results.filter(x => x == 1).length == 3) {
            description.push(game.i18n.localize("AstoundingSuccess"));
            successLevel = 3
        } else if (roll.results.filter(x => x == 1).length == 2) {
            description.push(game.i18n.localize("CriticalSuccess"));
            successLevel = 2
        } else if (roll.results.filter(x => x >= failValue).length == 3) {
            description.push(game.i18n.localize("AstoundingFailure"));
            successLevel = -3
        } else if (roll.results.filter(x => x >= failValue).length == 2) {
            description.push(game.i18n.localize("CriticalFailure"));
            successLevel = -2
        } else {
            description.push(game.i18n.localize(fps >= 0 ? "Success" : "Failure"));
            successLevel = fps >= 0 ? 1 : -1
        }

        description = description.join(", ")

        return {
            result: fps,
            characteristics: [
                { char: testData.source.data.characteristic1.value, res: roll.terms[0].results[0].result, suc: res[0] <= 0, tar: tar[0] },
                { char: testData.source.data.characteristic2.value, res: roll.terms[2].results[0].result, suc: res[1] <= 0, tar: tar[1] },
                { char: testData.source.data.characteristic3.value, res: roll.terms[4].results[0].result, suc: res[2] <= 0, tar: tar[2] }
            ],
            qualityStep: Math.min(game.settings.get("dsa5", "capQSat"), (fps == 0 ? 1 : (fps > 0 ? Math.ceil(fps / 3) : 0)) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0)),
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

    static rollItem(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20+1d20+1d20").roll();
        let description = [];
        let successLevel = 0

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);

        let fps = Number(testData.source.data.step.value)
        let tar = [1, 2, 3].map(x => 10 + Number(testData.source.data.step.value) + modifier)
        let res = [0, 1, 2].map(x => roll.terms[x * 2].results[0].result - tar[x])
        for (let k of res) {
            if (k > 0)
                fps -= k
        }

        let failValue = 20

        if (roll.results.filter(x => x == 1).length == 3) {
            description.push(game.i18n.localize("AstoundingSuccess"));
            successLevel = 3
        } else if (roll.results.filter(x => x == 1).length == 2) {
            description.push(game.i18n.localize("CriticalSuccess"));
            successLevel = 2
        } else if (roll.results.filter(x => x >= failValue).length == 3) {
            description.push(game.i18n.localize("AstoundingFailure"));
            successLevel = -3
        } else if (roll.results.filter(x => x >= failValue).length == 2) {
            description.push(game.i18n.localize("CriticalFailure"));
            successLevel = -2
        } else {
            description.push(game.i18n.localize(fps >= 0 ? "Success" : "Failure"));
            successLevel = fps >= 0 ? 1 : -1
        }

        description = description.join(", ")

        let result = {
            result: fps,
            characteristics: [
                { char: testData.source.type, res: roll.terms[0].results[0].result, suc: res[0] <= 0, tar: tar[0] },
                { char: testData.source.type, res: roll.terms[2].results[0].result, suc: res[1] <= 0, tar: tar[1] },
                { char: testData.source.type, res: roll.terms[4].results[0].result, suc: res[2] <= 0, tar: tar[2] }
            ],
            qualityStep: Math.min(game.settings.get("dsa5", "capQSat"), (fps == 0 ? 1 : (fps > 0 ? Math.ceil(fps / 3) : 0)) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0)),
            description: description,
            preData: testData,
            successLevel: successLevel,
            modifiers: modifier,
            extra: {}
        }
        switch (testData.source.type) {
            case "poison":
                let dur = testData.source.data.duration.value.split(" / ").map(x => x.trim())
                let effect = testData.source.data.effect.value.split(" / ").map(x => x.trim())
                result.duration = dur.length > 1 ? (result.successLevel > 0 ? dur[0] : dur[1]) : dur[0]
                result.effect = effect.length > 1 ? (result.successLevel > 0 ? effect[0] : effect[1]) : effect[0]
                break
            case "disease":
                let dmg = testData.source.data.damage.value.split(" / ").map(x => x.trim())
                let duration = testData.source.data.duration.value.split(" / ").map(x => x.trim())
                result.damageeffect = dmg.length > 1 ? (result.successLevel > 0 ? dmg[0] : dmg[1]) : dmg[0]
                result.duration = duration.length > 1 ? (result.successLevel > 0 ? duration[0] : duration[1]) : duration[0]
                break
        }
        return result
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
            case "poison":
            case "disease":
                rollResults = this.rollItem(testData)
                break
            default:
                rollResults = this.rollAttribute(testData)
        }

        //do we need this anymore?
        mergeObject(rollResults, duplicate(testData.extra))
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
                    for (let i = 0; i < roll.dice.length; i++) {
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
                        roll = new Roll(testData.source.data.data.damage.value.replace(/[Ww]/g, "d")).roll()
                        for (let i = 0; i < roll.dice.length; i++) {
                            roll.dice[i].options.colorset = "black"
                        }

                    } else {
                        roll = new Roll("1d20[" + (testData.mode) + "]").roll()
                        roll.dice[0].options.colorset = testData.mode
                    }
                    break;
                case "trait":
                    if (testData.mode == "damage") {
                        roll = new Roll(testData.source.data.data.damage.value.replace(/[Ww]/g, "d")).roll()
                        for (let i = 0; i < roll.dice.length; i++) {
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
                case "poison":
                case "disease":
                    roll = new Roll("1d20+1d20+1d20").roll();
                    for (let i = 0; i < roll.dice.length; i++) {
                        roll.dice[i].options.colorset = "in"
                    }
                    break
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
                    whisper = game.users.filter(user => user.isGM).map(x => x.data._id);
                case "gmroll":
                    whisper = game.users.filter(user => user.isGM).map(x => x.data._id);
                    break;
                case "roll":
                    whisper = game.users.filter(user => user.active).map(x => x.data._id);
                    break;
            }
            game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
        }
    }

    static async renderRollCard(chatOptions, testData, rerenderMessage) {
        let chatData = {
            title: chatOptions.title,
            testData: testData,
            hideData: game.user.isGM,
            modifierList: testData.preData.situationalModifiers.filter(x => x.value != 0)
        }

        if (testData.preData.advancedModifiers) {
            if (testData.preData.advancedModifiers.chars.some(x => x != 0))
                chatData.modifierList.push({ name: game.i18n.localize('MODS.partChecks'), value: testData.preData.advancedModifiers.chars })
            if (testData.preData.advancedModifiers.fps != 0)
                chatData.modifierList.push({ name: game.i18n.localize('MODS.FP'), value: testData.preData.advancedModifiers.fps })
        }

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatOptions.rollMode === "blindroll") {
            chatOptions["blind"] = true;
        } else if (chatOptions.rollMode === "selfroll") chatOptions["whisper"] = [game.user];


        chatOptions["flags.data"] = {
            preData: chatData.testData.preData,
            postData: chatData.testData,
            template: chatOptions.template,
            rollMode: chatOptions.rollMode,
            isOpposedTest: chatOptions.isOpposedTest,
            title: chatOptions.title,
            hideData: chatData.hideData,
            isDSARoll: true
        };

        if (!rerenderMessage) {
            return renderTemplate(chatOptions.template, chatData).then(html => {
                chatOptions["content"] = html
                return ChatMessage.create(chatOptions, false);
            });
        } else {
            return renderTemplate(chatOptions.template, chatData).then(html => {
                //Seems to be a foundry bug, after edit inline rolls are not converted anymore
                const actor = ChatMessage.getSpeakerActor(rerenderMessage.data.speaker) || game.users.get(rerenderMessage.data.user).character;
                const rollData = actor ? actor.getRollData() : {}
                chatOptions["content"] = TextEditor.enrichHTML(html, rollData);
                return rerenderMessage.update({
                    content: chatOptions["content"],
                    ["flags.data"]: chatOptions["flags.data"]
                }).then(newMsg => {

                    ui.chat.updateMessage(newMsg);
                    return newMsg;
                });
            });
        }
    }

    static async _requestRoll(category, name, modifier = 0) {
        let actor = DSA5ChatAutoCompletion._getActor()

        if (actor) {
            let skill = actor.items.find(i => i.name == name && i.type == category);
            let options = { modifier: modifier }
            actor.setupSkill(skill.data, options).then(setupData => {
                actor.basicTest(setupData)
            });

        }
    }


    static async _itemRoll(ev) {
        let input = $(ev.currentTarget),
            messageId = input.parents('.message').attr("data-message-id"),
            message = game.messages.get(messageId),
            speaker = message.data.speaker,
            category = input.attr("data-type"),
            name = input.attr("data-name")

        let actor = DSA5_Utility.getSpeaker(speaker)
        if (!actor && message.data.flags.data)
            actor = new Actordsa5(message.data.flags.data.preData.extra.actor, { temporary: true })

        if (actor) {
            let item = actor.data.items.find(x => x.name == name && x.type == category)
            if (item) {
                item = new Itemdsa5(item, { temporary: true })
                item.setupEffect().then(setupData => {
                    item.itemTest(setupData)
                });
            } else {
                ui.notifications.error(game.i18n.format("DSAError.notFound", { category: category, name: name }))
            }
        }
    }

    static async _rollEdit(ev) {
        let input = $(ev.currentTarget),
            messageId = input.parents('.message').attr("data-message-id"),
            message = game.messages.get(messageId);

        let data = message.data.flags.data
        let newTestData = data.preData;
        let index
        switch (input.attr("data-edit-type")) {
            case "roll":
                index = input.attr("data-edit-id")
                if (newTestData.roll.results.length > index * 2) {
                    newTestData.roll.results[index * 2] = Number(input.val())
                    newTestData.roll.terms[index * 2].results[0].result = Number(input.val())
                } else {
                    let oldDamageRoll = duplicate(data.postData.damageRoll)
                    index = index - newTestData.roll.results.filter(x => !isNaN(x)).length

                    oldDamageRoll.total = oldDamageRoll.total - oldDamageRoll.results[index * 2] + Number(input.val())
                    oldDamageRoll.results[index * 2] = Number(input.val())
                    oldDamageRoll.terms[0].results[index].result = Number(input.val())
                    newTestData.damageRoll = oldDamageRoll
                }
                break
            case "mod":
                index = newTestData.situationalModifiers.findIndex(x => x.name == game.i18n.localize("chatEdit"))
                if (index > 0)
                    newTestData.situationalModifiers.splice(index, 1)

                let newVal = {
                    name: game.i18n.localize("chatEdit"),
                    value: Number(input.val()) - this._situationalModifiers(newTestData)
                }
                newTestData.situationalModifiers.push(newVal)
                break
        }

        let chatOptions = {
            template: data.template,
            rollMode: data.rollMode,
            title: data.title,
            speaker: message.data.speaker,
            user: message.user.data._id
        }

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;

        if (["poison", "disease"].includes(newTestData.source.type)) {
            new Itemdsa5(newTestData.source, { temporary: true })[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions: chatOptions }, { rerenderMessage: message });
        } else {
            let speaker = DSA5_Utility.getSpeaker(message.data.speaker)
            if (!speaker)
                speaker = new Actordsa5(newTestData.extra.actor, { temporary: true })
            speaker[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions: chatOptions }, { rerenderMessage: message });
        }
    }

    static async chatListeners(html) {
        html.on("click", '.expand-mods', event => {
            event.preventDefault()
            let elem = $(event.currentTarget)
            elem.find('i').toggleClass("fa-minus fa-plus")
            elem.siblings('ul,div').fadeToggle()
        })
        html.on('click', '.edit-toggle', ev => {
            ev.preventDefault();
            $(ev.currentTarget).parents(".chat-card").find(".display-toggle").toggle()
        });

        html.on('click', '.defense-botch', ev => {
            CombatTables.showBotchCard("Defense", $(ev.currentTarget).attr("data-weaponless"))
        })
        html.on('click', '.melee-botch', ev => {
            CombatTables.showBotchCard("Melee", $(ev.currentTarget).attr("data-weaponless"))
        })
        html.on('click', '.range-botch', ev => {
            CombatTables.showBotchCard("Range", $(ev.currentTarget).attr("data-weaponless"))
        })
        html.on('click', '.liturgy-botch', ev => {
            Miscast.showBotchCard("Liturgy")
        })
        html.on('click', '.spell-botch', ev => {
            Miscast.showBotchCard("Spell")
        })
        html.on('click', '.roll-item', ev => {
            DiceDSA5._itemRoll(ev)
        })
        html.on('change', '.roll-edit', ev => {
            DiceDSA5._rollEdit(ev)
        })
        html.on('click', '.request-roll', ev => {
            DiceDSA5._requestRoll($(ev.currentTarget).attr("data-type"), $(ev.currentTarget).attr("data-name"), Number($(ev.currentTarget).attr("data-modifier")) || 0)
        })

        html.on("click", ".message-delete", ev => {
            let message = game.messages.get($(ev.currentTarget).parents(".message").attr("data-message-id"))
            let targeted = message.data.flags.unopposeData // targeted opposed test
            if (!targeted)
                return;

            let target = canvas.tokens.get(message.data.flags.unopposeData.targetSpeaker.token)
            target.actor.update({
                "-=flags.oppose": null
            })
        })
    }


}