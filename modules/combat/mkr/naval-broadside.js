import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import QueryOrchestrator from '../../system/queries/query-orchestrator.js';
import NavalBroadsideDialog from '../../dialog/naval-broadside-dialog.js';
import NavalBoardWeapons from './naval-board-weapons.js';
import NavalCombat from './naval-combat.js';
import NavalCombatDamage from './naval-combat-damage.js';

const { randomID, deepClone } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

/** Yield to the browser every N shots so large broadsides stay responsive. */
const YIELD_EVERY = 20;
const ROLL_CARD_TEMPLATE = 'systems/dsa5/templates/chat/roll/test-card.hbs';

/**
 * Volle Breitseite: multi-select board guns, silent multi-fire, one summary chat card.
 */
export default class NavalBroadside {
  static register() {
    Hooks.on('renderChatMessageHTML', this.onRenderChatMessage.bind(this));
  }

  static onRenderChatMessage(message, html) {
    if (!message?.flags?.dsa5?.broadside?.weaponRolls) return;
    const root = html?.jquery ? html[0] : html;
    if (!root) return;

    root.querySelectorAll('.naval-broadside-expand').forEach((el) => {
      el.addEventListener('click', (ev) => this.#onExpandWeapon(ev, message));
    });
  }

  static async #onExpandWeapon(event, message) {
    event.preventDefault();
    event.stopPropagation();

    const row = event.currentTarget;
    const weaponEl = row.closest('.naval-broadside-weapon');
    const details = weaponEl?.querySelector('.naval-broadside-shot-details');
    if (!details) return;

    const icon = row.querySelector('.naval-broadside-expand-icon');
    const expanded = details.classList.toggle('expanded');
    icon?.classList.toggle('fa-plus', !expanded);
    icon?.classList.toggle('fa-minus', expanded);
    if (!expanded) return;
    if (details.dataset.loaded === '1') return;

    const weaponId = details.dataset.weaponId;
    const rolls = message.flags.dsa5.broadside.weaponRolls?.[weaponId] ?? [];
    if (!rolls.length) {
      details.dataset.loaded = '1';
      return;
    }

    details.innerHTML = `<p class="very-small">${_loc('VEHICLE.mkr.broadsideLoadingDetails')}</p>`;
    const parts = [];
    for (const roll of rolls) {
      const content = await renderTemplate(roll.template || ROLL_CARD_TEMPLATE, {
        title: roll.title,
        testData: roll.testData,
        preData: roll.preData,
        hideDamage: roll.hideDamage,
        hideData: roll.hideData ?? { value: game.user.isGM },
        modifierList: roll.modifierList ?? [],
        actorId: roll.preData?.extra?.speaker?.actor,
      });
      parts.push(`<div class="naval-broadside-shot-card dsa5">${content}</div>`);
    }
    details.innerHTML = parts.join('');
    details.dataset.loaded = '1';
  }

  static maxShots(weapon, combat = game.combat) {
    const rate = NavalBoardWeapons.shotsPerMkr(weapon, combat);
    if (!Number.isFinite(rate) || rate <= 0) return 1;
    return Math.max(1, Math.ceil(rate));
  }

  static usedShots(combatant, weaponId) {
    return Number(combatant?.system?.broadsideShots?.[weaponId]) || 0;
  }

  static remainingShots(weapon, combatant, combat = game.combat) {
    const max = this.maxShots(weapon, combat);
    return Math.max(0, max - this.usedShots(combatant, weapon.id));
  }

  static resolveCombatant(vehicle, combat = game.combat) {
    if (!combat || !vehicle) return null;
    return combat.combatants.find((c) => c.actorId === vehicle.id)
      ?? combat.combatants.find((c) => c.actor?.id === vehicle.id)
      ?? null;
  }

  static async open(vehicle, { tokenId } = {}) {
    if (!vehicle) return;

    if (!NavalBoardWeapons.canFireInMkr()) {
      ui.notifications.warn('VEHICLE.boardWeaponAttacksPhaseOnly', { localize: true });
      return;
    }

    if (!game.user.targets.size) {
      ui.notifications.warn('VEHICLE.mkr.pickTargetFirst', { localize: true });
      return;
    }

    const hasWornGun = vehicle.items.some((i) => i.type === 'rangeweapon' && i.system?.worn?.value);
    if (!hasWornGun) {
      ui.notifications.warn('VEHICLE.mkr.broadsideNoWeapons', { localize: true });
      return;
    }

    const selection = await NavalBroadsideDialog.prompt(vehicle, { tokenId });
    if (!selection?.length) return;

    await this.execute(vehicle, selection, { tokenId });
  }

  static async execute(vehicle, selection, { tokenId } = {}) {
    const combat = game.combat;
    const combatant = this.resolveCombatant(vehicle, combat);
    const targets = [...game.user.targets];
    if (!targets.length) {
      ui.notifications.warn('VEHICLE.mkr.pickTargetFirst', { localize: true });
      return;
    }

    const primaryTarget = targets.find((t) => t.actor?.type === 'vehicle') ?? targets[0];
    const defenderVehicle = primaryTarget.actor?.type === 'vehicle' ? primaryTarget.actor : null;
    const evadePenalty = this.#evadePenalty(defenderVehicle);

    const shots = [];
    const weaponRolls = {};
    const budgetUpdates = {};
    const reloadResets = [];

    const sourceToken = tokenId
      ? canvas.tokens?.get(tokenId)
      : canvas.tokens?.placeables.find((t) => t.actor?.id === vehicle.id);

    let shotIndex = 0;
    for (const entry of selection) {
      const item = vehicle.items.get(entry.weaponId);
      if (!item) continue;

      if (!NavalBroadsideDialog.isWeaponInRange(item, sourceToken, game.user.targets)) continue;

      const remaining = combatant
        ? this.remainingShots(item, combatant, combat)
        : this.maxShots(item, combat);
      const toFire = Math.min(entry.shots, remaining);
      if (toFire <= 0) continue;

      const operatorUuid = vehicle.system.weaponOperators?.[item.id];
      let fired = 0;

      const setup = await NavalBoardWeapons.resolveFireSetup(vehicle, item, 'attack', {
        tokenId,
        operatorUuid,
        skipReadyCheck: false,
      });
      if (!setup) continue;

      for (let i = 0; i < toFire; i++) {
        const shot = await this.#fireOneShot(vehicle, item, {
          tokenId,
          setup,
          defenderVehicle,
          evadePenalty,
        });
        if (!shot) break;
        shots.push(shot);
        (weaponRolls[item.id] ??= []).push(shot.rollCard);
        delete shot.rollCard;
        fired++;
        shotIndex++;
        if (shotIndex % YIELD_EVERY === 0) await this.#yieldToUi();
      }

      if (fired > 0) {
        if (combatant) {
          const already = this.usedShots(combatant, item.id);
          budgetUpdates[`system.broadsideShots.${item.id}`] = already + fired;
        }
        reloadResets.push({
          _id: item.id,
          'system.reloadTime.progress': 0,
          'system.aimTime.progress': 0,
        });
      }
    }

    if (reloadResets.length) {
      await vehicle.updateEmbeddedDocuments('Item', reloadResets);
    }
    if (combatant && Object.keys(budgetUpdates).length) {
      await combatant.update(budgetUpdates);
    }

    if (!shots.length) {
      ui.notifications.warn('VEHICLE.mkr.broadsideNoShots', { localize: true });
      return;
    }

    await this.#postSummary(vehicle, primaryTarget, defenderVehicle, shots, weaponRolls);
  }

  static async #fireOneShot(vehicle, item, { tokenId, setup, defenderVehicle, evadePenalty }) {
    const liveItem = vehicle.items.get(item.id) ?? item;
    const fireSetup = setup ?? await NavalBoardWeapons.resolveFireSetup(vehicle, liveItem, 'attack', {
      tokenId,
    });
    if (!fireSetup) return null;

    const options = {
      ...fireSetup.options,
      bypass: true,
    };

    const setupData = await fireSetup.rollingActor.setupWeapon(
      fireSetup.weapon ?? liveItem,
      'attack',
      options,
      fireSetup.rollTokenId ?? tokenId,
    );
    if (!setupData) return null;

    const dialogMods = setupData.dialogOptions?.data?.situationalModifiers;
    if (dialogMods?.length) {
      setupData.testData.situationalModifiers = dialogMods.filter((m) => m.selected !== false);
    } else {
      setupData.testData.situationalModifiers ??= [];
    }
    setupData.testData.extra.options = {
      ...(setupData.testData.extra.options || {}),
      ...options,
    };

    const rolled = await fireSetup.rollingActor.basicTest(setupData, {
      suppressMessage: true,
      skipConsume: true,
    });
    if (!rolled?.result) return null;

    const result = rolled.result;
    let hit = (result.successLevel ?? 0) > 0;
    let evadeBlocked = false;

    if (hit && evadePenalty != null && (result.successLevel ?? 0) - evadePenalty <= -5) {
      hit = false;
      evadeBlocked = true;
      const evadeNote = _loc('VEHICLE.mkr.broadsideEvadeBlocked');
      result.description = result.description
        ? `${result.description} — ${evadeNote}`
        : evadeNote;
    }

    const attackerPayload = {
      speaker: setupData.testData.extra.speaker,
      testResult: { ...result, source: setupData.testData.source },
      options,
    };

    const stpFormula = hit && defenderVehicle
      ? NavalCombatDamage.resolveStpFormula(attackerPayload, defenderVehicle)
      : null;

    return {
      id: randomID(),
      weaponId: item.id,
      weaponName: item.name,
      hit,
      evadeBlocked,
      successLevel: result.successLevel ?? 0,
      qualityStep: result.qualityStep ?? 0,
      damage: result.damage ?? null,
      stpFormula,
      attackerName: vehicle.name,
      queued: false,
      rollCard: this.#serializeRollCard(result, rolled.cardOptions),
    };
  }

  /** Compact payload for lazy test-card rendering from chat flags. */
  static #serializeRollCard(result, cardOptions = {}) {
    const postData = deepClone(result);
    const preData = deepClone(postData.preData ?? {});
    delete postData.preData;
    delete postData.actor;

    this.#jsonifyRoll(preData, 'roll');
    this.#jsonifyRoll(preData, 'damageRoll');
    this.#trimSource(preData.source);

    const situationalModifiers = preData.situationalModifiers ?? [];
    return {
      title: cardOptions.title || preData.source?.name || '',
      template: cardOptions.template || ROLL_CARD_TEMPLATE,
      testData: postData,
      preData,
      hideDamage: preData.mode === 'attack',
      hideData: { value: game.user.isGM },
      modifierList: situationalModifiers.filter((x) => x.value != 0),
    };
  }

  static #jsonifyRoll(obj, key) {
    if (!obj?.[key]) return;
    if (obj[key] instanceof Roll) obj[key] = obj[key].toJSON();
  }

  static #trimSource(source) {
    if (!source?.system) return;
    // Keep display fields; drop heavy effect payloads from chat flags.
    if (Array.isArray(source.effects) && source.effects.length) source.effects = [];
  }

  /** Evade QS penalty, or null when evade does not apply. */
  static #evadePenalty(defenderVehicle) {
    if (!defenderVehicle || !NavalCombat.isNavalMkrActive()) return null;
    if (game.combat?.system?.mkrPhase !== 'attacks') return null;

    const maneuver = NavalCombatDamage.getManeuver(game.combat, defenderVehicle.id);
    if (maneuver?.maneuverType !== 'evade') return null;
    return Math.min(6, maneuver.maneuverQS || 0);
  }

  static async #yieldToUi() {
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  static async #postSummary(vehicle, primaryTarget, defenderVehicle, shots, weaponRolls) {
    const hits = shots.filter((s) => s.hit && NavalCombatDamage.hasStpValue(s.stpFormula));

    await Promise.all(hits.map(async (hit) => {
      const stp = await NavalCombatDamage.evaluateStpFormula(hit.stpFormula);
      hit.stpPreview = stp;
      if (stp == null) return;
      hit.crewDamage = await NavalCombatDamage.resolveCrewCasualties(stp, {});
    }));

    let stpPreviewTotal = 0;
    let crewDamageTotal = 0;
    for (const hit of hits) {
      if (hit.stpPreview == null) continue;
      stpPreviewTotal += hit.stpPreview;
      crewDamageTotal += hit.crewDamage || 0;
    }

    if (defenderVehicle && NavalCombat.isNavalMkrActive() && game.combat?.system?.mkrPhase === 'attacks') {
      const queueEntries = hits
        .filter((h) => h.stpPreview != null)
        .map((h) => ({
          stpFormula: String(h.stpPreview),
          attackerName: vehicle.name,
          attackerVehicleId: vehicle.id,
          crewDamage: h.crewDamage ?? 0,
        }));
      if (queueEntries.length) {
        await NavalCombatDamage.queueHits(defenderVehicle, queueEntries);
        for (const hit of hits) {
          if (hit.stpPreview != null) hit.queued = true;
        }
      }
    }

    const displayShots = shots.map((shot) => this.#shotDisplay(shot));
    const weapons = this.#weaponGroups(displayShots);

    const content = await renderTemplate('systems/dsa5/templates/chat/roll/naval-broadside-card.hbs', {
      vehicleName: vehicle.name,
      targetName: primaryTarget?.name ?? primaryTarget?.document?.name ?? '—',
      weapons,
    });

    const chatData = DSA5_Utility.chatDataSetup(content);
    chatData.flags = {
      dsa5: {
        broadside: {
          vehicleId: vehicle.id,
          targetId: defenderVehicle?.id ?? primaryTarget?.actor?.id ?? null,
          targetTokenId: primaryTarget?.id ?? null,
          stpPreviewTotal,
          crewDamageTotal,
          weaponRolls,
          hits: shots.map((s) => ({
            id: s.id,
            weaponId: s.weaponId,
            weaponName: s.weaponName,
            hit: s.hit,
            stpFormula: s.stpFormula,
            stpPreview: s.stpPreview ?? null,
            crewDamage: s.crewDamage ?? null,
            attackerName: s.attackerName,
            queued: !!s.queued,
          })),
        },
      },
    };

    await ChatMessage.create(chatData);
  }

  static #shotDisplay(shot) {
    const status = shot.hit
      ? QueryOrchestrator.statusFromSuccessLevel(shot.successLevel || 1)
      : shot.successLevel < -1
        ? 'botch'
        : 'failure';
    const detail = shot.evadeBlocked ? _loc('VEHICLE.mkr.broadsideEvadeBlocked') : '';
    const outcome = QueryOrchestrator.outcomeDisplay({ status, detail });

    return {
      ...shot,
      resultRowClass: outcome.resultRowClass,
      resultTooltip: outcome.resultTooltip,
      resultSubLabel: outcome.resultSubLabel,
      resultLabel: shot.hit ? (outcome.resultSubLabel || _loc('Success')) : '',
    };
  }

  /** One summary row per weapon: Erfolg/Misserfolg only (damage stays in Schadensbericht). */
  static #weaponGroups(displayShots) {
    const order = [];
    const byWeapon = new Map();

    for (const shot of displayShots) {
      let group = byWeapon.get(shot.weaponId);
      if (!group) {
        group = {
          weaponId: shot.weaponId,
          weaponName: shot.weaponName,
          shotCount: 0,
          hitCount: 0,
          hasBotch: false,
        };
        byWeapon.set(shot.weaponId, group);
        order.push(group);
      }
      group.shotCount += 1;
      if (shot.successLevel < -1) group.hasBotch = true;
      if (shot.hit) group.hitCount += 1;
    }

    return order.map((group) => {
      const hit = group.hitCount > 0;
      const status = hit ? 'success' : group.hasBotch ? 'botch' : 'failure';
      const outcome = QueryOrchestrator.outcomeDisplay({ status, detail: '' });

      let resultLabel = '';
      let resultSubLabel = '';
      if (hit) {
        resultLabel = outcome.resultSubLabel || _loc('Success');
        if (group.shotCount > 1) resultSubLabel = `(${group.hitCount})`;
      }

      return {
        weaponId: group.weaponId,
        weaponName: group.weaponName,
        shotCount: group.shotCount,
        hitCount: group.hitCount,
        expandable: true,
        hit,
        resultRowClass: outcome.resultRowClass,
        resultTooltip: outcome.resultTooltip,
        resultLabel,
        resultSubLabel,
      };
    });
  }
}
