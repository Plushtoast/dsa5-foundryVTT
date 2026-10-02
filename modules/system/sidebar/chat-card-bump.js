const { getProperty, mergeObject } = foundry.utils;

export default class ChatCardBump {
  static FLAG_SCOPE = 'dsa5';
  static FLAG_KEY = 'bumpCard';

  static apply(flags = {}) {
    return mergeObject(flags, { [this.FLAG_SCOPE]: { [this.FLAG_KEY]: true } });
  }

  static isBumpable(message) {
    return Boolean(message?.getFlag?.(this.FLAG_SCOPE, this.FLAG_KEY));
  }

  static onPreUpdate(message, changed) {
    if (!this.isBumpable(message) && !getProperty(changed, `flags.${this.FLAG_SCOPE}.${this.FLAG_KEY}`)) return;
    if (!('timestamp' in changed)) changed.timestamp = Date.now();
  }

  static onUpdate(message, changed) {
    if (!this.isBumpable(message)) return;
    if (!('timestamp' in changed)) return;
    this.bumpToEnd(message);
  }

  static bumpToEnd(message) {
    const id = message?.id;
    if (!id) return;

    const chats = [ui.chat, ui.chat?.popout].filter((chat) => chat?.rendered && chat?.element);
    for (const chat of chats) {
      const log = chat.element.querySelector('.chat-log');
      if (!log) continue;
      const li = log.querySelector(`.message[data-message-id="${id}"]`);
      if (!li || li === log.lastElementChild) continue;
      log.append(li);
      if (chat.isAtBottom) chat.scrollBottom();
    }
  }
}
