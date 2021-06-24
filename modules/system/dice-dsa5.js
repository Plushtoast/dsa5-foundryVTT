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
import OpposedDsa5 from "./opposed-dsa5.js";
import DSAActiveEffectConfig from "../status/active_effects.js"
import DSA5SoundEffect from "./dsa-soundeffect.js";

export default class DiceDSA5 {
    static async setupDialog({ dialogOptions, testData, cardOptions }) {
        let rollMode = await game.settings.get("core", "rollMode");
        let sceneStress = "challenging";

        if (typeof testData.source.toObject === 'function')
            testData.source = testData.source.toObject(false)

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
            rollModes: CONFIG.Dice.rollModes ? CONFIG.Dice.rollModes : CONFIG.rollModes,
            defenseCount: await this.getDefenseCount(testData)
        })
        mergeObject(cardOptions, {
            user: game.user.id,
        })

        if (!testData.extra.options.bypass) {
            let html = await renderTemplate(dialogOptions.template, dialogOptions.data);
            return new Promise((resolve, reject) => {
                let dialog = DSA5Dialog.getDialogForItem(testData.source.type)
                let buttons = {
                    rollButton: {
                        label: game.i18n.localize("Roll"),
                        callback: (html) => {
                            game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html)
                            resolve(dialogOptions.callback(html))
                        }
                    }
                }
                if (testData.source.type == "rangeweapon") {
                    const LZ = Actordsa5.calcLZ(testData.source, testData.extra.actor)
                    const progress = testData.source.data.reloadTime.progress
                    if (progress < LZ) {
                        mergeObject(buttons, {
                            reloadButton: {
                                label: `${game.i18n.localize("WEAPON.reload")} (${progress}/${LZ})`,
                                callback: async() => {
                                    const actor = await DSA5_Utility.getSpeaker(testData.extra.speaker)
                                    await actor.updateEmbeddedDocuments("Item", [{ _id: testData.source._id, "data.reloadTime.progress": progress + 1 }])
                                    const infoMsg = game.i18n.format("WEAPON.isReloading", { actor: testData.extra.actor.name, item: testData.source.name, status: `${progress+1}/${LZ}` })
                                    await ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg))
                                }
                            }
                        })
                    }
                }
                new dialog({
                    title: dialogOptions.title,
                    content: html,
                    buttons,
                    default: "rollButton"
                }).recallSettings(testData.extra.speaker, testData.source, testData.mode).render(true);
            })
        } else {
            testData.testModifier = testData.extra.options.testModifier || testData.testModifier
            cardOptions.rollMode = testData.extra.options.rollMode || rollMode
            resolve({ testData, cardOptions })
        }
        reject()
    }

    static async getDefenseCount(testData) {
        if (game.combat) return await game.combat.getDefenseCount(testData.extra.speaker)
        return 0
    }

    static _rollSingleD20(roll, res, id, modifier, testData, combatskill = "", multiplier = 1) {
        let description = "";

        let chars = []
        res += modifier
        res = Math.round(res * multiplier)
        let res1 = res - roll.terms[0].results[0].result;
        let color = DSA5.dieColors[id] || id;

        chars.push({ char: id, res: roll.terms[0].results[0].result, suc: res1 >= 0, tar: res });
        let rollConfirm = new Roll("1d20").evaluate({ async: false });
        let successLevel = res1 >= 0 ? 1 : -1

        let botch = 20
        let crit = 1
        if (testData.source.type == "meleeweapon") {
            botch = testData.extra.actor.data.meleeStats.botch
            crit = testData.extra.actor.data.meleeStats.crit
        }
        if (testData.source.type == "rangeweapon") {
            botch = testData.extra.actor.data.rangeStats.botch
            crit = testData.extra.actor.data.rangeStats.crit
        }
        if (/(\(|,)( )?i\)$/.test(testData.source.name)) botch = Math.min(19, botch)


        if (testData.situationalModifiers.find(x => x.name == game.i18n.localize('opportunityAttack') && x.value != 0)) {
            botch = 50
            crit = -50
        }

        if (roll.terms[0].results.filter(x => x.result == crit).length == 1) {
            description = game.i18n.localize("CriticalSuccess");
            if (game.settings.get("dsa5", "noConfirmationRoll")) {
                successLevel = 3
            } else {
                let res2 = res - rollConfirm.terms[0].results[0].result;
                if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.weaponAptitude')} (${combatskill})`) && !(res2 >= 0)) {
                    let a = rollConfirm.terms[0].results[0].result
                    rollConfirm = new Roll("1d20").evaluate({ async: false });
                    res2 = res - rollConfirm.terms[0].results[0].result;
                    description += ", " + game.i18n.format("usedWeaponExpertise", { a: a, b: rollConfirm.terms[0].results[0].result })
                }
                this._addRollDiceSoNice(testData, rollConfirm, color)
                chars.push({ char: id, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
                successLevel = res2 >= 0 ? 3 : 2
            }
        } else if (roll.terms[0].results.filter(x => x.result >= botch).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            if (game.settings.get("dsa5", "noConfirmationRoll")) {
                successLevel = -3

            } else {
                let res2 = res - rollConfirm.terms[0].results[0].result;
                if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.weaponAptitude')} (${combatskill})`) && !(res2 >= 0)) {
                    let a = rollConfirm.terms[0].results[0].result
                    rollConfirm = new Roll("1d20").evaluate({ async: false });
                    res2 = res - rollConfirm.terms[0].results[0].result;
                    description += ", " + game.i18n.format("usedWeaponExpertise", { a: a, b: rollConfirm.terms[0].results[0].result })
                }
                this._addRollDiceSoNice(testData, rollConfirm, color)
                chars.push({ char: id, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
                successLevel = res2 >= 0 ? -2 : -3
            }
        }

        if (description == "") {
            description = game.i18n.localize(res1 >= 0 ? "Success" : "Failure");
        } else if (!game.settings.get("dsa5", "noConfirmationRoll")) {
            if (Math.abs(successLevel) == 3) {
                description = `${game.i18n.localize("confirmed")} ${description}`
            } else if (Math.abs(successLevel) == 2) {
                description = `${game.i18n.localize("unconfirmed")} ${description}`
            }
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

        let result = {
            rollType: "regenerate",
            preData: testData,
            modifiers: modifier,
            extra: {}
        }

        let attrs = ["LeP"]
        if (testData.extra.actor.isMage) attrs.push("AsP")
        if (testData.extra.actor.isPriest) attrs.push("KaP")
        let index = 0

        for (let k of attrs) {
            this._appendSituationalModifiers(testData, game.i18n.localize(`LocalizedIDs.regeneration${k}`), AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize(`LocalizedIDs.regeneration${k}`)), k)
            this._appendSituationalModifiers(testData, game.i18n.localize(`LocalizedIDs.weakRegeneration${k}`), AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize(`LocalizedIDs.weakRegeneration${k}`)) * -1, k)
            this._appendSituationalModifiers(testData, game.i18n.localize(`LocalizedIDs.advancedRegeneration${k}`), SpecialabilityRulesDSA5.abilityStep(testData.extra.actor, game.i18n.localize(`LocalizedIDs.advancedRegeneration${k}`)), k)

            chars.push({ char: k, res: roll.terms[index].results[0].result, die: "d6" })
            result[k] = Math.round(Math.max(0, Number(roll.terms[index].results[0].result) + Number(modifier) + this._situationalModifiers(testData, k)) * Number(testData.regenerationFactor))
            index += 2
        }

        result["characteristics"] = chars
        return result
    }

    static rollStatus(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").evaluate({ async: false });
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let result = this._rollSingleD20(roll, testData.source.data.max, testData.extra.statusId, this._situationalModifiers(testData), testData, "", this._situationalMultipliers(testData))
        result["rollType"] = "dodge"
        if (testData.extra.statusId == "dodge" && result.successLevel == 3) {
            result["description"] += ", " + game.i18n.localize("attackOfOpportunity")
        } else if (testData.extra.statusId == "dodge" && result.successLevel == -3) {
            if (game.settings.get("dsa5", "defenseBotchTableEnabled")) {
                result["description"] += `, <a class="roll-button defense-botch" data-weaponless="true"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
            } else {
                result["description"] += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").evaluate({ async: false }).total)
            }
        }
        return result
    }

    static rollAttribute(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").evaluate({ async: false });
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("Difficulty"), testData.testDifficulty)
        let result = this._rollSingleD20(roll, testData.source.data.value, testData.extra.characteristicId, this._situationalModifiers(testData), testData, "", this._situationalMultipliers(testData))
        result["rollType"] = "attribute"
        return result
    }

    static rollDamage(testData) {
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);
        let weapon;
        let chars = []

        if (testData.source.type == "meleeweapon") {
            const skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.combatskill.value), testData.extra.actor)
            weapon = Actordsa5._prepareMeleeWeapon(testData.source, [skill], testData.extra.actor)
        } else if (testData.source.type == "rangeweapon") {
            const skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.combatskill.value), testData.extra.actor)
            weapon = Actordsa5._prepareRangeWeapon(testData.source, [], [skill], testData.extra.actor)
        } else {
            weapon = testData.source.data
        }

        let roll = testData.roll ? testData.roll : new Roll(weapon.data.damage.value.replace(/[Ww]/g, "d")).evaluate({ async: false })
        let damage = roll.total + modifier;

        for (let k of roll.terms) {
            if (k instanceof Die || k.class == "Die") {
                for (let l of k.results) chars.push({ char: testData.mode, res: l.result, die: "d" + k.faces })
            }
        }

        if (weapon.extraDamage) damage = Number(weapon.extraDamage) + Number(damage)


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
            return _this + ((val.type == filter || (filter == "" && val.type == undefined)) ? (Number(val.value) || 0) : 0)
        }, 0);
    }

    static _situationalPartCheckModifiers(testData) {
        return testData.situationalModifiers.reduce(function(_this, val) {
            if (val.type == "TPM") {
                const pcs = val.value.split("|")
                if (pcs.length != 3) return _this

                _this[0] = _this[0] + Number(pcs[0])
                _this[1] = _this[1] + Number(pcs[1])
                _this[2] = _this[2] + Number(pcs[2])
                return _this
            } else {
                return _this
            }
        }, [0, 0, 0]);
    }

    static _situationalMultipliers(testData) {
        return testData.situationalModifiers.reduce(function(_this, val) {
            return _this * (val.type == "*" ? (Number(`${val.value}`.replace(/,/, ".")) || 1) : 1)
        }, 1);
    }

    static _appendSituationalModifiers(testData, name, val, type = "") {
        let existing = testData.situationalModifiers.find(x => x.name == name)

        if (existing) {
            existing.value = val
        } else {
            testData.situationalModifiers.push({
                name: name,
                value: val,
                type: type
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

    static async rollCombatTrait(testData) {
        let roll = testData.roll ? testData.roll : await new Roll("1d20").evaluate({ async: true });
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
        }
        let result = this._rollSingleD20(roll, testData.mode == "attack" ? Number(source.data.at.value) : Number(source.data.pa), testData.mode, this._situationalModifiers(testData), testData, "", this._situationalMultipliers(testData))

        let success = result.successLevel > 0
        let doubleDamage = result.successLevel > 2

        switch (result.successLevel) {
            case 3:
                if (testData.mode == "attack") {
                    result.description += ", " + game.i18n.localize("halfDefense") + ", " + game.i18n.localize("doubleDamage")
                    result.halfDefense = true
                } else
                    result.description += ", " + game.i18n.localize("attackOfOpportunity")
                break;
            case -3:
                if (testData.mode == "attack" && source.data.traitType.value == "meleeAttack" && (await game.settings.get("dsa5", "meleeBotchTableEnabled"))) {
                    result.description += `, <a class="roll-button melee-botch" data-weaponless="true"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else if (testData.mode == "attack" && (await game.settings.get("dsa5", "rangeBotchTableEnabled"))) {
                    result.description += `, <a class="roll-button range-botch" data-weaponless="true"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else {
                    result.description += ", " + game.i18n.localize("selfDamage") + (await new Roll("1d6+2").evaluate({ async: true })).total
                }
                break;
            case 2:
                if (testData.mode == "attack") {
                    result.description += ", " + game.i18n.localize("halfDefense")
                    result.halfDefense = true
                }
                break;
            case -2:
                break;
        }
        if (testData.mode == "attack" && success) {
            await DiceDSA5.evaluateDamage(testData, result, source, source.data.traitType.value == "rangeAttack", doubleDamage)
        }
        result["rollType"] = "weapon"
        let effect = DiceDSA5.parseEffect(source.data.effect.value)
        if (effect)
            result["parsedEffect"] = effect
        return result
    }

    static _stringToRoll(text, testData) {
        return Roll.safeEval(`${text}`.replace(/\d{1}[dDwW]\d/g, function(match) {
            let roll = new Roll(match.replace(/[Ww]/, "d")).evaluate({ async: false })
            if (testData) DiceDSA5._addRollDiceSoNice(testData, roll, "ch")
            return roll.total
        }))
    }

    static async evaluateDamage(testData, result, weapon, isRangeWeapon, doubleDamage) {
        let rollFormula = weapon.data.damage.value.replace(/[Ww]/g, "d")
        let overrideDamage = []
        let bonusDmg = testData.situationalModifiers.reduce(function(_this, val) {
            let number = 0
            if (val.damageBonus) {
                const isOverride = /^=/.test(val.damageBonus)
                const rollString = `${val.damageBonus}`.replace(/^=/, "")
                let roll = DiceDSA5._stringToRoll(rollString, testData)
                number = roll * val.step

                if (isOverride) {
                    //val.damageBonus = `=${number}`
                    //val.damageBonus = 0
                    rollFormula = rollString.replace(/[Ww]/, "d")
                    overrideDamage.push({ name: val.name, roll })
                    return _this
                } else {
                    val.damageBonus = number
                    return _this + number
                }
            }
            return _this
        }, 0);
        let damageRoll = testData.damageRoll ? await testData.damageRoll : await DiceDSA5.manualRolls(await new Roll(rollFormula).evaluate({ async: true }), "CHAR.DAMAGE")
            //this._addRollDiceSoNice(testData, damageRoll, "black")
        let damage = damageRoll.total
        let damageBonusDescription = []
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

        if (overrideDamage.length > 0) {
            damageBonusDescription.push(overrideDamage[0].name + " " + damage)
        } else {
            damage += bonusDmg

            damageBonusDescription.push(game.i18n.localize("Roll") + " " + weaponroll)
            if (weaponBonus != 0)
                damageBonusDescription.push(game.i18n.localize("weaponModifier") + " " + weaponBonus)

            damageBonusDescription.push(...testData.situationalModifiers.map(x => { return x.damageBonus ? `${x.name} ${x.damageBonus}` : "" }).filter(x => x != ""))

            if (testData.situationalModifiers.find(x => x.name.indexOf(game.i18n.localize("CONDITION.bloodrush")) > -1)) {
                damage += 2
                damageBonusDescription.push(game.i18n.localize("CONDITION.bloodrush") + " " + 2)
            }

            if (weapon.extraDamage) {
                damage = Number(weapon.extraDamage) + Number(damage)
                damageBonusDescription.push(game.i18n.localize("damageThreshold") + " " + weapon.extraDamage)
            }

            let status
            if (isRangeWeapon) {
                let rangeDamageMod = DSA5.rangeMods[testData.rangeModifier].damage
                damage += rangeDamageMod
                if (rangeDamageMod != 0)
                    damageBonusDescription.push(game.i18n.localize("distance") + " " + rangeDamageMod)


                status = testData.extra.actor.data.rangeStats.damage
            } else {
                status = testData.extra.actor.data.meleeStats.damage
            }

            const statusDmg = DiceDSA5._stringToRoll(status, testData)
            if (statusDmg != 0) {
                damage += statusDmg
                damageBonusDescription.push(game.i18n.localize("statuseffects") + " " + statusDmg)
            }

        }


        if (doubleDamage) {
            damage = damage * 2
            damageBonusDescription.push(game.i18n.localize("doubleDamage"))
        }

        result["damagedescription"] = damageBonusDescription.join(", ")
        result["damage"] = Math.round(damage)
        result["damageRoll"] = duplicate(damageRoll)
    }

    static async rollWeapon(testData) {
        let roll = testData.roll ? testData.roll : await new Roll("1d20").evaluate({ async: true });
        let weapon;
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("wrongHand"), testData.wrongHand)

        let source = testData.source
        let combatskill = source.data.combatskill.value

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == combatskill), testData.extra.actor)

        if (source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(source, [skill], testData.extra.actor)

            this._appendSituationalModifiers(testData, game.i18n.localize("narrowSpace"), this._getNarrowSpaceModifier(weapon, testData))

            if (testData.mode == "attack") {
                this._appendSituationalModifiers(testData, game.i18n.localize("doubleAttack"), testData.doubleAttack)
                this._appendSituationalModifiers(testData, game.i18n.localize("opposingWeaponSize"), this._compareWeaponReach(weapon, testData))
            }
        } else {
            weapon = Actordsa5._prepareRangeWeapon(source, [], [skill], testData.extra.actor)
            this._appendSituationalModifiers(testData, game.i18n.localize("distance"), DSA5.rangeMods[testData.rangeModifier].attack)
            this._appendSituationalModifiers(testData, game.i18n.localize("sizeCategory"), testData.sizeModifier)
        }
        let result = this._rollSingleD20(roll, weapon[testData.mode], testData.mode, this._situationalModifiers(testData), testData, combatskill, this._situationalMultipliers(testData))

        let success = result.successLevel > 0
        let doubleDamage = result.successLevel > 2

        switch (result.successLevel) {
            case 3:
                if (testData.mode == "attack") {
                    result.description += ", " + game.i18n.localize("halfDefense") + ", " + game.i18n.localize("doubleDamage")
                    result.halfDefense = true
                } else
                    result.description += ", " + game.i18n.localize("attackOfOpportunity")
                break;
            case -3:
                if (testData.mode == "attack" && source.type == "meleeweapon" && (await game.settings.get("dsa5", "meleeBotchTableEnabled")))
                    result.description += `, <a class="roll-button melee-botch" data-weaponless="${source.data.combatskill.value == game.i18n.localize('LocalizedIDs.wrestle')}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                else if (testData.mode == "attack" && (await game.settings.get("dsa5", "rangeBotchTableEnabled")))
                    result.description += `, <a class="roll-button range-botch" data-weaponless="false"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                else if (testData.mode != "attack" && (await game.settings.get("dsa5", "defenseBotchTableEnabled")))
                    result.description += `, <a class="roll-button defense-botch" data-weaponless="${source.data.combatskill.value == game.i18n.localize('LocalizedIDs.wrestle')}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                else
                    result.description += ", " + game.i18n.localize("selfDamage") + (await new Roll("1d6+2").evaluate({ async: true })).total
                break;
            case 2:
                if (testData.mode == "attack") {
                    result.description += ", " + game.i18n.localize("halfDefense")
                    result.halfDefense = true
                }
                break;
            case -2:
                break;
        }

        if (testData.mode == "attack" && success)
            await DiceDSA5.evaluateDamage(testData, result, weapon, source.type == "rangeweapon", doubleDamage)

        result["rollType"] = "weapon"
        let effect = DiceDSA5.parseEffect(weapon.data.effect ? weapon.data.effect.value : "")

        if (effect) result["parsedEffect"] = effect

        return result
    }

    static async _addRollDiceSoNice(testData, roll, color) {
        if (testData.rollMode) {
            for (let i = 0; i < roll.dice.length; i++)
                roll.dice[i].options.colorset = color

            this.showDiceSoNice(roll, testData.rollMode);
        }
    }

    static rollCombatskill(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").evaluate({ async: false });
        let description = "";
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);

        let weaponSource = testData.source.data.data == undefined ? testData.source : testData.source.data
        let source = Actordsa5._calculateCombatSkillValues(weaponSource, testData.extra.actor)
        let res = modifier + source.data[testData.mode].value;

        let res1 = res - roll.terms[0].results[0].result;
        let chars = [{ char: testData.mode, res: roll.terms[0].results[0].result, suc: res1 >= 0, tar: res }]
        let rollConfirm = new Roll("1d20").evaluate({ async: false });
        rollConfirm.dice[0].options.colorset = testData.mode


        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess") + ", " + game.i18n.localize("halfDefense");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 >= 0) {
                description += ", " + game.i18n.localize("doubleDamage")
            }
            this._addRollDiceSoNice(testData, rollConfirm, testData.mode)
            chars.push({ char: testData.mode, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });

        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 < 0) {
                if (testData.mode == "attack" && source.data.weapontype.value == "melee" && game.settings.get("dsa5", "meleeBotchTableEnabled")) {
                    description += `, <a class="roll-button melee-botch" data-weaponless="${source.name == game.i18n.localize('LocalizedIDs.wrestle')}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else if (testData.mode == "attack" && game.settings.get("dsa5", "rangeBotchTableEnabled")) {
                    description += `, <a class="roll-button range-botch" data-weaponless="${source.name == game.i18n.localize('LocalizedIDs.wrestle')}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else if (testData.mode != "attack" && game.settings.get("dsa5", "defenseBotchTableEnabled")) {
                    description += `, <a class="roll-button defense-botch" data-weaponless="${source.name == game.i18n.localize('LocalizedIDs.wrestle')}"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
                } else {
                    description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").evaluate({ async: false }).total)
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

        if (description == "")
            description = game.i18n.localize(res1 >= 0 ? "Success" : "Failure");


        return {
            rollType: "weapon",
            characteristics: chars,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
    }

    static async manualRolls(roll, description = "") {
        if (game.settings.get("dsa5", "allowPhysicalDice")) {
            let result = false;
            let form;
            let dice = []
            for (let term of roll.terms) {
                if (term instanceof Die || term.class == "Die") {
                    for (let res of term.results) {
                        dice.push({ faces: term.faces, val: res.result })
                    }
                }
            }

            let template = await renderTemplate('systems/dsa5/templates/dialog/manualroll-dialog.html', { dice: dice, description: description });
            [result, form] = await new Promise((resolve, reject) => {
                new Dialog({
                    title: game.i18n.localize("DSASETTINGS.allowPhysicalDice"),
                    content: template,
                    default: 'ok',
                    buttons: {
                        ok: {
                            icon: '<i class="fa fa-check"></i>',
                            label: game.i18n.localize("yes"),
                            callback: dlg => {
                                resolve([true, dlg])
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
                form.find('.dieInput').each(function(index) {
                    let val = Number($(this).val())
                    if (val > 0)
                        DSA5_Utility.editRollAtIndex(roll, index, val)
                    index++
                });
            }
        }
        return roll
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
            let extraFps = new Roll("1d6").evaluate({ async: false }).total
            res.description = res.description + ", " + game.i18n.localize("additionalFPs") + " " + extraFps
            res.result = res.result + extraFps
            res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.cost / 2)
        } else if (res.successLevel <= -2) {
            res.description += `, <a class="roll-button ${"spell" ? "spell" : "liturgy"}-botch"><i class="fas fa-dice"></i>${game.i18n.localize('CriticalFailure')} ${game.i18n.localize("table")}</a>`
        }

        if (res.successLevel < 0) {
            res.preData.calculatedSpellModifiers.finalcost = Math.round(res.preData.calculatedSpellModifiers.cost / (SpecialabilityRulesDSA5.hasAbility(testData.extra.actor, game.i18n.localize('LocalizedIDs.traditionWitch')) ? 3 : 2))
        } else {
            if (testData.source.data.effectFormula.value != "") {
                let formula = testData.source.data.effectFormula.value.replace(game.i18n.localize('CHARAbbrev.QS'), res.qualityStep).replace(/[Ww]/g, "d")

                if (/(,|;)/.test(formula)) formula = formula.split(/[,;]/)[res.qualityStep - 1]

                let rollEffect = testData.damageRoll ? testData.damageRoll : new Roll(formula).evaluate({ async: false })
                this._addRollDiceSoNice(testData, rollEffect, "black")
                res["calculatedEffectFormula"] = formula
                for (let k of rollEffect.terms) {
                    if (k instanceof Die || k.class == "Die")
                        for (let l of k.results) res["characteristics"].push({ char: "effect", res: l.result, die: "d" + k.faces })
                }
                res["damageRoll"] = rollEffect
                res["damage"] = rollEffect.total
            }
        }
        res.preData.calculatedSpellModifiers.finalcost = Math.max(0, Number(res.preData.calculatedSpellModifiers.finalcost) + AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakKarmicBody')) + AdvantageRulesDSA5.vantageStep(testData.extra.actor, game.i18n.localize('LocalizedIDs.weakAstralBody')) + testData.extra.actor.data[["ceremony", "liturgy"].includes(testData.source.type) ? "kapModifier" : "aspModifier"])

        if (AdvantageRulesDSA5.hasVantage(testData.extra.actor, game.i18n.localize('CONDITION.minorSpirits')) &&
            !testData.extra.actor.effects.find(x => x.label == game.i18n.localize('CONDITION.minorSpirits'))) {
            const ghostroll = new Roll("1d20").evaluate({ async: false })
            if (ghostroll.total <= res.preData.calculatedSpellModifiers.finalcost) {
                res.description += ", " + game.i18n.localize("minorghostsappear")
                DSA5_Utility.getSpeaker(testData.extra.speaker).addCondition("minorSpirits")
            }
        }

        return res
    }

    static _rollThreeD20(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20+1d20+1d20").evaluate({ async: false });
        let description = [];
        let successLevel = 0

        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        this._appendSituationalModifiers(testData, game.i18n.localize("Difficulty"), testData.testDifficulty)
        let modifier = this._situationalModifiers(testData);

        let fws = testData.source.data.talentValue.value + testData.advancedModifiers.fws + this._situationalModifiers(testData, "FW");

        const pcms = this._situationalPartCheckModifiers(testData, "TPM")

        let tar = [1, 2, 3].map(x => testData.extra.actor.data.characteristics[testData.source.data[`characteristic${x}`].value].value + modifier + testData.advancedModifiers.chars[x - 1] + pcms[x - 1])
        let res = [0, 1, 2].map(x => roll.terms[x * 2].results[0].result - tar[x])

        for (let k of res)
            if (k > 0) fws -= k

        let crit = testData.extra.actor.data.skillModifiers.crit
        let botch = testData.extra.actor.data.skillModifiers.botch
        if ((testData.source.type == "spell" || testData.source.type == "ritual") && AdvantageRulesDSA5.hasVantage(testData.extra.actor, game.i18n.localize('LocalizedIDs.wildMagic')))
            botch = 19

        if (testData.source.type == "skill" && AdvantageRulesDSA5.hasVantage(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.incompetent')} (${testData.source.name})`)) {
            let reroll = new Roll("1d20").evaluate({ async: false })
            let indexOfMinValue = res.reduce((iMin, x, i, arr) => x < arr[iMin] ? i : iMin, 0)
            let oldValue = roll.terms[indexOfMinValue * 2].total
            fws += Math.max(res[indexOfMinValue], 0)
            fws -= Math.max(0, reroll.total - tar[indexOfMinValue])
            DSA5_Utility.editRollAtIndex(roll, indexOfMinValue, reroll.total)
            this._addRollDiceSoNice(testData, reroll, roll.terms[indexOfMinValue * 2].options.colorset)
            description.push(game.i18n.format("CHATNOTIFICATION.unableReroll", { die: (indexOfMinValue + 1), oldVal: oldValue, newVal: reroll.total }))
        }
        if (testData.source.type == "skill" && TraitRulesDSA5.hasTrait(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.automaticSuccess')} (${testData.source.name})`)) {
            description.push(game.i18n.localize("LocalizedIDs.automaticSuccess"));
            successLevel = 1
        } else if (testData.source.type == "skill" && TraitRulesDSA5.hasTrait(testData.extra.actor, `${game.i18n.localize('LocalizedIDs.automaticFail')} (${testData.source.name})`)) {
            description.push(game.i18n.localize("LocalizedIDs.automaticFail"));
            successLevel = -1
        } else {
            successLevel = DiceDSA5.get3D20SuccessLevel(roll, fws, botch, crit)
            description.push(DiceDSA5.getSuccessDescription(successLevel))
        }

        description = description.join(", ")
        let qualityStep = 0

        if (successLevel > 0) {
            fws += this._situationalModifiers(testData, "FP")
            qualityStep = (fws == 0 ? 1 : (fws > 0 ? Math.ceil(fws / 3) : 0)) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0)

            if (qualityStep > 0) qualityStep += (testData.advancedModifiers.qls || 0) + this._situationalModifiers(testData, "QL")
        }

        qualityStep = Math.min(game.settings.get("dsa5", "capQSat"), qualityStep)

        return {
            result: fws,
            characteristics: [0, 1, 2].map(x => { return { char: testData.source.data[`characteristic${x + 1}`].value, res: roll.terms[x * 2].results[0].result, suc: res[x] <= 0, tar: tar[x] } }),
            qualityStep,
            description,
            preData: testData,
            successLevel,
            modifiers: modifier,
            extra: {}
        }
    }

    static rollTalent(testData) {
        let res = this._rollThreeD20(testData)
        res["rollType"] = "talent"
        return res
    }

    static get3D20SuccessLevel(roll, fws, botch = 20, critical = 1) {
        if (roll.terms.filter(x => x.results && x.results[0].result <= critical).length == 3) return 3
        else if (roll.terms.filter(x => x.results && x.results[0].result <= critical).length == 2) return 2
        else if (roll.terms.filter(x => x.results && x.results[0].result >= botch).length == 3) return -3
        else if (roll.terms.filter(x => x.results && x.results[0].result >= botch).length == 2) return -2
        else return fws >= 0 ? 1 : -1
    }

    static getSuccessDescription(successLevel) {
        return game.i18n.localize(["AstoundingFailure", "CriticalFailure", "Failure", "", "Success", "CriticalSuccess", "AstoundingSuccess"][successLevel + 3])
    }

    static rollItem(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20+1d20+1d20").evaluate({ async: false });
        let description = [];


        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)
        let modifier = this._situationalModifiers(testData);

        let fws = Number(testData.source.data.step.value)
        let tar = [1, 2, 3].map(x => 10 + Number(testData.source.data.step.value) + modifier)
        let res = [0, 1, 2].map(x => roll.terms[x * 2].results[0].result - tar[x])
        for (let k of res) {
            if (k > 0)
                fws -= k
        }

        let failValue = 20

        const successLevel = DiceDSA5.get3D20SuccessLevel(roll, fws, failValue)
        description.push(DiceDSA5.getSuccessDescription(successLevel))

        description = description.join(", ")

        let result = {
            result: fws,
            characteristics: [0, 1, 2].map(x => { return { char: testData.source.type, res: roll.terms[x * 2].results[0].result, suc: res[x] <= 0, tar: tar[x] } }),
            qualityStep: Math.min(game.settings.get("dsa5", "capQSat"), (fws == 0 ? 1 : (fws > 0 ? Math.ceil(fws / 3) : 0)) + (testData.qualityStep != undefined ? Number(testData.qualityStep) : 0)),
            description,
            preData: testData,
            successLevel,
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

    static async rollTest(testData) {
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
                if (testData.mode == "parry") await this.updateDefenseCount(testData)
                rollResults = testData.mode == "damage" ? this.rollDamage(testData) : await this.rollCombatTrait(testData)
                break
            case "regenerate":
                rollResults = this.rollRegeneration(testData)
                break
            case "meleeweapon":
            case "rangeweapon":
                if (testData.mode == "parry") await this.updateDefenseCount(testData)
                rollResults = testData.mode == "damage" ? this.rollDamage(testData) : await this.rollWeapon(testData)
                break;
            case "dodge":
                await this.updateDefenseCount(testData)
                rollResults = this.rollStatus(testData)
                break;
            case "poison":
            case "disease":
                rollResults = this.rollItem(testData)
                break
            default:
                rollResults = this.rollAttribute(testData)
        }
        mergeObject(rollResults, deepClone(testData.extra))
        return rollResults
    }

    static async updateDefenseCount(testData) {
        if (game.combat) await game.combat.updateDefenseCount(testData.extra.speaker)
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
                    roll = await new Roll(`1d20[${testData.source.data.characteristic1.value}]+1d20[${testData.source.data.characteristic2.value}]+1d20[${testData.source.data.characteristic3.value}]`).evaluate({ async: true });
                    break;
                case "regenerate":
                    let rollstring = "1d6[mu]"
                    if (testData.extra.actor.isMage) rollstring += "+1d6[ge]"
                    if (testData.extra.actor.isPriest) rollstring += "+1d6[in]"
                    roll = await new Roll(rollstring).evaluate({ async: true })
                    break;
                case "meleeweapon":
                case "rangeweapon":
                case "weaponless":
                case "combatskill":
                case "trait":
                    if (testData.mode == "damage") {
                        roll = await new Roll(testData.source.data.damage.value.replace(/[Ww]/g, "d")).evaluate({ async: true })
                        for (let i = 0; i < roll.dice.length; i++) roll.dice[i].options.colorset = "black"

                    } else
                        roll = await new Roll(`1d20[${testData.mode}]`).evaluate({ async: true })
                    break;
                case "dodge":
                    roll = await new Roll("1d20[in]").evaluate({ async: true });
                    break;
                case "poison":
                case "disease":
                    roll = await new Roll("1d20[in]+1d20[in]+1d20[in]").evaluate({ async: true });
                    break
                default:
                    roll = await new Roll(`1d20[${testData.source.data.label.split('.')[1].toLowerCase()}]`).evaluate({ async: true });
            }
            roll = await DiceDSA5.manualRolls(roll, testData.source.type)
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
                    break
                case "gmroll":
                    whisper = game.users.filter(user => user.isGM).map(x => x.data._id);
                    break;
                case "selfroll":
                    whisper = []
                    break;
            }
            game.dice3d.showForRoll(roll, game.user, true, whisper, blind);
        }
    }

    static addApplyEffectData(testData) {
        const source = testData.preData.source
        if (["spell", "liturgy", "ritual", "ceremony"].includes(source.type)) {
            return testData.successLevel > 0 && source.effects.length > 0
        } else if (["disease", "poison"].includes(source.type)) {
            return source.effects.length > 0
        } else {
            const specAbIds = testData.preData.situationalModifiers.filter(x => x.specAbId).map(x => x.specAbId)
            if (specAbIds.length > 0) {
                const specAbs = testData.preData.extra.actor.items.filter(x => specAbIds.includes(x._id))
                for (const spec of specAbs) {
                    if (spec.effects.length > 0) return true
                }
            }

        }
        return false
    }

    static async renderRollCard(chatOptions, testData, rerenderMessage) {

        const applyEffect = this.addApplyEffectData(testData)
        const preData = deepClone(testData.preData)
        const hideDamage = rerenderMessage ? rerenderMessage.data.flags.data.hideDamage : preData.mode == "attack"
        await Hooks.call("postProcessDSARoll", chatOptions, testData, rerenderMessage, hideDamage)
        delete preData.extra.actor
        delete testData.actor
        delete testData.preData

        let chatData = {
            title: chatOptions.title,
            testData,
            hideData: game.user.isGM,
            preData,
            hideDamage,
            modifierList: preData.situationalModifiers.filter(x => x.value != 0),
            applyEffect
        }

        if (preData.advancedModifiers) {
            if (preData.advancedModifiers.chars.some(x => x != 0))
                chatData.modifierList.push({ name: game.i18n.localize('MODS.partChecks'), value: preData.advancedModifiers.chars })
            if (preData.advancedModifiers.fws != 0)
                chatData.modifierList.push({ name: game.i18n.localize('MODS.FW'), value: preData.advancedModifiers.fws })
            if (preData.advancedModifiers.qls != 0)
                chatData.modifierList.push({ name: game.i18n.localize('MODS.QS'), value: preData.advancedModifiers.qls })
        }

        DSA5SoundEffect.playEffect(preData.mode, preData.source, testData.successLevel)

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = game.users.filter(user => user.isGM).map(x => x.data._id)
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;
        else if (chatOptions.rollMode === "selfroll") chatOptions["whisper"] = [game.user];

        chatOptions["flags.data"] = {
            preData,
            postData: testData,
            template: chatOptions.template,
            rollMode: chatOptions.rollMode,
            isOpposedTest: chatOptions.isOpposedTest,
            title: chatOptions.title,
            hideData: chatData.hideData,
            hideDamage: chatData.hideDamage,
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
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()

        if (actor) {
            game.user.updateTokenTargets([]);
            let options = { modifier }

            switch (category) {
                case "attribute":
                    let characteristic = Object.keys(game.dsa5.config.characteristics).find(key => game.i18n.localize(game.dsa5.config.characteristics[key]) == name)
                    actor.setupCharacteristic(characteristic, options, tokenId).then(setupData => { actor.basicTest(setupData) });
                    break
                case "regeneration":
                    actor.setupRegeneration("regenerate", {}, tokenId).then(setupData => { actor.basicTest(setupData) });
                    break
                default:
                    let skill = actor.items.find(i => i.name == name && i.type == category);
                    actor.setupSkill(skill.data, options, tokenId).then(setupData => { actor.basicTest(setupData) });
            }
        }
    }

    static async _requestGC(category, name, messageId, modifier = 0) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()

        if (actor) {
            game.user.updateTokenTargets([]);
            let options = { modifier }
            switch (category) {
                case "attribute":
                    break
                default:
                    let skill = actor.items.find(i => i.name == name && i.type == category);
                    actor.setupSkill(skill.data, options, tokenId).then(async(setupData) => {
                        let result = await actor.basicTest(setupData)
                        let message = await game.messages.get(messageId)
                        const data = {
                            msg: message.data.flags.msg,
                            results: message.data.flags.results.concat({ actor: actor.name, qs: (result.result.qualityStep || 0) })
                        }
                        DiceDSA5._rerenderGC(message, data)
                    });
            }
        }
    }

    static async _rerenderGC(message, data) {
        if (game.user.isGM) {
            data.qs = data.results.reduce((a, b) => { return a + b.qs }, 0)
            const content = await renderTemplate("systems/dsa5/templates/chat/roll/groupcheck.html", data)
            message.update({
                content,
                flags: data
            }).then(newMsg => {
                ui.chat.updateMessage(newMsg);
                return newMsg;
            });
        } else {
            game.socket.emit("system.dsa5", {
                type: "updateGroupCheck",
                payload: {
                    messageId: message.id,
                    data
                }
            })
        }
    }

    static _parseEffectDuration(source, testData, preData, attacker) {
        const specAbIds = preData.situationalModifiers.filter(x => x.specAbId).map(x => x.specAbId)
        const specAbs = attacker ? attacker.items.filter(x => specAbIds.includes(x.id)) : []
        let effects = duplicate(source.effects)
        for (const spec of specAbs) {
            effects.push(...duplicate(spec).effects)
        }

        let duration = getProperty(source, "data.duration.value") || ""
        duration = duration.replace(' x ', ' * ').replace(game.i18n.localize('CHARAbbrev.QS'), testData.qualityStep)
        try {
            const regexes = [
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.combatRounds"), 'gi'), seconds: 5 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.minutes"), 'gi'), seconds: 60 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.hours"), 'gi'), seconds: 3600 },
                { regEx: new RegExp(game.i18n.localize("DSAREGEX.days"), 'gi'), seconds: 3600 * 24 }
            ]

            for (const reg of regexes) {
                if (reg.regEx.test(duration)) {
                    let time = this._stringToRoll(duration.replace(reg.regEx, "").trim())
                    if (!isNaN(time)) {
                        for (let ef of effects) {
                            let calcTime = time * reg.seconds
                            const customDuration = getProperty(ef, "flags.dsa5.customDuration")
                            if (customDuration) {
                                let qsDuration = customDuration.split(",")[testData.qualityStep - 1]
                                if (qsDuration && qsDuration != "-") calcTime = qsDuration
                            }

                            ef.duration.seconds = calcTime
                            ef.duration.rounds = ef.duration.seconds / 5
                        }
                    }
                    break
                }
            }
        } catch {
            console.error(`Could not parse duration '${duration}' of '${source.name}'`)
        }
        return effects
    }

    static async _applyEffect(id, mode, targets) {
        const message = game.messages.get(id)
        const source = message.data.flags.data.preData.source
        const testData = message.data.flags.data.postData
        const speaker = message.data.speaker

        if (["poison", "disease"].includes(source.type)) {
            testData.qualityStep = testData.successLevel > 0 ? 2 : 1
        }

        let attacker = DSA5_Utility.getSpeaker(speaker)
        if (!attacker) attacker = game.actors.get(getProperty(message.data.flags, "data.preData.extra.actor.id"))
        const effects = this._parseEffectDuration(source, testData, message.data.flags.data.preData, attacker)
        let actors = []
        if (mode == "self") {
            if (attacker) actors.push(attacker)
        } else {
            if (targets) actors = targets.map(x => DSA5_Utility.getSpeaker(x))
            else if (game.user.targets.size) {
                game.user.targets.forEach(target => { actors.push(target.actor) });
            }
        }
        if (game.user.isGM) {
            for (let actor of actors) {
                const effectsWithChanges = effects.filter(x => x.changes && x.changes.length > 0)
                await actor.createEmbeddedDocuments("ActiveEffect", effectsWithChanges.map(x => {
                    x.origin = actor.uuid
                    return x
                }))
                const msg = await DSAActiveEffectConfig.applyAdvancedFunction(actor, effects, source, testData)
                const infoMsg = `${game.i18n.format('ActiveEffects.appliedEffect', { target: actor.name, source: source.name })}${msg || ""}`
                ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
            }
        } else {
            game.socket.emit("system.dsa5", {
                type: "addEffect",
                payload: {
                    mode,
                    id,
                    actors: actors.map(x => { return { token: x.token ? x.token.data._id : undefined, actor: x.data._id } })
                }
            })
        }
    }

    static async _removeGCEntry(ev) {
        const elem = $(ev.currentTarget)
        const index = Number(elem.attr('data-index'))
        const message = game.messages.get(elem.parents('.message').attr("data-message-id"))
        const data = message.data.flags
        data.results.splice(index, 1)
        DiceDSA5._rerenderGC(message, data)
    }

    static async _editGC(ev) {
        const elem = $(ev.currentTarget)
        const index = Number(elem.attr('data-index'))
        const message = game.messages.get(elem.parents('.message').attr("data-message-id"))
        const data = message.data.flags
        data.results[index].qs = Number(elem.val())
        DiceDSA5._rerenderGC(message, data)
    }

    static async _itemRoll(ev) {
        let input = $(ev.currentTarget),
            messageId = input.parents('.message').attr("data-message-id"),
            message = game.messages.get(messageId),
            speaker = message.data.speaker,
            category = input.attr("data-type"),
            name = input.attr("data-name")

        let actor = DSA5_Utility.getSpeaker(speaker)
            //if (!actor && message.data.flags.data)
            //    actor = new Actordsa5(message.data.flags.data.preData.extra.actor, { temporary: true })

        if (actor) {
            let item = actor.data.items.find(x => x.name == name && x.type == category)
            if (item) {
                item = new Itemdsa5(item, { temporary: true })
                item.setupEffect().then(setupData => { item.itemTest(setupData) });
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
        newTestData.extra.actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker).toObject(false)
        let index

        //Might need to readd that again
        //game.user.updateTokenTargets([]);

        switch (input.attr("data-edit-type")) {
            case "roll":
                index = input.attr("data-edit-id")
                let newValue = Number(input.val())
                let oldDamageRoll = data.postData.damageRoll ? duplicate(data.postData.damageRoll) : undefined
                if (newTestData.roll.terms.length > index * 2) {
                    DSA5_Utility.editRollAtIndex(newTestData.roll, index, newValue)
                } else {
                    index = index - newTestData.roll.terms.filter(x => x.results).length
                    oldDamageRoll.total = oldDamageRoll.total - DSA5_Utility.editRollAtIndex(oldDamageRoll, index, newValue) + newValue
                }
                newTestData.damageRoll = oldDamageRoll
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

        if (["gmroll", "blindroll"].includes(chatOptions.rollMode)) chatOptions["whisper"] = game.users.filter(user => user.isGM).map(x => x.data._id)
        if (chatOptions.rollMode === "blindroll") chatOptions["blind"] = true;

        if (["poison", "disease"].includes(newTestData.source.type)) {
            new Itemdsa5(newTestData.source, { temporary: true })[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions: chatOptions }, { rerenderMessage: message });
        } else {
            let speaker = DSA5_Utility.getSpeaker(message.data.speaker)
                //if (!speaker) speaker = new Actordsa5(newTestData.extra.actor, { temporary: true })
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

        html.on('click', '.defense-botch', ev => { CombatTables.showBotchCard("Defense", ev.currentTarget.dataset.weaponless) })
        html.on('click', '.melee-botch', ev => { CombatTables.showBotchCard("Melee", ev.currentTarget.dataset.weaponless) })
        html.on('click', '.range-botch', ev => { CombatTables.showBotchCard("Range", ev.currentTarget.dataset.weaponless) })
        html.on('click', '.liturgy-botch', () => { Miscast.showBotchCard("Liturgy") })
        html.on('click', '.spell-botch', () => { Miscast.showBotchCard("Spell") })
        html.on('click', '.roll-item', ev => { DiceDSA5._itemRoll(ev) })
        html.on('change', '.roll-edit', ev => { DiceDSA5._rollEdit(ev) })
        html.on('change', '.editGC', ev => { DiceDSA5._editGC(ev) })
        html.on('click', '.applyEffect', ev => {
            const elem = $(ev.currentTarget)
            const id = elem.parents('.message').attr("data-message-id")
            const mode = elem.attr("data-target")

            DiceDSA5._applyEffect(id, mode)
        })
        html.on('click', '.request-roll', ev => {
            const elem = ev.currentTarget.dataset
            DiceDSA5._requestRoll(elem.type, elem.name, Number(elem.modifier) || 0)
        })
        html.on('click', '.request-gc', ev => {
            const elem = ev.currentTarget.dataset
            DiceDSA5._requestGC(elem.type, elem.name, $(ev.currentTarget).parents('.message').attr("data-message-id"), Number(elem.modifier) || 0)
        })
        html.on('click', '.removeGC', ev => { DiceDSA5._removeGCEntry(ev) })

        html.on("click", ".message-delete", ev => {
            let message = game.messages.get($(ev.currentTarget).parents(".message").attr("data-message-id"))
            let targeted = message.data.flags.unopposeData

            if (!targeted) return;

            let target = canvas.tokens.get(message.data.flags.unopposeData.targetSpeaker.token)
            OpposedDsa5.clearOpposed(target.actor)
        })
    }

}