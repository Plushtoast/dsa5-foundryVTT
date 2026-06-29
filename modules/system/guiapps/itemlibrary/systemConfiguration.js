import DSA5 from '../../../config/config-dsa5.js';

const { renderTemplate } = foundry.applications.handlebars;

export default class DSASystemConfiguration {
  static hasDescription = {
    "Item": {
      default: "system.description.value"
    },
    "Actor": {
      default: "system.description.value"
    },
    "JournalEntry": {
      default: "description"
    }
  }

  static documentGroups = { "Items": 0, "Character": 0, "Religion": 0, "Actors": 1, "JournalEntries": 2 }
  static documentNames = ["Item", "Actor", "JournalEntry"]

  static skipCategories = ["base", "information", "aggregatedTest", "effectwrapper"]

  static initialize() {

  }

  static documentNameFromGroup(documentGroup) {
    return this.documentNames[this.documentGroups[documentGroup]]
  }

  static categoryByType(documentName, type) {
    switch (documentName) {
      case "Item":
        if (DSA5.equipmentCategories.has(type) || ["trap", "money", "disease"].includes(type)) return "Items"
        if (DSA5.magicCategories.has(type)) return "Religion"
        return "Character"
      case "Actor":
        return "Actors"
      default:
        return documentName;
    }
  }

  static getDescription(item) {
    const descriptionKey = this.getDescriptionKey(item)
    return descriptionKey ? foundry.utils.getProperty(item, descriptionKey) : ""
  }

  static getDescriptionKey(item) {
    return foundry.utils.getProperty(this.hasDescription, `${item.documentName}.${item.type}`) || foundry.utils.getProperty(this.hasDescription, `${item.documentName}.default`)
  }

  static async renderTooltip(item, fullTextSearch) {
    const description = this.getDescription(item, fullTextSearch)
    const langKey = `TYPES.${item.documentName}.${item.type}`
    const type = game.i18n.has(langKey) ? _loc(langKey) : item.type
    return await renderTemplate("systems/dsa5/templates/system/itemlibrary/parts/itemHover.hbs", { item, description, type })
  }

  static getSearchFields(documentName, type, fullTextSearch) {
    const fields = { index: ["name"] }

    if (fullTextSearch) {
      const descriptionKey = this.getDescriptionKey({ documentName, type })

      if (descriptionKey) fields.index.push("description")
    }
    return fields
  }
}
