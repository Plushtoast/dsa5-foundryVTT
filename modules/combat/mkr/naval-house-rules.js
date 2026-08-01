import Actordsa5 from '../../actor/actor-dsa5.js';
import { FormAppv2 } from '../../actor/formapp.js';
import NavalCombat from './naval-combat.js';

const { BooleanField } = foundry.data.fields;

/** Setting keys under the dsa5 namespace (config: false — only via Hausregeln menu). */
export const NAVAL_HOUSE_RULE_SETTINGS = {
  autoReload: 'navalHouseRuleAutoReload',
  maneuverReadiness: 'navalHouseRuleManeuverReadiness',
  shipCondition: 'navalHouseRuleShipCondition',
  altReadiness: 'navalHouseRuleAltReadiness',
};

/**
 * Schiffskampf Hausregeln: world toggles + runtime hooks for reload / ship conditions.
 */
export default class NavalHouseRules {
  static CONDITION_MANEUVER = 'maneuverReadiness';
  static CONDITION_SHIP = 'shipCondition';

  static register() {
    Hooks.on('dsa5.prepareRollSituationalModifiers', this.prepareRollSituationalModifiers.bind(this));
  }

  static enabled(key) {
    const setting = NAVAL_HOUSE_RULE_SETTINGS[key];
    if (!setting) return true;
    try {
      return game.settings.get('dsa5', setting) !== false;
    } catch {
      return true;
    }
  }

  static registerSettings(settings) {
    Object.assign(settings, {
      [NAVAL_HOUSE_RULE_SETTINGS.autoReload]: {
        name: 'VEHICLE.houseRules.autoReload',
        hint: 'VEHICLE.houseRules.autoReloadHint',
        scope: 'world',
        config: false,
        default: true,
        type: Boolean,
      },
      [NAVAL_HOUSE_RULE_SETTINGS.maneuverReadiness]: {
        name: 'VEHICLE.houseRules.maneuverReadiness',
        hint: 'VEHICLE.houseRules.maneuverReadinessHint',
        scope: 'world',
        config: false,
        default: true,
        type: Boolean,
        onChange: () => this.refreshAllVehicles(),
      },
      [NAVAL_HOUSE_RULE_SETTINGS.shipCondition]: {
        name: 'VEHICLE.houseRules.shipCondition',
        hint: 'VEHICLE.houseRules.shipConditionHint',
        scope: 'world',
        config: false,
        default: true,
        type: Boolean,
        onChange: () => this.refreshAllVehicles(),
      },
      [NAVAL_HOUSE_RULE_SETTINGS.altReadiness]: {
        name: 'VEHICLE.houseRules.altReadiness',
        hint: 'VEHICLE.houseRules.altReadinessHint',
        scope: 'world',
        config: false,
        default: true,
        type: Boolean,
        onChange: () => this.refreshAllVehicles(),
      },
    });
  }

  /** Pain-like level from remaining/max (25% / 50% / 75% lost → 1–3; ≤5 absolute → 4). */
  static thresholdLevel(value, max) {
    if (!max) return 0;
    if (value <= 5) return 4;
    return Math.clamp(Math.floor((1 - value / max) * 4), 0, 4);
  }

  static immobileThreshold(stpMax) {
    if (!this.enabled('altReadiness')) return 10;
    return Math.max(1, Math.ceil(Number(stpMax || 0) * 0.05));
  }

  static immobileLabelKey() {
    return this.enabled('altReadiness') ? 'VEHICLE.immobileAlt' : 'VEHICLE.immobile';
  }

  static isImmobile(stpValue, stpMax) {
    return stpValue > 0 && stpValue <= this.immobileThreshold(stpMax);
  }

  static async refreshAllVehicles() {
    if (!game.user?.isGM) return;
    for (const actor of game.actors.filter((a) => a.type === 'vehicle')) {
      await Actordsa5.postUpdateConditions(actor);
      actor.reset();
      actor.sheet?.render(false);
    }
  }

  /**
   * Sync house-rule conditions + immobile/sinking gates on a vehicle.
   * Called from Actordsa5.syncVehicleStructureConditions.
   */
  static async syncVehicleConditions(actor) {
    const stp = Number(actor.system.status.structurePoints?.value ?? 0);
    const stpMax = Number(actor.system.status.structurePoints?.max ?? 0);
    const wantSinking = stp <= 0;
    const wantImmobile = this.isImmobile(stp, stpMax) && !wantSinking;

    await this.#syncImmobileSinking(actor, wantImmobile, wantSinking);

    const shipLevel = this.enabled('shipCondition') && !wantSinking
      ? this.thresholdLevel(stp, stpMax)
      : 0;
    await Actordsa5.deferredEffectAddition(this.CONDITION_SHIP, actor, shipLevel);

    const crewMax = Number(actor.system.status.crew?.max ?? 0);
    const crewCurrent = Number(actor.system.availableCrew ?? actor.system.status.crew?.value ?? 0);
    const maneuverLevel = this.enabled('maneuverReadiness') && !wantSinking
      ? this.thresholdLevel(crewCurrent, crewMax)
      : 0;
    await Actordsa5.deferredEffectAddition(this.CONDITION_MANEUVER, actor, maneuverLevel);
  }

  static async #syncImmobileSinking(actor, wantImmobile, wantSinking) {
    const findStpEffect = (key) => actor.effects.find((e) => e.getFlag('dsa5', 'vehicleStpCondition') === key);
    const immobile = findStpEffect('immobile');
    const sinking = findStpEffect('sinking');
    const immobileLabel = _loc(this.immobileLabelKey());

    if (wantImmobile && !immobile) {
      await actor.addTimedCondition('fixated', 1, false, false, {
        name: immobileLabel,
        description: immobileLabel,
        flags: { dsa5: { vehicleStpCondition: 'immobile' } },
      });
    } else if (wantImmobile && immobile && immobile.name !== immobileLabel) {
      await immobile.update({ name: immobileLabel, description: immobileLabel });
    } else if (!wantImmobile && immobile) {
      await immobile.delete();
    }

    if (wantSinking && !sinking) {
      await actor.addTimedCondition('dead', 1, false, false, {
        name: _loc('VEHICLE.sinking'),
        description: _loc('VEHICLE.sinking'),
        flags: {
          dsa5: { vehicleStpCondition: 'sinking' },
          core: { overlay: true },
        },
      });
    } else if (!wantSinking && sinking) {
      await sinking.delete();
    }
  }

  /** Apply −1 GS per Schiffszustand level (like Schmerz). */
  static applySpeedMalus(speed, conditionLevel) {
    if (!conditionLevel) return speed;
    return Math.max(0, speed - conditionLevel);
  }

  /**
   * On next MKR: advance rangeweapon reload progress by krPerMkr (default 60).
   * @param {Combat} combat
   */
  static async tickAutoReload(combat) {
    if (!this.enabled('autoReload')) return;

    const kr = combat.system.krPerMkr || NavalCombat.DEFAULT_KR_PER_MKR;
    for (const comb of combat.combatants) {
      const actor = comb.actor;
      if (actor?.type !== 'vehicle') continue;

      const updates = [];
      for (const item of actor.items) {
        if (item.type !== 'rangeweapon') continue;
        const lz = Actordsa5.calcLZ(item, actor);
        if (!lz) continue;
        const progress = Number(item.system.reloadTime?.progress ?? 0);
        if (progress >= lz) continue;
        updates.push({
          _id: item.id,
          'system.reloadTime.progress': Math.min(lz, progress + kr),
        });
      }
      if (updates.length) await actor.updateEmbeddedDocuments('Item', updates);
    }
  }

  /** Inject Schiffszustand onto crew members’ rolls. */
  static prepareRollSituationalModifiers(actor, situationalModifiers, _context) {
    if (!actor || actor.type === 'vehicle') return;
    if (!this.enabled('shipCondition')) return;

    const vehicle = game.actors.find((candidate) => (
      candidate.type === 'vehicle' && candidate.system.hasCrewMember?.(actor)
    ));
    if (!vehicle) return;

    const level = Number(vehicle.system.condition?.[this.CONDITION_SHIP] || 0);
    if (level <= 0) return;

    situationalModifiers.push({
      name: _loc(`CONDITION.${this.CONDITION_SHIP}`),
      value: -level,
      selected: true,
    });
  }
}

/** Schema fields for {{formGroup}} rendering in the Hausregeln menu. */
export class NavalHouseRulesFields extends foundry.abstract.DataModel {
  static defineSchema() {
    return {
      autoReload: new BooleanField({
        initial: true,
        label: 'VEHICLE.houseRules.autoReload',
        hint: 'VEHICLE.houseRules.autoReloadHint',
      }),
      maneuverReadiness: new BooleanField({
        initial: true,
        label: 'VEHICLE.houseRules.maneuverReadiness',
        hint: 'VEHICLE.houseRules.maneuverReadinessHint',
      }),
      shipCondition: new BooleanField({
        initial: true,
        label: 'VEHICLE.houseRules.shipCondition',
        hint: 'VEHICLE.houseRules.shipConditionHint',
      }),
      altReadiness: new BooleanField({
        initial: true,
        label: 'VEHICLE.houseRules.altReadiness',
        hint: 'VEHICLE.houseRules.altReadinessHint',
      }),
    };
  }
}

export class NavalHouseRulesForm extends FormAppv2 {
  static DEFAULT_OPTIONS = {
    id: 'dsa5-naval-house-rules',
    window: {
      title: 'VEHICLE.houseRules.menu',
      icon: 'fas fa-ship',
    },
    position: {
      width: 560,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/naval-house-rules.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const fields = NavalHouseRulesFields.schema.fields;
    const values = {};
    for (const [key, setting] of Object.entries(NAVAL_HOUSE_RULE_SETTINGS)) {
      values[key] = game.settings.get('dsa5', setting);
    }
    return foundry.utils.mergeObject(data, { fields, ...values });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.querySelectorAll('input[type="checkbox"][name]').forEach((input) => {
      input.addEventListener('change', async (ev) => {
        const key = ev.currentTarget.name;
        const setting = NAVAL_HOUSE_RULE_SETTINGS[key];
        if (!setting) return;
        await game.settings.set('dsa5', setting, ev.currentTarget.checked);
      });
    });
  }
}

/** Menu stub opened from Configure Settings (like ChangelogForm). */
export class NavalHouseRulesMenu extends FormAppv2 {
  render() {
    new NavalHouseRulesForm().render(true);
  }
}
