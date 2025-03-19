import Actordsa5 from '../actor/actor-dsa5.js';
import CombatskillData from '../data/item/combatskill.js';
import OpposedDsa5 from '../system/opposed-dsa5.js';
import DSA5_Utility from '../system/utility-dsa5.js';
import Select2Dialog from './select2Dialog.js';
const { getProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class DialogReactDSA5 extends Select2Dialog {
  static async showDialog(startMessage) {
    let fun = this.callbackResult;
    new DialogReactDSA5({
      window: { title: 'Unopposed' },
      content: await this.getTemplate(startMessage),
      buttons: [
        {
          action: 'ok',
          icon: "fa fa-check",
          label: 'ok',
          callback: (event, button, dialog) => {
            fun($(button.form).find('[name="entryselection"]').val(), startMessage);
          },
        },
        {
          action: 'cancel',
          icon: "fas fa-times",
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  static getTargetActor(message) {
    if (!canvas.tokens) return {};

    let speaker = message.flags.unopposeData.targetSpeaker;
    const actor = DSA5_Utility.getSpeaker(speaker);

    if (!actor) {
      ui.notifications.error('DSAError.noProperActor', { localize: true });
      return {};
    }
    return {
      actor,
      tokenId: speaker.token,
    };
  }

  static async getTemplate(startMessage) {
    return '';
  }

  static callbackResult(selection, message, ev) {}
}

export class ReactToSkillDialog extends DialogReactDSA5 {
  static async getTemplate(startMessage) {
    const attackMessage = game.messages.get(startMessage.flags.unopposeData.attackMessageId);
    const source = attackMessage.flags.data.preData.source;
    const item = source.name;
    let items = (await DSA5_Utility.allSkillsList()).map((k) => {
      return { name: k, id: k };
    });
    items.unshift({
      name: game.i18n.localize('doNothing'),
      id: 'doNothing',
    });
    return renderTemplate('systems/dsa5/templates/dialog/dialog-act.html', {
      items,
      original: item,
      title: 'DIALOG.selectReaction',
    });
  }

  static callbackResult(text, message) {
    const { actor, tokenId } = DialogReactDSA5.getTargetActor(message);
    if ('doNothing' == text) {
      OpposedDsa5.resolveUndefended(message);
    } else {
      const skill = actor.items.find((i) => i.name == text && i.type == 'skill');
      if (skill) {
        actor.setupSkill(skill, {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }
}

export class ActAttackDialog extends foundry.applications.api.DialogV2 {
  static async showDialog(actor, tokenId) {
    const dialog = new ActAttackDialog({
      window: { title: 'attacktest' },
      content: await this.getTemplate(actor),
      buttons: [],
    });
    dialog.actor = actor;
    dialog.tokenId = tokenId;
    dialog.render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)
    html.find('.reactClick').on('click', (ev) => {
      this.callbackResult(ev.currentTarget.dataset, this.actor, this.tokenId);
      this.close();
    });
  }

  static async getTemplate(actor) {
    const combatskills = actor.items.filter((x) => x.type == 'combatskill').map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), actor.system));
    const brawl = combatskills.find((x) => x.name == game.i18n.localize('LocalizedIDs.wrestle'));
    let items = [
      {
        name: game.i18n.localize('attackWeaponless'),
        id: 'attackWeaponless',
        img: 'systems/dsa5/icons/categories/attack_weaponless.webp',
        value: brawl.system.attack.value,
      },
    ];

    const types = ['meleeweapon', 'rangeweapon'];
    const traitTypes = ['meleeAttack', 'rangeAttack'];

    for (let item of actor.items) {
      if (types.includes(item.type) && item.system.worn.value == true) {
        const preparedItem =
          item.type == 'meleeweapon'
            ? Actordsa5._prepareMeleeWeapon(item.toObject(), combatskills, actor)
            : Actordsa5._prepareRangeWeapon(item.toObject(), [], combatskills, actor);
        items.push({
          name: item.name,
          id: item.name,
          img: item.img,
          value: preparedItem.attack,
          item: preparedItem,
        });
        for (let [key, value] of Object.entries(preparedItem.subweapons || {})) {
          items.push({
            name: value.name,
            id: item.name,
            subweapon: key,
            img: item.img,
            value: value.attack,
            item: value,
          });
        }
      } else if (item.type == 'trait' && traitTypes.includes(item.system.traitType.value)) {
        items.push({
          name: item.name,
          id: item.name,
          img: item.img,
          value: item.system.at.value,
        });
      }
    }
    return await renderTemplate('systems/dsa5/templates/dialog/dialog-reaction-attack.html', { dieClass: 'die-mu', items, title: 'DIALOG.selectAction' });
  }

  callbackResult(dataset, actor, tokenId) {
    if ('attackWeaponless' == dataset.value) {
      actor.setupWeaponless('attack', {}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else {
      const types = ['meleeweapon', 'trait', 'rangeweapon'];
      let result = actor.items.find((x) => {
        return types.includes(x.type) && x.name == dataset.value;
      });
      if (dataset.subweapon) {
        result = Actordsa5.buildSubweapon(result, dataset.subweapon);
      }
      if (result) {
        actor.setupWeapon(result, 'attack', {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }

  static DEFAULT_OPTIONS = {
    position: {
        width: 550
    },
  };
}

export class ReactToAttackDialog extends DialogReactDSA5 {
  static async showDialog(startMessage) {
    const dialog = new ReactToAttackDialog({
      window: { title: 'Unopposed' },
      content: await this.getTemplate(startMessage),
      buttons: [],
    });
    dialog.startMessage = startMessage;
    dialog.render(true);
  }

  static getAttackActor(message) {
    if (!canvas.tokens) return {};

    const speakerMessage = message.flags.unopposeData.attackMessageId;
    const attackmessage = game.messages.get(speakerMessage);

    const speaker = attackmessage.flags.data.preData.extra.speaker;
    let actor = DSA5_Utility.getSpeaker(speaker);
    if(!actor) actor = OpposedDsa5.rebuildEmptyActor(attackmessage);

    if (!actor) {
      ui.notifications.error('DSAError.noProperActor', { localize: true });
      return {};
    }
    return {
      actor,
      tokenId: speaker.token,
    };
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)
    html.find('.reactClick').on('click', (ev) => {
      this.callbackResult(ev.currentTarget.dataset.value, this.startMessage);
      this.close();
    });
  }


  static DEFAULT_OPTIONS = {
    position: {
        width: 550
    },
  };

  static async getTemplate(startMessage) {
    const { actor, tokenId } = DialogReactDSA5.getTargetActor(startMessage);
    const attackActor = ReactToAttackDialog.getAttackActor(startMessage);
    const combatskills = actor.items.filter((x) => x.type == 'combatskill').map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), actor.system));
    const brawl = combatskills.find((x) => x.name == game.i18n.localize('LocalizedIDs.wrestle'));
    let items = [
      {
        name: game.i18n.localize('doNothing'),
        id: 'doNothing',
        img: 'systems/dsa5/icons/categories/disease.webp',
      },
      {
        name: game.i18n.localize('dodge'),
        id: 'dodge',
        img: 'systems/dsa5/icons/categories/Dodge.webp',
        value: actor.system.status.dodge.max,
      },
      {
        name: game.i18n.localize('parryWeaponless'),
        id: 'parryWeaponless',
        img: 'systems/dsa5/icons/categories/attack_weaponless.webp',
        value: brawl.system.parry.value,
      },
    ];

    let defenses = 0;
    let sizeNotification = '';
    if (actor) {
      let types = ['meleeweapon'];

      for (let x of actor.items) {
        if (types.includes(x.type) && x.system.worn.value == true) {
          const preparedItem = Actordsa5._prepareMeleeWeapon(x.toObject(), combatskills, actor);
          items.push({
            name: x.name,
            id: x.name,
            img: x.img,
            value: preparedItem.parry,
          });
        } else if (x.type == 'trait' && Number(x.system.pa) > 0) {
          items.push({
            name: x.name,
            id: x.name,
            img: x.img,
            value: x.system.pa,
          });
        }
      }

      if (attackActor) {
        const size = getProperty(attackActor.actor.system, 'status.size.value');
        if (size == 'big') sizeNotification = 'DIALOGDESCRIPTION.bigEnemy';
        else if (size == 'giant') sizeNotification = 'DIALOGDESCRIPTION.giantEnemy';
      }

      if (game.combat)
        defenses = await game.combat.getDefenseCount({
          actor: actor.id,
          token: tokenId,
          scene: canvas.scene ? canvas.scene.id : null,
        });
    }

    return await renderTemplate('systems/dsa5/templates/dialog/dialog-reaction-attack.html', {
      dieClass: 'die-in',
      items: items,
      defenses,
      title: 'DIALOG.selectReaction',
      sizeNotification,
    });
  }

  callbackResult(text, message) {
    const { actor, tokenId } = DialogReactDSA5.getTargetActor(message);

    if ('doNothing' == text) {
      OpposedDsa5.resolveUndefended(message);
    } else if ('dodge' == text) {
      actor.setupDodge({}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else if ('parryWeaponless' == text) {
      actor.setupWeaponless('parry', {}, tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else {
      const types = ['meleeweapon', 'trait'];
      const result = actor.items.find((x) => {
        return types.includes(x.type) && x.name == text;
      });
      if (result) {
        actor.setupWeapon(result, 'parry', {}, tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }
}
