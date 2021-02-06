export default class ChatMessageDSA5Roll extends ChatMessage {
    get isRoll() {
        return this.isDSARoll || super.isRoll
    }
    get roll() {
        return this.isDSARoll ? new EmptyRoll() : super.roll
    }

    get isDSARoll() {
        return this.data.flags.data ? this.data.flags.data.isDSARoll : false
    }
}

class EmptyRoll {
    render() {
        return game.i18n.localize("CHATNOTIFICATION.YouRolledBlindly")
    }
}