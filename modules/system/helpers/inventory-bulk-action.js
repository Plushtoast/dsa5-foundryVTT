import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from './utility-dsa5.js';

const { getProperty, randomID } = foundry.utils;

export class InventoryBulkActionHelper {
  static collectInventoryItems(actor, { includeEquipped = true } = {}) {
    return actor.items.filter((item) => {
      if (!DSA5.equipmentCategories.has(item.type)) return false;
      if (includeEquipped) return true;
      return !getProperty(item, 'system.worn.value');
    });
  }

  static hasInventoryItems(actor, options = {}) {
    return this.collectInventoryItems(actor, options).length > 0;
  }

  static async deleteInventory(actor, options = {}) {
    const items = this.collectInventoryItems(actor, options);
    if (!items.length) return 0;

    await actor.deleteEmbeddedDocuments(
      'Item',
      items.map((item) => item.id),
    );

    return items.length;
  }

  static async moveInventoryToBag(actor, { includeEquipped = true } = {}) {
    const stashBag = await this.#findOrCreateStashBag(actor);
    const excludedIds = new Set([stashBag.id, ...this.#collectDescendantIds(actor, stashBag.id)]);
    const items = this.collectInventoryItems(actor, { includeEquipped }).filter((item) => !excludedIds.has(item.id));
    if (!items.length) return 0;

    const movedItemIds = new Set(items.map((item) => item.id));
    const updates = items.map((item) => {
      const update = {
        _id: item.id,
        'system.worn.value': false,
      };

      if (getProperty(item, 'system.worn.offHand') !== undefined) {
        update['system.worn.offHand'] = false;
      }

      const parentId = getProperty(item, 'system.parent_id');
      if (!parentId || !movedItemIds.has(parentId)) {
        update['system.parent_id'] = stashBag.id;
      }

      return update;
    });

    await actor.updateEmbeddedDocuments('Item', updates);
    return updates.length;
  }

  static canDropInventoryToGround(actor) {
    return !!canvas?.scene && !!this.getActorDropPosition(actor);
  }

  static getActorDropPosition(actor) {
    const token = actor.getActiveTokens()?.[0];
    if (!token) return null;

    return {
      x: token.document.x,
      y: token.document.y,
    };
  }

  static async dropInventoryToGround(actor, { includeEquipped = true } = {}) {
    const items = this.collectInventoryItems(actor, { includeEquipped });
    if (!items.length) return 0;

    const position = this.getActorDropPosition(actor);
    if (!position || !canvas?.scene) return -1;

    const droppedItems = items.map((item) => this.#sanitizeItemData(item.toObject()));
    const lootItems = await DSA5_Utility.allMoneyItems();
    const actorName = game.i18n.format('INVENTORYBULK.dropPileName', { name: actor.name });
    const actorImg = actor.img;

    lootItems.push(...droppedItems);

    const created = await this.#createTemporaryLootActor({
      img: actorImg,
      items: lootItems,
      name: actorName,
      position,
    });

    if (!created) return -1;

    await actor.deleteEmbeddedDocuments(
      'Item',
      items.map((item) => item.id),
    );

    return items.length;
  }

  static #sanitizeItemData(itemData) {
    if (getProperty(itemData, 'system.worn.value') !== undefined) {
      itemData.system.worn.value = false;
    }
    if (getProperty(itemData, 'system.worn.offHand') !== undefined) {
      itemData.system.worn.offHand = false;
    }

    return itemData;
  }

  static #collectDescendantIds(actor, rootId) {
    const descendantIds = new Set();
    let changed = true;

    while (changed) {
      changed = false;

      for (const item of actor.items) {
        const parentId = getProperty(item, 'system.parent_id');
        if (!parentId) continue;
        if (parentId !== rootId && !descendantIds.has(parentId)) continue;
        if (descendantIds.has(item.id)) continue;

        descendantIds.add(item.id);
        changed = true;
      }
    }

    return descendantIds;
  }

  static async #findOrCreateStashBag(actor) {
    const bagName = game.i18n.format('INVENTORYBULK.dropPileName', { name: actor.name });
    const existingBag = actor.items.find(
      (item) => item.type === 'equipment' && getProperty(item, 'system.equipmentType.value') === 'bags' && item.name === bagName,
    );
    if (existingBag) return existingBag;

    const [stashBag] = await actor.createEmbeddedDocuments('Item', [this.#buildWrapperBag(bagName)], { render: false });
    return stashBag;
  }

  static #buildWrapperBag(name) {
    return {
      _id: randomID(),
      img: 'systems/dsa5/icons/categories/Equipment.webp',
      name,
      type: 'equipment',
      system: {
        equipmentType: {
          value: 'bags',
        },
        quantity: {
          value: 1,
        },
        worn: {
          value: false,
        },
      },
    };
  }

  static async #createTemporaryLootActor({ img, items, name, position }) {
    const folder = await DSA5_Utility.getFolderForType('Actor', null, 'Dropped Items');
    const userIds = game.users.filter((user) => !user.isGM).map((user) => user.id);
    const ownership = userIds.reduce(
      (acc, id) => {
        acc[id] = 1;
        return acc;
      },
      { default: 0 },
    );

    const actorData = {
      type: 'npc',
      name,
      img,
      prototypeToken: {
        texture: {
          scaleX: 1,
          scaleY: 1,
          src: img,
        },
        width: 0.4,
        height: 0.4,
      },
      ownership,
      items,
      flags: { core: { sheetClass: 'dsa5.MerchantSheetDSA5' } },
      folder,
      system: {
        merchant: {
          merchantType: 'loot',
          temporary: true,
          hidePlayer: 1,
        },
        status: { wounds: { value: 16 } },
      },
    };

    const lootActor = await game.dsa5.entities.Actordsa5.create(actorData);
    const tokenDocument = await lootActor.getTokenDocument({
      x: position.x,
      y: position.y,
      hidden: false,
    });

    if (!canvas.dimensions.rect.contains(tokenDocument.x, tokenDocument.y)) return false;

    await canvas.scene.createEmbeddedDocuments('Token', [tokenDocument]);
    return true;
  }
}