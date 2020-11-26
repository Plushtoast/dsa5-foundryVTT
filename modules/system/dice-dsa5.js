import Actordsa5 from "../actor/actor-dsa5.js";
import DSA5 from "./config-dsa5.js";


export default class DiceDSA5 {
    static async setupDialog({ dialogOptions, testData, cardOptions, }) {
        let rollMode = game.settings.get("core", "rollMode");

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
                mergeObject(dialogOptions.data, {
                    difficultyLabels: (DSA5.skillDifficultyLabels)
                });

                break;

            case "rangeweapon":
                mergeObject(dialogOptions.data, {
                    rangeOptions: DSA5.rangeWeaponModifiers,
                    sizeOptions: DSA5.rangeSizeCategories,
                    visionOptions: DSA5.rangeVision
                });
                break;
            case "meleeweapon":
                if (testData.mode == "attack") {
                    mergeObject(dialogOptions.data, {
                        weaponSizes: DSA5.meleeRanges
                    });
                } else {
                    mergeObject(dialogOptions.data, {
                        defenseCount: 0,
                        showDefense: true
                    });
                }

                break
            case "combatskill":
            case "liturgy":
            case "spell":
                break;
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
                new Dialog({
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

        let roll = testData.roll ? testData.roll : new Roll(weapon.data.damage.value).roll()
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

    static rollWeapon(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let modifier = testData.testModifier + this._situationalModifiers(testData);
        let weapon;

        console.log(testData)
        this._appendSituationalModifiers(testData, game.i18n.localize("manual"), testData.testModifier)

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.data.combatskill.value), testData.extra.actor)

        if (testData.source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(testData.source.data, [skill], testData.extra.actor)
                //+ this._compareWeaponReach(weapon, testData)
            if (testData.mode == "attack") {
                let weaponmodifier = this._compareWeaponReach(weapon, testData)
                modifier += weaponmodifier
                this._appendSituationalModifiers(testData, game.i18n.localize("opposingWeaponSize"), weaponmodifier)
            } else {
                modifier += testData.defenseCount * -3
                this._appendSituationalModifiers(testData, game.i18n.localize("defenseCount"), testData.defenseCount * -3)
            }

        } else {
            weapon = Actordsa5._prepareRangeWeapon(testData.source.data, [], [skill])

            modifier += DSA5.rangeMods[testData.rangeModifier].attack + testData.sizeModifier + testData.visionModifier
            this._appendSituationalModifiers(testData, game.i18n.localize("distance"), DSA5.rangeMods[testData.rangeModifier].attack)
            this._appendSituationalModifiers(testData, game.i18n.localize("sizeCategory"), testData.sizeModifier)
            this._appendSituationalModifiers(testData, game.i18n.localize("sight"), testData.visionModifier)
        }

        var result = this._rollSingleD20(roll, weapon[testData.mode], "attack" ? "mu" : "in", modifier, testData)

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
            let damageRoll = new Roll(weapon.data.damage.value).roll()
            this._addRollDiceSoNice(testData, damageRoll, "black")
            let damage = damageRoll._total;

            for (let k of damageRoll.terms) {
                if (k instanceof Die) {
                    for (let l of k.results) {
                        result.characteristics.push({ char: "damage", res: l.result, die: "d" + k.faces })
                    }
                }
            }

            if (weapon.extraDamage)
                damage = Number(weapon.extraDamage) + Number(damage)

            if (testData.source.type == "rangeweapon") {
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

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess") + ", " + game.i18n.localize("halfDefense");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 >= 0) {
                description += ", " + game.i18n.localize("doubleDamage")
                doubleDamage = true;

            }
            this._addRollDiceSoNice(testData, rollConfirm, testData.mode == "attack" ? "mu" : "in")
            chars.push({ char: testData.mode, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });

        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 < 0) {
                description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().result)
            }
            this._addRollDiceSoNice(testData, rollConfirm, testData.mode == "attack" ? "mu" : "in")
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
        res["rollType"] = "spell"
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
            qualityStep: fps > 0 ? Math.ceil(fps / 3) : 0,
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
                case "skill":
                    roll = new Roll("1d20+1d20+1d20").roll();
                    for (var i = 0; i < roll.dice.length; i++) {
                        roll.dice[i].options.colorset = testData.source.data["characteristic" + (i + 1)].value
                    }
                    break;
                case "meleeweapon":
                case "rangeweapon":
                case "combatskill":
                    if (testData.mode == "damage") {
                        roll = new Roll(testData.source.data.data.damage.value).roll()
                        for (var i = 0; i < roll.dice.length; i++) {
                            roll.dice[i].options.colorset = "black"
                        }

                    } else {
                        roll = new Roll("1d20[" + (testData.mode == "attack" ? "mu" : "in") + "]").roll()
                    }

                    break;
                case "status":
                    roll = new Roll("1d20[in]").roll();
                    break;
                default:
                    roll = new Roll("1d20").roll();
                    roll.dice[0].options.colorset = testData.source.label.split('.')[1].toLowerCase()
            }

            this.showDiceSoNice(roll, cardOptions.rollMode);
            testData.roll = roll;
            testData.rollMode = cardOptions.rollMode
                //testData.cardOptions = cardOptions
        }
        return testData;
    }


    static async showDiceSoNice(roll, rollMode) {
        if (game.modules.get("dice-so-nice") && game.modules.get("dice-so-nice").active) {
            let whisper = null;
            let blind = false;
            switch (rollMode) {
                case "blindroll": //GM only
                    blind = true;
                case "gmroll": //GM + rolling player
                    let gmList = game.users.filter(user => user.isGM);
                    let gmIDList = [];
                    gmList.forEach(gm => gmIDList.push(gm.data._id));
                    whisper = gmIDList;
                    break;
                case "roll": //everybody
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
            isOpposedTest: chatOptions.isOpposedTest,
            title: chatOptions.title,
            hideData: chatData.hideData,
        };

        if (!rerenderMessage) {
            // Generate HTML from the requested chat template
            return renderTemplate(chatOptions.template, chatData).then(html => {
                // Emit the HTML as a chat message


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

    static async chatListeners(html) {
        html.on("click", '.expand-mods', event => {
            event.preventDefault()
            let elem = $(event.currentTarget)
            elem.find('i').toggleClass("fa-minus fa-plus")
            elem.siblings('ul').fadeToggle()
        })
    }
}