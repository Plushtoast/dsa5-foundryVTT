import Actordsa5 from '../actor/actor-dsa5.js';
import { ActAttackDialog } from '../dialog/dialog-react.js';
import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import RuleChaos from '../system/rule_chaos.js';
const { getProperty, mergeObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export class DSA5CombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/system/combattracker/header.hbs',
    },
    tracker: {
      template: 'systems/dsa5/templates/system/combattracker/combattracker.hbs',
    },
    footer: {
      template: 'templates/sidebar/tabs/combat/footer.hbs',
    },
  };

  static DEFAULT_OPTIONS = {
    actions: {
      convertToBrawl: this._convertToBrawl,
      aggroButton: this._onAggroButtonClicked,
    },
  };

  static _onAggroButtonClicked() {
    DSA5CombatTracker.runActAttackDialog();
  }

  static _convertToBrawl() {
    game.combat.convertToBrawl();
  }

  static runActAttackDialog() {
    if (!game.combat) return;

    const combatant = game.combat.combatant;
    if (game.user.isGM || combatant.isOwner) ActAttackDialog.showDialog(combatant.actor, combatant.tokenId);
  }

  async _prepareTurnContext(combat, combatant, index) {
    const turn = await super._prepareTurnContext(combat, combatant, index);
    const isAllowedToSeeEffects = game.user.isGM || (combatant.actor && combatant.actor.testUserPermission(game.user, 'OBSERVER')) || !game.settings.get('dsa5', 'hideEffects');
    turn.defenseCount = combatant.system.defenseCount;
    turn.actionCount = Number(getProperty(combatant, 'actor.system.actionCount.value')) || 0;
    turn.actionCounts = `${turn.actionCount} ${game.i18n.localize('actionCount')}`;
    turn.roundInitiative = combatant.system.roundInitiative;

    let remainders = [];
    if (combatant.actor) {
      for (const x of combatant.actor.items) {
        if (x.type == 'rangeweapon' && x.system.worn.value && x.system.reloadTime.progress > 0) {
          const wpn = {
            name: x.name,
            remaining: Actordsa5.calcLZ(x, combatant.actor) - x.system.reloadTime.progress,
          };
          if (wpn.remaining > 0) remainders.push(wpn);
        } else if (['spell', 'liturgy'].includes(x.type) && x.system.castingTime.modified > 0) {
          const wpn = {
            name: x.name,
            remaining: x.system.castingTime.modified - x.system.castingTime.progress,
          };
          if (wpn.remaining > 0) remainders.push(wpn);
        }
      }
    }
    remainders = remainders.sort((a, b) => a.remaining - b.remaining);

    if (remainders.length > 0) {
      turn.ongoings = `${game.i18n.localize('COMBATTRACKER.ongoing')}<br>${remainders.map((x) => `${x.name} - ${x.remaining}`).join('<br>')}`;

      turn.ongoing = remainders[0].remaining;
    }
    const effects = [];
    for (const e of combatant.actor?.temporaryEffects || []) {
      if (e.statuses.has('defeated')) turn.defeated = true;
      else if (e.img && isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.getFlag('dsa5', 'hidePlayers')) && !e.getFlag('dsa5', 'hideOnToken')) {
        effects.push({ img: e.img, name: e.name });
      }
    }
    turn.effects = {
      icons: effects,
      tooltip: this._formatEffectsTooltip(effects),
    };

    return turn;
  }

  async _prepareCombatContext(context, options) {
    await super._prepareCombatContext(context, options);
    context.isBrawling = game.combat?.isBrawling;
  }

  _canSortInitiative(event) {
    return game.user.isGM;
  }

  _dragStartInitiativeSort(event) {
    const dataTransfer = {
      type: 'CombatantSort',
      data: {
        combatantId: event.currentTarget.dataset.combatantId,
      },
    };
    event.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
  }

  _dragOverInitiativeSort(event) {
    event.preventDefault();
    const fieldset = event.target.closest('.combatant');

    if (fieldset) {
      if (this.lastFieldset !== fieldset) {
        if (this.lastFieldset) {
          this.lastFieldset.classList.remove('dragSortMarker');
        }
        fieldset.classList.add('dragSortMarker');
        this.lastFieldset = fieldset;
      }
    } else if (this.lastFieldset) {
      this.lastFieldset.classList.remove('dragSortMarker');
      this.lastFieldset = null;
    }
  }

  async _dropInitiativeSort(event) {
    event.preventDefault();
    if (this.lastFieldset) {
      this.lastFieldset.classList.remove('dragSortMarker');
      this.lastFieldset = null;
    }

    const hoverTarget = event.target.closest('.combatant');
    if (!hoverTarget) return;

    const data = JSON.parse(event.dataTransfer.getData('text/plain'));

    if (data.type !== 'CombatantSort') return;

    const combatantId = data.data.combatantId;
    const targetId = hoverTarget.dataset.combatantId;

    if (targetId === combatantId) return;

    const combatant = game.combat.combatants.get(combatantId);
    const targetCombatant = game.combat.combatants.get(targetId);

    const roundInitiative = targetCombatant.properInitiative;
    await combatant.update({
      "system.roundInitiative": roundInitiative + 0.00001,
    });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: ".combatant",
      dropSelector: ".combat-tracker",
      permissions: {
        dragstart: this._canSortInitiative.bind(this),
        drop: this._canSortInitiative.bind(this)
      },
      callbacks: {
        dragstart: this._dragStartInitiativeSort.bind(this),
        dragover: this._dragOverInitiativeSort.bind(this),
        drop: this._dropInitiativeSort.bind(this)
      }
    }).bind(this.element);
    return super._onRender(context, options);
  }
}

export class DSA5Combat extends Combat {
  constructor(data, context) {
    if (!data) data = {};
    if (!data.type) data.type = 'dsacombat';
    super(data, context);
  }

  async refreshTokenbars() {
    if (game.dsa5.apps.tokenHotbar) game.dsa5.apps.tokenHotbar.updateDSA5Hotbar();
  }

  get isBrawling() {
    return this.system.isBrawling;
  }

  _onCreate(data, options, userId) {
    super._onCreate(data, options, userId);
    this.refreshTokenbars();
  }

  _onDelete(options, userId) {
    super._onDelete(options, userId);
    this.refreshTokenbars();
  }

  async brawlingDialog() {
    return await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'BRAWLING.unarmEveryone',
      },
      content: `<p>${game.i18n.localize('BRAWLING.unarmEveryoneText')}</p>`,
      rejectClose: false,
      modal: true,
    });
  }

  async convertToBrawl(force = undefined) {
    const goBrawling = force ?? !this.isBrawling;

    const actorUpdates = [];
    const tokenUpdates = [];
    const chatMessages = [];

    if (goBrawling) {
      const unarmEveryone = await this.brawlingDialog();
      if (unarmEveryone === null) return;

      await this.update({ 'system.unarmEveryone': unarmEveryone })

      for (let x of this.combatants) {
        if (!x.actor) return {};

        const change = await x.brawlingChange();

        if (x.actor.isToken) {
          await x.actor.update(change.actorChange);
        } else {
          actorUpdates.push(change.actorChange);
        }

        tokenUpdates.push(...change.tokenChange);
        DSA5Combat.brawlStart();
      }
    } else {
      for (let x of this.combatants) {
        if (!x.actor) return {};

        const change = await x.undoBrawlingChange();
        if (x.actor.isToken) {
          await x.actor.update(change.actorChange);
        } else {
          actorUpdates.push(change.actorChange);
        }

        tokenUpdates.push(...change.tokenChange);
        if (change.damage.brawlDamage > 0) {
          chatMessages.push({
            name: x.token.name,
            id: x.token.id,
            data: change.damage,
          });
        }
      }
    }

    await Actordsa5.updateDocuments(actorUpdates);
    await game.canvas.scene.updateEmbeddedDocuments('Token', tokenUpdates);
    await this.update({ 'system.isBrawling': goBrawling });

    if (chatMessages.length) {
      await this.showBrawlingDamage(chatMessages);
    }
  }

  async showBrawlingDamage(messages) {
    const template = await renderTemplate('systems/dsa5/templates/chat/brawling-damage.hbs', { messages });
    ChatMessage.create(DSA5_Utility.chatDataSetup(template));
  }

  static async brawlStart(timeout = 2000, broadcast = true) {
    if (broadcast && DSA5_Utility.isActiveGM()) {
      await game.socket.emit('system.dsa5', {
        type: 'brawlStart',
        payload: {},
      });
    }

    $('.bumFight').remove();
    const brawlAnim = await renderTemplate('systems/dsa5/templates/system/bumFight/animation.hbs', {});
    $('body').append(brawlAnim);

    const bum = $('.bumFight');
    bum.on('click', () => bum.remove());
    bum.addClass('fight');
    setTimeout(function () {
      bum.fadeOut(1000, () => bum.remove());
    }, timeout);
  }

  async clearRoundState() {
    if (game.user.isGM) {
      for (let k of this.turns) {
        await k.update({ 'system.defenseCount': 0, "system.roundInitiative": -1 });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'clearCombat',
        payload: {},
      });
    }
  }

  _sortCombatants(a, b) {
    let ia = Number.isNumeric(a.initiative) ? a.initiative : -Infinity;
    let ib = Number.isNumeric(b.initiative) ? b.initiative : -Infinity;

    if (a.system.roundInitiative >= 0) ia = a.system.roundInitiative;
    if (b.system.roundInitiative >= 0) ib = b.system.roundInitiative

    return (ib - ia) || (a.id > b.id ? 1 : -1);
  }

  async previousRound() {
    await this.clearRoundState();
    return await super.previousRound();
  }

  async nextRound() {
    await this.clearRoundState();
    return await super.nextRound();
  }

  async getDefenseCount(speaker) {
    const comb = this.getCombatantFromActor(speaker);
    return comb?.system.defenseCount
  }

  getCombatantFromActor(speaker) {
    if (!speaker) return undefined;

    if (speaker.token) {
      return this.combatants.find(combatant => combatant.tokenId === speaker.token);
    } else if (speaker.actor) {
      return this.combatants.find(combatant => combatant.actorId === speaker.actor);
    }

    return undefined;
  }

  async updateDefenseCount(speaker) {
    if (game.user.isGM) {
      const comb = this.getCombatantFromActor(speaker);
      if (comb && !comb.actor.system.config.defense) {
        await comb.update({ 'system.defenseCount': comb.system.defenseCount + 1 });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'updateDefenseCount',
        payload: {
          speaker,
        },
      });
    }
  }
}

export class DSA5Combatant extends Combatant {
  constructor(data, context) {
    if (!data.type) data.type = 'dsacombatant';
    super(data, context);
  }

  brawlingChange() {
    const actor = DSA5_Utility.getSpeaker({
      actor: this.actor.id,
      scene: this.sceneId,
      token: this.token.id,
    });
    const unarm = this.combat.system.unarmEveryone;
    const tokenChange = actor.system.config.autoBar
      ? actor.getActiveTokens().map((x) => {
        return { _id: x.id, bar1: { attribute: 'status.temporaryLeP' } };
      })
      : [];
    const actorChange = {
      _id: actor.id,
      system: {
        status: {
          temporaryLeP: {
            value: actor.system.status.wounds.value,
            max: actor.system.status.wounds.value,
          },
        },
      },
    };

    if (unarm) {
      const items = this.actor.items.filter((x) => x.type == 'meleeweapon' && x.system.worn.value && !RuleChaos.improvisedWeapon.test(x.name));
      if (items.length) {
        actorChange.items = items.map((x) => {
          return { _id: x.id, 'system.worn.value': false };
        });
      }
    }

    return { tokenChange, actorChange };
  }

  async getBrawlingTable() {
    if (!this.brawlingTable) {
      const pack = game.packs.get(game.i18n.lang == 'de' ? 'dsa5.patzer' : 'dsa5.botch');
      const table = (
        await pack.getDocuments({
          name__in: [game.i18n.lang == 'de' ? 'Prügelei - Verletzungen' : 'Brawling - Injuries'],
        })
      )[0];
      this.brawlingTable = table;
    }

    return this.brawlingTable;
  }

  get properInitiative() {
    return this.system.roundInitiative >= 0 ? this.system.roundInitiative : this.initiative;
  }

  async undoBrawlingChange() {
    const actor = DSA5_Utility.getSpeaker({
      actor: this.actor.id,
      scene: this.sceneId,
      token: this.token.id,
    });
    const tokenChange = actor.system.config.autoBar
      ? actor.getActiveTokens().map((x) => {
        return { _id: x.id, bar1: { attribute: 'status.wounds' } };
      })
      : [];
    const lostLP = Math.max(0, actor.system.status.temporaryLeP.max - actor.system.status.temporaryLeP.value);
    let brawlDamage = 0;

    let result;
    if (lostLP > 0) {
      result = await (await this.getBrawlingTable()).draw({ displayChat: false });
      result = result.results[0];
      const multiplier = result.getFlag('dsa5', 'brawlDamage');
      brawlDamage = Math.round(lostLP * multiplier);
    }

    const actorChange = {
      _id: actor.id,
      system: {
        status: {
          temporaryLeP: {
            value: 0,
            max: 0,
          },
          wounds: {
            value: actor.system.status.wounds.value - brawlDamage,
          },
        },
      },
    };

    return { tokenChange, actorChange, damage: { brawlDamage, result } };
  }

  async recalcInitiative() {
    if (this.initiative) {
      const roll = (await this.getFlag('dsa5', 'baseRoll')) || 0;
      const update = {
        initiative: roll + this.actor.system.status.initiative.value,
      };
      await this.update(update);
    }
  }
}

Hooks.on('preCreateCombatant', (data, options, user) => {
  const actor = DSA5_Utility.getSpeaker({
    actor: data.actorId,
    scene: data.sceneId,
    token: data.tokenId,
  });
  if (actor.system.merchant.merchantType == 'loot') return false;

  if (data.combat.isBrawling) {
    const conf = data.brawlingChange();
    delete conf.actorChange._id;
    actor.update(conf.actorChange).then(() => {
      game.canvas.scene.updateEmbeddedDocuments('Token', conf.tokenChange);
    });
  }
});

Hooks.on('deleteCombatant', (data, options, user) => {
  const actor = DSA5_Utility.getSpeaker({
    actor: data.actorId,
    scene: data.sceneId,
    token: data.tokenId,
  });
  if (actor.system.merchant.merchantType == 'loot') return false;

  if (data.combat.isBrawling) {
    data.undoBrawlingChange().then(async (conf) => {
      if (!data.token) return;

      delete conf.actorChange._id;
      await actor.update(conf.actorChange);
      await game.canvas.scene.updateEmbeddedDocuments('Token', conf.tokenChange);
      if (conf.damage.brawlDamage > 0) {
        data.combat.showBrawlingDamage([{ name: data.token.name, id: data.token.id, data: conf.damage }]);
      }
    });
  }
});

Hooks.on('preDeleteCombat', (combat, options, user) => {
  if (options.noHook) return;

  if (combat.isBrawling) {
    combat.convertToBrawl(false).then(() => {
      combat.delete({ noHook: true });
    });
    return false;
  }
});

Hooks.on('updateCombatant', (combatant, change, user) => {
  if (!game.user.isGM) return;

  if (change.initiative) {
    const baseRoll = combatant.getFlag('dsa5', 'baseRoll');
    if (!baseRoll) {
      const parts = `${change.initiative}`.split('.');
      const roll = Number(parts[0]) - Math.round(combatant.actor.system.status.initiative.value);
      combatant.setFlag('dsa5', 'baseRoll', roll);
    }
  } else if ('initiative' in change && change.initiative == null) {
    combatant.update({ [`flags.dsa5.-=baseRoll`]: null });
  }
});

class RepeatingEffectsHelper {
  static async updateCombatHook(combat, updateData, x, y) {
    if (!updateData.round && !updateData.turn) return;

    if (combat.round != 0 && combat.turns && combat.active) {
      if (combat.previous.round < combat.current.round) await RepeatingEffectsHelper.startOfRound(combat);
    }
  }

  static async startOfRound(combat) {
    if (!DSA5_Utility.isActiveGM()) return;

    for (let turn of combat.turns) {
      if (!turn.defeated) {
        if (turn.actor?.statuses.has('bleeding')) await this.applyBleeding(turn, combat);
        if (turn.actor?.system.condition.burning) await this.applyBurning(turn, combat);

        await this.startOfRoundEffects(turn, combat);
      }
    }
  }

  static async startOfRoundEffects(turn, combat) {
    const regenerationAttributes = ['wounds', 'astralenergy', 'karmaenergy'];
    for (const attr of regenerationAttributes) {
      if (getProperty(turn.actor?.system.repeatingEffects, `disabled.${attr}`)) continue;

      const effectvalues = turn.actor.system.repeatingEffects.startOfRound[attr].map((x) => x.value).join('+');

      if (!effectvalues) continue;

      const damageRoll = await new Roll(effectvalues).evaluate();
      const damage = await damageRoll.render();
      const type = game.i18n.localize(damageRoll.total > 0 ? 'CHATNOTIFICATION.regenerates' : 'CHATNOTIFICATION.getsHurt');
      const applyDamage = `${this.buildActorName(turn)} ${type} ${game.i18n.localize(attr)} ${damage}`;

      await this.sendEventMessage(applyDamage, combat, turn);
      if (attr == 'wounds') await turn.actor.applyDamage(damageRoll.total * -1);
      else await turn.actor.applyMana(damageRoll.total * -1, attr == 'astralenergy' ? 'AsP' : 'KaP');
    }
  }

  static async applyBleeding(turn, combat) {
    if (turn.actor.system.status.wounds.value < 1) return;

    const msg = game.i18n.format('CHATNOTIFICATION.bleeding', {
      actor: this.buildActorName(turn),
    });
    await this.sendEventMessage(msg, combat, turn);
    await turn.actor.applyDamage(1);
  }

  static async applyBurning(turn, combat) {
    if (turn.actor?.system.status.wounds.value < 1) return;

    const step = turn.actor?.system.condition.burning;
    const protection = DSA5StatusEffects.resistantToEffect(turn.actor, 'burning');
    const die = { 0: '1', 1: '1d3', 2: '1d6', 3: '2d6' }[step - protection] || '1';
    const damageRoll = await new Roll(die).evaluate();
    const damage = await damageRoll.render();
    const msg = game.i18n.format(`CHATNOTIFICATION.burning.${step}`, {
      actor: this.buildActorName(turn),
      damage,
    });

    await this.sendEventMessage(msg, combat, turn);
    await turn.actor.applyDamage(damageRoll.total);
  }

  static buildActorName(turn) {
    let name = turn.token.name;
    if (game.settings.get('dsa5', 'hideRegenerationToOwner')) {
      if (turn.token.name != turn.token.actor.name) name += ` (${turn.token.actor.name})`;
    }
    return turn.token.actor.toAnchor({ name }).outerHTML;
  }

  static async sendEventMessage(content, combat, turn) {
    if (game.settings.get('dsa5', 'hideRegenerationToOwner')) {
      const recipients = combat.combatants.get(turn.id).players;
      recipients.push(...game.users.filter((x) => x.isGM).map((x) => x.id));
      const chatData = DSA5_Utility.chatDataSetup(content, undefined, undefined, recipients);
      delete chatData.speaker;
      await ChatMessage.create(chatData);
    } else {
      await ChatMessage.create(DSA5_Utility.chatDataSetup(content));
    }
  }
}

Hooks.on('updateCombat', RepeatingEffectsHelper.updateCombatHook);
