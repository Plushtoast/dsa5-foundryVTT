import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import DSA5Dialog from '../dialog/dialog-dsa5.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import Itemdsa5 from '../item/item-dsa5.js';
import TraitRulesDSA5 from '../system/rules/trait-rules-dsa5.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import { tinyNotification } from '../system/helpers/view_helper.js';
import EquipmentDamage from '../system/automation/equipment-damage.js';
import DSAActiveEffectConfig from '../status/active_effects.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import CreatureType from '../system/automation/creature-type.js';
import Riding from '../system/automation/riding.js';
import APTracker from '../system/orwell/ap-tracker.js';
import DSATriggers from '../system/automation/triggers.js';
import DSA5CombatDialog from '../dialog/dialog-combat-dsa5.js';
import DSAActiveEffect from '../status/dsa_active_effects.js';
import { ItemDataModel } from '../data/baseitem.js';
import RangeweaponData from '../data/item/rangeweapon.js';
import { CombatSystem } from '../item/concerns/combat-system.js';
import { ItemFactory } from '../item/item-factory.js';
import { ActorDialogBuilder } from './actor-dialog-builder.js';
import { CombatSpecialAbilities } from '../item/concerns/combat-special-abilities.js';
import { RollDialogBuilder } from '../dialog/dialog-builder.js';
import { ModifierCalculator } from '../item/concerns/modifier-calculator.js';
const { getProperty, mergeObject, duplicate, hasProperty, setProperty, expandObject } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class Actordsa5 extends Actor {
  static DEFAULT_ICON = 'icons/svg/mystery-man-black.svg';
  static selfRegex = /^self\./;
  static skipAlternateWeaponKeys = new Set([['flags', 'system.description']]);

  static async create(data, options) {
    if (Array.isArray(data) || data.items) return await super.create(data, options);

    data.items = [].concat(...(await Promise.all([DSA5_Utility.allSkills(), DSA5_Utility.allCombatSkills(), DSA5_Utility.allMoneyItems()])));

    if (data.type != 'character') mergeObject(data, { system: { status: { fatePoints: { current: 0, value: 0 } } } });

    if (data.type != 'creature' && [undefined, 0].includes(getProperty(data, 'system.status.wounds.value'))) mergeObject(data, { system: { status: { wounds: { value: 16 } } } });

    return await super.create(data, options);
  }

  static async deferredEffectAddition(effect, actor, target) {
    const current = actor.effects.find((x) => x.statuses.has(effect))?.flags.dsa5.auto || 0;
    const isChange = current != target;
    const attr = `changing${effect}`;
    actor[attr] = isChange;

    if (isChange) await actor.addCondition(effect, target, true, true).then(() => (actor[attr] = undefined));
  }

  static async postUpdateConditions(actor) {
    if (!DSA5_Utility.isActiveGM()) return;

    const data = actor.system;
    const isMerchant = actor.isMerchant();

    if (!TraitRulesDSA5.hasTrait(actor, 'LocalizedIDs.painImmunity')) {
      const pain = actor.woundPain(data);
      await this.deferredEffectAddition('inpain', actor, pain);
    }

    let newEncumbrance = data.armorEncumbrance;
    if ((actor.type != 'creature' || actor.canAdvance) && !isMerchant) {
      newEncumbrance += Math.max(0, Math.ceil((data.totalWeight - data.carrycapacity - 4) / 4));
    }

    await this.deferredEffectAddition('encumbered', actor, newEncumbrance);

    const brawlingPoints = actor.woundPain(data, 'temporaryLeP');
    await this.deferredEffectAddition('stunned', actor, brawlingPoints);

    if (AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.blind')) await actor.addCondition('blind');
    if (AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.mute')) await actor.addCondition('mute');
    if (AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.deaf')) await actor.addCondition('deaf');

    if (isMerchant) await actor.prepareMerchant();
  }

  static async _onCreateOperation(documents, operation, user) {
    for (let doc of documents) {
      await Actordsa5.postUpdateConditions(doc);
    }
    return super._onCreateOperation(documents, operation, user);
  }

  static async _onUpdateOperation(documents, operation, user) {
    for (let doc of documents) {
      await Actordsa5.postUpdateConditions(doc);
    }
    return super._onUpdateOperation(documents, operation, user);
  }

  woundPain(data, attr = 'wounds') {
    const attrData = data.status[attr];

    if (!attrData.max) return 0;

    const hasDefaultPain = this.type != 'creature' || attrData.max >= 20;

    if (hasDefaultPain) {
      if (attrData.value <= 5) return 4;
      return Math.floor((1 - attrData.value / attrData.max) * 4);
    }

    return Math.clamp(Math.floor(5 - (5 * attrData.value) / attrData.max), 0, 4);
  }

  get creatureType() {
    return CreatureType.creatureTypeName(this);
  }

  async prepareMerchant() {
    if (this.system.merchant.merchantType == 'loot') {
      if (this.system.merchant.locked && !this.hasCondition('locked')) {
        await this.addCondition(Actordsa5.lockedCondition());
      } else if (!this.system.merchant.locked) {
        const ef = this.effects.find((x) => x.statuses.has('locked'));
        if (ef) await this.deleteEmbeddedDocuments('ActiveEffect', [ef.id]);
      }
    }
  }

  static lockedCondition() {
    return {
      id: 'locked',
      name: game.i18n.localize('MERCHANT.locked'),
      img: 'icons/svg/padlock.svg',
      flags: {
        dsa5: {
          noEffect: true,
          hidePlayers: true,
          description: game.i18n.localize('MERCHANT.locked'),
        },
      },
    };
  }

  speedByMovementType(movementType) {
    switch (movementType) {
      case 'fly':
        return this.system.status.speed.airMax;
      case 'swim':
        return this.system.status.speed.waterMax;
    }
    return this.system.status.speed.max;
  }

  applyActiveEffects() {
    const overrides = {};
    this.statuses ??= new Set();
    this.auras = [];

    const specialStatuses = new Map();
    for (const statusId of Object.values(CONFIG.specialStatusEffects)) {
      specialStatuses.set(statusId, this.statuses.has(statusId));
    }
    this.statuses.clear();

    this.dsatriggers = {
      [DSATriggers.EVENTS.POST_ROLL]: {},
      [DSATriggers.EVENTS.POST_OPPOSED]: {}
    };

    const appliedArtifacts = this.items
      .filter(x =>
        ['rangeweapon', 'meleeweapon', 'equipment', 'armor'].includes(x.type) &&
        x.system.isArtifact &&
        (x.system.worn.value || (x.type == 'equipment' && !x.system.worn.wearable))
      )
      .map(x => x.system.artifact);

    const disableWeaponAdvantages = !game.settings.get('dsa5', 'enableWeaponAdvantages');
    const changes = this.collectActorEffectChanges();
    this.collectItemEffectChanges(changes, appliedArtifacts, disableWeaponAdvantages);
    changes.sort((a, b) => a.priority - b.priority);
    for (let change of changes) {
      if (!change.key || Actordsa5.selfRegex.test(change.key)) continue;
      const result = change.effect.apply(this, change);
      Object.assign(overrides, result);
    }

    this.overrides = expandObject(overrides);

    let tokens;
    for (const [statusId, wasActive] of specialStatuses) {
      const isActive = this.statuses.has(statusId);
      if (isActive === wasActive) continue;
      tokens ??= this.getActiveTokens();
      for (const token of tokens) {
        token._onApplyStatusEffect(statusId, isActive);
      }
    }
  }

  collectActorEffectChanges() {
    const changes = [];

    for (const e of this.effects) {
      if (e.disabled || e.system.delayed) continue;

      if (getProperty(e, 'flags.dsa5.isAura')) {
        this.auras.push(e.uuid);
        continue;
      }

      const multiply = Number(e.getFlag('dsa5', 'value')) || 1;

      for (let i = 0; i < multiply; i++) {
        changes.push(
          ...e.changes.map(c => {
            c = foundry.utils.duplicate(c);
            c.effect = e;
            c.priority = c.priority || c.mode * 10;
            return c;
          })
        );
      }

      for (const statusId of e.statuses) {
        this.statuses.add(statusId);
      }
    }

    return changes;
  }

  collectItemEffectChanges(changes, appliedArtifacts, disableWeaponAdvantages) {
    for (let item of this.items) {
      for (const e of item.effects) {
        if (e.disabled || !e.transfer || e.system.delayed) continue;

        let apply = true;
        let multiply = 1;

        apply = this.shouldApplyItemEffect(item, e, disableWeaponAdvantages, appliedArtifacts);
        multiply = this.getEffectMultiplier(item);

        const advancedFunction = getProperty(e, 'flags.dsa5.advancedFunction');
        if (Object.prototype.hasOwnProperty.call(this.dsatriggers, advancedFunction)) {
          this.dsatriggers[advancedFunction][item.id] = e.id;
        }

        e.notApplicable = !apply;

        if (apply && getProperty(e, 'flags.dsa5.isAura')) {
          this.auras.push(e.uuid);
          continue;
        }

        if (!apply) continue;

        for (let i = 0; i < multiply; i++) {
          changes.push(
            ...e.changes.map(c => {
              c = foundry.utils.duplicate(c);
              c.effect = e;
              c.priority = c.priority || c.mode * 10;
              return c;
            })
          );
        }

        for (const statusId of e.statuses) {
          this.statuses.add(statusId);
        }
      }
    }
  }

  shouldApplyItemEffect(item, effect, disableWeaponAdvantages, appliedArtifacts) {
    switch (item.type) {
      case 'meleeweapon':
      case 'rangeweapon':
        if (disableWeaponAdvantages && effect.system.equipmentAdvantage) return false;
        return item.system.worn.value && effect.getFlag('dsa5', 'applyToOwner');

      case 'armor':
        if (disableWeaponAdvantages && effect.system.equipmentAdvantage) return false;
        return item.system.worn.value;

      case 'equipment':
        return !item.system.worn.wearable || (item.system.worn.wearable && item.system.worn.value);

      case 'trait':
        return !['meleeAttack', 'rangeAttack'].includes(item.system.traitType.value) || effect.getFlag('dsa5', 'applyToOwner');

      case 'ammunition':
      case 'plant':
      case 'consumable':
      case 'combatskill':
      case 'magicalsign':
      case 'poison':
      case 'spell':
      case 'liturgy':
      case 'ceremony':
      case 'ritual':
      case 'skill':
      case 'spellextension':
        return false;

      case 'specialability':
        switch (item.system.category.value) {
          case 'Combat':
            return [2, 3].includes(Number(item.system.category.sub));
          case 'staff':
            return item.system.permanentEffects || appliedArtifacts.includes(item.system.artifact);
          default:
            return true;
        }

      default:
        return true;
    }
  }

  getEffectMultiplier(item) {
    switch (item.type) {
      case 'trait':
      case 'specialability':
      case 'advantage':
      case 'disadvantage':
        return Number(item.system.step?.value) || 1;
      default:
        return 1;
    }
  }

  getCombatEffectSkillModifier(name, mode) {
    const result = [];
    const keys = ['step', mode];

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
              selected: true,
            };
          }),
      );
    }
    return result;
  }

  prepareSheet(sheetInfo) {
    const preparedData = { system: { characteristics: {} } };
    mergeObject(preparedData, this.prepareItems(sheetInfo));
    return preparedData;
  }

  static canAdvance(actorData) {
    return actorData.canAdvance;
  }

  static armorOpposedTransformation(actor, wornArmor, options) {
    if (!options.origin) return wornArmor;

    const combatskill = getProperty(options.origin, 'system.combatskill.value');
    const armorZones = ['head', 'rightleg', 'leftleg', 'rightarm', 'leftarm', 'value'];

    return wornArmor.map(armor => {
      const armorCopy = mergeObject(duplicate(options), {
        armor: armor.system.itemWithOverrides(),
      });

      if (!combatskill) return DSAActiveEffectConfig.applyRollTransformation(
        actor, armorCopy, DSATriggers.EVENTS.ARMOR_TRANSFORMATION
      ).options.armor;

      const combatSkillWithSpace = combatskill + ' ';

      for (const effect of armorCopy.armor.effects) {
        if (!DSAActiveEffect.realyRealyEnabled(effect)) continue;

        for (const change of effect.changes) {
          if (change.key !== 'self.armorVulnerability') continue;

          const adaptions = change.value.split(/[,;]/);
          let appliedAdaption = null;

          if (options.defenderTest?.attackFromBehind) {
            appliedAdaption = adaptions.find(x => x.trim().startsWith('attackFromBehind '));
          }

          if (!appliedAdaption) {
            appliedAdaption = adaptions.find(x => x.trim().startsWith(combatSkillWithSpace));
          }

          if (appliedAdaption) {
            const modifierValue = Number(appliedAdaption.match(/[-+]?\d+/)?.[0] || 0);

            for (const zone of armorZones) {
              if (armorCopy.armor.system.protection[zone]) {
                armorCopy.armor.system.protection[zone] = Math.max(0,
                  armorCopy.armor.system.protection[zone] + modifierValue);
              }
            }
          } else {
            const randomArmorAdaption = adaptions.find(x => x.trim().startsWith('randomArmor '));

            if (randomArmorAdaption) {
              const randomArmorValues = randomArmorAdaption.split(' ')[1].split('|');
              const selectedRandomValue = randomArmorValues[
                Math.floor(Math.random() * randomArmorValues.length)
              ];

              for (const zone of armorZones) {
                if (armorCopy.armor.system.protection[zone]) {
                  armorCopy.armor.system.protection[zone] = selectedRandomValue;
                }
              }
            }
          }
        }
      }

      return DSAActiveEffectConfig.applyRollTransformation(
        actor, armorCopy, DSATriggers.EVENTS.ARMOR_TRANSFORMATION
      ).options.armor;
    });
  }

  static armorValue(actor, options = {}) {
    const wornArmorItems = [];
    let animalArmorTraitsValue = 0;

    for (const item of actor.items) {
      if (item.type === 'armor' && item.system.worn.value) {
        wornArmorItems.push(item);
      } else if (item.type === 'trait' && item.system.traitType.value === 'armor') {
        animalArmorTraitsValue += Number(item.system.at.value || 0);
      }
    }

    const transformedArmorItems = this.armorOpposedTransformation(actor, wornArmorItems, options);
    const armorProtection = transformedArmorItems.reduce(
      (sum, armorItem) => sum + EquipmentDamage.armorWearModifier(armorItem, armorItem.system.protection.value),
      0
    );

    return {
      wornArmor: transformedArmorItems,
      armor: armorProtection + animalArmorTraitsValue + (actor.system.totalArmor || 0)
    };
  }

  drawAuras(force = false) {
    for (const token of this.getActiveTokens()) {
      token.drawAuras(force);
    }
  }

  _onCreateDescendantDocuments(...args) {
    super._onCreateDescendantDocuments(...args);
    this.drawAuras();
  }

  _onUpdateDescendantDocuments(...args) {
    super._onUpdateDescendantDocuments(...args);
    const force =
      args[1] == 'effects' &&
      args[3].some((x) => {
        return ['flags.dsa5.auraRadius', 'flags.dsa5.borderColor', 'flags.dsa5.disposition', 'flags.dsa5.fillColor', 'flags.dsa5.borderThickness'].some((y) => hasProperty(x, y));
      });
    this.drawAuras(force);
  }

  _onDeleteDescendantDocuments(...args) {
    super._onCreateDescendantDocuments(...args);
    this.drawAuras();
  }

  async modifyTokenAttribute(attribute, value, isDelta = false, isBar = true) {
    const current = foundry.utils.getProperty(this.system, attribute);

    const updates = {};

    if (isBar) {
      if (isDelta) {
        const min = current.min ?? 0;
        const max = current.max ?? Number.MAX_SAFE_INTEGER;
        value = Math.clamp(min, Number(current.value) + value, max);
      }
      updates[`system.${attribute}.value`] = value;
    } else {
      updates[`system.${attribute}`] = isDelta ? Number(current) + value : value;
    }

    const allowed = Hooks.call('modifyTokenAttribute', { attribute, value, isDelta, isBar }, updates);
    return allowed !== false ? this.update(updates) : this;
  }

  schipshtml() {
    const schips = [];
    for (let i = 1; i <= this.system.status.fatePoints.max; i++) {
      schips.push({
        value: i,
        cssClass: i <= this.system.status.fatePoints.value ? 'fullSchip' : 'emptySchip',
      });
    }
    return schips;
  }

  prepareItems(sheetInfo) {
    const combatskills = [];
    const advantages = [];
    const disadvantages = [];
    const aggregatedtests = [];
    const diseases = [];
    const demonmarks = [];
    const wornweapons = [];
    const information = [];
    const essence = [];
    const imprint = [];
    const armor = [];
    const rangeweapons = [];
    const meleeweapons = [];
    const traditionArtifacts = [];
    const availableAmmunition = [];

    const specAbs = Object.fromEntries(Object.keys(DSA5.specialAbilityCategories).map(x => [x, []]));
    const traits = Object.fromEntries(Object.keys(DSA5.traitCategories).map(x => [x, []]));

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

    const groupschips = this.hasPlayerOwner ? RuleChaos.getGroupSchips() : [];
    const schips = this.schipshtml();

    const inventory = {
      meleeweapons: { items: [], show: false, dataType: 'meleeweapon' },
      rangeweapons: { items: [], show: false, dataType: 'rangeweapon' },
      armor: { items: [], show: false, dataType: 'armor' },
      ammunition: { items: [], show: false, dataType: 'ammunition' },
      plant: { items: [], show: false, dataType: 'plant' },
      poison: { items: [], show: false, dataType: 'poison' },
      book: { items: [], show: false, dataType: 'book' },
    };

    for (const t in DSA5.equipmentTypes) {
      inventory[t] = { items: [], show: false, dataType: t };
    }
    inventory['misc'].show = true;

    const money = {
      coins: [],
      total: 0,
      show: true,
    };

    let totalArmor = this.system.totalArmor || 0;

    const skills = {
      body: [],
      social: [],
      knowledge: [],
      trade: [],
      nature: [],
    };

    const containers = new Map();
    const applications = new Map();
    let hasTrait = false;
    const hasAnyItem = this.items.some(x => !['skill', 'combatskill', 'money'].includes(x.type));
    const horse = Riding.getHorse(this, true);

    this.items.filter(x => x.type === 'equipment' && x.system.equipmentType.value === 'bags')
      .forEach(container => containers.set(container.id, []));

    const preparedItems = this.items
      .map(x => x.system.prepareEmbeddedItemSheet())
      .sort((a, b) => a.name.localeCompare(b.name));

    for (const i of preparedItems) {
      try {
        const parent_id = i.system.parent_id;
        if (i.type === 'ammunition') availableAmmunition.push(i);

        if (parent_id && parent_id !== i._id) {
          if (containers.has(parent_id)) {
            containers.get(parent_id).push(i);
            continue;
          }
        }

        if (sheetInfo.details && sheetInfo.details.includes(i._id)) i.detailed = 'shown';

        if (i.system.isArtifact) {
          i.volume = DSA5.traditionArtifacts[i.system.artifact] || 0;
          i.volumeFinal = 0;
          traditionArtifacts.push(i);
        }

        switch (i.type) {
          case 'skill':
            skills[i.system.group.value].push(i);
            break;
          case 'information':
            information.push(i);
            break;
          case 'aggregatedTest':
            aggregatedtests.push(i);
            break;
          case 'spellextension':
            if (!extensions[i.system.category][i.system.source]) {
              extensions[i.system.category][i.system.source] = [];
            }
            extensions[i.system.category][i.system.source].push(i.name);
            break;
          case 'ritual':
          case 'spell':
          case 'liturgy':
          case 'ceremony':
          case 'magicalsign':
          case 'magictrick':
          case 'blessing':
            magic[i.type].push(i);
            break;
          case 'trait':
            traits[i.system.traitType.value].push(i);
            if (i.type === 'armor') totalArmor += Number(i.system.at.value);
            hasTrait = true;
            break;
          case 'combatskill':
            combatskills.push(i);
            break;
          case 'ammunition':
            inventory.ammunition.items.push(i);
            inventory.ammunition.show = true;
            break;
          case 'meleeweapon':
            inventory.meleeweapons.show = true;
            inventory.meleeweapons.items.push(i);
            if (i.toggleValue) wornweapons.push(i);
            break;
          case 'rangeweapon':
            inventory.rangeweapons.items.push(i);
            inventory.rangeweapons.show = true;
            break;
          case 'armor':
            inventory.armor.items.push(i);
            inventory.armor.show = true;

            if (i.system.worn.value) {
              for (const property in i.system.protection) {
                const value = i.system.protection[property];
                i.system.protection[property] = EquipmentDamage.armorWearModifier(i, value);
              }
              totalArmor += Number(i.system.protection.value);
              armor.push(i);
            }
            break;
          case 'book':
          case 'poison':
          case 'plant':
            inventory[i.type].items.push(i);
            inventory[i.type].show = true;
            break;
          case 'consumable':
          case 'equipment':
            inventory[i.system.equipmentType.value].items.push(i);
            inventory[i.system.equipmentType.value].show = true;
            break;
          case 'money':
            money.coins.push(i);
            money.total += i.system.quantity.value * i.system.price.value;
            break;
          case 'advantage':
            advantages.push(i);
            break;
          case 'disadvantage':
            disadvantages.push(i);
            break;
          case 'specialability':
            specAbs[i.system.category.value].push(i);
            break;
          case 'disease':
            diseases.push(i);
            break;
          case 'patron':
            specAbs.magical.push(i);
            break;
          case 'demonmark':
            demonmarks.push(i);
            break;
          case 'essence':
            essence.push(i);
            break;
          case 'imprint':
            imprint.push(i);
            break;
          case 'application':
            applications.set(i.system.skill, [...(applications.get(i.system.skill) || []), i]);
            break;
        }
      } catch (error) {
        this._itemPreparationError(i, error);
      }
    }

    for (const elem of inventory.bags.items) {
      this._setBagContent(elem, containers);
    }

    for (const [category, value] of Object.entries(extensions)) {
      for (const [spell, exts] of Object.entries(value)) {
        const findspell = magic[category].find(x => x.name === spell);
        if (findspell) {
          findspell.extensions = exts.join(', ');
        } else {
          ui.notifications.warn(
            game.i18n.format('DSAError.noSpellForExtension', {
              name: spell,
              category: DSA5_Utility.categoryLocalization(category),
              extension: exts.join(','),
            })
          );
        }
      }
    }

    for (const wep of inventory.rangeweapons.items) {
      try {
        if (wep.system.worn.value) {
          rangeweapons.push(Actordsa5._prepareRangeWeapon(wep, availableAmmunition, combatskills, this));
        }
      } catch (error) {
        this._itemPreparationError(wep, error);
      }
    }

    const otherWeapons = wornweapons.filter(x => !RuleChaos.isYieldedTwohanded(x));
    for (const wep of wornweapons) {
      try {
        const weaponsExcludingSelf = otherWeapons.filter(x => x._id !== wep._id);
        meleeweapons.push(Actordsa5._prepareMeleeWeapon(wep, combatskills, this, weaponsExcludingSelf));
      } catch (error) {
        this._itemPreparationError(wep, error);
      }
    }

    for (const category of Object.values(skills)) {
      for (const skill of category) {
        skill.applications = applications.get(skill.name) || [];
      }
    }

    money.coins = money.coins.sort((a, b) => b.system.price.value - a.system.price.value);

    specAbs.magical.push(...specAbs.pact);
    specAbs.clerical.push(...specAbs.ceremonial);

    for (const traditionAbility of specAbs.staff) {
      const artifact = traditionArtifacts.find(x => x.system.artifact === traditionAbility.system.artifact);
      if (artifact) {
        if (!artifact.abilities) artifact.abilities = [];

        artifact.abilities.push(traditionAbility);
        const vol = Number(traditionAbility.system.volume) || 0;
        const volAttr = vol > 0 ? 'volumeFinal' : 'volume';
        artifact[volAttr] += Math.abs(vol) * Number(traditionAbility.system.step.value);
      } else {
        specAbs.magical.push(traditionAbility);
      }
    }

    const wrestle = game.i18n.localize('LocalizedIDs.wrestle');
    const brawling = combatskills.find(x => x.name === wrestle);

    //todo check if these still need to be returned
    const totalWeight = parseFloat(this.system.totalWeight?.toFixed(3))
    const carrycapacity = this.system.carrycapacity;
    const encumbrance = this.system.condition?.encumbered || 0;
    let moneyWeight = this.system.moneyWeight || 0;
    moneyWeight = moneyWeight > 0 ? `<br>${game.i18n.localize('purse')}: ${parseFloat(moneyWeight.toFixed(2))}` : '';

    return {
      totalWeight,
      traditionArtifacts,
      armorSum: totalArmor,
      sortedSpecs: DSA5.sortedSpecs,
      spellArmor: this.system.spellArmor || 0,
      liturgyArmor: this.system.liturgyArmor || 0,
      money,
      brawling: {
        attack: brawling?.system.attack.value || 0,
        parry: brawling?.system.parry.value || 0,
      },
      encumbrance,
      carrycapacity,
      encumbranceTooltip: game.i18n.format('encumbranceTooltip', {
        totalWeight,
        carrycapacity,
        encumbrance,
        moneyWeight
      }),
      isSwarm: this.isSwarm(),
      canSwarm: !this.prototypeToken.actorLink,
      wornRangedWeapons: rangeweapons,
      wornMeleeWeapons: meleeweapons,
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
      canBuild: game.dsa5.sheets.DSACharBuilder && !this.system.details.species?.value,
      itemModifiers: this.system.itemModifiers,
      languagePoints: this.system.freeLanguagePoints?.value
        ? `<span data-tooltip="languagePoints">(${this.system.freeLanguagePoints?.used}/${this.system.freeLanguagePoints?.value})</span>`
        : '',
      schips,
      groupschips,
      magic,
      traits,
      combatskills,
      advanceAbility: this.canAdvance,
      canAdvance: this.canAdvance && !this.system.sheetLocked.value,
      sheetLocked: this.system.sheetLocked.value,
      bodyAttrs: ['ff', 'ge', 'ko', 'kk'],
      mentalAttrs: ['mu', 'kl', 'in', 'ch'],
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
    return this.system.swarm.count > 1 && !this.prototypeToken.actorLink;
  }

  _setBagContent(elem, containers) {
    if (containers.has(elem._id)) {
      elem.children = [];

      for (let child of containers.get(elem._id)) {
        elem.children.push(child);
        if (containers.has(child._id)) {
          this._setBagContent(child, containers);
        }
      }
    }
  }

  isMerchant() {
    return ['merchant', 'loot'].includes(getProperty(this, 'system.merchant.merchantType'));
  }

  _itemPreparationError(item, error) {
    console.warn(error);
    console.warn(item);
    console.trace();
    ui.notifications.error('Something went wrong with preparing item ' + item.name + ': ' + error);
  }

  async _updateAPs(APValue, dataUpdate = {}, options = {}) {
    if (Actordsa5.canAdvance(this)) {
      if (!isNaN(APValue) && !(APValue == null)) {
        const ap = Number(APValue);
        dataUpdate['system.details.experience.spent'] = Number(this.system.details.experience.spent) + ap;
        await this.update(dataUpdate, options);
        const msg = game.i18n.format(ap > 0 ? 'advancementCost' : 'refundCost', { cost: Math.abs(ap) });
        tinyNotification(msg);
      } else {
        ui.notifications.error('DSAError.APUpdateError', { localize: true });
      }
    }
  }

  static _prepareItemStructure(item) {
    return ItemDataModel._prepareItemStructure(item);
  }

  async checkEnoughXP(cost) {
    if (!Actordsa5.canAdvance(this)) return true;
    if (isNaN(cost) || cost == null) return true;

    if (Number(this.system.details.experience.total) - Number(this.system.details.experience.spent) >= cost) {
      return true;
    } else if (Number(this.system.details.experience.total) == 0) {
      const content = await renderTemplate('systems/dsa5/templates/dialog/parts/expChoices.hbs', { entries: DSA5.startXP });
      let newXp = 0;
      let result = false;

      try {
        [result, newXp] = await foundry.applications.api.DialogV2.wait({
          window: {
            title: 'DSAError.NotEnoughXP',
          },
          content,
          buttons: [
            {
              action: 'yes',
              icon: 'fa fa-check',
              label: 'yes',
              default: true,
              callback: (event, button, dialog) => {
                return [true, Number(button.form.elements.APsel.value)];
              },
            },
            {
              action: 'cancel',
              icon: 'fas fa-times',
              label: 'cancel',
              callback: () => {
                return [false, 0];
              },
            },
          ],
        });
      } catch (error) {
        /* empty */
      }

      if (result) {
        await this.update({ 'system.details.experience.total': newXp });
        return true;
      }
    }
    ui.notifications.error('DSAError.NotEnoughXP', { localize: true });
    return false;
  }

  setupWeapon(item, mode, options, tokenId) {
    options['mode'] = mode;
    return ItemFactory.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
  }

  throwMelee(item, tokenId) {
    const throwingWeapons = game.i18n.localize('LocalizedIDs.Throwing Weapons');
    const localizedCT = game.i18n.localize(`LocalizedCTs.${item.system.combatskill.value}`);

    const validWeaponTypes = new Set(['Daggers', 'Fencing Weapons', 'Impact Weapons', 'Swords', 'Polearms']);
    const hasWeaponThrow = validWeaponTypes.has(localizedCT) && SpecialabilityRulesDSA5.hasAbility(this, 'LocalizedIDs.weaponThrow');

    const name = `${item.name} (${throwingWeapons})`;
    const rangeWeapon = new Itemdsa5({
      name,
      type: 'rangeweapon',
      system: {
        combatskill: { value: throwingWeapons },
        reach: { value: DSA5.meleeAsRangeReach[localizedCT] },
        effect: { attributes: item.system.effect.attributes },
        damage: { value: item.system.damage.value },
        quantity: { value: 1 }
      }
    });

    const options = {
      situationalModifiers: [{
        name,
        value: hasWeaponThrow ? -4 : -8,
        selected: true
      }]
    };

    this.setupWeapon(rangeWeapon, 'attack', options, tokenId).then(async (setupData) => {
      if (!hasWeaponThrow) {
        setupData.testData.source.dmgMultipliers ||= [];
        DSA5_Utility.pushOnlyIfUnique(
          setupData.testData.source.dmgMultipliers,
          { name: 'LocalizedIDs.Throwing Weapons', val: '0.5' }
        );
      }
      await this.basicTest(setupData);
    });
  }

  setupWeaponless(statusId, options = {}, tokenId) {
    const attributes = [];
    if (SpecialabilityRulesDSA5.hasAbility(this, 'LocalizedIDs.mightyAstralBody')) attributes.push(game.i18n.localize('magical'));
    if (SpecialabilityRulesDSA5.hasAbility(this, 'LocalizedIDs.mightyKarmalBody')) attributes.push(game.i18n.localize('blessed'));

    const weaponData = mergeObject(
      {
        name: game.i18n.localize(`${statusId}Weaponless`),
        type: 'meleeweapon',
        system: {
          combatskill: {
            value: game.i18n.localize('LocalizedIDs.wrestle'),
          },
          effect: {
            attributes: attributes.join(', '),
          },
        },
      },
      this.system.defaultWeapon,
    );

    const item = new Item(weaponData);
    options.mode = statusId;
    return ItemFactory.getSubClass(item.type).setupDialog(null, options, item, this, tokenId);
  }

  setupSpell(spell, options = {}, tokenId) {
    return this.setupSkill(spell, options, tokenId);
  }

  setupSkill(skill, options = {}, tokenId) {
    return ItemFactory.getSubClass(skill.type).setupDialog(null, options, skill, this, tokenId);
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
          fontSize: game.settings.get('dsa5', 'scrollingFontsize'),
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
    const newValue = getProperty(data, key);
    return [null, undefined].includes(newValue) || newValue === getProperty(this, key) ? false : newValue;
  }

  async _preUpdate(data, options, user) {
    const statusText = {
      wounds: 0x8b0000,
      astralenergy: 0x0b0bd9,
      karmaenergy: 0x04a236,
    };

    if (game.combat?.isBrawling) statusText.temporaryLeP = 0xfc2a8f;

    const scrolls = [];
    for (let key of Object.keys(statusText)) {
      const value = this._containsChangedAttribute(data, `system.status.${key}.value`);
      if (value !== false)
        scrolls.push({
          value: value - this.system.status[key].value,
          stroke: statusText[key],
        });
    }

    if (scrolls.length) this.tokenScrollingText(scrolls);

    const swarmCount = this._containsChangedAttribute(data, 'system.swarm.count');
    if (swarmCount !== false && !options.skipSwarmUpdate) {
      const hp = getProperty(data, 'system.status.wounds.value') || this.system.status.wounds.value;
      const delta = swarmCount - (this.system.swarm.count || 1);
      const baseHp = this.system.swarm.maxwounds || this.system.status.wounds.max;
      setProperty(data, 'system.status.wounds.value', Math.max(0, hp + delta * baseHp));
    }

    const apSum = this._containsChangedAttribute(data, 'system.details.experience.total');
    if (apSum !== false) {
      const previous = this.system.details.experience.total;
      APTracker.track(this, { type: 'sum', previous, next: apSum }, apSum - previous);
    }

    return super._preUpdate(data, options, user);
  }

  async applyDamage(rollFormula, options = {}) {
    const roll = await new Roll(`${rollFormula}`).evaluate();
    const amount = roll.total;
    if (game.combat?.isBrawling) {
      const newVal = Math.min(this.system.status.temporaryLeP.max, this.system.status.temporaryLeP.value - amount);
      await this.update({ 'system.status.temporaryLeP.value': newVal });
    } else {
      const newVal = Math.min(this.system.status.wounds.max, this.system.status.wounds.value - amount);
      await this.update({ 'system.status.wounds.value': newVal });
    }

    if (options.msg) {
      const renderedRoll = await roll.render();
      ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${game.i18n.format(options.msg, { name: this.name })}</p>${renderedRoll}`));
    }
  }

  async applyRegeneration(LeP, AsP, KaP) {
    const LePRolled = await new Roll(`${LeP || 0}`).evaluate();
    const KaPRolled = await new Roll(`${KaP || 0}`).evaluate();
    const AsPRolled = await new Roll(`${AsP || 0}`).evaluate();
    const update = {
      'system.status.wounds.value': Math.min(this.system.status.wounds.max, this.system.status.wounds.value + LePRolled.total),
      'system.status.karmaenergy.value': Math.min(this.system.status.karmaenergy.max, this.system.status.karmaenergy.value + KaPRolled.total),
      'system.status.astralenergy.value': Math.min(this.system.status.astralenergy.max, this.system.status.astralenergy.value + AsPRolled.total),
    };
    await this.update(update);
  }

  async applyMana(rollFormula, type) {
    const state = type == 'AsP' ? 'astralenergy' : 'karmaenergy';
    const amount = (await new Roll(`${rollFormula}`).evaluate()).total;
    const newVal = Math.min(this.system.status[state].max, this.system.status[state].value - amount);
    if (newVal >= 0) {
      await this.update({ [`system.status.${state}.value`]: newVal });
      return true;
    } else {
      ui.notifications.error(`DSAError.NotEnough${type}`, { localize: true });
      return false;
    }
  }

  #preparePostRollAction(message) {
    const data = message.flags.data;
    const cardOptions = {
      flags: { img: { src: message.flags.img.src } },
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
    let newRoll = await DiceDSA5.manualRolls(await new Roll(oldDamageRoll.formula || oldDamageRoll._formula).evaluate(), 'CHATCONTEXT.rerollDamage');

    for (let i = 0; i < newRoll.dice.length; i++) newRoll.dice[i].options.colorset = 'black';

    await DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode);

    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    newTestData.damageRoll = duplicate(newRoll);

    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
    await message.update({ 'flags.data.fatePointDamageRerollUsed': true });
    await this.reduceSchips(schipsource);
  }

  async fateisTalented(infoMsg, cardOptions, newTestData, message, data) {
    cardOptions.talentedRerollUsed = true;

    this.resetTargetAndMessage(data, cardOptions);

    infoMsg = `<h3 class="center"><b>${game.i18n.localize('CHATFATE.fatepointUsed')}</b></h3>
            ${game.i18n.format('CHATFATE.isTalented', {
      character: '<b>' + this.name + '</b>',
    })}<br>`;
    const html = await renderTemplate('systems/dsa5/templates/dialog/isTalentedReroll-dialog.hbs', {
      testData: newTestData,
      postData: data.postData,
    });
    new DSA5Dialog({
      window: { title: 'CHATFATE.selectDice' },
      content: html,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'ok',
          callback: async (event, button, dialog) => {
            const dlg = $(button.form);
            let diesToReroll = dlg
              .find('.dieSelected')
              .map(function () {
                return Number(this.dataset.index);
              })
              .get();
            if (diesToReroll.length > 0) {
              let newRoll = [];
              for (let k of diesToReroll) {
                let term = newTestData.roll.terms[k * 2];
                newRoll.push(term.number + 'd' + term.faces + '[' + term.options.colorset + ']');
              }
              newRoll = await DiceDSA5.manualRolls(await new Roll(newRoll.join('+')).evaluate(), 'CHATCONTEXT.talentedReroll');
              await DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode);

              let ind = 0;
              const changedRolls = [];
              const changes = [];

              newTestData.roll = Roll.fromData(newTestData.roll);
              for (let k of diesToReroll) {
                const characteristic = newTestData.source.system[`characteristic${k + 1}`];
                const attr = characteristic ? game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`) + ' - ' : '';

                let val = newRoll.terms[ind * 2].results[0].result;
                changedRolls.push(`${attr}${newTestData.roll.terms[k * 2].results[0].result}/${val}`);
                val = Math.min(val, newTestData.roll.terms[k * 2].results[0].result);

                changes.push({ index: k, val });
                ind += 1;
              }
              newTestData.roll.editRollAtIndex(changes);
              infoMsg += `<b>${game.i18n.localize('Roll')}</b>: ${changedRolls.join(', ')}`;
              ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

              this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
              await message.update({ 'flags.data.talentedRerollUsed': true });
            }
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  //todo refactor this with istalented
  async fatereroll(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    cardOptions.fatePointDamageRerollUsed = true;
    this.resetTargetAndMessage(data, cardOptions);

    const html = await renderTemplate('systems/dsa5/templates/dialog/fateReroll-dialog.hbs', {
      testData: newTestData,
      postData: data.postData,
      singleDie: data.postData.characteristics.length == 1,
    });
    new DSA5Dialog({
      window: { title: 'CHATFATE.selectDice' },
      content: html,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'ok',
          callback: async (event, button, dialog) => {
            const dlg = $(button.form);
            let diesToReroll = dlg
              .find('.dieSelected')
              .map(function () {
                return Number(this.dataset.index);
              })
              .get();
            if (diesToReroll.length > 0) {
              let newRoll = [];
              for (let k of diesToReroll) {
                let term = newTestData.roll.terms[k * 2];
                newRoll.push(term.number + 'd' + term.faces + '[' + term.options.colorset + ']');
              }
              newRoll = await DiceDSA5.manualRolls(await new Roll(newRoll.join('+')).evaluate(), 'CHATCONTEXT.Reroll');
              await DiceDSA5.showDiceSoNice(newRoll, newTestData.rollMode);

              let ind = 0;
              let changedRolls = [];
              const actor = DSA5_Utility.getSpeaker(newTestData.extra.speaker);
              const phexTradition = game.i18n.localize('LocalizedIDs.traditionPhex');
              const isPhex = actor.items.some((x) => x.type == 'specialability' && x.name == phexTradition);

              newTestData.roll = Roll.fromData(newTestData.roll);
              const changes = [];
              for (let k of diesToReroll) {
                const characteristic = newTestData.source.system[`characteristic${k + 1}`];
                const attr = characteristic ? `${game.i18n.localize(`CHARAbbrev.${characteristic.value.toUpperCase()}`)} - ` : '';

                let val = newRoll.terms[ind * 2].results[0].result;
                changedRolls.push(`${attr}${newTestData.roll.terms[k * 2].results[0].result}/${val}`);

                if (isPhex) val = Math.min(val, newTestData.roll.terms[k * 2].results[0].result);
                changes.push({ index: k, val });
                ind += 1;
              }
              newTestData.roll.editRollAtIndex(changes);
              infoMsg += `<br><b>${game.i18n.localize('Roll')}</b>: ${changedRolls.join(', ')}`;
              ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
              newTestData.fateUsed = true;

              this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
              await message.update({
                'flags.data.fatePointRerollUsed': true,
              });
              await this.reduceSchips(schipsource);
            }
          },
        },
        {
          action: 'cancel',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  async fateaddQS(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    game.user.targets.forEach((t) =>
      t.setTarget(false, {
        user: game.user,
        releaseOthers: false,
        groupSelection: true,
      }),
    );

    cardOptions.fatePointAddQSUsed = true;
    newTestData.qualityStep = 1;

    this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
    await message.update({ 'flags.data.fatePointAddQSUsed': true });
    await this.reduceSchips(schipsource);
  }

  async fateImprove(infoMsg, cardOptions, newTestData, message, data, schipsource) {
    ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));

    this.resetTargetAndMessage(data, cardOptions);

    let rollType = message.flags.data.preData.source.type;
    if (['spell', 'liturgy', 'ceremony', 'ritual', 'skill'].includes(rollType)) {
      const html = await renderTemplate('systems/dsa5/templates/dialog/fateImprove-dialog.hbs', {
        testData: newTestData,
        postData: data.postData,
      });
      new DSA5Dialog({
        window: { title: 'CHATFATE.selectDice' },
        content: html,
        buttons: [
          {
            action: 'Yes',
            icon: 'fa fa-check',
            label: 'ok',
            callback: async (event, button, dialog) => {
              const dlg = $(button.form);
              let fws = [0, 0, 0];
              let diesToUpgrade = dlg
                .find('.dieSelected')
                .map(function () {
                  return Number(this.dataset.index);
                })
                .get();
              if (diesToUpgrade.length == 1) {
                fws[diesToUpgrade] = 2;
                const modifier = {
                  name: game.i18n.localize('CHATCONTEXT.improveFate'),
                  value: fws.join('|'),
                  type: 'roll',
                };
                newTestData.roll = Roll.fromData(newTestData.roll);
                newTestData.roll.editRollAtIndex([{ index: diesToUpgrade, val: Math.max(1, newTestData.roll.terms[diesToUpgrade * 2].results[0].result - 2) }]);
                newTestData.situationalModifiers.push(modifier);
                this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
                await message.update({ 'flags.data.fateImproved': true });
                await this.reduceSchips(schipsource);
              }
            },
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
          },
        ],
      }).render(true);
    } else {
      const modifier = {
        name: game.i18n.localize('CHATCONTEXT.improveFate'),
        value: 2,
        type: 'roll',
      };
      newTestData.situationalModifiers.push(modifier);
      newTestData.roll = Roll.fromData(newTestData.roll);
      newTestData.roll.editRollAtIndex([{ index: 0, val: Math.max(1, newTestData.roll.terms[0].results[0].result - 2) }]);
      this[`${data.postData.postFunction}`]({ testData: newTestData, cardOptions }, { rerenderMessage: message });
      await message.update({ 'flags.data.fateImproved': true });
      await this.reduceSchips(schipsource);
    }
  }

  async reduceSchips(schipsource) {
    if (schipsource == 0)
      await this.update({
        'system.status.fatePoints.value': this.system.status.fatePoints.value - 1,
      });
    else {
      await Actordsa5.reduceGroupSchip();
    }
  }

  static async reduceGroupSchip() {
    if (game.user.isGM) {
      const groupschips = game.settings
        .get('dsa5', 'groupschips')
        .split('/')
        .map((x) => Number(x));
      groupschips[0] = groupschips[0] - 1;
      await game.settings.set('dsa5', 'groupschips', groupschips.join('/'));
    } else {
      game.socket.emit('system.dsa5', {
        type: 'reduceGroupSchip',
        payload: {},
      });
    }
  }

  async useFateOnRoll(message, type, schipsource) {
    if (type == 'isTalented' || DSA5_Utility.fateAvailable(this, schipsource == 1)) {
      const data = message.flags.data;
      const cardOptions = this.#preparePostRollAction(message);
      let fateAvailable;
      let schipText;
      if (schipsource == 0) {
        fateAvailable = this.system.status.fatePoints.value - 1;
        schipText = 'PointsRemaining';
      } else {
        fateAvailable = game.settings.get('dsa5', 'groupschips').split('/')[0];
        schipText = 'GroupPointsRemaining';
      }
      let infoMsg = `<h3 class="center"><b>${game.i18n.localize('CHATFATE.fatepointUsed')}</b></h3>
                ${game.i18n.format('CHATFATE.' + type, { character: '<b>' + this.name + '</b>' })}<br>
                <b>${game.i18n.localize(`CHATFATE.${schipText}`)}</b>: ${fateAvailable}`;

      let newTestData = data.preData;

      this[`fate${type}`](infoMsg, cardOptions, newTestData, message, data, schipsource);
    }
  }

  get horseSpeed() {
    return Riding.getHorseSpeed(this);
  }

  async _buildEmbedHTML(config, options = {}) {
    const template = `systems/dsa5/templates/items/browse/${this.type}.hbs`;
    const item = await renderTemplate(template, {
      document: this,
      isGM: game.user.isGM,
      ...(await this.sheet._prepareContext()),
      ...options,
    });
    return $(item)[0];
  }

  setupFallingDamage(options, tokenId) {
    const name = game.i18n.localize('fallingDamage');
    const skill = this.items.find((x) => x.type == 'skill' && x.name == game.i18n.localize('LocalizedIDs.bodyControl')).toObject();
    const optns = {
      subtitle: ` (${name})`,
      postFunction: {
        functionName: 'game.dsa5.entities.Actordsa5.updateFallingDamage',
        options,
        tokenId,
        speaker: ActorDialogBuilder.buildSpeaker(this, tokenId),
      },
    };
    this.setupSkill(skill, optns, tokenId).then(async (finalData) => {
      finalData.testData.opposable = false;
      const res = await this.basicTest(finalData, { suppressMessage: true });
      await Actordsa5.updateFallingDamage(optns.postFunction, res);
      await DiceDSA5.renderRollCard(res.cardOptions, res.result, res.options.rerenderMessage);
    });
  }

  static async updateFallingDamage(postFunction, result, source) {
    const availableQs = (result.result.qualityStep || 0) * 2;
    mergeObject(postFunction.options, { availableQs });
    const actor = DSA5_Utility.getSpeaker(postFunction.speaker);
    const setupData = await actor._setupFallingHeight(postFunction.options, postFunction.tokenId);
    const fallingDamage = await actor.basicTest(setupData, {
      suppressMessage: true,
    });
    const html = await renderTemplate('systems/dsa5/templates/chat/roll/fallingdamage-card.hbs', fallingDamage);

    if (!result.result.other) result.result.other = [];

    result.result.other.push(html);

    if (result.chatData) {
      result.chatData.other = [html];
    }
  }

  _setupFallingHeight(options, tokenId) {
    let title = game.i18n.localize('fallingDamage');
    let testData = {
      source: {
        type: 'fallingDamage',
      },
      opposable: false,
      extra: {
        options,
        speaker: ActorDialogBuilder.buildSpeaker(this, tokenId),
      },
    };

    const situationalModifiers = [];
    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/fallingdamage-dialog.hbs',
      data: {
        rollMode: options.rollMode,
        situationalModifiers,
        fallingFloorOptions: DSA5.fallingConditions,
        modifier: options.modifier || 0,
      },
      callback: (html, options = {}) => {
        testData.situationalModifiers = [
          {
            name: game.i18n.localize('fallingFloor'),
            value: html.find('[name="fallingFloor"]').val(),
          },
        ];
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.fallingHeight = html.find('[name="testModifier"]').val();
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = ActorDialogBuilder._setupCardOptions('systems/dsa5/templates/chat/roll/fallingdamage-card.hbs', title, tokenId, this);

    return DiceDSA5.setupDialog({
      dialogOptions,
      testData,
      cardOptions,
    });
  }

  setupRegeneration(statusId, options = {}, tokenId) {
    return ActorDialogBuilder.createRegenerationDialog(statusId, options, tokenId, this);
  }

  setupDodge(options = {}, tokenId) {
    const statusId = 'dodge';
    const testData = {
      source: {
        system: this.system.status[statusId],
        type: statusId,
      },
      opposable: false,
      extra: {
        statusId,
        options,
        speaker: ActorDialogBuilder.buildSpeaker(this, tokenId),
      },
    };

    const toSearch = [game.i18n.localize(statusId), game.i18n.localize('LocalizedIDs.wrestle')];
    const combatskills = [
      ...CombatSpecialAbilities.build(this, ['Combat'], toSearch, 'parry', testData.source),
      ...CombatSpecialAbilities.build(this, ['animal'], undefined, 'parry', testData.source),
    ];
    const situationalModifiers = DSA5StatusEffects.getRollModifiers(this, testData.source);
    const isRangeAttack = CombatSystem.getDefenseMalus(situationalModifiers, this);
    const multipleDefenseValue = RuleChaos.multipleDefenseValue(this, testData.source);

    const data = {
      rollMode: options.rollMode,
      combatSpecAbs: combatskills,
      showDefense: true,
      situationalModifiers,
      isRangeAttack,
      multipleDefenseValue,
      isDodge: true,
    };
    const dialogOptions = {
      title: `${game.i18n.localize(statusId)} ${game.i18n.localize('Test')}`,
      template: 'systems/dsa5/templates/dialog/combatskill-enhanced-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, this, options, multipleDefenseValue, 'parry');
        Hooks.call('callbackDialogCombatDSA5', testData, this, html, testData.source, tokenId);
        testData.isRangeDefense = data.isRangeDefense;
        return { testData, cardOptions };
      },
    };

    const cardOptions = ActorDialogBuilder._setupCardOptions('systems/dsa5/templates/chat/roll/status-card.hbs', dialogOptions.title, tokenId, this);

    return DiceDSA5.setupDialog({
      dialogOptions,
      testData,
      cardOptions,
    });
  }

  setupCharacteristic(characteristicId, options = {}, tokenId) {
    let char = duplicate(this.system.characteristics[characteristicId]);
    let title = DSA5_Utility.attributeLocalization(characteristicId) + ' ' + game.i18n.localize('Test');

    char.attr = characteristicId;
    let testData = {
      opposable: false,
      source: {
        type: 'char',
        system: char,
      },
      extra: {
        characteristicId,
        options,
        speaker: ActorDialogBuilder.buildSpeaker(this, tokenId),
      },
    };

    let dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/characteristic-dialog.hbs',
      data: {
        rollMode: options.rollMode,
        difficultyLabels: DSA5.attributeDifficultyLabels,
        modifier: options.modifier || 0,
      },
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.testDifficulty = DSA5.attributeDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
        testData.situationalModifiers = ModifierCalculator._parseModifiers(html);
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    let cardOptions = ActorDialogBuilder._setupCardOptions('systems/dsa5/templates/chat/roll/characteristic-card.hbs', title, tokenId, this);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }

  static _prepareMeleeWeapon(item, combatskills, actor, wornWeapons = null, isBaseWeapon = true) {
    const skill = combatskills.find(i => i.name === item.system.combatskill.value);

    if (!skill) {
      if (isBaseWeapon) {
        ui.notifications.error(
          game.i18n.format('DSAError.unknownCombatSkill', {
            skill: item.system.combatskill.value,
            item: item.name,
          })
        );
      }
      return item;
    }

    item.attack = Number(skill.system.attack.value) + Number(item.system.atmod.value);

    const guideValueArray = item.system.guidevalue.value.split('/').map(x => {
      if (!actor.system.characteristics[x]) return 0;

      return Number(actor.system.characteristics[x].initial) +
        Number(actor.system.characteristics[x].modifier) +
        Number(actor.system.characteristics[x].advances) +
        Number(actor.system.characteristics[x].gearmodifier);
    });

    const guideValue = Math.max(...guideValueArray);
    const baseParry = Math.ceil(skill.system.talentValue.value / 2) +
      Math.max(0, Math.floor((guideValue - 8) / 3)) +
      Number(game.settings.get('dsa5', 'higherDefense'));

    const isShield = RuleChaos.isShield(item);
    item.parry = baseParry + Number(item.system.pamod.value) + (isShield ? Number(item.system.pamod.value) : 0);
    item.yieldedTwoHand = RuleChaos.isYieldedTwohanded(item);

    if (!item.yieldedTwoHand) {
      const actualWornWeapons = wornWeapons ||
        actor.items.filter(x => x.type === 'meleeweapon' &&
          x.system.worn.value &&
          x._id !== item._id &&
          !RuleChaos.isYieldedTwohanded(x));

      if (actualWornWeapons.length > 0) {
        item.parry += Math.max(...actualWornWeapons.map(x => x.system.pamod.offhandMod));
        item.attack += Math.max(...actualWornWeapons.map(x => x.system.atmod.offhandMod));
      }
    }

    let gripDamageMod = 0;

    if (item.system.worn.wrongGrip) {
      if (item.yieldedTwoHand) {
        item.parry -= 1;
        gripDamageMod = 1;
      } else {
        item.system.reach.value = 'medium';
        const localizedCT = game.i18n.localize(`LocalizedCTs.${item.system.combatskill.value}`);

        if (['Two-Handed Impact Weapons', 'Two-Handed Swords'].includes(localizedCT)) {
          item.parry -= 3;
          const bastardRegex = new RegExp(game.i18n.localize('wrongGrip.wrongGripBastardRegex'));

          if (bastardRegex.test(item.name)) {
            gripDamageMod = -2;
          } else {
            const oneHanded = game.i18n.localize('wrongGrip.oneHanded');
            item.gripDamageText = ` (${oneHanded} * 0.5)`;
            item.dmgMultipliers ||= [];
            DSA5_Utility.pushOnlyIfUnique(item.dmgMultipliers, { name: oneHanded, val: '0.5' });
          }
        } else {
          item.parry -= 1;
          gripDamageMod = -1;
        }
      }
    }

    item = ItemDataModel._parseDmg(item, actor.system);

    if (item.system.guidevalue.value !== '-') {
      const currentGuideValue = Math.max(
        ...item.system.guidevalue.value.split('/').map(x => Number(actor.system.characteristics[x].value))
      );

      let damageThreshold = item.system.damageThreshold.value;
      damageThreshold = actor.system.skillModifiers.combat.damageThreshold.reduce((acc, mod) => {
        return mod.target === item.system.combatskill.value ? acc + Number(mod.value) : acc;
      }, damageThreshold);

      const extra = Math.max(currentGuideValue - Number(damageThreshold), 0) + gripDamageMod;

      if (extra !== 0) {
        item.extraDamage = extra;
        item.damageAdd = Roll.safeEval(item.damageAdd + ' + ' + Number(extra));
        item.damageAdd = (item.damageAdd > 0 ? '+' : '') + item.damageAdd;
      }
    }

    EquipmentDamage.weaponWearModifier(item);

    if (isBaseWeapon) {
      item.subweapons = {};
      const alternateAttacks = getProperty(item, 'flags.dsa5.alternateAttacks') || {};

      for (const key of Object.keys(alternateAttacks)) {
        const duplicatedItem = this.buildSubweapon(item, key);
        item.subweapons[key] = this._prepareMeleeWeapon(duplicatedItem, combatskills, actor, wornWeapons, false);
      }

      item.system.damageToolTip = EquipmentDamage.damageTooltip(item);
    }

    return item;
  }

  static buildSubweapon(item, id) {
    if (!id) return item;

    const dup = duplicate(item);
    const value = getProperty(item, `flags.dsa5.alternateAttacks.${id}`);
    const data = foundry.utils.flattenObject(value);
    for (let key of Object.keys(data)) {
      if (this.skipAlternateWeaponKeys.has(data[key]) || data[key] == null || data[key] == undefined) delete data[key];
    }
    mergeObject(dup, data);
    return dup;
  }

  async actorEffects() {
    const allowedEffects = ['dead'];
    const isAllowedToSeeEffects = game.user.isGM || this.testUserPermission(game.user, 'OBSERVER') || !game.settings.get('dsa5', 'hideEffects');

    return isAllowedToSeeEffects ? this.effects.filter((x) => x.isVisibleEffect()) : this.effects.filter((x) => allowedEffects.some((y) => x.statuses.has(y)));
  }

  async _preCreate(data, options, user) {
    await super._preCreate(data, options, user);
    let update = {};

    if (!data.img) update.img = 'icons/svg/mystery-man-black.svg';

    if (data.type == 'character') {
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

    if (!item) return;

    let updates = [];
    switch (item.type) {
      case 'armor':
      case 'rangeweapon':
        const items = this.items.filter((x) => x.type == item.type && x.id != itemId && x.system.worn.value);
        updates = items.map((x) => {
          return { _id: x.id, 'system.worn.value': false };
        });
        updates.push({ _id: itemId, 'system.worn.value': true });
        break;
      case 'meleeweapon':
        let weapons = this.items.filter((x) => x.type == item.type && x.id != itemId && x.system.worn.value);
        const weaponUpdate = { _id: itemId, 'system.worn.value': true };
        if (!RuleChaos.isYieldedTwohanded(item)) {
          weapons = weapons.filter((x) => RuleChaos.isYieldedTwohanded(x) || x.system.worn.offHand == offHand);
          weaponUpdate['system.worn.offHand'] = offHand;
        }
        updates = weapons.map((x) => {
          return { _id: x.id, 'system.worn.value': false };
        });
        updates.push(weaponUpdate);
        break;
    }
    if (updates) await this.updateEmbeddedDocuments('Item', updates);
  }

  static calcLZ(item, actor) {
    let factor = 1;
    let modifier = 0;
    if (item.system.combatskill.value == game.i18n.localize('LocalizedIDs.Throwing Weapons')) modifier = SpecialabilityRulesDSA5.abilityStep(actor, 'LocalizedIDs.quickdraw') * -1;
    else if (
      item.system.combatskill.value == game.i18n.localize('LocalizedIDs.Crossbows') &&
      SpecialabilityRulesDSA5.hasAbility(actor, `${game.i18n.localize('LocalizedIDs.quickload')} (${game.i18n.localize('LocalizedIDs.Crossbows')})`, false)
    )
      factor = 0.5;
    else {
      modifier = SpecialabilityRulesDSA5.abilityStep(actor, `${game.i18n.localize('LocalizedIDs.quickload')} (${game.i18n.localize(item.system.combatskill.value)})`, false) * -1;
    }

    let reloadTime = `${item.system.reloadTime.value}`.split('/');
    if (item.system.ammunitiongroup.value == 'mag') {
      let currentAmmo = actor.items.find((x) => x.id == item.system.currentAmmo.value || x._id == item.system.currentAmmo.value);
      let reloadType = 0;
      if (currentAmmo) {
        currentAmmo = DSA5_Utility.toObjectIfPossible(currentAmmo);
        if (currentAmmo.system.mag.value <= 0) reloadType = 1;
      }
      reloadTime = reloadTime[reloadType] || reloadTime[0];
    } else {
      reloadTime = reloadTime[0];
    }

    return Math.max(0, Math.round(Number(reloadTime) * factor) + modifier);
  }

  static _prepareRangeWeapon(item, ammunitions, combatskills, actor, isBaseWeapon = true) {
    let skill = combatskills.find((i) => i.name == item.system.combatskill.value);
    item.calculatedRange = item.system.reach.value;

    let currentAmmo;
    if (skill) {
      item.attack = Number(skill.system.attack.value);

      if (item.system.ammunitiongroup.value != '-') {
        item.ammo = ammunitions.filter((x) => x.system.ammunitiongroup.value == item.system.ammunitiongroup.value);

        for (let am of item.ammo) am.label = `(${am.system.quantity.value}) ${am.name}`;

        currentAmmo = item.ammo.find((x) => x._id == item.system.currentAmmo.value);
        if (currentAmmo) {
          const rangeMultiplier = Number(currentAmmo.system.rangeMultiplier) || 1;
          item.calculatedRange = item.calculatedRange
            .split('/')
            .map((x) => Math.round(Number(x) * rangeMultiplier))
            .join('/');
          item.attack += Number(currentAmmo.system.atmod) || 0;
          if (currentAmmo.system.ammunitiongroup.value == 'mag') {
            item.ammoMax = currentAmmo.system.mag.max;
            item.ammoCurrent = currentAmmo.system.mag.value;
          }
        }
      }
      item.LZ = Actordsa5.calcLZ(item, actor);
      if (item.LZ > 0) RangeweaponData.buildReloadProgress(item);

      EquipmentDamage.weaponWearModifier(item);

      if (isBaseWeapon) {
        item.subweapons = {};
        for (let key of Object.keys(getProperty(item, 'flags.dsa5.alternateAttacks') || {})) {
          const dup = this.buildSubweapon(item, key);
          const done = this._prepareRangeWeapon(dup, ammunitions, combatskills, actor, false);
          item.subweapons[key] = done;
        }

        item.system.damageToolTip = EquipmentDamage.damageTooltip(item);
      }
    } else {
      if (isBaseWeapon)
        ui.notifications.error(
          game.i18n.format('DSAError.unknownCombatSkill', {
            skill: item.system.combatskill.value,
            item: item.name,
          }),
        );
    }

    return ItemDataModel._parseDmg(item, actor.system, currentAmmo);
  }

  async swapMag(weaponId) {
    const weapon = this.items.get(weaponId);
    const currentAmmo = this.items.get(weapon.system.currentAmmo.value);
    if (currentAmmo && currentAmmo.system.quantity.value > 1) {
      await this.updateEmbeddedDocuments('Item', [
        {
          _id: currentAmmo.id,
          'system.quantity.value': currentAmmo.system.quantity.value - 1,
          'system.mag.value': currentAmmo.system.mag.max,
        },
      ]);
      DSA5SoundEffect.playEquipmentWearStatusChange(currentAmmo);
      return currentAmmo;
    }
    ui.notifications.error('DSAError.NoAmmo', { localize: true });
    return undefined;
  }

  async toggleStatusEffect(statusId, { active, overlay = false } = {}) {
    const existing = this.effects.find((e) => e.statuses.has(statusId));

    if (overlay) {
      if (active) return false;

      this.removeCondition(statusId, 1, false);
    } else {
      if (!existing || Number.isNumeric(getProperty(existing, 'flags.dsa5.value'))) {
        if (!active && active != undefined) return false;

        await this.addCondition(statusId, 1, false, false);
      } else {
        if (active) return false;

        await this.removeCondition(statusId, 1, false);
      }
    }
  }

  async payMiracles(testData) {
    if (!testData.extra.miraclePaid) {
      testData.extra.miraclePaid = true;
      const miracleMight = game.i18n.localize('LocalizedIDs.miracleMight');
      const miracle = game.i18n.localize('LocalizedIDs.miracle');
      const hasMiracleMight = testData.situationalModifiers.some((x) => x.name.trim() == miracleMight);
      const hasMiracle = testData.situationalModifiers.some((x) => x.name.trim() == miracle);
      const cost = hasMiracleMight ? 6 : hasMiracle ? 4 : 0;
      if (cost) {
        await this.update({
          'system.status.karmaenergy.value': this.system.status.karmaenergy.value - cost,
        });
      }
    }
  }

  async consumeAmmunition(testData) {
    if (testData.extra.ammo && !testData.extra.ammoDecreased) {
      testData.extra.ammoDecreased = true;

      if (testData.extra.ammo._id) {
        let ammoUpdate = { _id: testData.extra.ammo._id };
        if (testData.extra.ammo.system.ammunitiongroup.value == 'mag') {
          if (testData.extra.ammo.system.mag.value <= 0) {
            testData.extra.ammo.system.quantity.value--;
            ammoUpdate['system.quantity.value'] = testData.extra.ammo.system.quantity.value;
            ammoUpdate['system.mag.value'] = testData.extra.ammo.system.mag.max - 1;
          } else {
            ammoUpdate['system.mag.value'] = testData.extra.ammo.system.mag.value - 1;
          }
        } else {
          testData.extra.ammo.system.quantity.value--;
          ammoUpdate['system.quantity.value'] = testData.extra.ammo.system.quantity.value;
        }
        await this.updateEmbeddedDocuments('Item', [ammoUpdate, { _id: testData.source._id, 'system.reloadTime.progress': 0 }]);
      }
    } else if (
      (testData.source.type == 'rangeweapon' || (testData.source.type == 'trait' && testData.source.system.traitType.value == 'rangeAttack')) &&
      !testData.extra.ammoDecreased
    ) {
      testData.extra.ammoDecreased = true;
      await this.updateEmbeddedDocuments('Item', [{ _id: testData.source._id, 'system.reloadTime.progress': 0 }]);
    } else if (['spell', 'liturgy'].includes(testData.source.type) && testData.extra.speaker.token != 'emptyActor') {
      await this.updateEmbeddedDocuments('Item', [
        {
          _id: testData.source._id,
          'system.castingTime.progress': 0,
          'system.castingTime.modified': 0,
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

    result.postFunction = 'basicTest';

    if (game.user.targets.size) {
      cardOptions.isOpposedTest = testData.opposable;
      const opposed = ` - ${game.i18n.localize('Opposed')}`;
      if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + '$') != opposed) cardOptions.title += opposed;
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
    if (effect == 'bleeding' || effect.id == 'bleeding') return await RuleChaos.bleedingMessage(this);

    //V11 actor delta fix for #displayScrollingStatus
    if (this.isToken && !this.token?.object) {
      console.warn('Actor token object is null for', this.name);
      return;
    }

    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  async addTimedCondition(effect, value = 1, absolute = false, auto = true, options = {}) {
    // Always override auto to false for timed conditions
    auto = false;

    if (effect === 'bleeding' || (effect.id && effect.id === 'bleeding')) {
      return await RuleChaos.bleedingMessage(this);
    }

    if (typeof effect === 'string' && !foundry.utils.isEmpty(options)) {
      const statusEffect = CONFIG.statusEffects.find((e) => e.id === effect);

      if (!statusEffect) {
        console.warn(`Status effect with ID "${effect}" not found.`);
        return null;
      }

      effect = duplicate(statusEffect);

      effect.name = game.i18n.localize(effect.name);
      effect.flags.dsa5.description = game.i18n.localize(effect.name);

      if (effect.changes) {
        effect.changes = effect.changes.map((change) => {
          if (/^system\.condition\./.test(change.key)) {
            change.value = value;
          }
          return change;
        });
      }

      effect.statuses = [effect.id];

      delete effect.description;
      delete effect.flags.dsa5.value;
      delete effect.flags.dsa5.max;
      delete effect.id;

      mergeObject(effect, options);
    }

    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  async initResistPainRoll(effect) {
    const showMessage = game.settings.get('dsa5', 'selfControlOnPain');

    if (this.hasCondition('incapacitated')) return;

    if (showMessage == 2 || (showMessage == 1 && !this.hasPlayerOwner)) {
      await this.addCondition('incapacitated');
      return;
    }

    const template = await renderTemplate('systems/dsa5/templates/chat/roll/resist-pain.hbs', { actor: this });
    await ChatMessage.create(DSA5_Utility.chatDataSetup(template));
  }

  async finishResistPainRoll() {
    const skill = this.items.find((x) => x.name == game.i18n.localize('LocalizedIDs.selfControl') && x.type == 'skill');
    this.setupSkill(skill, { subtitle: ` (${game.i18n.localize('ActiveEffects.resistRoll')})` }, this.token?.id).then(async (setupData) => {
      const res = await this.basicTest(setupData);
      const ql = res.result.successLevel || 0;
      if (ql < 1) {
        this.addCondition('incapacitated');
      }
    });
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
