import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DiceDSA5 from '../system/rolls/dice-dsa5.js';
import Actordsa5 from '../actor/actor-dsa5.js';
import DSA5StatusEffects from '../status/status_effects.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import ItemRulesDSA5 from '../system/rules/item-rules-dsa5.js';
import DSAActiveEffectConfig from '../status/active_effects.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import CreatureType from '../system/automation/creature-type.js';
import DPS from '../system/automation/derepositioningsystem.js';
import DSA5CombatDialog from '../dialog/dialog-combat-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import DSA5SpellDialog from '../dialog/dialog-spell-dsa5.js';
import Riding from '../system/automation/riding.js';
import DSAActiveEffect from '../status/dsa_active_effects.js';
import CombatskillData from '../data/item/combatskill.js';
const { getProperty, mergeObject, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class Itemdsa5 extends Item {
  static DEFAULT_ICON = 'systems/dsa5/icons/blank.webp';

  static defaultImages = {
    advantage: 'systems/dsa5/icons/categories/Vorteil.webp',
    disadvantage: 'systems/dsa5/icons/categories/Nachteil.webp',
    armor: 'systems/dsa5/icons/categories/Armor.webp',
    meleeweapon: 'systems/dsa5/icons/categories/Meleeweapon.webp',
    rangeweapon: 'systems/dsa5/icons/categories/Rangeweapon.webp',
    equipment: 'systems/dsa5/icons/categories/Equipment.webp',
    consumable: 'systems/dsa5/icons/categories/consumable.webp',
    liturgy: 'systems/dsa5/icons/categories/Liturgy.webp',
    spell: 'systems/dsa5/icons/categories/Spell.webp',
    ammunition: 'systems/dsa5/icons/categories/Munition.webp',
    career: 'systems/dsa5/icons/categories/Career.webp',
    magictrick: 'systems/dsa5/icons/categories/Spelltrick.webp',
    blessing: 'systems/dsa5/icons/categories/Blessing.webp',
    combatskill: 'systems/dsa5/icons/categories/Combat_Skill.webp',
    skill: 'systems/dsa5/icons/categories/Skill.webp',
    Geweihte: 'systems/dsa5/icons/categories/Geweihte.webp',
    Weltliche: 'systems/dsa5/icons/categories/Weltliche.webp',
    Zauberer: 'systems/dsa5/icons/categories/Zauberer.webp',
    ritual: 'systems/dsa5/icons/categories/ritual.webp',
    culture: 'icons/environment/people/charge.webp',
    money: 'systems/dsa5/icons/money-S.webp',
    ceremony: 'systems/dsa5/icons/categories/ceremony.webp',
    abilityclerical: 'systems/dsa5/icons/categories/ability_clerical.webp',
    abilityCombat: 'systems/dsa5/icons/categories/ability_combat.webp',
    abilityfatePoints: 'systems/dsa5/icons/categories/ability_fate_points.webp',
    abilitygeneral: 'systems/dsa5/icons/categories/ability_general.webp',
    specialability: 'systems/dsa5/icons/categories/ability_general.webp',
    abilitymagical: 'systems/dsa5/icons/categories/ability_magical.webp',
    abilitylanguage: 'systems/dsa5/icons/categories/Ability_Language.webp',
    abilitystaff: 'systems/dsa5/icons/categories/ability_staff.webp',
    abilityceremonial: 'systems/dsa5/icons/categories/ability_ceremonial.webp',
    abilityanimal: 'systems/dsa5/icons/categories/ability_animal.webp',
    abilitysecret: 'systems/dsa5/icons/categories/secret.webp',
    trait: 'systems/dsa5/icons/categories/trait.webp',
    Tiere: 'systems/dsa5/icons/categories/Tiere.webp',
    aggregatedTest: 'systems/dsa5/icons/categories/aggregated_test.webp',
    poison: 'systems/dsa5/icons/categories/poison.webp',
    disease: 'systems/dsa5/icons/categories/disease.webp',
    spellextension: 'systems/dsa5/icons/categories/Spellextension.webp',
    species: 'icons/environment/people/group.webp',
    application: 'systems/dsa5/icons/categories/Skill.webp',
    trick: 'systems/dsa5/icons/categories/Tiere.webp',
    disadvantageanimal: 'systems/dsa5/icons/categories/NachteilAnimal.webp',
    advantageanimal: 'systems/dsa5/icons/categories/VorteilAnimal.webp',
    diseaseanimal: 'systems/dsa5/icons/categories/diseaseAnimal.webp',
    effectwrapper: 'icons/svg/aura.svg',
    liturgyTalisman: 'systems/dsa5/icons/categories/LiturgieTalisman.webp',
    plant: 'systems/dsa5/icons/categories/plant.webp',
    magicalsign: 'systems/dsa5/icons/categories/magicalsign.webp',
    abilitypact: 'systems/dsa5/icons/categories/ability_pact.webp',
    demonmark: 'systems/dsa5/icons/categories/ability_pact.webp',
    patron: 'systems/dsa5/icons/categories/ability_pact.webp',
    information: 'systems/dsa5/icons/categories/DSA-Auge.webp',
    essence: 'systems/dsa5/icons/categories/wesenszug.webp',
    imprint: 'systems/dsa5/icons/categories/praegung.webp',
    book: 'systems/dsa5/icons/backgrounds/library.webp',
    trap: 'systems/dsa5/icons/categories/trap.webp',
  };

  static defaultIcon(data) {
    if (!data.img || data.img == '') {
      if (data.type in this.defaultImages) {
        data.img = this.defaultImages[data.type];
      } else {
        if (data.type.startsWith('ability')) {
          data.img = this.defaultImages.specialability;
        } else {
          data.img = Itemdsa5.DEFAULT_ICON;
        }
      }
    }
  }

  static async create(data, options) {
    if (Array.isArray(data)) {
      for (let d of data) {
        this.defaultIcon(d);
      }
    } else {
      this.defaultIcon(data);
    }
    return await super.create(data, options);
  }

  static getSpecAbModifiers(html, mode) {
    const res = [];
    const isAttack = mode === 'attack';
    const mainAttribute = isAttack ? 'atbonus' : 'pabonus';

    const matchers = {
      [mainAttribute]: 'value',
      tpbonus: 'damageBonus',
      dmmalus: 'dmmalus',
    };

    for (const element of html.find('.specAbs')) {
      const dataset = element.dataset;
      const step = Number(dataset.step);

      if (step <= 0) continue;

      const modifier = this.#parseModifierValue(dataset, mainAttribute, step);
      if (!modifier) continue;

      const flatValues = this.#extractFlatValues(dataset, matchers);

      res.push({
        name: $(element).find('a').text().trim(),
        value: modifier.value + (flatValues.value || 0),
        damageBonus: dataset.tpbonus,
        dmmalus: Number(dataset.dmmalus) * step + (flatValues.dmmalus || 0),
        step,
        specAbId: dataset.id,
        type: modifier.type,
        flatValues
      });
    }

    return res;
  }

  static #parseModifierValue(dataset, mainAttribute, step) {
    const val = dataset[mainAttribute];
    if (!val) return null;

    const isMultiplier = /^\*/.test(val);

    let reducedVal;
    if (val.includes(',')) {
      reducedVal = val.split(',').reduce((sum, cur) => sum + Number(cur), 0);
    } else {
      reducedVal = Number(val.replace(/^\*/, ''));
    }

    if (isNaN(reducedVal)) return null;

    return {
      value: isMultiplier ? reducedVal : reducedVal * step,
      type: isMultiplier ? '*' : undefined
    };
  }

  static #extractFlatValues(dataset, matchers) {
    const flatValues = {};

    for (const key in dataset) {
      if (!key.endsWith('Flat')) continue;

      const flatValue = dataset[key];
      if (!flatValue?.length) continue;

      const replacedKey = key.replace('Flat', '');
      const matcherKey = matchers[replacedKey];

      if (matcherKey) {
        const value = flatValue.split(',').reduce((sum, x) => sum + (Number(x) || 0), 0);
        flatValues[matcherKey] = value;
      }
    }

    return flatValues;
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

  static setupSubClasses() {
    game.dsa5.config.ItemSubclasses = {
      ritual: RitualItemDSA5,
      spell: SpellItemDSA5,
      liturgy: LiturgyItemDSA5,
      ceremony: CeremonyItemDSA5,
      advantage: VantageItemDSA5,
      disadvantage: VantageItemDSA5,
      aggregatedTest: AggregatedTestItemDSA5,
      trait: TraitItemDSA5,
      blessing: BlessingItemDSA5,
      magictrick: CantripItemDSA5,
      specialability: SpecialAbilityItemDSA5,
      disease: DiseaseItemDSA5,
      poison: PoisonItemDSA5,
      armor: ArmorItemDSA5,
      money: MoneyItemDSA5,
      rangeweapon: RangeweaponItemDSA5,
      meleeweapon: MeleeweaponDSA5,
      ammunition: AmmunitionItemDSA5,
      equipment: EquipmentItemDSA5,
      combatskill: CombatskillDSA5,
      skill: SkillItemDSA5,
      application: ApplicationItemDSA5,
      consumable: ConsumableItemDSA,
      spellextension: SpellextensionItemDSA5,
      species: SpeciesItemDSA5,
      effectwrapper: EffectWrapperItemDSA5,
      plant: PlantItemDSA5,
      magicalsign: MagicalSignItemDSA5,
      patron: PatronItemDSA5,
      demonmark: DemonmarkItemDSA5,
      information: InformationItemDSA5,
      book: BookItemDSA5,
      trap: TrapItemDSA5,
    };
  }

  static buildSpeaker(actor, tokenId) {
    const speaker = {
      token: tokenId,
      actor: actor?.id,
      scene: canvas.scene?.id,
    };
    if (speaker.token == 'emptyActor') speaker.emptyActor = actor.emptyActor;
    return speaker
  }

  static parseValueType(name, val) {
    let type = '';
    if (/^\*/.test(val)) {
      type = '*';
      val = val.substring(1).replace(',', '.');
    }
    return {
      name,
      value: Number(val),
      type,
    };
  }

  async addCondition(effect, value = 1, absolute = false, auto = true) {
    return await DSA5StatusEffects.addCondition(this, effect, value, absolute, auto);
  }

  async removeCondition(effect, value = 1, auto = true, absolute = false) {
    return DSA5StatusEffects.removeCondition(this, effect, value, auto, absolute);
  }

  hasCondition(conditionKey) {
    return DSA5StatusEffects.hasCondition(this, conditionKey);
  }

  static getMiracleModifiers(actor, source, type, bonusAttribute) {
    const regex = new RegExp(`${game.i18n.localize('TYPES.Item.combatskill')} `, 'gi');
    const happyTalents = (getProperty(actor, 'system.happyTalents.value') || '').split(/;|,/).map((x) => x.replace(regex, '').trim());
    const result = [];
    if (happyTalents.includes(source.name)) {
      const availableKaP = actor.system.status.karmaenergy.value;
      const bonus = getProperty(actor, `system.miracle.${bonusAttribute}`) || 0;
      if (availableKaP < 4) return [];

      result.push({
        name: game.i18n.localize('LocalizedIDs.miracle'),
        value: 2 + bonus,
        type,
        selected: false,
      });
      const miracleMight = game.i18n.localize('LocalizedIDs.miracleMight');
      if (availableKaP >= 6 && SpecialabilityRulesDSA5.hasAbility(actor, miracleMight, false)) {
        result.push({
          name: miracleMight,
          value: 3 + bonus,
          type,
          selected: false,
        });
      }
    }
    return result;
  }

  static getSkZkModifier(data, source) {
    let skMod = [];
    let zkMod = [];

    const hasSpellResistance = ['spell', 'liturgy', 'ceremony', 'ritual'].includes(source.type) && source.system.effectFormula.value.trim() == '';
    if (game.user.targets.size) {
      game.user.targets.forEach((target) => {
        if (target.actor) {
          let spellResistance = 0;
          if (hasSpellResistance) {
            const creatureTypes = CreatureType.detectCreatureType(target.actor);
            spellResistance = creatureTypes.reduce((sum, x) => {
              return sum + x.spellResistanceModifier(target.actor);
            }, 0);
          }
          const itemResistSoulpower = getProperty(target.actor, `system.status.soulpower.${source.type}resist`) || 0;
          const itemResistToughness = getProperty(target.actor, `system.status.toughness.${source.type}resist`) || 0;
          skMod.push((target.actor.system.status.soulpower.max + itemResistSoulpower) * -1 - spellResistance);
          zkMod.push((target.actor.system.status.toughness.max + itemResistToughness) * -1 - spellResistance);
        }
      });
    }

    mergeObject(data, {
      SKModifier: skMod.length > 0 ? Math.min(...skMod) : 0,
      ZKModifier: zkMod.length > 0 ? Math.min(...zkMod) : 0,
    });
  }

  static async _onCreateOperation(documents, operation, user) {
    for (let doc of documents) {
      if (doc.actor) await Actordsa5.postUpdateConditions(doc.actor);
    }
    return super._onCreateOperation(documents, operation, user);
  }

  static async _onUpdateOperation(documents, operation, user) {
    for (let doc of documents) {
      if (doc.actor) await Actordsa5.postUpdateConditions(doc.actor);
    }
    return super._onUpdateOperation(documents, operation, user);
  }

  static async _onDeleteOperation(documents, operation, user) {
    for (let doc of documents) {
      if (doc.actor) await Actordsa5.postUpdateConditions(doc.actor);
    }
    return super._onDeleteOperation(documents, operation, user);
  }

  //todo this needs the current movement type
  static parseEffect(effect, actor) {
    const itemModifiers = {};
    const speedRegex = new RegExp(game.i18n.localize('CHARAbbrev.GS'), 'gi');
    const valuePatterns = [
      /(=)?[+-]\d([+-]\d)?/,
      /(=)?\d[dDwW]\d/,
      /=\d+/,
      /\*\d(\.\d)*/
    ];
    
    const modifiers = effect.split(/[,;]/).map(x => x.trim()).filter(Boolean);
    
    for (const modifier of modifiers) {
      const cleanedModifier = modifier.replace(/\s+/g, ' ').trim();
      const parts = cleanedModifier.split(' ').map(x => x.trim());

      if (parts.length !== 2) continue;
      
      const [value, key] = parts;
      const processedValue = value.replace(speedRegex, actor.system.status.speed.max);
      
      if (!isNaN(processedValue) || valuePatterns.some(pattern => pattern.test(processedValue))) {
        const normalizedKey = key.toLowerCase();
        itemModifiers[normalizedKey] ??= [];
        itemModifiers[normalizedKey].push(processedValue);
      }
    }
    
    return itemModifiers;
  }

  static getDefenseMalus(situationalModifiers, actor) {
    let isRangeDefense = false;
    const opposeFlags = actor.flags?.oppose;
    if (!opposeFlags) return isRangeDefense;

    const message = game.messages.get(opposeFlags.messageId);
    if (!message?.flags?.data) return isRangeDefense;

    const preData = message.flags.data.preData;
    const postData = message.flags.data.postData || {};
    const sourceType = getProperty(preData, 'source.type');
    const traitType = getProperty(preData, 'source.system.traitType.value');
    isRangeDefense = !(sourceType === 'meleeweapon' || traitType === 'meleeAttack');

    const regex = / \[(-)?\d{1,}\]/;
    for (const mal of preData.situationalModifiers || []) {
      if (mal.dmmalus !== undefined && mal.dmmalus !== 0) {
        situationalModifiers.push({
          name: `${game.i18n.localize('MODS.defenseMalus')} - ${mal.name.replace(regex, '')}`,
          value: mal.dmmalus,
          selected: true,
        });
      } else if (mal.type === 'defenseMalus' && mal.value !== 0) {
        situationalModifiers.push({
          name: mal.name.replace(regex, ''),
          value: mal.value,
          selected: true,
        });
      }
    }

    if (postData.halfDefense) {
      situationalModifiers.push({
        name: `${game.i18n.localize('MODS.defenseMalus')} - ${game.i18n.localize('halfDefenseShort')}`,
        value: 0.5,
        type: '*',
        selected: true,
      });
    }

    return isRangeDefense;
  }

  static changeChars(source, ch1, ch2, ch3) {
    source.system.characteristic1.value = ch1;
    source.system.characteristic2.value = ch2;
    source.system.characteristic3.value = ch3;
  }

  static specAbsDataset(combatSpecAbs, actor, mode, path = 'effect.value') {
    const isDefense = mode === 'parry';
    const keys = isDefense ? ['pa'] : ['at', 'tp', 'dm'];
    const translatedKeys = Object.fromEntries(
      keys.map(key => [key, game.i18n.localize(`LocalizedAbilityModifiers.${key}`)])
    );
    const validSpecAb = isDefense
      ? vals => vals.pa.some(v => v !== 0)
      : vals => vals.at.some(v => v !== 0) || vals.tp.some(v => v !== 0) || vals.dm.some(v => v !== 0);

    return combatSpecAbs.reduce((acc, com) => {
      const effects = Itemdsa5.parseEffect(getProperty(com.system, path), actor);
      const variantCount = ['', '2', '3'].filter(x => getProperty(com, `system.effect.value${x}`)).length;
      const vals = Object.fromEntries(
        keys.map(key => [key, effects[translatedKeys[key]] || [0]])
      );

      if (validSpecAb(vals) || (!isDefense && com.effects.size > 0)) {
        const subCategory = game.i18n.localize(DSA5.combatSkillSubCategories[com.system.category.sub]);
        const steps = variantCount > 1 && getProperty(com, 'system.step.canNotMultiply') ? 1 : com.system.step.value;
        acc.push({
          name: com.name,
          atbonus: vals.at || [0],
          pabonus: vals.pa || [0],
          tpbonus: vals.tp || [0],
          dmmalus: vals.dm || [0],
          steps,
          category: {
            id: com.system.category.sub,
            css: `ab_${com.system.category.sub}`,
            name: subCategory,
          },
          id: com.id,
          actor: actor.id,
          variantCount,
        });
      }
      return acc;
    }, []);
  }

  static buildCombatSpecAbs(actor, categories, toSearch, mode, source) {
    let searchFilter = () => true;
    if (toSearch) {
      const normalizedSearch = [...toSearch, game.i18n.localize('LocalizedIDs.all')].map(x => x.toLowerCase());
      searchFilter = (item) =>
        item.system.list.value
          .split(/;|,/)
          .map(y => y.trim().toLowerCase().replace(/ \([a-zA-Z äüöÄÖÜ]*\)/, ''))
          .some(y => normalizedSearch.includes(y));
    }

    const brawlingFilter = game.combat?.isBrawling ? () => true : item => Number(item.system.category.sub) !== 5;

    const allowedNames = new Set();
    const forbiddenNames = new Set();
    const effectChanges = {};

    for (const effect of source.effects || []) {
      if (!DSAActiveEffect.realyRealyEnabled(effect)) continue;
      for (const change of effect.changes) {
        if (!change.key.startsWith('self.maneuver.')) continue;
        const parsed = DSA5_Utility.parseAbilityString(change.value);

        if (parsed.name.endsWith('-')) {
          forbiddenNames.add(parsed.name.slice(0, -1).trim());
        } else if (parsed.name.endsWith('+')) {
          allowedNames.add(parsed.name.slice(0, -1).trim());
        } else {
          const changeMode = change.key.split('.')[2];
          effectChanges[parsed.name] ??= {};
          effectChanges[parsed.name][changeMode] ??= 0;
          effectChanges[parsed.name][changeMode] += parsed.step;
        }
      }
    }

    const combatSpecAbs = actor.items.filter(item =>
      item.type === 'specialability' &&
      categories.includes(item.system.category.value) &&
      item.system.effect.value &&
      (searchFilter(item, toSearch) || allowedNames.has(item.name)) &&
      brawlingFilter(item) &&
      !forbiddenNames.has(item.name)
    );

    const result = this.specAbsDataset(combatSpecAbs, actor, mode);
    for (const specAb of result) {
      const changes = effectChanges[specAb.name];
      if (changes) {
        for (const key in changes) {
          const flatKey = `${key}-flat`;
          if (!specAb[flatKey]) specAb[flatKey] = [];
          specAb[flatKey].push(changes[key]);
        }
      }
    }
    return result;
  }

  static getCombatSkillModifier(actor, source, situationalModifiers) {
    if (source.type == 'trait') return;

    const combatskill = actor.items.find((x) => x.type == 'combatskill' && x.name == source.system.combatskill.value);

    for (let ef of combatskill.effects) {
      for (let change of ef.changes) {
        switch (change.key) {
          case 'system.rangeStats.defenseMalus':
          case 'system.meleeStats.defenseMalus':
            situationalModifiers.push({
              name: `${combatskill.name} - ${game.i18n.localize('MODS.defenseMalus')}`,
              value: change.value * -1,
              type: 'defenseMalus',
              selected: true,
            });
            break;
        }
      }
    }
  }

  static attackStatEffect(situationalModifiers, value) {
    if (value != 0) {
      value = isNaN(value) ? value : Number(value);
      situationalModifiers.push({
        name: game.i18n.localize('statuseffects'),
        value,
        selected: true,
      });
    }
  }

  static getTargetSizeAndModifier(actor, source, situationalModifiers) {
    let targetSize = 'average';
    game.user.targets.forEach((target) => {
      if (target.actor) {
        const size = getProperty(target.actor, 'system.status.size.value');
        if (size) targetSize = size;

        CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor);
        this.checkDuplicatus(actor, target.actor, situationalModifiers);
      }
    });
    return targetSize;
  }

  static checkDuplicatus(actor, target, situationalModifiers) {
    const val = getProperty(target, 'system.extra.duplicatus');
    const immuneToIllusion = CreatureType.detectCreatureType(actor).some((x) => x.spellImmunities.includes('Illusion'));
    if (val) {
      situationalModifiers.push({
        name: `Duplicatus - ${game.i18n.localize('doppelganger')}`,
        value: val,
        selected: !immuneToIllusion,
        type: 'effect',
        source: 'Duplicatus',
      });
    }
  }

  static prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatSpecAbs, currentAmmo = undefined) {
    situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.restrictedSenseSight', -2));
    this.getCombatSkillModifier(actor, source, situationalModifiers);

    const targetSize = this.getTargetSizeAndModifier(actor, source, situationalModifiers);

    const defenseMalus = Number(actor.system.rangeStats.defenseMalus) * -1;
    if (defenseMalus != 0) {
      situationalModifiers.push({
        name: `${game.i18n.localize('statuseffects')} - ${game.i18n.localize('MODS.defenseMalus')}`,
        value: defenseMalus,
        type: 'defenseMalus',
        selected: true,
      });
    }

    const rangeOptions = new Set(['short', 'medium', 'long', 'rangesense', 'extreme']);
    rangeOptions.delete(AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.senseOfRange') ? 'long' : 'rangesense');
    if (!SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.extremeShot')) rangeOptions.delete('extreme');

    let mountedOptions;
    const isRiding = Riding.isRiding(actor);
    const isDriving = Riding.isDriving(actor);

    if (isDriving) {
      const drivingArcher = SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.drivingArcher');
      mountedOptions = drivingArcher ? duplicate(DSA5.drivingArcherOptionsSpecAb) : duplicate(DSA5.drivingArcherOptions);
    } else if (isRiding) {
      const mountedArcher = SpecialabilityRulesDSA5.hasAbility(actor, 'LocalizedIDs.mountedArcher');
      mountedOptions = mountedArcher ? duplicate(DSA5.mountedRangeOptionsSpecAb) : duplicate(DSA5.mountedRangeOptions);
    } else {
      mountedOptions = duplicate(DSA5.mountedRangeOptions);
    }

    let finalMountedOptions = {};
    for (let key of Object.keys(mountedOptions)) {
      finalMountedOptions[`${game.i18n.localize('mountedRangeOptions.' + key)} (${mountedOptions[key]})`] = mountedOptions[key];
    }

    this.swarmModifiers(actor, 'attack', situationalModifiers);

    mergeObject(data, {
      rangeOptions,
      rangeDistance: Array.from(rangeOptions)[DPS.distanceModifier(game.canvas.tokens.get(tokenId), source, currentAmmo)],
      visionOptions: DSA5.rangeVision,
      mountedOptions: finalMountedOptions,
      shooterMovementOptions: DSA5.shooterMovementOptions,
      targetMovementOptions: DSA5.targetMovementOptions,
      targetSize,
      combatSpecAbs,
    });
  }

  static swarmModifiers(actor, mode, situationalModifiers) {
    if (actor.system.swarm?.count > 1) {
      const swarmName = game.i18n.localize('swarm.name')
      if (mode == 'attack') {
        situationalModifiers.push(
          {
            name: `${swarmName} - ${game.i18n.localize('MODS.defenseMalus')}`,
            value: actor.system.swarm.parry,
            type: 'defenseMalus',
            selected: true,
          },
          {
            name: `${swarmName} - ${game.i18n.localize('CHARAbbrev.AT')}`,
            value: actor.system.swarm.attack,
            selected: true,
          },
          {
            name: `${swarmName} - ${game.i18n.localize('CHARAbbrev.damage')}`,
            value: actor.system.swarm.damage,
            type: 'dmg',
            selected: true,
          },
        );
      } else {
        situationalModifiers.push({
          name: `${swarmName} - ${game.i18n.localize('CHARAbbrev.PA')}`,
          value: actor.system.swarm.parry,
          selected: true,
        });
      }
    }
  }

  static prepareMeleeAttack(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled) {
    let targetWeaponSize = 'short';

    game.user.targets.forEach((target) => {
      const targetActor = target.actor;
      if (!targetActor) return;

      const combatskills = targetActor.items
        .filter((x) => x.type == 'combatskill')
        .map((x) => CombatskillData._calculateCombatSkillValues(x.toObject(), targetActor.system));

      for (let item of targetActor.items) {
        const isMeleeWeapon = item.type == 'meleeweapon';
        const isTraitMelee = item.type == 'trait' && item.system.traitType.value == 'meleeAttack' && item.system.pa;

        if (!(isMeleeWeapon && item.system.worn.value) && !isTraitMelee) continue;

        if (isMeleeWeapon) item = Actordsa5._prepareMeleeWeapon(item.toObject(), combatskills, targetActor);

        if (DSA5.meleeRangesArray.indexOf(item.system.reach.value) > DSA5.meleeRangesArray.indexOf(targetWeaponSize)) {
          targetWeaponSize = item.system.reach.value;
        }

        if (targetWeaponSize === 'long') break;
      }
    });

    const targetSize = this.getTargetSizeAndModifier(actor, source, situationalModifiers);
    this.getCombatSkillModifier(actor, source, situationalModifiers);

    const defenseMalus = Number(actor.system.meleeStats.defenseMalus) * -1;
    if (defenseMalus !== 0) {
      situationalModifiers.push({
        name: `${game.i18n.localize('statuseffects')} - ${game.i18n.localize('MODS.defenseMalus')}`,
        value: defenseMalus,
        type: 'defenseMalus',
        selected: true,
      });
    }

    this.swarmModifiers(actor, 'attack', situationalModifiers);

    mergeObject(data, {
      visionOptions: DSA5.meleeRangeVision(data.mode),
      weaponSizes: DSA5.meleeRanges,
      melee: true,
      showAttack: true,
      targetWeaponSize,
      combatSpecAbs,
      meleeSizeOptions: DSA5.meleeSizeCategories,
      targetSize,
      constricted: actor.hasCondition('constricted'),
      wrongHandDisabled,
      offHand: !wrongHandDisabled && getProperty(source, 'system.worn.offHand'),
    });
  }

  static prepareMeleeParry(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled) {
    const isRangeDefense = Itemdsa5.getDefenseMalus(situationalModifiers, actor);
    this.swarmModifiers(actor, 'parry', situationalModifiers);
    mergeObject(data, {
      visionOptions: DSA5.meleeRangeVision(data.mode),
      showDefense: true,
      isRangeDefense,
      wrongHandDisabled: wrongHandDisabled && getProperty(source, 'system.worn.offHand'),
      offHand: !wrongHandDisabled && getProperty(source, 'system.worn.offHand') && !RuleChaos.isShield(source),
      melee: true,
      combatSpecAbs,
      constricted: actor.hasCondition('constricted'),
    });
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    return null;
  }

  setupEffect(ev, options = {}, tokenId) {
    return Itemdsa5.getSubClass(this.type).setupDialog(ev, options, this, this.parent, tokenId);
  }

  static checkEquality(item, item2) {
    return item2.type == item.type && item.name == item2.name && item.system.description?.value == item2.system.description?.value;
  }

  static async combineItem(item1, item2, actor, render = true) {
    item1 = duplicate(item1);
    item1.system.quantity.value += item2.system.quantity.value;
    return await actor.updateEmbeddedDocuments('Item', [item1], { render });
  }

  static areEquals(item, item2) {
    if (item.type != item2.type) return false;
    if (item.id == item2.id) return false;

    return Itemdsa5.getSubClass(item.type).checkEquality(item, item2);
  }

  static async stackItems(stackOn, newItem, actor, render = true) {
    return await Itemdsa5.getSubClass(stackOn.type).combineItem(stackOn, newItem, actor, render);
  }

  _setupCardOptions(template, title, tokenId) {
    const speaker = ChatMessage.getSpeaker();
    return {
      speaker: {
        alias: speaker.alias,
        scene: speaker.scene,
      },
      flags: {
        img: { src: speaker.token ? canvas.tokens.get(speaker.token).document.texture.src : this.img },
      },
      title,
      template,
    };
  }

  async itemTest({ testData, cardOptions }, options = {}) {
    testData = await DiceDSA5.rollDices(testData, cardOptions);
    let result = await DiceDSA5.rollTest(testData);

    result.postFunction = 'itemTest';

    if (game.user.targets.size) {
      cardOptions.isOpposedTest = testData.opposable;
      const opposed = ` - ${game.i18n.localize('Opposed')}`;
      if (cardOptions.isOpposedTest && cardOptions.title.match(opposed + '$') != opposed) cardOptions.title += opposed;
    }

    if (!options.suppressMessage) DiceDSA5.renderRollCard(cardOptions, result, options.rerenderMessage);

    return { result, cardOptions };
  }

  static getSubClass(type) {
    return game.dsa5.config.ItemSubclasses[type] || Itemdsa5;
  }

  async postItem() {
    this.system.constructor._postItem(this);
  }
}

class PlantItemDSA5 extends Itemdsa5 { }

class MagicalSignItemDSA5 extends Itemdsa5 { }

class DemonmarkItemDSA5 extends Itemdsa5 { }

class TrapItemDSA5 extends Itemdsa5 { }

class PatronItemDSA5 extends Itemdsa5 { }

class MoneyItemDSA5 extends Itemdsa5 {
  static checkEquality(item, item2) {
    return item2.type == item.type && game.i18n.localize(item.name) == game.i18n.localize(item2.name) && item.system.description?.value == item2.system.description?.value;
  }
}

class AggregatedTestItemDSA5 extends Itemdsa5 { }

class AmmunitionItemDSA5 extends Itemdsa5 { }

class EffectWrapperItemDSA5 extends Itemdsa5 { }

class ArmorItemDSA5 extends Itemdsa5 { }

class CantripItemDSA5 extends Itemdsa5 { }

class BlessingItemDSA5 extends CantripItemDSA5 { }

class SpellItemDSA5 extends Itemdsa5 {
  static async getCallbackData(testData, html, actor) {
    testData.testDifficulty = 0;
    testData.situationalModifiers = Actordsa5._parseModifiers(html);
    const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
    const formData = new foundry.applications.ux.FormDataExtended(form).object;
    testData.calculatedSpellModifiers = {
      castingTime: html.find('.castingTime').text(),
      cost: html.find('.aspcost').text(),
      reach: html.find('.reach').text(),
      maintainCost: html.find('.maintainCost').text(),
    };
    testData.situationalModifiers.push(
      Itemdsa5.parseValueType(game.i18n.localize('sight'), formData.vision || 0),
      {
        name: game.i18n.localize('removeGesture'),
        value: Number(formData.removeGesture) || 0,
      },
      {
        name: game.i18n.localize('removeFormula'),
        value: Number(formData.removeFormula) || 0,
      },
      {
        name: game.i18n.localize('castingTime'),
        value: html.find('.castingTime').data('mod'),
      },
      {
        name: game.i18n.localize('cost'),
        value: html.find('.aspcost').data('mod'),
      },
      {
        name: game.i18n.localize('reach'),
        value: html.find('.reach').data('mod'),
      },
      {
        name: game.i18n.localize('zkModifier'),
        value: formData.zkModifier || 0,
      },
      {
        name: game.i18n.localize('skModifier'),
        value: formData.skModifier || 0,
      },
      {
        name: game.i18n.localize('maintainedSpells'),
        value: formData.maintainedSpells * -1,
      },
    );
    testData.extensions = SpellItemDSA5.getSpecAbModifiers(html);
    testData.advancedModifiers = {
      chars: [0, 1, 2].map((x) => formData[`ch${x}`]),
      fws: formData.fw,
      qls: formData.qs,
    };
    Itemdsa5.changeChars(testData.source, ...[0, 1, 2].map((x) => formData[`characteristics${x}`]));
    await this.applyExtensions(testData.source, testData.extensions, actor);
  }

  static async applyExtensions(source, extensions, actor) {
    RuleChaos.ensureNumber(source);
    const rollModifiers = Object.keys(DSA5SpellDialog.rollModifiers).map((x) => `${x}.mod`);
    for (let extension of extensions) {
      const item = fromUuidSync(extension.uuid);
      if (!item) continue;

      for (let ef of item.effects) {
        for (let change of ef.changes) {
          if (DSA5SpellDialog.rollChanges.includes(change.key)) continue;
          if (rollModifiers.includes(change.key)) continue;

          if (change.key == 'macro.transform') {
            await DSA5_Utility.callItemTransformationMacro(change.value, source, ef);
          } else if (change.key == 'system.effectFormula.value' && change.mode == 2) {
            source.system.effectFormula.value = source.system.effectFormula.value
              .split(',')
              .map((x) => {
                return x + change.value;
              })
              .join(',');
          } else {
            ef.apply(source, change);
          }
        }
      }
    }
  }

  static getSpecAbModifiers(html) {
    const res = [];
    for (let k of html.find('.specAbs.active')) {
      res.push({
        name: k.dataset.name,
        title: k.dataset.tooltip,
        uuid: k.dataset.uuid,
      });
    }
    return res;
  }

  static attackSpellMalus(source) {
    const res = [];
    if (source.system.effectFormula.value)
      res.push({
        name: game.i18n.localize('MODS.defenseMalus'),
        value: -4,
        type: 'defenseMalus',
        selected: true,
        source: source.name,
      });

    return res;
  }

  static getPropertyModifiers(actor, item) {
    const isClerical = ['ceremony', 'liturgy'].includes(item.type);
    const features = (getProperty(item, 'system.feature') || '')
      .replace(/\(a-z äöü-\)/gi, '')
      .split(',')
      .map((x) => x.trim());
    const res = [];

    const cost = isClerical ? 'KaPCost' : 'AsPCost';
    const keys = ['FP', 'step', 'QL', 'TPM', 'FW', cost];
    for (const k of keys) {
      const type = k == 'step' ? '' : k;
      const modifiers = getProperty(actor.system.skillModifiers, `feature.${k}`);
      res.push(
        ...modifiers
          .filter((x) => features.includes(x.target))
          .map((f) => {
            return {
              name: f.source,
              value: f.value,
              type,
              source: f.source,
            };
          }),
      );
    }
    const conditional = getProperty(actor.system.skillModifiers, `conditional.${cost}`);
    res.push(
      ...conditional.map((f) => {
        return {
          name: f.target,
          value: f.value,
          source: f.source,
          type: cost,
        };
      }),
    );

    return res;
  }

  static foreignSpellModifier(actor, source, situationalModifiers, data) {
    if (game.settings.get('dsa5', 'enableForeignSpellModifer') && ['npc', 'character'].includes(actor.type) && ['spell', 'ritual'].includes(source.type)) {
      const distributions = source.system.distribution.value.split(',').map((x) => x.trim().toLowerCase());
      const regx = new RegExp(`(${game.i18n.localize('tradition')}|\\\)|\\\()`, 'g');
      const traditions = actor.system.tradition.magical
        .replace(regx, '')
        .split(',')
        .map((x) => x.trim().toLowerCase());
      traditions.push(game.i18n.localize('general').toLowerCase());

      data.isForeign = !distributions.some((x) => traditions.includes(x));
      if (data.isForeign) {
        situationalModifiers.push({
          name: game.i18n.localize('DSASETTINGS.enableForeignSpellModifer'),
          value: -2,
          selected: true,
        });
      }
    }
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    situationalModifiers.push(
      ...ItemRulesDSA5.getTalentBonus(actor, source.name, ['advantage', 'disadvantage', 'specialability', 'equipment']),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.magicalAttunement', 1, true),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.magicalRestriction', -1, true),
      ...AdvantageRulesDSA5.getVantageAsModifier(actor, 'LocalizedIDs.boundToArtifact', -1, true),
      ...this.getPropertyModifiers(actor, source),
      ...this.attackSpellMalus(source),
    );

    this.foreignSpellModifier(actor, source, situationalModifiers, data);
    if (game.user.targets.size) {
      game.user.targets.forEach((target) => {
        if (target.actor) {
          CreatureType.addCreatureTypeModifiers(target.actor, source, situationalModifiers, actor);
          this.checkDuplicatus(actor, target.actor, situationalModifiers);
        }
      });
    }
    situationalModifiers.push(...actor.getSkillModifier(source.name, source.type));

    for (const thing of actor.system.skillModifiers.global) situationalModifiers.push({ name: thing.source, value: thing.value });

    this.getSkZkModifier(data, source);
    Object.assign(data, {
      visionOptions: DSA5.skillVision,
    });
  }

  static setupDialog(ev, options, spell, actor, tokenId) {
    const sheet = ['ceremony', 'liturgy'].includes(spell.type) ? 'liturgy' : 'spell';
    const title = `${spell.name} ${game.i18n.localize(`${spell.type}Test`)}${options.subtitle || ''}`;

    const testData = {
      opposable: spell.system.effectFormula.value.length > 0,
      source: spell,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
      advancedModifiers: {
        chars: [0, 0, 0],
        fws: 0,
        qls: 0,
      },
      calculatedSpellModifiers: {
        castingTime: 0,
        cost: 0,
        reach: 0,
        maintainCost: 0,
      },
    };

    const actorModMod = getProperty(actor, `system.${sheet}Stats.spellextension`) || 0;
    const maxMods = Math.max(0, Math.floor(Number(spell.system.talentValue.value) / 4) + actorModMod)

    const data = {
      rollMode: options.rollMode,
      spellCost: spell.system.AsPCost.value,
      maintainCost: spell.system.maintainCost.value,
      spellCastingTime: spell.system.castingTime.value,
      spellReach: spell.system.range.value,
      canChangeCost: spell.system.canChangeCost.value,
      canChangeRange: spell.system.canChangeRange.value,
      canChangeCastingTime: spell.system.canChangeCastingTime.value,
      hasSKModifier: spell.system.resistanceModifier.value == 'SK',
      hasZKModifier: spell.system.resistanceModifier.value == 'ZK',
      maxMods,
      extensions: this.prepareExtensions(actor, spell),
      variableBaseCost: spell.system.variableBaseCost,
      characteristics: [1, 2, 3].map((x) => spell.system[`characteristic${x}`].value),
    };

    const situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, spell) : [];
    this.getSituationalModifiers(situationalModifiers, actor, data, spell);
    data.situationalModifiers = situationalModifiers;

    const dialogOptions = {
      title,
      template: `systems/dsa5/templates/dialog/${sheet}-enhanced-dialog.hbs`,
      data,
      callback: async (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        await this.getCallbackData(testData, html, actor);
        mergeObject(testData.extra.options, options);
        testData.hideSpellDetails = game.settings.get('dsa5', 'hideSpellDetails');
        return { testData, cardOptions };
      },
    };

    const cardOptions = actor._setupCardOptions('systems/dsa5/templates/chat/roll/spell-card.hbs', title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }

  static prepareExtensions(actor, spell) {
    return actor.items
      .filter((x) => x.type == 'spellextension' && x.system.source == spell.name && x.system.category == spell.type)
      .map((x) => {
        x.shortName = x.name.split(' - ').length > 1 ? x.name.split(' - ')[1] : x.name;
        x.descr = $(x.system.description.value).text() || '';
        return x;
      });
  }
}

class LiturgyItemDSA5 extends SpellItemDSA5 { }

class CeremonyItemDSA5 extends LiturgyItemDSA5 {
  static getCallbackData(testData, html, actor) {
    super.getCallbackData(testData, html, actor);
    testData.situationalModifiers.push(
      {
        name: game.i18n.localize('CEREMONYMODIFIER.artefact'),
        value: html.find('[name="artefactUsage"]').is(':checked') ? 1 : 0,
      },
      {
        name: game.i18n.localize('place'),
        value: html.find('[name="placeModifier"]').val(),
      },
      {
        name: game.i18n.localize('time'),
        value: html.find('[name="timeModifier"]').val(),
      },
    );
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    super.getSituationalModifiers(situationalModifiers, actor, data, source);

    let timeModifier = 0;
    const traditionItem = actor.items.find(x => x.type == "specialability" && x.name.startsWith(game.i18n.localize('LocalizedIDs.assumeTradition')));
    let assumeTradition = (traditionItem?.name || actor.system.tradition.clerical)?.toLowerCase() || '';

    if (assumeTradition) {
      const components = game.time.calendar.timeToComponents(game.time.worldTime);
      const gameMonth = components.month;
      const monthName = game.time.calendar.constructor.months[gameMonth].toLowerCase();
      const day = components.dayOfMonth;

      const holidays = CONFIG.time.worldCalendarConfig.holidays.values;
      const isHoliday = holidays.some(h => {
        if (h.month !== gameMonth || !h.gods) return false;
        if (!h.gods.some(g => assumeTradition.includes(g.toLowerCase()))) return false;
        return h.dayEnd ? (h.dayStart <= day && h.dayEnd >= day) : (h.dayStart === day);
      });

      if (isHoliday) {
        timeModifier = 2;
      } else if (assumeTradition.includes(monthName)) {
        timeModifier = 1;
      } else if (monthName === 'namenloser') {
        timeModifier = -5;
      }
    }

    mergeObject(data, {
      isCeremony: true,
      locationModifiers: DSA5.ceremonyLocationModifiers,
      timeModifier,
      timeModifiers: DSA5.ceremonyTimeModifiers,
    });
  }
}

class CombatskillDSA5 extends Itemdsa5 {
  static setupDialog(ev, options, item, actor, tokenId) {
    const mode = options.mode;
    const title = item.name + ' ' + game.i18n.localize(mode + 'test');

    const testData = {
      opposable: true,
      source: item,
      mode,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/combatskill-dialog.hbs',
      data: {
        rollMode: options.rollMode,
      },
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = actor._setupCardOptions('systems/dsa5/templates/chat/roll/combatskill-card.hbs', title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class ConsumableItemDSA extends Itemdsa5 {
  static consumablePrice(item) {
    let price = item.system.price.value;
    if (isNaN(price)) {
      const priceTags = price.split(';');
      price = Number(priceTags[item.system.QL - 1]);
      if (isNaN(price)) price = Number(priceTags.pop()) || 0;

      return price;
    } else {
      return Number(price) * item.system.QL || 0;
    }
  }

  static checkEquality(item, item2) {
    return item.type == item2.type && item.name == item2.name && item.system.description.value == item2.system.description.value && item.system.QL == item2.system.QL;
  }

  static async setupDialog(ev, options, item, actor, tokenId) {
    if (!item.isOwned) return;

    const charges = (item.system.quantity.value - 1) * item.system.maxCharges + item.system.charges;
    if (charges <= 0) {
      ui.notifications.error('DSAError.NotEnoughCharges', { localize: true });
      return;
    }

    const newCharges = item.system.charges <= 1 ? item.system.maxCharges : item.system.charges - 1;
    const newQuantity = item.system.charges <= 1 ? item.system.quantity.value - 1 : item.system.quantity.value;

    const effect = DSA5_Utility.replaceDies(item.system.QLList.split('\n')[item.system.QL - 1], false);
    const msg = await renderTemplate('systems/dsa5/templates/chat/consumable-used.hbs', {
      item,
      effect,
      hasAreaTemplate: item.system.target && item.system.target.type in DSA5.areaTargetTypes,
    });
    if (newQuantity == 0) {
      await item.actor.deleteEmbeddedDocuments('Item', [item.id]);
    } else {
      await item.update({
        'system.quantity.value': newQuantity,
        'system.charges': newCharges,
      });
    }

    const chatOptions = DSA5_Utility.chatDataSetup(msg);
    chatOptions['flags.data'] = {
      preData: {
        source: item.toObject(),
        extra: {
          speaker: Itemdsa5.buildSpeaker(actor, tokenId),
        },
      },
      postData: {
        qualityStep: item.system.QL,
      },
    };
    await ChatMessage.create(chatOptions);
    await this._applyActiveEffect(item);
  }

  static async _applyActiveEffect(source) {
    let effects = source.effects.toObject();
    if (effects.length > 0) {
      const { msg, resistRolls, effectNames } = await DSAActiveEffectConfig.applyAdvancedFunction(
        source.actor,
        effects,
        source,
        {
          qualityStep: source.system.QL,
        },
        source.actor,
      );

      const infoMsg = `${game.i18n.format('ActiveEffects.appliedEffect', {
        target: source.actor.token?.name || source.actor.name,
        source: effectNames.join(', '),
      })} ${msg || ''}`;
      ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    }
  }

  static async combineItem(item1, item2, actor, render = true) {
    item1 = duplicate(item1);
    const charges = (item1.system.quantity.value - 1) * item1.system.maxCharges + item1.system.charges;
    const item2charges = (item2.system.quantity.value - 1) * item2.system.maxCharges + item2.system.charges;
    let newQuantity = Math.floor((charges + item2charges) / item1.system.maxCharges) + 1;
    let newCharges = (charges + item2charges) % item1.system.maxCharges;
    if (newCharges == 0) {
      newQuantity -= 1;
      newCharges = item1.system.maxCharges;
    }
    item1.system.quantity.value = newQuantity;
    item1.system.charges = newCharges;
    return await actor.updateEmbeddedDocuments('Item', [item1], { render });
  }
}

class InformationItemDSA5 extends Itemdsa5 { }

class DiseaseItemDSA5 extends Itemdsa5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    source = DSA5_Utility.toObjectIfPossible(source);
    if (game.user.targets.size) {
      game.user.targets.forEach((target) => {
        if (target.actor) situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(target.actor, 'LocalizedIDs.ResistanttoDisease', -1, false, true));
      });
    }
    this.getSkZkModifier(data, source);
    mergeObject(data, {
      hasSKModifier: source.system.resistance.value == 'SK',
      hasZKModifier: source.system.resistance.value == 'ZK',
    });
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    const title = item.name + ' ' + DSA5_Utility.categoryLocalization(item.type) + ' ' + game.i18n.localize('Test');

    const testData = {
      opposable: false,
      source: item,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };

    const data = {
      rollMode: options.rollMode,
    };
    const situationalModifiers = [];
    this.getSituationalModifiers(situationalModifiers, actor, data, item);
    data['situationalModifiers'] = situationalModifiers;

    if (options.manualResistance) {
      mergeObject(data, options.manualResistance);
    }

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/poison-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        testData.situationalModifiers.push(
          {
            name: game.i18n.localize('zkModifier'),
            value: html.find('[name="zkModifier"]').val() || 0,
          },
          {
            name: game.i18n.localize('skModifier'),
            value: html.find('[name="skModifier"]').val() || 0,
          },
        );
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = item._setupCardOptions(`systems/dsa5/templates/chat/roll/${item.type}-card.hbs`, title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class EquipmentItemDSA5 extends Itemdsa5 { }

class WeaponItemDSA5 extends Itemdsa5 {
  static speciesModifier(situationalModifiers, actor, data, source) {
    const creatureClass = actor.type == 'creature' ? actor.system.creatureClass.value : actor.system.details.species.value;
    const localizedSpecies = game.i18n.localize(`LocalizedSpecies.${creatureClass}`);

    const speciesObject = DSA5.speciesCombatModifiers[localizedSpecies];
    if (speciesObject) {
      const attackOrParry = ['attack', 'parry'].includes(data.mode);
      const domains = (getProperty(source, 'system.effect.attributes') || '').split(',').map((x) => game.i18n.localize(`LocalizedSpecies.${x.trim()}`));
      const domainMalus = domains.some((domain) => speciesObject.opposingDomains.has(domain)) ? 1 : 0;

      if (speciesObject.combatskills.has(game.i18n.localize(`LocalizedCTs.${source.system.combatskill.value}`))) {
        if (attackOrParry) {
          situationalModifiers.push({
            name: game.i18n.format('speciesModifier', {
              species: creatureClass,
            }),
            value: -2 - domainMalus,
            selected: true,
            source: `${game.i18n.localize('TYPES.Item.species')} (${creatureClass})`,
          });
        }
        situationalModifiers.push({
          name: `${game.i18n.format('speciesModifier', { species: creatureClass })} ${game.i18n.localize('CHARAbbrev.damage')}`,
          value: -2 - domainMalus,
          type: 'dmg',
          selected: true,
          source: `${game.i18n.localize('TYPES.Item.species')} (${creatureClass})`,
        });
      }
    }
  }

  static weaponModifiers(situationalModifiers, source, mode) {
    for (let effect of source.effects || []) {
      if (!DSAActiveEffect.realyRealyEnabled(effect)) continue;

      for (let change of effect.changes) {
        if (change.key == `self.situational.${mode}`) {
          const type = { damage: 'dmg' }[mode] || '';
          const data = `${change.value}`.split(' ');
          let value;
          const name = [effect.name];
          if (data.length > 1) {
            value = Number(data.pop());
            name.push(data.join(' '));
          } else value = Number(data[0]);

          situationalModifiers.push({
            name: name.join(' - '),
            value,
            source: source.name,
            type,
          });
        }
      }
    }
  }
}

class MeleeweaponDSA5 extends WeaponItemDSA5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    const wrongHandDisabled = AdvantageRulesDSA5.hasVantage(actor, 'LocalizedIDs.ambidextrous');
    source = DSA5_Utility.toObjectIfPossible(source);
    const toSearch = [source.system.combatskill.value];
    const combatSpecAbs = Itemdsa5.buildCombatSpecAbs(actor, ['Combat'], toSearch, data.mode, source);

    if (data.mode == 'attack') {
      this.prepareMeleeAttack(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled);
      this.weaponModifiers(situationalModifiers, source, 'damage');
    } else if (data.mode == 'parry') {
      this.prepareMeleeParry(situationalModifiers, actor, data, source, combatSpecAbs, wrongHandDisabled);
    }
    this.weaponModifiers(situationalModifiers, source, data.mode);

    this.attackStatEffect(situationalModifiers, actor.system.meleeStats[data.mode]);
    this.speciesModifier(situationalModifiers, actor, data, source);

    if (['attack', 'parry'].includes(data.mode)) {
      situationalModifiers.push(
        ...MeleeweaponDSA5.getMiracleModifiers(actor, { name: source.system.combatskill.value }, '', data.mode),
        ...actor.getCombatEffectSkillModifier(source.system.combatskill.value, data.mode),
      );
    }
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    const mode = options.mode;
    const title = `${item.name} ${game.i18n.localize(mode + 'test')}`;

    const testData = {
      opposable: options.mode != 'parry',
      source: item,
      mode,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };
    const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, DSA5_Utility.toObjectIfPossible(item));
    const data = {
      rollMode: options.rollMode,
      mode,
      defenseCountString: game.i18n.format('defenseCount', {
        malus: multipleDefenseValue,
      }),
      multipleDefenseValue,
    };
    const situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : [];
    this.getSituationalModifiers(situationalModifiers, actor, data, item);
    data.situationalModifiers = situationalModifiers;
    if (options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers);

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/combatskill-enhanced-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode);
        Hooks.call('callbackDialogCombatDSA5', testData, actor, html, item, tokenId);
        testData.isRangeDefense = data.isRangeDefense;
        return { testData, cardOptions };
      },
    };

    const cardOptions = actor._setupCardOptions('systems/dsa5/templates/chat/roll/combatskill-card.hbs', title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class PoisonItemDSA5 extends Itemdsa5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    source = DSA5_Utility.toObjectIfPossible(source);
    if (game.user.targets.size) {
      game.user.targets.forEach((target) => {
        if (target.actor) situationalModifiers.push(...AdvantageRulesDSA5.getVantageAsModifier(target.actor, 'LocalizedIDs.poisonResistance', -1, false, true));
      });
    }
    this.getSkZkModifier(data, source);
    mergeObject(data, {
      hasSKModifier: source.system.resistance.value == 'SK',
      hasZKModifier: source.system.resistance.value == 'ZK',
    });
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    const title = item.name + ' ' + DSA5_Utility.categoryLocalization(item.type) + ' ' + game.i18n.localize('Test');

    const testData = {
      opposable: false,
      source: item,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };

    const data = { rollMode: options.rollMode };

    const situationalModifiers = [];
    this.getSituationalModifiers(situationalModifiers, actor, data, item);
    data.situationalModifiers = situationalModifiers;

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/poison-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        testData.situationalModifiers = Actordsa5._parseModifiers(html);

        testData.situationalModifiers.push(
          {
            name: game.i18n.localize('zkModifier'),
            value: html.find('[name="zkModifier"]').val() || 0,
          },
          {
            name: game.i18n.localize('skModifier'),
            value: html.find('[name="skModifier"]').val() || 0,
          },
        );
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = item._setupCardOptions(`systems/dsa5/templates/chat/roll/${item.type}-card.hbs`, title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class RangeweaponItemDSA5 extends WeaponItemDSA5 {
  static getSituationalModifiers(situationalModifiers, actor, data, _source, tokenId) {
    if (data.mode == 'attack') {
      const source = DSA5_Utility.toObjectIfPossible(_source);

      const toSearch = [source.system.combatskill.value];
      const combatSpecAbs = Itemdsa5.buildCombatSpecAbs(actor, ['Combat'], toSearch, data.mode, source);
      let currentAmmo = actor.items.get(source.system.currentAmmo.value);

      if (currentAmmo) {
        currentAmmo = currentAmmo.toObject(false);
        source.system.effect.attributes = (source.system.effect.attributes || '')
          .split(',')
          .concat((currentAmmo.system.effect.attributes || '').split(','))
          .filter((x) => x != '')
          .join(',');
        const poison = getProperty(currentAmmo.flags, 'dsa5.poison');
        if (poison) mergeObject(_source.flags, { dsa5: { poison } });
      }

      this.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatSpecAbs, currentAmmo);

      if (currentAmmo) {
        if (currentAmmo.system.atmod) {
          situationalModifiers.push({
            name: `${currentAmmo.name} - ${game.i18n.localize('atmod')}`,
            value: currentAmmo.system.atmod,
            selected: true,
            specAbId: source.system.currentAmmo.value,
          });
        }
        if (currentAmmo.system.damageMod || currentAmmo.system.armorMod) {
          const dmgMod = {
            name: `${currentAmmo.name} - ${game.i18n.localize('MODS.damage')}`,
            value: currentAmmo.system.damageMod.replace(/wWD/g, 'd') || 0,
            type: 'dmg',
            selected: true,
            specAbId: source.system.currentAmmo.value,
          };
          if (currentAmmo.system.armorMod) dmgMod.armorPen = currentAmmo.system.armorMod;

          situationalModifiers.push(dmgMod);
        }
        if (currentAmmo.effects.length) {
          situationalModifiers.push({
            name: `${currentAmmo.name} - ${game.i18n.localize('TYPES.Item.ammunition')}`,
            value: 1,
            type: 'effect',
            selected: true,
            specAbId: source.system.currentAmmo.value,
          });
        }
      }

      this.weaponModifiers(situationalModifiers, source, 'attack');
      this.weaponModifiers(situationalModifiers, source, 'damage');

      situationalModifiers.push(
        ...RangeweaponItemDSA5.getMiracleModifiers(actor, { name: source.system.combatskill.value }, '', data.mode),
        ...actor.getCombatEffectSkillModifier(source.system.combatskill.value, data.mode),
      );
    }
    this.attackStatEffect(situationalModifiers, actor.system.rangeStats[data.mode]);
    this.speciesModifier(situationalModifiers, actor, data, _source);
  }

  static async checkAmmunitionState(item, testData, actor, mode) {
    let hasAmmo = true;
    if (mode != 'damage') {
      let itemData = item.system;
      if (itemData.ammunitiongroup.value == 'infinite') {
        //Dont count ammo
      } else if (itemData.ammunitiongroup.value == '-') {
        testData.extra.ammo = duplicate(item);
        hasAmmo = testData.extra.ammo.system.quantity.value > 0;
      } else {
        const ammoItem = actor.items.get(itemData.currentAmmo.value);
        if (ammoItem) {
          testData.extra.ammo = ammoItem.toObject();
          if (itemData.ammunitiongroup.value == 'mag') {
            hasAmmo = testData.extra.ammo.system.quantity.value > 1 || (testData.extra.ammo.system.mag.value > 0 && testData.extra.ammo.system.quantity.value > 0);
          } else {
            hasAmmo = testData.extra.ammo.system.quantity.value > 0;
          }
        } else {
          hasAmmo = false;
        }
      }
      if (!hasAmmo && actor.type == 'creature') hasAmmo = true;
    }
    if (!hasAmmo) ui.notifications.error('DSAError.NoAmmo', { localize: true });

    return hasAmmo;
  }

  static async setupDialog(ev, options, item, actor, tokenId) {
    const mode = options.mode;
    const title = item.name + ' ' + game.i18n.localize(mode + 'test');

    const testData = {
      opposable: options.mode != 'parry',
      source: item,
      mode,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };

    if (!(await this.checkAmmunitionState(item, testData, actor, mode))) return;

    const data = {
      rollMode: options.rollMode,
      mode,
    };
    const situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : [];
    this.getSituationalModifiers(situationalModifiers, actor, data, item, tokenId);
    data.situationalModifiers = situationalModifiers;
    if (options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers);

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/combatskill-enhanced-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        DSA5CombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options);
        Hooks.call('callbackDialogCombatDSA5', testData, actor, html, item, tokenId);
        return { testData, cardOptions };
      },
    };

    const cardOptions = actor._setupCardOptions('systems/dsa5/templates/chat/roll/combatskill-card.hbs', title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class RitualItemDSA5 extends SpellItemDSA5 {
  static getCallbackData(testData, html, actor) {
    super.getCallbackData(testData, html, actor);
    testData.situationalModifiers.push(
      {
        name: game.i18n.localize('RITUALMODIFIER.rightClothes'),
        value: html.find('[name="rightClothes"]').is(':checked') ? 1 : 0,
      },
      {
        name: game.i18n.localize('RITUALMODIFIER.rightEquipment'),
        value: html.find('[name="rightEquipment"]').is(':checked') ? 1 : 0,
      },
      {
        name: game.i18n.localize('place'),
        value: html.find('[name="placeModifier"]').val(),
      },
      {
        name: game.i18n.localize('time'),
        value: html.find('[name="timeModifier"]').val(),
      },
    );
  }

  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    super.getSituationalModifiers(situationalModifiers, actor, data, source);

    mergeObject(data, {
      isRitual: true,
      locationModifiers: DSA5.ritualLocationModifiers,
      timeModifier: 0,
      timeModifiers: DSA5.ritualTimeModifiers,
    });
  }
}

class ApplicationItemDSA5 extends Itemdsa5 { }

class SkillItemDSA5 extends Itemdsa5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source) {
    situationalModifiers.push(
      ...ItemRulesDSA5.getTalentBonus(actor, source.name, ['advantage', 'disadvantage', 'specialability', 'equipment']),
      ...actor.getSkillModifier(source.name, source.type),
      ...SkillItemDSA5.getMiracleModifiers(actor, source, 'FW', 'skill'),
    );

    for (const thing of actor.system.skillModifiers.global) {
      situationalModifiers.push({ name: thing.source, value: thing.value });
    }
    Object.assign(data, {
      visionOptions: DSA5.skillVision,
    });
  }

  static prepareFocusRuleModifiers(data, actor, skill) {
    const reverseLookUp = game.i18n.localize(`LocalizedSkills.${skill.name}`);
    const modifierData = game.dsa5.config.SKILL[reverseLookUp];

    if (!modifierData) return;

    data.focusRuleModifiers = modifierData.modifiers;
  }

  static setupDialog(ev, options, skill, actor, tokenId) {
    const title = skill.name + ' ' + game.i18n.localize('Test') + (options.subtitle || '');
    const testData = {
      opposable: true,
      source: skill,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };

    const data = {
      rollMode: options.rollMode,
      difficultyLabels: DSA5.skillDifficultyLabels,
      modifier: options.modifier || 0,
      characteristics: [1, 2, 3].map((x) => skill.system[`characteristic${x}`].value),
      situationalModifiers: actor ? DSA5StatusEffects.getRollModifiers(actor, skill) : [],
    };

    if (options.situationalModifiers) data.situationalModifiers.push(...options.situationalModifiers);
    this.getSituationalModifiers(data.situationalModifiers, actor, data, skill);
    this.prepareFocusRuleModifiers(data, actor, skill);

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/skill-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        cardOptions.rollMode = html.find('[name="rollMode"]:checked').val();
        const form = html[0].tagName == 'FORM' ? html[0] : html.find('form')[0];
        const formData = new foundry.applications.ux.FormDataExtended(form).object;
        testData.testDifficulty = DSA5.skillDifficultyModifiers[html.find('[name="testDifficulty"]').val()];
        testData.situationalModifiers = Actordsa5._parseModifiers(html);
        testData.situationalModifiers.push(
          Itemdsa5.parseValueType(game.i18n.localize('sight'), formData.vision || 0),
        );
        testData.advancedModifiers = {
          chars: [0, 1, 2].map((x) => Number(html.find(`[name="ch${x}"]`).val())),
          fws: Number(html.find(`[name="fw"]`).val()),
          qls: Number(html.find(`[name="qs"]`).val()),
        };
        Itemdsa5.changeChars(testData.source, ...[0, 1, 2].map((x) => html.find(`[name="characteristics${x}"]`).val()));
        mergeObject(testData.extra.options, options);
        return { testData, cardOptions };
      },
    };

    const cardOptions = actor._setupCardOptions('systems/dsa5/templates/chat/roll/skill-card.hbs', title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class SpecialAbilityItemDSA5 extends Itemdsa5 { }

class SpeciesItemDSA5 extends Itemdsa5 { }

class SpellextensionItemDSA5 extends Itemdsa5 { }

class BookItemDSA5 extends Itemdsa5 { }

class TraitItemDSA5 extends WeaponItemDSA5 {
  static getSituationalModifiers(situationalModifiers, actor, data, source, tokenId) {
    source = DSA5_Utility.toObjectIfPossible(source);
    const traitType = source.system.traitType.value;
    const combatSpecialabilities = Itemdsa5.buildCombatSpecAbs(actor, ['Combat', 'animal'], undefined, data.mode, source);

    if (data.mode == 'attack' && traitType == 'meleeAttack') {
      this.prepareMeleeAttack(situationalModifiers, actor, data, source, combatSpecialabilities, false);
      this.weaponModifiers(situationalModifiers, source, 'damage');
    } else if (data.mode == 'attack' && traitType == 'rangeAttack') {
      this.prepareRangeAttack(situationalModifiers, actor, data, source, tokenId, combatSpecialabilities);
      this.weaponModifiers(situationalModifiers, source, 'damage');
    } else if (data.mode == 'parry') {
      this.prepareMeleeParry(situationalModifiers, actor, data, source, combatSpecialabilities, false);
    }
    this.weaponModifiers(situationalModifiers, source, data.mode);
    this.attackStatEffect(situationalModifiers, actor.system[traitType == 'meleeAttack' ? 'meleeStats' : 'rangeStats'][data.mode]);
  }

  static setupDialog(ev, options, item, actor, tokenId) {
    const mode = options.mode;
    const title = item.name + ' ' + game.i18n.localize(mode + 'test');
    const testData = {
      opposable: options.mode != 'parry',
      source: item,
      mode,
      extra: {
        options,
        speaker: Itemdsa5.buildSpeaker(actor, tokenId),
      },
    };
    const multipleDefenseValue = RuleChaos.multipleDefenseValue(actor, item.toObject());
    const data = {
      rollMode: options.rollMode,
      mode,
      defenseCountString: game.i18n.format('defenseCount', {
        malus: multipleDefenseValue,
      }),
      multipleDefenseValue,
    };

    const traitType = item.system.traitType.value;

    const situationalModifiers = actor ? DSA5StatusEffects.getRollModifiers(actor, item, { mode }) : [];
    this.getSituationalModifiers(situationalModifiers, actor, data, item, tokenId);
    data['situationalModifiers'] = situationalModifiers;

    const dialogOptions = {
      title,
      template: 'systems/dsa5/templates/dialog/combatskill-enhanced-dialog.hbs',
      data,
      callback: (html, options = {}) => {
        if (traitType == 'meleeAttack') {
          DSA5CombatDialog.resolveMeleeDialog(testData, cardOptions, html, actor, options, multipleDefenseValue, mode);
        } else {
          DSA5CombatDialog.resolveRangeDialog(testData, cardOptions, html, actor, options);
        }
        testData.isRangeDefense = data.isRangeDefense;
        Hooks.call('callbackDialogCombatDSA5', testData, actor, html, item, tokenId);
        return { testData, cardOptions };
      },
    };

    let cardOptions = actor._setupCardOptions('systems/dsa5/templates/chat/roll/combatskill-card.hbs', title, tokenId);

    return DiceDSA5.setupDialog({ dialogOptions, testData, cardOptions });
  }
}

class VantageItemDSA5 extends Itemdsa5 { }
