import DescriptionTemplate from './templates/description.js';
import OnUseTemplate from './templates/onuse.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import StructureTemplate from './templates/structure.js';
import ArtifactTemplate from './templates/artifact.js';
import CeremonialItemTemplate from './templates/ceremonial-item.js';
import DSA5 from '../../config/config-dsa5.js';
import ScopableStringField from './fields/scopable_stringfield.js';
import ScopableNumberField from './fields/scopable_numberfield.js';
import ScopableBooleanField from './fields/scopable_booleanfield.js';
import DamageFormulaField from './fields/damage_formula_field.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import InformableTemplate from './templates/informable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import RuleChaos from '../../system/rules/rule_chaos.js';
import DSABooleanField from '../fields/dsa_boolean_field.js';
import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

import DSA5SoundEffect from '../../system/helpers/dsa-soundeffect.js';

const { getProperty, setProperty } = foundry.utils;

const { SchemaField, StringField, BooleanField } = foundry.data.fields;

export default class MeleeweaponData extends ItemDataModel.mixin(OnUseTemplate, DescriptionTemplate, ObfuscableTemplate, ArtifactTemplate, CeremonialItemTemplate, EquipmentTemplate, StructureTemplate, InformableTemplate) {
  static THROWABLE_WEAPON_TYPES = new Set(['Daggers', 'Fencing Weapons', 'Impact Weapons', 'Swords', 'Polearms']);
  static NOT_TWO_HANDED_WEAPON_TYPES = new Set(['Daggers', 'Fencing Weapons']);
  static ENHANCEMENT_SLOT_LIMITS = { material: 1, creationTechnique: 1, improvement: 2 };
  static IMPROVISED_WEAPON_PATTERN = /(\(|,)( )?i\)$/;

  static hasImprovisedName(itemOrName) {
    const name = typeof itemOrName === 'string' ? itemOrName : itemOrName?.name;
    return this.IMPROVISED_WEAPON_PATTERN.test(name || '');
  }

  static isImprovisedWeapon(item) {
    if (!item) return false;
    if (item.system?.isNotImprovised) return false;
    return this.hasImprovisedName(item);
  }

  static defineSchema() {
    const guideValues = foundry.utils.duplicate(DSA5.characteristics);
    guideValues['-'] = '-';
    guideValues['ge/kk'] = 'CHAR.GEKK';

    return this.mergeSchema(super.defineSchema(), {
      crit: new ScopableNumberField({ initial: 1, min: 1, max: 19 }),
      botch: new ScopableNumberField({ initial: 20, min: 2, max: 20 }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      damage: new SchemaField({
        value: new DamageFormulaField({ initial: '1d6', label: 'damage' }),
        stp: new ScopableStringField({ initial: '', label: 'stpDamage' }),
      }),
      vehicleRam: new BooleanField({ initial: false, label: 'VEHICLE.vehicleRamWeapon' }),
      atmod: new SchemaField({
        value: new ScopableNumberField({ initial: 0, label: 'atmod' }),
        offhandMod: new ScopableNumberField({ initial: 0 }),
      }),
      pamod: new SchemaField({
        value: new ScopableNumberField({ initial: 0, label: 'pamod' }),
        offhandMod: new ScopableNumberField({ initial: 0 }),
      }),
      reach: new SchemaField({
        value: new ScopableStringField({ initial: 'medium', label: 'reach', required: true, choices: DSA5.meleeRanges }),
        shieldSize: new ScopableStringField({ initial: 'medium', label: 'shieldSize', required: true, choices: DSA5.shieldSizes }),
      }),
      damageThreshold: new SchemaField({
        value: new ScopableNumberField({ initial: 14, label: 'damageThreshold', min: 0 }),
      }),
      guidevalue: new SchemaField({
        value: new ScopableStringField({ initial: '-', label: 'guidevalue', choices: guideValues, required: true }),
      }),
      combatskill: new SchemaField({
        value: new ScopableStringField({ initial: 'daggers', label: 'TYPES.Item.combatskill' }),
      }),
      worn: new SchemaField({
        value: new BooleanField({}),
        offHand: new ScopableBooleanField({ label: 'offHand' }),
        wrongGrip: new ScopableBooleanField(),
      }),
      isNotImprovised: new DSABooleanField({ initial: false, label: 'WEAPON.notImprovised', tooltip: 'WEAPON.notImprovisedHint' }),
      isArtifact: new BooleanField({ initial: false, label: 'SpecCategory.staff' }),
      isCeremonial: new BooleanField({ initial: false, label: 'SpecCategory.ceremonial' }),
      uniq: new DSABooleanField({ initial: false, label: 'WEAPON.uniq', tooltip: 'WEAPON.uniqHint' }),
      preventsBrawlAttackDamage: new DSABooleanField({ initial: false, label: 'BRAWLING.preventsBrawlAttackDamage', tooltip: 'BRAWLING.preventsBrawlAttackDamageHint' }),
      preventsBrawlParryDamage: new DSABooleanField({ initial: false, label: 'BRAWLING.preventsBrawlParryDamage', tooltip: 'BRAWLING.preventsBrawlParryDamageHint' }),
    });
  }

  get isImprovisedWeapon() {
    return this.constructor.isImprovisedWeapon(this.parent);
  }

  get hasImprovisedName() {
    return this.constructor.hasImprovisedName(this.parent);
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (source.reach?.shieldSize && !DSA5.shieldSizes[source.reach.shieldSize]) {
      source.reach.shieldSize = 'medium';
    }
  }

  async getSheetData(data) {
    await super.getSheetData(data);
    data.combatskills = await DSA5_Utility.allCombatSkillsList('melee');
    data.isShield = RuleChaos.isShield(data.document);
    data.showImprovisedToggle = this.hasImprovisedName;
    data.domains = this.prepareDomains();
    data.breakPointRating = this.defaultBreakPointRating;
    foundry.utils.mergeObject(data, this.getGripInfo());
    
    if (!this.actor) return;
      
    const combatSkill = this.actor.items.find((x) => x.type == 'combatskill' && x.name == data.document.system.combatskill.value);
    data.canBeOffHand = combatSkill && !combatSkill.system.weapontype.twoHanded && data.document.system.worn.value;
    data.canBeWrongGrip = !['Daggers', 'Fencing Weapons'].includes(_loc(`LocalizedCTs.${data.document.system.combatskill.value}`));    
  }

  getGripInfo() {
    const twoHanded = RuleChaos.regex2h.test(this.parent.name);
    let wrongGripHint = '';
    if (!twoHanded) {
      wrongGripHint = 'wrongGrip.wieldTwo';
    } else {
      const localizedCT = _loc(`LocalizedCTs.${this.combatskill.value}`);
      switch (localizedCT) {
        case 'Two-Handed Impact Weapons':
        case 'Two-Handed Swords':
          const reg = new RegExp(_loc('wrongGrip.wrongGripBastardRegex'));
          if (reg.test(this.parent.name)) wrongGripHint = 'wrongGrip.wieldOneBastard';
          else wrongGripHint = 'wrongGrip.wieldOneSwordBlunt';

          break;
        default:
          wrongGripHint = 'wrongGrip.wieldOnePolearms';
      }
    }

    return {
      twoHanded,
      wrongGripHint,
      wrongGripLabel: twoHanded ? 'wrongGrip.oneHanded' : 'wrongGrip.twoHanded',
    };
  }

  static chatData(data, name) {
    const res = [
      { key: 'damage', val: data.damage.value },
      { key: 'atmod', val: data.atmod.value },
      { key: 'pamod', val: data.pamod.value },
      { key: 'reach', val: `Range-${data.reach.value}`, localizeVal: true },
      { key: 'TYPES.Item.combatskill', val: data.combatskill.value },
    ];
    if (data.effect.value) res.push({ key: 'effect', val: DSA5_Utility.replaceConditions(data.effect.value) });

    return res;
  }

  prepareEmbeddedItemSheet() {
    const item = super.prepareEmbeddedItemSheet();
    item.toggleValue = item.system.worn.value || false;
    item.toggle = true;
    this.constructor._prepareItemStructure(item);
    item.system.preparedWeight = this.parent.system.preparedWeight;
    this._setOnUseEffect(item);
    return item;
  }

  getContextOptions() {
    const options = [];
    const localizedCT = _loc(`LocalizedCTs.${this.combatskill.value}`);
    if (!MeleeweaponData.NOT_TWO_HANDED_WEAPON_TYPES.has(localizedCT)) {
      options.push({
        label: RuleChaos.isWieldedTwohanded(this.parent) ? `wrongGrip.oneHanded` : `wrongGrip.twoHanded`,
        icon: "<i class='fas fa-comment fa-hand'></i>",
        onClick: () => this.swapNumberWeaponHands(),
      });
    }

    const hasWeaponThrow = MeleeweaponData.THROWABLE_WEAPON_TYPES.has(localizedCT) && SpecialabilityRulesDSA5.hasAbility(this.parent.actor, 'LocalizedIDs.weaponThrow');
    const throwLabel = `${_loc('TYPES.Item.rangeweapon')} ${_loc('CHARAbbrev.AT')} -${hasWeaponThrow ? 4 : 8} ${_loc('CHARAbbrev.RW')} ${DSA5.meleeAsRangeReach[localizedCT]}`;
    options.push(
      {
        label: throwLabel,
        icon: "<i class='fas fa-trowel'></i>",
        onClick: () => this.parent.actor.throwMelee(this.parent, this.parent.actor.token?.id),
      },
      {
        label: this.worn.value ? 'SHEET.UnEquipItem' : 'SHEET.EquipItem',
        icon: "<i class='fas fa-shield-alt fa-fw'></i>",
        onClick: () => this.reEquipItem(),
      },
    );
    return options;
  }

  async swapNumberWeaponHands() {
    if (MeleeweaponData.NOT_TWO_HANDED_WEAPON_TYPES.has(_loc(`LocalizedCTs.${this.combatskill.value}`))) return;
      
    await this.parent.update({ 'system.worn.wrongGrip': !this.worn.wrongGrip });
    this.itemEquippedMessage();
  }

  async reEquipItem() {
    const newValue = !this.worn.value;

    if (this.parent?.actor) {
      await this.parent.actor.equipWeaponToHand(this.parent.id, { hand: 'auto', equip: newValue });
      return;
    }

    await this.parent.update({ 'system.worn.value': newValue });
    this.itemEquippedMessage();
  }

  itemEquippedMessage() {
    DSA5SoundEffect.playEquipmentWearStatusChange(this.parent);
    const wielded = RuleChaos.isWieldedTwohanded(this.parent);
    if (this.parent.actor && game.combat) {
      const texts = [{ value: _loc(wielded ? 'wrongGrip.twoHandedWeapon' : 'wrongGrip.oneHandedWeapon', { weapon: this.parent.name }) }];
      this.parent.actor.tokenScrollingText(texts);
    }
  }

  async _preUpdate(changed, options, user) {
    // If a melee weapon switches into 2H mode, its offHand flag must be cleared.
    // (Offhand is only meaningful for 1H weapons.)
    const wrongGrip = getProperty(changed, 'system.worn.wrongGrip');
    if (typeof wrongGrip === 'boolean') {
      const baseTwoHanded = RuleChaos.regex2h.test(this.parent.name);
      const willBeTwoHanded = (baseTwoHanded && !wrongGrip) || (!baseTwoHanded && wrongGrip);
      if (willBeTwoHanded) setProperty(changed, 'system.worn.offHand', false);
    }

    await super._preUpdate(changed, options, user);
  }
}
