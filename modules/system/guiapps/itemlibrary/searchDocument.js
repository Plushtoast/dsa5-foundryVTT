import ADVANCEDFILTERS from '../itemlibrary_advanced_filters.js';
import ItemLibraryListColumns from './listColumns.js';
import DSASystemConfiguration from './systemConfiguration.js';

export default class SearchDocument {
  static cachedKeys = {
    Item: {},
    Actor: {},
    ActiveEffect: {},
  }

  static getSearchFields(documentName, type) {
    if (!this.cachedKeys[documentName]) this.cachedKeys[documentName] = {};
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
      case 'ActiveEffect':
        return 'description'
      default:
        return 'description.value'
    }
  }

  static detailFiltersFor(type) {
    return (game.dsa5?.advancedFilters || ADVANCEDFILTERS)[type] || [];
  }

  static indexFieldPath(attr) {
    if (!attr) return null;
    if (attr.startsWith('system.') || attr === 'description') return attr;
    return `system.${attr}`;
  }

  static applyDetailFilterFields(object, item, type) {
    for (const attr of this.detailFiltersFor(type)) {
      if (!attr.attr) continue;
      object[attr.attr] = ItemLibraryListColumns.getSystemAttrValue(item, attr.attr) ?? '';
    }
    return object;
  }

  static hasDetailFilterFields(object, type) {
    if (!object) return false;
    return this.detailFiltersFor(type).every((attr) => attr.attr in object);
  }

  static indexFieldsFor(documentName, { fullTextSearch } = {}) {
    const fields = new Set();
    const useDescription = fullTextSearch ?? game.dsa5?.itemLibrary?.fullTextSearch;
    if (useDescription) {
      const descriptionKey = this.getDescriptionKey(documentName);
      if (descriptionKey) fields.add(descriptionKey);
    }

    const types = DSASystemConfiguration.typeKeysFor(documentName);
    for (const type of types) {
      if (ItemLibraryListColumns.typeHasPrice(type)) fields.add('system.price.value');
      for (const col of ItemLibraryListColumns.getListDisplayFields(type)) {
        if (!col.attr) continue;
        if (col.columnType === 'plantTypes') fields.add('system.planttype');
        else fields.add(this.indexFieldPath(col.attr));
      }
      for (const attr of this.detailFiltersFor(type)) {
        if (attr.attr) fields.add(this.indexFieldPath(attr.attr));
      }
    }
    return [...fields];
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
    const resolvedName = item.documentName || documentName;
    if (resolvedName === "JournalEntry" || documentName === "JournalEntry") return this.toJournalSearchableObject(item);

    const { descriptionKey, fields } = this.getSearchFields(resolvedName, item.type);
    const object = {
      uuid: item.uuid,
      documentName: resolvedName,
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

    this.applyDetailFilterFields(object, item, item.type);
    return object;
  }
}

export class AdvancedSearchDocument extends SearchDocument {
  static toSearchableObject(item, subcategory) {
    const object = super.toSearchableObject(item, item.documentName);
    if (subcategory && subcategory !== item.type) this.applyDetailFilterFields(object, item, subcategory);
    return object;
  }
}
