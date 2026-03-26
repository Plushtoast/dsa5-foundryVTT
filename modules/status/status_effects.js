import DSA5ChatListeners from '../system/sidebar/chat_listeners.js';
import DSA5 from '../config/config-dsa5.js';
import CreatureType from '../system/automation/creature-type.js';

import TraitRulesDSA5 from '../system/rules/trait-rules-dsa5.js';
const { duplicate, getProperty, expandObject } = foundry.utils;

export default class DSA5StatusEffects {
  static bindButtons(html) {
    const conditions = html.find('.chat-condition');
    conditions.each(function (i, cond) {
      cond.setAttribute('draggable', true);
      cond.addEventListener('dragstart', (ev) => {
        const dataTransfer = {
          data: {
            type: 'condition',
            payload: {
              id: ev.currentTarget.dataset.id,
            },
          },
        };
        ev.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
      });
    });
    conditions.on('click', (ev) => DSA5ChatListeners.postStatus(ev.currentTarget.dataset.id));
  }

  static lockedCondition() {
    const lock = _loc('MERCHANT.locked');
    return {
      id: 'locked',
      name: lock,
      img: 'icons/svg/padlock.svg',
      system: {
        description: lock,
        visibility: {
          hidePlayers: true,
        },
      },
    };
  }

  static async createCustomEffect(owner, description = '', name) {
    name = name || _loc('CONDITION.custom');
    if (description == '') description = name;

    const effect = await owner.addCondition({
      name,
      img: 'icons/svg/aura.svg',
      origin: owner.uuid,
      system: {
        description,
      },
    });
    const sheet = effect[0]?.sheet;

    if (sheet) await sheet.render(true);
    else if(typeof effect === 'string') ui.notifications.error(effect);
  }

  static async prepareActiveEffects(target, data) {
    data.conditions = [];
    data.transferedConditions = [];
    data.cumulativeConditions = [];
    data.manualConditions = duplicate(CONFIG.statusEffects);

    const efMap = new Map(DSA5.statusEffects.map((e) => [e.id, e]));
    const isGM = game.user.isGM;

    for (const cnd of target.allApplicableEffects()) {
      if (!isGM && cnd.system.visibility.hidePlayers) continue;
      if (cnd.notApplicable) continue;

      const condition = cnd.toObject();

      if (cnd.parent?.documentName != 'Item') {
        const conditionData = cnd.system.condition;
        condition.boolean = conditionData.value == null;

        const statusesId = cnd.statuses ? [...cnd.statuses][0] : null;
        if (statusesId) {
          condition.value = conditionData.value;
          condition.editable = conditionData.max;
          condition.descriptor = statusesId;
          condition.manual = conditionData.manual;
        }
        await DSA5StatusEffects.enrichSheetEffect(condition, cnd);
        data.conditions.push(condition);
      } else {
        condition.uuid = cnd.uuid;
        condition.parent = {
          uuid: cnd.parent?.uuid,
          name: cnd.parent?.name,
          id: cnd.parent?.id,
        };
        data.transferedConditions.push(condition);
      }
    }

    const conds = target.system?.condition || {};
    for (const [key, val] of Object.entries(conds)) {
      if (!val) continue;

      const ef = efMap.get(key);
      if (!ef) continue;

      data.cumulativeConditions.push({
        img: ef.img,
        id: key,
        name: _loc(ef.name),
        value: val,
      });
    }
  }

  static async enrichSheetEffect(effectData, sourceEffect) {
    effectData.pips = [];

    const duration = sourceEffect.duration;
    if (duration.units === 'seconds' && typeof duration.value === 'number') {
      let timeRemaining;

      if (sourceEffect.start && Number.isFinite(duration.seconds) && game.time.calendar instanceof game.dsa5.apps.WorldCalendar) {
        const endTime = sourceEffect.start.time + duration.seconds;
        if (endTime > game.time.worldTime) {
          const components = game.time.calendar.difference(endTime);
          timeRemaining = await game.time.calendar.format(components, 'formatRemaining');
        }
      }

      if (timeRemaining) {
        effectData.pips.push({
          content: `<i class="fas fa-clock"></i> ${timeRemaining}`
        });
      }
    } else if (typeof duration.value === 'number') {
      effectData.pips.push({
        content: `<i class="fas fa-clock"></i> ${duration.label}`
      });
    }

    for (const status of sourceEffect.statuses) {
      const systemEffect = CONFIG.statusEffects.find(stat => stat.id == status);
      if (!systemEffect) continue;

      effectData.pips.push({
        category: 'systemEffect',
        id: status,
        content: _loc(systemEffect.name)
      });
    }

    const delayedData = sourceEffect.system?.delayed;
    const isDelayed = !!delayedData?.enabled;
    if (isDelayed) {
      effectData.pips.push({
        content: `<i data-tooltip="ActiveEffects.onDelayed" class="grayIcon fas fa-hourglass-half"></i>`
      });
    }

    if (sourceEffect.flags?.dsa5?.maintain) {
      effectData.pips.push({
        content: `<i data-tooltip="maintainCost" class="fas fa-sync"></i> ${sourceEffect.flags?.dsa5?.maintain} ${_loc(`CHARAbbrev.${sourceEffect.flags?.dsa5?.payType}`)}`
      });
    }
  }

  static async addCondition(target, effect, value = 1, absolute = false, auto = true) {
    if (!target.isOwner) return _loc('DSAError.elementNotOwned');
    if (target.inCompendium) return _loc('DSAError.canNotEditInCompendium');
    if (absolute && value < 1) return this.removeCondition(target, effect, value, auto, absolute);
    if (typeof effect === 'string') effect = duplicate(CONFIG.statusEffects.find((e) => e.id == effect));
    if (!effect) return _loc('DSAError.noEffectFound');

    let existing = this.hasCondition(target, effect.id);

    if (existing && existing.system.condition.value == null) return existing;
    else if (existing) return await DSA5StatusEffects.updateEffect(target, existing, value, absolute, auto, effect);

    return await DSA5StatusEffects.createEffect(target, effect, value, auto);
  }

  static hasCondition(target, conditionKey) {
    if (target != undefined && conditionKey) {
      if (!target.effects) return false;

      return target.effects.find((i) => i.statuses.has(conditionKey));
    }
    return false;
  }

  static async removeCondition(target, effect, value = 1, auto = true, absolute = false) {
    if (!target.isOwner) return _loc('DSAError.elementNotOwned');
    if (typeof effect === 'string') effect = duplicate(CONFIG.statusEffects.find((e) => e.id == effect));
    if (!effect) return _loc('DSAError.noEffectFound');

    let existing = this.hasCondition(target, effect.id);

    if (existing && existing.system.condition.value == null) {
      if (target.token) target = target.token.actor;
      const res = await target.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
      //Hooks.call("deleteActorActiveEffect", target, existing)
      return res;
    } else if (existing) return await DSA5StatusEffects.removeEffect(target, existing, value, absolute, auto);
  }

  static immuneToEffect(target, effect, silent = true) {
    if (!effect.id || effect.system.condition.max == null) return;

    const immunities = getProperty(target, 'system.immunities') || [];
    let res;
    if (immunities.includes(effect.id)) {
      res = {
        name: target.name,
        condition: _loc(`CONDITION.${effect.id}`),
      };
    }
    if (!res && target.documentName == 'Actor') {
      const types = CreatureType.detectCreatureType(target);
      for (let type of types) {
        if (type.ignoredCondition(effect.id)) {
          res = {
            name: `${target.name} (${type.getName()})`,
            condition: _loc(`CONDITION.${effect.id}`),
          };
          break;
        }
      }
    }
    if (!res || !(ui.notifications && !silent)) return;

    const msg = _loc('DSAError.conditionInvalidToCreature', {
      name: res.name,
      condition: res.condition,
    });
    ui.notifications.warn(msg);
  }

  static resistantToEffect(target, effectId) {
    return this.collectModificationToEffect(target, effectId, 'system.resistances.effects');
  }

  static thresholdToEffect(target, effectId) {
    return this.collectModificationToEffect(target, effectId, 'system.thresholds.effects');
  }

  static collectModificationToEffect(target, effectId, key) {
    if (!effectId) return 0;

    const modifications = getProperty(target, key) || [];
    return modifications.reduce((res, val) => {
      if (val.target == effectId) res += Number(val.value);
      return res;
    }, 0);
  }

  static async createEffect(actor, effect, value, auto) {
    //const immune = this.immuneToEffect(actor, effect)
    effect.name = _loc(effect.name);
    this.immuneToEffect(actor, effect, false);
    //if (immune) return immune

    effect.system ??= {};
    effect.system.condition ??= {};
    const conditionData = effect.system.condition;

    // Stack math only applies to cumulative conditions that define a max level.
    if (conditionData.max != null) {
      const max = Number(conditionData.max ?? 4);
      if (auto) {
        conditionData.auto = Math.min(max, value);
        conditionData.manual = 0;
      } else {
        conditionData.manual = Math.min(max, value);
        conditionData.auto = 0;
      }

      conditionData.value = Math.min(4, Number(conditionData.manual || 0) + Number(conditionData.auto || 0));
    }

    if (effect.id) effect.statuses = [effect.id];

    if (effect.id == 'dead') effect['flags.core.overlay'] = true;

    const update = duplicate(effect);

    (game.dsa5.config.statusEffectClasses[effect.id] || DSA5StatusEffects).levelDependentEffects(effect, update);

    let result = await actor.createEmbeddedDocuments('ActiveEffect', [update]);
    delete effect.id;
    return result;
  }

  static async removeEffect(actor, existing, value, absolute, autoMode) {
    const existingData = existing.system.condition;
    const max = Number(existingData.max ?? 4);
    const auto = autoMode ? (absolute ? value : Math.max(0, Number(existingData.auto || 0) - value)) : Number(existingData.auto || 0);
    const manual = autoMode ? Number(existingData.manual || 0) : absolute ? value : Number(existingData.manual || 0) - value;
    const update = {
      system: {
        condition: {
          auto,
          manual,
          value: Math.max(0, Math.min(max, manual + auto)),
        },
      },
    };
    if (update.system.condition.auto < 1 && update.system.condition.manual == 0) return await actor.deleteEmbeddedDocuments('ActiveEffect', [existing.id]);
    else {
      (game.dsa5.config.statusEffectClasses[[...existing.statuses][0]] || DSA5StatusEffects).levelDependentEffects(existing, update);
      return await existing.update(update);
    }
  }

  static async levelDependentEffects() { }

  static async updateEffect(actor, existing, value, absolute, auto, newEffect = undefined) {
    //const immune = this.immuneToEffect(actor, existing, true)
    this.immuneToEffect(actor, existing, true);
    //if (immune) return immune
    const existingData = existing.system.condition;
    const max = Number(existingData.max ?? 4);
    let delta, newValue;
    let update;
    if (auto) {
      newValue = Math.min(max, absolute ? value : Number(existingData.auto || 0) + value);
      delta = newValue - Number(existingData.auto || 0);
      update = {
        system: { condition: { auto: newValue, manual: Number(existingData.manual || 0) } },
      };
    } else {
      newValue = absolute ? value : Number(existingData.manual || 0) + value;
      delta = newValue - Number(existingData.manual || 0);
      update = {
        system: { condition: { manual: newValue, auto: Number(existingData.auto || 0) } },
      };
    }

    if (delta == 0) return existing;

    update.system.condition.value = Math.max(0, Math.min(max, update.system.condition.manual + update.system.condition.auto));
    if (newEffect.duration) {
      update.duration = newEffect.duration;
      update.start = { time: game.time.worldTime };
    }

    (game.dsa5.config.statusEffectClasses[[...existing.statuses][0]] || DSA5StatusEffects).levelDependentEffects(existing, update);

    await existing.update(update);
    return existing;
  }

  static calculateRollModifier(effect, actor, item, options = {}) {
    if (effect.system.condition.value == null || item.type == 'regenerate') return 0;

    return DSA5StatusEffects.clampedCondition(actor, effect);
  }

  static clampedCondition(actor, effect) {
    const statusesId = [...effect.statuses][0];
    if (!statusesId) return 0;

    const max = Number(effect.system.condition.max);
    const mod = Math.clamp(actor.system.condition[statusesId] || 0, 0, max) * -1;
    const resist = this.resistantToEffect(actor, statusesId);
    const threshold = this.thresholdToEffect(actor, statusesId) * -1;
    const clamped = Math.clamp(mod + resist, -1 * max, 0);

    return clamped < threshold ? clamped : 0;
  }

  static ModifierIsSelected(item, options = {}, actor, coreID) {
    const types = CreatureType.detectCreatureType(actor);
    for (let type of types) {
       if (type.ignoredCondition(coreID)) {
          return false;
       }
    }
    return options.mode != 'damage';
  }

  static getDamageBonus() {
    return 0;
  }

  static getRollModifiers(actor, item, options = {}) {
    const source = _loc('status') + '/' + _loc('condition');
    const result = [];
    const finishedCoreIds = [];

    for (let [key, val] of Object.entries(actor.system.condition)) {
      if (val) {
        const ef = duplicate(DSA5.statusEffects.find((x) => x.id == key));

        if (!ef) continue;

        const effectClass = game.dsa5.config.statusEffectClasses[key] || DSA5StatusEffects;
        ef.system.condition.value = val;

        ef.statuses = [key];
        const value = effectClass.calculateRollModifier(ef, actor, item, options);

        finishedCoreIds.push(key);

        if (value != 0) {
          result.push({
            name: _loc(ef.name),
            value,
            selected: effectClass.ModifierIsSelected(item, options, actor, key),
            source,
          });
        }
      }
    }

    for (const ef of actor.effects) {
      if (ef.disabled) continue;
      const charges = ef.system?.charges;
      if (charges) {
        const value = Number(charges.value);
        if (Number.isFinite(value) && value <= 0) continue;
      }

      for (const coreId of [...ef.statuses]) {
        if (finishedCoreIds.includes(coreId)) continue;

        const effectClass = game.dsa5.config.statusEffectClasses[coreId] || DSA5StatusEffects;
        const value = effectClass.calculateRollModifier(ef, actor, item, options);

        if (value != 0) {
          result.push({
            name: ef.name,
            value,
            selected: effectClass.ModifierIsSelected(item, options, actor, coreId),
            source,
            effectId: ef.id,
            effectUuid: ef.uuid,
          });
        }
      }
    }

    const playerOwned = actor.hasPlayerOwner;
    const globalMods = game.settings.get('dsa5', 'masterSettings').globalMods || {};

    for (const key of Object.keys(globalMods)) {
      const ef = expandObject(globalMods[key]);

      if (!ef.enabled || !ef.target || !ef.target[item.type]) continue;

      if (playerOwned) {
        if (!ef.victim?.player) continue;
      } else {
        if (!ef.victim?.npc) continue;
      }

      result.push({
        name: ef.name,
        value: ef.value,
        selected: true,
        source: _loc('MASTER.globalMods'),
      });
    }
    return result;
  }
}

class EncumberedEffect extends DSA5StatusEffects {
  static ModifierIsSelected(item, options = {}, actor, coreID) {
    const burdenedSkill = item.type == 'skill' && item.system.burden.value == 'yes';
    const rangeWeaponEnabled = ['rangeweapon'].includes(item.type) && options.mode != 'damage' && game.settings.get('dsa5', 'encumbranceForRange');
    const attack = !['skill', 'spell', 'ritual', 'ceremony', 'liturgy', 'rangeweapon'].includes(item.type) && options.mode != 'damage';
    return burdenedSkill || attack || rangeWeaponEnabled || super.ModifierIsSelected(item, options, actor, coreID);
  }

  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    return item.type == 'skill' && item.system.burden.value == 'no' ? 0 : super.calculateRollModifier(effect, actor, item, options);
  }
}

class ProneEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    else if (item.type == 'dodge') return -2;
    return options.mode ? (options.mode == 'attack' ? -4 : -2) : 0;
  }
}

class RaptureEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    const regex = new RegExp(`${_loc('TYPES.Item.combatskill')} `, 'gi');
    const happyTalents = actor.system.happyTalents.value.split(/;|,/).map((x) => x.replace(regex, '').trim());
    if (
      (happyTalents.includes(item.name) && ['skill', 'combatskill'].includes(item.type)) ||
      (['rangeweapon', 'meleeweapon'].includes(item.type) && happyTalents.includes(item.system.combatskill.value)) ||
      ['ceremony', 'liturgy'].includes(item.type)
    ) {
      return this.clampedCondition(actor, effect) * -1 - 1;
    }

    if (['ritual', 'spell', 'skill', 'combatskill'].includes(item.type)) return this.clampedCondition(actor, effect);

    if (item.type == 'regenerate') return 0;
    return 0;
  }
}

class DeafEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    return item.type == 'skill' && item.name == _loc('LocalizedIDs.perception') ? -3 : 0;
  }
}

class FixatedEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    return item.type == 'dodge' ? -4 : 0;
  }
}

class BloodrushEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    if (item.type == 'skill') return item.name == _loc('LocalizedIDs.featOfStrength') ? 2 : 0;

    return options.mode == 'attack' ? 4 : 0;
  }
}

class PainEffect extends DSA5StatusEffects {
  static ModifierIsSelected(item, options = {}, actor, coreID) {
    if (TraitRulesDSA5.hasTrait(actor, 'LocalizedIDs.painImmunity')) return false;
    if (actor.effects.some((x) => Array.from(x.statuses).includes('bloodrush'))) return false;

    return super.ModifierIsSelected(item, options, actor, coreID);
  }
}

class TranceEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    const condition = Number(this.clampedCondition(actor, effect));

    if (condition >= -1) return 0;
    if (condition <= -3) return -3;

    if (condition == -2) {
      const regex = new RegExp(`${_loc('TYPES.Item.combatskill')} `, 'gi');
      const happyTalents = actor.system.happyTalents.value.split(/;|,/).map((x) => x.replace(regex, '').trim());
      const isFavored =
        (happyTalents.includes(item.name) && ['skill', 'combatskill'].includes(item.type)) ||
        (['rangeweapon', 'meleeweapon'].includes(item.type) && happyTalents.includes(item.system.combatskill.value)) ||
        ['ceremony', 'liturgy'].includes(item.type);

      return isFavored ? 0 : -2;
    }

    return 0;
  }
}

class DrunkenEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    if (item.type == 'skill' && item.name == _loc('LocalizedIDs.gambling')) return Math.clamp(this.clampedCondition(actor, effect), -3, 0);

    return 0;
  }
}

class BurningEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return 0;
    if (item.type == 'skill' && item.name == _loc('LocalizedIDs.bodyControl')) return Math.clamp(this.clampedCondition(actor, effect) + 1, -2, 0);

    return 0;
  }
}

class ArousalEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    //TODO this should be TPMs
    return 0;
  }
}

class SikaryanlossEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'skill' && item.name == _loc('LocalizedIDs.willpower')) return (this.clampedCondition(actor, effect) + 1) * 2;
    else if (item.type == 'regenerate') return this.clampedCondition(actor, effect);

    return 0;
  }
}

class DesireEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'skill' && item.name == _loc('LocalizedIDs.willpower')) return Math.clamp(this.clampedCondition(actor, effect), -3, 0);

    return 0;
  }
}

class TheriakEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'regenerate') return this.clampedCondition(actor, effect) * -1;

    return 0;
  }
}

class SunkenEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    if (item.type == 'skill' && item.system.group.value == 'body') return Math.clamp(this.clampedCondition(actor, effect) - 1, 3, 0) * -1;

    return 0;
  }
}

class HungerEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    const stat = Math.clamp(effect.system.condition.value || 0, 0, 4);
    if (item.type == 'regenerate') return Math.pow(2, stat - 1) * -1;

    return 0;
  }
}

class ThirstEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    return 0;
  }

  static levelDependentEffects(existing, update) {
    const stackValue = update.system?.condition?.value || 0;
    update.changes = {
      1: [],
      2: [{ key: 'system.condition.stunned', mode: 2, value: 1 / 2 }],
      3: [{ key: 'system.condition.stunned', mode: 2, value: 2 / 3 }],
      4: [{ key: 'system.condition.stunned', mode: 2, value: 3 / 4 }],
    }[stackValue];
  }
}

class HeatEffect extends DSA5StatusEffects {
  static levelDependentEffects(existing, update) {
    const stackValue = update.system?.condition?.value || 0;
    update.changes = {
      1: [
        { key: 'system.condition.stunned', mode: 2, value: 1 },
        { key: 'system.condition.confused', mode: 2, value: 1 },
      ],
      2: [
        { key: 'system.condition.stunned', mode: 2, value: 1 },
        { key: 'system.condition.confused', mode: 2, value: 1 / 2 },
      ],
      3: [
        { key: 'system.condition.stunned', mode: 2, value: 1 },
        { key: 'system.condition.confused', mode: 2, value: 2 / 3 },
      ],
      4: [
        { key: 'system.condition.stunned', mode: 2, value: 1 },
        { key: 'system.condition.confused', mode: 2, value: 1 / 2 },
      ],
    }[stackValue];
  }
}

class ColdEffect extends DSA5StatusEffects {
  static levelDependentEffects(existing, update) {
    const stackValue = update.system?.condition?.value || 0;
    update.changes = {
      1: [
        { key: 'system.condition.confused', mode: 2, value: 1 },
        { key: 'system.condition.paralysed', mode: 2, value: 1 },
      ],
      2: [
        { key: 'system.condition.confused', mode: 2, value: 1 },
        { key: 'system.condition.paralysed', mode: 2, value: 1 / 2 },
      ],
      3: [
        { key: 'system.condition.confused', mode: 2, value: 1 },
        { key: 'system.condition.paralysed', mode: 2, value: 2 / 3 },
      ],
      4: [
        { key: 'system.condition.confused', mode: 2, value: 1 },
        { key: 'system.condition.paralysed', mode: 2, value: 1 / 2 },
      ],
    }[stackValue];
  }
}

class NoModifierEffect extends DSA5StatusEffects {
  static calculateRollModifier(effect, actor, item, options = {}) {
    return 0;
  }
}

DSA5.statusEffectClasses = {
  inpain: PainEffect,
  heat: HeatEffect,
  cold: ColdEffect,
  encumbered: EncumberedEffect,
  stunned: DSA5StatusEffects,
  raptured: RaptureEffect,
  feared: DSA5StatusEffects,
  paralysed: DSA5StatusEffects,
  confused: DSA5StatusEffects,
  prone: ProneEffect,
  deaf: DeafEffect,
  bloodrush: BloodrushEffect,
  trance: TranceEffect,
  drunken: DrunkenEffect,
  arousal: ArousalEffect,
  burning: BurningEffect,
  sikaryanloss: SikaryanlossEffect,
  desire: DesireEffect,
  theriak: TheriakEffect,
  services: NoModifierEffect,
  sunken: SunkenEffect,
  hunger: HungerEffect,
  thirst: ThirstEffect,
  fixated: FixatedEffect,
};
