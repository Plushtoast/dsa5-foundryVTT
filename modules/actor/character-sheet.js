import ActorSheetDsa5 from './actor-sheet.js';
import CultureWizard from '../wizards/culture_wizard.js';
import CareerWizard from '../wizards/career_wizard.js';
import SpeciesWizard from '../wizards/species_wizard.js';

export default class ActorSheetdsa5Character extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    position: {
      width: 784,
    },
    classes: ['dsa5', 'actor', 'character-sheet'],
  };

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
      template: 'systems/dsa5/templates/actors/actor-equipment.html',
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

  static LIMITEDPARTS = {
    all: {
      template: 'systems/dsa5/templates/actors/npc-limited.html',
    }
  }

  async _manageDragItems(item, typeClass) {
    switch (typeClass) {
      case 'aggregatedTest':
        await this.actor.createEmbeddedDocuments('Item', [item]);
        break;
      case 'species':
        const spwizard = new SpeciesWizard();
        await spwizard.addSpecies(this.actor, item);
        spwizard.render(true);
        break;
      case 'culture':
        const cuwizard = new CultureWizard();
        await cuwizard.addCulture(this.actor, item);
        cuwizard.render(true);
        break;
      case 'career':
        const cwizard = new CareerWizard();
        await cwizard.addCareer(this.actor, item);
        cwizard.render(true);
        break;
      default:
        return super._manageDragItems(item, typeClass);
    }
  }
}
