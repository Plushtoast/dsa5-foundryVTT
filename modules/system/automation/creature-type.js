import DSA5_Utility from '../helpers/utility-dsa5.js';

const { getProperty } = foundry.utils;

Hooks.once('i18nInit', async () => {
  if (!CreatureType.creatureData) {
    const lang = game.i18n.lang == 'de' ? 'de' : 'en';
    const json = await fetch(`systems/dsa5/lazy/creaturetype/${lang}.json`);
    CreatureType.creatureData = await json.json();
    CreatureType.magical = _loc('WEAPON.magical');
    CreatureType.clerical = _loc('WEAPON.clerical');
    CreatureType.silverPlated = _loc('WEAPON.silverPlated');
    game.dsa5.apps.CreatureType = CreatureType;
  }
});

const isNotEmpty = (str) => {
  return !(!str || str.length === 0);
};

export default class CreatureType {
  static creatureData;
  static magical;
  static clerical;

  /** Status ids from content modules that confer a creature type. */
  static CONDITION_TYPES = {
    wercreature: 'WerCreatureType',
    childOfTheDark: 'VampireType',
    childOfTheNight: 'VampireType',
    lamijah: 'VampireType',
    feylamia: 'VampireType',
    minorVampire: 'VampireType',
    minorFeylamia: 'VampireType',
  };

  /** Minor vampires/feylamias take full weapon damage again. */
  static CONDITION_SKIP_DAMAGE_MOD = new Set(['minorVampire', 'minorFeylamia']);

  constructor(creatureClass) {
    this.creatureClass = creatureClass;
    this.spellImmunities = [];
    this.poisonImmunity = false;
    this.diseaseImmunity = false;
  }

  static detectCreatureType(actor) {
    if (!actor || !CreatureType.creatureData?.types) return [];

    const typeNames = new Set();
    const haystack = this.#typeHaystack(actor);
    if (haystack) {
      for (const [label, typeName] of Object.entries(CreatureType.creatureData.types)) {
        if (haystack.indexOf(label) >= 0) typeNames.add(typeName);
      }
    }

    const statusIds = this.#actorStatusIds(actor);
    for (const statusId of statusIds) {
      const typeName = this.CONDITION_TYPES[statusId];
      if (typeName) typeNames.add(typeName);
    }

    if (!typeNames.size) return [];

    const skipVampireDamage = [...statusIds].some((id) => this.CONDITION_SKIP_DAMAGE_MOD.has(id));
    return [...typeNames].map((typeName) => {
      const instance = this.getClass(typeName, haystack);
      if (typeName === 'VampireType' && skipVampireDamage) instance.skipDamageModifier = true;
      return instance;
    });
  }

  static #typeHaystack(actor) {
    const parts = [];
    const creatureClass = actor.system?.creatureClass?.value;
    const species = actor.system?.details?.species?.value;
    if (typeof creatureClass === 'string' && creatureClass) parts.push(creatureClass);
    if (typeof species === 'string' && species) parts.push(species);
    return parts.join(', ');
  }

  static #actorStatusIds(actor) {
    if (actor.statuses instanceof Set) return actor.statuses;
    const ids = new Set();
    for (const effect of actor.effects ?? []) {
      if (effect.disabled) continue;
      const statuses = effect.statuses;
      if (statuses instanceof Set) {
        for (const id of statuses) ids.add(id);
      } else if (Array.isArray(statuses)) {
        for (const id of statuses) ids.add(id);
      }
    }
    return ids;
  }

  static getClass(type, creatureClass) {
    const cl = {
      DemonType: DemonType,
      ChimeraType: ChimeraType,
      DaimonidType: DaimonidType,
      DragonType: DragonType,
      ElementalType: ElementalType,
      FairyType: FairyType,
      GhostType: GhostType,
      GolemType: GolemType,
      HomunculiType: HomunculiType,
      IntelligentCreatureType: IntelligentCreatureType,
      PlantType: PlantType,
      AnimalType: AnimalType,
      UndeadType: UndeadType,
      SupernaturalType: SupernaturalType,
      MagicalConstructType: MagicalConstructType,
      WerCreatureType: WerCreatureType,
      VampireType: VampireType,
    }[type];
    return new cl(creatureClass);
  }

  getName() {
    return Object.keys(CreatureType.creatureData.types).find((x) => CreatureType.creatureData.types[x] == this.constructor.name);
  }

  static checkImmunity(testData) {
    const immuneTo = [];
    switch (testData.preData.source.type) {
      case 'poison':
      case 'disease': {
        const immunityName = _loc('LocalizedIDs.immuneTo') + ' (' + testData.preData.source.name + ')';
        for (const target of game.user.targets) {
          const actor = target.actor;
          const immunity = actor.items.find((x) => x.name == immunityName && x.type == 'advantage');
          if (immunity) {
            immuneTo.push({
              name: immunity.name,
              uuid: immunity.uuid,
              target: actor.name,
              condition: testData.preData.source.name,
            });
          } else {
            const types = CreatureType.detectCreatureType(target.actor);
            for (const type of types) {
              if (type[`${testData.preData.source.type}Immunity`]) {
                immuneTo.push({
                  name: testData.preData.source.name,
                  target: `${actor.name} (${type.getName()})`,
                  condition: testData.preData.source.name,
                });
                break;
              }
            }
          }
        }
        break;
      }
      case 'spell':
      case 'ritual': {
        for (const target of game.user.targets) {
          const types = CreatureType.detectCreatureType(target.actor);
          const features = testData.preData.source.system.feature.split(',').map((x) => x.trim());

          let found = false;
          for (const type of types) {
            for (const feature of features) {
              if (type.spellImmunities.includes(feature)) {
                immuneTo.push({
                  name: testData.preData.source.name,
                  target: `${target.actor.name} (${type.getName()})`,
                  condition: `${_loc('feature')} ${feature}`,
                });
                found = true;
                break;
              }
            }
            if (found) break;
          }
        }
        break;
      }
    }

    return immuneTo;
  }

  static creatureTypeName(actor) {
    if (!actor) return '';
    const detected = this.detectCreatureType(actor);
    if (detected.length) return detected[0].getName();
    return actor.type === 'creature' ? '' : (actor.system?.details?.species?.value ?? '');
  }

  classDescription() {
    return CreatureType.creatureData.DESCRIPTIONS[this.constructor.name];
  }

  static addCreatureTypeModifiers(actorData, source, situationalModifiers, attacker) {
    const creatureTypes = CreatureType.detectCreatureType(actorData);
    const isSpell = ['spell', 'ceremony', 'liturgy', 'ritual'].includes(source.type);
    for (const k of creatureTypes) {
      const modifiers = k.damageModifier(source);
      if (isSpell) {
        for (const mod of modifiers) {
          mod.armorPen = k.spellResistanceModifier(actorData);
        }
      }
      situationalModifiers.push(...modifiers);
    }
    situationalModifiers.push(...this.creatureBonusDamage(actorData, attacker));
    CreatureType.addVulnerabilitiesToSource(actorData, source, situationalModifiers);
  }

  static addVulnerabilitiesToSource(actorData, source, situationalModifiers) {
    const vulnerabilities = getProperty(actorData, 'system.vulnerabilities');
    if (vulnerabilities) {
      if (['meleeweapon', 'rangeweapon'].includes(source.type)) {
        const toCombatskills = getProperty(vulnerabilities, 'combatskill');
        if (!toCombatskills) return;

        toCombatskills.reduce((prev, x) => {
          if (x.target == source.system.combatskill.value) {
            const isBonus = /\*/.test(x.value) ? Number(x.value.replace('*', '')) > 1 : Number(x.value) > 0;
            const key = isBonus ? 'WEAPON.vulnerableTo' : 'WEAPON.resistantTo';
            situationalModifiers.push(...CreatureType.buildDamageMod(`${_loc(key, { name: source.system.combatskill.value })} (${x.source})`, x.value));
          }
        }, situationalModifiers);
      }
    }
  }

  ignoredCondition(condition) {
    return false;
  }

  damageModifier(attackItem) {
    return [];
  }

  /**
   * DSA Tierkunde "Ungeheuer": not demons, fairies, ghosts, or ordinary animals.
   * Vampire/werecreatures are explicitly included; other monster-like types approximated.
   * @see https://dsa.ulisses-regelwiki.de/regel_erlaeuterungen/ungeheuer.html
   */
  static UNGEHEUER_TYPES = new Set([
    'ChimeraType',
    'DaimonidType',
    'DragonType',
    'GolemType',
    'HomunculiType',
    'SupernaturalType',
    'MagicalConstructType',
    'WerCreatureType',
    'VampireType',
  ]);

  static #ungeheuerLabels = new Set(['ungeheuer', 'monster', 'monsters']);

  static creatureClassString(actor) {
    if (!actor) return '';
    return this.#typeHaystack(actor);
  }

  static matchesCreatureTarget(actor, target) {
    if (!actor || !target) return false;
    const label = `${target}`.trim();
    if (!label) return false;

    const types = CreatureType.detectCreatureType(actor);
    if (CreatureType.#ungeheuerLabels.has(label.toLowerCase())) {
      return types.some((t) => CreatureType.UNGEHEUER_TYPES.has(t.constructor.name));
    }

    const creatureClass = CreatureType.creatureClassString(actor);
    if (creatureClass.indexOf(label) >= 0) return true;
    return types.some((t) => t.getName() === label);
  }

  static creatureBonusDamage(actor, attacker) {
    const bonusModifiers = [];
    const mods = getProperty(attacker, 'system.creatureBonus') || [];
    for (const mod of mods) {
      if (CreatureType.matchesCreatureTarget(actor, mod.target)) {
        bonusModifiers.push(...this.buildDamageMod(mod.source, mod.value, true));
      }
    }
    return bonusModifiers;
  }

  /**
   * Sum defender RS bonuses that match the attacker's creature class / Ungeheuer group.
   * @param {Actor} defender
   * @param {Actor} attacker
   * @returns {number}
   */
  static creatureArmorBonus(defender, attacker) {
    if (!defender || !attacker) return 0;
    const mods = getProperty(defender, 'system.creatureArmor') || [];
    let armor = 0;
    for (const mod of mods) {
      if (!CreatureType.matchesCreatureTarget(attacker, mod.target)) continue;
      const value = Number(`${mod.value}`.replace(/^\+/, ''));
      if (!Number.isNaN(value)) armor += value;
    }
    return armor;
  }

  /**
   * Filter conjuration AE modifiers whose target matches CreatureType ids
   * (e.g. Elemental, Demon — constructor name without the Type suffix).
   * @param {Actor} actor
   * @param {Array<{target: string, value: string|number, source?: string}>} modifiers
   * @returns {Array}
   */
  static matchConjurationModifiers(actor, modifiers = []) {
    if (!actor || !modifiers?.length) return [];
    const types = this.detectCreatureType(actor);
    if (!types.length) return [];
    const ids = new Set(types.map((t) => t.constructor.name.replace(/Type$/, '')));
    return modifiers.filter((m) => ids.has(m.target));
  }

  spellImmunity(spell) {
    return this.spellImmunities.some((x) => spell.includes(x));
  }
  spellArmorModifier(actorData) {
    return 0;
  }
  poisonImmunity() {
    return this.poisonImmunity;
  }
  diseaseImmunity() {
    return this.diseaseImmunity;
  }
  spellResistanceModifier(actorData) {
    return 0;
  }
  static buildDamageMod(name, value, selected = true) {
    return [
      {
        name,
        value,
        selected,
        type: 'dmg',
        source: _loc('target'),
      },
    ];
  }

  weaponAttributes(attackItem) {
    return getProperty(attackItem, 'system.effect.attributes') || '';
  }

  getTypeByClass(className) {
    return Object.keys(CreatureType.creatureData.types).find((key) => CreatureType.creatureData.types[key] === className);
  }

  isAttackItem(attackItem) {
    return ['meleeweapon', 'trait', 'rangeweapon'].includes(attackItem.type) && isNotEmpty(this.weaponAttributes(attackItem));
  }

  attributesRegex(attackItem) {
    const attributes = this.weaponAttributes(attackItem);

    return new RegExp(
      `(${attributes
        .split(',')
        .map((x) => DSA5_Utility.escapeRegex(x.split('(')[0].trim()))
        .join('|')})`,
      'i',
    );
  }

  specificGodMatch(gods, attackItem) {
    const regex = new RegExp(`(${gods.map((god) => DSA5_Utility.escapeRegex(`${CreatureType.clerical} (${god})`)).join('|')})`, 'ig');
    return Array.from(this.weaponAttributes(attackItem).matchAll(regex))
      .map((x) => x[0])
      .join(', ');
  }
}

class VulnerableToLifeGods extends CreatureType {
  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const specificGods = this.specificGodMatch(CreatureType.creatureData.godOfLife, attackItem);

      if (specificGods) return CreatureType.buildDamageMod(specificGods, '*2');
    }
    return super.damageModifier(attackItem);
  }
}

class ChimeraType extends VulnerableToLifeGods {}

class DaimonidType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Influence', 'Transformation'].map((x) => _loc(`Features.${x}`));
  }

  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const regex = this.attributesRegex(attackItem);

      if (regex.test(CreatureType.clerical)) return CreatureType.buildDamageMod(CreatureType.clerical, '*2');
    }
    return super.damageModifier(attackItem);
  }
}

class DragonType extends CreatureType {}

class DemonType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Influence', 'Transformation', 'Healing', 'Illusion'].map((x) => _loc(`Features.${x}`));
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }

  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const regex = this.attributesRegex(attackItem);
      if (regex.test(CreatureType.clerical)) return CreatureType.buildDamageMod(`${CreatureType.clerical} (${CreatureType.creatureData.opposingGod})`, '*2', false);

      if (regex.test(CreatureType.magical)) return super.damageModifier(attackItem);
    } else if (['spell', 'ceremony', 'liturgy', 'ritual'].includes(attackItem.type)) {
      return super.damageModifier(attackItem);
    }
    return CreatureType.buildDamageMod(this.getTypeByClass('DemonType'), '*0.5');
  }

  spellArmorModifier(actorData) {
    return Number(actorData.system.status.soulpower.max);
  }

  spellResistanceModifier(actorData) {
    return Number(actorData.system.status.soulpower.max);
  }

  ignoredCondition(condition) {
    return true;
  }
}

class ElementalType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }
  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const regex = this.attributesRegex(attackItem);
      if (regex.test(CreatureType.magical)) return super.damageModifier(attackItem);
    } else if (['spell', 'ceremony', 'liturgy', 'ritual'].includes(attackItem.type)) {
      return CreatureType.buildDamageMod(this.getTypeByClass('ElementalType'), '*1');
    }
    return CreatureType.buildDamageMod(this.getTypeByClass('ElementalType'), '*0.5');
  }

  spellArmorModifier(actorData) {
    return Number(actorData.system.status.soulpower.max);
  }

  spellResistanceModifier(actorData) {
    return Number(actorData.system.status.soulpower.max);
  }

  ignoredCondition(condition) {
    return true;
  }
}

class FairyType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Illusion'].map((x) => _loc(`Features.${x}`));
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }
}

class GhostType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Illusion', 'Healing', 'Telekinesis', 'Transformation'].map((x) => _loc(`Features.${x}`));
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }

  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const specificGods = this.specificGodMatch(CreatureType.creatureData.godOfDeath, attackItem);

      if (specificGods) return super.damageModifier(attackItem);

      const regex = this.attributesRegex(attackItem);

      if (regex.test(CreatureType.clerical)) return CreatureType.buildDamageMod(CreatureType.clerical, '*0.5');
      if (regex.test(CreatureType.magical)) return CreatureType.buildDamageMod(CreatureType.magical, '*0.5');
    } else if (['spell', 'ceremony', 'liturgy', 'ritual'].includes(attackItem.type)) {
      return CreatureType.buildDamageMod(CreatureType.magical, '*0.5');
    }
    return CreatureType.buildDamageMod(this.getTypeByClass('GhostType'), '*0');
  }

  ignoredCondition(condition) {
    return !['feared', 'inpain', 'confused'].includes(condition);
  }
}

class GolemType extends VulnerableToLifeGods {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Transformation'].map((x) => _loc(`Features.${x}`));
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }

  ignoredCondition(condition) {
    return !['confused', 'paralysed'].includes(condition);
  }
}

class HomunculiType extends VulnerableToLifeGods {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Healing'].map((x) => _loc(`Features.${x}`));
  }

  ignoredCondition(condition) {
    return !['inpain', 'encumbered', 'stunned', 'feared', 'paralysed', 'confused'].includes(condition);
  }
}

class IntelligentCreatureType extends CreatureType {}

class PlantType extends CreatureType {}

class AnimalType extends CreatureType {}

class UndeadType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Influence', 'Healing', 'Illusion'].map((x) => _loc(`Features.${x}`));
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }

  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const specificGods = this.specificGodMatch(CreatureType.creatureData.godOfDeath, attackItem);

      if (specificGods) return CreatureType.buildDamageMod(specificGods, '*2');
    }
    return super.damageModifier(attackItem);
  }

  ignoredCondition(condition) {
    return !['paralysed'].includes(condition);
  }
}

class SupernaturalType extends CreatureType {}

class MagicalConstructType extends CreatureType {
  constructor(creatureClass) {
    super(creatureClass);
    this.spellImmunities = ['Transformation'].map((x) => _loc(`Features.${x}`));
    this.poisonImmunity = true;
    this.diseaseImmunity = true;
  }
  ignoredCondition(condition) {
    return !['stunned', 'feared', 'paralysed', 'confused'].includes(condition);
  }
}

class WerCreatureType extends CreatureType {
  damageModifier(attackItem) {
    if (this.isAttackItem(attackItem)) {
      const regex = this.attributesRegex(attackItem);
      if (regex.test(CreatureType.silverPlated)) return CreatureType.buildDamageMod(this.getTypeByClass('WerCreatureType'), '*2');
    } else if (['spell', 'ceremony', 'liturgy', 'ritual'].includes(attackItem.type)) {
      return super.damageModifier(attackItem);
    }
    return CreatureType.buildDamageMod(this.getTypeByClass('WerCreatureType'), '*0.5');
  }
}

class VampireType extends CreatureType {
  damageModifier(attackItem) {
    if (this.skipDamageModifier) return super.damageModifier(attackItem);
    if (['spell', 'ceremony', 'liturgy', 'ritual'].includes(attackItem.type)) {
      return super.damageModifier(attackItem);
    }
    return CreatureType.buildDamageMod(this.getTypeByClass('VampireType'), '*0.5');
  }
}

//TODO where are the type descriptions for animals, intelligent creatures, supernatural and plants
