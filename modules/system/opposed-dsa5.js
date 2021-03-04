import DSA5_Utility from "./utility-dsa5.js";
import DiceDSA5 from "./dice-dsa5.js";

export default class OpposedDsa5 {
    static async handleOpposedTarget(message) {

        if (!message) return;


        let actor = DSA5_Utility.getSpeaker(message.data.speaker)
        if (!actor) return

        let testResult = message.data.flags.data.postData
        if (actor.data.flags.oppose) {
            let attackMessage = game.messages.get(actor.data.flags.oppose.messageId)
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

            let listOfDefenders = attackMessage.data.flags.data.defenderMessage ? Array.from(attackMessage.data.flags.data.defenderMessage) : [];
            listOfDefenders.push(message.data._id);

            if (game.user.isGM) {
                attackMessage.update({
                    "flags.data.defenderMessage": listOfDefenders
                });
            }

            message.update({
                "flags.data.attackerMessage": attackMessage.data._id
            });

            await this.completeOpposedProcess(attacker, defender, {
                target: true,
                startMessageId: actor.data.flags.oppose.startMessageId,
                whisper: message.data.whisper,
                blind: message.data.blind,
            })
            await actor.update({
                "-=flags.oppose": null
            })
        } else if (game.user.targets.size && !message.data.flags.data.defenderMessage && !message.data.flags.data.attackerMessage) {
            let attacker;

            if (message.data.speaker.token)
                attacker = canvas.tokens.get(message.data.speaker.token).data
            else
                attacker = actor.data.token

            if (testResult.successLevel > 0) {
                let attackOfOpportunity = message.data.flags.data.preData.attackOfOpportunity
                let unopposedButton = attackOfOpportunity ? "" : `<div class="unopposed-button chat-button-gm" data-target="true" title="${game.i18n.localize("Unopposed")}"><a>${game.i18n.localize('Unopposed')} <i class="fas fa-times"></i></a></div>`
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
                    ${unopposedButton}`

                    let startMessage = await ChatMessage.create({
                        user: game.user._id,
                        content: content,
                        speaker: message.data.speaker,
                        ["flags.unopposeData"]: {
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
                        target.actor.update({
                            "flags.oppose": {
                                speaker: message.data.speaker,
                                messageId: message.data._id,
                                startMessageId: startMessage.data._id
                            }
                        })
                    }
                    startMessagesList.push(startMessage.data._id);
                    if (attackOfOpportunity) {
                        OpposedDsa5.resolveUnopposed(startMessage, game.i18n.localize("OPPOSED.attackOfOpportunity"))
                    }
                })
                message.data.flags.data.startMessagesList = startMessagesList;
                game.user.updateTokenTargets([]);
            } else {
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

            if (game.user.isGM) {
                let messageId = $(event.currentTarget).parents('.message').attr("data-message-id");
                let message = game.messages.get(messageId)
                $(event.currentTarget).fadeOut()
                this.resolveUnopposed(message);
            } else {
                ui.notifications.error(game.i18n.localize("DSAError.onlyGMAllowedToCancel"))
            }
        })
    }

    static async completeOpposedProcess(attacker, defender, options) {
        let opposedResult = await this.evaluateOpposedTest(attacker.testResult, defender.testResult, options);
        this.formatOpposedResult(opposedResult, attacker.speaker, defender.speaker);
        this.rerenderMessagesWithModifiers(opposedResult, attacker, defender);
        this.renderOpposedResult(opposedResult, options)
        return opposedResult
    }

    static async evaluateOpposedTest(attackerTest, defenderTest, options = {}) {
        let opposeResult = {};

        opposeResult.attackerTestResult = attackerTest;
        opposeResult.defenderTestResult = defenderTest;

        opposeResult.other = [];
        if (options.additionalInfo) {
            opposeResult.other.push(options.additionalInfo)
        }
        opposeResult.modifiers = this.checkPostModifiers(attackerTest, defenderTest);

        opposeResult.winner = "attacker"

        if (attackerTest.rollType == "weapon" && defenderTest.successLevel == undefined) {
            defenderTest.successLevel = -5
        }

        if (defenderTest.successLevel != undefined) {
            switch (attackerTest.rollType) {
                case "talent":
                    this._evaluateTalentOpposedRoll(attackerTest, defenderTest, opposeResult, options)
                    break;
                case "weapon":
                    this._evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options)
                    break;
                default:
                    ui.notifications.error("Can not oppose " + attackerTest.rollType)
                    console.warn("Can not oppose " + attackerTest.rollType)
            }
        }
        return opposeResult
    }
    static _evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options = {}) {
        if (attackerTest.successLevel > 0 && defenderTest.successLevel < 0) {
            let damage = this._calculateOpposedDamage(attackerTest, defenderTest)
            opposeResult.winner = "attacker"
            opposeResult.damage = {
                description: `<b>${game.i18n.localize("damage")}</b>: ${damage.damage} - ${damage.armor} (${game.i18n.localize("protection")}) = ${damage.sum}`,
                value: damage.sum,
                sp: damage.damage
            }
        } else {
            opposeResult.winner = "defender"
        }
    }

    static _calculateOpposedDamage(attackerTest, defenderTest) {
        let wornArmor = defenderTest.actor.items.filter(x => x.type == "armor" && x.data.worn.value == true)
        let animalArmor = defenderTest.actor.items.filter(x => x.type == "trait" && x.data.traitType.value == "armor")
        let armor = wornArmor.reduce((a, b) => a + Number(b.data.protection.value), 0) + animalArmor.reduce((a, b) => a + Number(b.data.at.value), 0)
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
        } else {
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

    static async resolveUnopposed(startMessage, additionalInfo = "") {

        let unopposeData = startMessage.data.flags.unopposeData;

        let attackMessage = game.messages.get(unopposeData.attackMessageId)
        let attacker = {
            speaker: attackMessage.data.speaker,
            testResult: attackMessage.data.flags.data.postData,
            messageId: unopposeData.attackMessageId
        }

        let target = canvas.tokens.get(unopposeData.targetSpeaker.token)
        let defender = {
            speaker: unopposeData.targetSpeaker,
            testResult: {
                actor: target.actor.data,
                unopposed: true
            }
        }
        if (!startMessage.data.flags.reroll)
            await target.actor.update({ "-=flags.oppose": null })

        this.completeOpposedProcess(attacker, defender, {
            target: true,
            startMessageId: startMessage.data._id,
            additionalInfo: additionalInfo
        });
        attackMessage.update({
            "flags.data.isOpposedTest": false,
            "flags.data.unopposedStartMessage": startMessage.data._id
        });
    }

}