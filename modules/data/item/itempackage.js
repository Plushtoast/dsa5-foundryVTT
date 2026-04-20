import DescriptionTemplate from './templates/description.js';
import { ItemDataModel } from '../baseitem.js';
import DSA5 from '../../config/config-dsa5.js';
import DSA5_Utility from '../../system/helpers/utility-dsa5.js';

const { SchemaField, StringField, NumberField, TypedObjectField } = foundry.data.fields;

export default class ItempackageData extends ItemDataModel.mixin(DescriptionTemplate) {
  static defineSchema() {
    return this.mergeSchema(super.defineSchema(), {
      price: new SchemaField({
        value: new NumberField({ initial: 0, min: 0, label: 'price' }),
      }),
      items: new TypedObjectField(new SchemaField({
        name: new StringField({ required: true, label: 'name' }),
        type: new StringField({ required: true, label: 'type', choices: () => Object.fromEntries([...DSA5.equipmentCategories].map(c => [c, c])) }),
        count: new NumberField({ initial: 1, min: 1, integer: true, label: 'quantity' }),
        qs: new NumberField({ initial: 0, min: 0, integer: true, label: 'Qs' }),
        price: new NumberField({ initial: 0, min: 0, label: 'price' }),
      })),
    });
  }

  get contents() {
    return Object.values(this.items);
  }

  async addItem(name = '', type = 'equipment', count = 1, qs = 0, price = 0) {
    const id = foundry.utils.randomID();
    await this.parent.update({
      [`system.items.${id}`]: { name, type, count, qs, price },
      'system.price.value': this.#recalcPrice({ [id]: { count, price } }),
    });
  }

  async removeItem(key) {
    await this.parent.update({
      [`system.items.${key}`]: _del,
      'system.price.value': this.#recalcPrice({ [key]: _del }),
    });
  }

  #recalcPrice(changes = {}) {
    const merged = foundry.utils.mergeObject(foundry.utils.deepClone(this.items), changes, { applyOperators: true });
    return Object.values(merged).reduce((sum, i) => sum + (i.price || 0) * (i.count || 1), 0);
  }

  toLookupPayload() {
    return {
      type: 'lookup',
      items: this.contents,
      price: this.price.value,
    };
  }

  static chatData(data, name) {
    return [
      { key: 'price', val: `${data.price.value}` },
      { key: 'quantity', val: `${Object.keys(data.items).length}` },
    ];
  }

  async resolveItems() {
    const items = this.contents;
    const lookup = await DSA5_Utility.findAnyItem(items);
    if (!lookup?.length) return [];

    for (const thing of items) {
      if (thing.count) {
        const elem = lookup.find((x) => x.name == thing.name && x.type == thing.type);
        if (elem) {
          elem.system.quantity.value = thing.count;
          if (thing.qs && thing.type == 'consumable') elem.system.QL = thing.qs;
        }
      }
    }
    return lookup;
  }

  static async resolvePackage(item) {
    let pkg;
    if (item instanceof Item) {
      pkg = item;
    } else if (item.uuid) {
      pkg = await fromUuid(item.uuid);
    } else if (item._id) {
      pkg = game.items.get(item._id);
    }
    if (!pkg?.system?.resolveItems) return [];
    return await pkg.system.resolveItems();
  }

  async showContents(whispers = undefined) {
    await game.dsa5.itemLibrary.buildEquipmentIndex();
    const resolvedItems = await Promise.all(
      this.contents.map(async (x) => {
        const count = x.count > 1 ? ` x ${x.count}` : '';
        const qs = x.qs ? ` (${x.qs})` : '';
        let item = await game.dsa5.itemLibrary.findCompendiumItem(x.name, x.type);
        if (item) item = item.find((y) => x.type == y.type && y.name == x.name);
        if (item) return `${item.link}${qs}${count}`;
        return `${x.name}${qs}${count}`;
      })
    );
    const content = `<h2>${this.parent.name}</h2><p>${resolvedItems.join(' ')}</p>`;
    ChatMessage.create(DSA5_Utility.chatDataSetup(content, 'roll', undefined, whispers));
  }

  static async collectAvailablePackages() {
    const seen = new Set();
    const packages = await DSA5_Utility.collectIndexedCompendiumEntries({
      documentName: 'Item',
      fields: ['name', 'system.price.value', 'type'],
      filterEntry: (entry) => entry.type === 'itempackage' && !seen.has(entry.name),
      mapEntry: (entry, { pack }) => {
        seen.add(entry.name);
        return {
          name: entry.name,
          uuid: `Compendium.${pack.collection}.${entry._id}`,
          price: entry.system?.price?.value ?? 0,
        };
      },
    });

    packages.sort((a, b) => a.name.localeCompare(b.name));
    return packages;
  }

  static async postPackagesChatCard() {
    const packages = await this.collectAvailablePackages();
    if (!packages.length) {
      ui.notifications.warn('ITEMPACKAGE.noneAvailable', { localize: true });
      return;
    }
    const msg = await foundry.applications.handlebars.renderTemplate('systems/dsa5/templates/chat/package-list.hbs', { packages });
    ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'roll'));
  }

  static async _showPackageByUuid(uuid, whispers) {
    const item = await fromUuid(uuid);
    if (!item) return;
    await item.system.showContents(whispers);
  }

  static chatListeners(html) {
    html.on('click', '.showPackage', (ev) => {
      const uuid = ev.currentTarget.dataset.uuid;
      if (uuid) this._showPackageByUuid(uuid);
    });
    html.on('dragstart', '.package-drag', (ev) => {
      const uuid = ev.currentTarget.dataset.uuid;
      if (!uuid) return;
      
      ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify({
        type: 'Item',
        uuid,
      }));
    });
  }
}
