import OpposedDsa5 from '../system/opposed-dsa5.js'
import DiceDSA5 from '../system/dice-dsa5.js'
import DSA5Payment from '../system/payment.js'
import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../system/chat_autocompletion.js';
import DSA5ChatListeners from '../system/chat_listeners.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DialogReactDSA5 from '../dialog/dialog-react.js';

export default function() {
    Hooks.on('renderChatLog', (log, html, data) => {
        OpposedDsa5.chatListeners(html)
        DiceDSA5.chatListeners(html)
        DSA5Payment.chatListeners(html)
        const autoComplete = new DSA5ChatAutoCompletion()
        Hooks.call("startDSA5ChatAutoCompletion", autoComplete)
        autoComplete.chatListeners(html)
        DSA5ChatListeners.chatListeners(html)
    });

    Hooks.on("renderChatMessage", (app, html, msg) => {
        if (!game.user.isGM) {
            html.find(".chat-button-gm").remove();
            let actor
            const reaction = html.find(".chat-button-target")
            if (reaction.length) {
                actor = DialogReactDSA5.getTargetActor(msg.message)
                if (actor && actor.actor && !actor.actor.isOwner) reaction.remove()
            }

            const speaker = DSA5_Utility.getSpeaker(msg.message.speaker)
            if (speaker && !speaker.isOwner) {
                html.find(".selfButton").remove()
                html.find('.d20').attr('data-tooltip', '')
            }

            const onlyTarget = html.find(".onlyTarget")
            if (onlyTarget.length) {
                actor = DSA5_Utility.getSpeaker({
                    token: onlyTarget.attr("data-token"),
                    actor: onlyTarget.attr("data-actor"),
                    scene: canvas.scene ? canvas.scene.id : null
                })
                if (actor && !actor.isOwner) onlyTarget.remove()
            }

            html.find(".hideData").remove()
            const hiddenForMe = getProperty(msg.message, `flags.dsa5.userHidden.${game.user.id}`)
            if (hiddenForMe) { html.find(".payButton").remove() }
        }else{
            html.find(".chat-button-player").remove()
        }
        if (game.settings.get("dsa5", "expandChatModifierlist")) {
            html.find('.expand-mods i').toggleClass("fa-minus fa-plus")
            html.find('.expand-mods + ul').css({ "display": "block" })
        }
        DSA5StatusEffects.bindButtons(html)

        html.find('.embeddedItemDrag').each(function(i, cond) {

            cond.setAttribute("draggable", true);
            cond.addEventListener("dragstart", ev => embeddedDragStart(ev));
        })
    });

    Hooks.on("chatMessage", (html, content, msg) => {
        let cmd = content.match(/^\/(pay|getPaid|help$|conditions$|tables)/)
        cmd = cmd ? cmd[0] : ""
        switch (cmd) {
            case "/pay":
                if (game.user.isGM)
                    DSA5Payment.createPayChatMessage(content)
                else
                    DSA5Payment.payMoney(DSA5_Utility.getSpeaker(msg.speaker), content)
                return false
            case "/getPaid":
                if (game.user.isGM)
                    DSA5Payment.createGetPaidChatMessage(content)
                else
                    DSA5Payment.getMoney(DSA5_Utility.getSpeaker(msg.speaker), content)
                return false
            case "/help":
                DSA5ChatListeners.getHelp()
                return false
            case "/conditions":
                DSA5ChatListeners.showConditions()
                return false
            case "/tables":
                DSA5ChatListeners.showTables()
                return false
        }
    })

    Hooks.on("preCreateChatMessage", (doc, createData, options, user_id) => {
        if(getProperty(doc, "flags.core.initiativeRoll")) {
            const rolls = doc.rolls[0].terms
            const basnum = `${rolls[0].number}`.split(".")[0]
            const tooltip = `${game.i18n.localize("baseValue")}: ${basnum}, ${game.i18n.localize("randomValue")}: ${rolls.at(-3).values[0]}")}`
            const dies = []
            for(let term of rolls) {
                if(term.faces && term.faces == 6) {
                    for(let i = 0; i < term.number; i++) {
                        dies.push(`<span class="die-damage d${term.faces}">${term.results[i].result}</span>`)
                    }
                }
            }
            const content = `<div>
                <div class="card-content hide-option roll-result">
                    <b>${game.i18n.localize("Roll")}</b>: ${dies.join("")}
                </div>
                <div class="card-content" data-tooltip="${tooltip}">
                    <b>${game.i18n.localize('initiative')}</b>: ${Math.floor(doc.rolls[0]._total * 100) / 100}
                </div>
            </div>`

            const update = {
                content,
                flavor: undefined
            }
            doc.updateSource(update)
        }
    })
}




function embeddedDragStart(ev) {
    const messageId = $(ev.currentTarget).parents(".message").attr("data-message-id")
    let message = game.messages.get(messageId);
    const item = message.getFlag("dsa5", "embeddedItem")
    let dataTransfer = {
        type: "Item",
        data: item
    }
    ev.dataTransfer.setData("text/plain", JSON.stringify(dataTransfer));
}