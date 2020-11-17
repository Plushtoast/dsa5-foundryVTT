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

        switch (testData.source.type) {
            case "skill":
                mergeObject(dialogOptions.data, {
                    difficultyLabels: (DSA5.skillDifficultyLabels)
                });
                break;
            case "meleeweapon":
            case "rangeweapon":
            case "combatskill":
                break;
            default:
                mergeObject(dialogOptions.data, {
                    difficultyLabels: (DSA5.attributeDifficultyLabels)
                });
        }



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

    static rollAttribute(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let description = "";
        let modifier = testData.testModifier + testData.testDifficulty;
        let res = modifier + testData.source.value;

        var chars = []


        let res1 = res - roll.terms[0].results[0].result;

        chars.push({ char: testData.extra.characteristicId, res: roll.terms[0].results[0].result, suc: res1 > 0, tar: res });
        let rollConfirm = new Roll("1d20").roll();

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess");
            let res2 = res - rollConfirm.terms[0].results[0].result;

            chars.push({ char: testData.extra.characteristicId, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;

            chars.push({ char: testData.extra.characteristicId, res: rollConfirm.terms[0].results[0].result, suc: res2 < 0, tar: res });


        }

        if (description == "") {
            description = game.i18n.localize(res1 >= 0 ? "Success" : "Failure");
        }

        return {
            //result: res,
            characteristics: chars,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
    }

    static rollDamage(testData) {
        let description = "";
        let modifier = testData.testModifier;
        let weapon;
        var chars = []

        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.data.combatskill.value), testData.extra.actor)

        let res = modifier;
        if (testData.source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(testData.source.data, [skill], testData.extra.actor)
        } else {
            weapon = Actordsa5._prepareRangeWeapon(testData.source.data, [], [skill])

        }


        let roll = testData.roll ? testData.roll : new Roll(weapon.data.damage.value).roll()
        let damage = roll._total;

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
            damage: damage,
            characteristics: chars,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }

    }

    static rollWeapon(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let description = "";
        let modifier = testData.testModifier;
        let weapon;
        var chars = []


        let skill = Actordsa5._calculateCombatSkillValues(testData.extra.actor.items.find(x => x.type == "combatskill" && x.name == testData.source.data.data.combatskill.value), testData.extra.actor)

        let res = modifier;
        if (testData.source.type == "meleeweapon") {
            weapon = Actordsa5._prepareMeleeWeapon(testData.source.data, [skill], testData.extra.actor)
        } else {
            weapon = Actordsa5._prepareRangeWeapon(testData.source.data, [], [skill])

        }
        res += weapon[testData.mode]



        let res1 = res - roll.terms[0].results[0].result;

        chars.push({ char: testData.mode, res: roll.terms[0].results[0].result, suc: res1 > 0, tar: res });
        let rollConfirm = new Roll("1d20").roll();

        let success = res1 >= 0;
        let doubleDamage = false;

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess") + ", " + game.i18n.localize("halfDefense");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 >= 0) {
                description += ", " + game.i18n.localize("doubleDamage")
                doubleDamage = true;

            }
            chars.push({ char: testData.mode, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 < 0) {
                description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().result)
            }
            chars.push({ char: testData.mode, res: rollConfirm.terms[0].results[0].result, suc: res2 < 0, tar: res });

        }

        if (description == "") {
            description = game.i18n.localize(success ? "Success" : "Failure");
        }


        var result = {
            success: success,

            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
        if (testData.mode == "attack" && success) {
            let damageRoll = new Roll(weapon.data.damage.value).roll()

            let damage = damageRoll._total;

            for (let k of damageRoll.terms) {
                if (k instanceof Die) {
                    for (let l of k.results) {
                        chars.push({ char: "damage", res: l.result, die: "d" + k.faces })
                    }

                }
            }

            if (weapon.extraDamage)
                damage = Number(weapon.extraDamage) + Number(damage)

            if (doubleDamage)
                damage = damage * 2

            result["damage"] = damage
        }
        result["characteristics"] = chars
        return result
    }



    static rollCombatskill(testData) {
        let roll = testData.roll ? testData.roll : new Roll("1d20").roll();
        let description = "";
        let modifier = testData.testModifier;

        let source = Actordsa5._calculateCombatSkillValues(testData.source.data, testData.extra.actor)


        var res = modifier + source.data[testData.mode].value;

        var chars = []

        let res1 = res - roll.terms[0].results[0].result;

        chars.push({ char: testData.mode, res: roll.terms[0].results[0].result, suc: res1 > 0, tar: res });
        let rollConfirm = new Roll("1d20").roll();

        if (roll.terms[0].results.filter(x => x.result == 1).length == 1) {
            description = game.i18n.localize("CriticalSuccess") + ", " + game.i18n.localize("halfDefense");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 >= 0) {
                description += ", " + game.i18n.localize("doubleDamage")
                doubleDamage = true;

            }
            chars.push({ char: testData.mode, res: rollConfirm.terms[0].results[0].result, suc: res2 >= 0, tar: res });

        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 1) {
            description = game.i18n.localize("CriticalFailure");
            let res2 = res - rollConfirm.terms[0].results[0].result;
            if (res2 < 0) {
                description += ", " + game.i18n.localize("selfDamage") + (new Roll("1d6+2").roll().result)
            }
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
            characteristics: chars,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
    }

    static rollTalent(testData) {
        let roll = testData.roll ? testData.roll : new Roll("3d20").roll();
        let description = "";
        let modifier = testData.testModifier + testData.testDifficulty;
        let fps = testData.source.data.talentValue.value;
        let tar1 = testData.extra.actor.data.characteristics[testData.source.data.characteristic1.value].value + modifier;
        let res1 = roll.terms[0].results[0].result - tar1;
        if (res1 > 0) {
            fps = fps - res1;
        }
        let tar2 = testData.extra.actor.data.characteristics[testData.source.data.characteristic2.value].value + modifier;
        let res2 = roll.terms[0].results[1].result - tar2;
        if (res2 > 0) {
            fps = fps - res2;
        }
        let tar3 = testData.extra.actor.data.characteristics[testData.source.data.characteristic3.value].value + modifier
        let res3 = roll.terms[0].results[2].result - tar3;
        if (res3 > 0) {
            fps = fps - res3;
        }

        if (roll.terms[0].results.filter(x => x.result == 1).length == 3) {
            description = game.i18n.localize("AstoundingSuccess");
        } else if (roll.terms[0].results.filter(x => x.result == 1).length == 2) {
            description = game.i18n.localize("CriticalSuccess");
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 3) {
            description = game.i18n.localize("AstoundingFailure");
        } else if (roll.terms[0].results.filter(x => x.result == 20).length == 2) {
            description = game.i18n.localize("CriticalFailure");
        } else {
            description = game.i18n.localize(fps >= 0 ? "Success" : "Failure");
        }


        return {
            result: fps,
            characteristics: [
                { char: testData.source.data.characteristic1.value, res: roll.terms[0].results[0].result, suc: res1 <= 0, tar: tar1 },
                { char: testData.source.data.characteristic2.value, res: roll.terms[0].results[1].result, suc: res2 <= 0, tar: tar2 },
                { char: testData.source.data.characteristic3.value, res: roll.terms[0].results[2].result, suc: res3 <= 0, tar: tar3 }
            ],
            qualityStep: fps > 0 ? Math.ceil(fps / 3) : 0,
            description: description,
            preData: testData,
            modifiers: modifier,
            extra: {}
        }
    }

    static rollTest(testData) {
        testData.function = "rollTest"

        let rollResults;
        switch (testData.source.type) {
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
            default:
                rollResults = this.rollAttribute(testData)
        }


        mergeObject(rollResults, testData.extra)

        rollResults.other = [];

        return rollResults
    }

    static async rollDices(testData, cardOptions) {
        if (!testData.roll) {
            let roll;
            switch (testData.source.type) {
                case "skill":
                    roll = new Roll("3d20").roll();
                    break;
                case "meleeweapon":
                case "rangeweapon":
                case "combatskill":
                    if (testData.mode == "damage") {
                        console.log(testData.source)
                        roll = new Roll(testData.source.data.data.damage.value).roll()
                    } else {
                        roll = new Roll("1d20").roll()
                    }

                    break;
                default:
            }

            await this.showDiceSoNice(roll, cardOptions.rollMode);
            testData.roll = roll;
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
            title: chatOptions.title,
            hideData: chatData.hideData,
        };


        console.log(testData);
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
}