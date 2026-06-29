import ActorSheetdsa5Character from './character-sheet.js';

export default class ActorSheetdsa5NPC extends ActorSheetdsa5Character {
  static DEFAULT_OPTIONS = {
    classes: ['npc-sheet'],
  };

  static PARTS = {
    sheet: super.PARTS.sheet,
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    main: {
      template: 'systems/dsa5/templates/actors/npc/npc-main.hbs',
      scrollable: [''],
    },
    combat: super.PARTS.combat,
    skills: super.PARTS.skills,
    magic: super.PARTS.magic,
    religion: super.PARTS.religion,
    inventory: super.PARTS.inventory,
    companion: super.PARTS.companion,
    status: super.PARTS.status,
    notes: super.PARTS.notes,
  };
}
