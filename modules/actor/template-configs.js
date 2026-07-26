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

/** Nested partials for actor-combat.hbs (ApplicationV2 combat PART). */
export const combatPartTemplates = [
  'systems/dsa5/templates/actors/parts/combat_weapon.hbs',
  'systems/dsa5/templates/actors/parts/combat_rangeweapon.hbs',
  'systems/dsa5/templates/actors/parts/horse.hbs',
  'systems/dsa5/templates/actors/parts/swarm.hbs',
  'systems/dsa5/templates/actors/parts/specblock.hbs',
  'systems/dsa5/templates/actors/parts/combatskills.hbs',
];

/** Nested partials for vehicle-combat.hbs. */
export const vehicleCombatPartTemplates = [
  'systems/dsa5/templates/actors/vehicle/vehicle-combat-stats.hbs',
  'systems/dsa5/templates/actors/vehicle/vehicle-combat-boardweapon.hbs',
];

/** Book library intro (renderTemplate in BookWizard.getChapter, not ApplicationV2 root). */
export const bookLibraryPartTemplates = [
  'systems/dsa5/templates/wizard/adventure/parts/book_library_entry_list.hbs',
  'systems/dsa5/templates/wizard/adventure/parts/book_library_entry_card.hbs',
  'systems/dsa5/templates/wizard/adventure/parts/book_library_section_list.hbs',
  'systems/dsa5/templates/wizard/adventure/parts/book_library_section_cards.hbs',
];
