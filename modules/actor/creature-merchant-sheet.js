import { MerchantSheetMixin } from './merchantmixin.js';
import ActorSheetdsa5Creature from './creature-sheet.js';

export default class CreatureMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Creature) {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/actors/creature/creature-header.hbs',
    },
    headAttributes: {
      template: 'systems/dsa5/templates/actors/parts/attributes.html',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    main: {
      template: 'systems/dsa5/templates/actors/creature/creature-main.html',
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
      template: 'systems/dsa5/templates/actors/creature/creature-magic.html',
      scrollable: ['']
    },
    religion: {
      template: 'systems/dsa5/templates/actors/creature/creature-religion.html',
      scrollable: ['']
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.html',
      scrollable: ['']
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.html',
      scrollable: ['']
    },
    notes: {
      template: 'systems/dsa5/templates/creature/creature-notes.html',
      scrollable: ['']
    }
  }
}
