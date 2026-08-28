export default class EnhancementHelper {
  static ACTOR_CHANGE_REGEX = /^@actor\./;
  static ANCHORED_SPELL_REDUCTION_KEY = 'system.powersource.anchoredSpellReduction';
  static BREAK_POINT_RATING_KEY = 'system.structure.breakPointRating';

  static ARTIFACT_KEYS = new Set([
    'system.powersource.anchoredSpellReduction',
  ]);

  static getEffectChanges(effect) {
    return effect?.system?.changes ?? effect?.changes ?? [];
  }

  /** @see StructureTemplate#defaultBreakPointRating */
  static defaultBreakPointRating(item) {
    return item?.system?.defaultBreakPointRating;
  }

  /** @see StructureTemplate#ensureBreakPointRating */
  static ensureBreakPointRating(item) {
    return item?.system?.ensureBreakPointRating?.();
  }

  static isActorChange(change) {
    return !!change?.key && this.ACTOR_CHANGE_REGEX.test(change.key);
  }

  static isArtifactChange(change) {
    return !!change?.key && this.ARTIFACT_KEYS.has(change.key);
  }

  static isItemChange(change) {
    if (!change?.key?.startsWith('system.')) return false;
    if (this.isArtifactChange(change)) return false;
    return true;
  }

  static isPowersourceEffect(effect) {
    return effect?.type === 'enhancement'
      && effect.system?.enhancementType === 'powersource'
      && !effect.disabled;
  }

  static #effectId(effect) {
    return typeof effect === 'string' ? effect : effect?.id;
  }

  static getSlotLimits(item) {
    return item?.system?.constructor?.ENHANCEMENT_SLOT_LIMITS ?? {};
  }

  static getUsedSlots(item, enhancementType, { exclude } = {}) {
    const excludeId = this.#effectId(exclude);
    return [...(item?.effects ?? [])]
      .filter((effect) => effect.type === 'enhancement'
        && effect.system?.enhancementType === enhancementType
        && effect.id !== excludeId)
      .reduce((sum, effect) => sum + (Number(effect.system?.slotCost) || 1), 0);
  }

  static hasAvailableSlot(item, { enhancementType, slotCost = 1, exclude } = {}) {
    const maxSlots = this.getSlotLimits(item)[enhancementType] ?? 0;
    if (maxSlots <= 0) return false;
    return this.getUsedSlots(item, enhancementType, { exclude }) + (Number(slotCost) || 1) <= maxSlots;
  }

  static formatActorChangeValue(change, item) {
    const value = `${change.value ?? ''}`.trim();
    if (!value) return value;
    if (!value.includes(' ') && /^[\dWwDd+\-]+/i.test(value)) {
      return `${item.name} ${value}`;
    }
    return value;
  }

  static collectActorChanges(actor, { phase = 'initial', shouldApply } = {}) {
    const changes = [];
    if (!actor?.items) return changes;

    for (const item of actor.items) {
      for (const effect of item.effects) {
        if (effect.type !== 'enhancement' || effect.disabled) continue;
        if (shouldApply && !shouldApply(item, effect)) continue;

        const actorChanges = this.getEffectChanges(effect).filter((change) => this.isActorChange(change));
        if (!actorChanges.length) continue;

        const multiply = Number(item.system?.effectMultiplier) || 1;
        for (let i = 0; i < multiply; i++) {
          changes.push(
            ...actorChanges
              .filter((change) => (change.phase || 'initial') === phase)
              .map((change) => ({
                ...change,
                key: change.key.replace(this.ACTOR_CHANGE_REGEX, ''),
                value: this.formatActorChangeValue(change, item),
                effect,
              })),
          );
        }
      }
    }

    return changes;
  }

  static preparePowersources(actor, { shouldApply } = {}) {
    const segments = [];
    if (actor?.items) {
      for (const item of actor.items) {
        for (const effect of item.effects) {
          if (!this.isPowersourceEffect(effect)) continue;
          if (shouldApply && !shouldApply(item, effect)) continue;
          const ps = effect.system.powersource;
          if (!ps || !(ps.max > 0)) continue;
          segments.push({
            itemId: item.id,
            effectId: effect.id,
            label: `${item.name} (${effect.name})`,
            name: effect.name,
            itemName: item.name,
            value: Number(ps.value) || 0,
            max: Number(ps.max) || 0,
          });
        }
      }
    }

    const byItemId = {};
    for (const segment of segments) {
      if (!byItemId[segment.itemId]) {
        byItemId[segment.itemId] = {
          itemId: segment.itemId,
          itemName: segment.itemName,
          segments: [],
        };
      }
      byItemId[segment.itemId].segments.push(segment);
    }

    actor.powersource = {
      value: segments.reduce((sum, segment) => sum + segment.value, 0),
      max: segments.reduce((sum, segment) => sum + segment.max, 0),
      segments,
      byItemId,
    };
    return actor.powersource;
  }

  static getAnchoredSpellReduction(item) {
    if (!item) return { reduction: 0, label: '' };

    let reduction = 0;
    let label = '';
    for (const effect of item.effects) {
      if (!this.isPowersourceEffect(effect)) continue;
      for (const change of this.getEffectChanges(effect)) {
        if (!this.isArtifactChange(change)) continue;
        if (change.key !== this.ANCHORED_SPELL_REDUCTION_KEY) continue;
        reduction += Math.abs(Number(change.value) || 0);
        label = effect.name;
      }
    }
    return { reduction, label };
  }

  static getAnchoredSpellChargeCost(spellCost, item) {
    const { reduction } = this.getAnchoredSpellReduction(item);
    return Math.max(1, Number(spellCost) - reduction);
  }

  static findPowersourceEffect(item) {
    if (!item?.effects?.length) return null;
    return item.effects.find((effect) =>
      this.isPowersourceEffect(effect)
      && effect.system?.powersource?.max > 0,
    ) ?? null;
  }

  static applyItemStructure(item) {
    if (!item || item.structureMax) return item;
    const ps = this.findPowersourceEffect(item)?.system?.powersource;
    if (!ps || !(ps.max > 0)) return item;
    item.structureMax = Number(ps.max) || 0;
    item.structureCurrent = Number(ps.value) || 0;
    return item;
  }
}
