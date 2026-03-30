import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import DSA5Payment from '../system/payment/payment.js';
import PaymentRequestService from '../system/payment/payment-requests.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import DSA5ChatListeners from '../system/sidebar/chat_listeners.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DialogReactDSA5 from '../dialog/dialog-react.js';

import { TrapState } from '../chatmessage/trap_state.js';
const { getProperty } = foundry.utils;

export default function () {

  Hooks.on('renderChatLog', (log, html, data) => {
    html = $(html);

    OpposedDsa5.chatListeners(html);
    DiceDSA5.chatListeners(html);
    DSA5Payment.chatListeners(html);
    PaymentRequestService.chatListeners(html);
    TrapState.chatListeners(html);

    game.dsa5.autoComplete = new DSA5ChatAutoCompletion();
    Hooks.call('startDSA5ChatAutoCompletion', game.dsa5.autoComplete);
    game.dsa5.autoComplete.chatListeners(html);

    DSA5ChatListeners.chatListeners(html);
  });

  Hooks.on('renderChatInput', applyNotificationListeners);

  function applyNotificationListeners(app, html, context) {
    if (context.previousParent.id != 'chat-notifications') return;

    const chatNotifications = $(context.previousParent);

    OpposedDsa5.chatListeners(chatNotifications);
    DiceDSA5.chatListeners(chatNotifications);
    DSA5Payment.chatListeners(chatNotifications);
    PaymentRequestService.chatListeners(chatNotifications);
    DSA5ChatListeners.chatListeners(chatNotifications);

    Hooks.call('dsa5ApplyNotificationListeners', chatNotifications);
    Hooks.off('renderChatInput', applyNotificationListeners);
  }

  Hooks.on('chatInput', (event, inputOptions) => {
    return game.dsa5.autoComplete._navigateQuickFind(event);
  })

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
    let cmd = normalizedContent.match(/^\/(pay|getPaid|help|conditions|tables)(?:\s|$)/i);
    cmd = cmd ? cmd[0].trim().toLowerCase() : '';
    switch (cmd) {
      case '/pay': {
        const { moneyString, description } = DSA5Payment.parseChatCommand(normalizedContent);
        if (game.user.isGM) PaymentRequestService.createRequest({ mode: 'pay', amount: moneyString, description, actors: PaymentRequestService.activeCharacterActors(), source: 'chatCommand' });
        else DSA5Payment.payMoney(DSA5_Utility.getSpeaker(msg.speaker), moneyString);
        return false;
      }
      case '/getPaid': {
        const { moneyString, description } = DSA5Payment.parseChatCommand(normalizedContent);
        if (game.user.isGM) PaymentRequestService.createRequest({ mode: 'getPaid', amount: moneyString, description, actors: PaymentRequestService.activeCharacterActors(), source: 'chatCommand' });
        else DSA5Payment.getMoney(DSA5_Utility.getSpeaker(msg.speaker), moneyString);
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
