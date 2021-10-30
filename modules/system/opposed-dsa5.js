import DSA5_Utility from "./utility-dsa5.js";
import DiceDSA5 from "./dice-dsa5.js";
import { ReactToAttackDialog, ReactToSkillDialog } from "../dialog/dialog-react.js"
import Actordsa5 from "../actor/actor-dsa5.js";

export default class OpposedDsa5 {
    static async handleOpposedTarget(message) {
        if (!message) return;

        let actor = DSA5_Utility.getSpeaker(message.data.speaker)
        if (!actor) return

        let testResult = message.data.flags.data.postData
        let preData = message.data.flags.data.preData

        if (actor.data.flags.oppose) {
            console.log("answering opposed")
            OpposedDsa5.answerOpposedTest(actor, message, testResult, preData)
        } else if (game.user.targets.size && message.data.flags.data.isOpposedTest && !message.data.flags.data.defenderMessage && !message.data.flags.data.attackerMessage) {
            console.log("start opposed")
            OpposedDsa5.createOpposedTest(actor, message, testResult, preData)
        } else if (message.data.flags.data.defenderMessage || message.data.flags.data.attackerMessage) {
            console.log("end opposed")
            OpposedDsa5.resolveFinalMessage(message)
        } else if (message.data.flags.data.unopposedStartMessage) {
            console.log("repeat")
            OpposedDsa5.redoUndefended(message)
        } else if (message.data.flags.data.startMessagesList) {
            console.log("change start")
            OpposedDsa5.changeStartMessage(message)
        } else {
            console.log("show dmg")
            this.showDamage(message)
        }
    }

    static async redoUndefended(message) {
        let startMessage = game.messages.get(message.data.flags.data.unopposedStartMessage);
        startMessage.data.flags.unopposeData.attackMessageId = message.data._id;
        this.resolveUndefended(startMessage);
    }

    static async answerOpposedTest(actor, message, testResult, preData) {
        let attackMessage = game.messages.get(actor.data.flags.oppose.messageId)
        if (!attackMessage) {
            ui.notifications.error(game.i18n.localize("DSAError.staleData"))
            await OpposedDsa5.clearOpposed(actor)
            return OpposedDsa5.createOpposedTest(actor, message, testResult, preData)
        }
        let attacker = {
            speaker: actor.data.flags.oppose.speaker,
            testResult: attackMessage.data.flags.data.postData,
            messageId: attackMessage.data._id,
            img: DSA5_Utility.getSpeaker(actor.data.flags.oppose.speaker).data.img
        };

        let defender = {
            speaker: message.data.speaker,
            testResult,
            messageId: message.data._id,
            img: actor.data.msg
        };

        let listOfDefenders = attackMessage.data.flags.data.defenderMessage ? Array.from(attackMessage.data.flags.data.defenderMessage) : [];
        listOfDefenders.push(message.data._id);

        if (game.user.isGM) {
            await attackMessage.update({ "flags.data.defenderMessage": listOfDefenders });
        }

        await message.update({ "flags.data.attackerMessage": attackMessage.data._id });

        await this.completeOpposedProcess(attacker, defender, {
            target: true,
            startMessageId: actor.data.flags.oppose.startMessageId,
            whisper: message.data.whisper,
            blind: message.data.blind,
        })
        await OpposedDsa5.clearOpposed(actor)
    }

    static videoOrImgTag(path) {
        if (/\.webm$/.test(path)) {
            return `<video loop autoplay src="${path}" width="50" height="50"></video>`
        }
        return `<img src="${path}" width="50" height="50"/>`
    }

    static async createOpposedTest(actor, message, testResult, preData) {
        let attacker;

        if (message.data.speaker.token)
            attacker = canvas.tokens.get(message.data.speaker.token).data
        else
            attacker = actor.data.token

        if (testResult.successLevel > 0) {
            let attackOfOpportunity = message.data.flags.data.preData.attackOfOpportunity
            let unopposedButton = attackOfOpportunity ? "" : `<div><button class="unopposed-button small-button chat-button-target" data-target="true">${game.i18n.localize('Unopposed')}</button></div>`
            let startMessagesList = [];

            game.user.targets.forEach(async target => {
                const content = `${OpposedDsa5.opposeMessage(attacker, target, false)} ${unopposedButton}`
                let startMessage = await ChatMessage.create({
                    user: game.user.id,
                    content,
                    speaker: message.data.speaker,
                    ["flags.unopposeData"]: {
                        attackMessageId: message.data._id,
                        targetSpeaker: {
                            scene: target.scene.data._id,
                            token: target.data._id,
                            alias: target.data.name
                        }
                    }
                })

                if (!game.user.isGM) {
                    game.socket.emit("system.dsa5", {
                        type: "target",
                        payload: {
                            target: target.data._id,
                            scene: canvas.scene.id,
                            opposeFlag: {
                                speaker: message.data.speaker,
                                messageId: message.data._id,
                                startMessageId: startMessage.data._id
                            }
                        }
                    })
                } else {
                    await target.actor.update({
                        "flags.oppose": {
                            speaker: message.data.speaker,
                            messageId: message.data._id,
                            startMessageId: startMessage.data._id
                        }
                    })
                }
                startMessagesList.push(startMessage.data._id);
                if (attackOfOpportunity) {
                    await OpposedDsa5.resolveUndefended(startMessage, game.i18n.localize("OPPOSED.attackOfOpportunity"))
                }
            })
            message.data.flags.data.startMessagesList = startMessagesList;
        } else {
            game.user.targets.forEach(async target => {
                await ChatMessage.create({
                    user: game.user.id,
                    content: OpposedDsa5.opposeMessage(attacker, target, true),
                    speaker: message.data.speaker
                })
            })
        }
    }

    static opposeMessage(attacker, target, fail) {
        return `<div class ="opposed-message">
            <b>${attacker.name}</b> ${game.i18n.localize("ROLL.Targeting")} <b>${target.data.name}</b> ${fail ? game.i18n.localize("ROLL.failed"): ""}
            </div>
            <div class = "opposed-tokens row-section">
                <div class="col two attacker">${OpposedDsa5.videoOrImgTag(attacker.img)}</div>
                <div class="col two defender">${OpposedDsa5.videoOrImgTag(target.data.img)}</div>
            </div>
             `
    }

    static async changeStartMessage(message) {
        for (let startMessageId of message.data.flags.data.startMessagesList) {
            let startMessage = game.messages.get(startMessageId);
            let data = startMessage.data.flags.unopposeData;

            game.socket.emit("system.dsa5", {
                type: "target",
                payload: {
                    target: data.targetSpeaker.token,
                    scene: canvas.scene.id,
                    opposeFlag: {
                        speaker: message.data.speaker,
                        messageId: message.data._id,
                        startMessageId: startMessage.data._id
                    }
                }
            })
            await startMessage.update({ "flags.unopposeData.attackMessageId": message.data._id });
        }
    }

    static resolveFinalMessage(message) {
        let attacker, defender;
        if (message.data.flags.data.defenderMessage) {
            for (let msg of message.data.flags.data.defenderMessage) {
                attacker = OpposedDsa5.getMessageDude(message)
                let defenderMessage = game.messages.get(msg);
                defender = OpposedDsa5.getMessageDude(defenderMessage)
                this.completeOpposedProcess(attacker, defender, { blind: message.data.blind, whisper: message.data.whisper });
            }
        } else {
            defender = OpposedDsa5.getMessageDude(message)
            let attackerMessage = game.messages.get(message.data.flags.data.attackerMessage);
            attacker = OpposedDsa5.getMessageDude(attackerMessage)
            this.completeOpposedProcess(attacker, defender, { blind: message.data.blind, whisper: message.data.whisper });
        }
    }

    static getMessageDude(message) {
        return {
            speaker: message.data.speaker,
            testResult: message.data.flags.data.postData,
            img: DSA5_Utility.getSpeaker(message.data.speaker).data.img,
            messageId: message.data._id
        }
    }

    static async showDamage(message, hide = false) {
        if (game.user.isGM) {
            if ((!hide || !message.data.flags.data.hideDamage) && message.data.flags.data.postData.damageRoll) {
                await message.update({
                    "content": message.data.content.replace(`data-hide-damage="${!hide}"`, `data-hide-damage="${hide}"`),
                    "flags.data.hideDamage": hide
                });
                if (!hide) DiceDSA5._addRollDiceSoNice(message.data.flags.data.preData, Roll.fromData(message.data.flags.data.postData.damageRoll), game.dsa5.apps.DiceSoNiceCustomization.getAttributeConfiguration("damage"))
            }
        } else {
            game.socket.emit("system.dsa5", {
                type: "showDamage",
                payload: {
                    id: message.id,
                    hide: hide
                }
            })
        }
    }

    static async clearOpposed(actor) {
        await actor.update({
            [`flags.-=oppose`]: null
        })
    }

    static async _handleReaction(ev) {
        let messageId = $(ev.currentTarget).parents('.message').attr("data-message-id");
        let message = game.messages.get(messageId)
        let attackMessage = game.messages.get(message.data.flags.unopposeData.attackMessageId)
        let source = attackMessage.data.flags.data.preData.source
        switch (source.type) {
            case "skill":
                ReactToSkillDialog.showDialog(message)
                break
            default:
                ReactToAttackDialog.showDialog(message)
        }
    }

    static async chatListeners(html) {
        html.on("click", '.unopposed-button', event => {
            event.preventDefault()
            this._handleReaction(event)
        })
    }

    static async hideReactionButton(startMessageId) {
        if (startMessageId) {
            if (game.user.isGM) {
                let startMessage = game.messages.get(startMessageId)
                let query = $(startMessage.data.content)
                query.find('button.unopposed-button').remove()
                query = $('<div></div>').append(query)

                await startMessage.update({ content: query.html() })
            } else {
                game.socket.emit("system.dsa5", {
                    type: "hideQueryButton",
                    payload: {
                        id: startMessageId,
                    }
                })
            }
        }
    }

    static async completeOpposedProcess(attacker, defender, options) {
        let opposedResult = await this.evaluateOpposedTest(attacker.testResult, defender.testResult, options);
        this.formatOpposedResult(opposedResult, attacker.speaker, defender.speaker);
        this.rerenderMessagesWithModifiers(opposedResult, attacker, defender);
        await Hooks.call("finishOpposedTest", attacker, defender, opposedResult, options)
        await this.renderOpposedResult(opposedResult, options)
        await this.hideReactionButton(options.startMessageId)

        return opposedResult
    }

    static async evaluateOpposedTest(attackerTest, defenderTest, options = {}) {
        let opposeResult = {};

        //opposeResult.attackerTestResult = attackerTest;
        //opposeResult.defenderTestResult = defenderTest;

        opposeResult.other = [];
        if (options.additionalInfo) opposeResult.other.push(options.additionalInfo)

        console.log(attackerTest)

        opposeResult.winner = "attacker"

        if (["weapon", "spell", "liturgy", "ceremony", "ritual"].includes(attackerTest.rollType) && defenderTest.successLevel == undefined) {
            defenderTest.successLevel = -5
        }

        if (defenderTest.successLevel != undefined) {
            switch (attackerTest.rollType) {
                case "talent":
                    this._evaluateTalentOpposedRoll(attackerTest, defenderTest, opposeResult, options)
                    break;
                case "ceremony":
                case "ritual":
                case "spell":
                case "liturgy":
                case "weapon":
                    this._evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options)
                    break
                default:
                    ui.notifications.error("Can not oppose " + attackerTest.rollType)
                    console.warn("Can not oppose " + attackerTest.rollType)
            }
        }
        return opposeResult
    }

    static _evaluateWeaponOpposedRoll(attackerTest, defenderTest, opposeResult, options = {}) {
        if (attackerTest.successLevel > 0 && defenderTest.successLevel < 0) {
            let damage = this._calculateOpposedDamage(attackerTest, defenderTest, options)
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

    static _calculateOpposedDamage(attackerTest, defenderTest, options = {}) {
        const actor = DSA5_Utility.getSpeaker(defenderTest.speaker).data
        const armor = Actordsa5.armorValue(actor, options)
        return {
            damage: attackerTest.damage,
            armor,
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
        let attackerMessage = game.messages.get(attacker.messageId)
        this.showDamage(attackerMessage, opposeResult.winner != "attacker")
    }

    static async renderOpposedResult(formattedOpposeResult, options = {}) {
        formattedOpposeResult.hideData = await game.settings.get("dsa5", "hideOpposedDamage");
        let html = await renderTemplate("systems/dsa5/templates/chat/roll/opposed-result.html", formattedOpposeResult)
        let chatOptions = {
            user: game.user.id,
            content: html,
            "flags.opposeData": formattedOpposeResult,
            "flags.hideData": formattedOpposeResult.hideData,
            whisper: options.whisper,
            blind: options.blind
        }
        if (options.target) {
            chatOptions["flags.startMessageId"] = options.startMessageId
            await ChatMessage.create(chatOptions)
        } else {
            try {
                await this.startMessage.update(chatOptions).then(resultMsg => {
                    ui.chat.updateMessage(resultMsg)
                        //OpposedDsa5.clearOpposed();
                })
            } catch {
                await ChatMessage.create(chatOptions)
                    //OpposedDsa5.clearOpposed();
            }
        }
    }

    static async resolveUndefended(startMessage, additionalInfo = "") {
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
                speaker: {
                    token: unopposeData.targetSpeaker.token
                }
            }
        }

        await this.clearOpposed(target.actor)

        await this.completeOpposedProcess(attacker, defender, {
            target: true,
            startMessageId: startMessage.data._id,
            additionalInfo: additionalInfo
        });
        if (game.user.isGM) {
            await attackMessage.update({ "flags.data.unopposedStartMessage": startMessage.data._id });
        } else {
            await game.socket.emit("system.dsa5", {
                type: "updateAttackMessage",
                payload: {
                    messageId: attackMessage.id,
                    startMessageId: startMessage.data._id
                }
            })
        }

    }

}