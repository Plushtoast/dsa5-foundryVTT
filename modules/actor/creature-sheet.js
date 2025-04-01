import ActorSheetDsa5 from './actor-sheet.js';
import TraitRulesDSA5 from '../system/trait-rules-dsa5.js';
import APTracker from '../system/ap-tracker.js';

export default class ActorSheetdsa5Creature extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'actor', 'creature-sheet'],
  };

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/actors/creature/creature-header.hbs',
    },
    headAttributes: {
      template: 'systems/dsa5/templates/actors/parts/attributes.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
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
      template: 'systems/dsa5/templates/actors/creature/creature-loot.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/parts/gearSearch.hbs']
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

  static LIMITEDPARTS = {
    limited: {
      template: 'systems/dsa5/templates/actors/limited/creature-limited.hbs',
    }
  }

  static propertiesToEnrich = [
    { key: 'enrichedDescription', path: 'description.value' },
    { key: 'enrichedBehaviour', path: 'behaviour.value' },
    { key: 'enrichedFlight', path: 'flight.value' },
    { key: 'enrichedSpecialrules', path: 'specialRules.value' },
  ];

  async _cleverDeleteItem(itemId) {
    const item = this.actor.items.get(itemId);
    switch (item.type) {
      case 'trait':
        const xpCost = item.system.APValue.value * -1;
        await this._updateAPs(xpCost, {}, { render: false });
        await APTracker.track(this.actor, { type: 'item', item, state: -1 }, xpCost);
        break;
    }
    await super._cleverDeleteItem(itemId);
  }

  async _addTrait(item) {
    let res = this.actor.items.find((i) => i.type == 'trait' && i.name == item.name);
    if (!res) {
      await this._updateAPs(item.system.APValue.value, {}, { render: false });
      await TraitRulesDSA5.traitAdded(this.actor, item);
      const createdItem = (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
      await APTracker.track(this.actor, { type: 'item', item: createdItem, state: 1 }, item.system.APValue.value);
    }
  }

  async _onDropItemCreate(itemData) {
    if (itemData.type == 'trait') return this._addTrait(itemData);

    return super._onDropItemCreate(itemData);
  }
}
