import { MerchantSheetMixin } from './mixins/merchantmixin.js';
import ActorSheetdsa5Vehicle from './vehicle-sheet.js';
import { merchantCommercePartTemplates } from './template-configs.js';

export default class VehicleMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Vehicle) {
  static MERCHANTPARTS = {
    merchant: {
      ...super.MERCHANTPARTS.merchant,
      notes: {
        template: 'systems/dsa5/templates/actors/vehicle/vehicle-notes.hbs',
        scrollable: [''],
      },
    },
    loot: super.MERCHANTPARTS.loot,
    epic: {
      ...super.MERCHANTPARTS.epic,
      notes: {
        template: 'systems/dsa5/templates/actors/vehicle/vehicle-notes.hbs',
        scrollable: [''],
      },
    },
  };

  static PARTS = {
    sheet: super.PARTS.sheet,
    header: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-header.hbs',
      templates: ['systems/dsa5/templates/actors/actorv2/avatar.hbs', 'systems/dsa5/templates/actors/vehicle/vehicle-header-part.hbs', 'systems/dsa5/templates/actors/parts/vehicle-healthbar.hbs'],
    },
    tabs: super.PARTS.tabs,
    combat: ActorSheetdsa5Vehicle.PARTS.combat,
    crew: ActorSheetdsa5Vehicle.PARTS.crew,
    inventory: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.hbs',
      scrollable: [''],
      templates: [...merchantCommercePartTemplates],
    },
    status: super.PARTS.status,
    notes: {
      template: 'systems/dsa5/templates/actors/vehicle/vehicle-notes.hbs',
      scrollable: [''],
    },
  };
}
