import { MerchantSheetMixin } from './merchantmixin.js';
import ActorSheetdsa5Creature from './creature-sheet.js';

export default class CreatureMerchantSheetDSA5 extends MerchantSheetMixin(ActorSheetdsa5Creature) {
  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/actors/actorv2/creature-header.hbs',
      templates: ['systems/dsa5/templates/actors/actorv2/avatar.hbs', 'systems/dsa5/templates/actors/parts/attributes.hbs', 'systems/dsa5/templates/actors/parts/actor-header.hbs'],
    },
    tabs: {
      template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
      id: "tabs",
      classes: ["tabs", "right"],    
    },
    main: {
      template: 'systems/dsa5/templates/actors/creature/creature-main.hbs',
      scrollable: ['']
    },
    combat: {
      template: 'systems/dsa5/templates/actors/actor-combat.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/combatskills.hbs']
    },
    skills: {
      template: 'systems/dsa5/templates/actors/actor-talents.hbs',
      templates: ['systems/dsa5/templates/actors/character/actor-aggregatedtests.hbs'],
      scrollable: ['']
    },
    magic: {
      template: 'systems/dsa5/templates/actors/creature/creature-magic.hbs',
      templates: ['systems/dsa5/templates/actors/parts/spells.hbs', 'systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/magicalSigns.hbs'],
      scrollable: ['']
    },
    religion: {
      template: 'systems/dsa5/templates/actors/creature/creature-religion.hbs',
      templates: ['systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/liturgies.hbs'],
      scrollable: ['']
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/merchant/merchant-commerce.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/gearSearchV2.hbs']
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.hbs',
      scrollable: ['']
    },
    notes: {
      template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
      scrollable: ['']
    }
  }
}
