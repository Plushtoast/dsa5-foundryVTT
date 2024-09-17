import DSA5_Utility from "../system/utility-dsa5.js";
import DSA5 from "../system/config-dsa5.js";
import DiceDSA5 from "../system/dice-dsa5.js";
import OpposedDsa5 from "../system/opposed-dsa5.js";
import DSA5Dialog from "../dialog/dialog-dsa5.js";
import AdvantageRulesDSA5 from "../system/advantage-rules-dsa5.js";
import SpecialabilityRulesDSA5 from "../system/specialability-rules-dsa5.js";
import DSA5StatusEffects from "../status/status_effects.js";
import Itemdsa5 from "../item/item-dsa5.js";
import TraitRulesDSA5 from "../system/trait-rules-dsa5.js";
import RuleChaos from "../system/rule_chaos.js";
import { tinyNotification } from "../system/view_helper.js";
import EquipmentDamage from "../system/equipment-damage.js";
import DSAActiveEffectConfig from "../status/active_effects.js";
import DSA5SoundEffect from "../system/dsa-soundeffect.js";
import CreatureType from "../system/creature-type.js";
import Riding from "../system/riding.js";
import APTracker from "../system/ap-tracker.js";
import DSATriggers from "../system/triggers.js";
import DSA5CombatDialog from "../dialog/dialog-combat-dsa5.js";
const { getProperty, mergeObject, duplicate, hasProperty, setProperty, expandObject } = foundry.utils

export default class Actordsa5 extends Actor {
  static DEFAULT_ICON = "icons/svg/mystery-man-black.svg"
  static selfRegex = /^self\./

  static async create(data, options) {
    if (data instanceof Array || data.items) return await super.create(data, options);

    const skills = (await DSA5_Utility.allSkills()) || [];
    const combatskills = (await DSA5_Utility.allCombatSkills()) || [];
    const moneyItems = (await DSA5_Utility.allMoneyItems()) || [];

    data.items = [...skills, ...combatskills, ...moneyItems];

    if (data.type != "character") data.system = { status: { fatePoints: { current: 0, value: 0 } } };

    if (data.type != "creature" && [undefined, 0].includes(getProperty(data, "system.status.wounds.value")))
      mergeObject(data, { system: { status: { wounds: { value: 16 } } } });

    return await super.create(data, options);
  }

  _getArmorCompensation(actor, wornArmors, itemModifiers) {
    const armorCompensation = SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize("LocalizedIDs.inuredToEncumbrance"));
    const armorEncumbrance = wornArmors.reduce((sum, x) => {
      return (sum += Number(x.system.encumbrance.value));
    }, 0);

    if(armorCompensation > armorEncumbrance){
      const modKeys = [game.i18n.localize('CHARAbbrev.GS'), game.i18n.localize('CHARAbbrev.INI')]
      for(let modkey of modKeys){
          if(!itemModifiers[modkey]) continue

          itemModifiers[modkey] = itemModifiers[modkey].filter(x => x.type != "armor")
      }
    }
  }

  _getItemModifiers(){
    const wornArmor = []
    const itemModifiers = {}
    for (let i of this.items.filter(
      (x) =>
        (["meleeweapon", "rangeweapon", "armor", "equipment"].includes(x.type) && getProperty(x, "system.worn.value")) || ["advantage", "specialability", "disadvantage"].includes(x.type)
    )) {
      this._buildGearAndAbilityModifiers(itemModifiers, i);

      if(i.type == "armor") wornArmor.push(i)
    }
    this._getArmorCompensation(this, wornArmor, itemModifiers)
    this._applyModiferTransformations(itemModifiers);
  }

  prepareDerivedData() {
    //let startTime = performance.now()
    const data = this.system;
    try {
      this._getItemModifiers()

      for (let ch of Object.values(data.characteristics)) {
        ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
      }

      data.totalWeight = 0;

      const wornArmor = []

      const familiarString = game.i18n.localize('LocalizedIDs.familiar')
      const petString = game.i18n.localize('LocalizedIDs.companion')
      const moneyHasWeight = game.settings.get("dsa5", "moneyHasWeight")

      let containers = new Map();
      const bags = this.items.filter(x => x.type == "equipment" && x.system.equipmentType.value == "bags")
      for (let container of bags) {
        containers.set(container.id, []);
      }

      this.system.moneyWeight = 0
      for(const i of this.items){
        if(moneyHasWeight && i.type == "money"){
          i.system.preparedWeight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
          data.totalWeight += Number(i.system.preparedWeight);
          this.system.moneyWeight += Number(i.system.preparedWeight)
        }
        else if(DSA5.equipmentCategories.has(i.type)){
          let parent_id = getProperty(i, "system.parent_id");
          if (parent_id && parent_id != i._id) {
            if (containers.has(parent_id)) {
              containers.get(parent_id).push(i);
              continue;
            }
          }
          if(i.type == "armor"){
            i.system.preparedWeight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            data.totalWeight += parseFloat(
              (
                i.system.weight.value * (i.system.worn.value ? Math.max(0, i.system.quantity.value - 1) : i.system.quantity.value)
              ).toFixed(3)
            );
            if(i.system.worn.value) wornArmor.push(i)
          } else {
            i.system.preparedWeight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            data.totalWeight += Number(i.system.preparedWeight);
          }
        } else {
          switch(i.type){
            case "trait":
              if(i.name == familiarString) data.isFamiliar = true
              else if(i.name == petString) data.isPet = true
              break
            case "spell":
            case "ritual":
            case "magictrick":
              data.isMage = true
              break
            case "liturgy":
            case "ceremony":
            case "blessing":
              data.isPriest = true
              break
            case "specialability":
              if(DSA5.sortedSpecs.magical.has(i.system.category.value)) data.isMage = true
              else if(DSA5.sortedSpecs.clerical.has(i.system.category.value)) data.isPriest = true
              break
          }
        }
      }

      data.isMage ||= data.isFamiliar

      for(let bag of bags){
        let parent_id = getProperty(bag, "system.parent_id")
        if(!parent_id || !containers.has(parent_id))
          data.totalWeight += this._calcBagweight(bag, containers, true)
      }

      data.canAdvance = this.isOwner && (this.type == "character" || data.isFamiliar || data.isPet)
      this.canAdvance = data.canAdvance

      data.carrycapacity = data.characteristics.kk.value * 2 + data.carryModifier

      if (data.canAdvance) {
        data.details.experience.current = data.details.experience.total - data.details.experience.spent;
        data.details.experience.description = DSA5_Utility.experienceDescription(data.details.experience.total);
      }
      if (this.type == "character" || this.type == "npc") {
        data.status.wounds.current = data.status.wounds.initial + data.characteristics.ko.value * 2;
        data.status.soulpower.value =
          (data.status.soulpower.initial || 0) +
          Math.round((data.characteristics.mu.value + data.characteristics.kl.value + data.characteristics.in.value) / 6);
        data.status.toughness.value =
          (data.status.toughness.initial || 0) +
          Math.round((data.characteristics.ko.value + data.characteristics.ko.value + data.characteristics.kk.value) / 6);
        data.status.wounds.min = -1 * data.characteristics.ko.value
      }

      data.status.fatePoints.max =
        Number(data.status.fatePoints.current) + Number(data.status.fatePoints.modifier) + data.status.fatePoints.gearmodifier;

      if (this.type == "creature") {
        data.status.wounds.current = data.status.wounds.initial;
        data.status.astralenergy.current = data.status.astralenergy.initial;
        data.status.karmaenergy.current = data.status.karmaenergy.initial;
      }

      data.status.wounds.max = Math.round(
        (data.status.wounds.current + data.status.wounds.modifier + data.status.wounds.advances) * data.status.wounds.multiplier +
        data.status.wounds.gearmodifier
      );

      data.status.regeneration.LePmax =
        data.status.regeneration.LePTemp + data.status.regeneration.LePMod + data.status.regeneration.LePgearmodifier;
      data.status.regeneration.KaPmax =
        data.status.regeneration.KaPTemp + data.status.regeneration.KaPMod + data.status.regeneration.KaPgearmodifier;
      data.status.regeneration.AsPmax =
        data.status.regeneration.AsPTemp + data.status.regeneration.AsPMod + data.status.regeneration.AsPgearmodifier;

      let guide = data.guidevalue;

      data.status.astralenergy.rebuy ||= 0
      data.status.karmaenergy.rebuy ||= 0
      data.status.astralenergy.permanentLoss ||= 0
      data.status.karmaenergy.permanentLoss ||= 0

      data.status.astralenergy.permanentLossSum = data.status.astralenergy.permanentLoss - data.status.astralenergy.rebuy + data.status.astralenergy.permanentGear
      data.status.karmaenergy.permanentLossSum = data.status.karmaenergy.permanentLoss - data.status.karmaenergy.rebuy + data.status.karmaenergy.permanentGear

      if (data.isFamiliar || (guide && this.type != "creature")) {
        data.status.astralenergy.current = data.status.astralenergy.initial;
        data.status.karmaenergy.current = data.status.karmaenergy.initial;

        if (data.characteristics[guide.magical])
          data.status.astralenergy.current += Math.round(data.characteristics[guide.magical].value * data.energyfactor.magical);

        if (data.characteristics[guide.clerical])
          data.status.karmaenergy.current += Math.round(data.characteristics[guide.clerical].value * data.energyfactor.clerical);
      }

      data.status.astralenergy.max =
        data.status.astralenergy.current +
        data.status.astralenergy.modifier +
        data.status.astralenergy.advances +
        data.status.astralenergy.gearmodifier -
        data.status.astralenergy.permanentLossSum
      data.status.karmaenergy.max =
        data.status.karmaenergy.current +
        data.status.karmaenergy.modifier +
        data.status.karmaenergy.advances +
        data.status.karmaenergy.gearmodifier -
        data.status.karmaenergy.permanentLossSum

      data.status.soulpower.max =
        data.status.soulpower.value + data.status.soulpower.modifier + data.status.soulpower.gearmodifier;
      data.status.toughness.max =
        data.status.toughness.value + data.status.toughness.modifier + data.status.toughness.gearmodifier;
      data.status.dodge.value = Math.round(data.characteristics.ge.value / 2) + data.status.dodge.gearmodifier;

      let encumbrance = this.calcEncumbrance(data)

      const horse = Riding.isRiding(this) ? Riding.getHorse(this) : undefined
      this.calcInitiative(data, encumbrance, horse)

      data.status.dodge.max =
        Number(data.status.dodge.value) +
        Number(data.status.dodge.modifier) +
        Number(game.settings.get("dsa5", "higherDefense")) / 2;

      //Actordsa5.postUpdateConditions(this)
      data.armorEncumbrance = this.getArmorEncumbrance(this, wornArmor);

      this.prepareSwarm(data)
      this.effectivePain(data)

      const fixated = this.statuses.has("fixated")
      this.calcSpeed(data, fixated, horse)

      if (fixated) {
        data.status.dodge.max = Math.max(0, data.status.dodge.max - 4);
      }
    } catch (error) {
      console.error(`Something went wrong with preparing actor data ${this.name}: ` + error + error.stack);
      ui.notifications.error(game.i18n.format("DSAError.PreparationError", {name: this.name}) + error + error.stack);
    }
    //let endTime = performance.now()

    //console.log(`Call to prepareData took ${endTime - startTime} milliseconds`)
  }

  static async deferredEffectAddition(effect, actor, target) {
    const current = actor.effects.find(x => x.statuses.has(effect))?.flags.dsa5.auto || 0
    const isChange = current != target
    const attr = `changing${effect}`
    actor[attr] = isChange;

    if(isChange)
      await actor.addCondition(effect, target, true, true).then(() => actor[attr] = undefined);
  }

  static async postUpdateConditions(actor) {
    if(!DSA5_Utility.isActiveGM()) return

    const data = actor.system
    const isMerchant = actor.isMerchant()

    if (!TraitRulesDSA5.hasTrait(actor, game.i18n.localize("LocalizedIDs.painImmunity"))){
      const pain = actor.woundPain(data)
      await this.deferredEffectAddition("inpain", actor, pain)
    }

    let newEncumbrance = data.armorEncumbrance
    if ((actor.type != "creature" || actor.canAdvance) && !isMerchant) {
      newEncumbrance += Math.max(0, Math.ceil((data.totalWeight - data.carrycapacity - 4) / 4));
    }

    await this.deferredEffectAddition("encumbered", actor, newEncumbrance)

    const brawlingPoints = actor.woundPain(data, "temporaryLeP")
    await this.deferredEffectAddition("stunned", actor, brawlingPoints)

    if (AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize("LocalizedIDs.blind"))) await actor.addCondition("blind");
    if (AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize("LocalizedIDs.mute"))) await actor.addCondition("mute");
    if (AdvantageRulesDSA5.hasVantage(actor, game.i18n.localize("LocalizedIDs.deaf"))) await actor.addCondition("deaf");

    if (isMerchant) await actor.prepareMerchant()
  }

  static async _onCreateOperation(documents, operation, user) {
    for(let doc of documents) {
        await Actordsa5.postUpdateConditions(doc)
    }
    return super._onCreateOperation(documents, operation, user);
  }

  static async _onUpdateOperation(documents, operation, user) {
    for(let doc of documents) {
        await Actordsa5.postUpdateConditions(doc)
    }
    return super._onUpdateOperation(documents, operation, user);
  }

  prepareSwarm(data){
     const count = Number(data.swarm.count) || 1

     if(count < 2) return

     data.swarm.maxwounds = data.status.wounds.max
     data.status.wounds.max *= count

     const effectiveCount = Math.min(Math.ceil(data.status.wounds.value / data.swarm.maxwounds), count)
     const gg = Number(data.swarm.gg) || 1

     data.swarm.attack += Math.min(10, Math.floor(effectiveCount / gg))
     data.swarm.parry += -1
     data.swarm.effectiveCount = effectiveCount
     data.swarm.damage = Math.min(5, Math.floor(effectiveCount / gg))
  }

  effectivePain(data){
    let pain = data.condition.inpain || 0
    if (pain < 4)
      pain -=
        AdvantageRulesDSA5.vantageStep(this, game.i18n.localize("LocalizedIDs.ruggedFighter")) +
        AdvantageRulesDSA5.vantageStep(this, game.i18n.localize("LocalizedIDs.ruggedAnimal")) +
        (SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize("LocalizedIDs.traditionKor")) ? 1 : 0);
    if (pain > 0)
      pain +=
        AdvantageRulesDSA5.vantageStep(this, game.i18n.localize("LocalizedIDs.sensitiveToPain")) +
        AdvantageRulesDSA5.vantageStep(this, game.i18n.localize("LocalizedIDs.fragileAnimal"));

    pain = Math.clamp(pain, 0, 4);
    data.condition.inpain = pain
  }

  woundPain(data, attr = "wounds"){
    let pain = 0;
    if (data.status[attr].max > 0) {
      const hasDefaultPain = this.type != "creature" || data.status[attr].max >= 20;
      if (hasDefaultPain) {
        pain = Math.floor((1 - data.status[attr].value / data.status[attr].max) * 4);
        if (data.status[attr].value <= 5) pain = 4;
      } else {
        pain = Math.floor(5 - (5 * data.status[attr].value) / data.status[attr].max);
      }
    }
    return Math.clamp(pain, 0, 4)
  }

  calcSpeed(data, fixated, horse){
    if(horse){
      data.status.speed.max = horse.system.status.speed.max
      if(!data.status.speed.max){
        const horseData = horse.system
        horse.calcSpeed(horseData, horse.hasCondition("fixated"))
      }
      data.status.speed.max = horse.system.status.speed.max
    } else {
      data.status.speed.max = data.status.speed.initial + (data.status.speed.modifier || 0) + (data.status.speed.gearmodifier || 0);
      data.status.speed.max = Math.round(
        Math.max(0, data.status.speed.max - Math.min(4, this.calcEncumbrance(data))) * data.status.speed.multiplier
      );

      if (!this.hasCondition("bloodrush")) data.status.speed.max = Math.max(0, data.status.speed.max - (data.condition?.inpain || 0));

      const paralysis = this.hasCondition("paralysed");
      if (paralysis) data.status.speed.max = Math.round(data.status.speed.max * (1 - paralysis.flags.dsa5.value * 0.25));
        if (fixated) {
          data.status.speed.max = 0;
        } else if (this.hasCondition("rooted") || this.hasCondition("incapacitated"))
          data.status.speed.max = 0;
        else if (this.hasCondition("prone"))
          data.status.speed.max = Math.min(1, data.status.speed.max);

      Riding.updateRiderSpeed(this, data.status.speed.max)
    }
  }

  calcEncumbrance(data){
    return Math.clamp(data.condition?.encumbered || 0, 0, 4)
  }

  calcInitiative(data, encumbrance, horse){
    if (this.type == "character" || this.type == "npc") {
      data.status.initiative.value =
      Math.round((data.characteristics.mu.value + data.characteristics.ge.value) / 2) +
      (data.status.initiative.modifier || 0);
    }else{
      data.status.initiative.value = data.status.initiative.current + (data.status.initiative.modifier || 0);
    }

    if(horse){
      data.status.initiative.value = horse.system.status.initiative.value
      if(!data.status.initiative.value){
        const horseData = horse.system
        horse.calcInitiative(horseData, horse.calcEncumbrance(horseData))
        data.status.initiative.value = horseData.status.initiative.value
      }
    } else {
      data.status.initiative.value += (data.status.initiative.gearmodifier || 0) - Math.min(4, encumbrance);
      const baseInit = Number((0.01 * data.status.initiative.value).toFixed(2));
      data.status.initiative.value *= data.status.initiative.multiplier || 1;
      data.status.initiative.value = Math.round(data.status.initiative.value) + baseInit;
    }
  }

  get creatureType() {
    return CreatureType.creatureTypeName(this)
  }

  async prepareMerchant() {
    if (getProperty(this, "system.merchant.merchantType") == "loot") {
      if (getProperty(this, "system.merchant.locked") && !this.hasCondition("locked")) {
        await this.addCondition(Actordsa5.lockedCondition());
      } else if (!getProperty(this, "system.merchant.locked")) {
        let ef = this.effects.find((x) => x.statuses.has("locked"));
        if (ef) await this.deleteEmbeddedDocuments("ActiveEffect", [ef.id]);
      }
    }
  }

  static lockedCondition() {
    return {
      id: "locked",
      name: game.i18n.localize("MERCHANT.locked"),
      img: "icons/svg/padlock.svg",
      flags: {
        dsa5: {
          noEffect: true,
          hidePlayers: true,
          description: game.i18n.localize("MERCHANT.locked")
        },
      },
    };
  }

  applyActiveEffects() {
    const overrides = {};

    this.statuses ??= new Set();
    // Identify which special statuses had been active
    const specialStatuses = new Map();
    for ( const statusId of Object.values(CONFIG.specialStatusEffects) ) {
      specialStatuses.set(statusId, this.statuses.has(statusId));
    }
    this.statuses.clear();

    
    const changes = []
    let multiply = 1
    for ( const e of this.effects ) {
      if(e.disabled) continue
      if(e.system.delayed) continue

      if(getProperty(e, "flags.dsa5.isAura")){
        this.auras.push(e.uuid)
        continue
      }

      multiply = 1
      const flag = e.getFlag("dsa5", "value")
      if(flag){
        multiply = Number(flag)
      }
      for (let i = 0; i < multiply; i++) {
        changes.push(
          ...e.changes.map((c) => {
            c = foundry.utils.duplicate(c);
            c.effect = e;
            c.priority = c.priority ? c.priority : c.mode * 10;
            return c;
          })
        )
      }
      for ( const statusId of e.statuses ) this.statuses.add(statusId);
    }
    let apply = true;

    const appliedArtifacts = this.items.filter(x => ["rangeweapon", "meleeweapon", "equipment", "armor"].includes(x.type) && x.system.isArtifact && (x.system.worn.value || (x.type == "equipment" && !x.system.worn.wearable))).map(x => x.system.artifact)
    const disableWeaponAdvantages = !game.settings.get("dsa5", "enableWeaponAdvantages")

    this.dsatriggers = { 6: {}, 7: {} }

    for(let item of this.items) {
      for(const e of item.effects) {
        if(e.disabled || !e.transfer || e.system.delayed) continue

        apply = true

        switch (item.type) {
          case "meleeweapon":
          case "rangeweapon":
            if(disableWeaponAdvantages && e.system.equipmentAdvantage) continue

            apply = item.system.worn.value && e.getFlag("dsa5", "applyToOwner");
            break
          case "armor":
            if(disableWeaponAdvantages && e.system.equipmentAdvantage) continue

            apply = item.system.worn.value
            break;
          case "equipment":
            apply = !item.system.worn.wearable || (item.system.worn.wearable && item.system.worn.value)
            break;
          case "trait":
            apply = !["meleeAttack", "rangeAttack"].includes(item.system.traitType.value) || e.getFlag("dsa5", "applyToOwner")
            multiply = Number(getProperty(item.system, "step.value")) || 1
            break
          case "ammunition":
          case "plant":
          case "consumable":
          case "combatskill":
          case "magicsign":
          case "poison":
          case "spell":
          case "liturgy":
          case "ceremony":
          case "ritual":
          case "skill":
          case "spellextension":
            apply = false;
            break;
          case "specialability":
            switch(item.system.category.value){
              case "Combat":
                apply = [2, 3].includes(Number(item.system.category.sub))
                break;
              case "staff":
                apply = item.system.permanentEffects || appliedArtifacts.includes(item.system.artifact)
                break
              default:
                apply = true
            }
            multiply = Number(item.system.step.value) || 1
            break
          case "advantage":
          case "disadvantage":
            multiply = Number(item.system.step.value) || 1
            break;
        }

        const advancedFunction = getProperty(e, "flags.dsa5.advancedFunction")
        if(this.dsatriggers.hasOwnProperty(advancedFunction)) this.dsatriggers[advancedFunction][item.id] = e.id

        e.notApplicable = !apply;

        if(apply && getProperty(e, "flags.dsa5.isAura")){
          this.auras.push(e.uuid)
          continue
        }

        if (!apply) continue

        for (let i = 0; i < multiply; i++) {
          changes.push(
            ...e.changes.map((c) => {
              c = foundry.utils.duplicate(c);
              c.effect = e;
              c.priority = c.priority ? c.priority : c.mode * 10;
              return c;
            })
          )
        }
        for ( const statusId of e.statuses ) this.statuses.add(statusId);
      }
    }
    changes.sort((a, b) => a.priority - b.priority);

    for (let change of changes) {
      if ( !change.key || Actordsa5.selfRegex.test(change.key)) continue;

      const result = change.effect.apply(this, change);
      Object.assign(overrides, result);
    }

    this.overrides = expandObject(overrides);
    let tokens;
    for ( const [statusId, wasActive] of specialStatuses ) {
      const isActive = this.statuses.has(statusId);
      if ( isActive === wasActive ) continue;
      tokens ??= this.getActiveTokens();
      for ( const token of tokens ) token._onApplyStatusEffect(statusId, isActive);
    }
  }

  _setOnUseEffect(item) {
    if (getProperty(item, "flags.dsa5.onUseEffect")) item.OnUseEffect = true;
  }

  _setAEPayments(item) {
    if(item.OnUseEffect) return

    const cost = Number(getProperty(item, "system.AsPCost"))
    if(cost) item.AEpayable = true
  }

  prepareBaseData() {
    const system = this.system;

    this.auras = []

    mergeObject(system, {
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
          damage: []
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
        ...["liturgy", "ceremony", "ritual", "spell", "skill"].reduce((prev, x) => {
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
          permanentGear: 0
        },
        karmaenergy: {
          permanentGear: 0
        },
        wounds: {
          multiplier: 1,
        },
        speed: {
          multiplier: 1
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
        coldProtection: 0
      },
      totalArmor: 0,
      spellArmor: 0,
      liturgyArmor: 0,
      carryModifier: 0,
      aspModifier: 0,
      kapModifier: 0,
      immunities: [],
      thresholds: {
        effects: []
      },
      creatureBonus: [],
      miracle: {
        attack: 0,
        parry: 0,
      },
      spellStats: {
        damage: "0",
      },
      liturgyStats: {
        damage: "0",
      },
      meleeStats: {
        parry: 0,
        attack: 0,
        damage: "0",
        defenseMalus: 0,
        botch: 20,
        crit: 1,
      },
      rangeStats: {
        attack: 0,
        damage: "0",
        defenseMalus: 0,
        botch: 20,
        crit: 1,
      },
    });

    for (const k of DSA5.gearModifyableCalculatedAttributes)
      if (system.status[k]) system.status[k].gearmodifier = 0;

    for (let ch of Object.values(system.characteristics)) ch.gearmodifier = 0;
  }

  getSkillModifier(name, sourceType) {
    const result = [];
    const keys = ["FP", "step", "QL", "TPM", "FW"];
    for (const k of keys) {
      const type = k == "step" ? "" : k;
      result.push(
        ...this.system.skillModifiers[k]
          .filter((x) => x.target == name)
          .map((f) => {
            return {
              name: f.source,
              value: f.value,
              type,
            };
          })
      );
      if (this.system.skillModifiers[sourceType]) {
        result.push(
          ...this.system.skillModifiers[sourceType][k].map((f) => {
            return {
              name: f.target || f.source,
              value: f.value,
              source: f.source,
              type,
            };
          })
        );
      }
    }
    return result;
  }

  getCombatEffectSkillModifier(name, mode) {
    const result = []
    const keys = ["step", mode]

    for (const k of keys) {
      result.push(
        ...this.system.skillModifiers.combat[k]
          .filter((x) => x.target == name)
          .map((f) => {
            return {
              name: `${f.target || f.source} - ${game.i18n.localize(`CHAR.${k.toUpperCase()}`)}`,
              value: f.value,
              source: f.source,
              type: k,
              selected: true
            };
          })
      );
    }
    return result
  }

  prepareSheet(sheetInfo) {
    let preparedData = { system: { characteristics: {} } };
    mergeObject(preparedData, this.prepareItems(sheetInfo));
    if (preparedData.canAdvance) {
      const attrs = ["wounds", "astralenergy", "karmaenergy"];
      const isAnimal = this.system.isFamiliar || this.system.isPet;
      let category = isAnimal ? "C" : "D";
      for (const k of attrs) {
        mergeObject(preparedData.system, {
          status: {
            [k]: {
              cost: game.i18n.format("advancementCost", {
                cost: DSA5_Utility._calculateAdvCost(this.system.status[k].advances, "D"),
              }),
              refund: game.i18n.format("refundCost", {
                cost: DSA5_Utility._calculateAdvCost(this.system.status[k].advances, "D", 0),
              }),
            },
          },
        });
      }
      category = isAnimal ? "C" : "E";
      for (let [key, ch] of Object.entries(this.system.characteristics)) {
        preparedData.system.characteristics[key] = {
          cost: game.i18n.format("advancementCost", {
            cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, category),
          }),
          refund: game.i18n.format("refundCost", {
            cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, category, 0),
          })
        };
      }
    }
    return preparedData;
  }

  static canAdvance(actorData) {
    return actorData.canAdvance;
  }

  static armorOpposedTransformation(actor, wornArmor, options) {
    if (options.origin) {
      let combatskill = getProperty(options.origin, "system.combatskill.value");

      wornArmor = wornArmor.map((armor) => {
        const optnCopy = mergeObject(duplicate(options), { armor });       

        if(combatskill) {
          combatskill += " "
          for(let ef of armor.effects){
            if(ef.disabled) continue

            for(let change of ef.changes) {
              if(change.key == "self.armorVulnerability") {
                const adaptions = change.value.split(/[,;]/)
                let adaption 
                if(options.defenderTest.attackFromBehind) adaption = adaptions.find(x => x.trim().startsWith("attackFromBehind "))
                if(!adaption) adaption = adaptions.find(x => x.trim().startsWith(combatskill))
                
                if(adaption) {
                  const number = Number(adaption.match(/[-+]?\d+/)[0]) || 0
                  for(let key of ["head","rightleg","leftleg","rightarm","leftarm","value"]){
                    if(armor.system.protection[key]) armor.system.protection[key] = Math.max(0, armor.system.protection[key] + number)
                  }
                } else {
                  adaption = adaptions.find(x => x.trim().startsWith("randomArmor "))
                  if(adaption) {
                    //random value
                    const randomArmorVals =  adaption.split(" ")[1].split("|")
                    const randomArmor = randomArmorVals[Math.floor(Math.random() * randomArmorVals.length)]

                    for(let key of ["head","rightleg","leftleg","rightarm","leftarm","value"]){
                      if(armor.system.protection[key]) armor.system.protection[key] = randomArmor
                    }
                  }
                }
              }
            }          
          }
        }
        
        return DSAActiveEffectConfig.applyRollTransformation(actor, optnCopy, DSATriggers.EVENTS.ARMOR_TRANSFORMATION).options.armor;
      });
    }
    return wornArmor
  }

  //TODO get rid of the multiple loops
  static armorValue(actor, options = {}) {
    const wornArmor = this.armorOpposedTransformation(actor, actor.items.filter((x) => x.type == "armor" && x.system.worn.value == true), options)
    const protection = wornArmor.reduce((a, b) => a + EquipmentDamage.armorWearModifier(b, b.system.protection.value), 0);
    const animalArmor = actor.items.reduce((a, b) => a + (b.type == "trait" && b.system.traitType.value == "armor" ? Number(b.system.at.value) : 0), 0);

    return {
      wornArmor,
      armor: protection + animalArmor + (actor.system.totalArmor || 0),
    };
  }

  static _calculateCombatSkillValues(skill, actorData,{ step, parry, attack } = { step: 0, parry: 0, attack: 0 }) {
    const modifiedTalentValue = skill.system.talentValue.value + step;

    if (skill.system.weapontype.value == "melee") {
      const vals = skill.system.guidevalue.value
        .split("/")
        .map(
          (x) =>
            Number(actorData.characteristics[x].initial) +
            Number(actorData.characteristics[x].modifier) +
            Number(actorData.characteristics[x].advances) +
            Number(actorData.characteristics[x].gearmodifier)
        );

      const parryChar = Math.max(...vals);
      const attackChar = actorData.characteristics.mu.initial + actorData.characteristics.mu.modifier + actorData.characteristics.mu. advances + actorData.characteristics.mu.gearmodifier;

      skill.system.parry.value = Math.ceil(modifiedTalentValue / 2) + Math.max(0, Math.floor((parryChar - 8) / 3)) + Number(game.settings.get("dsa5", "higherDefense")) + parry;
      skill.system.attack.value = modifiedTalentValue + Math.max(0, Math.floor((attackChar - 8) / 3)) + attack;
    } else {
      const attackChar = actorData.characteristics.ff.initial + actorData.characteristics.ff.modifier + actorData.characteristics.ff.advances + actorData.characteristics.ff.gearmodifier;
      
      skill.system.parry.value = 0;
      skill.system.attack.value = modifiedTalentValue + Math.max(0, Math.floor((attackChar - 8) / 3)) + attack;
    }

    skill.cost = game.i18n.format("advancementCost", { cost: DSA5_Utility._calculateAdvCost(skill.system.talentValue.value, skill.system.StF.value) })
    return skill;
  }

  drawAuras(force = false) {
    for(const token of this.getActiveTokens()){
      token.drawAuras(force)
    }
  }

  _onCreateDescendantDocuments(...args) {
    super._onCreateDescendantDocuments(...args);
    this.drawAuras();
  }
  _onUpdateDescendantDocuments(...args) {
    super._onUpdateDescendantDocuments(...args);
    const force = args[1] == "effects" && args[3].some(x => {
      return ["flags.dsa5.auraRadius", "flags.dsa5.borderColor", "flags.dsa5.disposition", "flags.dsa5.fillColor", "flags.dsa5.borderThickness"].some(y => hasProperty(x, y))
    })    
    this.drawAuras(force);
  }
  _onDeleteDescendantDocuments(...args) {
    super._onCreateDescendantDocuments(...args);
    this.drawAuras();
  }

  _perpareItemAdvancementCost(item) {
    const category = this.system.isPet || this.system.isFamiliar ? "C" : item.system.StF.value
    item.cost = game.i18n.format("advancementCost", {
      cost: DSA5_Utility._calculateAdvCost(item.system.talentValue.value, category),
    });
    item.refund = game.i18n.format("refundCost", {
      cost: DSA5_Utility._calculateAdvCost(item.system.talentValue.value, category, 0),
    })
    return item;
  }

  async modifyTokenAttribute(attribute, value, isDelta=false, isBar=true) {
    const current = foundry.utils.getProperty(this.system, attribute);

    let updates;
    if ( isBar ) {
      if (isDelta) value = Math.clamp(current.min || 0, Number(current.value) + value, current.max);
      updates = {[`system.${attribute}.value`]: value};
    } else {
      if ( isDelta ) value = Number(current) + value;
      updates = {[`system.${attribute}`]: value};
    }
    const allowed = Hooks.call("modifyTokenAttribute", {attribute, value, isDelta, isBar}, updates);
    return allowed !== false ? this.update(updates) : this;
  }

  schipshtml(){
    const schips = []
    for (let i = 1; i <= Number(this.system.status.fatePoints.max); i++) {
        schips.push({
            value: i,
            cssClass: i <= Number(this.system.status.fatePoints.value) ? "fullSchip" : "emptySchip"
        })
    }
    return schips
  }

  prepareItems(sheetInfo) {
    let actorData = this.toObject(false);
    let combatskills = [];
    let advantages = [];
    let disadvantages = [];
    let aggregatedtests = [];
    let diseases = [];
    let demonmarks = [];
    let wornweapons = [];
    let information = []
    const essence = []
    const imprint = []

    const specAbs = Object.fromEntries(Object.keys(DSA5.specialAbilityCategories).map((x) => [x, []]));
    const traits = Object.fromEntries(Object.keys(DSA5.traitCategories).map((x) => [x, []]));

    let armor = [];
    let rangeweapons = [];
    let meleeweapons = [];
    const traditionArtifacts = []

    const magic = {
      hasSpells: this.system.isMage,
      hasPrayers: this.system.isPriest,
      liturgy: [],
      spell: [],
      ritual: [],
      ceremony: [],
      blessing: [],
      magictrick: [],
      magicalsign: [],
    };

    const extensions = {
      spell: {},
      ritual: {},
      ceremony: {},
      liturgy: {},
    };

    const groupschips = this.hasPlayerOwner ? RuleChaos.getGroupSchips() : []
    const schips = this.schipshtml()

    const inventory = {
      meleeweapons: {
        items: [],
        show: false,
        dataType: "meleeweapon",
      },
      rangeweapons: {
        items: [],
        show: false,
        dataType: "rangeweapon",
      },
      armor: {
        items: [],
        show: false,
        dataType: "armor",
      },
      ammunition: {
        items: [],
        show: false,
        dataType: "ammunition",
      },
      plant: {
        items: [],
        show: false,
        dataType: "plant",
      },
      poison: {
        items: [],
        show: false,
        dataType: "poison",
      },
      book: {
        items: [],
        show: false,
        dataType: "book",
      },
    };

    for (let t in DSA5.equipmentTypes) {
      inventory[t] = {
        items: [],
        show: false,
        dataType: t,
      };
    }

    inventory["misc"].show = true;

    const money = {
      coins: [],
      total: 0,
      show: true,
    };

    actorData.items = actorData.items.sort((a, b) => {
      return a.name.localeCompare(b.name);
    });

    //we can later make equipment sortable
    //actorData.items = actorData.items.sort((a, b) => (a.sort || 0) - (b.sort || 0))

    let totalArmor = actorData.system.totalArmor || 0;

    let skills = {
      body: [],
      social: [],
      knowledge: [],
      trade: [],
      nature: [],
    };

    let containers = new Map();
    for (let container of actorData.items.filter((x) => x.type == "equipment" && x.system.equipmentType.value == "bags")) {
      containers.set(container._id, []);
    }

    let applications = new Map();
    let availableAmmunition = [];
    let hasTrait = false;
    const hasAnyItem = actorData.items.some(x => !(["skill", "combatskill", "money"].includes(x.type)))
    const horse = Riding.getHorse(this, true)

    for (let i of actorData.items) {
      try {
        let parent_id = getProperty(i, "system.parent_id");
        if (i.type == "ammunition") availableAmmunition.push(Actordsa5._prepareitemStructure(i));

        if (parent_id && parent_id != i._id) {
          if (containers.has(parent_id)) {
            containers.get(parent_id).push(i);
            continue;
          }
        }
        if (sheetInfo.details && sheetInfo.details.includes(i._id)) i.detailed = "shown";

        if(i.system.isArtifact) {
          i.volume = DSA5.traditionArtifacts[i.system.artifact] || 0
          i.volumeFinal = 0
          traditionArtifacts.push(i)
        }

        switch (i.type) {
          case "skill":
            skills[i.system.group.value].push(this._perpareItemAdvancementCost(i));
            break;
          case "information":
            information.push(i)
            break
          case "aggregatedTest":
            aggregatedtests.push(i);
            break;
          case "spellextension":
            if (extensions[i.system.category][i.system.source]) {
              extensions[i.system.category][i.system.source].push(i.name);
            } else {
              extensions[i.system.category][i.system.source] = [i.name];
            }
            break;
          case "ritual":
          case "spell":
          case "liturgy":
          case "ceremony":
            magic[i.type].push(Actordsa5.buildSpellChargeProgress(this._perpareItemAdvancementCost(i)));
            break;
          case "magicalsign":
          case "magictrick":
          case "blessing":
            magic[i.type].push(i);
            break;
          case "trait":
            switch (i.system.traitType.value) {
              case "rangeAttack":
                i = Actordsa5._prepareRangeTrait(i, this.system);
                break;
              case "meleeAttack":
                i = Actordsa5._prepareMeleetrait(i, this.system);
                break;
              case "armor":
                totalArmor += Number(i.system.at.value);
                break;
            }
            traits[i.system.traitType.value].push(i);
            hasTrait = true;
            break;
          case "combatskill":
            combatskills.push(Actordsa5._calculateCombatSkillValues(i, this.system));
            break;
          case "ammunition":
            inventory.ammunition.items.push(Actordsa5.prepareMag(i));
            inventory.ammunition.show = true;
            break;
          case "meleeweapon":
            i.toggleValue = i.system.worn.value || false;
            i.toggle = true;
            this._setOnUseEffect(i);
            inventory.meleeweapons.items.push(Actordsa5._prepareitemStructure(i));
            inventory.meleeweapons.show = true;
            if (i.toggleValue) wornweapons.push(i);
            break;
          case "rangeweapon":
            i.toggleValue = i.system.worn.value || false;
            i.toggle = true;
            this._setOnUseEffect(i);
            inventory.rangeweapons.items.push(Actordsa5._prepareitemStructure(i));
            inventory.rangeweapons.show = true;
            break;
          case "armor":
            i.toggleValue = i.system.worn.value || false;
            inventory.armor.items.push(Actordsa5._prepareitemStructure(i));
            inventory.armor.show = true;
            i.toggle = true;
            this._setOnUseEffect(i);

            if (i.system.worn.value) {
              for (let property in i.system.protection) {                
                const value = i.system.protection[property]
                i.system.protection[property] = EquipmentDamage.armorWearModifier(i, value)
              }
              totalArmor += Number(i.system.protection.value);
              armor.push(i);
            }
            break;
          case "book":
          case "poison":
          case "plant":
            inventory[i.type].items.push(i);
            inventory[i.type].show = true;
            break;
          case "consumable":
            inventory[i.system.equipmentType.value].items.push(Actordsa5._prepareConsumable(i));
            inventory[i.system.equipmentType.value].show = true;
            break;
          case "equipment":
            i.toggle = getProperty(i, "system.worn.wearable") || false;

            if (i.toggle) i.toggleValue = i.system.worn.value || false;

            this._setOnUseEffect(i);
            inventory[i.system.equipmentType.value].items.push(Actordsa5._prepareitemStructure(i));
            inventory[i.system.equipmentType.value].show = true;
            break;
          case "money":
            money.coins.push(i);
            money.total += i.system.quantity.value * i.system.price.value;
            break;
          case "advantage":
            this._setOnUseEffect(i);
            advantages.push(i);
            break;
          case "disadvantage":
            this._setOnUseEffect(i);
            disadvantages.push(i);
            break;
          case "specialability":
            this._setOnUseEffect(i);
            this._setAEPayments(i)
            specAbs[i.system.category.value].push(i);
            break;
          case "disease":
            diseases.push(i);
            break;
          case "patron":
            specAbs.magical.push(i);
            break;
          case "demonmark":
            demonmarks.push(i);
            break;
          case "essence":
            essence.push(i);
            break;
          case "imprint":
            imprint.push(i);
            break;
          case "application":
            if (applications.has(i.system.skill)) applications.get(i.system.skill).push(i);
            else applications.set(i.system.skill, [i]);
            break;
        }
      } catch (error) {
        this._itemPreparationError(i, error);
      }
    }

    for (let elem of inventory.bags.items) {
      this._setBagContent(elem, containers);
    }

    for (let [category, value] of Object.entries(extensions)) {
      for (let [spell, exts] of Object.entries(value)) {
        const findspell = magic[category].find((x) => x.name == spell)
        if(findspell)
          findspell.extensions = exts.join(", ");
        else
          ui.notifications.warn(game.i18n.format("DSAError.noSpellForExtension", { name: spell, category: DSA5_Utility.categoryLocalization(category), extension: exts.join(",")}))
      }
    }

    for (let wep of inventory.rangeweapons.items) {
      try {
        if (wep.system.worn.value) rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, availableAmmunition, combatskills, this));
      } catch (error) {
        this._itemPreparationError(wep, error);
      }
    }

    for (let wep of wornweapons) {
      try {
        meleeweapons.push(
          Actordsa5._prepareMeleeWeapon(
            wep,
            combatskills,
            actorData,
            wornweapons.filter((x) => x._id != wep._id && !RuleChaos.isYieldedTwohanded(x))
          )
        );
      } catch (error) {
        this._itemPreparationError(wep, error);
      }
    }

    for (let value of Object.values(skills)) {
      for (let skill of value) {
        skill.applications = applications.get(skill.name) || [];
      }
    }

    money.coins = money.coins.sort((a, b) => (a.system.price.value > b.system.price.value ? -1 : 1));

    specAbs.magical.push(...specAbs.pact);
    specAbs.clerical.push(...specAbs.ceremonial);

    for(let traditionAbility of specAbs.staff){
      const artifact = traditionArtifacts.find(x => x.system.artifact == traditionAbility.system.artifact)
      if(artifact){
        if(artifact.abilities == undefined) artifact.abilities = []

        artifact.abilities.push(traditionAbility)
        const vol = Number(traditionAbility.system.volume) || 0
        const volAttr = vol > 0 ? "volumeFinal" : "volume"
        artifact[volAttr] += Math.abs(vol) * Number(traditionAbility.system.step.value)
      }
      else{
        specAbs.magical.push(traditionAbility)
      }
    }

    let guidevalues = duplicate(DSA5.characteristics);
    guidevalues["-"] = "-";

    const brawling = combatskills.find((x) => x.name == game.i18n.localize("LocalizedIDs.wrestle"));

    return {
      totalWeight: parseFloat(this.system.totalWeight?.toFixed(3)),
      traditionArtifacts,
      armorSum: totalArmor,
      sortedSpecs: DSA5.sortedSpecs,
      spellArmor: actorData.system.spellArmor || 0,
      liturgyArmor: actorData.system.liturgyArmor || 0,
      money,
      brawling: {
        attack: brawling?.system.attack.value || 0,
        parry: brawling?.system.parry.value || 0
      },
      encumbrance: this.system.condition?.encumbered || 0,
      carrycapacity: this.system.carrycapacity,
      isSwarm: this.isSwarm(),
      canSwarm: !this.prototypeToken.actorLink,
      wornRangedWeapons: rangeweapons,
      wornMeleeWeapons: meleeweapons,
      moneyWeight: this.system.moneyWeight,
      horseActor: horse,
      advantages,
      hasAnyItem,
      disadvantages,
      specAbs,
      information,
      aggregatedtests,
      wornArmor: armor,
      essence,
      imprint,
      inventory,
      hasTrait,
      demonmarks,
      diseases,
      canBuild: game.dsa5.sheets.DSACharBuilder && !actorData.system.details.species?.value,
      itemModifiers: this.system.itemModifiers,
      languagePoints: actorData.system.freeLanguagePoints?.value ? `<span data-tooltip="languagePoints">(${actorData.system.freeLanguagePoints?.used}/${actorData.system.freeLanguagePoints?.value})</span>` : "",
      schips,
      groupschips,
      guidevalues,
      magic,
      traits,
      combatskills,
      canAdvance: this.canAdvance,
      sheetLocked: actorData.system.sheetLocked.value,
      bodyAttrs: ["ff","ge","ko","kk"],
      mentalAttrs: ["mu","kl","in", "ch"],
      allSkillsLeft: {
        body: skills.body,
        social: skills.social,
        nature: skills.nature,
      },
      allSkillsRight: {
        knowledge: skills.knowledge,
        trade: skills.trade,
      },
    };
  }

  isSwarm() {
    return (this.system.swarm.count > 1) && !this.prototypeToken.actorLink;
  }

  getArmorEncumbrance(actorData, wornArmors) {
    const encumbrance = wornArmors.reduce((sum, a) => {
      a.system.calculatedEncumbrance = Number(a.system.encumbrance.value) + EquipmentDamage.armorEncumbranceModifier(a);
      a.system.damageToolTip = EquipmentDamage.damageTooltip(a);
      return (sum += a.system.calculatedEncumbrance);
    }, 0);
    const ridingModifier = Riding.isRiding(this) ? -1 : 0
    return Math.max(
      0,
      encumbrance - SpecialabilityRulesDSA5.abilityStep(actorData, game.i18n.localize("LocalizedIDs.inuredToEncumbrance")) + ridingModifier
    );
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
      if(!topLevel){
        totalWeight += bagweight + elem.system.preparedWeight
      } else if(elem.system.worn.value){
        totalWeight += bagweight;
      }

      elem.system.bagweight = `${bagweight.toFixed(3)}/${elem.system.capacity}`;
    }
    return totalWeight;
  }

  _setBagContent(elem, containers) {
    if (containers.has(elem._id)) {
      elem.children = [];

      for (let child of containers.get(elem._id)) {
        elem.children.push(Actordsa5._prepareitemStructure(Actordsa5._prepareConsumable(child)));
        if (containers.has(child._id)) {
          this._setBagContent(child, containers);
        }
      }
    }
  }

  isMerchant() {
    return ["merchant", "loot"].includes(getProperty(this, "system.merchant.merchantType"));
  }

  _itemPreparationError(item, error) {
    console.error("Something went wrong with preparing item " + item.name + ": " + error);
    console.warn(error);
    console.warn(item);
    ui.notifications.error("Something went wrong with preparing item " + item.name + ": " + error);
  }

  _applyModiferTransformations(itemModifiers) {
    this.system.itemModifiers = {}
    for (const key of Object.keys(itemModifiers)) {
      let shortCut = game.dsa5.config.knownShortcuts[key.toLowerCase()];
      if (shortCut) {
        const modSum = itemModifiers[key].reduce((prev, cur) => prev = prev + cur.value, 0)

        this.system[shortCut[0]][shortCut[1]][shortCut[2]] += modSum;

        this.system.itemModifiers[key] = { value: modSum, sources: itemModifiers[key].map(x => x.source)}
      }
    }
  }

  _buildGearAndAbilityModifiers(itemModifiers, i) {
    const effect = getProperty(i, "system.effect.value");
    if (!effect) return

    for (let mod of `${effect}`.split(/,|;/).map((x) => x.trim())) {
      let vals = mod.replace(/(\s+)/g, " ").trim().split(" ");
      if (vals.length == 2) {
        if (!isNaN(vals[0])) {
          let elem = {
            value: Number(vals[0]) * (i.system.step ? Number(i.system.step.value) || 1 : 1),
            source: i.name,
            type: i.type
          }

          if (itemModifiers[vals[1]] == undefined) {
            itemModifiers[vals[1]] = [elem]
          } else {
            itemModifiers[vals[1]].push(elem)
          }
        }
      }
    }
  }

  async _updateAPs(APValue, dataUpdate = {}, options = {}) {
    if (Actordsa5.canAdvance(this)) {
      if (!isNaN(APValue) && !(APValue == null)) {
        const ap = Number(APValue);
        dataUpdate["system.details.experience.spent"] = Number(this.system.details.experience.spent) + ap;
        await this.update(dataUpdate, options);
        const msg = game.i18n.format(ap > 0 ? "advancementCost" : "refundCost", { cost: Math.abs(ap) });
        tinyNotification(msg);
      } else {
        ui.notifications.error("DSAError.APUpdateError", { localize: true });
      }
    }
  }

  async checkEnoughXP(cost) {
    if (!Actordsa5.canAdvance(this)) return true;
    if (isNaN(cost) || cost == null) return true;

    if (Number(this.system.details.experience.total) - Number(this.system.details.experience.spent) >= cost) {
      return true;
    } else if (Number(this.system.details.experience.total) == 0) {
      const template = await renderTemplate("systems/dsa5/templates/dialog/parts/expChoices.html", { entries: DSA5.startXP })
      let newXp = 0;
      let result = false;

      [result, newXp] = await new Promise((resolve, reject) => {
        new Dialog({
          title: game.i18n.localize("DSAError.NotEnoughXP"),
          content: template,
          default: "Yes",
          buttons: {
            Yes: {
              icon: '<i class="fa fa-check"></i>',
              label: game.i18n.localize("yes"),
              callback: (dlg) => {
                resolve([true, dlg.find('.APsel')[0].value]);
              },
            },
            cancel: {
              icon: '<i class="fas fa-times"></i>',
              label: game.i18n.localize("cancel"),
              callback: () => {
                resolve([false, 0]);
              },
            },
          },
        }).render(true);
      });
      if (result) {
        await this.update({ "system.details.experience.total": Number(newXp) });
        return true;
      }
    }
    ui.notifications.error("DSAError.NotEnoughXP", { localize: true });
    return false;
  }

  setupWeapon(item, mode, options, tokenId) {
    options["mode"] = mode;
    return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
  }

  throwMelee(item, tokenId) {
    const throwingWeapons = game.i18n.localize("LocalizedIDs.Throwing Weapons")
    const localizedCT = game.i18n.localize(`LocalizedCTs.${item.system.combatskill.value}`)

    const hasWeaponThrow = ["Daggers", "Fencing Weapons", "Impact Weapons", "Swords", "Polearms"].includes(localizedCT) && SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize("LocalizedIDs.weaponThrow"))
    const name = item.name + " (" + throwingWeapons + ")"
    const range = new Itemdsa5({
      name,
      type: "rangeweapon",
      system: {
          combatskill: { value: throwingWeapons},
          reach: { value: DSA5.meleeAsRangeReach[localizedCT]},
          effect: { attributes: item.system.effect.attributes },
          damage: { value: item.system.damage.value },
          quantity: { value: 1 },
      }
    })
   
    const options = {
      situationalModifiers: [{ name, value: hasWeaponThrow ? -4 : -8, selected: true}],
    }
    
    this.setupWeapon(range, "attack", options, tokenId).then(async(setupData) => {
      if(!hasWeaponThrow) {
        setupData.testData.source.dmgMultipliers ||= []
        setupData.testData.source.dmgMultipliers.push({ name: "LocalizedIDs.Throwing Weapons", val: "0.5" })
      }
      await this.basicTest(setupData);      
    });
  }

  setupWeaponless(statusId, options = {}, tokenId) {
    const attributes = []
    if (SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize("LocalizedIDs.mightyAstralBody")))
      attributes.push(game.i18n.localize("magical"))
    if (SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize("LocalizedIDs.mightyKarmalBody")))
      attributes.push(game.i18n.localize("blessed"))

    const item = DSA5.defaultWeapon({
      name: game.i18n.localize(`${statusId}Weaponless`),
      system: {
        combatskill: {
          value: game.i18n.localize("LocalizedIDs.wrestle"),
        },
        effect: {
          attributes: attributes.join(", ")
        }
      }
    })

    options.mode = statusId;
    return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
  }

  setupSpell(spell, options = {}, tokenId) {
    return this.setupSkill(spell, options, tokenId);
  }

  setupSkill(skill, options = {}, tokenId) {
    return Itemdsa5.getSubClass(skill.type).setupDialog(null, options, skill, this, tokenId);
  }

  tokenScrollingText(texts) {
    const tokens = this.isToken ? [this.token?.object] : this.getActiveTokens(true);
    for (let t of tokens) {
      if (!t) continue;

      let index = 0;
      for (let k of texts) {
        canvas.interface.createScrollingText(t.center, k.value, {
          anchor: index,
          direction: k.value > 0 ? 2 : 1,
          fontSize: game.settings.get("dsa5", "scrollingFontsize"),
          stroke: k.stroke,
          strokeThickness: 1,
          jitter: 0.25,
          duration: 1000,
        });

        index += 1;
      }
    }
  }

  _containsChangedAttribute(data, key) {
    const newValue = getProperty(data, key)
    return [null, undefined].includes(newValue) || newValue === getProperty(this, key) ? false : newValue
  }

  async _preUpdate(data, options, user) {
    const statusText = {
      wounds: 0x8b0000,
      astralenergy: 0x0b0bd9,
      karmaenergy: 0x04a236
    };

    if(game.combat?.isBrawling)
      statusText.temporaryLeP = 0xfc2a8f

    const scrolls = [];
    for (let key of Object.keys(statusText)) {
      const value = this._containsChangedAttribute(data, `system.status.${key}.value`)
      if (value !== false)
        scrolls.push({
          value: value - this.system.status[key].value,
          stroke: statusText[key],
        });
    }

    if (scrolls.length) this.tokenScrollingText(scrolls);

    const swarmCount = this._containsChangedAttribute(data, "system.swarm.count");
    if ((swarmCount !== false) && !options.skipSwarmUpdate) {
       const hp = getProperty(data, "system.status.wounds.value") || this.system.status.wounds.value;
       const delta = swarmCount - (this.system.swarm.count || 1);
       const baseHp = this.system.swarm.maxwounds || this.system.status.wounds.max;
       setProperty(data, "system.status.wounds.value", Math.max(0, hp + delta * baseHp));
    }

    const apSum = this._containsChangedAttribute(data, "system.details.experience.total");
    if (apSum !== false) {
      const previous = this.system.details.experience.total
      APTracker.track(this, { type: "sum", previous, next: apSum }, apSum - previous)
    }

    return super._preUpdate(data, options, user);
  }

  async applyDamage(rollFormula, options = {}) {
    const roll = await new Roll(`${rollFormula}`).evaluate()
    const amount = roll.total
    if(game.combat?.isBrawling) {
      const newVal = Math.min(this.system.status.temporaryLeP.max, this.system.status.temporaryLeP.value - amount);
      await this.update({ "system.status.temporaryLeP.value": newVal });
    } else {
      const newVal = Math.min(this.system.status.wounds.max, this.system.status.wounds.value - amount);
      await this.update({ "system.status.wounds.value": newVal });
    }

    if(options.msg) {
      const renderedRoll = await roll.render()
      ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${game.i18n.format(options.msg, { name: this.name })}</p>${renderedRoll}`))
    }
  }

  async applyRegeneration(LeP, AsP, KaP) {
    const update = {
      "system.status.wounds.value": Math.min(this.system.status.wounds.max, this.system.status.wounds.value + (LeP || 0)),
      "system.status.karmaenergy.value": Math.min(
        this.system.status.karmaenergy.max,
        this.system.status.karmaenergy.value + (KaP || 0)
      ),
      "system.status.astralenergy.value": Math.min(
        this.system.status.astralenergy.max,
        this.system.status.astralenergy.value + (AsP || 0)
      ),
    };
    await this.update(update);
  }

  async applyMana(rollFormula, type) {
    const state = type == "AsP" ? "astralenergy" : "karmaenergy";
    const amount = (await new Roll(`${rollFormula}`).evaluate()).total
    const newVal = Math.min(this.system.status[state].max, this.system.status[state].value - amount);
    if (newVal >= 0) {
      await this.update({[`system.status.${state}.value`]: newVal});
      return true
    } else {
      ui.notifications.error(`DSAError.NotEnough${type}`, { localize: true });
      return false
    }
  }

  preparePostRollAction(message) {
    let data = message.flags.data;
    let cardOptions = {
      flags: { img: message.flags.img },
      rollMode: data.rollMode,
      speaker: message.speaker,
      template: data.template,
      title: data.title,
      user: message.author,
    };
    if (data.attackerMessage) cardOptions.attackerMessage = data.attackerMessage;
    if (data.defenderMessage) cardOptions.defenderMessage = data.defenderMessage;
    if (data.unopposedStartMessage) cardOptions.unopposedStartMessage = data.unopposedStartMessage;
    return cardOptions;
  }

  resetTargetAndMessage(data, cardOptions) {
    if (data.originalTargets?.size) {
      game.user.targets = data.originalTargets;
      game.user.targets.user = game.user;
    }
    if (!data.defenderMessage && data.startMessagesList) {
      cardOptions.startMessagesList = data.startMessagesList;
    }
  }

  async fatererollDamage(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    cardOptions.fatePointDamageRerollUsed = true;
    this.resetTargetAndMessage(data, cardOptions);

    let oldDamageRoll = data.postData.damageRoll;
    let newRoll = await DiceDSA5.manualRolls(
      await new Roll(oldDamageRoll.formula || oldDamageRoll._formula).evaluate(),
      "CHATCONTEXT.rerollDamage"
    );

    for (let i = 0; i < newRoll.dice.length; i++) newRoll.dice[i].options.colorset = "black";

    await DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode);

    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    newTestData.damageRoll = duplicate(newRoll);

    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
    await message.update({ "flags.data.fatePointDamageRerollUsed": true });
    await this.reduceSchips(schipsource);
  }

  async fateisTalented(infoMsg, cardOptions, newTestData, message, data) {
    cardOptions.talentedRerollUsed = true;

    this.resetTargetAndMessage(data, cardOptions);

    infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.fatepointUsed")}</b></h3>
            ${game.i18n.format("CHATFATE.isTalented", {
      character: "<b>" + this.name + "</b>",
    })}<br>`;
    const html = await renderTemplate("systems/dsa5/templates/dialog/isTalentedReroll-dialog.html", {
      testData: newTestData,
      postData: data.postData,
    });
    new DSA5Dialog({
      title: game.i18n.localize("CHATFATE.selectDice"),
      content: html,
      buttons: {
        Yes: {
          icon: '<i class="fa fa-check"></i>',
          label: game.i18n.localize("Ok"),
          callback: async (dlg) => {
            let diesToReroll = dlg.find(".dieSelected").map(function () {return Number($(this).attr("data-index"));}).get();
            if (diesToReroll.length > 0) {
              let newRoll = [];
              for (let k of diesToReroll) {
                let term = newTestData.roll.terms[k * 2];
                newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]");
              }
              newRoll = await DiceDSA5.manualRolls(
                await new Roll(newRoll.join("+")).evaluate(),
                "CHATCONTEXT.talentedReroll"
              );
              await DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode);

              let ind = 0;
              let changedRolls = [];

              for (let k of diesToReroll) {
                const characteristic = newTestData.source.system[`characteristic${k + 1}`];
                const attr = characteristic ? game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`) + " - " : "";

                changedRolls.push(
                  `${attr}${newTestData.roll.terms[k * 2].results[0].result}/${newRoll.terms[ind * 2].results[0].result}`
                );
                newTestData.roll.terms[k * 2].results[0].result = Math.min(
                  newRoll.terms[ind * 2].results[0].result,
                  newTestData.roll.terms[k * 2].results[0].result
                );

                ind += 1;
              }
              infoMsg += `<b>${game.i18n.localize("Roll")}</b>: ${changedRolls.join(", ")}`;
              ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

              this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
              await message.update({ "flags.data.talentedRerollUsed": true });
            }
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("cancel"),
        },
      },
      default: "Yes",
    }).render(true);
  }

  //todo refactor this with istalented
  async fatereroll(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    cardOptions.fatePointDamageRerollUsed = true;
    this.resetTargetAndMessage(data, cardOptions);

    const html = await renderTemplate("systems/dsa5/templates/dialog/fateReroll-dialog.html", {
      testData: newTestData,
      postData: data.postData,
      singleDie: data.postData.characteristics.length == 1
    });
    new DSA5Dialog({
      title: game.i18n.localize("CHATFATE.selectDice"),
      content: html,
      buttons: {
        Yes: {
          icon: '<i class="fa fa-check"></i>',
          label: game.i18n.localize("Ok"),
          callback: async (dlg) => {
            let diesToReroll = dlg.find(".dieSelected").map(function () {return Number($(this).attr("data-index"));}).get();
            if (diesToReroll.length > 0) {
              let newRoll = [];
              for (let k of diesToReroll) {
                let term = newTestData.roll.terms[k * 2];
                newRoll.push(term.number + "d" + term.faces + "[" + term.options.colorset + "]");
              }
              newRoll = await DiceDSA5.manualRolls(
                await new Roll(newRoll.join("+")).evaluate(),
                "CHATCONTEXT.Reroll"
              );
              await DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode);

              let ind = 0;
              let changedRolls = [];
              const actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker);
              const phexTradition = game.i18n.localize("LocalizedIDs.traditionPhex");
              const isPhex = actor.items.some((x) => x.type == "specialability" && x.name == phexTradition);

              //todo replace with roll.editrollatindex & istalented
              for (let k of diesToReroll) {
                const characteristic = newTestData.source.system[`characteristic${k + 1}`];
                const attr = characteristic ? `${game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`)} - ` : "";
                changedRolls.push(
                  `${attr}${newTestData.roll.terms[k * 2].results[0].result}/${newRoll.terms[ind * 2].results[0].result}`
                );
                if (isPhex)
                  newTestData.roll.terms[k * 2].results[0].result = Math.min(
                    newRoll.terms[ind * 2].results[0].result,
                    newTestData.roll.terms[k * 2].results[0].result
                  );
                else newTestData.roll.terms[k * 2].results[0].result = newRoll.terms[ind * 2].results[0].result;

                ind += 1;
              }

              infoMsg += `<br><b>${game.i18n.localize("Roll")}</b>: ${changedRolls.join(", ")}`;
              ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
              newTestData.fateUsed = true

              this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
              await message.update({
                "flags.data.fatePointRerollUsed": true,
              });
              await this.reduceSchips(schipsource);
            }
          },
        },
        cancel: {
          icon: '<i class="fas fa-times"></i>',
          label: game.i18n.localize("cancel"),
        },
      },
      default: "Yes",
    }).render(true);
  }

  async fateaddQS(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    game.user.targets.forEach((t) =>
      t.setTarget(false, {
        user: game.user,
        releaseOthers: false,
        groupSelection: true,
      })
    );

    cardOptions.fatePointAddQSUsed = true;
    newTestData.qualityStep = 1;

    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
    await message.update({ "flags.data.fatePointAddQSUsed": true });
    await this.reduceSchips(schipsource);
  }

  async fateImprove(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

    this.resetTargetAndMessage(data, cardOptions);

    let rollType = message.flags.data.preData.source.type;
    if (["spell", "liturgy", "ceremony", "ritual", "skill"].includes(rollType)) {
      const html = await renderTemplate("systems/dsa5/templates/dialog/fateImprove-dialog.html", {
        testData: newTestData,
        postData: data.postData,
      });
      new DSA5Dialog({
        title: game.i18n.localize("CHATFATE.selectDice"),
        content: html,
        buttons: {
          Yes: {
            icon: '<i class="fa fa-check"></i>',
            label: game.i18n.localize("Ok"),
            callback: async (dlg) => {
              let fws = [0, 0, 0];
              let diesToUpgrade = dlg
                .find(".dieSelected")
                .map(function () {
                  return Number($(this).attr("data-index"));
                })
                .get();
              if (diesToUpgrade.length == 1) {
                fws[diesToUpgrade] = 2;
                const modifier = {
                  name: game.i18n.localize("CHATCONTEXT.improveFate"),
                  value: fws.join("|"),
                  type: "roll",
                };
                newTestData.roll.terms[diesToUpgrade * 2].results[0].result = Math.max(
                  1,
                  newTestData.roll.terms[diesToUpgrade * 2].results[0].result - 2
                );
                newTestData.situationalModifiers.push(modifier);
                this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                await message.update({ "flags.data.fateImproved": true });
                await this.reduceSchips(schipsource);
              }
            },
          },
          cancel: {
            icon: '<i class="fas fa-times"></i>',
            label: game.i18n.localize("cancel"),
          },
        },
        default: "Yes",
      }).render(true);
    } else {
      const modifier = {
        name: game.i18n.localize("CHATCONTEXT.improveFate"),
        value: 2,
        type: "roll",
      };
      newTestData.situationalModifiers.push(modifier);
      newTestData.roll.terms[0].results[0].result = Math.max(1, newTestData.roll.terms[0].results[0].result - 2);
      this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
      await message.update({ "flags.data.fateImproved": true });
      await this.reduceSchips(schipsource);
    }
  }

  async reduceSchips(schipsource) {
    if (schipsource == 0)
      await this.update({"system.status.fatePoints.value": this.system.status.fatePoints.value - 1});
    else {
      await Actordsa5.reduceGroupSchip()
    }
  }

  static async reduceGroupSchip(){
    if(game.user.isGM){
      const groupschips = game.settings
        .get("dsa5", "groupschips")
        .split("/")
        .map((x) => Number(x));
      groupschips[0] = groupschips[0] - 1;
      await game.settings.set("dsa5", "groupschips", groupschips.join("/"));
    }else {
      game.socket.emit("system.dsa5", {
          type: "reduceGroupSchip",
          payload: { }
      })
    }
  }

  async useFateOnRoll(message, type, schipsource) {
    if (type == "isTalented" || DSA5_Utility.fateAvailable(this, schipsource == 1)) {
      let data = message.flags.data;
      let cardOptions = this.preparePostRollAction(message);
      let fateAvailable;
      let schipText;
      if (schipsource == 0) {
        fateAvailable = this.system.status.fatePoints.value - 1;
        schipText = "PointsRemaining";
      } else {
        fateAvailable = game.settings.get("dsa5", "groupschips").split("/")[0];
        schipText = "GroupPointsRemaining";
      }
      let infoMsg = `<h3 class="center"><b>${game.i18n.localize("CHATFATE.fatepointUsed")}</b></h3>
                ${game.i18n.format("CHATFATE." + type, {
        character: "<b>" + this.name + "</b>",
      })}<br>
                <b>${game.i18n.localize(`CHATFATE.${schipText}`)}</b>: ${fateAvailable}`;

      let newTestData = data.preData;
      newTestData.extra.actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker).toObject(false);

      this[`fate${type}`](infoMsg, cardOptions, newTestData, message, data, schipsource);
    }
  }

  get horseSpeed(){
    return Riding.getHorseSpeed(this)
  }

  async _buildEmbedHTML(config, options={}) {
    const template = `systems/dsa5/templates/items/browse/${this.type}.html`
    const item = await renderTemplate(template, { document: this, isGM: game.user.isGM, ...(await this.sheet.getData()), ...options})
    return $(item)[0]
}

  setupFallingDamage(options, tokenId){
    const name = game.i18n.localize("fallingDamage")
    const skill = this.items.find(x => x.type == "skill" && x.name == game.i18n.localize('LocalizedIDs.bodyControl')).toObject()
    const optns = { subtitle: ` (${name})`, postFunction: { functionName: "game.dsa5.entities.Actordsa5.updateFallingDamage", options, tokenId, speaker: Itemdsa5.buildSpeaker(this, tokenId) } }
    this.setupSkill(skill, optns, tokenId).then(async(finalData) => {
      finalData.testData.opposable = false
      const res = await this.basicTest(finalData, { suppressMessage: true })
      await Actordsa5.updateFallingDamage(optns.postFunction, res)
      await DiceDSA5.renderRollCard(res.cardOptions, res.result, res.options.rerenderMessage)
    })
  }

  static async updateFallingDamage(postFunction, result, source){
    const availableQs = (result.result.qualityStep || 0) * 2
    mergeObject(postFunction.options, { availableQs })
    const actor = DSA5_Utility.getSpeaker(postFunction.speaker)
    const setupData = await actor._setupFallingHeight(postFunction.options, postFunction.tokenId)
    const fallingDamage = await actor.basicTest(setupData, { suppressMessage: true })
    const html = await renderTemplate("systems/dsa5/templates/chat/roll/fallingdamage-card.html", fallingDamage)

    if (!result.result.other) result.result.other = []

    result.result.other.push(html)

    if(result.chatData){ result.chatData.other = [html] }
  }

  _setupFallingHeight(options, tokenId){
    let title = game.i18n.localize("fallingDamage")
    let testData = {
      source: {
        type: "fallingDamage"
      },
      opposable: false,
      extra: {
        actor: this.toObject(false),
        options,
        speaker: Itemdsa5.buildSpeaker(this, tokenId),
      },
    };

    const situationalModifiers = []
    const dialogOptions = {
      title,
      template: "/systems/dsa5/templates/dialog/fallingdamage-dialog.html",
      data: {
        rollMode: options.rollMode,
        situationalModifiers,
        fallingFloorOptions: DSA5.fallingConditions,
        modifier: options.modifier || 0,
      },
      callback: (html, options = {}) => {
        testData.situationalModifiers = []
        testData.situationalModifiers.push({
          name: game.i18n.localize("fallingFloor"), value: html.find('[name="fallingFloor"]').val()
        })
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.fallingHeight = html.find('[name="testModifier"]').val();
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/fallingdamage-card.html", title, tokenId);

    return DiceDSA5.setupDialog({
      dialogOptions,
      testData,
      cardOptions,
    });
  }

  setupRegeneration(statusId, options = {}, tokenId) {
    let title = game.i18n.localize("regenerationTest");

    let testData = {
      source: {
        type: "regenerate",
        system: {},
      },
      opposable: false,
      extra: {
        statusId,
        actor: this.toObject(false),
        options,
        speaker: Itemdsa5.buildSpeaker(this, tokenId),
      },
    };

    testData.extra.actor.isMage = this.system.isMage;
    testData.extra.actor.isPriest = this.system.isPriest;
    let situationalModifiers = DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source);
    let dialogOptions = {
      title,
      template: "/systems/dsa5/templates/dialog/regeneration-dialog.html",
      data: {
        rollMode: options.rollMode,
        regenerationInterruptOptions: DSA5.regenerationInterruptOptions,
        regnerationCampLocations: DSA5.regnerationCampLocations,
        showAspModifier: this.system.isMage,
        showKapModifier: this.system.isPriest,
        situationalModifiers,
        modifier: options.modifier || 0,
      },
      callback: (html, options = {}) => {
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.situationalModifiers.push(
          {
            name:
              game.i18n.localize("camplocation") + " - " + html.find('[name="regnerationCampLocations"] option:selected').text(),
            value: html.find('[name="regnerationCampLocations"]').val(),
          },
          {
            name:
              game.i18n.localize("interruption") +
              " - " +
              html.find('[name="regenerationInterruptOptions"] option:selected').text(),
            value: html.find('[name="regenerationInterruptOptions"]').val(),
          }
        );
        testData.regenerationFactor = html.find('[name="badEnvironment"]').is(":checked") ? 0.5 : 1;
        const attrs = ["LeP", "KaP", "AsP"]
        const update = {}
        for (let k of attrs) {
          testData[`${k}Modifier`] = Number(html.find(`[name="${k}Modifier"]`).val() || 0);
          testData[`regeneration${k}`] = Number(this.system.status.regeneration[`${k}max`])
          const regenerate = html.find(`[name="regenerate${k}"]`).is(":checked") ? 1 : 0
          testData[`regenerate${k}`] = regenerate
          if (regenerate) update[`system.status.regeneration.${k}Temp`] = 0
        }

        mergeObject(testData.extra.options, options);
        this.update(update);
        return { testData, cardOptions };
      },
    };

    let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/regeneration-card.html", title, tokenId);

    return DiceDSA5.setupDialog({
      dialogOptions,
      testData,
      cardOptions,
    });
  }

  setupDodge(options = {}, tokenId) {
    const statusId = "dodge";
    const testData = {
      source: {
        system: this.system.status[statusId],
        type: statusId,
      },
      opposable: false,
      extra: {
        statusId,
        actor: this.toObject(false),
        options,
        speaker: Itemdsa5.buildSpeaker(this, tokenId),
      },
    };

    const toSearch = [game.i18n.localize(statusId), game.i18n.localize('LocalizedIDs.wrestle')];
    const combatskills = Itemdsa5.buildCombatSpecAbs(this, ["Combat"], toSearch, "parry").concat(Itemdsa5.buildCombatSpecAbs(this, ["animal"], undefined, "parry"))
    const situationalModifiers = DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source);
    const isRangeAttack = Itemdsa5.getDefenseMalus(situationalModifiers, this);
    const multipleDefenseValue = RuleChaos.multipleDefenseValue(this, testData.source);

    const data = {
      rollMode: options.rollMode,
      combatSpecAbs: combatskills,
      showDefense: true,
      situationalModifiers,
      isRangeAttack,
      defenseCountString: game.i18n.format("defenseCount", { malus: multipleDefenseValue, }),
      multipleDefenseValue,
      isDodge: true
    }
    const dialogOptions = {
      title: `${game.i18n.localize(statusId)} ${game.i18n.localize("Test")}`,
      template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
      data,
      callback: (html, options = {}) => {
        DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, this, options, multipleDefenseValue, "parry")
        Hooks.call("callbackDialogCombatDSA5", testData, this, html, testData.source, tokenId)
        testData.isRangeDefense = data.isRangeDefense
        return { testData, cardOptions }
      },
    };

    const cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/status-card.html", dialogOptions.title, tokenId);

    return DiceDSA5.setupDialog({
      dialogOptions,
      testData,
      cardOptions,
    });
  }

  setupCharacteristic(characteristicId, options = {}, tokenId) {
    let char = duplicate(this.system.characteristics[characteristicId]);
    let title = DSA5_Utility.attributeLocalization(characteristicId) + " " + game.i18n.localize("Test");

    char.attr = characteristicId
    let testData = {
      opposable: false,
      source: {
        type: "char",
        system: char,
      },
      extra: {
        characteristicId,
        actor: this.toObject(false),
        options,
        speaker: Itemdsa5.buildSpeaker(this, tokenId),
      },
    };

    let dialogOptions = {
      title,
      template: "/systems/dsa5/templates/dialog/characteristic-dialog.html",
      data: {
        rollMode: options.rollMode,
        difficultyLabels: DSA5.attributeDifficultyLabels,
        modifier: options.modifier || 0,
      },
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/characteristic-card.html", title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }

  static _parseModifiers(html) {
    return [
      ...html.find('[name="situationalModifiers"] option:selected').map(function() {
        const val = this.value;
        const data = {
          name: this.textContent.trim().split("[")[0],
          value: isNaN(val) ? val : Number(val),
          type: this.dataset.type,
        };
        if (data.type == "dmg") {
          data.damageBonus = data.value;
          data.value = 0;
        }
        if (this.dataset.specAbId) data.specAbId = this.dataset.specAbId
        if (this.dataset.armorPen) data.armorPen = this.dataset.armorPen
  
        return data
      }).get(),
      {
        name: game.i18n.localize("manual"),
        value: Number(html.find('[name="testModifier"]').val()),
        type: "",
      }
    ]
  }

  static _prepareConsumable(item) {
    if (item.system.maxCharges) {
      item.consumable = true;
      item.structureMax = item.system.maxCharges;
      item.structureCurrent = item.system.charges;
    }
    return item;
  }

  static prepareMag(item) {
    if (item.system.ammunitiongroup.value == "mag") {
      item.structureMax = item.system.mag.max;
      item.structureCurrent = item.system.mag.value;
    }
    return item;
  }

  static _prepareitemStructure(item) {
    if (item.system.structure && item.system.structure.max != 0) {
      item.structureMax = item.system.structure.max;
      item.structureCurrent = item.system.structure.value;
    }
    const enchants = getProperty(item, "flags.dsa5.enchantments");
    if (enchants && enchants.length > 0) {
      item.enchantClass = "rar";
    }
    else if(item.effects.length > 0){
      item.enchantClass = "common"
    }
    else if (item.system.effect && item.system.effect.value != "") {
      if (item.type == "armor") {
        for (let mod of item.system.effect.value.split(/,|;/).map(x => x.trim())) {
          let vals = mod.replace(/(\s+)/g, ' ').trim().split(" ")
          //TODO should only pass if modifier is -1, -1
          if (vals.length == 2 && [game.i18n.localize('CHARAbbrev.INI').toLowerCase(), game.i18n.localize('CHARAbbrev.GS').toLowerCase()].includes(vals[1].toLowerCase()) && !isNaN(vals[0]) && vals[0] == -1) {
            continue
          } else {
            item.enchantClass = "common"
            break
          }
        }
      } else {
        item.enchantClass = "common"
      }
    }

    return item;
  }

  static _prepareMeleetrait(item, actorData) {
    item.attack = Number(item.system.at.value);
    if (item.system.pa != 0) item.parry = item.system.pa;

    return this._parseDmg(item, actorData);
  }

  static _prepareMeleeWeapon(item, combatskills, actorData, wornWeapons = null) {
    let skill = combatskills.find((i) => i.name == item.system.combatskill.value);
    if (skill) {
      item.attack = Number(skill.system.attack.value) + Number(item.system.atmod.value);
      const vals = item.system.guidevalue.value.split("/").map((x) => {
        if (!actorData.system.characteristics[x]) return 0;
        return (
          Number(actorData.system.characteristics[x].initial) +
          Number(actorData.system.characteristics[x].modifier) +
          Number(actorData.system.characteristics[x].advances) +
          Number(actorData.system.characteristics[x].gearmodifier)
        );
      });
      const baseParry =
        Math.ceil(skill.system.talentValue.value / 2) +
        Math.max(0, Math.floor((Math.max(...vals) - 8) / 3)) +
        Number(game.settings.get("dsa5", "higherDefense"));

      item.parry = baseParry + Number(item.system.pamod.value) + (RuleChaos.isShield(item) ? Number(item.system.pamod.value) : 0);

      item.yieldedTwoHand = RuleChaos.isYieldedTwohanded(item)
      if (!item.yieldedTwoHand) {
        if (!wornWeapons)
          wornWeapons = actorData.items.filter(
            (x) => x.type == "meleeweapon" && x.system.worn.value && x._id != item._id && !RuleChaos.isYieldedTwohanded(x)
          );

        if (wornWeapons.length > 0) {
          item.parry += Math.max(...wornWeapons.map((x) => x.system.pamod.offhandMod));
          item.attack += Math.max(...wornWeapons.map((x) => x.system.atmod.offhandMod));
        }
      }

      let gripDamageMod = 0
      if (item.system.worn.wrongGrip) {
        if (item.yieldedTwoHand) {
          item.parry -= 1
          gripDamageMod = 1
        }
        else {
          item.system.reach.value = "medium"

          const localizedCT = game.i18n.localize(`LocalizedCTs.${item.system.combatskill.value}`)
          switch (localizedCT) {
            case "Two-Handed Impact Weapons":
            case "Two-Handed Swords":
              item.parry -= 3
              const reg = new RegExp(game.i18n.localize('wrongGrip.wrongGripBastardRegex'))
              if (reg.test(item.name)) {
                gripDamageMod = -2
              }
              else {
                const oneHanded = game.i18n.localize('wrongGrip.oneHanded')
                item.gripDamageText = ` (${oneHanded} * 0.5)`
                item.dmgMultipliers ||= []
                item.dmgMultipliers.push({ name: oneHanded, val: "0.5" })
              }
              break
            default:
              item.parry -= 1
              gripDamageMod = -1
          }
        }
      }

      item = this._parseDmg(item, actorData.system);
      if (item.system.guidevalue.value != "-") {
        let val = Math.max(
          ...item.system.guidevalue.value.split("/").map((x) => Number(actorData.system.characteristics[x].value))
        );
        let extra = Math.max(val - Number(item.system.damageThreshold.value), 0) + gripDamageMod;

        if (extra > 0) {
          item.extraDamage = extra;
          item.damageAdd = Roll.safeEval(item.damageAdd + " + " + Number(extra));
          item.damageAdd = (item.damageAdd > 0 ? "+" : "") + item.damageAdd;
        }
      }
      EquipmentDamage.weaponWearModifier(item);
      item.system.damageToolTip = EquipmentDamage.damageTooltip(item);
    } else {
      ui.notifications.error(
        game.i18n.format("DSAError.unknownCombatSkill", {
          skill: item.system.combatskill.value,
          item: item.name,
        })
      );
    }
    return item;
  }

  async actorEffects() {
    const allowedEffects = ["dead"];
    const isAllowedToSeeEffects = game.user.isGM || this.testUserPermission(game.user, "OBSERVER") || !game.settings.get("dsa5", "hideEffects");

    return isAllowedToSeeEffects ? this.effects.filter((x) => x.isVisibleEffect()) : this.effects.filter((x) => allowedEffects.some(y => x.statuses.has(y)));
  }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    let update = {};

    if (!data.img) update.img = "icons/svg/mystery-man-black.svg";

    if (data.type == "character") {
      mergeObject(update, {
        prototypeToken: {
          sight: { enabled: true },
          actorLink: true,
        },
      });
    }
    this.updateSource(update);
  }

  async exclusiveEquipWeapon(itemId, offHand = false) {
    const item = this.items.get(itemId);

    if(!item) return

    let updates = []
    switch(item.type) {
      case "armor":
      case "rangeweapon":
        const items = this.items.filter(x => x.type == item.type && x.id != itemId && x.system.worn.value)
        updates = items.map(x => { return {_id: x.id, "system.worn.value": false}})
        updates.push({_id: itemId, "system.worn.value": true})
        break
      case "meleeweapon":
        let weapons = this.items.filter(x => x.type == item.type && x.id != itemId && x.system.worn.value)
        const weaponUpdate = {_id: itemId, "system.worn.value": true}
        if(!RuleChaos.isYieldedTwohanded(item)){
          weapons = weapons.filter(x => RuleChaos.isYieldedTwohanded(x) || x.system.worn.offHand == offHand)
          weaponUpdate["system.worn.offHand"] = offHand
        }
        updates = weapons.map(x => { return {_id: x.id, "system.worn.value": false}})
        updates.push(weaponUpdate)
        break
    }
    if(updates)
      await this.updateEmbeddedDocuments("Item", updates)
  }

  static _prepareRangeTrait(item, actorData) {
    item.attack = Number(item.system.at.value);
    item.LZ = Number(item.system.reloadTime.value);
    if (item.LZ > 0) Actordsa5.buildReloadProgress(item);

    return this._parseDmg(item, actorData);
  }

  static calcLZ(item, actor) {
    let factor = 1;
    let modifier = 0;
    if (item.system.combatskill.value == game.i18n.localize("LocalizedIDs.Throwing Weapons"))
      modifier = SpecialabilityRulesDSA5.abilityStep(actor, game.i18n.localize("LocalizedIDs.quickdraw")) * -1;
    else if (
      item.system.combatskill.value == game.i18n.localize("LocalizedIDs.Crossbows") &&
      SpecialabilityRulesDSA5.hasAbility(
        actor,
        `${game.i18n.localize("LocalizedIDs.quickload")} (${game.i18n.localize("LocalizedIDs.Crossbows")})`
      )
    )
      factor = 0.5;
    else {
      modifier =
        SpecialabilityRulesDSA5.abilityStep(
          actor,
          `${game.i18n.localize("LocalizedIDs.quickload")} (${game.i18n.localize(item.system.combatskill.value)})`
        ) * -1;
    }

    let reloadTime = `${item.system.reloadTime.value}`.split("/");
    if (item.system.ammunitiongroup.value == "mag") {
      let currentAmmo = actor.items.find((x) => x.id == item.system.currentAmmo.value || x._id == item.system.currentAmmo.value);
      let reloadType = 0;
      if (currentAmmo) {
        currentAmmo =  DSA5_Utility.toObjectIfPossible(currentAmmo)
        if (currentAmmo.system.mag.value <= 0) reloadType = 1;
      }
      reloadTime = reloadTime[reloadType] || reloadTime[0];
    } else {
      reloadTime = reloadTime[0];
    }

    return Math.max(0, Math.round(Number(reloadTime) * factor) + modifier);
  }

  static _parseDmg(item, rollData, modification = undefined) {
    const parseDamage = new Roll(DiceDSA5.replaceDieLocalization(item.system.damage.value), rollData || {});

    let damageDie = "",
      damageTerm = "",
      lastOperator = "+";
    
    for (let k of parseDamage.terms) {
      if (k.faces) damageDie = k.number + "d" + k.faces;
      else if (k.operator) lastOperator = k.operator;
      else if (k.number) damageTerm += `${lastOperator}${k.number}`
    }
    if (modification) {
      let damageMod = getProperty(modification, "system.damageMod");
      if (Number(damageMod)) damageTerm += `+${Number(damageMod)}`;
      else if (damageMod)
        item.damageBonusDescription = `, ${damageMod} ${game.i18n.localize("CHARAbbrev.damage")} ${modification.name}`;
    }
    if (damageTerm) damageTerm = Roll.safeEval(damageTerm);

    item.damagedie = damageDie ? damageDie : "0d6";
    item.damageAdd = damageTerm != "" ? (Number(damageTerm) >= 0 ? "+" : "") + damageTerm : "";

    return item;
  }

  static buildReloadProgress(item) {
    const progress = item.system.reloadTime.progress / item.LZ;
    item.title = game.i18n.format("WEAPON.loading", {
      status: `${item.system.reloadTime.progress}/${item.LZ}`,
    });
    item.progress = `${item.system.reloadTime.progress}/${item.LZ}`;
    if (progress >= 1) {
      item.title = game.i18n.localize("WEAPON.loaded");
    }
    this.progressTransformation(item, progress);
  }

  static progressTransformation(item, progress) {
    if (progress >= 0.5) {
      item.transformRight = "181deg";
      item.transformLeft = `${Math.round(progress * 360 - 179)}deg`;
    } else {
      item.transformRight = `${Math.round(progress * 360 + 1)}deg`;
      item.transformLeft = 0;
    }
  }

  static buildSpellChargeProgress(item) {
    item.LZ = Number(item.system.castingTime.modified) || 0;
    if (item.LZ > 1) {
      const progress = item.system.castingTime.progress / item.LZ;
      item.title = game.i18n.format("SPELL.loading", {
        status: `${item.system.castingTime.progress}/${item.LZ}`,
      });
      item.progress = `${item.system.castingTime.progress}/${item.LZ}`;
      this.progressTransformation(item, progress);
    }
    return item;
  }

  static _prepareRangeWeapon(item, ammunitions, combatskills, actor) {
    let skill = combatskills.find((i) => i.name == item.system.combatskill.value);
    item.calculatedRange = item.system.reach.value;

    let currentAmmo;
    if (skill) {
      item.attack = Number(skill.system.attack.value);

      if (item.system.ammunitiongroup.value != "-") {
        item.ammo = ammunitions.filter((x) => x.system.ammunitiongroup.value == item.system.ammunitiongroup.value)
        
        for(let am of item.ammo) am.label = `(${am.system.quantity.value}) ${am.name}`

        currentAmmo = item.ammo.find((x) => x._id == item.system.currentAmmo.value);
        if (currentAmmo) {
          const rangeMultiplier = Number(currentAmmo.system.rangeMultiplier) || 1;
          item.calculatedRange = item.calculatedRange
            .split("/")
            .map((x) => Math.round(Number(x) * rangeMultiplier))
            .join("/");
          item.attack += Number(currentAmmo.system.atmod) || 0;
          if (currentAmmo.system.ammunitiongroup.value == "mag") {
            item.ammoMax = currentAmmo.system.mag.max;
            item.ammoCurrent = currentAmmo.system.mag.value;
          }
        }
      }
      item.LZ = Actordsa5.calcLZ(item, actor);
      if (item.LZ > 0) Actordsa5.buildReloadProgress(item);

      EquipmentDamage.weaponWearModifier(item);
      item.system.damageToolTip = EquipmentDamage.damageTooltip(item);
    } else {
      ui.notifications.error(
        game.i18n.format("DSAError.unknownCombatSkill", {
          skill: item.system.combatskill.value,
          item: item.name,
        })
      );
    }

    return this._parseDmg(item, actor.system, currentAmmo);
  }

  _setupCardOptions(template, title, tokenId) {
    const token = game.canvas?.tokens?.get(tokenId)
    let cardOptions = {
      speaker: {
        alias: token ? token.name : this.prototypeToken.name,
        actor: this.id,
      },
      title,
      template,
      flags: {
        img: this.prototypeToken.randomImg ? this.img : this.prototypeToken.img,
      },
    };
    if (this.token) {
      cardOptions.speaker.alias = this.token.name;
      cardOptions.speaker.token = this.token.id;
      cardOptions.speaker.scene = canvas.scene.id;
      cardOptions.flags.img = this.token.img;
    } else {
      let speaker = ChatMessage.getSpeaker();
      if (speaker.actor == this.id) {
        cardOptions.speaker.alias = speaker.alias;
        cardOptions.speaker.token = speaker.token;
        cardOptions.speaker.scene = speaker.scene;
        cardOptions.flags.img = speaker.token ? canvas.tokens.get(speaker.token).img : cardOptions.flags.img;
      }
    }
    return cardOptions;
  }  

  async swapMag(weaponId) {
    const weapon = this.items.get(weaponId);
    const currentAmmo = this.items.get(weapon.system.currentAmmo.value);
    if (currentAmmo && currentAmmo.system.quantity.value > 1) {
      await this.updateEmbeddedDocuments("Item", [
        {
          _id: currentAmmo.id,
          "system.quantity.value": currentAmmo.system.quantity.value - 1,
          "system.mag.value": currentAmmo.system.mag.max,
        },
      ]);
      DSA5SoundEffect.playEquipmentWearStatusChange(currentAmmo);
      return currentAmmo;
    }
    ui.notifications.error("DSAError.NoAmmo", { localize: true });
    return undefined;
  }

  async toggleStatusEffect(statusId, {active, overlay=false}={}) {
    const existing = this.effects.find(e => e.statuses.has(statusId));

    if(overlay) {
      if(active) return false

      this.removeCondition(statusId, 1, false)
    } else {
      if (!existing || Number.isNumeric(getProperty(existing, "flags.dsa5.value"))) {
        if(!active && active != undefined) return false
        
        await this.addCondition(statusId, 1, false, false)
      }          
      else {
        if(active) return false

        await this.removeCondition(statusId, 1, false)
      }          
    }    
  }

  async payMiracles(testData) {
    if (!testData.extra.miraclePaid) {
      testData.extra.miraclePaid = true;
      const miracleMight = game.i18n.localize("LocalizedIDs.miracleMight")
      const miracle = game.i18n.localize("LocalizedIDs.miracle")
      const hasMiracleMight = testData.situationalModifiers.some(x => x.name.trim() == miracleMight);
      const hasMiracle = testData.situationalModifiers.some((x) => x.name.trim() == miracle);
      const cost = hasMiracleMight ? 6 : hasMiracle ? 4 : 0;
      if (cost) {
        await this.update({ "system.status.karmaenergy.value": this.system.status.karmaenergy.value - cost });
      }
    }
  }

  async consumeAmmunition(testData) {
    if (testData.extra.ammo && !testData.extra.ammoDecreased) {
      testData.extra.ammoDecreased = true;

      if (testData.extra.ammo._id) {
        let ammoUpdate = { _id: testData.extra.ammo._id };
        if (testData.extra.ammo.system.ammunitiongroup.value == "mag") {
          if (testData.extra.ammo.system.mag.value <= 0) {
            testData.extra.ammo.system.quantity.value--;
            ammoUpdate["system.quantity.value"] = testData.extra.ammo.system.quantity.value;
            ammoUpdate["system.mag.value"] = testData.extra.ammo.system.mag.max - 1;
          } else {
            ammoUpdate["system.mag.value"] = testData.extra.ammo.system.mag.value - 1;
          }
        } else {
          testData.extra.ammo.system.quantity.value--;
          ammoUpdate["system.quantity.value"] = testData.extra.ammo.system.quantity.value;
        }
        await this.updateEmbeddedDocuments("Item", [ammoUpdate, { _id: testData.source._id, "system.reloadTime.progress": 0 }]);
      }
    } else if (
      (testData.source.type == "rangeweapon" ||
        (testData.source.type == "trait" && testData.source.system.traitType.value == "rangeAttack")) &&
      !testData.extra.ammoDecreased
    ) {
      testData.extra.ammoDecreased = true;
      await this.updateEmbeddedDocuments("Item", [{ _id: testData.source._id, "system.reloadTime.progress": 0 }]);
    } else if (["spell", "liturgy"].includes(testData.source.type) && testData.extra.speaker.token != "emptyActor") {
      await this.updateEmbeddedDocuments("Item", [
        {
          _id: testData.source._id,
          "system.castingTime.progress": 0,
          "system.castingTime.modified": 0,
        },
      ]);
    }
  }

  _checkMaximumItemAdvancement(item, newValue) {
    let max = 0
    const maxBonus = AdvantageRulesDSA5.vantageStep(this, `${game.i18n.localize(`LocalizedIDs.${item.type == "combatskill" ? "exceptionalCombatTechnique" : "exceptionalSkill"}`)} (${item.name})`)
    switch (item.type) {
        case "combatskill":
            max = Math.max(...(item.system.guidevalue.value.split("/").map(x => this.system.characteristics[x].value))) + 2 + maxBonus
            break
        case "spell":
        case "ritual":
            let focusValue = 0
            for (const feature of item.system.feature.replace(/\(a-z äöü\-\)/gi, "").split(",").map(x => x.trim())) {
                if (SpecialabilityRulesDSA5.hasAbility(this, `${game.i18n.localize('LocalizedIDs.propertyKnowledge')} (${feature})`)) {
                    focusValue = this.maxByAttr(item, maxBonus)
                    break
                }
            }
            max = Math.max(14 + maxBonus, focusValue)
            break
        case "liturgy":
        case "ceremony":
            const aspect = new RegExp(`^${game.i18n.localize("LocalizedIDs.aspectKnowledge")}`)
            let aspectValue = 0
            if (this.items.filter(x => x.type == "specialability" && aspect.test(x.name)).some(x => item.system.distribution.value.includes(x.name.split("(")[1].split(")")[0]))) {
                aspectValue = this.maxByAttr(item, maxBonus)
            }
            max = Math.max(14 + maxBonus, aspectValue)
            break
        case "skill":
            max = this.maxByAttr(item, maxBonus)
            break
    }
    const result = newValue <= max
    if (!result)
        ui.notifications.error("DSAError.AdvanceMaximumReached", { localize: true })

    return { result, max, maxBonus }
  }

  maxByAttr(item, advantageBonus) {
    return Math.max(...[this.system.characteristics[item.system.characteristic1.value].value, this.system.characteristics[item.system.characteristic2.value].value, this.system.characteristics[item.system.characteristic3.value].value]) + 2 + advantageBonus
  }

  async basicTest({ testData, cardOptions }, options = {}) {
    testData = await DiceDSA5.rollDices(testData, cardOptions);
    let result = await DiceDSA5.rollTest(testData);

    if (testData.extra.options.other) {
      if (!result.other) result.other = [];
      result.other.push(...testData.extra.options.other);
    }

    result.postFunction = "basicTest";

    if (game.user.targets.size) {
      cardOptions.isOpposedTest = testData.opposable;
      const opposed = ` - ${game.i18n.localize("Opposed")}`;
      if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + "$") != opposed) cardOptions.title += opposed;
    }

    await this.consumeAmmunition(testData);
    await this.payMiracles(testData);

    if (!options.suppressMessage) {
      const msg = await DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage);
      await OpposedDsa5.handleOpposedTarget(msg);
      result.messageId = msg.id;
    }

    return { result, cardOptions, options };
  }

  async addCondition(effect, value = 1, absolute = false, auto = false) {
    if (effect == "bleeding" || effect.id == "bleeding") return await RuleChaos.bleedingMessage(this);

    //V11 actor delta fix for #displayScrollingStatus
    if(this.isToken && !this.token?.object) {
      console.warn("Actor token object is null for", this.name)
      return
    }

    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  async addTimedCondition(effect, value = 1, absolute = false, auto = true, options = {}){
    if (effect == "bleeding" || effect.id == "bleeding") return await RuleChaos.bleedingMessage(this);

    if (typeof(effect) === "string" && options.duration) {
      effect = duplicate(CONFIG.statusEffects.find(e => e.id == effect))
      effect.flags.dsa5.description = game.i18n.localize(effect.name)
      effect.name = game.i18n.localize(effect.name)

      if(effect.changes) {
        effect.changes = effect.changes.map(change => {
          if(/^system\.condition\./.test(change.key)) change.value = value
          return change
        })
      }
      effect.statuses = [effect.id]
      
      delete effect.description
      delete effect.flags.dsa5.value
      delete effect.flags.dsa5.max
      delete effect.id

      mergeObject(effect, options)
    }

    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  async initResistPainRoll(effect) {
    const showMessage = game.settings.get("dsa5", "selfControlOnPain")

    if(this.hasCondition("incapacitated")) return

    if (showMessage == 2 || (showMessage == 1 && !this.hasPlayerOwner)) {
      await this.addCondition("incapacitated")
      return
    }

    const template = await renderTemplate("systems/dsa5/templates/chat/roll/resist-pain.html", { actor: this })
    await ChatMessage.create(DSA5_Utility.chatDataSetup(template))
  }

  async finishResistPainRoll() {
    const skill = this.items.find(x => x.name == game.i18n.localize('LocalizedIDs.selfControl') && x.type == "skill")
    this.setupSkill(skill, { subtitle: ` (${game.i18n.localize('ActiveEffects.resistRoll')})` }, this.token?.id).then(async (setupData) => {
      const res = await this.basicTest(setupData)
      const ql = res.result.successLevel || 0
      if (ql < 1) {
        this.addCondition("incapacitated")
      }
    })
  }

  async removeCondition(effect, value = 1, auto = true, absolute = false) {
    return await DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute);
  }

  hasCondition(conditionKey) {
    return DSA5StatusEffects.hasCondition(this, conditionKey);
  }

  async markDead(dead) {
    const tokens = this.getActiveTokens();

    for (let token of tokens) {
      if (token.combatant) await token.combatant.update({ defeated: dead });
    }
  }
}