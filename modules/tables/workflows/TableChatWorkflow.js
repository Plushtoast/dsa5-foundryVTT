import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import TableEffectHelpers from '../tableEffectHelpers.js';

const { mergeObject } = foundry.utils;

export default class TableChatWorkflow {
  static flagKey = '';

  static flag(message) {
    return TableEffectHelpers.flag(message, this.flagKey);
  }

  static async createWorkflowMessage(content, payload) {
    await ChatMessage.create(mergeObject(DSA5_Utility.chatDataSetup(content), {
      flags: {
        dsa5: {
          [this.flagKey]: payload,
        },
      },
    }));
    return true;
  }

  static getMessage(ev) {
    return game.messages.get(ev.currentTarget.closest('.message')?.dataset.messageId);
  }

  static async markWorkflowUsed(message, label) {
    return TableEffectHelpers.markWorkflowUsed(message, label);
  }
}
