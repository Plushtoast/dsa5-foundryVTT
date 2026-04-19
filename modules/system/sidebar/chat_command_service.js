import PaymentRequestService from '../queries/payment-requests.js';
import GroupCheck from '../rolls/group-check.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
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

  static async openPaymentDialog(mode) {
    if (!game.user.isGM) return;

    const pay = mode === 'pay';
    const actorEntries = ActorPickerDialog.buildActorPickerData().map((a) => ({ ...a, preselected: true }));
    const header = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/dialog/parts/payment-amount-input.hbs', {
      amount: '',
      description: '',
      text: _loc(pay ? 'MASTER.payText' : 'MASTER.getPaidText', { heros: _loc('MASTER.theGroup') }),
    });

    ActorPickerDialog.open({
      actors: actorEntries,
      title: pay ? 'MASTER.payTT' : 'PAYMENT.payButton',
      header,
      showSourceToggle: true,
      callback: ({ actorIds, form }) => {
        const number = form.querySelector('.input-text')?.value;
        const description = form.querySelector('[name="description"]')?.value;
        if (!number) return;

        const selected = actorIds.map((id) => game.actors.get(id)).filter(Boolean);
        PaymentRequestService.createRequest({ mode, amount: number, description, actors: selected });
      },
    });
  }

  static groupCheck(name, modifier) {
    GroupCheck.showGCMessage(name, modifier);
  }

  static speakerAbilityRoll(name, type, options = {}) {
    const speaker = ChatMessage.getSpeaker();
    let actor = speaker.token ? game.actors.tokens[speaker.token] : null;
    if (!actor) actor = game.actors.get(speaker.actor);
    if (!actor) return ui.notifications.error('DSAError.noProperActor', { localize: true });

    ChatCommandService.executeAbilityRoll(actor, name, type, speaker.token, options);
  }
}
