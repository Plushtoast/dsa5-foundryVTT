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
        let autoComplete = new DSA5ChatAutoCompletion()
        autoComplete.chatListeners(html)
        DSA5ChatListeners.chatListeners(html)
    });

    Hooks.on("renderChatMessage", async(app, html, msg) => {
        if (!game.user.isGM) {
            html.find(".chat-button-gm").remove();
            let actor
            let reaction = html.find(".chat-button-target")
            if (reaction.length) {
                actor = DialogReactDSA5.getTargetActor({ data: msg.message })
                if (!actor.owner) {
                    reaction.remove()
                }
            }
            html.find(".hideData").remove()
        }
        DSA5StatusEffects.bindButtons(html)
    });

    Hooks.on("chatMessage", (html, content, msg) => {
        let cmd = content.match(/^\/(pay|getPaid|help$|conditions$|tables$|ch$)/)
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
            case "/ch":
                DSA5ChatListeners.check3D20()
                return false

        }
    })
}