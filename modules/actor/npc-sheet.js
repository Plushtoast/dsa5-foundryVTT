import ActorSheetdsa5Character from './character-sheet.js';

export default class ActorSheetdsa5NPC extends ActorSheetdsa5Character {
  static DEFAULT_OPTIONS = {
    classes: ['npc-sheet'],
  };

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/actors/actorv2/header.hbs',
      templates: ['systems/dsa5/templates/actors/actorv2/avatar.hbs', 'systems/dsa5/templates/actors/parts/attributes.hbs', 'systems/dsa5/templates/actors/parts/actor-header.hbs'],
    },
    tabs: {
      template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs'      
    },
    main: {
      template: 'systems/dsa5/templates/actors/npc/npc-main.hbs',
      scrollable: [''],
    },
    combat: {
      template: 'systems/dsa5/templates/actors/actor-combat.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/combatskills.hbs'],
    },
    skills: {
      template: 'systems/dsa5/templates/actors/actor-talents.hbs',
      templates: ['systems/dsa5/templates/actors/character/actor-aggregatedtests.hbs'],
      scrollable: [''],
    },
    magic: {
      template: 'systems/dsa5/templates/actors/character/actor-magic.hbs',
      templates: ['systems/dsa5/templates/actors/parts/spells.hbs', 'systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/magicalSigns.hbs'],
      scrollable: [''],
    },
    religion: {
      template: 'systems/dsa5/templates/actors/character/actor-religion.hbs',
      templates: ['systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/liturgies.hbs'],
      scrollable: [''],
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/actor-equipment.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/gearSearch.hbs'],
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.hbs',
      scrollable: [''],
    },
    notes: {
      template: 'systems/dsa5/templates/actors/actor-notes.hbs',
      scrollable: [''],
    },
  };
}
