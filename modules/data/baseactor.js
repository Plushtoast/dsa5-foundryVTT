import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5 from '../system/config-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/specialability-rules-dsa5.js';
import Riding from '../system/riding.js';
import { DSADataModel } from './abstract.js';
import EquipmentDamage from '../system/equipment-damage.js';
import AdvantageRulesDSA5 from '../system/advantage-rules-dsa5.js';

export class ActorDataModel extends DSADataModel {
  static _familiarString = null;
  static _petString = null;
  static _moneyHasWeight = null;

  static get familiarString() {
    if (this._familiarString === null) {
      this._familiarString = game.i18n.localize('LocalizedIDs.familiar');
    }
    return this._familiarString;
  }

  static get petString() {
    if (this._petString === null) {
      this._petString = game.i18n.localize('LocalizedIDs.companion');
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

    foundry.utils.mergeObject(this, {
      itemModifiers: {},
      condition: {},
      swarm: {
        attack: 0,
        parry: 0,
        damage: 0,
      },
      creatureType: this.creatureType,
      skillModifiers: {
        FP: [],
        step: [],
        QL: [],
        TPM: [],
        FW: [],
        botch: 20,
        crit: 1,
        global: [],
        conditional: {
          AsPCost: [],
          KaPCost: [],
        },
        combat: {
          step: [],
          parry: [],
          attack: [],
          damage: [],
        },
        feature: {
          FP: [],
          step: [],
          QL: [],
          TPM: [],
          FW: [],
          KaPCost: [],
          AsPCost: [],
        },
        ...['liturgy', 'ceremony', 'ritual', 'spell', 'skill'].reduce((prev, x) => {
          prev[x] = {
            FP: [],
            step: [],
            QL: [],
            TPM: [],
            FW: [],
          };
          return prev;
        }, {}),
      },
      status: {
        initiative: {
          multiplier: 1,
        },
        astralenergy: {
          permanentGear: 0,
        },
        karmaenergy: {
          permanentGear: 0,
        },
        wounds: {
          multiplier: 1,
        },
        speed: {
          multiplier: 1,
        },
        regeneration: {
          LePgearmodifier: 0,
          KaPgearmodifier: 0,
          AsPgearmodifier: 0,
        },
      },
      repeatingEffects: {
        startOfRound: {
          wounds: [],
          karmaenergy: [],
          astralenergy: [],
        },
      },
      temperature: {
        heatProtection: 0,
        coldProtection: 0,
      },
      totalArmor: 0,
      spellArmor: 0,
      liturgyArmor: 0,
      carryModifier: 0,
      aspModifier: 0,
      kapModifier: 0,
      immunities: [],
      thresholds: {
        effects: [],
      },
      creatureBonus: [],
      miracle: {
        attack: 0,
        parry: 0,
      },
      spellStats: {
        damage: '0',
      },
      liturgyStats: {
        damage: '0',
      },
      meleeStats: {
        parry: 0,
        attack: 0,
        damage: '0',
        defenseMalus: 0,
        botch: 20,
        crit: 1,
      },
      rangeStats: {
        attack: 0,
        damage: '0',
        defenseMalus: 0,
        botch: 20,
        crit: 1,
      },
      defaultWeapon: {
        system: {
          damageThreshold: {
            value: 14,
          },
          reach: {
            value: 'short',
          },
          guidevalue: {
            value: 'ge/kk',
          },
        },
      },
    });

    for (const k of DSA5.gearModifyableCalculatedAttributes) if (this.status[k]) this.status[k].gearmodifier = 0;

    for (let ch of Object.values(this.characteristics)) ch.gearmodifier = 0;
  }

  prepareDerivedData() {
    //let startTime = performance.now()
    const data = this;
    try {
      this._getItemModifiers();

      for (let ch of Object.values(data.characteristics)) {
        ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
      }

      data.totalWeight = 0;

      const wornArmor = [];

      const containers = new Map();
      const bags = this.parent.items.filter((x) => x.type == 'equipment' && x.system.equipmentType.value == 'bags');
      for (let container of bags) {
        containers.set(container.id, []);
      }

      this.moneyWeight = 0;
      for (const i of this.parent.items) {
        if (ActorDataModel.moneyHasWeight && i.type == 'money') {
          i.system.preparedWeight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
          data.totalWeight += Number(i.system.preparedWeight);
          this.moneyWeight += Number(i.system.preparedWeight);
        } else if (DSA5.equipmentCategories.has(i.type)) {
          let parent_id = i.system.parent_id;
          if (parent_id && parent_id != i._id) {
            if (containers.has(parent_id)) {
              containers.get(parent_id).push(i);
              continue;
            }
          }
          if (i.type == 'armor') {
            i.system.preparedWeight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            data.totalWeight += parseFloat((i.system.weight.value * (i.system.worn.value ? Math.max(0, i.system.quantity.value - 1) : i.system.quantity.value)).toFixed(3));
            if (i.system.worn.value) wornArmor.push(i);
          } else {
            i.system.preparedWeight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            data.totalWeight += Number(i.system.preparedWeight);
          }
        } else {
          switch (i.type) {
            case 'trait':
              if (i.name == ActorDataModel.familiarString) data.isFamiliar = true;
              else if (i.name == ActorDataModel.petString) data.isPet = true;
              break;
            case 'spell':
            case 'ritual':
            case 'magictrick':
              data.isMage = true;
              break;
            case 'liturgy':
            case 'ceremony':
            case 'blessing':
              data.isPriest = true;
              break;
            case 'specialability':
              if (DSA5.sortedSpecs.magical.has(i.system.category.value)) data.isMage = true;
              else if (DSA5.sortedSpecs.clerical.has(i.system.category.value)) data.isPriest = true;
              break;
          }
        }
      }

      data.isMage ||= data.isFamiliar;

      for (let bag of bags) {
        let parent_id = bag.system.parent_id;
        if (!parent_id || !containers.has(parent_id)) data.totalWeight += this._calcBagweight(bag, containers, true);
      }

      data.canAdvance = this.parent.isOwner && (this.parent.type == 'character' || data.isFamiliar || data.isPet);
      this.parent.canAdvance = data.canAdvance;

      data.carrycapacity = data.characteristics.kk.value * 2 + data.carryModifier;

      if (data.canAdvance) {
        data.details.experience.current = data.details.experience.total - data.details.experience.spent;
        data.details.experience.description = DSA5_Utility.experienceDescription(data.details.experience.total);
      }
      if (this.parent.type == 'character' || this.parent.type == 'npc') {
        data.status.wounds.current = data.status.wounds.initial + data.characteristics.ko.value * 2;
        data.status.soulpower.value =
          (data.status.soulpower.initial || 0) + Math.round((data.characteristics.mu.value + data.characteristics.kl.value + data.characteristics.in.value) / 6);
        data.status.toughness.value =
          (data.status.toughness.initial || 0) + Math.round((data.characteristics.ko.value + data.characteristics.ko.value + data.characteristics.kk.value) / 6);
        data.status.wounds.min = -1 * data.characteristics.ko.value;
      }

      data.status.fatePoints.max = Number(data.status.fatePoints.current) + Number(data.status.fatePoints.modifier) + data.status.fatePoints.gearmodifier;

      if (this.parent.type == 'creature') {
        data.status.wounds.current = data.status.wounds.initial;
        data.status.astralenergy.current = data.status.astralenergy.initial;
        data.status.karmaenergy.current = data.status.karmaenergy.initial;
      }

      data.status.wounds.max = Math.round(
        (data.status.wounds.current + data.status.wounds.modifier + data.status.wounds.advances) * data.status.wounds.multiplier + data.status.wounds.gearmodifier,
      );

      data.status.regeneration.LePmax = data.status.regeneration.LePTemp + data.status.regeneration.LePMod + data.status.regeneration.LePgearmodifier;
      data.status.regeneration.KaPmax = data.status.regeneration.KaPTemp + data.status.regeneration.KaPMod + data.status.regeneration.KaPgearmodifier;
      data.status.regeneration.AsPmax = data.status.regeneration.AsPTemp + data.status.regeneration.AsPMod + data.status.regeneration.AsPgearmodifier;

      let guide = data.guidevalue;

      data.status.astralenergy.rebuy ||= 0;
      data.status.karmaenergy.rebuy ||= 0;
      data.status.astralenergy.permanentLoss ||= 0;
      data.status.karmaenergy.permanentLoss ||= 0;

      data.status.astralenergy.permanentLossSum = data.status.astralenergy.permanentLoss - data.status.astralenergy.rebuy + data.status.astralenergy.permanentGear;
      data.status.karmaenergy.permanentLossSum = data.status.karmaenergy.permanentLoss - data.status.karmaenergy.rebuy + data.status.karmaenergy.permanentGear;

      if (data.isFamiliar || (guide && this.parenttype != 'creature')) {
        data.status.astralenergy.current = data.status.astralenergy.initial;
        data.status.karmaenergy.current = data.status.karmaenergy.initial;

        if (data.characteristics[guide.magical]) data.status.astralenergy.current += Math.round(data.characteristics[guide.magical].value * data.energyfactor.magical);

        if (data.characteristics[guide.clerical]) data.status.karmaenergy.current += Math.round(data.characteristics[guide.clerical].value * data.energyfactor.clerical);
      }

      data.status.astralenergy.max =
        data.status.astralenergy.current +
        data.status.astralenergy.modifier +
        data.status.astralenergy.advances +
        data.status.astralenergy.gearmodifier -
        data.status.astralenergy.permanentLossSum;
      data.status.karmaenergy.max =
        data.status.karmaenergy.current +
        data.status.karmaenergy.modifier +
        data.status.karmaenergy.advances +
        data.status.karmaenergy.gearmodifier -
        data.status.karmaenergy.permanentLossSum;

      data.status.soulpower.max = data.status.soulpower.value + data.status.soulpower.modifier + data.status.soulpower.gearmodifier;
      data.status.toughness.max = data.status.toughness.value + data.status.toughness.modifier + data.status.toughness.gearmodifier;
      data.status.dodge.value = Math.round(data.characteristics.ge.value / 2) + data.status.dodge.gearmodifier;

      let encumbrance = this.calcEncumbrance(data);

      const horse = Riding.isRiding(this) ? Riding.getHorse(this.parent) : undefined;
      this.calcInitiative(data, encumbrance, horse);

      data.status.dodge.max = Number(data.status.dodge.value) + Number(data.status.dodge.modifier) + Number(game.settings.get('dsa5', 'higherDefense')) / 2;

      //Actordsa5.postUpdateConditions(this)
      data.armorEncumbrance = this.getArmorEncumbrance(this.parent, wornArmor);

      this.prepareSwarm(data);
      this.effectivePain(data);

      const fixated = this.parent.statuses.has('fixated');
      this.calcSpeed(data, fixated, horse);

      if (fixated) {
        data.status.dodge.max = Math.max(0, data.status.dodge.max - 4);
      }
    } catch (error) {
      console.error(`Something went wrong with preparing actor data ${this.parent.name}: ` + error + error.stack);
      ui.notifications.error(game.i18n.format('DSAError.PreparationError', { name: this.parent.name }) + error + error.stack);
    }
    //let endTime = performance.now()

    //console.log(`Call to prepareData took ${endTime - startTime} milliseconds`)
  }

  calcSpeed(data, fixated, horse) {
      if (horse) {
        data.status.speed.max = horse.system.status.speed.max;
        if (!data.status.speed.max) {
          const horseData = horse.system;
          horse.calcSpeed(horseData, horse.hasCondition('fixated'));
        }
        data.status.speed.max = horse.system.status.speed.max;
      } else {
        data.status.speed.max = data.status.speed.initial + (data.status.speed.modifier || 0) + (data.status.speed.gearmodifier || 0);
        data.status.speed.max = Math.round(Math.max(0, data.status.speed.max - Math.min(4, this.calcEncumbrance(data))) * data.status.speed.multiplier);
  
        if (!this.parent.hasCondition('bloodrush')) data.status.speed.max = Math.max(0, data.status.speed.max - (data.condition?.inpain || 0));
  
        const paralysis = this.parent.hasCondition('paralysed');
        if (paralysis) data.status.speed.max = Math.round(data.status.speed.max * (1 - paralysis.flags.dsa5.value * 0.25));
        if (fixated) {
          data.status.speed.max = 0;
        } else if (this.parent.hasCondition('rooted') || this.parent.hasCondition('incapacitated')) data.status.speed.max = 0;
        else if (this.parent.hasCondition('prone')) data.status.speed.max = Math.min(1, data.status.speed.max);
  
        Riding.updateRiderSpeed(this.parent, data.status.speed.max);
      }
    }

  _getItemModifiers() {
    const wornArmor = [];
    const itemModifiers = {};
    for (let i of this.parent.items.filter(
      (x) => (['meleeweapon', 'rangeweapon', 'armor', 'equipment'].includes(x.type) && x.system.worn.value) || ['advantage', 'specialability', 'disadvantage'].includes(x.type),
    )) {
      this._buildGearAndAbilityModifiers(itemModifiers, i);

      if (i.type == 'armor') wornArmor.push(i);
    }
    this._getArmorCompensation(this.parent, wornArmor, itemModifiers);
    this._applyModiferTransformations(itemModifiers);
  }

  _buildGearAndAbilityModifiers(itemModifiers, i) {
    const effect = i.system.effect.value;
    if (!effect) return;

    for (let mod of `${effect}`.split(/,|;/).map((x) => x.trim())) {
      let vals = mod.replace(/(\s+)/g, ' ').trim().split(' ');
      if (vals.length == 2) {
        if (!isNaN(vals[0])) {
          let elem = {
            value: Number(vals[0]) * (i.system.step ? Number(i.system.step.value) || 1 : 1),
            source: i.name,
            type: i.type,
          };

          if (itemModifiers[vals[1]] == undefined) {
            itemModifiers[vals[1]] = [elem];
          } else {
            itemModifiers[vals[1]].push(elem);
          }
        }
      }
    }
  }

  _getArmorCompensation(actor, wornArmors, itemModifiers) {
    const armorCompensation = SpecialabilityRulesDSA5.abilityStep(actor, 'LocalizedIDs.inuredToEncumbrance');
    const armorEncumbrance = wornArmors.reduce((sum, x) => {
      return (sum += Number(x.system.encumbrance.value));
    }, 0);

    if (armorCompensation > armorEncumbrance) {
      const modKeys = [game.i18n.localize('CHARAbbrev.GS'), game.i18n.localize('CHARAbbrev.INI')];
      for (let modkey of modKeys) {
        if (!itemModifiers[modkey]) continue;

        itemModifiers[modkey] = itemModifiers[modkey].filter((x) => x.type != 'armor');
      }
    }
  }

  _applyModiferTransformations(itemModifiers) {
    this.itemModifiers = {};
    for (const key of Object.keys(itemModifiers)) {
      let shortCut = DSA5.knownShortcuts[key.toLowerCase()];
      if (shortCut) {
        const modSum = itemModifiers[key].reduce((prev, cur) => (prev = prev + cur.value), 0);

        this[shortCut[0]][shortCut[1]][shortCut[2]] += modSum;

        this.itemModifiers[key] = {
          value: modSum,
          sources: itemModifiers[key].map((x) => x.source),
        };
      }
    }
  }

  _calcBagweight(elem, containers, topLevel = true) {
    let totalWeight = 0;
    if (containers.has(elem._id)) {
      let bagweight = 0;
      if (!elem.system.worn.value && topLevel) totalWeight -= elem.system.preparedWeight;

      for (let child of containers.get(elem._id)) {
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

  calcEncumbrance(data) {
    return Math.clamp(data.condition?.encumbered || 0, 0, 4);
  }

  baseInitiative(data) {
    data.status.initiative.value = Math.round((data.characteristics.mu.value + data.characteristics.ge.value) / 2) + (data.status.initiative.modifier || 0);
  }

  calcInitiative(data, encumbrance, horse) {
    this.baseInitiative(data);

    if (horse) {
      data.status.initiative.value = horse.system.status.initiative.value;
      if (!data.status.initiative.value) {
        const horseData = horse.system;
        horse.calcInitiative(horseData, horse.calcEncumbrance(horseData));
        data.status.initiative.value = horseData.status.initiative.value;
      }
    } else {
      data.status.initiative.value += (data.status.initiative.gearmodifier || 0) - Math.min(4, encumbrance);
      const baseInit = Number((0.01 * data.status.initiative.value).toFixed(2));
      data.status.initiative.value *= data.status.initiative.multiplier || 1;
      data.status.initiative.value = Math.round(data.status.initiative.value) + baseInit;
    }
  }

  getArmorEncumbrance(actorData, wornArmors) {
    const encumbrance = wornArmors.reduce((sum, a) => {
      a.system.calculatedEncumbrance = Number(a.system.encumbrance.value) + EquipmentDamage.armorEncumbranceModifier(a);
      a.system.damageToolTip = EquipmentDamage.damageTooltip(a);
      return (sum += a.system.calculatedEncumbrance);
    }, 0);
    const ridingModifier = Riding.isRiding(this.parent) ? -1 : 0;
    return Math.max(0, encumbrance - SpecialabilityRulesDSA5.abilityStep(actorData, 'LocalizedIDs.inuredToEncumbrance') + ridingModifier);
  }

  prepareSwarm(data) {
    const count = Number(data.swarm.count) || 1;

    if (count < 2) return;

    data.swarm.maxwounds = data.status.wounds.max;
    data.status.wounds.max *= count;

    const effectiveCount = Math.min(Math.ceil(data.status.wounds.value / data.swarm.maxwounds), count);
    const gg = Number(data.swarm.gg) || 1;

    data.swarm.attack += Math.min(10, Math.floor(effectiveCount / gg));
    data.swarm.parry += -1;
    data.swarm.effectiveCount = effectiveCount;
    data.swarm.damage = Math.min(5, Math.floor(effectiveCount / gg));
  }

  effectivePain(data) {
    let pain = data.condition.inpain || 0;
    if (pain < 4)
      pain -=
        AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.ruggedFighter') +
        AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.ruggedAnimal') +
        (SpecialabilityRulesDSA5.hasAbility(this.parent, 'LocalizedIDs.traditionKor') ? 1 : 0);
    if (pain > 0) pain += AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.sensitiveToPain') + AdvantageRulesDSA5.vantageStep(this.parent, 'LocalizedIDs.fragileAnimal');

    pain = Math.clamp(pain, 0, 4);
    data.condition.inpain = pain;
  }
}
