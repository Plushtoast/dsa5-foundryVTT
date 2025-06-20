import { DefaultAppv2 } from '../actor/baseapp.js';
import DPS from '../system/automation/derepositioningsystem.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

export class AddTargetDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static DEFAULT_OPTIONS = {
    window: { title: 'DIALOG.addTarget' },
  };

  constructor(speaker) {
    super();
    this.speaker = speaker;
  }

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/addTarget-dialog.hbs',
    },
  };

  static async getDialog(speaker) {
    return new AddTargetDialog(speaker);
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const targets = Array.from(game.user.targets).map((x) => x.id);
    data.selectables = [];
    const token = canvas.scene?.tokens.get(this.speaker.token)?.object;
    if (game.combat) {
      game.combat.combatants.forEach((combatant) => {
        if (!combatant.visible) return;

        combatant.isSelected = targets.includes(combatant.token.id);
        if (token && combatant.token) {
          const combatantToken = canvas.scene.tokens.get(combatant.token.id).object;
          combatant.distance = DPS.rangeFinder(token, combatantToken);
          combatant.distance.distanceSum = Number(combatant.distance.distanceSum.toFixed(1));
        }
        data.selectables.push(combatant);
      });
    }
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    const combatants = html.find('.combatant');
    combatants.on('dblclick', (ev) => this.setTargets(ev, true));
    combatants.on('click', (ev) => this.setTargets(ev));
    combatants.on('pointerover', this._onCombatantHoverIn.bind(this)),
    combatants.on('pointerout', this._onCombatantHoverOut.bind(this));
    combatants.on('mousedown', (ev) => this._onRightClick(ev));
  }

  _onCombatantHoverOut(ev) {
    ui.combat._onCombatantHoverOut(ev);
  }

  _onCombatantHoverIn(ev) {
    ui.combat._onCombatantHoverIn(ev);
  }

  _onRightClick(ev) {
    if (ev.button == 2) {
      const combatant = game.combat.combatants.get(ev.currentTarget.dataset.combatantId);
      if (combatant.token) {
        return canvas.animatePan({
          x: combatant.token.x,
          y: combatant.token.y,
        });
      }
    }
  }

  async setTargets(ev, close = false) {
    const isShift = ev.originalEvent.shiftKey;
    if (!isShift) $(ev.currentTarget).closest('.directory').find('.combatant').removeClass('selectedTarget');

    $(ev.currentTarget).addClass('selectedTarget');
    const combatantId = ev.currentTarget.dataset.combatantId;
    const combatant = game.combat.combatants.get(combatantId);

    combatant.token.object.setTarget(true, {
      user: game.user,
      releaseOthers: !isShift,
      groupSelection: true,
    });

    if (close) this.close();
  }
}

export class SelectUserDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    window: {
      title: 'DIALOG.setTargetToUser',
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/selectForUserDialog.hbs',
    },
  };

  static async getDialog() {
    return new SelectUserDialog();
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.users = game.users.filter((x) => x.active && !x.isGM);
    return data;
  }

  static registerButtons() {
    Hooks.on('getSceneControlButtons', (btns) => {
      if (!game.user.isGM) return;

      const userSelect = {
        name: 'targetUser',
        title: 'CONTROLS.targetForUser',
        icon: 'fa fa-bullseye',
        button: true,
        order: 2,
        onChange: async () => {
          (await SelectUserDialog.getDialog()).render(true);
        },
      };
      btns.tokens.tools.targetUser = userSelect;
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('.combatant').on('click', (ev) => this.setTargetToUser(ev));
  }

  setTargetToUser(ev) {
    const targetIds = Array.from(game.user.targets).map((x) => x.id);
    const userId = ev.currentTarget.dataset.userId;
    const user = game.users.get(userId);
    user._onUpdateTokenTargets(targetIds);
    game.socket.emit('userActivity', userId, { targets: targetIds });
    this.close();
  }
}

export class UserMultipickDialog extends foundry.applications.api.DialogV2 {
  static async getDialog(content) {
    const users = game.users.filter((x) => x.active && !x.isGM);

    new UserMultipickDialog({
      window: {
        title: 'SHEET.PostItem',
      },
      content: await renderTemplate('systems/dsa5/templates/dialog/usermultipickdialog.hbs', { users }),
      buttons: [
        {
          action: 'done',
          icon: 'fa fa-check',
          label: 'yes',
          default: true,
          callback: (event, button, dialog) => {
            this.postContent(button.form.elements, content);
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  static async postContent(dlg, content) {
    const chatOptions = DSA5_Utility.chatDataSetup(content);
    if (!dlg.sel_all.checked) {
      const ids = [];
      for (let key of Object.keys(dlg)) {
        if (dlg[key].checked && key != 'sel_all') ids.push(dlg[key].value);
      }
      chatOptions.whisper = ids;
    }

    ChatMessage.create(chatOptions);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    html.find('[name="sel_all"]').on('change', (ev) => {
      html.find('.usersel').prop('disabled', ev.currentTarget.checked).prop('checked', ev.currentTarget.checked);
    });
  }
}
