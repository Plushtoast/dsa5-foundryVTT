import OpposedDsa5 from '../system/opposed-dsa5.js'
import DiceDSA5 from '../system/dice-dsa5.js'

export default function() {
    Hooks.on('renderChatLog', (log, html, data) => {
        OpposedDsa5.chatListeners(html)
        DiceDSA5.chatListeners(html)
    });

    Hooks.on("renderChatMessage", async (app, html, msg) => {
        if (!game.user.isGM) {
            html.find(".chat-button-gm").remove();
         }

    });
}