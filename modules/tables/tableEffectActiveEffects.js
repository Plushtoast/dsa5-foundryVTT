import OnUseEffect from '../system/automation/onUseEffects.js';
import ActiveEffectScopedRules from '../status/active_effect_scoped_rules.js';
import DSATables from './dsatables.js';
const { duplicate, getProperty } = foundry.utils;

export default class TableEffectActiveEffects {
  static registerHooks() {
    Hooks.on('updateItem', (item, changes) => {
      this.clearWeaponReadyRestrictions(item, changes)
      this.clearWeaponRepairPenalties(item, changes)
    });
  }

  static metadata(effect) {
    return getProperty(effect, 'flags.dsa5.tableEffect');
  }

  static activeEntries(actor, type) {
    if (['modifier', 'restriction', 'scopedModifier', 'scopedRestriction'].includes(type)) return [];

    return (actor?.effects || []).reduce((entries, effect) => {
      if (effect.disabled || effect.isDepleted?.()) return entries;

      const data = this.metadata(effect);
      if (!data?.type || (type && data.type != type)) return entries;
      if (['scopedModifier', 'scopedRestriction'].includes(data.type)) return entries;

      entries.push({ effect, data });
      return entries;
    }, []);
  }

  static async applyAfterUse(effect) {
    if (effect.disabled) return;

    const actor = effect.parent?.documentName == 'Actor' ? effect.parent : null;
    const configuredFollowups = getProperty(effect, 'system.useLifecycle.afterUse');
    const followups = Array.isArray(configuredFollowups) ? configuredFollowups : Object.values(configuredFollowups || {});
    if (!actor || !followups.length) return;
    if ([...actor.effects].some((actorEffect) => getProperty(actorEffect, 'flags.dsa5.afterUse.sourceUuid') == effect.uuid)) return;

    const effects = [];
    for (const followup of followups) {
      if (!followup?.changes?.length) continue;

      const afterUseEffect = OnUseEffect.effectBaseDummy(followup.name || _loc('botchCritEffect'), duplicate(followup.changes), followup.duration || {});
      afterUseEffect.flags.dsa5.afterUse = { sourceUuid: effect.uuid };
      await DSATables.finalizeEffect(afterUseEffect);
      effects.push(afterUseEffect);
    }

    if (effects.length) await actor.createEmbeddedDocuments('ActiveEffect', effects);
  }

  static async create(actor, type, data, duration = {}, options = {}) {
    const effect = OnUseEffect.effectBaseDummy(options.name || _loc('botchCritEffect'), [], duration || {});
    effect.flags.dsa5.tableEffect = {
      type,
      ...duplicate(data),
    };
    if (options.charges) effect.system.charges = duplicate(options.charges);

    await DSATables.finalizeEffect(effect);
    const created = await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    return created[0];
  }

  static createScopedModifier(actor, data, duration) {
    return this.createScopedRule(actor, 'modifier', data, duration);
  }

  static createScopedRestriction(actor, data, duration) {
    return this.createScopedRule(actor, 'restriction', data, duration);
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

    await DSATables.finalizeEffect(effect);
    const created = await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    return created[0];
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

  static async clearWeaponReadyRestrictions(item, changes) {
    if (item.type != 'rangeweapon') return;
    const changedProgress = changes?.['system.reloadTime.progress'] ?? getProperty(changes, 'system.reloadTime.progress');
    if (changedProgress === undefined) return;

    const actor = item.actor || item.parent;
    if (!actor?.isOwner) return;

    const progress = Number(item.system.reloadTime.progress) || 0;
    const reloadTime = Number(item.LZ ?? item.system.reloadTime.value) || 0;
    if (progress < reloadTime) return;

    const effectIds = ActiveEffectScopedRules.activeEntries(actor, 'restriction')
      .filter(({ data }) => data.clearOnWeaponReady && data.sourceUuid == item.uuid)
      .map(({ effect }) => effect.id);
    if (effectIds.length) await actor.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  }

  static async clearWeaponRepairPenalties(item, changes) {
    if (!['meleeweapon', 'rangeweapon'].includes(item.type)) return;
    const changedStructure = changes?.['system.structure.value'] ?? getProperty(changes, 'system.structure.value');
    if (changedStructure === undefined) return;

    const structure = item.system.structure;
    if (!structure || Number(structure.value) < Number(structure.max)) return;

    const effectIds = [...item.effects]
      .filter((effect) => this.metadata(effect)?.type == 'weaponRepairPenalty')
      .map((effect) => effect.id);
    if (effectIds.length) await item.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  }

  static createManeuverPenaltyIgnore(actor, value, duration) {
    const compensation = Math.max(0, Number(value) || 0);
    if (!compensation) return undefined;

    const effect = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), [{ key: 'system.skillModifiers.combat.CMP', mode: 2, value: `maneuver:* ${compensation}` }], duration || {});
    effect.system.charges = { value: 1, max: 1 };
    return this.createEffect(actor, effect);
  }

  static async createEffect(actor, effect) {
    await DSATables.finalizeEffect(effect);
    const created = await actor.createEmbeddedDocuments('ActiveEffect', [effect]);
    return created[0];
  }

  static createDefenseCountModifier(actor, data, duration) {
    const floor = Number(data?.floor);
    if (!Number.isFinite(floor)) return undefined;

    const effect = OnUseEffect.effectBaseDummy(data.name || _loc('botchCritEffect'), [{ key: 'system.skillModifiers.combat.defenseCount', mode: 2, value: `* ${floor}` }], duration || {});
    effect.system.charges = { value: 1, max: 1 };
    if (data?.afterUse) effect.system.useLifecycle = { afterUse: { [foundry.utils.randomID()]: this.#normalizeAfterUse(data.afterUse) } };
    return this.createEffect(actor, effect);
  }

  static createAttackPenaltyReduction(actor, data, duration) {
    const compensation = Math.max(0, Number(data?.value) || 0);
    if (!compensation) return undefined;

    const effect = OnUseEffect.effectBaseDummy(data.name || _loc('botchCritEffect'), [{ key: 'system.skillModifiers.combat.CMP', mode: 2, value: `attack:* ${compensation}` }], duration || {});
    if (data?.afterUse) effect.system.useLifecycle = { afterUse: { [foundry.utils.randomID()]: this.#normalizeAfterUse(data.afterUse) } };
    return this.createEffect(actor, effect);
  }

  static #normalizeAfterUse(afterUse) {
    const followup = duplicate(afterUse);
    followup.duration = this.#durationInSeconds(followup.duration);
    return followup;
  }

  static #durationInSeconds(duration = {}) {
    const seconds = Number(duration.seconds);
    if (Number.isFinite(seconds) && seconds > 0) return { seconds };

    const rounds = Number(duration.rounds);
    if (Number.isFinite(rounds) && rounds > 0) return { seconds: rounds * (CONFIG.time.roundTime || 5) };

    const value = Number(duration.value);
    if (duration.units == 'seconds' && Number.isFinite(value) && value > 0) return { seconds: value };

    return {};
  }
}
