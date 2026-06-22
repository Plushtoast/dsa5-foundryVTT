import SpecialabilityRulesDSA5 from '../../system/rules/specialability-rules-dsa5.js';

const SPECIAL_ABILITY_STATS = ['AsP', 'KaP'];

export class RegenerationModifiers {
  static get(actor) {
    const modifiers = [];
    const attrs = ['LeP', 'KaP', 'AsP'];

    for (const attr of attrs) {
      const mods = actor.system.status.regeneration[`${attr}Conditional`];
      modifiers.push(...mods.map((f) => ({
        name: f.target || f.source,
        value: f.value,
        source: f.source,
        type: attr,
      })));
    }

    return modifiers;
  }

  static getSpecialAbilityLocalizedIdKey(stat) {
    return _loc(`REGENERATIONSKILLS.${stat}`);
  }

  static hasSpecialAbility(actor, stat) {
    const localizedIdKey = this.getSpecialAbilityLocalizedIdKey(stat);
    if (!localizedIdKey || localizedIdKey === `REGENERATIONSKILLS.${stat}`) return false;
    return SpecialabilityRulesDSA5.hasAbility(actor, `LocalizedIDs.${localizedIdKey}`);
  }

  static isSpecialAbilityAvailable(actor, stat) {
    if (stat === 'AsP' && !actor.system.isMage) return false;
    if (stat === 'KaP' && !actor.system.isPriest) return false;
    return this.hasSpecialAbility(actor, stat);
  }

  static getSpecialAbilityOption(actor, stat) {
    if (!this.isSpecialAbilityAvailable(actor, stat)) return null;

    const localizedIdKey = this.getSpecialAbilityLocalizedIdKey(stat);
    return {
      stat,
      name: localizedIdKey,
      labelKey: `LocalizedIDs.${localizedIdKey}`,
      tooltipKey: `TT.${localizedIdKey}`,
    };
  }

  static getSpecialAbilityOptions(actor) {
    return Object.fromEntries(
      SPECIAL_ABILITY_STATS.map((stat) => [stat, this.getSpecialAbilityOption(actor, stat)]),
    );
  }

  static isSpecialAbilityEnabled(testData, actor, stat) {
    const name = this.getSpecialAbilityLocalizedIdKey(stat);
    return !!testData[name] && this.hasSpecialAbility(actor, stat);
  }

  static getFixedDieValue(faces) {
    return faces === 6 ? 4 : Math.ceil((faces + 1) / 2);
  }

  static collectSpecialAbilityChoices(html) {
    const values = {};
    for (const stat of SPECIAL_ABILITY_STATS) {
      const name = this.getSpecialAbilityLocalizedIdKey(stat);
      values[name] = html.find(`[name="${name}"]`).is(':checked');
    }
    return values;
  }
}
