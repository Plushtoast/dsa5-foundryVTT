import SpecialabilityRulesDSA5 from '../rules/specialability-rules-dsa5.js';

/**
 * Temporary item coatings (silvering, blackening): unique per weapon, charges and/or duration.
 */
export default class TreatmentHelper {
  static APPLY_MODES = {
    craft: 'Enhancement.applyModes.craft',
    instant: 'Enhancement.applyModes.instant',
  };

  static CONSUME_ON = {
    none: 'Enhancement.consumeOn.none',
    attack: 'Enhancement.consumeOn.attack',
  };

  static CHARGE_MULTIPLIER_DEFAULT = 3;

  static isTreatment(effect) {
    return effect?.type === 'enhancement' && effect.system?.enhancementType === 'treatment';
  }

  static isDurationExpired(effect) {
    if (effect?.duration?.expired) return true;
    const remaining = effect?.duration?.remaining ?? effect?.duration?.secondsRemaining;
    return Number.isFinite(remaining) && remaining <= 0;
  }

  static isActive(effect) {
    if (!effect || effect.disabled) return false;
    if (!this.isTreatment(effect)) return true;
    if (this.isDurationExpired(effect)) return false;
    const charges = effect.system?.charges;
    if (charges && Number.isFinite(charges.value) && charges.value <= 0) return false;
    return true;
  }

  static #sourceDuration(treatmentSource) {
    const raw = treatmentSource?._source?.duration ?? treatmentSource?.duration ?? {};
    const value = Number(raw.value);
    if (Number.isFinite(value) && value > 0) {
      const duration = { value, units: raw.units || 'seconds' };
      if (raw.expiry) duration.expiry = raw.expiry;
      return duration;
    }
    const seconds = Number(raw.seconds || treatmentSource?.system?.durationSeconds) || 0;
    if (seconds > 0) return { value: seconds, units: 'seconds' };
    return null;
  }

  static findOnItem(item, treatmentId) {
    if (!item || !treatmentId) return null;
    return [...(item.effects ?? [])].find((effect) =>
      this.isTreatment(effect) && effect.system?.treatmentId === treatmentId);
  }

  static qualityFormula(system, qualityStep) {
    const charges = system?.qualityCharges;
    if (!charges || qualityStep == null) return '';
    const step = Number(qualityStep);
    return charges[`qs${step}`] || charges[String(step)] || charges[step] || '';
  }

  static async resolveCharges(system, { qualityStep, actor, charges } = {}) {
    if (Number.isFinite(charges)) return Math.max(0, Math.floor(charges));

    const formula = this.qualityFormula(system, qualityStep);
    if (!formula) return null;

    const roll = await new Roll(String(formula)).evaluate();
    let value = Number(roll.total) || 0;
    const ability = system.chargeMultiplierAbility;
    if (ability && actor && SpecialabilityRulesDSA5.hasAbility(actor, ability)) {
      const factor = Number(system.chargeMultiplier) || this.CHARGE_MULTIPLIER_DEFAULT;
      value *= factor;
    }
    return Math.max(0, Math.floor(value));
  }

  static async #splitAmmo(item, count) {
    const qty = Number(item.system?.quantity?.value) || 0;
    const take = Math.max(1, Math.min(Number(count) || 1, qty || 1));
    if (!item.actor || take >= qty) return item;

    const data = item.toObject();
    delete data._id;
    data.system.quantity.value = take;
    await item.update({ 'system.quantity.value': qty - take });
    const [created] = await item.actor.createEmbeddedDocuments('Item', [data]);
    return created;
  }

  /**
   * Apply a treatment enhancement onto an existing item (replace same treatmentId).
   * @returns {Promise<{ item: Item, effect: ActiveEffect }>}
   */
  static async applyToItem(item, treatmentSource, { actor, qualityStep, charges, replace = true } = {}) {
    if (!item || !treatmentSource) return { item, effect: null };

    const system = foundry.utils.deepClone(treatmentSource.system || {});
    system.enhancementType = 'treatment';
    system.targetType = item.type;
    if (!system.changes?.length) {
      const sourceChanges = treatmentSource.changes || treatmentSource.system?.changes;
      if (sourceChanges?.length) system.changes = foundry.utils.deepClone(sourceChanges);
    }
    const treatmentId = system.treatmentId;

    let target = item;
    if (item.type === 'ammunition') {
      target = await this.#splitAmmo(item, system.treatmentQuantity || 1);
    }

    if (replace && treatmentId) {
      const existing = [...target.effects].filter((effect) =>
        this.isTreatment(effect) && effect.system?.treatmentId === treatmentId);
      if (existing.length) {
        await target.deleteEmbeddedDocuments('ActiveEffect', existing.map((effect) => effect.id));
      }
    }

    delete system.durationSeconds;

    const chargeValue = await this.resolveCharges(system, { qualityStep, actor, charges });
    if (Number.isFinite(chargeValue)) {
      system.charges = { value: chargeValue, max: chargeValue };
    }

    const effectData = {
      name: treatmentSource.name,
      img: treatmentSource.img || 'systems/dsa5/icons/talents/Metallbearbeitung.webp',
      type: 'enhancement',
      transfer: false,
      disabled: false,
      showIcon: CONST.ACTIVE_EFFECT_SHOW_ICON?.NONE ?? 0,
      description: treatmentSource.description || '',
      system,
    };
    const duration = this.#sourceDuration(treatmentSource);
    if (duration) {
      effectData.duration = duration;
      effectData.start = CONFIG.ActiveEffect.documentClass.getEffectStart();
    }

    const [effect] = await target.createEmbeddedDocuments('ActiveEffect', [effectData]);
    return { item: target, effect };
  }

  static async consumeOnAttack(item) {
    if (!item) return;
    for (const effect of [...item.effects]) {
      if (!this.isTreatment(effect) || !this.isActive(effect)) continue;
      if (effect.system?.consumeOn !== 'attack') continue;
      if (typeof effect.consumeCharges === 'function') {
        await effect.consumeCharges(1, { createChatMessage: true });
      }
    }
  }

  static async consumeFromTest(actor, testData) {
    if (!actor || testData?.mode !== 'attack') return;
    const source = testData.source;
    if (!source) return;

    const weapon = actor.items.get(source._id || source.id);
    const ammo = testData.extra?.ammo;
    const ammoItem = ammo ? actor.items.get(ammo._id || ammo.id) : null;
    if (weapon) await this.consumeOnAttack(weapon);
    if (ammoItem && ammoItem.id !== weapon?.id) await this.consumeOnAttack(ammoItem);
  }

  static statusLabel(effect) {
    if (!this.isTreatment(effect)) return '';
    if (effect.disabled || this.isDurationExpired(effect)) return _loc('Enhancement.treatmentExpired');
    const charges = effect.system?.charges;
    if (charges && Number.isFinite(charges.value)) {
      return _loc('Enhancement.treatmentCharges', { value: charges.value, max: charges.max ?? charges.value });
    }
    const duration = effect.duration;
    if (duration?.label && Number.isFinite(duration.remaining) && duration.remaining > 0) {
      return duration.label;
    }
    return '';
  }
}
