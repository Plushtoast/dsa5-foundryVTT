export default class ChatMessageDSA5Roll extends ChatMessage {
  get isRoll() {
    return this.isDSARoll || super.isRoll;
  }

  get roll() {
    if (this.isDSARoll) return new EmptyRoll('');
    return super.roll;
  }

  get isDSARoll() {
    return !!this.flags.data?.isDSARoll;
  }
}

class EmptyRoll extends Roll {
  render() {
    return '';
  }
}
