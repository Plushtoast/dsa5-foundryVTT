import OnUseEffect from '../system/automation/onUseEffects.js';
import EffectDuration from '../status/effectDuration.js';

const { duplicate } = foundry.utils;

export default class TableEffectFactory {
  static async createOnActor(actor, {
    name = _loc('botchCritEffect'),
    changes = [],
    duration = {},
    charges,
    afterUse,
    scopedRules,
    origin,
    flags = {},
    system = {},
    transfer,
    applyToOwner,
  } = {}) {
    const effect = OnUseEffect.effectBaseDummy(name, duplicate(changes), duration || {});

    if (charges) effect.system.charges = duplicate(charges);
    if (afterUse) {
      effect.system.useLifecycle = {
        afterUse: {
          [foundry.utils.randomID()]: this.#normalizeAfterUse(afterUse),
        },
      };
    }
    if (scopedRules) effect.system.scopedRules = duplicate(scopedRules);
    if (origin) effect.origin = origin;
    if (transfer !== undefined) effect.transfer = transfer;
    if (applyToOwner !== undefined) effect.system.applyToOwner = applyToOwner;

    foundry.utils.mergeObject(effect.flags, flags);
    foundry.utils.mergeObject(effect.system, system);

    await EffectDuration.finalizeEffect(effect);
    const created = await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    return created[0];
  }

  static async createScopedRule(actor, type, data, duration) {
    const effect = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), [], duration || {});
    if (data.origin || data.sourceUuid) effect.origin = data.origin || data.sourceUuid;
    effect.system.scopedRules = {
      [foundry.utils.randomID()]: {
        key: type,
        scope: data.scope || 'self',
        identifiers: this.#scopeIdentifiers(data),
        value: this.#scopedRuleValue(type, data),
        data: this.#scopedRuleData(data),
      },
    };

    await EffectDuration.finalizeEffect(effect);
    const created = await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    return created[0];
  }

  static createScopedModifier(actor, data, duration) {
    return this.createScopedRule(actor, 'modifier', data, duration);
  }

  static createScopedRestriction(actor, data, duration) {
    return this.createScopedRule(actor, 'restriction', data, duration);
  }

  static createManeuverPenaltyIgnore(actor, value, duration) {
    const compensation = Math.max(0, Number(value) || 0);
    if (!compensation) return undefined;

    return this.createOnActor(actor, {
      changes: [{ key: 'system.skillModifiers.combat.CMP', mode: 2, value: `maneuver:* ${compensation}` }],
      duration: duration || { rounds: 1 },
      charges: { value: 1, max: 1 },
    });
  }

  static createDefenseCountModifier(actor, data, duration) {
    const floor = Number(data?.floor);
    if (!Number.isFinite(floor)) return undefined;

    return this.createOnActor(actor, {
      name: data.name || _loc('botchCritEffect'),
      changes: [{ key: 'system.skillModifiers.combat.defenseCount', mode: 2, value: `* ${floor}` }],
      duration: duration || { rounds: 1 },
      charges: { value: 1, max: 1 },
      afterUse: data?.afterUse,
    });
  }

  static createAttackPenaltyReduction(actor, data, duration) {
    const compensation = Math.max(0, Number(data?.value) || 0);
    if (!compensation) return undefined;

    return this.createOnActor(actor, {
      name: data.name || _loc('botchCritEffect'),
      changes: [{ key: 'system.skillModifiers.combat.CMP', mode: 2, value: `attack:* ${compensation}` }],
      duration: duration || { rounds: 1 },
      afterUse: data?.afterUse,
    });
  }

  static async addCondition(actor, effect) {
    await EffectDuration.finalizeEffect(effect);
    await actor.addCondition(effect);
    return true;
  }

  static #normalizeAfterUse(afterUse) {
    const followup = duplicate(afterUse);
    followup.duration = EffectDuration.durationInSeconds(followup.duration);
    return followup;
  }

  static #scopedRuleValue(type, data) {
    if (type == 'modifier') return { changes: duplicate(data.changes || []) };
    if (type == 'restriction') return { restrictions: duplicate(data.restrictions || []) };
    return {};
  }

  static #scopedRuleData(data) {
    const ruleData = {};
    for (const key of ['requiresManeuver', 'requiresNoManeuver', 'requiresOpponentManeuver', 'maneuverTypes', 'clearOnWeaponReady']) {
      if (data[key] !== undefined) ruleData[key] = duplicate(data[key]);
    }
    return ruleData;
  }

  static #scopeIdentifiers(data) {
    if (Array.isArray(data.identifiers)) return duplicate(data.identifiers);
    if (data.scope == 'self') return ['self'];
    if (['incomingAttack', 'allOpponents'].includes(data.scope)) return ['all'];

    const identifiers = [];
    if (data.target?.scene && data.target?.token) identifiers.push(`Scene.${data.target.scene}.Token.${data.target.token}`);
    if (data.target?.actor) identifiers.push(`Actor.${data.target.actor}`);
    return identifiers;
  }
}
