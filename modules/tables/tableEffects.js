import Actordsa5 from '../actor/actor-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effect_config.js';
import CreatureType from '../system/automation/creature-type.js';
import EquipmentDamage from '../system/automation/equipment-damage.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import CombatskillData from '../data/item/combatskill.js';
import TraitData from '../data/item/trait.js';
import DSATables from './dsatables.js';
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
      const methods = ['damageModifier', 'gearDamaged', 'gearLost', 'resistEffect', 'malus', 'selfDamage', 'nextAction'];

      let targets = [];
      let source = undefined;

      if (mode == 'self') {
        const speaker = DSA5_Utility.getSpeaker(options.speaker);
        targets.push(speaker);
        source = options.source ? speaker.items.get(options.source) : undefined;
      } else targets = Array.from(game.user.targets).map((x) => x.actor);

      for (const method of methods) {
        const ef = getProperty(hasEffect, method);
        if (ef) {
          const result = await TableEffects[method](ef, mode, targets, source, id, message);
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

  static async damageModifier(args, mode, targets, source) {
    //TODO
  }

  static async nextAction(args, mode, targets, source) {
    //TODO
  }

  static async opportunityAttack(args, mode, targets, source) {
    //TODO
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
      else await EquipmentDamage.absoluteDamageLevelToItem(source, args);

      return true;
    }
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

  static async resistEffect(args, mode, targets, source, id) {
    for (const target of targets) {
      const resistRolls = [
        {
          skill: args.roll,
          mod: args.modifier || 0,
          effect: {
            _id: 'botchEffect',
            name: args.fail.description,
          },
          target,
          token: target.token ? target.token.id : undefined,
        },
      ];
      DSAActiveEffectConfig.createResistRollMessage(resistRolls, id, mode);
    }
    return true;
  }

  static evaluateTargetArg(args, targets) {
    let finalTargets = targets;
    let hasTargets = true;
    if (args.target == 'victim') {
      const newTargets = Array.from(game.user.targets).map((x) => x.actor);
      if (newTargets.length) finalTargets = newTargets;
      else {
        hasTargets = false;
        ui.notifications.warn('DSAError.noVictim', { localize: true });
      }
    }
    return { hasTargets, finalTargets };
  }

  static async malus(args, mode, targets, source) {
    for (const malus of args) {
      const { hasTargets, finalTargets } = this.evaluateTargetArg(malus, targets);
      const alternateEffect = !hasTargets && malus.noTarget;
      const systemEffect = alternateEffect ? malus.noTarget.systemEffect : malus.systemEffect;
      const systemEffectLevel = alternateEffect ? malus.noTarget.level : malus.level || 1;

      let changes = alternateEffect ? malus.noTarget.changes : malus.changes;
      const duration = alternateEffect ? malus.noTarget.duration : malus.duration;

      if (systemEffect) {
        const baseEffect = CONFIG.statusEffects.find((x) => x.id == systemEffect);

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
        return true;
      } else if (changes) {
        const ef = OnUseEffect.effectBaseDummy(_loc('botchCritEffect'), changes || [], duration || {});

        mergeObject(ef, {
          flags: {
            dsa5: {
              hideOnToken: false,
              hidePlayers: false,
            },
          },
        });
        await DSATables.finalizeEffect(ef);
        for (const target of finalTargets) {
          await target.addCondition(ef);
        }
        return true;
      }
    }
  }

  //todo selfattack similar to selfdamage but with defense
  //todo include target area
  //todo args defendable modifier
  static async selfAttack(args, mode, targets, source) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg(args, targets);

    //if (source) { }
  }

  static async selfDamage(args, mode, targets, source) {
    const { hasTargets, finalTargets } = this.evaluateTargetArg(args, targets);

    if (source) {
      const obj = DSA5_Utility.toObjectIfPossible(source);
      for (const actor of finalTargets) {
        const combatskills = actor.items.filter((x) => x.type == 'combatskill').map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), actor.system));
        let preparedItem;

        ///todo the prepare methods are now data model

        if (args.damage) preparedItem = { damagedie: args.damage, damageAdd: '' };
        else if (source.type == 'rangeweapon') preparedItem = Actordsa5._prepareRangeWeapon(obj, [], combatskills, actor);
        else if (source.type == 'meleeweapon') preparedItem = Actordsa5._prepareMeleeWeapon(obj, combatskills, actor);
        else preparedItem = source.system.traitType.value == 'meleeAttack' ? TraitData._prepareRangeTrait(obj, actor.system) : TraitData._prepareMeleetrait(obj, actor.system);

        const damage = (preparedItem.damagedie + preparedItem.damageAdd).replace(/wWD/g, 'd');
        const roll = await new Roll(`(${damage})*${args.multiplier || 1}${args.modifier || ''}`).evaluate();

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
}
