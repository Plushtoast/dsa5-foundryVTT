import ActorSheetdsa5Character from './character-sheet.js';

export default class ActorSheetdsa5NPC extends ActorSheetdsa5Character {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'actor', 'npc-sheet'],
  }

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/actors/parts/actor-header.hbs',
    },
    headAttributes: {
      template: 'systems/dsa5/templates/actors/parts/attributes.html',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    main: {
      template: 'systems/dsa5/templates/actors/npc/npc-main.html',
      scrollable: ['']
    },
    combat: {
      template: 'systems/dsa5/templates/actors/actor-combat.html',
      scrollable: ['']
    },
    skills: {
      template: 'systems/dsa5/templates/actors/actor-talents.html',
      scrollable: ['']
    },
    magic: {
      template: 'systems/dsa5/templates/actors/character/actor-magic.html',
      scrollable: ['']
    },
    religion: {
      template: 'systems/dsa5/templates/actors/character/actor-religion.html',
      scrollable: ['']
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/actor-equipment.html',
      scrollable: ['']
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.html',
      scrollable: ['']
    },
    notes: {
      template: 'systems/dsa5/templates/actors/actor-notes.html',
      scrollable: ['']
    }
  }

  static LIMITEDPARTS = {
    all: {
      template: 'systems/dsa5/templates/actors/npc-limited.html',
    }
  }
}
