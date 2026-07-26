import OnUseEffect from '../system/automation/onUseEffects.js';
import ActiveEffectScopedRules from './active_effect_scoped_rules.js';
import EffectDuration from './effectDuration.js';

const { duplicate, getProperty } = foundry.utils;

export default class ActiveEffectLifecycle {
  static registerHooks() {
    Hooks.on('updateItem', (item, changes) => {
      this.clearWeaponReadyRestrictions(item, changes);
      this.clearWeaponRepairPenalties(item, changes);
    });
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
      await EffectDuration.finalizeEffect(afterUseEffect);
      effects.push(afterUseEffect);
    }

    if (effects.length) await actor.createEmbeddedDocuments('ActiveEffect', effects);
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
      .filter((effect) => getProperty(effect, 'flags.dsa5.tableEffect.type') == 'weaponRepairPenalty')
      .map((effect) => effect.id);
    if (effectIds.length) await item.deleteEmbeddedDocuments('ActiveEffect', effectIds);
  }
}
