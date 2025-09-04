import { MerchantSheetMixin } from './mixins/merchantmixin.js';
import ActorSheetdsa5Creature from './creature-sheet.js';

export default class CreatureMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Creature) {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/actors/actorv2/creature-header.hbs',
      templates: ['systems/dsa5/templates/actors/actorv2/avatar.hbs', 'systems/dsa5/templates/actors/parts/attributes.hbs', 'systems/dsa5/templates/actors/creature/creature-header.hbs'],
    },
    tabs: super.PARTS.tabs,
    main: {
      template: 'systems/dsa5/templates/actors/creature/creature-main.hbs',
      scrollable: ['']
    },
    combat: super.PARTS.combat,
    skills: super.PARTS.skills,
    magic: super.PARTS.magic,
    religion: super.PARTS.religion,
    inventory: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/gearSearchV2.hbs']
    },
    status: super.PARTS.status,
    notes: {
      template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
      scrollable: ['']
    }
  }
}
