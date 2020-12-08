import DSA5_Utility from "./utility-dsa5.js";
import DiceDSA5 from "./dice-dsa5.js";

export default class OpposedDsa5 {
    static async handleOpposedTarget(message) {

        if (!message) return;


        let actor = DSA5_Utility.getSpeaker(message.data.speaker)
        if (!actor) return

        let testResult = message.data.flags.data.postData
        if (actor.data.flags.oppose) {
            let attackMessage = game.messages.get(actor.data.flags.oppose.messageId) // Retrieve attacker's test result message
                // Organize attacker/defender data
            let attacker = {
                speaker: actor.data.flags.oppose.speaker,
                testResult: attackMessage.data.flags.data.postData,
                messageId: attackMessage.data._id,
                img: DSA5_Utility.getSpeaker(actor.data.flags.oppose.speaker).data.img
            };

            let defender = {
                speaker: message.data.speaker,
                testResult: testResult,
                messageId: message.data._id,
                img: actor.data.msg
            };
            //Edit the attacker message to give it a ref to the defender message (used for rerolling)
            //Have to do it locally if player for permission issues
            let listOfDefenders = attackMessage.data.flags.data.defenderMessage ? Array.from(attackMessage.data.flags.data.defenderMessage) : [];
            listOfDefenders.push(message.data._id);

            if (game.user.isGM) {
                attackMessage.update({
                    "flags.data.defenderMessage": listOfDefenders
                });
            }
            //Edit the defender message to give it a ref to the attacker message (used for rerolling)
            message.update({
                "flags.data.attackerMessage": attackMessage.data._id
            });
            // evaluateOpposedTest is usually for manual opposed tests, it requires extra options for targeted opposed test
            await this.completeOpposedProcess(attacker, defender, {
                target: true,
                startMessageId: actor.data.flags.oppose.startMessageId,
                whisper: message.data.whisper,
                blind: message.data.blind,
            })
            await actor.update({
                    "-=flags.oppose": null
                }) // After opposing, remove oppose

        } else if (game.user.targets.size && !message.data.flags.data.defenderMessage && !message.data.flags.data.attackerMessage) {
            let attacker;
            // If token data was found in the message speaker (see setupCardOptions)
            if (message.data.speaker.token)
                attacker = canvas.tokens.get(message.data.speaker.token).data

            else // If no token data was found in the speaker, use the actor's token data instead
                attacker = actor.data.token


            if (testResult.successLevel > 0) {

                let startMessagesList = [];
                game.user.targets.forEach(async target => {
                        let content =
                            `<div class ="opposed-message">
                      <b>${attacker.name}</b> ${game.i18n.localize("ROLL.Targeting")} <b>${target.data.name}</b>
                    </div>
                    <div class = "opposed-tokens row-section">
                        <div class="col two attacker"><img src="${attacker.img}" width="50" height="50"/></div>
                        <div class="col two defender"><img src="${target.data.img}" width="50" height="50"/></div>
                    </div>
                    <div class="unopposed-button" data-target="true" title="${game.i18n.localize("Unopposed")}"><a><i class="fas fa-arrow-down"></i></a></div>`

                        // Create the Opposed starting message

                        let startMessage = await ChatMessage.create({
                            user: game.user._id,
                            content: content,
                            speaker: message.data.speaker,
                            ["flags.unopposeData"]: // Optional data to resolve unopposed tests - used for damage values
                            {
                                attackMessageId: message.data._id,
                                targetSpeaker: {
                                    scene: target.scene.data._id,
                                    token: target.data._id,
                                    scene: target.actor.data._id,
                                    alias: target.data.name
                                }
                            }
                        })

                        if (!game.user.isGM) {
                            game.socket.emit("system.dsa5", {
                                type: "target",
                                payload: {
                                    target: target.data._id,
                                    scene: canvas.scene._id,
                                    opposeFlag: {
                                        speaker: message.data.speaker,
                                        messageId: message.data._id,
                                        startMessageId: startMessage.data._id
                                    }
                                }
                            })
                        } else {
                            // Add oppose data flag to the target
                            target.actor.update({
                                "flags.oppose": {
                                    speaker: message.data.speaker,
                                    messageId: message.data._id,
                                    startMessageId: startMessage.data._id
                                }
                            })
                        }
                        startMessagesList.push(startMessage.data._id);
                        // Remove current targets
                    })
                    //Give the roll a list of every startMessages linked to this roll
                message.data.flags.data.startMessagesList = startMessagesList;
                game.user.updateTokenTargets([]);
            } else {
                //Roll failed not test required
                game.user.targets.forEach(async target => {
                    let content =
                        `<div class ="opposed-message">
                      <b>${attacker.name}</b> ${game.i18n.localize("ROLL.Targeting")} <b>${target.data.name}</b> ${game.i18n.localize("ROLL.failed")}
                    </div>
                    <div class = "opposed-tokens row-section">
                        <div class="col two attacker"><img src="${attacker.img}" width="50" height="50"/></div>
                        <div class="col two defender"><img src="${target.data.img}" width="50" height="50"/></div>
                    </div>
                    `
                    await ChatMessage.create({
                        user: game.user._id,
                        content: content,
                        speaker: message.data.speaker,
                    })
                })
            }
        }
        //It's an opposed reroll of an ended test
        else if (message.data.flags.data.defenderMessage || message.data.flags.data.attackerMessage) {
            console.log("woops")
        } else if (message.data.flags.data.unopposedStartMessage) {
            console.log("woops")
        }
        //It's a reroll of an ongoing opposed test
        else if (message.data.flags.data.startMessagesList) {
            console.log("woops")
        }

    }

    static async chatListeners(html) {
        html.on("click", '.unopposed-button', event => {
            event.preventDefault()
            let messageId = $(event.currentTarget).parents('.message').attr("data-message-id");
            $(event.currentTarget).fadeOut()
            this.resolveUnopposed(game.messages.get(messageId));
        })
    }

    static async completeOpposedProcess(attacker, defender, options) {
        let opposedResult = await this.evaluateOpposedTest(attacker.testResult, defender.testResult);
        this.formatOpposedResult(opposedResult, attacker.speaker, defender.speaker);
        this.rerenderMessagesWithModifiers(opposedResult, attacker, defender);
        this.renderOpposedResult(opposedResult, options)
        return opposedResult
    }

    static async evaluateOpposedTest(attackerTest, defenderTest, options = {}) {

        Hooks.call("dsa5:preOpposedTestResult", attackerTest, defenderTest)
            //   try {
        let opposeResult = {};

        opposeResult.attackerTestResult = attackerTest;
        opposeResult.defenderTestResult = defenderTest;

        opposeResult.other = [];
        opposeResult.modifiers = this.checkPostModifiers(attackerTest, defenderTest);

        Hooks.call("dsa5:opposedTestResult", opposeResult, attackerTest, defenderTest)
        opposeResult.winner = "attacker"


        if (defenderTest.successLevel != undefined) {
            switch (attackerTest.rollType) {
                case "talent":
                    this._evaluateTalentOpposedRoll(attackerTest, defenderTest, opposeResult, options)
                    break;
                case "weapon":
                    this._evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options)
                    break;
                default:
                    console.warn("can not oppose " + attackerTest.rollType)
            }
        }
        return opposeResult

        //        } catch (err) {
        //           ui.notifications.error(`${game.i18n.localize("Error.Opposed")}: ` + err)
        //          console.error("Could not complete opposed test: " + err)
        //         this.clearOpposed()
        //}
    }
    static _evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options = {}) {
        if (attackerTest.successLevel > 0 && attackerTest.successLevel > defenderTest.successLevel) {
            let damage = this._calculateOpposedDamage(attackerTest, defenderTest)
            opposeResult.winner = "attacker"
            opposeResult.damage = {
                description: `<b>${game.i18n.localize("damage")}</b>: ${damage.damage} - ${damage.armor} (${game.i18n.localize("protection")}) = ${damage.sum}`,
                value: damage.sum
            }
        } else {
            opposeResult.winner = "defender"
        }
    }

    static _calculateOpposedDamage(attackerTest, defenderTest) {
        let wornArmor = defenderTest.actor.items.filter(x => x.type == "armor" && x.data.worn.value == true)
        let armor = wornArmor.reduce((a, b) => a + b.data.protection.value, 0)
        return {
            damage: attackerTest.damage,
            armor: armor,
            sum: attackerTest.damage - armor
        }
    }

    static _evaluateTalentOpposedRoll(attackerTest, defenderTest, opposeResult, options = {}) {
        if (attackerTest.successLevel > 0 && attackerTest.successLevel > defenderTest.successLevel) {
            opposeResult.winner = "attacker"
        } else if (attackerTest.qualityStep > defenderTest.qualityStep || (attackerTest.result >= 0 && defenderTest.result < 0)) {
            opposeResult.winner = "attacker"
            opposeResult.differenceSL = attackerTest.qualityStep - defenderTest.qualityStep
        } else {
            opposeResult.winner = "defender"
            opposeResult.differenceSL = defenderTest.qualityStep - attackerTest.qualityStep
        }
    }

    static checkPostModifiers(attackerTestResult, defenderTestResult) {
        let didModifyAttacker = false,
            didModifyDefender = false;

        let modifiers = {
            attacker: {
                target: 0,
            },
            defender: {
                target: 0,
            },
            message: []
        }
        return mergeObject(modifiers, { didModifyAttacker, didModifyDefender });
    }

    static formatOpposedResult(opposeResult, attacker, defender) {
        let str = opposeResult.differenceSL ? "winsFP" : "wins"
        if (opposeResult.winner == "attacker") {
            opposeResult.result = game.i18n.format("OPPOSED." + str, { winner: attacker.alias, loser: defender.alias, SL: opposeResult.differenceSL })
            opposeResult.img = attacker.img;
        } else if (opposeResult.winner == "defender") {
            opposeResult.result = game.i18n.format("OPPOSED." + str, { winner: defender.alias, loser: attacker.alias, SL: opposeResult.differenceSL })
            opposeResult.img = defender.img
        }

        opposeResult.speakerAttack = attacker;
        opposeResult.speakerDefend = defender;

        if (opposeResult.swapped) {
            opposeResult.speakerAttack = defender;
            opposeResult.speakerDefend = attacker;
        }
        return opposeResult;
    }

    static rerenderMessagesWithModifiers(opposeResult, attacker, defender) {
        if (opposeResult.modifiers.didModifyAttacker || attacker.testResult.modifiers) {
            let attackerMessage = game.messages.get(attacker.messageId)
            opposeResult.modifiers.message.push(`${game.i18n.format(game.i18n.localize('CHAT.TestModifiers.FinalModifiers'), { target: opposeResult.modifiers.attacker.target, sl: opposeResult.modifiers.attacker.SL, name: attacker.alias })}`)
            let chatOptions = {
                template: attackerMessage.data.flags.data.template,
                rollMode: attackerMessage.data.flags.data.rollMode,
                title: attackerMessage.data.flags.data.title,
                isOpposedTest: attackerMessage.data.flags.data.isOpposedTest,
                attackerMessage: attackerMessage.data.flags.data.attackerMessage,
                defenderMessage: attackerMessage.data.flags.data.defenderMessage,
                unopposedStartMessage: attackerMessage.data.flags.data.unopposedStartMessage,
                startMessagesList: attackerMessage.data.flags.data.startMessagesList,
                hasBeenCalculated: true,
                calculatedMessage: opposeResult.modifiers.message,
            }

            attackerMessage.data.flags.data.preData.target = attackerMessage.data.flags.data.preData.target + opposeResult.modifiers.attacker.target;
            attackerMessage.data.flags.data.preData.roll = attackerMessage.data.flags.data.postData.roll
            attackerMessage.data.flags.data.hasBeenCalculated = true;
            attackerMessage.data.flags.data.calculatedMessage = opposeResult.modifiers.message;
            if (!opposeResult.swapped)
                DiceDSA5.renderRollCard(chatOptions, opposeResult.attackerTestResult, attackerMessage)
            else
                DiceDSA5.renderRollCard(chatOptions, opposeResult.defenderTestResult, attackerMessage)

        }
        if (opposeResult.modifiers.didModifyDefender || defender.testResult.modifiers) {
            opposeResult.modifiers.message.push(`${game.i18n.format(game.i18n.localize('CHAT.TestModifiers.FinalModifiers'), { target: opposeResult.modifiers.defender.target, sl: opposeResult.modifiers.defender.SL, name: defender.alias })}`)
            let defenderMessage = game.messages.get(defender.messageId)
            let chatOptions = {
                template: defenderMessage.data.flags.data.template,
                rollMode: defenderMessage.data.flags.data.rollMode,
                title: defenderMessage.data.flags.data.title,
                isOpposedTest: defenderMessage.data.flags.data.isOpposedTest,
                attackerMessage: defenderMessage.data.flags.data.attackerMessage,
                defenderMessage: defenderMessage.data.flags.data.defenderMessage,
                unopposedStartMessage: defenderMessage.data.flags.data.unopposedStartMessage,
                startMessagesList: defenderMessage.data.flags.data.startMessagesList,
                hasBeenCalculated: true,
                calculatedMessage: opposeResult.modifiers.message,
            }

            defenderMessage.data.flags.data.preData.target = defenderMessage.data.flags.data.preData.target + opposeResult.modifiers.defender.target;
            defenderMessage.data.flags.data.preData.slBonus = defenderMessage.data.flags.data.preData.slBonus + opposeResult.modifiers.defenderSL;
            defenderMessage.data.flags.data.preData.roll = defenderMessage.data.flags.data.postData.roll
            defenderMessage.data.flags.data.hasBeenCalculated = true;
            defenderMessage.data.flags.data.calculatedMessage = opposeResult.modifiers.message;
            if (!opposeResult.swapped)
                DiceDSA5.renderRollCard(chatOptions, opposeResult.defenderTestResult, defenderMessage)
            else
                DiceDSA5.renderRollCard(chatOptions, opposeResult.attackerTestResult, defenderMessage)
        }
    }

    static renderOpposedResult(formattedOpposeResult, options = {}) {
        if (options.target) {
            formattedOpposeResult.hideData = true;
            renderTemplate("systems/dsa5/templates/chat/roll/opposed-result.html", formattedOpposeResult).then(html => {
                let chatOptions = {
                    user: game.user._id,
                    content: html,
                    "flags.opposeData": formattedOpposeResult,
                    "flags.startMessageId": options.startMessageId,
                    whisper: options.whisper,
                    blind: options.blind,
                }
                ChatMessage.create(chatOptions)
            })
        } else // If manual - update start message and clear opposed data
        {
            formattedOpposeResult.hideData = true;
            renderTemplate("systems/dsa5/templates/chat/roll/opposed-result.html", formattedOpposeResult).then(html => {
                let chatOptions = {
                    user: game.user._id,
                    content: html,
                    blind: options.blind,
                    whisper: options.whisper,
                    "flags.opposeData": formattedOpposeResult
                }
                try {
                    this.startMessage.update(chatOptions).then(resultMsg => {
                        ui.chat.updateMessage(resultMsg)
                        this.clearOpposed();
                    })
                } catch {
                    ChatMessage.create(chatOptions)
                    this.clearOpposed();
                }
            })
        }
    }

    static async resolveUnopposed(startMessage) {
        let unopposeData = startMessage.data.flags.unopposeData;

        let attackMessage = game.messages.get(unopposeData.attackMessageId) // Retrieve attacker's test result message
            // Organize attacker data
        let attacker = {
                speaker: attackMessage.data.speaker,
                testResult: attackMessage.data.flags.data.postData,
                messageId: unopposeData.attackMessageId
            }
            // Organize dummy values for defender
        let target = canvas.tokens.get(unopposeData.targetSpeaker.token)
        let defender = {
                speaker: unopposeData.targetSpeaker,
                testResult: {
                    actor: target.actor.data,
                    unopposed: true
                }
            }
            // Remove opposed flag
        if (!startMessage.data.flags.reroll)
            await target.actor.update({ "-=flags.oppose": null })
            // Evaluate
        this.completeOpposedProcess(attacker, defender, {
            target: true,
            startMessageId: startMessage.data._id
        });
        attackMessage.update({
            "flags.data.isOpposedTest": false,
            "flags.data.unopposedStartMessage": startMessage.data._id
        });
    }

}