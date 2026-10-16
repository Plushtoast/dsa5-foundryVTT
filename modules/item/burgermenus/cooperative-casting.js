import { RollDialogBurgerMenuRule } from './base-burger-menu-rule.js';
import CooperativeCasting from '../../system/rolls/cooperative-casting.js';

class CooperativeCastBurgerMenu extends RollDialogBurgerMenuRule {
  constructor({ mode, labelKey, icon }) {
    super();
    this.mode = mode;
    this.labelKey = labelKey;
    this.icon = icon;
  }

  matches(dialogState) {
    const { actor, source } = dialogState || {};
    if (this.mode === CooperativeCasting.MODES.SPELL_BUNDLING) return CooperativeCasting.matchesSpellBundling(source, actor);
    if (this.mode === CooperativeCasting.MODES.LITURGY_UNITING) return CooperativeCasting.matchesLiturgyUniting(source, actor);
    if (this.mode === CooperativeCasting.MODES.TRANSMUTATION) return CooperativeCasting.matchesTransmutation(source, actor);
    return false;
  }

  getBurgerMenuItems(dialogState) {
    return [
      {
        label: _loc(this.labelKey),
        icon: this.icon,
        onClick: async () => CooperativeCasting.startFromRollDialog(dialogState, this.mode),
      },
    ];
  }
}

const COOPERATIVE_CAST_MENUS = [
  new CooperativeCastBurgerMenu({
    mode: CooperativeCasting.MODES.SPELL_BUNDLING,
    labelKey: 'COOPCAST.spellBundling',
    icon: '<i class="fas fa-link"></i>',
  }),
  new CooperativeCastBurgerMenu({
    mode: CooperativeCasting.MODES.LITURGY_UNITING,
    labelKey: 'COOPCAST.liturgyUniting',
    icon: '<i class="fas fa-hands-praying"></i>',
  }),
  new CooperativeCastBurgerMenu({
    mode: CooperativeCasting.MODES.TRANSMUTATION,
    labelKey: 'COOPCAST.transmutation',
    icon: '<i class="fas fa-dna"></i>',
  }),
];

export function registerCooperativeCastingHooks() {
  Hooks.on('dsa5.getRollDialogContextOptions', (dialogState, menuItems) => {
    for (const menu of COOPERATIVE_CAST_MENUS) {
      if (!menu.matches(dialogState)) continue;
      menuItems.push(...menu.getBurgerMenuItems(dialogState));
    }
  });
}
