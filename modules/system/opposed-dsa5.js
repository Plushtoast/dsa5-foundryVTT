import DSA5_Utility from "./utility-dsa5.js";
import DiceDSA5 from "./dice-dsa5.js";
import { ReactToAttackDialog, ReactToSkillDialog } from "../dialog/dialog-react.js"
import Actordsa5 from "../actor/actor-dsa5.js";
import EquipmentDamage from "./equipment-damage.js";
import DSAActiveEffectConfig from "../status/active_effects.js";
import Itemdsa5 from "../item/item-dsa5.js";

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
            await this.showDamage(message)
            await this.showSpellWithoutTarget(message)
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
        attacker.testResult.source = attackMessage.data.flags.data.preData.source
        if (attacker.testResult.ammo) attacker.testResult.source.effects.push(...attacker.testResult.ammo.effects)

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
                if (target.actor) {
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
                }
            })
            message.data.flags.data.startMessagesList = startMessagesList;
        } else {
            game.user.targets.forEach(async target => {
                if (target.actor) {
                    await ChatMessage.create({
                        user: game.user.id,
                        content: OpposedDsa5.opposeMessage(attacker, target, true),
                        speaker: message.data.speaker
                    })
                }
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
        let res = {
            speaker: message.data.speaker,
            testResult: mergeObject(message.data.flags.data.postData, { source: message.data.flags.data.preData.source }),
            img: DSA5_Utility.getSpeaker(message.data.speaker).data.img,
            messageId: message.data._id
        }
        if (res.testResult.ammo) res.testResult.source.effects.push(...res.testResult.ammo.effects)
        return res
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

    static async playAutomatedJBA2(attacker, defender, opposedResult) {
        if (DSA5_Utility.moduleEnabled("autoanimations")) {
            //const attackerToken = canvas.tokens.get(attacker.speaker.token)
            const attackerToken = DSA5_Utility.getSpeaker(attacker.speaker).getActiveTokens()[0]
            const defenderToken = DSA5_Utility.getSpeaker(defender.speaker).getActiveTokens()[0]
            if (!attackerToken || !attackerToken.actor || !defenderToken || !defenderToken.actor) {
                return
            }
            let item = attackerToken.actor.items.get(attacker.testResult.source._id)
            if (!item) item = new Itemdsa5(attacker.testResult.source, { temporary: true })
            if (!item) return

            const targets = [defenderToken]
            const hitTargets = opposedResult.winner == "attacker" ? targets : []
            AutoAnimations.playAnimation(attackerToken, targets, item, { hitTargets, playOnMiss: true })
        }
    }

    static async showSpellWithoutTarget(message) {
        if (DSA5_Utility.moduleEnabled("autoanimations")) {
            const msgData = getProperty(message.data, "flags.data")
            if (!msgData || msgData.isOpposedTest) return

            const result = getProperty(msgData, "postData.result") || -1
            if (result > 0) {
                const attackerToken = DSA5_Utility.getSpeaker(msgData.postData.speaker).getActiveTokens()[0]
                if (!attackerToken || !attackerToken.actor) return

                let targets = Array.from(game.user.targets)
                const item = attackerToken.actor.items.get(msgData.preData.source._id)
                if (!targets.length) targets = [attackerToken]
                AutoAnimations.playAnimation(attackerToken, targets, item)
            }
        }
    }

    static async clearOpposed(actor) {
        if (game.user.isGM) {
            await actor.update({
                [`flags.-=oppose`]: null
            })
        } else {
            game.socket.emit("system.dsa5", {
                type: "clearOpposed",
                payload: {
                    actorId: actor.id
                }
            })
        }
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
        this.playAutomatedJBA2(attacker, defender, opposedResult)
        await this.renderOpposedResult(opposedResult, options)
        await this.hideReactionButton(options.startMessageId)

        return opposedResult
    }

    static async evaluateOpposedTest(attackerTest, defenderTest, options = {}) {
        let opposeResult = {};

        opposeResult.other = [];
        if (options.additionalInfo) opposeResult.other.push(options.additionalInfo)

        opposeResult.winner = "attacker"

        if (["weapon", "spell", "liturgy", "ceremony", "ritual", "combatskill"].includes(attackerTest.rollType) && defenderTest.successLevel == undefined) {
            defenderTest.successLevel = -5
        }

        if (defenderTest.successLevel != undefined) {
            switch (attackerTest.rollType) {
                case "combatskill":
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
            const damage = this._calculateOpposedDamage(attackerTest, defenderTest, options)
            if (damage.armorDamaged.damaged && damage.armorDamaged.ids.length)
                opposeResult.other.push(`<div class="center"><button class="gearDamaged onlyTarget" data-uuid="${damage.armorDamaged.ids.join(";")}">${game.i18n.localize('WEAR.checkShort')}</button></div>`)

            opposeResult.winner = "attacker"

            let title = [
                damage.armorMod != 0 ? `${damage.armorMod + " " + game.i18n.localize('Modifier')}` : "",
                damage.armorMultiplier != 1 ? "*" + damage.armorMultiplier + " " + game.i18n.localize('Modifier') : "",
                damage.spellArmor != 0 ? `${damage.spellArmor} ${game.i18n.localize('spellArmor')}` : "",
                damage.liturgyArmor != 0 ? `${damage.liturgyArmor} ${game.i18n.localize('liturgyArmor')}` : ""
            ]
            let description = `<b>${game.i18n.localize("damage")}</b>: ${damage.damage} - <span title="${title.join("")}">${damage.armor} (${game.i18n.localize("protection")})</span> = ${damage.sum}`
            opposeResult.damage = {
                description,
                value: damage.sum,
                sp: damage.damage
            }
        } else {
            opposeResult.winner = "defender"
        }
    }

    static _calculateOpposedDamage(attackerTest, defenderTest, options = {}) {
        const actor = DSA5_Utility.getSpeaker(defenderTest.speaker).data
        options.origin = attackerTest.source
        options.damage = attackerTest.damage

        let damage = DSAActiveEffectConfig.applyRollTransformation(actor, options, 5).options.damage
        let { wornArmor, armor } = Actordsa5.armorValue(actor, options)

        let multipliers = []
        let armorMod = 0
        const aPen = attackerTest.armorPen || []
        for (const mod of aPen) {
            if (/^\*/.test(mod)) multipliers.push(Number(mod.replace("*", "")))
            else armorMod += Number(mod)
        }
        let spellArmor = 0
        let liturgyArmor = 0
        if (["spell", "ritual"].includes(attackerTest.source.type)) spellArmor += actor.data.spellArmor || 0
        else if (["liturgy", "ceremony"].includes(attackerTest.source.type)) spellArmor += actor.data.liturgyArmor || 0

        armor += armorMod
        const armorMultiplier = multipliers.reduce((sum, x) => { return sum * x }, 1)
        armor = Math.max(Math.round(armor * armorMultiplier), 0)
        armor += spellArmor + liturgyArmor
        const armorDamaged = EquipmentDamage.armorGetsDamage(damage, attackerTest)
        const ids = wornArmor.map(x => x.uuid)

        return {
            damage,
            armor,
            armorDamaged: { damaged: armorDamaged, ids },
            armorMod,
            spellArmor,
            liturgyArmor,
            armorMultiplier,
            sum: damage - armor
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
                })
            } catch {
                await ChatMessage.create(chatOptions)
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
        attacker.testResult.source = attackMessage.data.flags.data.preData.source
        if (attacker.testResult.ammo) attacker.testResult.source.effects.push(...attacker.testResult.ammo.effects)

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