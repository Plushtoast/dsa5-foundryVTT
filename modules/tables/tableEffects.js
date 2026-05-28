import DSAActiveEffectConfig from '../status/active_effect_config.js';
import CreatureType from '../system/automation/creature-type.js';
import EquipmentDamage from '../system/automation/equipment-damage.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import DSATables from './dsatables.js';
import TableAccidentalAttack from './tableAccidentalAttack.js';
import TableEffectActiveEffects from './tableEffectActiveEffects.js';
import TableEffectHelpers from './tableEffectHelpers.js';
import TableOpportunityAttack from './tableOpportunityAttack.js';
const { getProperty, duplicate, mergeObject } = foundry.utils;

export default class TableEffects {
  //todo maybe add the effect later with second button and unspecific target
  //todo add "target": "attacker"
  //todo add modifier for basis & special manöver
  //add one time use effects

  static async applyEffect(id, mode) {
    const message = game.messages.get(id);
    const hasEffect = getProperty(message, 'flags.dsa5.hasEffect');
    const options = getProperty(message, 'flags.dsa5.options') || {};

    if (hasEffect) {
      //maintain order
      const methods = ['damageModifier', 'gearDamaged', 'weaponRepairPenalty', 'gearLost', 'resistEffect', 'malus', 'selfDamage', 'selfAttack', 'nextAction', 'opportunityAttack', 'weaponDelay', 'maneuverPenaltyIgnore', 'defenseCountModifier', 'attackPenaltyReduction', 'scopedModifier', 'scopedRestriction'];
      for (const key of Object.keys(hasEffect)) {
        if (!methods.includes(key)) console.warn('Unknown table effect key', key, hasEffect[key]);
      }

      let targets = [];
      let source = undefined;
      let speaker = undefined;

      if (mode == 'self') {
        speaker = DSA5_Utility.getSpeaker(options.speaker);
        if (speaker) targets.push(speaker);
        source = options.source && speaker ? speaker.items.get(options.source) : undefined;
      } else targets = Array.from(game.user.targets).map((x) => x.actor);

      const context = TableEffectHelpers.buildEffectContext(options, speaker);

      for (const method of methods) {
        const ef = getProperty(hasEffect, method);
        if (ef) {
          const result = await TableEffects[method](ef, mode, targets, source, id, message, context);
          if (!result) console.warn(`Table effect for <${method} not working yet`, ef, mode, targets, source);
        }
      }
      const tt = _loc('ActiveEffects.appliedEffect', {
        source: _loc('table'),
        target: targets.map((x) => x.name).join(', '),
      });
      await message.update({
        content: message.content.replace(/hideAnchor">/, `hideAnchor"><i class="fas fa-check" style="float:right" data-tooltip="${tt}"></i>`),
      });
    }
  }

  static async damageModifier(args, mode, targets, source, id, message, context = {}) {
    const targetArgs = {
      ...args,
      target: args.target || (context.table == 'criticalAttack' ? 'victim' : 'self'),
    };
    const { hasTargets, finalTargets } = this.evaluateTargetArg(targetArgs, targets, context);
    if (!hasTargets || !source) return false;

    for (const actor of finalTargets) {
      const roll = await TableEffectHelpers.rollSourceDamage(source, args, context);
      await actor.applyDamage(Math.round(roll.total));
      await ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
    }
    return true;
  }

  static async nextAction(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg(args, targets, context);
    if (!hasTargets) return false;

    const ef = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), [{ key: 'system.skillModifiers.global', mode: 2, value: args.modifier || 0 }], args.duration || { rounds: 1 });
    await DSATables.finalizeEffect(ef);
    for (const target of finalTargets) {
      await target.addCondition(ef);
    }
    return true;
  }

  static async scopedModifier(args, mode, targets, source, id, message, context = {}) {
    let applied = false;
    for (const scopedModifier of Array.isArray(args) ? args : [args]) {
      const resolved = this.#resolveScopedRule(scopedModifier, targets, context);
      if (!resolved || !scopedModifier.changes?.length) continue;

      const entry = this.#scopedRuleEntry(scopedModifier, resolved, {
        changes: duplicate(scopedModifier.changes),
        requiresManeuver: !!scopedModifier.requiresManeuver,
        requiresNoManeuver: !!scopedModifier.requiresNoManeuver,
        requiresOpponentManeuver: !!scopedModifier.requiresOpponentManeuver,
      });
      if (scopedModifier.maneuverTypes) entry.maneuverTypes = duplicate(scopedModifier.maneuverTypes);
      for (const actor of resolved.finalTargets) {
        await TableEffectActiveEffects.createScopedModifier(actor, entry, scopedModifier.duration || { rounds: 1 });
        applied = true;
      }
    }
    return applied;
  }

  static async scopedRestriction(args, mode, targets, source, id, message, context = {}) {
    const restrictions = args.restrictions || (args.restriction ? [args.restriction] : []);
    const resolved = this.#resolveScopedRule(args, targets, context);
    if (!resolved || !restrictions.length) return false;

    const entry = this.#scopedRuleEntry(args, resolved, {
      restrictions: duplicate(restrictions),
    });
    if (args.clearOnWeaponReady && source?.uuid) {
      entry.clearOnWeaponReady = true;
      entry.origin = source.uuid;
    }
    for (const actor of resolved.finalTargets) {
      await TableEffectActiveEffects.createScopedRestriction(actor, entry, args.duration || { rounds: 1 });
    }
    return true;
  }

  static #resolveScopedRule(args, targets, context) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg({ ...args, target: args.target || 'self' }, targets, context);
    const incomingAttack = ['incomingAttack', 'allOpponents'].includes(args.scope);
    const selfScope = args.scope == 'self';
    const scopedTargets = incomingAttack || selfScope ? [] : this.evaluateTargetArg({ target: args.scopeTarget || 'attacker' }, targets, context).finalTargets;
    if (!hasTargets || (!incomingAttack && !selfScope && !scopedTargets.length)) return undefined;

    return { finalTargets, incomingAttack, selfScope, scopedTargets };
  }

  static #scopedRuleEntry(args, resolved, data) {
    const entry = {
      scope: resolved.incomingAttack ? 'incomingAttack' : args.scope || 'againstTarget',
      ...data,
    };
    if (!resolved.incomingAttack && !resolved.selfScope) entry.target = TableEffectHelpers.speakerFromActor(resolved.scopedTargets[0]);
    return entry;
  }

  static async maneuverPenaltyIgnore(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg({ ...args, target: args.target || 'self' }, targets, context);
    if (!hasTargets || !args.value) return false;

    for (const actor of finalTargets) {
      await TableEffectActiveEffects.createManeuverPenaltyIgnore(actor, args.value, args.duration || { rounds: 1 });
    }
    return true;
  }

  static async defenseCountModifier(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg({ ...args, target: args.target || 'self' }, targets, context);
    if (!hasTargets || args.floor === undefined) return false;

    for (const actor of finalTargets) {
      await TableEffectActiveEffects.createDefenseCountModifier(actor, { ...duplicate(args), floor: Number(args.floor) || 0 }, args.duration || { rounds: 1 });
    }
    return true;
  }

  static async attackPenaltyReduction(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg({ ...args, target: args.target || 'self' }, targets, context);
    if (!hasTargets || !args.value) return false;

    for (const actor of finalTargets) {
      await TableEffectActiveEffects.createAttackPenaltyReduction(actor, args, args.duration || { rounds: 1 });
    }
    return true;
  }

  static async opportunityAttack(args, mode, targets, source, id, message, context = {}) {
    return TableOpportunityAttack.createCard(args, mode, targets, source, id, message, context);
  }

  static async weaponDelay(args, mode, targets, source) {
    const actions = Math.max(0, Number(args.actions) || 0);
    const hasReloadProgress = source?.system?.reloadTime?.progress !== undefined;
    if (!actions || !hasReloadProgress) {
      console.warn('Unable to apply weapon delay table effect', { args, source });
      return false;
    }

    await source.update({
      'system.reloadTime.progress': (Number(source.system.reloadTime.progress) || 0) - actions,
      'system.aimTime.progress': 0,
    });
    return true;
  }

  static async gearDamaged(args, mode, targets, source) {
    if (source && ['meleeweapon', 'rangeweapon'].includes(source.type)) {
      const attributes = getProperty(source, 'system.effect.attributes') || '';
      const regex = new RegExp(`(${CreatureType.magical}|${CreatureType.clerical})`, 'i');
      const isMagical = regex.test(attributes);
      if (isMagical) {
        const actor = source.actor || source.parent;
        if (actor) await actor.equipWeaponToHand(source.id, { equip: false });
        else await source.update({ 'system.worn.value': false, 'system.worn.offHand': false });
      }
      else if (game.settings.get('dsa5', 'armorAndWeaponDamage')) await EquipmentDamage.absoluteDamageLevelToItem(source, args);

      return true;
    }
  }

  static async weaponRepairPenalty(args, mode, targets, source) {
    if (!source || !['meleeweapon', 'rangeweapon'].includes(source.type)) {
      console.warn('Unable to apply weapon repair penalty table effect', { args, source });
      return false;
    }

    const value = Number(args.value) || 0;
    const combatSkill = source.system.combatskill.value;
    if (!value || !combatSkill) return false;

    const changes = [{ key: 'system.skillModifiers.combat.attack', type: 'custom', value: `${combatSkill} ${value}` }];
    if (source.type == 'meleeweapon') changes.push({ key: 'system.skillModifiers.combat.parry', type: 'custom', value: `${combatSkill} ${value}` });

    const effect = OnUseEffect.effectBaseDummy(args.name || _loc('botchCritEffect'), changes, {});
    effect.transfer = true;
    effect.system.applyToOwner = true;
    effect.flags.dsa5.tableEffect = { type: 'weaponRepairPenalty' };
    await DSATables.finalizeEffect(effect);
    await source.createEmbeddedDocuments('ActiveEffect', [effect]);
    return true;
  }

  static async gearLost(args, mode, targets, source) {
    if (source && ['meleeweapon', 'rangeweapon'].includes(source.type)) {
      const actor = source.actor || source.parent;
      if (actor) await actor.equipWeaponToHand(source.id, { equip: false });
      else await source.update({ 'system.worn.value': false, 'system.worn.offHand': false });
      if (args.distance) {
        const roll = await new Roll(args.distance).evaluate();
        const renderedRoll = await roll.render();
        const msg = _loc('WEAPON.dropped', {
          distance: roll.total,
        });
        ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${msg}</p>${renderedRoll}`));
      }
      return true;
    }
  }

  static async resistEffect(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg(args, targets, context);
    if (!hasTargets) return false;
    const failEffects = this.#normalizeFailEffects(args.fail);
    if (!failEffects.length) return false;
    const failNames = failEffects.map((fail) => fail.description).filter(Boolean).join(', ');
    for (const target of finalTargets) {
      const resistRolls = [
        {
          skill: args.roll,
          mod: args.modifier || 0,
          effect: {
            _id: 'botchEffect',
            name: failNames || _loc('botchCritEffect'),
          },
          target,
          token: target.token ? target.token.id : undefined,
        },
      ];
      await DSAActiveEffectConfig.createResistRollMessage(resistRolls, id, mode);
    }
    return true;
  }

  static evaluateTargetArg(args = {}, targets = [], context = {}) {
    return TableEffectHelpers.evaluateTargetArg(args, targets, context);
  }

  static async malus(args, mode, targets, source, id, message, context = {}) {
    let applied = false;
    for (const malus of args) {
      let { hasTargets, finalTargets } = this.evaluateTargetArg(malus, targets, context);
      const alternateEffect = !hasTargets && malus.noTarget;
      if (!hasTargets && !alternateEffect) continue;
      if (alternateEffect) finalTargets = [context.speaker].filter(Boolean);
      if (!finalTargets.length) continue;
      const systemEffect = alternateEffect ? malus.noTarget.systemEffect : malus.systemEffect;
      const systemEffectLevel = alternateEffect ? malus.noTarget.level : malus.level || 1;

      let changes = alternateEffect ? malus.noTarget.changes : malus.changes;
      const duration = alternateEffect ? malus.noTarget.duration : malus.duration;

      if (systemEffect) {
        const baseEffect = CONFIG.statusEffects.find((x) => x.id == systemEffect);
        if (!baseEffect) {
          console.warn('Unknown table effect system effect', systemEffect, malus);
          continue;
        }

        if (!changes) {
          changes = duplicate(baseEffect.system?.changes || []);
          const baseChange = changes.find((x) => x.key == `system.condition.${systemEffect}`);
          if (baseChange) {
            baseChange.value = systemEffectLevel;
          }
        }
        let ef;
        if (changes) {
          const lbl = _loc(`CONDITION.${systemEffect}`) + ' - ' + _loc('botchCritEffect');
          ef = OnUseEffect.effectBaseDummy(lbl, changes, duration || {});
          ef.icon = baseEffect.icon;
        } else {
          //todo add duration
          ef = systemEffect;
        }
        await DSATables.finalizeEffect(ef);
        for (const target of finalTargets) {
          await target.addCondition(ef);
        }
        applied = true;
      } else if (changes) {
        const ef = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), changes || [], duration || {});

        mergeObject(ef, {
          system: {
            visibility: {
              hideOnToken: false,
              hidePlayers: false,
            },
          },
        });
        await DSATables.finalizeEffect(ef);
        for (const target of finalTargets) {
          await target.addCondition(ef);
        }
        applied = true;
      }
    }
    return applied;
  }

  //todo selfattack similar to selfdamage but with defense
  //todo include target area
  //todo args defendable modifier
  static async selfAttack(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg(args, targets, context);
    if (!hasTargets) {
      if (args.noTarget) return this.malus([{ target: 'self', ...args.noTarget }], mode, targets, source, id, message, context);

      return this.selfDamage({ ...args, target: 'self' }, mode, targets, source, id, message, context);
    }
    if (!source) return false;

    for (const actor of finalTargets) {
      if (args.defendable !== undefined) {
        await TableAccidentalAttack.createDefenseCard(actor, source, args, id, context);
        continue;
      }

      const roll = await TableEffectHelpers.rollSourceDamage(source, args, context);
      await actor.applyDamage(Math.round(roll.total));
      await ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
    }
    return true;
  }

  static async rollSelfAttackDefense(ev) {
    return TableAccidentalAttack.rollDefense(ev);
  }

  static async applySelfAttackDamage(ev) {
    return TableAccidentalAttack.applyDamage(ev);
  }

  static async rollOpportunityAttack(ev) {
    return TableOpportunityAttack.roll(ev);
  }

  static async selfDamage(args, mode, targets, source, id, message, context = {}) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg(args, targets, context);
    if (!hasTargets) return false;

    if (source) {
      for (const actor of finalTargets) {
        const roll = await TableEffectHelpers.rollSourceDamage(source, args, { damageActor: actor });

        await actor.applyDamage(Math.round(roll.total));
        ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
      }
      return true;
    } else {
      for (const actor of finalTargets) {
        const roll = await new Roll('1d6').evaluate();

        await actor.applyDamage(Math.round(roll.total));
        ChatMessage.create(DSA5_Utility.chatDataSetup(await roll.render()));
      }
      return true;
    }
  }

  static #normalizeFailEffects(failEffects) {
    if (!failEffects) return [];
    return (Array.isArray(failEffects) ? failEffects : [failEffects]).filter(Boolean);
  }
}
