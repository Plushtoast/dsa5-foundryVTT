/**
 * Handlebars partial chains for ApplicationV2 PARTS.templates.
 * Each export lists a root partial and every nested {{> ...}} it pulls in.
 * Do not register these in init.js loadTemplates when loaded via PARTS.
 */
export const gearSearchPartTemplates = [
  'systems/dsa5/templates/actors/parts/gearSearchV2.hbs',
  'systems/dsa5/templates/actors/parts/carryandpurse.hbs',
  'systems/dsa5/templates/actors/parts/actor-effect-config-attrs.hbs',
  'systems/dsa5/templates/actors/parts/purse.hbs',
];

export const merchantStallPartTemplates = [
  'systems/dsa5/templates/actors/merchant/parts/shop-tile.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-filters.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-purse.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-buyer.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-viewers.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-banner.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-sell-drawer.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-list.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-trade-log.hbs',
  'systems/dsa5/templates/actors/merchant/parts/shop-presentation-body.hbs',
];

export const merchantCommercePartTemplates = [
  ...gearSearchPartTemplates,
  'systems/dsa5/templates/system/dsatabs.hbs',
  'systems/dsa5/templates/system/parts/icon-range.hbs',
  'systems/dsa5/templates/actors/parts/containerContent.hbs',
  'systems/dsa5/templates/actors/merchant/merchant-permission-part.hbs',
  'systems/dsa5/templates/actors/merchant/merchant-stock.hbs',
  'systems/dsa5/templates/actors/merchant/merchant-shop-config.hbs',
  'systems/dsa5/templates/actors/merchant/merchant-access.hbs',
];

/** Nested partials for actor-combat.hbs (ApplicationV2 combat PART). */
export const combatPartTemplates = [
  'systems/dsa5/templates/actors/parts/combat_weapon.hbs',
  'systems/dsa5/templates/actors/parts/combat_rangeweapon.hbs',
  'systems/dsa5/templates/actors/parts/combat_ammo_button.hbs',
  'systems/dsa5/templates/actors/parts/combat_ammo_menu.hbs',
  'systems/dsa5/templates/actors/parts/horse.hbs',
  'systems/dsa5/templates/actors/parts/swarm.hbs',
  'systems/dsa5/templates/actors/parts/specblock.hbs',
  'systems/dsa5/templates/actors/parts/combatskills.hbs',
];

/** Nested partials for vehicle-combat.hbs. */
export const vehicleCombatPartTemplates = [
  'systems/dsa5/templates/actors/vehicle/vehicle-combat-stats.hbs',
  'systems/dsa5/templates/actors/vehicle/vehicle-combat-boardweapon.hbs',
  'systems/dsa5/templates/actors/parts/combat_ammo_button.hbs',
  'systems/dsa5/templates/actors/parts/combat_ammo_menu.hbs',
  'systems/dsa5/templates/actors/vehicle/vehicle-combat-ram.hbs',
  'systems/dsa5/templates/actors/vehicle/vehicle-locomotion-skills.hbs',
  'systems/dsa5/templates/actors/parts/skillselect.hbs',
];

/** Book library intro (renderTemplate in BookWizard.getChapter, not ApplicationV2 root). */
export const bookLibraryPartTemplates = [
  'systems/dsa5/templates/wizard/adventure/parts/book_library_entry_list.hbs',
  'systems/dsa5/templates/wizard/adventure/parts/book_library_entry_card.hbs',
  'systems/dsa5/templates/wizard/adventure/parts/book_library_section_list.hbs',
  'systems/dsa5/templates/wizard/adventure/parts/book_library_section_cards.hbs',
];
