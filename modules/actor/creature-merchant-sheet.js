import { MerchantSheetMixin } from './mixins/merchantmixin.js';
import ActorSheetdsa5Creature from './creature-sheet.js';
import { merchantCommercePartTemplates } from './template-configs.js';

export default class CreatureMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Creature) {
  static MERCHANTPARTS = {
    merchant: {
      ...super.MERCHANTPARTS.merchant,
      notes: {
        template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
        scrollable: [''],
      },
    },
    loot: super.MERCHANTPARTS.loot,
    epic: {
      ...super.MERCHANTPARTS.epic,
      notes: {
        template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
        scrollable: [''],
      },
    },
  };

  static PARTS = {
    sheet: super.PARTS.sheet,
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
      templates: [...merchantCommercePartTemplates],
    },
    companion: super.PARTS.companion,
    status: super.PARTS.status,
    notes: {
      template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
      scrollable: ['']
    }
  }
}
