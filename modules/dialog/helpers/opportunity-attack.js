export default class OpportunityAttackHelper {
  static rollModifiers = {
    opportunityAttack: { mod: -4 },
  };

  static setDisplayedModifier(rollModifiers, targets = game.user.targets) {
    if (!rollModifiers.opportunityAttack) return;

    const baseModifier = Number(rollModifiers.opportunityAttack.mod) || 0;
    const targetModifier = this.#targetModifiers(targets).reduce((total, modifier) => total + modifier.value, 0);
    rollModifiers.opportunityAttack.displayMod = baseModifier + targetModifier;
  }

  static addSituationalModifiers(situationalModifiers, formData, targets = game.user.targets) {
    const value = Number(formData.opportunityAttack) || 0;
    if (value) {
      situationalModifiers.push({
        name: _loc('MODS.opportunityAttack'),
        value,
      });
      situationalModifiers.push(...this.#targetModifiers(targets));
    }

    return value !== 0;
  }

  static canUseSpecialAbility(html, renderData, subcategory, combatSkillTypes) {
    if (html.find('.opportunityAttack').is(':checked')) {
      ui.notifications.error('DSAError.opposedAttackNoSpecAbs', { localize: true });
      return false;
    }

    const opportunityAttackManeuvers = renderData.opportunityAttackManeuvers;
    if (!opportunityAttackManeuvers) return true;

    const allowBasic = opportunityAttackManeuvers.allowBasic === true;
    const allowSpecial = opportunityAttackManeuvers.allowSpecial === true;
    const basicCategories = [combatSkillTypes.BASEMANEUVER, combatSkillTypes.COMBATSTYLE_EXTENDED_BASE];
    const specialCategories = [combatSkillTypes.SPECIALMANEUVER, combatSkillTypes.COMBATSTYLE_EXTENDED];

    if (basicCategories.includes(subcategory) && (allowBasic || allowSpecial)) return true;
    if (specialCategories.includes(subcategory) && allowSpecial) return true;
    if (!basicCategories.includes(subcategory) && !specialCategories.includes(subcategory)) return true;

    ui.notifications.error('DSAError.opposedAttackNoSpecAbs', { localize: true });
    return false;
  }

  static activateListeners(html) {
    html.find('.opportunityAttack').on('change', (ev) => {
      if ($(ev.currentTarget).is(':checked')) {
        for (const maneuver of html.find('.specAbs')) {
          $(maneuver).removeClass('active').attr('data-step', 0).find('.step').text('');
        }
      }
    });
  }

  static #targetModifiers(targets) {
    const enemySense = _loc('LocalizedIDs.enemySense');
    const winhallStyle = _loc('LocalizedIDs.winhallStyle');
    const modifiers = [];

    for (const target of targets) {
      for (const item of target.actor?.items || []) {
        if (item.type !== 'specialability') continue;

        if (item.name === enemySense) {
          modifiers.push({ name: enemySense, value: -4 });
        } else if (item.name === winhallStyle) {
          modifiers.push({ name: winhallStyle, value: -2 });
        }
      }
    }

    return modifiers;
  }
}
