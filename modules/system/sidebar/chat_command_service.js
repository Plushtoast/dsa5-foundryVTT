import PaymentRequestService from '../queries/payment-requests.js';
import GroupCheck from '../rolls/group-check.js';
import ActorPickerDialog from '../../dialog/actor-picker-dialog.js';
import DSA5ChatAutoCompletion from './chat_autocompletion.js';
import DSA5 from '../../config/config-dsa5.js';

/**
 * Registry for system and module chat slash-commands.
 *
 * Modules register via {@link ChatCommandService.registerCommand} so autocomplete,
 * chatMessage handling, /help text, and the chat help context menu stay in sync.
 *
 * @example
 * ```js
 * game.dsa5.apps.ChatCommandService.registerCommand('my-module.foo', {
 *   cmd: 'foo',
 *   help: { name: 'foo', command: '/foo', example: '/foo bar' },
 *   menu: { icon: 'fas fa-star', onClick: () => doFoo() },
 *   filter(search, ev) { this._setFilteredList(results, 'FOO', ev); },
 *   quick(target) { this._resetChatAutoCompletion(target); doFoo(target.textContent); },
 *   execute(args) { doFoo(args); },
 * });
 * ```
 */
export default class ChatCommandService {
  static #commands = new Map();

  /**
   * @param {string} id Stable id, e.g. `dsa5-mastersworkshop.nm`
   * @param {{
   *   cmd: string,
   *   help?: { name: string, command: string, example: string },
   *   menu?: { icon?: string, label?: string, onClick: Function, gmOnly?: boolean },
   *   filter?: Function,
   *   quick?: Function,
   *   execute?: (args: string, content: string, msg: object) => void,
   *   gmOnly?: boolean,
   * }} definition
   */
  static registerCommand(id, definition) {
    if (!id || !definition?.cmd) {
      console.error('ChatCommandService.registerCommand: id and cmd are required');
      return;
    }

    const cmd = definition.cmd.toLowerCase();
    this.#commands.set(id, { ...definition, cmd });

    if (definition.help) {
      const exists = DSA5.helpContent.some((h) => h.name === definition.help.name);
      if (!exists) DSA5.helpContent.push({ ...definition.help });
    }

    if (game.dsa5?.autoComplete) this.applyToAutoCompletion(game.dsa5.autoComplete);
  }

  static unregisterCommand(id) {
    this.#commands.delete(id);
  }

  static applyToAutoCompletion(app) {
    if (!app) return;

    for (const def of this.#commands.values()) {
      if (!app.constructor.cmds.includes(def.cmd)) app.constructor.cmds.push(def.cmd);

      const key = def.cmd.toUpperCase();
      if (typeof def.filter === 'function') app[`_filter${key}`] = def.filter;
      if (typeof def.quick === 'function') app[`_quick${key}`] = def.quick;
    }
  }

  /** @returns {boolean} true if a registered command handled the message */
  static tryExecuteChatCommand(normalizedContent, msg) {
    for (const def of this.#commands.values()) {
      if (typeof def.execute !== 'function') continue;

      const match = normalizedContent.match(new RegExp(`^/${def.cmd}(?:\\s+(.*))?$`, 'i'));
      if (!match) continue;
      if ((def.gmOnly || def.menu?.gmOnly) && !game.user.isGM) return true;

      def.execute((match[1] || '').trim(), normalizedContent, msg);
      return true;
    }
    return false;
  }

  static getRegisteredHelpMenuItems() {
    return [...this.#commands.values()]
      .filter((def) => typeof def.menu?.onClick === 'function')
      .filter((def) => !(def.gmOnly || def.menu.gmOnly) || game.user.isGM)
      .map((def) => ({
        label: _loc(def.menu.label || (def.help?.name ? `HELP.${def.help.name}` : def.cmd)),
        icon: def.menu.icon || 'fas fa-terminal',
        onClick: def.menu.onClick,
      }));
  }

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

  static openSkillActorDialog(titleKey, { filterFn, actors, onSubmit } = {}) {
    const skills = DSA5ChatAutoCompletion.skills.filter(filterFn || (() => true)).sort((a, b) => a.name.localeCompare(b.name));
    const options = skills.map((s) => `<option value="${s.name}">${s.name}</option>`).join('');

    const header = `<div class='row-section lineheight'>
        <div class='col fourty table-title'><label>${_loc('skill')}</label></div>
        <div class='col sixty'><select name='skill' class='select2' style='width:100%;'>${options}</select></div>
      </div>
      <div class='row-section lineheight'>
        <div class='col fourty table-title'><label>${_loc('Modifier')}</label></div>
        <div class='col sixty'><input name='modifier' class='quantity-click' type='Number' value='0' /></div>
      </div>`;

    const actorEntries = actors || ActorPickerDialog.buildActorPickerData().map((a) => ({ ...a, preselected: true }));

    ActorPickerDialog.open({
      actors: actorEntries,
      title: titleKey,
      header,
      showSourceToggle: !actors,
      callback: ({ actorIds, form }) => {
        const $form = $(form);
        const name = $form.find('[name="skill"]').val();
        const modifier = Number($form.find('[name="modifier"]').val()) || 0;
        const type = skills.find((s) => s.name === name)?.type || 'skill';
        if (onSubmit) onSubmit(name, type, modifier, actorIds);
      },
    });
  }

  static async openPaymentDialog(mode, { amount = '', description = '' } = {}) {
    if (!game.user.isGM) return;

    const pay = mode === 'pay';
    const actorEntries = ActorPickerDialog.buildActorPickerData().map((a) => ({ ...a, preselected: true }));
    const header = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/dialog/parts/payment-amount-input.hbs', {
      amount,
      description,
      text: _loc(pay ? 'MASTER.payText' : 'MASTER.getPaidText', { heros: _loc('MASTER.theGroup') }),
    });

    ActorPickerDialog.open({
      actors: actorEntries,
      title: pay ? 'PAYMENT.requestTitlePay' : 'PAYMENT.requestTitleGetPaid',
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
    GroupCheck.openDialog({ name, modifier });
  }

  static speakerAbilityRoll(name, type, options = {}) {
    const speaker = ChatMessage.getSpeaker();
    let actor = speaker.token ? game.actors.tokens[speaker.token] : null;
    if (!actor) actor = game.actors.get(speaker.actor);
    if (!actor) return ui.notifications.error('DSAError.noProperActor', { localize: true });

    ChatCommandService.executeAbilityRoll(actor, name, type, speaker.token, options);
  }
}
