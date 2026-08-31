import ActorSheetDsa5 from './actor-sheet.js';
import { gearSearchPartTemplates } from './template-configs.js';
import CultureWizard from '../wizards/culture_wizard.js';
import CareerWizard from '../wizards/career_wizard.js';
import SpeciesWizard from '../wizards/species_wizard.js';

export default class ActorSheetdsa5Character extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    position: {
      width: 784,
    },
    classes: ['character-sheet'],
    actions: {
      characterCalculator: this._openCharacterCalculator,
    },
    window: {
      controls: [
        {
          action: 'characterCalculator',
          label: 'HELP.charApp',
          icon: 'fas fa-calculator',
          visible: function () {
            return this.actor.type === 'character' && !!game.dsa5.apps?.DSACharacterCalculator;
          },
        },
      ],
    },
  };

  static _openCharacterCalculator() {
    const Calculator = game.dsa5.apps?.DSACharacterCalculator;
    if (!Calculator) return;

    const dialogId = `dsa-character-calculator-${this.actor.id}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return;
    }

    const cc = new Calculator({ id: dialogId });
    cc.actor = this.actor;
    cc.trackedId = this.actor.id;
    cc.render(true);
  }

  static PARTS = {
    sheet: super.PARTS.sheet,
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
      template: 'systems/dsa5/templates/actors/actor-equipment.hbs',
      scrollable: [''],
      templates: [...gearSearchPartTemplates],
    },
    companion: super.PARTS.companion,
    status: super.PARTS.status,
    notes: super.PARTS.notes,
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
