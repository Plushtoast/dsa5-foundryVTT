import DSA5_Utility from '../helpers/utility-dsa5.js';
import DSA5Payment from '../payment/payment.js';
import PaymentRequestService from '../payment/payment-requests.js';
import RequestRoll from '../rolls/request-roll.js';
import DSA5ChatAutoCompletion from './chat_autocompletion.js';
import Select2Dialog from '../../dialog/select2Dialog.js';

export default class ChatCommandService {
  static executeAbilityRoll(actor, name, type, tokenId, options = {}) {
    switch (type) {
      case 'skill': {
        const skill = actor.items.find((i) => i.name === name && i.type === 'skill');
        if (skill) actor.setupSkill(skill, options, tokenId).then((s) => actor.basicTest(s));
        break;
      }
      case 'attribute': {
        const characteristic = Object.keys(game.dsa5.config.characteristics).find((key) => _loc(game.dsa5.config.characteristics[key]) === name);
        if (characteristic) actor.setupCharacteristic(characteristic, options, tokenId).then((s) => actor.basicTest(s));
        break;
      }
      case 'regeneration':
        actor.setupRegeneration('regenerate', options, tokenId).then((s) => actor.basicTest(s));
        break;
    }
  }

  static openSkillModifierDialog(titleKey, { filterFn, onSubmit } = {}) {
    const skills = DSA5ChatAutoCompletion.skills.filter(filterFn || (() => true)).sort((a, b) => a.name.localeCompare(b.name));
    const options = skills.map((s) => `<option value="${s.name}">${s.name}</option>`).join('');

    const content = `<div>
      <div class='row-section lineheight'>
        <div class='col fourty table-title'><label>${_loc('Modifier')}</label></div>
        <div class='col sixty'><input name='modifier' class='quantity-click' type='Number' value='0' /></div>
      </div>
      <div class='row-section lineheight'>
        <div class='col fourty table-title'><label>${_loc('skill')}</label></div>
        <div class='col sixty'><select name='skill' class='select2' style='width:100%;'>${options}</select></div>
      </div>
    </div>`;

    new Select2Dialog({
      window: { title: _loc(titleKey) },
      content,
      buttons: [
        {
          action: 'ok',
          icon: 'fa fa-check',
          label: 'ok',
          default: true,
          callback: (event, button) => {
            const form = $(button.form);
            const name = form.find('[name="skill"]').val();
            const modifier = Number(form.find('[name="modifier"]').val()) || 0;
            const type = skills.find((s) => s.name === name)?.type || 'skill';
            if (onSubmit) onSubmit(name, type, modifier);
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'cancel' },
      ],
    }).render(true);
  }

  static openPaymentDialog(mode) {
    const content = `<div>
      <div class='row-section lineheight'>
        <div class='col fourty table-title'><label>${_loc('TYPES.Item.money')}</label></div>
        <div class='col sixty'><input name='amount' type='text' /></div>
      </div>
      <div class='row-section lineheight'>
        <div class='col fourty table-title'><label>${_loc('Description')}</label></div>
        <div class='col sixty'><input name='description' type='text' /></div>
      </div>
    </div>`;

    new foundry.applications.api.DialogV2({
      window: { title: _loc(mode === 'pay' ? 'HELP.pay' : 'HELP.getPaid') },
      content,
      buttons: [
        {
          action: 'ok',
          icon: 'fa fa-check',
          label: 'ok',
          default: true,
          callback: (event, button) => {
            const form = button.form;
            const moneyString = form.querySelector('[name="amount"]')?.value;
            const description = form.querySelector('[name="description"]')?.value;
            if (!moneyString) return;

            if (game.user.isGM) {
              PaymentRequestService.createRequest({ mode, amount: moneyString, description, actors: PaymentRequestService.activeCharacterActors(), source: 'chatCommand' });
            } else {
              const actor = DSA5_Utility.getSpeaker(ChatMessage.getSpeaker());
              if (mode === 'pay') DSA5Payment.payMoney(actor, moneyString);
              else DSA5Payment.getMoney(actor, moneyString);
            }
          },
        },
        { action: 'cancel', icon: 'fas fa-times', label: 'cancel' },
      ],
    }).render(true);
  }

  static requestRoll(name, modifier) {
    RequestRoll.showRQMessage(name, modifier);
  }

  static groupCheck(name, modifier) {
    RequestRoll.showGCMessage(name, modifier);
  }

  static speakerAbilityRoll(name, type) {
    const speaker = ChatMessage.getSpeaker();
    let actor = speaker.token ? game.actors.tokens[speaker.token] : null;
    if (!actor) actor = game.actors.get(speaker.actor);
    if (!actor) return ui.notifications.error('DSAError.noProperActor', { localize: true });

    ChatCommandService.executeAbilityRoll(actor, name, type, speaker.token);
  }
}
