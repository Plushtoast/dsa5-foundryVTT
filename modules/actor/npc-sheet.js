import ActorSheetdsa5Character from './character-sheet.js';
const { mergeObject } = foundry.utils;

export default class ActorSheetdsa5NPC extends ActorSheetdsa5Character {
  static get defaultOptions() {
    const options = super.defaultOptions;
    mergeObject(options, {
      classes: options.classes.concat(['dsa5', 'actor', 'npc-sheet']),
    });
    return options;
  }

  get template() {
    if (this.showLimited()) return 'systems/dsa5/templates/actors/npc-limited.html';
    return 'systems/dsa5/templates/actors/npc-sheet.html';
  }
}
