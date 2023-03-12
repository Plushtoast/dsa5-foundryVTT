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

export default class Actordsa5 extends Actor {
  static async create(data, options) {
    if (data instanceof Array || data.items) return await super.create(data, options);

    if (!data.img || data.img == "icons/svg/mystery-man.svg") data.img = "icons/svg/mystery-man-black.svg";

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
    let wornArmor = []
    let itemModifiers = {}
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
    const data = this.system;
    try {      
      this._getItemModifiers()
      for (let ch of Object.values(data.characteristics)) {
        ch.value = ch.initial + ch.advances + (ch.modifier || 0) + ch.gearmodifier;
        ch.cost = game.i18n.format("advancementCost", {
          cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E"),
        });
        ch.refund = game.i18n.format("refundCost", {
          cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, "E", 0),
        });
      }

      //We should iterate at some point over the items to prevent multiple loops

      const isFamiliar = RuleChaos.isFamiliar(this);
      const isPet = RuleChaos.isPet(this);
      data.canAdvance = (this.type == "character" || isFamiliar || isPet) && this.isOwner;
      this.canAdvance = data.canAdvance
      data.isMage =
        isFamiliar ||
        this.items.some(
          (x) => ["ritual", "spell", "magictrick"].includes(x.type) ||
            (x.type == "specialability" && ["magical", "staff", "pact"].includes(x.system.category.value))
        );
      data.isPriest = this.items.some(
        (x) => ["ceremony", "liturgy", "blessing"].includes(x.type) ||
          (x.type == "specialability" && ["ceremonial", "clerical"].includes(x.system.category.value))
      );
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
      if (isFamiliar || (guide && this.type != "creature")) {
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
        data.status.astralenergy.gearmodifier;
      data.status.karmaenergy.max =
        data.status.karmaenergy.current +
        data.status.karmaenergy.modifier +
        data.status.karmaenergy.advances +
        data.status.karmaenergy.gearmodifier;
      
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

      if (DSA5_Utility.isActiveGM()) {
        const pain = this.woundPain(data)
        const currentPain = this.effects.find(x => x.statuses.has("inpain"))?.flags.dsa5.auto || 0
      
        const changePain = !this.changingPain && (currentPain != pain)
        this.changingPain = currentPain != pain;

        if (changePain && !TraitRulesDSA5.hasTrait(this, game.i18n.localize("LocalizedIDs.painImmunity"))){
          this.addCondition("inpain", pain, true).then(() => this.changingPain = undefined);
        }          

        if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize("LocalizedIDs.blind"))) this.addCondition("blind");
        if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize("LocalizedIDs.mute"))) this.addCondition("mute");
        if (AdvantageRulesDSA5.hasVantage(this, game.i18n.localize("LocalizedIDs.deaf"))) this.addCondition("deaf");

        if (this.isMerchant()) this.prepareMerchant()

        //console.log(this.name, "updated")
      }   

      this.effectivePain(data)
      
      const fixated = this.hasCondition("fixated")
      this.calcSpeed(data, fixated, horse)
      
      if (fixated) {
        data.status.dodge.max = Math.max(0, data.status.dodge.max - 4);
      }      
    } catch (error) {
      console.error("Something went wrong with preparing actor data: " + error + error.stack);
      ui.notifications.error(game.i18n.format("DSAError.PreparationError", {name: this.name}) + error + error.stack);
    }
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

    pain = Math.clamped(pain, 0, 4);
    data.condition.inpain = pain
  }

  woundPain(data){
    let pain = 0;
    if (data.status.wounds.max > 0) {
      const hasDefaultPain = this.type != "creature" || data.status.wounds.max >= 20;
      if (hasDefaultPain) {
        pain = Math.floor((1 - data.status.wounds.value / data.status.wounds.max) * 4);
        if (data.status.wounds.value <= 5) pain = 4;
      } else {
        pain = Math.floor(5 - (5 * data.status.wounds.value) / data.status.wounds.max);
      }
    } 
    return Math.clamped(pain, 0, 4)
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

      if (!this.hasCondition("bloodrush")) data.status.speed.max = Math.max(0, data.status.speed.max - (data.condition.inpain || 0));

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
    return Math.clamped(data.condition.encumbered || 0, 0, 4)
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
        horse.calcInitiative(horseData, horse.calcEncumbrance())
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
      label: game.i18n.localize("MERCHANT.locked"),
      icon: "icons/svg/padlock.svg",
      flags: {
        dsa5: {
          value: null,
          editable: true,
          noEffect: true,
          hidePlayers: true,
          description: game.i18n.localize("MERCHANT.locked"),
          custom: true,
        },
      },
    };
  }

  applyActiveEffects() {
    const overrides = {};

    const changes = this.effects.reduce((changes, e) => {
      if (e.disabled) return changes;

      let multiply = 1
      if (e.origin) {
        const id = e.origin.match(/[^.]+$/)[0];
        const item = this.items.get(id);
        if (item) {
          let apply = true;

          switch (item.type) {
            case "meleeweapon":
            case "rangeweapon":
              apply = item.system.worn.value && e.getFlag("dsa5", "applyToOwner");
              break
            case "armor":
              apply = item.system.worn.value
              break;
            case "equipment":
              apply = !item.system.worn.wearable || (item.system.worn.wearable && item.system.worn.value)
              break;
            case "trait":
              apply = !["meleeAttack", "rangeAttack"].includes(item.system.traitType.value) || e.getFlag("dsa5", "applyToOwner")
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
            case "spellextension":
              apply = false;
              break;
            case "specialability":
              apply = item.system.category.value != "Combat" || [2, 3].includes(Number(item.system.category.sub));
              multiply = Number(item.system.step.value) || 1
              break
            case "advantage":
            case "disadvantage":
              multiply = Number(item.system.step.value) || 1
              break;
          } 
          e.notApplicable = !apply;

          if (!apply) return changes;
        }
        
      }else{
        const flag = e.getFlag("dsa5", "value")
        if(flag){
          multiply = Number(flag)
        }
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
      return changes
    }, []);
    changes.sort((a, b) => a.priority - b.priority);

    for (let change of changes) {
      const result = change.effect.apply(this, change);
      if (result !== null) overrides[change.key] = result;
    }

    this.overrides = foundry.utils.expandObject(overrides);
  }

  _setOnUseEffect(item) {
    if (getProperty(item, "flags.dsa5.onUseEffect")) item.OnUseEffect = true;
  }

  prepareBaseData() {
    const system = this.system;

    mergeObject(system, {
      itemModifiers: {},
      condition: {},
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
      totalArmor: 0,
      spellArmor: 0,
      liturgyArmor: 0,
      carryModifier: 0,
      aspModifier: 0,
      kapModifier: 0,
      immunities: [],
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
    let result = [];
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
              name: f.source,
              value: f.value,
              type,
            };
          })
        );
      }
    }
    return result;
  }

  prepareSheet(sheetInfo) {
    let preparedData = { system: {} };
    mergeObject(preparedData, this.prepareItems(sheetInfo));
    if (preparedData.canAdvance) {
      const attrs = ["wounds", "astralenergy", "karmaenergy"];
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
    }
    return preparedData;
  }

  static canAdvance(actorData) {
    return actorData.canAdvance;
  }

  //TODO get rid of the multiple loops
  static armorValue(actor, options = {}) {
    let wornArmor = actor.items.filter((x) => x.type == "armor" && x.system.worn.value == true);
    if (options.origin) {
      wornArmor = wornArmor.map((armor) => {
        let optnCopy = mergeObject(duplicate(options), { armor });
        return DSAActiveEffectConfig.applyRollTransformation(actor, optnCopy, 4).options.armor;
      });
    }
    const protection = wornArmor.reduce((a, b) => a + EquipmentDamage.armorWearModifier(b, b.system.protection.value), 0);
    const animalArmor = actor.items
      .filter((x) => x.type == "trait" && x.system.traitType.value == "armor")
      .reduce((a, b) => a + Number(b.system.at.value), 0);
    return {
      wornArmor,
      armor: protection + animalArmor + (actor.system.totalArmor || 0),
    };
  }

  static _calculateCombatSkillValues(i, actorData) {
    if (i.system.weapontype.value == "melee") {
      const vals = i.system.guidevalue.value
        .split("/")
        .map(
          (x) =>
            Number(actorData.characteristics[x].initial) +
            Number(actorData.characteristics[x].modifier) +
            Number(actorData.characteristics[x].advances) +
            Number(actorData.characteristics[x].gearmodifier)
        );
      const parryChar = Math.max(...vals);
      i.system.parry.value =
        Math.ceil(i.system.talentValue.value / 2) +
        Math.max(0, Math.floor((parryChar - 8) / 3)) +
        Number(game.settings.get("dsa5", "higherDefense"));
      const attackChar =
        actorData.characteristics.mu.initial +
        actorData.characteristics.mu.modifier +
        actorData.characteristics.mu.advances +
        actorData.characteristics.mu.gearmodifier;

      i.system.attack.value = i.system.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
    } else {
      i.system.parry.value = 0;
      let attackChar =
        actorData.characteristics.ff.initial +
        actorData.characteristics.ff.modifier +
        actorData.characteristics.ff.advances +
        actorData.characteristics.ff.gearmodifier;
      i.system.attack.value = i.system.talentValue.value + Math.max(0, Math.floor((attackChar - 8) / 3));
    }
    i.cost = game.i18n.format("advancementCost", {
      cost: DSA5_Utility._calculateAdvCost(i.system.talentValue.value, i.system.StF.value),
    })
    return i;
  }

  _perpareItemAdvancementCost(item) {
    item.cost = game.i18n.format("advancementCost", {
      cost: DSA5_Utility._calculateAdvCost(item.system.talentValue.value, item.system.StF.value),
    });
    item.refund = game.i18n.format("refundCost", {
      cost: DSA5_Utility._calculateAdvCost(item.system.talentValue.value, item.system.StF.value, 0),
    })
    return item;
  }

  async modifyTokenAttribute(attribute, value, isDelta=false, isBar=true) {
    const current = foundry.utils.getProperty(this.system, attribute);

    let updates;
    if ( isBar ) {
      if (isDelta) value = Math.clamped(current.min || 0, Number(current.value) + value, current.max);
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
    let totalWeight = 0;

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
                i = Actordsa5._prepareRangeTrait(i);
                break;
              case "meleeAttack":
                i = Actordsa5._prepareMeleetrait(i);
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
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            inventory.ammunition.items.push(Actordsa5.prepareMag(i));
            inventory.ammunition.show = true;
            totalWeight += Number(i.weight);
            break;
          case "meleeweapon":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            i.toggleValue = i.system.worn.value || false;
            i.toggle = true;
            this._setOnUseEffect(i);
            inventory.meleeweapons.items.push(Actordsa5._prepareitemStructure(i));
            inventory.meleeweapons.show = true;
            if (i.toggleValue) wornweapons.push(i);
            totalWeight += Number(i.weight);
            break;
          case "rangeweapon":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            i.toggleValue = i.system.worn.value || false;
            i.toggle = true;
            this._setOnUseEffect(i);
            inventory.rangeweapons.items.push(Actordsa5._prepareitemStructure(i));
            inventory.rangeweapons.show = true;
            totalWeight += Number(i.weight);
            break;
          case "armor":
            i.toggleValue = i.system.worn.value || false;
            inventory.armor.items.push(Actordsa5._prepareitemStructure(i));
            inventory.armor.show = true;
            i.toggle = true;
            this._setOnUseEffect(i);
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            totalWeight += parseFloat(
              (
                i.system.weight.value * (i.toggleValue ? Math.max(0, i.system.quantity.value - 1) : i.system.quantity.value)
              ).toFixed(3)
            );

            if (i.system.worn.value) {
              i.system.protection.value = EquipmentDamage.armorWearModifier(i, i.system.protection.value);
              totalArmor += Number(i.system.protection.value);
              armor.push(i);
            }
            break;
          case "plant":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            inventory["plant"].items.push(i);
            inventory["plant"].show = true;
            totalWeight += Number(i.weight);
            break;
          case "poison":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            inventory["poison"].items.push(i);
            inventory["poison"].show = true;
            totalWeight += Number(i.weight);
            break;
          case "consumable":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            inventory[i.system.equipmentType.value].items.push(Actordsa5._prepareConsumable(i));
            inventory[i.system.equipmentType.value].show = true;
            totalWeight += Number(i.weight);
            break;
          case "equipment":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            i.toggle = getProperty(i, "system.worn.wearable") || false;

            if (i.toggle) i.toggleValue = i.system.worn.value || false;

            this._setOnUseEffect(i);
            inventory[i.system.equipmentType.value].items.push(Actordsa5._prepareitemStructure(i));
            inventory[i.system.equipmentType.value].show = true;
            totalWeight += Number(i.weight);
            break;
          case "money":
            i.weight = parseFloat((i.system.weight.value * i.system.quantity.value).toFixed(3));
            money.coins.push(i);
            totalWeight += Number(i.weight);
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
      totalWeight += this._setBagContent(elem, containers);
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

    for (let [key, value] of Object.entries(skills)) {
      for (let skill of value) {
        skill.applications = applications.get(skill.name) || [];
      }
    }

    money.coins = money.coins.sort((a, b) => (a.system.price.value > b.system.price.value ? -1 : 1));
    const carrycapacity = actorData.system.characteristics.kk.value * 2 + actorData.system.carryModifier;
    //TODO move the encumbrance calculation to a better location
    let encumbrance = this.getArmorEncumbrance(this, armor);

    if ((this.type != "creature" || this.canAdvance) && !this.isMerchant()) {
      encumbrance += Math.max(0, Math.ceil((totalWeight - carrycapacity - 4) / 4));
    }
    this.addCondition("encumbered", encumbrance, true);

    totalWeight = parseFloat(totalWeight.toFixed(3));

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

    return {
      totalWeight,
      traditionArtifacts,
      armorSum: totalArmor,
      spellArmor: actorData.system.spellArmor || 0,
      liturgyArmor: actorData.system.liturgyArmor || 0,
      money,
      encumbrance,
      carrycapacity,
      wornRangedWeapons: rangeweapons,
      wornMeleeWeapons: meleeweapons,
      horseActor: horse,
      advantages,
      disadvantages,
      specAbs,
      information,
      aggregatedtests,
      wornArmor: armor,
      inventory,
      hasTrait,
      demonmarks,
      diseases,
      itemModifiers: this.system.itemModifiers,
      languagePoints: {
        used: actorData.system.freeLanguagePoints?.used || 0,
        available: actorData.system.freeLanguagePoints?.value || 0,
      },
      schips,
      groupschips,
      guidevalues,
      magic,
      traits,
      combatskills,
      canAdvance: this.canAdvance,
      sheetLocked: actorData.system.sheetLocked.value,
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

  getArmorEncumbrance(actorData, wornArmors) {
    const encumbrance = wornArmors.reduce((sum, a) => {
      a.calculatedEncumbrance = Number(a.system.encumbrance.value) + EquipmentDamage.armorEncumbranceModifier(a);
      a.damageToolTip = EquipmentDamage.damageTooltip(a);
      return (sum += a.calculatedEncumbrance);
    }, 0);
    const ridingModifier = Riding.isRiding(this) ? -1 : 0
    return Math.max(
      0,
      encumbrance - SpecialabilityRulesDSA5.abilityStep(actorData, game.i18n.localize("LocalizedIDs.inuredToEncumbrance")) + ridingModifier
    );
  }

  _setBagContent(elem, containers, topLevel = true) {
    let totalWeight = 0;
    if (containers.has(elem._id)) {
      elem.children = [];
      let bagweight = 0;
      if (!elem.toggleValue && topLevel) totalWeight -= elem.weight;

      for (let child of containers.get(elem._id)) {
        child.weight = Number(parseFloat((child.system.weight.value * child.system.quantity.value).toFixed(3)));
        bagweight += child.weight;
        elem.children.push(Actordsa5._prepareitemStructure(Actordsa5._prepareConsumable(child)));
        if (containers.has(child._id)) {
          bagweight += this._setBagContent(child, containers, false);
        }
      }
      if (elem.toggleValue || !topLevel) totalWeight += bagweight;
      elem.bagweight = `${bagweight.toFixed(3)}/${elem.system.capacity}`;
    }
    return totalWeight;
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

    for (let mod of effect.split(/,|;/).map((x) => x.trim())) {
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

  async _updateAPs(APValue, dataUpdate = {}) {
    if (Actordsa5.canAdvance(this)) {
      if (!isNaN(APValue) && !(APValue == null)) {
        const ap = Number(APValue);
        dataUpdate["system.details.experience.spent"] = Number(this.system.details.experience.spent) + ap;
        await this.update(dataUpdate);
        const msg = game.i18n.format(ap > 0 ? "advancementCost" : "refundCost", { cost: Math.abs(ap) });
        tinyNotification(msg);
      } else {
        ui.notifications.error(game.i18n.localize("DSAError.APUpdateError"));
      }
    }
  }

  async checkEnoughXP(cost) {
    if (!Actordsa5.canAdvance(this)) return true;
    if (isNaN(cost) || cost == null) return true;

    if (Number(this.system.details.experience.total) - Number(this.system.details.experience.spent) >= cost) {
      return true;
    } else if (Number(this.system.details.experience.total == 0)) {
      let selOptions = Object.entries(DSA5.startXP)
        .map(([key, val]) => `<option value="${key}">${game.i18n.localize(val)} (${key})</option>`)
        .join("");
      let template = `<p>${game.i18n.localize("DSAError.zeroXP")}</p><label>${game.i18n.localize(
        "APValue"
      )}: </label><select name ="APsel">${selOptions}</select>`;
      let newXp = 0;
      let result = false;

      [result, newXp] = await new Promise((resolve, reject) => {
        new Dialog({
          title: game.i18n.localize("DSAError.NotEnoughXP"),
          content: template,
          default: "yes",
          buttons: {
            Yes: {
              icon: '<i class="fa fa-check"></i>',
              label: game.i18n.localize("yes"),
              callback: (dlg) => {
                resolve([true, dlg.find('[name="APsel"]')[0].value]);
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
    ui.notifications.error(game.i18n.localize("DSAError.NotEnoughXP"));
    return false;
  }

  setupWeapon(item, mode, options, tokenId) {
    options["mode"] = mode;
    return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
  }

  setupWeaponless(statusId, options = {}, tokenId) {
    let item = foundry.utils.duplicate(DSA5.defaultWeapon);
    item.name = game.i18n.localize(`${statusId}Weaponless`);
    item.system.combatskill = {
      value: game.i18n.localize("LocalizedIDs.wrestle"),
    };
    item.system.damageThreshold.value = 14;

    const attributes = []

    if (SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize("LocalizedIDs.mightyAstralBody")))
      attributes.push(game.i18n.localize("magical"))
    if (SpecialabilityRulesDSA5.hasAbility(this, game.i18n.localize("LocalizedIDs.mightyKarmalBody")))
      attributes.push(game.i18n.localize("blessed"))
      
    mergeObject(item, { system: { effect: { attributes: attributes.join(", ") } }});

    options["mode"] = statusId;
    return Itemdsa5.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
  }

  setupSpell(spell, options = {}, tokenId) {
    return Itemdsa5.getSubClass(spell.type).setupDialog(null, options, spell, this, tokenId);
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

  async _preUpdate(data, options, user) {
    await super._preUpdate(data, options, user);

    const statusText = {
      wounds: 0x8b0000,
      astralenergy: 0x0b0bd9,
      karmaenergy: 0x04a236,
    };
    const scolls = [];
    for (let key of Object.keys(statusText)) {
      const value = getProperty(data, `system.status.${key}.value`);
      if (value)
        scolls.push({
          value: value - this.system.status[key].value,
          stroke: statusText[key],
        });
    }
    if (scolls.length) this.tokenScrollingText(scolls);
  }

  async applyDamage(amount) {
    const newVal = Math.min(this.system.status.wounds.max, this.system.status.wounds.value - amount);
    await this.update({ "system.status.wounds.value": newVal });
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

  async applyMana(amount, type) {
    let state = type == "AsP" ? "astralenergy" : "karmaenergy";

    const newVal = Math.min(this.system.status[state].max, this.system.status[state].value - amount);
    if (newVal >= 0) {
      await this.update({[`data.status.${state}.value`]: newVal});
      return true
    } else {
      ui.notifications.error(game.i18n.localize(`DSAError.NotEnough${type}`));
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
      user: message.user,
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
      await new Roll(oldDamageRoll.formula || oldDamageRoll._formula).evaluate({ async: true }),
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
                await new Roll(newRoll.join("+")).evaluate({ async: true }),
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
                await new Roll(newRoll.join("+")).evaluate({ async: true }),
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
        speaker: Itemdsa5.buildSpeaker(this.actor, tokenId),
      },
    };

    let situationalModifiers = []
    let dialogOptions = {
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
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
        testData.fallingHeight = html.find('[name="testModifier"]').val();
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };
    
    let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/fallingdamage-card.html", title, tokenId);

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
        speaker: Itemdsa5.buildSpeaker(this.actor, tokenId),
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
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
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
    //todo clean this up
    const statusId = "dodge";
    let char = this.system.status[statusId];
    let title = game.i18n.localize(statusId) + " " + game.i18n.localize("Test");

    let testData = {
      source: {
        system: char,
        type: statusId,
      },
      opposable: false,
      extra: {
        statusId,
        actor: this.toObject(false),
        options,
        speaker: Itemdsa5.buildSpeaker(this.actor, tokenId),
      },
    };

    let toSearch = [game.i18n.localize(statusId), game.i18n.localize('LocalizedIDs.wrestle')];
    let combatskills = Itemdsa5.buildCombatSpecAbs(this, ["Combat"], toSearch, "parry");
    let situationalModifiers = DSA5StatusEffects.getRollModifiers(testData.extra.actor, testData.source);
    const isRangeAttack = Itemdsa5.getDefenseMalus(situationalModifiers, this);
    const multipleDefenseValue = RuleChaos.multipleDefenseValue(this, testData.source);

    let dialogOptions = {
      title,
      template: "/systems/dsa5/templates/dialog/combatskill-enhanced-dialog.html",
      data: {
        rollMode: options.rollMode,
        combatSpecAbs: combatskills,
        showDefense: true,
        situationalModifiers,
        isRangeAttack,
        defenseCountString: game.i18n.format("defenseCount", {
          malus: multipleDefenseValue,
        }),
        isDodge: true
      },
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        testData.situationalModifiers.push(...Itemdsa5.getSpecAbModifiers(html, "parry"));
        testData.situationalModifiers.push(
          {
            name: game.i18n.localize("attackFromBehind"),
            value: html.find('[name="attackFromBehind"]').is(":checked") ? -4 : 0,
          },
          {
            name: game.i18n.format("defenseCount", {
              malus: multipleDefenseValue,
            }),
            value: (Number(html.find('[name="defenseCount"]').val()) || 0) * multipleDefenseValue,
          },
          {
            name: game.i18n.localize("advantageousPosition"),
            value: html.find('[name="advantageousPosition"]').is(":checked") ? 2 : 0,
          },
        );
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/status-card.html", title, tokenId);

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
        speaker: Itemdsa5.buildSpeaker(this.actor, tokenId),
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
        cardOptions.rollMode = html.find('[name="rollMode"]').val();
        testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    let cardOptions = this._setupCardOptions("systems/dsa5/templates/chat/roll/characteristic-card.html", title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }

  static _parseModifiers(html, search) {
    let res = [];
    html.find('[name="situationalModifiers"] option:selected').each(function () {
      const val = $(this).val();
      let data = {
        name: $(this).text().trim().split("[")[0],
        value: isNaN(val) ? val : Number(val),
        type: $(this).attr("data-type"),
      };
      if (data.type == "dmg") {
        data.damageBonus = data.value;
        data.value = 0;
      }
      if ($(this).attr("data-specAbId")) data.specAbId = $(this).attr("data-specAbId");
      if ($(this).attr("data-armorPen")) data.armorPen = $(this).attr("data-armorPen");

      res.push(data);
    });
    res.push({
      name: game.i18n.localize("manual"),
      value: Number(html.find('[name="testModifier"]').val()),
      type: "",
    });
    return res;
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

  static _prepareMeleetrait(item) {
    item.attack = Number(item.system.at.value);
    if (item.system.pa != 0) item.parry = item.system.pa;

    return this._parseDmg(item);
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

      item.parry =
        baseParry +
        Number(item.system.pamod.value) +
        (item.system.combatskill.value == game.i18n.localize("LocalizedIDs.Shields") ? Number(item.system.pamod.value) : 0);

      item.yieldedTwoHand = RuleChaos.isYieldedTwohanded(item)
      if (!item.yieldedTwoHand) {
        if (!wornWeapons)
          wornWeapons = duplicate(actorData.items).filter(
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
                item.dmgMultipliers = [{ name: oneHanded, val: "0.5" }]
              }
              break
            default:
              item.parry -= 1
              gripDamageMod = -1
          }
        }
      }

      item = this._parseDmg(item);
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
      item.damageToolTip = EquipmentDamage.damageTooltip(item);
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
    const isAllowedToSeeEffects =
      game.user.isGM || this.testUserPermission(game.user, "OBSERVER") || !(await game.settings.get("dsa5", "hideEffects"));

    return isAllowedToSeeEffects
      ? this.effects.filter((x) => {
        return (
          !x.disabled &&
          !x.notApplicable &&
          (game.user.isGM || !x.getFlag("dsa5", "hidePlayers")) &&
          !x.getFlag("dsa5", "hideOnToken") &&
          (x.origin == this.uuid || !x.origin)
        );
      })
      : this.effects.filter((x) => allowedEffects.some(y => x.statuses.has(y)));
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

  static _prepareRangeTrait(item) {
    item.attack = Number(item.system.at.value);
    item.LZ = Number(item.system.reloadTime.value);
    if (item.LZ > 0) Actordsa5.buildReloadProgress(item);

    return this._parseDmg(item);
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

  static _parseDmg(item, modification = undefined) {
    let parseDamage = new Roll(item.system.damage.value.replace(/[Ww]/g, "d"), { async: false });

    let damageDie = "",
      damageTerm = "",
      lastOperator = "+";
    for (let k of parseDamage.terms) {
      if (k.faces) damageDie = k.number + "d" + k.faces;
      else if (k.operator) lastOperator = k.operator;
      else if (k.number) damageTerm += Number(`${lastOperator}${k.number}`);
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
        item.ammo = ammunitions.filter((x) => x.system.ammunitiongroup.value == item.system.ammunitiongroup.value);

        currentAmmo = ammunitions.find((x) => x._id == item.system.currentAmmo.value);
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
      item.damageToolTip = EquipmentDamage.damageTooltip(item);
    } else {
      ui.notifications.error(
        game.i18n.format("DSAError.unknownCombatSkill", {
          skill: item.system.combatskill.value,
          item: item.name,
        })
      );
    }

    return this._parseDmg(item, currentAmmo);
  }

  _setupCardOptions(template, title, tokenId) {
    const token = game.canvas.tokens.get(tokenId)
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
    ui.notifications.error(game.i18n.localize("DSAError.NoAmmo"));
    return undefined;
  }

  async payMiracles(testData) {
    if (!testData.extra.miraclePaid) {
      testData.extra.miraclePaid = true;
      const hasMiracleMight = testData.situationalModifiers.some(
        (x) => x.name.trim() == game.i18n.localize("LocalizedIDs.miracleMight")
      );
      const hasMiracle = testData.situationalModifiers.some((x) => x.name.trim() == game.i18n.localize("LocalizedIDs.miracle"));
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

  async addCondition(effect, value = 1, absolute = false, auto = true) {
    if (effect == "bleeding" || effect.id == "bleeding") return await RuleChaos.bleedingMessage(this);

    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  async addTimedCondition(effect, value = 1, absolute = false, auto = true, options = {}){
    if (effect == "bleeding" || effect.id == "bleeding") return await RuleChaos.bleedingMessage(this);

    if (typeof(effect) === "string" && options.duration) {
      effect = duplicate(CONFIG.statusEffects.find(e => e.id == effect))
      effect.flags.dsa5.description = game.i18n.localize(effect.label)
      effect.label = game.i18n.localize(effect.label)

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