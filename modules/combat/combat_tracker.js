import Actordsa5 from '../actor/actor-dsa5.js';
import { ActAttackDialog } from '../dialog/dialog-react.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import { dispositionBackgroundStyle, dispositionBorderStyle } from '../system/helpers/token_disposition.js';
import NavalCombat from './mkr/naval-combat.js';
import NavalCombatDamage from './mkr/naval-combat-damage.js';
import NavalChase from './mkr/naval-chase.js';

const { getProperty } = foundry.utils;

export class DSA5CombatTracker extends foundry.applications.sidebar.tabs.CombatTracker {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/system/combattracker/header.hbs',
      templates: ['systems/dsa5/templates/system/combattracker/mkr-bar.hbs'],
    },
    tracker: {
      template: 'systems/dsa5/templates/system/combattracker/combattracker.hbs',
    },
    footer: {
      template: 'systems/dsa5/templates/system/combattracker/footer.hbs',
    },
  };

  static DEFAULT_OPTIONS = {
    actions: {
      convertToBrawl: this._convertToBrawl,
      nextMkr: this._nextMkr,
      advanceMkrPhase: this._advanceMkrPhase,
      navalBoarding: this._navalBoarding,
      setWaterTerrain: this._setWaterTerrain,
      aggroButton: this._onAggroButtonClicked,
      combatRules: this._onCombatRulesButtonClicked,
    },
  };

  static _nextMkr() {
    game.combat?.nextMkr();
  }

  static _advanceMkrPhase() {
    game.combat?.advanceMkrPhase();
  }

  static _navalBoarding() {
    NavalCombatDamage.initiateBoarding();
  }

  static _setWaterTerrain(_ev, target) {
    game.combat?.setWaterTerrain(target.value);
  }

  static _onAggroButtonClicked() {
    DSA5CombatTracker.runActAttackDialog();
  }

  static _convertToBrawl() {
    game.combat.convertToBrawl();
  }

  static async _onCombatRulesButtonClicked() {
    if (DSA5_Utility.moduleEnabled('dsa5-core')) {
      if (game.i18n.lang == "de")
        game.dsa5.apps.journalBrowser.loadBookAndPage("Grundregelwerk", "Kampf", "books", 'Regeln');
      else
        game.dsa5.apps.journalBrowser.loadBookAndPage("Core rules", "Combat", "books", 'Rules');
    }
  }

  static runActAttackDialog() {
    if (!game.combat) return;

    const combatant = game.combat.combatant;
    if(!combatant) return;

    if (game.user.isGM || combatant.isOwner) ActAttackDialog.showDialog(combatant.actor, combatant.tokenId);
  }

  async _prepareTurnContext(combat, combatant, index) {
    const turn = await super._prepareTurnContext(combat, combatant, index);
    const isAllowedToSeeEffects = game.user.isGM || (combatant.actor && combatant.actor.testUserPermission(game.user, 'OBSERVER')) || !game.settings.get('dsa5', 'hideEffects');
    turn.defenseCount = combatant.system.defenseCount;
    turn.actionCount = Number(getProperty(combatant, 'actor.system.actionCount.value')) || 0;
    turn.actionCounts = `${turn.actionCount} ${_loc('actionCount')}`;
    turn.roundInitiative = combatant.system.roundInitiative;

    let remainders = [];
    let aiming = [];
    if (combatant.actor) {
      for (const x of combatant.actor.items) {
        const isWornRangeWeapon = x.type == 'rangeweapon' && x.system.worn.value;
        const lz = isWornRangeWeapon ? Actordsa5.calcLZ(x, combatant.actor) : 0;

        if (isWornRangeWeapon && x.system.reloadTime.progress > 0) {
          const wpn = {
            name: x.name,
            remaining: lz - x.system.reloadTime.progress,
          };
          if (wpn.remaining > 0) remainders.push(wpn);
        } else if (['spell', 'liturgy'].includes(x.type) && x.system.castingTime.modified > 0) {
          const wpn = {
            name: x.name,
            remaining: x.system.castingTime.modified - x.system.castingTime.progress,
          };
          if (wpn.remaining > 0) remainders.push(wpn);
        }

        if (isWornRangeWeapon) {
          const aimProgress = Number(x.system?.aimTime?.progress) || 0;
          if (aimProgress > 0) {
            const loaded = lz === 0 || (Number(x.system.reloadTime?.progress) || 0) >= lz;
            if (loaded) {
              aiming.push({
                name: x.name,
                progress: Math.clamp(aimProgress, 0, 2),
                status: `${aimProgress}/2`,
              });
            }
          }
        }
      }
    }
    remainders = remainders.sort((a, b) => a.remaining - b.remaining);

    aiming = aiming.sort((a, b) => b.progress - a.progress);

    const ongoingLines = [];
    if (remainders.length > 0) ongoingLines.push(...remainders.map((x) => `${x.name} - ${x.remaining}`));
    if (aiming.length > 0) ongoingLines.push(...aiming.map((x) => `${x.name} - ${_loc('WEAPON.aim')} ${x.status}`));

    if (ongoingLines.length > 0) {
      turn.ongoings = `${_loc('COMBATTRACKER.ongoing')}<br>${ongoingLines.join('<br>')}`;

      if (remainders.length > 0) turn.ongoing = remainders[0].remaining;
      else if (aiming.length > 0) turn.ongoing = aiming[0].progress;
    }
    const effects = [];
    const defeatedStatus = CONFIG.specialStatusEffects.DEFEATED;
    for (const e of combatant.actor?.temporaryEffects || []) {
      if (e.statuses.has(defeatedStatus) || e.statuses.has('defeated')) turn.isDefeated = true;
      else if (e.img && isAllowedToSeeEffects && !e.notApplicable && (game.user.isGM || !e.system?.visibility?.hidePlayers) && !e.system?.visibility?.hideOnToken) {
        effects.push({ img: e.img, name: e.name });
      }
    }
    turn.effects = {
      icons: effects,
      tooltip: this._formatEffectsTooltip(effects),
    };

    const disposition = combatant.token?.disposition ?? CONST.TOKEN_DISPOSITIONS.NEUTRAL;
    turn.dispositionStyle = dispositionBackgroundStyle(disposition);
    turn.dispositionBorderStyle = dispositionBorderStyle(disposition);

    if (combatant.actor?.type === 'vehicle') {
      turn.vehicleImmobile = combatant.actor.system.isImmobile;
      turn.vehicleSinking = combatant.actor.system.isSinking;
    }

    return turn;
  }

  async _prepareCombatContext(context, options) {
    await super._prepareCombatContext(context, options);
    const combat = game.combat;
    context.isBrawling = combat?.isBrawling;
    context.combatMode = NavalCombat.resolveCombatMode(combat);
    context.isNavalMkr = NavalCombat.isNavalMkrActive(combat);
    context.combatModeIcon = {
      standard: 'fa-shield',
      brawling: 'fa-hand-fist fa-rotate-90',
      navalMkr: 'fa-ship',
    }[context.combatMode] ?? 'fa-shield';
    context.combatModeTooltip = 'COMBAT.MODE.tooltip';

    if (context.isNavalMkr) {
      this.#prepareNavalMkrContext(context, combat);
    }
  }

  #prepareNavalMkrContext(context, combat) {
    context.mkr = NavalCombat.getMkrProgress(combat);
    context.mkrPhase = combat?.system?.mkrPhase;
    context.waterTerrain = combat?.system?.waterTerrain ?? 'normal';
    context.waterTerrainLabel = NavalChase.getTerrainLabel(context.waterTerrain);
    context.waterTerrainOptions = NavalChase.WATER_TERRAIN_IDS.map((id) => ({
      id,
      label: _loc(`VEHICLE.mkr.chase.terrain.${id}`),
    }));
    context.sceneNavalRegions = NavalChase.listSceneNavalRegions();
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
    const update = {};
    if (event.ctrlKey) {
      update.initiative = roundInitiative + 0.00001;
      update.system = {
        roundInitiative: -1,
      };
    } else {
      update.system = {
        roundInitiative: roundInitiative + 0.00001,
      };
    }

    await combatant.update(update);
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    if (game.user.isGM) {
      this._createContextMenu(this._getCombatModeContextOptions.bind(this), '.combat-mode-control', {
        eventName: 'click',
        fixed: true,
        parentClassHooks: false,
      });
    }
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
  }

  _getCombatModeContextOptions() {
    return [
      {
        label: _loc('COMBAT.MODE.standard'),
        icon: '<i class="fas fa-shield"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('standard'),
      },
      {
        label: _loc('COMBAT.MODE.brawling'),
        icon: '<i class="fas fa-hand-fist"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('brawling'),
      },
      {
        label: _loc('COMBAT.MODE.navalMkr'),
        icon: '<i class="fas fa-ship"></i>',
        visible: () => !!game.combat,
        onClick: () => game.combat?.setCombatMode('navalMkr'),
      },
    ];
  }
}

Hooks.on('preCreateCombatant', (data, options, user) => {
  const actor = DSA5_Utility.getSpeaker({
    actor: data.actorId,
    scene: data.sceneId,
    token: data.tokenId,
  });
  if (actor.system.merchant.merchantType == 'loot' && actor.type !== 'vehicle') return false;

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
  if (actor.system.merchant.merchantType == 'loot' && actor.type !== 'vehicle') return false;

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
  if (!DSA5_Utility.isActiveGM()) return;

  if (change.initiative) {
    const baseRoll = combatant.getFlag('dsa5', 'baseRoll');
    if (!baseRoll) {
      const parts = `${change.initiative}`.split('.');
      const roll = Number(parts[0]) - Math.round(combatant.actor.system.status.initiative.value);
      combatant.setFlag('dsa5', 'baseRoll', roll);
    }
  } else if ('initiative' in change && change.initiative == null) {
    combatant.update({ 'flags.dsa5.baseRoll': _del });
  }
});

class RepeatingEffectsHelper {
  static async updateCombatHook(combat, updateData) {
    if (!updateData.round && !updateData.turn) return;

    if (combat.round != 0 && combat.turns && combat.active) {
      if (combat.previous.round < combat.current.round) await RepeatingEffectsHelper.startOfRound(combat);
    }
  }

  static async startOfRound(combat) {
    if (!DSA5_Utility.isActiveGM()) return;

    for (const turn of combat.turns) {
      if (!turn.defeated && turn.actor) {
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
      const type = _loc(damageRoll.total > 0 ? 'CHATNOTIFICATION.regenerates' : 'CHATNOTIFICATION.getsHurt');
      const applyDamage = `${this.buildActorName(turn)} ${type} ${_loc(attr)} ${damage}`;

      await this.sendEventMessage(applyDamage, combat, turn);
      if (attr == 'wounds') await turn.actor.applyDamage(damageRoll.total * -1);
      else await turn.actor.applyMana(damageRoll.total * -1, attr == 'astralenergy' ? 'AsP' : 'KaP');
    }
  }

  static async applyBleeding(turn, combat) {
    if (turn.actor.system.status.wounds.value < 1) return;

    const msg = _loc('CHATNOTIFICATION.bleeding', {
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
    const msg = _loc(`CHATNOTIFICATION.burning.${step}`, {
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

Hooks.on("updateCombat", RepeatingEffectsHelper.updateCombatHook)