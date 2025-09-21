import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import EquipmentTemplate from './templates/equipment.js';
import StructureTemplate from './templates/structure.js';
import ArtifactTemplate from './templates/artifact.js';
import DSA5 from '../../config/config-dsa5.js';
import ScopableStringField from './fields/scopable_stringfield.js';
import ScopableNumberField from './fields/scopable_numberfield.js';
import ScopableBooleanField from './fields/scopable_booleanfield.js';
import ObfuscableTemplate from './templates/obfuscable.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';
import RuleChaos from '../../system/rules/rule_chaos.js';
import DSABooleanField from '../fields/dsa_boolean_field.js';
import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

const { SchemaField, StringField, BooleanField } = foundry.data.fields;

export default class MeleeweaponData extends ItemDataModel.mixin(DescriptionTemplate, ObfuscableTemplate, ArtifactTemplate, EquipmentTemplate, StructureTemplate) {
  static THROWABLE_WEAPON_TYPES = new Set(['Daggers', 'Fencing Weapons', 'Impact Weapons', 'Swords', 'Polearms']);
  static NOT_TWO_HANDED_WEAPON_TYPES = new Set(['Daggers', 'Fencing Weapons']);

  static defineSchema() {
    const guideValues = foundry.utils.duplicate(DSA5.characteristics);
    guideValues['-'] = '-';
    guideValues['ge/kk'] = 'CHAR.GEKK';

    return this.mergeSchema(super.defineSchema(), {
      crit: new ScopableNumberField({ initial: 1, min: 1, max: 19 }),
      botch: new ScopableNumberField({ initial: 20, min: 2, max: 20 }),
      region: new StringField({ initial: '', label: 'PLANT.region' }),
      damage: new SchemaField({
        value: new ScopableStringField({ initial: '1d6', label: 'damage' }),
      }),
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
      isArtifact: new BooleanField({ initial: false, label: 'SpecCategory.staff' }),
      preventsBrawlAttackDamage: new DSABooleanField({ initial: false, label: 'BRAWLING.preventsBrawlAttackDamage', tooltip: 'BRAWLING.preventsBrawlAttackDamageHint' }),
      preventsBrawlParryDamage: new DSABooleanField({ initial: false, label: 'BRAWLING.preventsBrawlParryDamage', tooltip: 'BRAWLING.preventsBrawlParryDamageHint' }),
    });
  }

  static _migrateData(source) {
    super._migrateData(source);

    if (source.reach?.shieldSize && !DSA5.shieldSizes[source.reach.shieldSize]) {
      source.reach.shieldSize = 'medium';
    }
  }

  async getSheetData(data) {
    data.combatskills = await DSA5_Utility.allCombatSkillsList('melee');
    data.isShield = RuleChaos.isShield(data.document);
    data.domains = this.prepareDomains();
    data.breakPointRating = DSA5.weaponStabilities[game.i18n.localize(`LocalizedCTs.${data.document.system.combatskill.value}`)];
    foundry.utils.mergeObject(data, this.getGripInfo());
    if (this.actor) {
      const combatSkill = this.actor.items.find((x) => x.type == 'combatskill' && x.name == data.document.system.combatskill.value);
      data.canBeOffHand = combatSkill && !combatSkill.system.weapontype.twoHanded && data.document.system.worn.value;
      data.canBeWrongGrip = !['Daggers', 'Fencing Weapons'].includes(game.i18n.localize(`LocalizedCTs.${data.document.system.combatskill.value}`));
    }
  }

  getGripInfo() {
    const twoHanded = RuleChaos.regex2h.test(this.parent.name);
    let wrongGripHint = '';
    if (!twoHanded) {
      wrongGripHint = 'wrongGrip.yieldTwo';
    } else {
      const localizedCT = game.i18n.localize(`LocalizedCTs.${this.combatskill.value}`);
      switch (localizedCT) {
        case 'Two-Handed Impact Weapons':
        case 'Two-Handed Swords':
          const reg = new RegExp(game.i18n.localize('wrongGrip.wrongGripBastardRegex'));
          if (reg.test(this.parent.name)) wrongGripHint = 'wrongGrip.yieldOneBastard';
          else wrongGripHint = 'wrongGrip.yieldOneSwordBlunt';

          break;
        default:
          wrongGripHint = 'wrongGrip.yieldOnePolearms';
      }
    }

    return {
      twoHanded,
      wrongGripHint,
      wrongGripLabel: twoHanded ? 'wrongGrip.oneHanded' : 'wrongGrip.twoHanded',
    };
  }

  static chatData(data, name) {
    let res = [
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
    const localizedCT = game.i18n.localize(`LocalizedCTs.${this.combatskill.value}`);
    if (!MeleeweaponData.NOT_TWO_HANDED_WEAPON_TYPES.has(localizedCT)) {
      options.push({
        name: RuleChaos.isYieldedTwohanded(this.parent) ? `wrongGrip.oneHanded` : `wrongGrip.twoHanded`,
        icon: "<i class='fas fa-comment fa-hand'></i>",
        callback: () => this.swapNumberWeaponHands(),
      });
    }

    const hasWeaponThrow = MeleeweaponData.THROWABLE_WEAPON_TYPES.has(localizedCT) && SpecialabilityRulesDSA5.hasAbility(this.parent.actor, 'LocalizedIDs.weaponThrow');
    const throwLabel = `${game.i18n.localize('TYPES.Item.rangeweapon')} ${game.i18n.localize('CHARAbbrev.AT')} -${hasWeaponThrow ? 4 : 8} ${game.i18n.localize('CHARAbbrev.RW')} ${DSA5.meleeAsRangeReach[localizedCT]}`;
    options.push(
      {
        name: throwLabel,
        icon: "<i class='fas fa-trowel'></i>",
        callback: () => this.parent.actor.throwMelee(this.parent, this.parent.actor.token?.id),
      },
      {
        name: this.worn.value ? 'SHEET.UnEquipItem' : 'SHEET.EquipItem',
        icon: "<i class='fas fa-shield-alt fa-fw'></i>",
        callback: () => this.parent.update({ 'system.worn.value': !this.worn.value }),
      },
    );
    return options;
  }

  async swapNumberWeaponHands() {
    if (!MeleeweaponData.NOT_TWO_HANDED_WEAPON_TYPES.has(game.i18n.localize(`LocalizedCTs.${this.combatskill.value}`))) {
      await this.parent.update({ 'system.worn.wrongGrip': !this.worn.wrongGrip });
    }
  }
}
