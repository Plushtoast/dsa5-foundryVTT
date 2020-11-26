import OpposedDsa5 from '../system/opposed-dsa5.js'

export default function() {
    Hooks.on('renderChatLog', (log, html, data) => {
        OpposedDsa5.chatListeners(html)
    });
}