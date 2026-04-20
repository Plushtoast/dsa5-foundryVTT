import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

export default class DSA5Combat extends Combat {
  constructor(data, context) {
    if (!data) data = {};
    if (!data.type) data.type = 'dsacombat';
    super(data, context);
  }

  async refreshTokenbars() {
    if (game.dsa5.apps.tokenHotbar) game.dsa5.apps.tokenHotbar.updateDSA5Hotbar(undefined, true);
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

  /** @inheritDoc */
  _onUpdate(changed, options, userId) {
    super._onUpdate(changed, options, userId);
    this.refreshTokenbars();
  }

  async brawlingDialog() {
    return await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'BRAWLING.unarmEveryone',
      },
      content: `<p>${_loc('BRAWLING.unarmEveryoneText')}</p>`,
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

      for (const x of this.combatants) {
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
      for (const x of this.combatants) {
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
      for (const k of this.turns) {
        await k.update({ 'system.defenseCount': 0, 'system.roundInitiative': -1, 'system.actionsUsed': 0, 'system.freeActionUsed': false, 'system.movementActionConsumed': false });
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

  async updateActionCount(speaker, cost = 1) {
    if (game.user.isGM) {
      const comb = this.getCombatantFromActor(speaker);
      if (comb) {
        await comb.update({ 'system.actionsUsed': (comb.system.actionsUsed || 0) + cost });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'updateActionCount',
        payload: { speaker, cost },
      });
    }
  }

  async toggleFreeAction(speaker) {
    if (game.user.isGM) {
      const comb = this.getCombatantFromActor(speaker);
      if (comb) {
        await comb.update({ 'system.freeActionUsed': !comb.system.freeActionUsed });
      }
    } else {
      await game.socket.emit('system.dsa5', {
        type: 'toggleFreeAction',
        payload: { speaker },
      });
    }
  }

  async handleMovementCost(tokenDoc) {
    const combatant = this.combatants.find(c => c.tokenId === tokenDoc.id);
    if (!combatant) return;

    const tokenObj = tokenDoc.object;
    let distance = 0;
    if (tokenObj && tokenDoc.movementHistory?.length) {
      try {
        distance = tokenObj.measureMovementPath(tokenDoc.movementHistory).distance;
      } catch { return; }
    }
    if (distance <= 0) return;

    const updates = {};

    // Any movement consumes the free action
    if (!combatant.system.freeActionUsed) {
      updates['system.freeActionUsed'] = true;
    }

    // Movement beyond GS additionally consumes one base action
    const speed = combatant.actor?.speedByMovementType?.('walk') || 0;
    if (speed > 0 && distance > speed && !combatant.system.movementActionConsumed) {
      updates['system.actionsUsed'] = (combatant.system.actionsUsed || 0) + 1;
      updates['system.movementActionConsumed'] = true;
    }

    if (Object.keys(updates).length) {
      if (game.user.isGM) {
        await combatant.update(updates);
      } else {
        await game.socket.emit('system.dsa5', {
          type: 'handleMovementCost',
          payload: { tokenId: tokenDoc.id },
        });
      }
    }
  }
}