import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import Riding from '../system/automation/riding.js';
import { DSADataModel } from './abstract.js';
import EquipmentDamage from '../system/automation/equipment-damage.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import { ITEM_CONSTANTS } from '../config/item-constants.js';
import CreatureType from '../system/automation/creature-type.js';
import SpecialabilityData from './item/specialability.js';

const { SKILL, SPELL, LITURGY, CEREMONY, RITUAL } = ITEM_CONSTANTS.TEST_TYPES;

export class ActorDataModel extends DSADataModel {
  // Cache static properties with getters for lazy initialization
  static _familiarString = null;
  static _petString = null;
  static _moneyHasWeight = null;

  static get familiarString() {
    if (this._familiarString === null) {
      this._familiarString = _loc('LocalizedIDs.familiar');
    }
    return this._familiarString;
  }

  static get petString() {
    if (this._petString === null) {
      this._petString = _loc('LocalizedIDs.companion');
    }
    return this._petString;
  }

  static get moneyHasWeight() {
    if (this._moneyHasWeight === null) {
      this._moneyHasWeight = game.settings.get('dsa5', 'moneyHasWeight');
    }
    return this._moneyHasWeight;
  }

  prepareBaseData() {
    this.parent.auras = [];
    this._initializeBaseStructure();
  }

  _initializeBaseStructure() {
    foundry.utils.mergeObject(this, {
      itemModifiers: {},
      condition: {},
      swarm: { attack: 0, parry: 0, damage: 0 },
      skillModifiers: this._createSkillModifiersStructure(),
      status: this._createStatusStructure(),
      repeatingEffects: {
        startOfRound: {
          wounds: [],
          karmaenergy: [],
          astralenergy: [],
        },
      },
      temperature: { heatProtection: 0, coldProtection: 0 },
      totalArmor: 0,
      spellArmor: 0,
      liturgyArmor: 0,
      carryModifier: 0,
      aspModifier: 0,
      kapModifier: 0,
      vulnerabilities: [],
      resistances: {
        effects: [],
      },
      immunities: [],
      thresholds: { effects: [] },
      creatureBonus: [],
      miracle: { attack: 0, parry: 0 },
      spellStats: { damage: '0' },
      liturgyStats: { damage: '0' },
      meleeStats: this._createMeleeStatsStructure(),
      rangeStats: this._createRangeStatsStructure(),
      defaultWeapon: this._createDefaultWeaponStructure(),
    });

    // Initialize gear modifiers for calculated attributes
    for (const k of DSA5.gearModifyableCalculatedAttributes) {
      if (this.status[k]) this.status[k].gearmodifier = 0;
    }

    // Initialize gear modifiers for characteristics
    for (const ch of Object.values(this.characteristics)) {
      ch.gearmodifier = 0;
    }
  }

  _createSkillModifiersStructure() {
    const skillTypes = [LITURGY, CEREMONY, RITUAL, SPELL, SKILL];
    const baseSkillModifiers = {
      FP: [],
      step: [],
      QL: [],
      TPM: [],
      CMP: [],
      FW: [],
      botch: 20,
      crit: 1,
      global: [],
      postRoll: {
        QL: [],
        FP: [],
        reroll: [],
      },
      conditional: {
        AsPCost: [],
        KaPCost: [],
      },
      combat: {
        step: [],
        parry: [],
        attack: [],
        damage: [],
        damageThreshold: [],
      },
      feature: {
        FP: [],
        step: [],
        QL: [],
        TPM: [],
        CMP: [],
        FW: [],
        KaPCost: [],
        AsPCost: [],
      }
    };

    // Add specific skill type modifiers
    skillTypes.forEach(type => {
      baseSkillModifiers[type] = {
        FP: [],
        step: [],
        QL: [],
        TPM: [],
        FW: [],
        CMP: [], // compensation
      };
    });

    return baseSkillModifiers;
  }

  get creatureType() {
    return CreatureType.creatureTypeName(this.parent);
  }

  _createStatusStructure() {
    return {
      initiative: { multiplier: 1 },
      astralenergy: { permanentGear: 0 },
      karmaenergy: { permanentGear: 0 },
      wounds: { multiplier: 1 },
      speed: {
        multiplier: 1,
        airmultiplier: 1,
        watermultiplier: 1,
      },
      regeneration: {
        LePgearmodifier: 0,
        KaPgearmodifier: 0,
        AsPgearmodifier: 0,
        LePConditional: [],
        KaPConditional: [],
        AsPConditional: [],
      }
    };
  }

  _createMeleeStatsStructure() {
    return {
      parry: 0,
      attack: 0,
      damage: '0',
      defenseMalus: 0,
      botch: 20,
      crit: 1,
      critPA: 1,
      critAT: 1,
    };
  }

  _createRangeStatsStructure() {
    return {
      attack: 0,
      damage: '0',
      defenseMalus: 0,
      botch: 20,
      crit: 1,
    };
  }

  _createDefaultWeaponStructure() {
    return {
      system: {
        damageThreshold: { value: 14 },
        reach: { value: 'short' },
        guidevalue: { value: 'ge/kk' },
        damage: { value: '1d6' }
      }
    };
  }

  prepareDerivedData() {
    try {
      this._getItemModifiers();
      this._updateCharacteristics(this);
      this._calculateWeightAndContainer(this);
      this._identifyCharacterType(this);
      this._calculateBasicAttributes(this);
      this._calculateEnergyPoints(this);
      this._calculateDefenseValues(this);
      this._applyConditionsAndMovement(this);
    } catch (error) {
      console.error(`Error preparing actor data for ${this.parent.name}:`, error);
      ui.notifications.error(_loc('DSAError.PreparationError', { name: this.parent.name }) + error.message);
    }
  }

  _updateCharacteristics(data) {
    for (const ch of Object.values(data.characteristics)) {
      ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
    }
  }

  _calculateWeightAndContainer(data) {
    data.totalWeight = 0;
    this.moneyWeight = 0;
    const wornArmor = [];

    // Build container map
    const containers = new Map();
    this.parent.items
      .filter(x => x.type === 'equipment' && x.system.equipmentType.value === 'bags')
      .forEach(container => containers.set(container.id, []));

    // First pass - assign items to containers and calculate base weights
    this._processItemWeights(data, containers, wornArmor);

    // Second pass - process bag weights recursively
    this._processBagWeights(data, containers);

    data.armorEncumbrance = this.getArmorEncumbrance(this.parent, wornArmor);
    data.carrycapacity = data.characteristics.kk.value * 2 + data.carryModifier;
  }

  _processItemWeights(data, containers, wornArmor) {
    for (const item of this.parent.items) {
      if (ActorDataModel.moneyHasWeight && item.type === 'money') {
        item.system.preparedWeight = parseFloat((item.system.weight.value * item.system.quantity.value).toFixed(3));
        data.totalWeight += Number(item.system.preparedWeight);
        this.moneyWeight += Number(item.system.preparedWeight);
        continue;
      }

      if (DSA5.equipmentCategories.has(item.type)) {
        const parentId = item.system.parent_id;
        if (parentId && parentId !== item._id && containers.has(parentId)) {
          containers.get(parentId).push(item);
          continue;
        }

        item.system.preparedWeight = parseFloat((item.system.weight.value * item.system.quantity.value).toFixed(3));

        if (item.type === 'armor') {
          data.totalWeight += parseFloat((item.system.weight.value *
            (item.system.worn.value ? Math.max(0, item.system.quantity.value - 1) : item.system.quantity.value)).toFixed(3));

          if (item.system.worn.value) wornArmor.push(item);
        } else {
          data.totalWeight += Number(item.system.preparedWeight);
        }
      }
    }
  }

  _processBagWeights(data, containers) {
    const bags = this.parent.items.filter(x => x.type === 'equipment' && x.system.equipmentType.value === 'bags');
    for (const bag of bags) {
      const parentId = bag.system.parent_id;
      if (!parentId || !containers.has(parentId)) {
        data.totalWeight += this._calcBagweight(bag, containers, true);
      }
    }
  }

  _calcBagweight(elem, containers, topLevel = true) {
    let totalWeight = 0;
    if (containers.has(elem._id)) {
      let bagweight = 0;
      if (!elem.system.worn.value && topLevel) totalWeight -= elem.system.preparedWeight;

      for (const child of containers.get(elem._id)) {
        child.system.preparedWeight = Number(parseFloat((child.system.weight.value * child.system.quantity.value).toFixed(3)));

        if (containers.has(child._id)) {
          bagweight += this._calcBagweight(child, containers, false);
        } else {
          bagweight += child.system.preparedWeight;
        }
      }

      if (!topLevel) {
        totalWeight += bagweight + elem.system.preparedWeight;
      } else if (elem.system.worn.value) {
        totalWeight += bagweight;
      }

      elem.system.bagweight = `${bagweight.toFixed(3)}/${elem.system.capacity}`;
    }
    return totalWeight;
  }

  _identifyCharacterType(data) {
    data.isMage = false;
    data.isPriest = false;
    data.isFamiliar = false;
    data.isPet = false;

    // Identify character type based on items
    for (const item of this.parent.items) {
      switch (item.type) {
        case 'trait':
          if (item.name === ActorDataModel.familiarString) data.isFamiliar = true;
          else if (item.name === ActorDataModel.petString) data.isPet = true;
          break;
        case SPELL:
        case RITUAL:
        case 'magictrick':
          data.isMage = true;
          break;
        case LITURGY:
        case CEREMONY:
        case 'blessing':
          data.isPriest = true;
          break;
        case 'specialability':
          if (SpecialabilityData.sortedSpecs.magical.has(item.system.category.value)) data.isMage = true;
          else if (SpecialabilityData.sortedSpecs.clerical.has(item.system.category.value)) data.isPriest = true;
          break;
      }
    }

    data.isMage ||= data.isFamiliar;

    data.canAdvance = this.parent.isOwner && (this.parent.type === 'character' || data.isFamiliar || data.isPet);
    this.parent.canAdvance = data.canAdvance;

    if (data.canAdvance) {
      data.details.experience.current = data.details.experience.total - data.details.experience.spent;
      data.details.experience.description = DSA5_Utility.experienceDescription(data.details.experience.total);
    }
  }

  _calculateBasicAttributes(data) {
    if (this.parent.type === 'character' || this.parent.type === 'npc') {
      data.status.wounds.current = data.status.wounds.initial + data.characteristics.ko.value * 2;
      data.status.soulpower.value = (data.status.soulpower.initial || 0) +
        Math.round((data.characteristics.mu.value + data.characteristics.kl.value + data.characteristics.in.value) / 6);
      data.status.toughness.value = (data.status.toughness.initial || 0) +
        Math.round((data.characteristics.ko.value + data.characteristics.ko.value + data.characteristics.kk.value) / 6);
      data.status.wounds.min = -1 * data.characteristics.ko.value;
    } else if (this.parent.type === 'creature') {
      data.status.wounds.current = data.status.wounds.initial;
      data.status.astralenergy.current = data.status.astralenergy.initial;
      data.status.karmaenergy.current = data.status.karmaenergy.initial;
    }

    data.status.wounds.max = Math.round(
      (data.status.wounds.current + data.status.wounds.modifier + data.status.wounds.advances) *
      data.status.wounds.multiplier + data.status.wounds.gearmodifier
    );

    data.status.fatePoints.max = Number(data.status.fatePoints.current) +
      Number(data.status.fatePoints.modifier) + data.status.fatePoints.gearmodifier;

    data.status.regeneration.LePmax = data.status.regeneration.LePTemp +
      data.status.regeneration.LePMod + data.status.regeneration.LePgearmodifier;
    data.status.regeneration.KaPmax = data.status.regeneration.KaPTemp +
      data.status.regeneration.KaPMod + data.status.regeneration.KaPgearmodifier;
    data.status.regeneration.AsPmax = data.status.regeneration.AsPTemp +
      data.status.regeneration.AsPMod + data.status.regeneration.AsPgearmodifier;
  }

  _calculateEnergyPoints(data) {
    data.status.astralenergy.rebuy ||= 0;
    data.status.karmaenergy.rebuy ||= 0;
    data.status.astralenergy.permanentLoss ||= 0;
    data.status.karmaenergy.permanentLoss ||= 0;

    data.status.astralenergy.permanentLossSum = data.status.astralenergy.permanentLoss -
      data.status.astralenergy.rebuy + data.status.astralenergy.permanentGear;
    data.status.karmaenergy.permanentLossSum = data.status.karmaenergy.permanentLoss -
      data.status.karmaenergy.rebuy + data.status.karmaenergy.permanentGear;

    const guide = data.guidevalue;

    if (data.isFamiliar || (guide && this.parenttype !== 'creature')) {
      data.status.astralenergy.current = data.status.astralenergy.initial;
      data.status.karmaenergy.current = data.status.karmaenergy.initial;

      if (data.characteristics[guide.magical]) {
        data.status.astralenergy.current += Math.round(
          data.characteristics[guide.magical].value * data.energyfactor.magical
        );
      }

      if (data.characteristics[guide.clerical]) {
        data.status.karmaenergy.current += Math.round(
          data.characteristics[guide.clerical].value * data.energyfactor.clerical
        );
      }
    }

    data.status.astralenergy.max = data.status.astralenergy.current +
      data.status.astralenergy.modifier + data.status.astralenergy.advances +
      data.status.astralenergy.gearmodifier - data.status.astralenergy.permanentLossSum;

    data.status.karmaenergy.max = data.status.karmaenergy.current +
      data.status.karmaenergy.modifier + data.status.karmaenergy.advances +
      data.status.karmaenergy.gearmodifier - data.status.karmaenergy.permanentLossSum;

    data.status.soulpower.max = data.status.soulpower.value +
      data.status.soulpower.modifier + data.status.soulpower.gearmodifier;

    data.status.toughness.max = data.status.toughness.value +
      data.status.toughness.modifier + data.status.toughness.gearmodifier;
  }

  _calculateDefenseValues(data) {
    data.status.dodge.value = Math.round(data.characteristics.ge.value / 2) + data.status.dodge.gearmodifier;
    data.status.dodge.max = Number(data.status.dodge.value) + Number(data.status.dodge.modifier) +
      Number(game.settings.get('dsa5', 'higherDefense')) / 2;
  }

  _applyConditionsAndMovement(data) {
    const encumbrance = this.calcEncumbrance(data);
    const horse = Riding.isRiding(this.parent) ? Riding.getHorse(this.parent) : undefined;
    const fixated = this.parent.statuses.has('fixated');

    this.calcInitiative(data, encumbrance, horse);
    this.prepareSwarm(data);
    this.effectivePain(data);
    this.calcSpeed(data, fixated, horse);
  }

  calcEncumbrance(data) {
    return Math.clamp(data.condition?.encumbered || 0, 0, 4);
  }

  baseInitiative(data) {
    data.status.initiative.value = Math.round((data.characteristics.mu.value + data.characteristics.ge.value) / 2) +
      (data.status.initiative.modifier || 0);
  }

  calcInitiative(data, encumbrance, horse) {
    this.baseInitiative(data);

    if (horse) {
      data.status.initiative.value = horse.system.status.initiative.value;
      if (!data.status.initiative.value) {
        const horseData = horse.system;
        horse.system.calcInitiative(horseData, horse.system.calcEncumbrance(horseData));
        data.status.initiative.value = horseData.status.initiative.value;
      }
    } else {
      data.status.initiative.value += (data.status.initiative.gearmodifier || 0) - Math.min(4, encumbrance);

      const baseInit = Number((0.01 * data.status.initiative.value).toFixed(2));

      data.status.initiative.value *= data.status.initiative.multiplier || 1;
      data.status.initiative.value = Math.round(data.status.initiative.value) + baseInit;
    }
  }

  calcSpeed(data, fixated, horse) {
    if (horse) {
      this._setHorseSpeed(data, horse);
    } else {
      this._calculateOwnSpeed(data, fixated);
    }
  }

  _setHorseSpeed(data, horse) {
    if (!horse.system.status.speed.max) {
      horse.system.calcSpeed(horse.system, horse.hasCondition('fixated'));
    }
    data.status.speed.max = horse.system.status.speed.max;
    data.status.speed.airMax = horse.system.status.speed.airMax;
    data.status.speed.waterMax = horse.system.status.speed.waterMax;
  }

  _calculateOwnSpeed(data, fixated) {
    const baseMod = (data.status.speed.modifier || 0) + (data.status.speed.gearmodifier || 0);
    const encumbrance = Math.min(4, this.calcEncumbrance(data));
    const painMalus = data.condition?.inpain || 0;
    const feelsPain = !this.parent.hasCondition('bloodrush');

    data.status.speed.max = this._calculateSpeedType(
      data.status.speed.initial + baseMod,
      encumbrance,
      painMalus,
      feelsPain,
      data.status.speed.multiplier,
      fixated
    );

    const hasSwim = data.status.speed.water;
    if (hasSwim) {
      data.status.speed.waterMax = this._calculateSpeedType(
        hasSwim + baseMod,
        encumbrance,
        painMalus,
        feelsPain,
        data.status.speed.watermultiplier,
        fixated,
        false
      );
    } else {
      data.status.speed.waterMax = this._calculateSpeedType(
        Math.round((data.status.speed.max + baseMod) * 0.5),
        encumbrance,
        painMalus,
        feelsPain,
        data.status.speed.watermultiplier,
        fixated,
        false
      );
    }

    const hasAir = data.status.speed.air;
    if (hasAir) {
      data.status.speed.airMax = this._calculateSpeedType(
        hasAir + baseMod,
        encumbrance,
        painMalus,
        feelsPain,
        data.status.speed.airmultiplier,
        fixated,
        false
      );
    } else {
      data.status.speed.airMax = 0;
    }

    //todo this is not ready for swim
    Riding.updateRiderSpeed(this.parent, data.status.speed.max);
  }

  _calculateSpeedType(baseSpeed, encumbrance, painMalus, feelsPain, multiplier, fixated, groundOnly = true) {
    let speed = Math.round(Math.max(0, baseSpeed - encumbrance) * multiplier);

    if (feelsPain) {
      speed = Math.max(0, speed - painMalus);
    }

    return this._applyStatusEffectsToSpeed(speed, fixated, groundOnly);
  }

  _applyStatusEffectsToSpeed(input, fixated, groundOnly = true) {
    if (fixated || this.parent.hasCondition('rooted') || this.parent.hasCondition('incapacitated')) {
      return 0;
    }

    const paralysis = this.parent.hasCondition('paralysed');
    if (paralysis) {
      input = Math.round(input * (1 - (paralysis.system?.condition?.value || 0) * 0.25));
    }

    if (groundOnly && this.parent.hasCondition('prone')) {
      input = Math.min(1, input);
    }

    return input;
  }

  getArmorEncumbrance(actorData, wornArmors) {
    const encumbrance = wornArmors.reduce((sum, a) => {
      a.system.calculatedEncumbrance = a.system.encumbrance.value + EquipmentDamage.armorEncumbranceModifier(a);
      a.system.damageToolTip = EquipmentDamage.damageTooltip(a);
      return sum += a.system.calculatedEncumbrance;
    }, 0);

    const ridingModifier = Riding.isRiding(this.parent) ? -1 : 0;
    return Math.max(0, encumbrance -
      SpecialabilityRulesDSA5.abilityStep(actorData, 'LocalizedIDs.inuredToEncumbrance') +
      ridingModifier);
  }

  prepareSwarm(data) {
    const count = Math.max(1, Number(data.swarm.count) || 1);
    if (count < 2) return;

    data.swarm.maxwounds = data.status.wounds.max;

    data.status.wounds.max *= count;

    const effectiveCount = Math.min(
      Math.ceil(Math.max(0, data.status.wounds.value) / data.swarm.maxwounds),
      count
    );
    const groupSize = Math.max(1, Number(data.swarm.gg) || 1);

    data.swarm.effectiveCount = effectiveCount;
    data.swarm.attack = Math.min(10, Math.floor(effectiveCount / groupSize));
    data.swarm.parry = -1;
    data.swarm.damage = Math.min(5, Math.floor(effectiveCount / groupSize));
  }

  effectivePain(data) {
    let pain = data.condition.inpain || 0;

    if (pain < 4) {
      pain -= AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.ruggedFighter') +
        AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.ruggedAnimal') +
        (SpecialabilityRulesDSA5.hasAbility(this.parent, 'LocalizedIDs.traditionKor') ? 1 : 0);
    }

    if (pain > 0) {
      pain += AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.sensitiveToPain') +
        AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.fragileAnimal');
    }

    // Clamp pain between 0 and 4
    data.condition.inpain = Math.clamp(pain, 0, 4);
  }

  _getItemModifiers() {
    const wornArmor = [];
    const itemModifiers = {};

    const relevantItems = this.parent.items.filter(item => {
      if (['meleeweapon', 'rangeweapon', 'armor', 'equipment'].includes(item.type)) {
        if (item.system.worn.value) {
          if (item.type === 'armor') wornArmor.push(item);
          return true;
        }
        return false;
      }
      return ['advantage', 'specialability', 'disadvantage'].includes(item.type);
    });

    relevantItems.forEach(item => this._buildGearAndAbilityModifiers(itemModifiers, item));

    if (wornArmor.length > 0) {
      this._getArmorCompensation(this.parent, wornArmor, itemModifiers);
    }

    this._applyModiferTransformations(itemModifiers);
  }

  _buildGearAndAbilityModifiers(itemModifiers, item) {
    const effect = item.system.effect.value;
    if (!effect) return;

    for (const mod of `${effect}`.split(/,|;/).map(x => x.trim())) {
      const vals = mod.replace(/(\s+)/g, ' ').trim().split(' ');
      if (vals.length == 2 && !isNaN(vals[0])) {
        const elem = {
          value: Number(vals[0]) * (item.system.step ? Number(item.system.step.value) || 1 : 1),
          source: item.name,
          type: item.type,
        };

        if (itemModifiers[vals[1]] === undefined) {
          itemModifiers[vals[1]] = [elem];
        } else {
          itemModifiers[vals[1]].push(elem);
        }
      }
    }
  }

  _getArmorCompensation(actor, wornArmors, itemModifiers) {
    const armorCompensation = SpecialabilityRulesDSA5.abilityStep(actor, 'LocalizedIDs.inuredToEncumbrance');
    const armorEncumbrance = wornArmors.reduce((sum, x) => sum + Number(x.system.encumbrance.value), 0);

    if (armorCompensation > armorEncumbrance) {
      const modKeys = [_loc('CHARAbbrev.GS'), _loc('CHARAbbrev.INI')];
      for (const modkey of modKeys) {
        if (!itemModifiers[modkey]) continue;
        itemModifiers[modkey] = itemModifiers[modkey].filter(x => x.type != 'armor');
      }
    }
  }

  _applyModiferTransformations(itemModifiers) {
    this.itemModifiers = {};

    for (const key of Object.keys(itemModifiers)) {
      const shortCut = DSA5.knownShortcuts[key.toLowerCase()];
      if (shortCut) {
        const modSum = itemModifiers[key].reduce((prev, cur) => prev + cur.value, 0);

        this[shortCut[0]][shortCut[1]][shortCut[2]] += modSum;

        this.itemModifiers[key] = {
          value: modSum,
          sources: itemModifiers[key].map(x => x.source),
        };
      }
    }
  }
}
