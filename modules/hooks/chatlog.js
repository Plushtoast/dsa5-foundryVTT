import OpposedDsa5 from '../system/opposed-dsa5.js'
import DiceDSA5 from '../system/dice-dsa5.js'
import DSA5Payment from '../system/payment.js'
import DSA5_Utility from '../system/utility-dsa5.js';

export default function() {
    Hooks.on('renderChatLog', (log, html, data) => {
        OpposedDsa5.chatListeners(html)
        DiceDSA5.chatListeners(html)
        DSA5Payment.chatListeners(html)
    });

    Hooks.on("renderChatMessage", async(app, html, msg) => {
        if (!game.user.isGM) {
            html.find(".chat-button-gm").remove();
        }
    });

    Hooks.on("chatMessage", (html, content, msg) => {
        if (content.match(/^\/pay/)) {
            if (game.user.isGM) {
                DSA5Payment.createPayChatMessage(content)
            } else {
                DSA5Payment.payMoney(DSA5_Utility.getSpeaker(msg.speaker), content)
            }
            return false
        } else if (content.match(/^\/getPaid/)) {
            if (game.user.isGM) {
                DSA5Payment.createGetPaidChatMessage(content)
            } else {
                DSA5Payment.getMoney(DSA5_Utility.getSpeaker(msg.speaker), content)
            }
            return false
        }
    })
}