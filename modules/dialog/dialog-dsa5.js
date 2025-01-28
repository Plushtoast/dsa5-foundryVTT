import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5CombatDialog from './dialog-combat-dsa5.js';
import DialogShared from './dialog-shared.js';
import DSA5SkillDialog from './dialog-skill-dsa5.js';
import DSA5SpellDialog from './dialog-spell-dsa5.js';

export default class DSA5Dialog extends DialogShared {
  static getDialogForItem(testData, renderData) {
    const actor = DSA5_Utility.getSpeaker(testData.extra.speaker);
    const type = testData.source.type;
    switch (type) {
      case 'rangeweapon':
      case 'meleeweapon':
      case 'dodge':
      case 'trait':
        renderData.rollModifiers = DSA5CombatDialog.setData(actor, type, testData, renderData);
        return DSA5CombatDialog;
      case 'spell':
      case 'ritual':
      case 'liturgy':
      case 'ceremony':
        renderData.rollModifiers = DSA5SpellDialog.setData(actor, type, renderData);
        return DSA5SpellDialog;
      case 'skill':
        return DSA5SkillDialog;
    }
    return DSA5Dialog;
  }

  static getRollButtons(testData, dialogOptions, resolve, reject) {
    const buttons = [
      {
        action: 'rollButton',
        label: 'Roll',
        callback: (event, button, dialog) => {
          const html = $(button.form)
          game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html);
          resolve(dialogOptions.callback(html));
        },
      }
    ];
    if (game.user.isGM) {
      buttons.push({
        action: 'cheat',
        label: 'DIALOG.cheat',
        callback: (event, button, dialog) => {
          const html = $(button.form)
          game.dsa5.memory.remember(testData.extra.speaker, testData.source, testData.mode, html);
          resolve(dialogOptions.callback(html, { cheat: true }));
        },        
      });
    }
    return buttons;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)
    html.find('.dieButton').on('click', (ev) => {
      let elem = $(ev.currentTarget);
      if (ev.currentTarget.dataset.single == 'true') {
        elem.closest('.dialog-content').find('.dieButton').removeClass('dieSelected');
      }
      elem.toggleClass('dieSelected');
    });
  }

  static DEFAULT_OPTIONS = {
    window: {
        resizable: true,
    },
  };
}
