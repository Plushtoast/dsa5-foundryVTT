import { MerchantSheetMixin } from './merchantmixin.js';
import ActorSheetdsa5Character from './character-sheet.js';

export default class CharacterMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Character) {
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
      template: 'systems/dsa5/templates/actors/actor-main.html',
      scrollable: ['.scrollable']
    },
    combat: {
      template: 'systems/dsa5/templates/actors/actor-combat.html',
      scrollable: ['.scrollable']
    },
    skills: {
      template: 'systems/dsa5/templates/actors/actor-talents.html',
      scrollable: ['.scrollable']
    },
    magic: {
      template: 'systems/dsa5/templates/actors/character/actor-magic.html',
      scrollable: ['.scrollable']
    },
    religion: {
      template: 'systems/dsa5/templates/actors/character/actor-religion.html',
      scrollable: ['.scrollable']
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.html',
      scrollable: ['.scrollable']
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.html',
      scrollable: ['.scrollable']
    },
    notes: {
      template: 'systems/dsa5/templates/actors/actor-notes.html',
      scrollable: ['.scrollable']
    }
  }
}
