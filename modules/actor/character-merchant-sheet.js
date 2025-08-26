import { MerchantSheetMixin } from './mixins/merchantmixin.js';
import ActorSheetdsa5Character from './character-sheet.js';

export default class CharacterMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Character) {
  static PARTS = {
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    main: {
      template: 'systems/dsa5/templates/actors/actor-main.hbs',
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
    notes: super.PARTS.notes,
  }
}
