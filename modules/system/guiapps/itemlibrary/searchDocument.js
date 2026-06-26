import ADVANCEDFILTERS from '../itemlibrary_advanced_filters.js';
import ItemLibraryListColumns from './listColumns.js';

export default class SearchDocument {
  static cachedKeys = {
    Item: {},
    Actor: {},
  }

  static getSearchFields(documentName, type) {
    const cached = this.cachedKeys[documentName][type]

    if (!cached) {
      const fields = ["name", "img", "type"]
      const descriptionKey = game.dsa5.itemLibrary.fullTextSearch ? this.getDescriptionKey(documentName, type) : undefined
      this.cachedKeys[documentName][type] = { fields, descriptionKey }
    }

    return this.cachedKeys[documentName][type]
  }

  static getDescriptionKey(documentName, type) {
    switch (documentName) {
      case 'Actor':
      case 'Item':
        return 'system.description.value'
      default:
        return 'description.value'
    }
  }

  static toJournalSearchableObject(item) {
    return {
      uuid: item.uuid,
      name: item.name,
      compendium: item.pack,
      img: 'systems/dsa5/icons/categories/DSA-Auge.webp',
      type: 'JournalEntry',
      description: item.pages.map(x => x.text?.content).join(" ")
    }
  }

  static toSearchableObject(item, documentName) {
    if (documentName === "JournalEntry") return this.toJournalSearchableObject(item);

    const { descriptionKey, fields } = this.getSearchFields(documentName, item.type);
    const object = {
      uuid: item.uuid,
      compendium: item.pack || ''
    };

    if (ItemLibraryListColumns.typeHasPrice(item.type)) {
      object.price = foundry.utils.getProperty(item, "system.price.value") || 0;
    }

    if (descriptionKey) {
      object.description = foundry.utils.getProperty(item, descriptionKey) || "";
    }

    for (const field of fields) {
      object[field] = foundry.utils.getProperty(item, field) || "";
    }

    for (const field of ItemLibraryListColumns.getListDisplayFields(item.type)) {
      if (field.columnType === 'plantTypes') {
        object[field.attr] = foundry.utils.duplicate(item.system?.planttype ?? {});
      } else {
        object[field.attr] = ItemLibraryListColumns.getSystemAttrValue(item, field.attr) ?? '';
      }
    }

    return object;
  }
}

export class AdvancedSearchDocument extends SearchDocument {
  static toSearchableObject(item, subcategory) {
    const object = super.toSearchableObject(item, item.documentName)

    const attrs = ADVANCEDFILTERS[subcategory] || [];
    for (const attr of attrs) {
      object[attr.attr] = attr.attr.split('.').reduce((prev, cure) => {
        return prev[cure] === undefined ? {} : prev[cure];
      }, item.system);
    }
    return object;
  }
}
