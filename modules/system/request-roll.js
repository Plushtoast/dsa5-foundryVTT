import DSA5Dialog from "../dialog/dialog-dsa5.js"
import DSA5ChatAutoCompletion from "./chat_autocompletion.js"
import DSA5_Utility from "./utility-dsa5.js"

export default class RequestRoll {
    static async requestGC(category, name, messageId, modifier = 0) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (!actor) return

        game.user.updateTokenTargets([])
        let options = { modifier, postFunction: { cummulative: messageId, functionName: "game.dsa5.apps.RequestRoll.autoEditGroupCheckRoll" } }
        switch (category) {
            case "attribute":
                break
            default:
                const skill = actor.items.find((i) => i.name == name && i.type == category)
                actor.setupSkill(skill, options, tokenId).then(async(setupData) => {
                    let result = await actor.basicTest(setupData)
                    await RequestRoll.editGroupCheckRoll(messageId, result, name, category)
                })
        }
    }

    static async autoEditGroupCheckRoll(postFunction, result, source) {
        await RequestRoll.editGroupCheckRoll(postFunction.cummulative, result, source.name, source.type)
    }

    static async editGroupCheckRoll(messageId, result, target, type) {
        let message = await game.messages.get(messageId)
        const data = message.flags
        const isCrit = result.result.successLevel > 1
        const critMultiplier = isCrit ? 2 : 1
        data.botched = data.botched || result.result.successLevel < -1
        const actor = DSA5_Utility.getSpeaker(result.result.speaker)
        let update = {
            messageId: result.result.messageId,
            actor: actor.name,
            qs: (result.result.qualityStep || 0) * critMultiplier,
            success: result.result.successLevel,
            target,
            type
        }
        let index = data.results.findIndex(x => x.messageId == update.messageId)
        if (index >= 0) {
            data.results[index] = update
        } else {
            data.results.push(update)
        }
        RequestRoll.rerenderGC(message, data)
    }

    static async requestRoll(category, name, modifier = 0) {
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()

        if (actor) {
            game.user.updateTokenTargets([])
            let options = { modifier }

            switch (category) {
                case "attribute":
                    let characteristic = Object.keys(game.dsa5.config.characteristics).find(
                        (key) => game.i18n.localize(game.dsa5.config.characteristics[key]) == name
                    )
                    actor.setupCharacteristic(characteristic, options, tokenId).then((setupData) => {
                        actor.basicTest(setupData)
                    })
                    break
                case "regeneration":
                    actor.setupRegeneration("regenerate", options, tokenId).then((setupData) => {
                        actor.basicTest(setupData)
                    })
                    break
                default:
                    let skill = actor.items.find((i) => i.name == name && i.type == category)
                    actor.setupSkill(skill, options, tokenId).then((setupData) => {
                        actor.basicTest(setupData)
                    })
            }
        }
    }

    static async rerenderGC(message, data) {
        if (game.user.isGM) {
            let failed = 0
            data.qs = data.results.reduce((a, b) => {
                failed += b.success < 0 ? 1 : 0
                if (b.success > 1) failed = 0
                return a + b.qs
            }, 0)
            data.failed = failed
            for (let optn of data.rollOptions) {
                optn.calculatedModifier = optn.modifier - failed
            }
            data.openRolls = data.maxRolls - data.results.length
            data.doneRolls = data.results.length
            const content = await renderTemplate("systems/dsa5/templates/chat/roll/groupcheck.html", data)
            message.update({ content, flags: data })
        } else {
            game.socket.emit("system.dsa5", {
                type: "updateGroupCheck",
                payload: {
                    messageId: message.id,
                    data,
                },
            })
        }
        $("#chat-log").find(`[data-message-id="${message.id}"`).appendTo("#chat-log")
    }

    static showRQMessage(target, modifier = 0) {
        const mod = modifier < 0 ? ` ${modifier}` : (modifier > 0 ? ` +${modifier}` : "")
        const type = DSA5ChatAutoCompletion.skills.find(x => x.name == target).type
        const msg = game.i18n.format("CHATNOTIFICATION.requestRoll", { user: game.user.name, item: `<a class="roll-button request-roll" data-type="${type}" data-modifier="${modifier}" data-name="${target}"><i class="fas fa-dice"></i> ${target}${mod}</a>` })
        ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
    }

    static async showGCMessage(target, modifier = 0, options = {}) {
        const type = DSA5ChatAutoCompletion.skills.find(x => x.name == target).type
        const data = {
            results: [],
            qs: 0,
            failed: 0,
            modifier,
            name: game.user.name,
            maxRolls: 7,
            openRolls: 7,
            doneRolls: 0,
            targetQs: 10,
            rollOptions: [
                { type, modifier, calculatedModifier: modifier, target }
            ]
        }
        mergeObject(data, options)
        const content = await renderTemplate("systems/dsa5/templates/chat/roll/groupcheck.html", data)
        let chatData = DSA5_Utility.chatDataSetup(content)
        chatData.flags = data
        ChatMessage.create(chatData);
    }

    static async addSkillToGC(ev) {
        const messageID = $(ev.currentTarget).parents(".message").attr("data-message-id")
        const content = await renderTemplate("systems/dsa5/templates/dialog/addgroupcheckskill.html", {
            skills: DSA5ChatAutoCompletion.skills
                .filter(x => x.type == "skill")
                .sort((x, y) => x.name.localeCompare(y.name))
        })
        let data = {
            title: game.i18n.localize("HELP.groupcheck"),
            content,
            buttons: {
                ok: {
                    icon: '<i class="fa fa-check"></i>',
                    label: game.i18n.localize("ok"),
                    callback: async(dlg) => {
                        const message = game.messages.get(messageID)
                        const data = message.flags
                        data.rollOptions.push({
                            type: "skill",
                            modifier: dlg.find('[name="modifier"]').val(),
                            target: dlg.find('[name="skill"]').val()
                        })
                        RequestRoll.rerenderGC(message, data)
                    }
                },
                cancel: {
                    icon: '<i class="fas fa-times"></i>',
                    label: game.i18n.localize("cancel"),

                }
            }
        }
        new DSA5Dialog(data).render(true)
    }

    static async removeGCEntry(ev) {
        const elem = $(ev.currentTarget)
        const index = Number(ev.currentTarget.dataset.index)
        const message = game.messages.get(elem.parents(".message").attr("data-message-id"))
        const data = message.flags
        data.results.splice(index, 1)
        RequestRoll.rerenderGC(message, data)
    }

    static removeSkillFromGC(ev) {
        const elem = $(ev.currentTarget)
        const message = game.messages.get(elem.parents(".message").attr("data-message-id"))
        const data = message.flags
        data.rollOptions = data.rollOptions.filter(x => !(x.type == ev.currentTarget.dataset.type && x.target == ev.currentTarget.dataset.name))
        data.results = data.results.filter(x => !(x.type == ev.currentTarget.dataset.type && x.target == ev.currentTarget.dataset.name))
        RequestRoll.rerenderGC(message, data)
    }

    static async editGC(ev) {
        const elem = $(ev.currentTarget)
        const index = Number(ev.currentTarget.dataset.index)
        const message = game.messages.get(elem.parents(".message").attr("data-message-id"))
        const data = message.flags
        if (index) {
            data.results[index].qs = Number(elem.val())
        } else if (ev.currentTarget.dataset.name) {
            const dataElem = data.rollOptions.find(x => x.target == ev.currentTarget.dataset.name && ev.currentTarget.dataset.type == x.type)
            dataElem[ev.currentTarget.dataset.field] = Number(elem.val())
        } else {
            data[ev.currentTarget.dataset.field] = Number(elem.val())
        }
        RequestRoll.rerenderGC(message, data)
    }

    static async updateInformationRoll(postFunction, result, source) {
        const availableQs = result.result.qualityStep || 0
        if (availableQs > 0) {
            const item = await fromUuid(postFunction.uuid)
            const msg = [`<p><b>${item.name}</b></p>`]
            for (let i = 1; i <= availableQs; i++) {
                const qs = `qs${i}`
                if (item.system[qs]) {
                    msg.push(`<p>${item.system[qs]}</p>`)
                }
            }
            const chatData = DSA5_Utility.chatDataSetup(msg.join(""))
            if (postFunction.recipients.length) chatData["whisper"] = postFunction.recipients

            ChatMessage.create(chatData);
        }
    }

    static async informationRequestRoll(ev) {
        const modifier = ev.currentTarget.dataset.mod
        const uuid = ev.currentTarget.dataset.uuid
        const { actor, tokenId } = DSA5ChatAutoCompletion._getActor()
        if (!actor) return

        const recipientsTarget = game.settings.get("dsa5", "informationDistribution")
        let recipients = []
        if (recipientsTarget == 1) {
            recipients = game.users.filter((user) => user.isGM).map((x) => x.id)
            recipients.push(game.user.id)
        } else if (recipientsTarget == 2) {
            recipients = game.users.filter((user) => user.isGM).map((x) => x.id)
        }
        const optns = { modifier, postFunction: { functionName: "game.dsa5.apps.RequestRoll.updateInformationRoll", uuid, recipients } }
        let skill = actor.items.find((i) => i.name == ev.currentTarget.dataset.skill && i.type == "skill")
        actor.setupSkill(skill, optns, tokenId).then(async(setupData) => {
            setupData.testData.opposable = false
            const res = await actor.basicTest(setupData)
            this.updateInformationRoll(optns.postFunction, res)
        })
    }

    static chatListeners(html) {
        html.on("change", ".editGC", (ev) => RequestRoll.editGC(ev))
        html.on("click", ".request-roll", (ev) => {
            const elem = ev.currentTarget.dataset
            RequestRoll.requestRoll(elem.type, elem.name, Number(elem.modifier) || 0)
        })
        html.on("click", ".request-gc", (ev) => {
            const elem = ev.currentTarget.dataset
            RequestRoll.requestGC(
                elem.type,
                elem.name,
                $(ev.currentTarget).parents(".message").attr("data-message-id"),
                Number(elem.modifier) || 0
            )
        })
        html.on("click", ".removeGC", (ev) => RequestRoll.removeGCEntry(ev))
        html.on('click', '.removeSkillFromGC', ev => RequestRoll.removeSkillFromGC(ev))
        html.on('click', '.addSkillToGC', ev => RequestRoll.addSkillToGC(ev))
        html.on('click', '.informationRequestRoll', ev => RequestRoll.informationRequestRoll(ev))
    }
}