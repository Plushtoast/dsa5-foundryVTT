import Actordsa5 from '../actor/actor-dsa5.js';
import CombatskillData from '../data/item/combatskill.js';
import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import Select2Dialog from './select2Dialog.js';

const { renderTemplate } = foundry.applications.handlebars;

export default class DialogReactDSA5 extends Select2Dialog {
  static async showDialog(startMessage) {
    const fun = this.callbackResult;
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

    const speaker = message.flags.unopposeData.targetSpeaker;
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

  static opposeOptions(message) {
    return {
      oppose: {
        startMessageId: message.id,
        attackMessageId: message.flags.unopposeData.attackMessageId,
      },
    };
  }
}

export class ReactToSkillDialog extends DialogReactDSA5 {
  static async getTemplate(startMessage) {
    const attackMessage = game.messages.get(startMessage.flags.unopposeData.attackMessageId);
    const source = attackMessage.flags.data.preData.source;
    const item = source.name;
    const items = (await DSA5_Utility.allSkillsList()).map((k) => {
      return { name: k, id: k };
    });
    items.unshift({
      name: _loc('doNothing'),
      id: 'doNothing',
    });
    return renderTemplate('systems/dsa5/templates/dialog/dialog-act.hbs', {
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
        actor.setupSkill(skill, DialogReactDSA5.opposeOptions(message), tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }
}

export class ActAttackDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static async showDialog(actor, tokenId) {
    new ActAttackDialog(actor, tokenId).render(true);
  }

  static DEFAULT_OPTIONS = {
    window: { title: 'attacktest' },
    position: {
      width: 550
    },
    actions: {
      reactClick: this._reactClick
    }
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/dialog-reaction-attack.hbs',
    },
  };

  constructor(actor, tokenId) {
    super();
    this.actor = actor;
    this.tokenId = tokenId;
  }

  static _reactClick(event, target) {
    this.callbackResult(target.dataset, this);
    this.close();
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const wrestle = _loc('LocalizedIDs.wrestle')
    const combatskills = this.actor.items.filter((x) => x.type == 'combatskill').map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), this.actor.system));
    const brawl = combatskills.find((x) => x.name == wrestle);
    data.items = [
      {
        name: _loc('attackWeaponless'),
        id: 'attackWeaponless',
        img: 'systems/dsa5/icons/categories/attack_weaponless.webp',
        value: brawl.system.attack.value,
      },
    ];

    const types = ['meleeweapon', 'rangeweapon'];
    const traitTypes = ['meleeAttack', 'rangeAttack'];

    for (const item of this.actor.items) {
      if (types.includes(item.type) && item.system.worn.value == true) {
        const preparedItem =
          item.type == 'meleeweapon'
            ? Actordsa5._prepareMeleeWeapon(item.toObject(), combatskills, this.actor)
            : Actordsa5._prepareRangeWeapon(item.toObject(), [], combatskills, this.actor);
        data.items.push({
          name: item.name,
          id: item.name,
          img: item.img,
          value: preparedItem.attack,
          item: preparedItem,
        });
        for (const [key, value] of Object.entries(preparedItem.subweapons || {})) {
          data.items.push({
            name: value.name,
            id: item.name,
            subweapon: key,
            img: item.img,
            value: value.attack,
            item: value,
          });
        }
      } else if (item.type == 'trait' && traitTypes.includes(item.system.traitType.value)) {
        data.items.push({
          name: item.name,
          id: item.name,
          img: item.img,
          value: item.system.at.value,
        });
      }
    }

    const hasMagicEntries = this.actor.items.some((x) => ['spell', 'liturgy'].includes(x.type));
    if (hasMagicEntries) {
      data.items.push({
        name: ActCastSpellDialog.getActionLabel(this.actor),
        id: 'castSpell',
        special: 'castSpell',
        img: 'systems/dsa5/icons/categories/ability_magical.webp',
      });
    }
    data.dieClass = 'die-mu'
    data.title = 'DIALOG.selectAction'
    return data;
  }

  callbackResult(dataset, dialog) {
    const actor = dialog.actor;
    const tokenId = dialog.tokenId;

    if ('castSpell' == dataset.special) {
      ActCastSpellDialog.showDialog(actor, tokenId);
    } else if ('attackWeaponless' == dataset.value) {
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
}

export class ActCastSpellDialog extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  static async showDialog(actor, tokenId) {
    new ActCastSpellDialog(actor, tokenId).render(true);
  }

  static getActionLabel(actor) {
    const spellLabel = _loc('TYPES.Item.spell');
    const liturgyLabel = _loc('TYPES.Item.liturgy');

    if (actor.system.isMage && actor.system.isPriest) return `${spellLabel}/${liturgyLabel}`;
    if (actor.system.isMage) return spellLabel;
    if (actor.system.isPriest) return liturgyLabel;
    return _loc('DIALOG.selectSupernaturalAction');
  }

  static prepareMagicSelectionEntry(item) {
    const entry = item.toObject();
    const preparedCastingTime = Number(entry.system.castingTime.modified) || Number(entry.system.castingTime.value) || 0;
    const castingProgress = Number(entry.system.castingTime.progress) || 0;
    const isOngoing = preparedCastingTime > 1 && castingProgress > 0;

    entry.progressLabel = isOngoing ? `${castingProgress}/${preparedCastingTime}` : '';
    entry.isOngoing = isOngoing;
    entry.ongoingClass = isOngoing ? 'emphasize2' : '';
    return entry;
  }

  static DEFAULT_OPTIONS = {
    window: { title: 'DIALOG.selectSupernaturalAction' },
    position: {
      width: 760,
      height: 'auto'
    },
    actions: {
      spellSelect: this._spellSelect
    }
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/dialog-act-spell-selection.hbs',
    },
  };

  constructor(actor, tokenId) {
    super();
    this.actor = actor;
    this.tokenId = tokenId;
  }

  static _spellSelect(event, target) {
    this.callbackResult(target.dataset, this);
    this.close();
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const spells = [];
    const liturgies = [];

    for (const item of this.actor.items) {
      if (item.type == 'spell') spells.push(this.constructor.prepareMagicSelectionEntry(item));
      else if (item.type == 'liturgy') liturgies.push(this.constructor.prepareMagicSelectionEntry(item));
    }

    spells.sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
    liturgies.sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));

    data.title = 'DIALOG.selectSupernaturalAction';
    data.spells = spells;
    data.liturgies = liturgies;
    data.hasSpells = spells.length > 0;
    data.hasLiturgies = liturgies.length > 0;
    data.emptyMessage = 'DIALOG.noSelection';
    return data;
  }

  callbackResult(dataset, dialog) {
    const item = dialog.actor.items.get(dataset.itemId);
    if (!item) return;

    dialog.actor.setupSpell(item, {}, dialog.tokenId).then((setupData) => {
      dialog.actor.basicTest(setupData);
    });
  }
}

export class ReactToAttackDialog extends ActAttackDialog {
  static async showDialog(startMessage) {
    new ReactToAttackDialog(startMessage).render(true);
  }

  constructor(startMessage) {
    super();
    this.startMessage = startMessage;
  }

  static DEFAULT_OPTIONS = {
    window: { title: 'Unopposed' },
  };

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

  async _prepareContext(_options) {
    const { actor, tokenId } = DialogReactDSA5.getTargetActor(this.startMessage);
    const attackActor = ReactToAttackDialog.getAttackActor(this.startMessage);
    const wrestle = _loc('LocalizedIDs.wrestle')
    const combatskills = actor.items.filter((x) => x.type == 'combatskill').map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), actor.system));
    const brawl = combatskills.find((x) => x.name == wrestle);
    const items = [
      {
        name: _loc('doNothing'),
        id: 'doNothing',
        img: 'systems/dsa5/icons/categories/disease.webp',
      },
      {
        name: _loc('dodge'),
        id: 'dodge',
        img: 'systems/dsa5/icons/categories/Dodge.webp',
        value: actor.system.status.dodge.max,
      },
      {
        name: _loc('parryWeaponless'),
        id: 'parryWeaponless',
        img: 'systems/dsa5/icons/categories/attack_weaponless.webp',
        value: brawl.system.parry.value,
      },
    ];

    let defenses = 0;
    let sizeNotification = '';
    if (actor) {
      const types = ['meleeweapon'];

      for (const x of actor.items) {
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
        const size = attackActor.actor.system.status.size.value;
        if (size == 'big') sizeNotification = 'DIALOGDESCRIPTION.bigEnemy';
        else if (size == 'giant') sizeNotification = 'DIALOGDESCRIPTION.giantEnemy';
      }

      if (game.combat)
        defenses = await game.combat.getDefenseCount({
          actor: actor.id,
          token: tokenId,
          scene: canvas.scene?.id,
        });
    }

    return {
      dieClass: 'die-in',
      items,
      defenses,
      title: 'DIALOG.selectReaction',
      sizeNotification
    };
  }

  callbackResult(dataset, dialog) {
    const text = dataset.value;
    const message = dialog.startMessage;
    const { actor, tokenId } = DialogReactDSA5.getTargetActor(message);

    if ('doNothing' == text) {
      OpposedDsa5.resolveUndefended(message);
    } else if ('dodge' == text) {
      actor.setupDodge(DialogReactDSA5.opposeOptions(message), tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else if ('parryWeaponless' == text) {
      actor.setupWeaponless('parry', DialogReactDSA5.opposeOptions(message), tokenId).then((setupData) => {
        actor.basicTest(setupData);
      });
    } else {
      const types = ['meleeweapon', 'trait'];
      const result = actor.items.find((x) => {
        return types.includes(x.type) && x.name == text;
      });
      if (result) {
        actor.setupWeapon(result, 'parry', DialogReactDSA5.opposeOptions(message), tokenId).then((setupData) => {
          actor.basicTest(setupData);
        });
      }
    }
  }
}
