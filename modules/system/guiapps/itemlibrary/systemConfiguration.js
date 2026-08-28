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
    },
    "ActiveEffect": {
      default: "description"
    }
  }

  static documentGroups = { "Items": 0, "Character": 0, "Religion": 0, "Actors": 1, "JournalEntries": 2 }
  static documentNames = ["Item", "Actor", "JournalEntry"]

  /** Extra document types that appear as library chips but share an existing index. */
  static extraCategorySources = ["ActiveEffect"]

  static skipCategories = ["base", "information", "aggregatedTest", "effectwrapper"]

  static initialize() {

  }

  static documentNameFromGroup(documentGroup) {
    return this.documentNames[this.documentGroups[documentGroup]]
  }

  static indexPackNames(documentName) {
    if (documentName === "Item") return ["Item", "ActiveEffect"]
    return [documentName]
  }

  static categorySourceNames() {
    return [...this.documentNames, ...this.extraCategorySources]
  }

  static typeKeysFor(documentName) {
    const fromModel = game.model?.[documentName] ?? {};
    const fromConfig = CONFIG[documentName]?.dataModels ?? {};
    return [...new Set([...Object.keys(fromModel), ...Object.keys(fromConfig)])]
      .filter(x => !this.skipCategories.includes(x))
  }

  static categoryByType(documentName, type) {
    switch (documentName) {
      case "Item":
        if (DSA5.equipmentCategories.has(type) || ["trap", "money", "disease"].includes(type)) return "Items"
        if (DSA5.magicCategories.has(type)) return "Religion"
        return "Character"
      case "Actor":
        return "Actors"
      case "ActiveEffect":
        return type === "enhancement" ? "Items" : null
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
