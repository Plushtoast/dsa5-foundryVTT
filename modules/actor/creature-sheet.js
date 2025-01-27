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
      template: 'systems/dsa5/templates/actors/parts/attributes.html',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    main: {
      template: 'systems/dsa5/templates/actors/creature/creature-main.html',
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
      template: 'systems/dsa5/templates/actors/creature/creature-magic.html',
      scrollable: ['.scrollable']
    },
    religion: {
      template: 'systems/dsa5/templates/actors/creature/creature-religion.html',
      scrollable: ['.scrollable']
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/creature/creature-loot.html',
      scrollable: ['.scrollable']
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.html',
      scrollable: ['.scrollable']
    },
    notes: {
      template: 'systems/dsa5/templates/actors/creature/creature-notes.html',
      scrollable: ['.scrollable']
    }
  }

  static LIMITEDPARTS = {
    all: {
      template: 'systems/dsa5/templates/actors/creature-limited.html',
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
