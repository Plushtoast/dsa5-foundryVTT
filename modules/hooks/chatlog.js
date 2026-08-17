import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import DSA5Payment from '../system/payment/payment.js';
import PaymentRequestService from '../system/queries/payment-requests.js';
import RollRequestService from '../system/queries/roll-request.js';
import MagicAnalysisQueryService from '../system/queries/magic-analysis-query.js';
import InformationQueryService from '../system/queries/information-query.js';
import RegenerationHelper from '../system/rolls/regeneration-helper.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import ChatCommandService from '../system/sidebar/chat_command_service.js';
import DSA5ChatListeners from '../system/sidebar/chat_listeners.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DialogReactDSA5 from '../dialog/dialog-react.js';

import { TrapState } from '../chatmessage/trap_state.js';
import ItempackageData from '../data/item/itempackage.js';
const { getProperty } = foundry.utils;

export default function () {

  Hooks.on('renderChatLog', (log, html, data) => {
    const jhtml = $(html);

    OpposedDsa5.chatListeners(jhtml);
    DiceDSA5.chatListeners(jhtml);
    DSA5Payment.chatListeners(jhtml);
    PaymentRequestService.chatListeners(jhtml);
    RollRequestService.chatListeners(jhtml);
    InformationQueryService.chatListeners(jhtml);
    MagicAnalysisQueryService.chatListeners(html);
    TrapState.chatListeners(jhtml);

    game.dsa5.autoComplete = new DSA5ChatAutoCompletion();
    Hooks.call('startDSA5ChatAutoCompletion', game.dsa5.autoComplete);
    ChatCommandService.applyToAutoCompletion(game.dsa5.autoComplete);
    game.dsa5.autoComplete.chatListeners(jhtml);

    DSA5ChatListeners.chatListeners(jhtml);
    ItempackageData.chatListeners(jhtml);
  });

  Hooks.on('renderChatInput', applyNotificationListeners);

  function applyNotificationListeners(app, html, context) {
    if (context.previousParent.id != 'chat-notifications') return;

    const domElement = context.previousParent;
    const chatNotifications = $(domElement);

    OpposedDsa5.chatListeners(chatNotifications);
    DiceDSA5.chatListeners(chatNotifications);
    DSA5Payment.chatListeners(chatNotifications);
    PaymentRequestService.chatListeners(chatNotifications);
    RollRequestService.chatListeners(chatNotifications);
    InformationQueryService.chatListeners(chatNotifications);
    MagicAnalysisQueryService.chatListeners(domElement);
    DSA5ChatListeners.chatListeners(chatNotifications);
    ItempackageData.chatListeners(chatNotifications);

    Hooks.call('dsa5ApplyNotificationListeners', chatNotifications);
    Hooks.off('renderChatInput', applyNotificationListeners);
  }

  Hooks.on('chatInput', (event, inputOptions) => {
    return game.dsa5.autoComplete._navigateQuickFind(event);
  })

  Hooks.on('updateChatMessage', (message, changed) => {
    if (getProperty(changed, 'flags.data.healApplied')) {
      RegenerationHelper.refreshLinkedRequestCards(message.id);
    }

    const isBumpableCard = getProperty(message, 'flags.dsa5.queryRequest') || getProperty(message, 'flags.gc');
    if (!isBumpableCard) return;
    if (!('timestamp' in changed)) return;

    const log = ui.chat?.element?.querySelector('.chat-log');
    if (!log) return;

    const li = log.querySelector(`.message[data-message-id="${message.id}"]`);
    if (!li || li === log.lastElementChild) return;

    log.append(li);
    if (ui.chat.isAtBottom) ui.chat.scrollBottom();
  });

  Hooks.on('renderChatMessageHTML', (app, html, msg) => {
    html = $(html);
    if (!game.user.isGM) {
      html.find('.chat-button-gm').remove();
      let actor;
      const reaction = html.find('.chat-button-target');
      if (reaction.length) {
        actor = DialogReactDSA5.getTargetActor(msg.message);
        if (actor && actor.actor && !actor.actor.isOwner) reaction.remove();
      }

      const speaker = DSA5_Utility.getSpeaker(msg.message.speaker);
      if (speaker && !speaker.isOwner) {
        html.find('.selfButton').remove();
        html.find('.d20').attr('data-tooltip', '');
      }

      const onlyTarget = html.find('.onlyTarget');
      if (onlyTarget.length) {
        actor = DSA5_Utility.getSpeaker({
          token: onlyTarget.attr('data-token'),
          actor: onlyTarget.attr('data-actor'),
          scene: canvas.scene ? canvas.scene.id : null,
        });
        if (actor && !actor.isOwner) onlyTarget.remove();
      }

      html.find('.hideData').remove();
      const hiddenForMe = getProperty(msg.message, `flags.dsa5.userHidden.${game.user.id}`);
      if (hiddenForMe) {
        html.find('.payButton').remove();
      }
      html.find('.payment-request-gm').remove();
    } else {
      html.find('.chat-button-player').remove();
    }

    RollRequestService.handleRenderMessage(msg, html);
    MagicAnalysisQueryService.handleRenderMessage(msg, html);
    if (game.settings.get('dsa5', 'expandChatModifierlist')) {
      html.find('.expand-mods i').toggleClass('fa-minus fa-plus');
      html.find('.expand-mods + ul').css({ display: 'block' });
    }

    DSA5StatusEffects.bindButtons(html);

    html.find('.embeddedItemDrag').each(function (i, cond) {
      cond.setAttribute('draggable', true);
      cond.addEventListener('dragstart', (ev) => embeddedDragStart(ev));
    });
  });

  Hooks.on('chatMessage', (html, content, msg) => {
    const normalizedContent = content.replace(/<\/?p>/gi, '').replace(/<br\b[^>]*>/gi, '\n').trim();
    if (ChatCommandService.tryExecuteChatCommand(normalizedContent, msg)) return false;

    let cmd = normalizedContent.match(/^\/(pay|getPaid|help|conditions|tables|packages)(?:\s|$)/i);
    cmd = cmd ? cmd[0].trim().toLowerCase() : '';
    switch (cmd) {
      case '/pay': {
        const { moneyString, description } = DSA5Payment.parseChatCommand(normalizedContent);
        if (game.user.isGM) ChatCommandService.openPaymentDialog('pay', { amount: moneyString, description });
        else DSA5Payment.payMoney(DSA5_Utility.getSpeaker(msg.speaker), moneyString, false, true, description);
        return false;
      }
      case '/getpaid': {
        const { moneyString, description } = DSA5Payment.parseChatCommand(normalizedContent);
        if (game.user.isGM) ChatCommandService.openPaymentDialog('getPaid', { amount: moneyString, description });
        else DSA5Payment.getMoney(DSA5_Utility.getSpeaker(msg.speaker), moneyString, false, true, description);
        return false;
      }
      case '/help':
        DSA5ChatListeners.getHelp();
        return false;
      case '/conditions':
        DSA5ChatListeners.showConditions();
        return false;
      case '/tables':
        DSA5ChatListeners.showTables();
        return false;
      case '/packages':
        ItempackageData.postPackagesChatCard();
        return false;
    }
  });

  Hooks.on('preCreateChatMessage', (doc, createData, options, user_id) => {
    if (getProperty(doc, 'flags.core.initiativeRoll')) {
      const rolls = doc.rolls[0].terms;
      const basnum = `${rolls[0].number}`.split('.')[0];
      const tooltip = `${_loc('baseValue')}: ${basnum}, ${_loc('randomValue')}: ${rolls.at(-3).values[0]}")}`;
      const dies = [];
      for (const term of rolls) {
        if (term.faces && term.faces == 6) {
          for (let i = 0; i < term.number; i++) {
            dies.push(`<span class="die-damage d${term.faces}">${term.results[i].result}</span>`);
          }
        }
      }
      const content = `<div>
                <div class="card-content hide-option roll-result">
                    <b>${_loc('Roll')}</b>: ${dies.join('')}
                </div>
                <div class="card-content" data-tooltip="${tooltip}">
                    <b>${_loc('initiative')}</b>: ${Math.floor(doc.rolls[0]._total * 100) / 100}
                </div>
            </div>`;

      const update = {
        content,
        flavor: undefined,
      };
      doc.updateSource(update);
    }
  });
}

function embeddedDragStart(ev) {
  const messageId = $(ev.currentTarget).parents('.message').attr('data-message-id');
  const message = game.messages.get(messageId);
  const item = message.getFlag('dsa5', 'embeddedItem');
  const dataTransfer = {
    type: 'Item',
    data: item,
  };
  ev.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
}
