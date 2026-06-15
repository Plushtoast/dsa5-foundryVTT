import ActorSheetDsa5 from './actor-sheet.js';
import TraitRulesDSA5 from '../system/rules/trait-rules-dsa5.js';
import APTracker from '../system/orwell/ap-tracker.js';
import CreatureType from '../system/automation/creature-type.js';
import CompanionHandler from './companions/companion-handler-class.js';

export default class ActorSheetdsa5Creature extends ActorSheetDsa5 {
  static DEFAULT_OPTIONS = {
    classes: ['creature-sheet'],
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
      templates: ['systems/dsa5/templates/actors/parts/gearSearchV2.hbs']
    },
    companion: {
      template: 'systems/dsa5/templates/actors/companions/actor-owner.hbs',
      scrollable: [''],
    },
    status: super.PARTS.status,
    notes: {
      template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
      scrollable: ['']
    }
  }


  static LIMITEDPARTS = {
    sheet: super.PARTS.sheet,
    header: {
      template: 'systems/dsa5/templates/actors/limited/creature-limited-header.hbs',
    },
    tabs: super.PARTS.tabs,
    main: {
      template: 'systems/dsa5/templates/actors/limited/creature-limited.hbs',
      scrollable: [''],
    },
    notes: {
      template: 'systems/dsa5/templates/actors/creature/creature-notes.hbs',
      scrollable: [''],
    }
  }

  static propertiesToEnrich = [
    { key: 'enrichedDescription', path: 'description.value' },
    { key: 'enrichedBehaviour', path: 'behaviour.value' },
    { key: 'enrichedFlight', path: 'flight.value' },
    { key: 'enrichedSpecialrules', path: 'specialRules.value' },
    { key: 'enrichedOwnerdescription', path: 'details.notes.ownerdescription' },
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

  async prepareCompanionTab(context) {
    await CompanionHandler.prepareOwnerPartContext(this, context);
  }

  attachCompanionTabListeners(element) {
    CompanionHandler.attachOwnerPartListeners(this, element);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const creatureClass = this.element.querySelector('[name="system.creatureClass.value"]');

    if (!creatureClass) return;

    creatureClass.addEventListener('pointerenter', (event) => {
      const creatureClasses = CreatureType.detectCreatureType(this.actor);

      if (!creatureClasses.length) return;

      const description = creatureClasses[0].classDescription();

      if (!description) return;

      event.stopPropagation();
      game.tooltip.activate(event.target, {
        html: description,
      });
    });
  }
}
