import DSA5_Utility from "./utility-dsa5.js";

export default class OpposedDsa5 {
    static async handleOpposedTarget(message) {

        if (!message) return;


        let actor = DSA5_Utility.getSpeaker(message.data.speaker)
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

    static async completeOpposedProcess(attacker, defender, options) {
        let opposedResult = await this.evaluateOpposedTest(attacker.testResult, defender.testResult);
        this.formatOpposedResult(opposedResult, attacker.speaker, defender.speaker);
        this.rerenderMessagesWithModifiers(opposedResult, attacker, defender);
        this.renderOpposedResult(opposedResult, options)
        return opposedResult
    }

    static async evaluateOpposedTest(attackerTest, defenderTest, options = {}) {}

    static formatOpposedResult(opposeResult, attacker, defender) {
        if (opposeResult.winner == "attacker") {
            opposeResult.result = game.i18n.format("OPPOSED.AttackerWins", { attacker: attacker.alias, defender: defender.alias, SL: opposeResult.differenceSL })
            opposeResult.img = attacker.img;
        } else if (opposeResult.winner == "defender") {
            opposeResult.result = game.i18n.format("OPPOSED.DefenderWins", { defender: defender.alias, attacker: attacker.alias, SL: opposeResult.differenceSL })
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

    static rerenderMessagesWithModifiers(opposeResult, attacker, defender) {}

    static renderOpposedResult(formattedOpposeResult, options = {}) {}

}