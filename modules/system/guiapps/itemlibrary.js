import DSA5_Utility from '../helpers/utility-dsa5.js';
import ADVANCEDFILTERS from './itemlibrary_advanced_filters.js';
import { clickableAbility, tabSlider } from '../helpers/view_helper.js';
import { DefaultAppv2 } from '../../actor/baseapp.js';
const { duplicate, mergeObject } = foundry.utils;
import FlexSearch from "../../../libs/flexsearch.bundle.module.min.js"
import DSA5 from '../../config/config-dsa5.js';
import { localize } from '../helpers/localizer.js';
const { renderTemplate } = foundry.applications.handlebars;

//todo check if items on index have permission

class SearchDocument {
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

    if (DSA5.equipmentCategories.has(item.type)) {
      object.price = foundry.utils.getProperty(item, "system.price.value") || 0;
    }

    if (descriptionKey) {
      object.description = foundry.utils.getProperty(item, descriptionKey) || "";
    }

    for (const field of fields) {
      object[field] = foundry.utils.getProperty(item, field) || "";
    }

    return object;
  }
}


class AdvancedSearchDocument extends SearchDocument {
  static toSearchableObject(item, subcategory) {
    const object = super.toSearchableObject(item, item.documentName)

    const attrs = ADVANCEDFILTERS[subcategory] || [];
    for (let attr of attrs) {
      object[attr.attr] = attr.attr.split('.').reduce((prev, cure) => {
        return prev[cure] === undefined ? {} : prev[cure];
      }, item.system);
    }
    return object;
  }
}

class DSASystemConfiguration {
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
    const type = game.i18n.has(langKey) ? localize(langKey) : item.type
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

export default class DSA5ItemLibrary extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  pageSize = 60
  filterLimit = 10000

  static TABS = {
    sheet: {
      tabs: [
        { id: "Items", icon: "fa-solid fa-suitcase", label: "TYPES.Item.equipment" },
        { id: "Character", icon: "fa-solid fa-user", label: "TYPES.Actor.character" },
        { id: "Religion", icon: "fa-solid fa-hat-wizard", label: 'MagicReligion' },
        { id: "JournalEntries", icon: "fa-solid fa-book-open", label: "DOCUMENT.JournalEntries" },
        { id: "Actors", icon: "fa-solid fa-dragon", label: "zoo" }
      ],
      initial: "Items"
    }
  }

  static DEFAULT_OPTIONS = {
    id: "DSA5ItemLibrary",
    tag: "aside",
    position: {
      height: 800,
      width: 800
    },
    window: {
      title: "ItemLibrary",
      icon: "fa-regular fa-book",
      minimizable: true,
      resizable: true,
      controls: [
        {
          action: "showCompendiumFilter",
          icon: "fas fa-filter",
          label: "DSASETTINGS.libraryModulsFilter",
          visible: true,
        }
      ],
    },
    actions: {
      searchableAbility: this._onSearchableAbility
    },
    classes: ["dsa5", "sheet", "itemlibrary"]
  };

  static PARTS = {
    tabs: {
      template: "systems/dsa5/templates/system/dsatabs.hbs"
    },
    header: {
      template: "systems/dsa5/templates/system/itemlibrary/parts/header.hbs"
    },
    Items: {
      template: "systems/dsa5/templates/system/itemlibrary/Items.hbs",
      templates: ['systems/dsa5/templates/system/itemlibrary/parts/filterarea.hbs']
    },
    Religion: {
      template: "systems/dsa5/templates/system/itemlibrary/Religion.hbs",
      templates: ['systems/dsa5/templates/system/itemlibrary/parts/filterarea.hbs']
    },
    Character: {
      template: "systems/dsa5/templates/system/itemlibrary/Character.hbs",
      templates: ['systems/dsa5/templates/system/itemlibrary/parts/filterarea.hbs']
    },
    Actors: {
      template: "systems/dsa5/templates/system/itemlibrary/Actors.hbs",
      templates: ['systems/dsa5/templates/system/itemlibrary/parts/filterarea.hbs']
    },
    JournalEntries: {
      template: "systems/dsa5/templates/system/itemlibrary/JournalEntries.hbs",
      templates: ['systems/dsa5/templates/system/itemlibrary/parts/filterarea.hbs']
    }
  }


  constructor(app) {
    super(app)

    this.loadSystemSpecificConfig().then(() => {
      this.prepareDataModels()
      this.prepareIndexes()
    })
  }

  static _onSearchableAbility(ev, target) {
    clickableAbility(target);
  }

  async loadSystemSpecificConfig() {
    this.systemConfiguration = DSASystemConfiguration
    this.systemConfiguration.initialize()
    this.fullTextSearch = game.settings.get("dsa5", "indexDescription") && this.systemConfiguration.hasDescription
  }

  prepareIndexes() {
    this.indexes = {}
    this.detailFilter = {}

    for (let className of this.systemConfiguration.documentNames) {
      const fields = this.systemConfiguration.getSearchFields(className, undefined, this.fullTextSearch).index

      this.indexes[className] = {
        search: "",
        index: new FlexSearch.Document({
          tokenize: "full",
          cache: true,
          document: {
            id: "uuid",
            store: true,
            tag: "type",
            index: fields
          }
        }),
        build: false,
        worldBuild: false,
        next: undefined
      }
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options)
    data.isGM = game.user.isGM
    data.models = this.models

    if (this.advancedFiltering) {
      data.advancedFilter = await this.buildDetailFilter('none', 'none');
    }

    this.prepareSettings(data)
    return data
  }

  prepareSettings(data) {
    data.settings = {
      advanced: {
        icon: "fa-brain",
        val: this.advancedFiltering
      },
      indexWorldItems: {
        icon: "fa-globe",
        val: game.settings.get('dsa5', 'indexWorldItems')
      },
      fullTextSearch: {
        icon: "fa-align-center",
        val: game.settings.get('dsa5', 'indexDescription')
      },
      browseEnabled: {
        icon: "fa-maximize",
        val: this.browseEnabled
      },
      filterDuplicateItems: {
        icon: "fa-filter",
        val: game.settings.get('dsa5', 'filterDuplicateItems')
      }
    }
  }

  async onChangeSetting(ev) {
    const key = ev.currentTarget.dataset.key
    let val
    const html = $(this.element)
    switch (key) {
      case "advanced":
        val = !this.advancedFiltering
        this.advancedFiltering = val
        if (this.advancedFiltering) {
          html.find('.advancedSearch').fadeIn();
          this.setAdvancedFilters();
        } else {
          html.find('.advancedSearch').fadeOut();
        }
        break
      case "indexWorldItems":
        val = !game.settings.get('dsa5', 'indexWorldItems')
        await game.settings.set('dsa5', 'indexWorldItems', val)
        break
      case "fullTextSearch":
        val = !game.settings.get('dsa5', 'indexDescription')
        await game.settings.set('dsa5', 'indexDescription', val)
        break
      case "browseEnabled":
        val = !this.browseEnabled
        this.browseEnabled = val
        break
      case "filterDuplicateItems":
        val = !game.settings.get('dsa5', 'filterDuplicateItems')
        await game.settings.set('dsa5', 'filterDuplicateItems', val)
        break
    }

    $(ev.currentTarget).toggleClass('on', val)
  }

  prepareDataModels() {
    this.models = {}

    for (const documentName of this.systemConfiguration.documentNames) {
      const modelData = Object.keys(game.model[documentName]).filter(x => !this.systemConfiguration.skipCategories.includes(x))

      for (const key of modelData) {
        const category = this.systemConfiguration.categoryByType(documentName, key)
        if (!this.models[category]) this.models[category] = []
        const langKey = `TYPES.${documentName}.${key}`
        this.models[category].push({
          label: game.i18n.has(langKey) ? localize(langKey) : key,
          selected: false,
          key
        })
      }
    }
    for (let key of Object.keys(this.models)) {
      this.models[key].sort((a, b) => a.label.localeCompare(b.label))
    }
  }

  async buildEquipmentIndex() {
    await this.buildItemIndex()
  }

  async buildItemIndex() {
    await this._createIndex("Item", game.items)
  }

  async buildActorIndex() {
    await this._createIndex("Actor", game.actors)
  }

  async buildJournalEntryIndex() {
    await this._createIndex("JournalEntry", game.journal)
  }


  async setAdvancedFilters(category = 'none', subcategory = 'none') {
    for (let key in this.models) {
      for (let subkey of this.models[key]) {
        subkey.selected = false;
      }
    }
    const html = $(this.element)
    html.find('.filter[type="checkbox"]').prop('checked', false);
    let templ = await this.buildDetailFilter('none', 'none')
    html.find('.advancedSearch .advancedSearchContent').html(templ);
  }

  async getRandomItems(category, limit) {
    const filteredItems = await this.flattenedResults(this.indexes.Item, '', { tag: category, limit: this.filterLimit });

    const shuffledItems = this.shuffle(filteredItems)
      .slice(0, limit + 5)
      .map(x => this.indexes.Item.index.get(x));

    const documents = await Promise.all(shuffledItems.map(x => fromUuid(x.uuid)));
    return documents
      .filter(x => {
        const enchantments = x.getFlag('dsa5', 'enchantments');
        return !enchantments || !enchantments.some(enchant => enchant.talisman);
      })
      .slice(0, limit);
  }

  shuffle(array) {
    const shuffled = [...array];

    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }

    return shuffled;
  }

  async findCompendiumItem(search, category, filterCompendium = true) {
    await this.buildItemIndex();

    const query = {
      index: ["name"],
      tag: [category],
    };

    let result = await this.flattenedResults(this.indexes.Item, search, query);
    let items = result.map(x => this.indexes.Item.index.get(x));

    if (filterCompendium) {
      items = items.filter(x => x.compendium);
    }

    items.sort((a, b) => {
      const aIsCore = a.compendium?.startsWith('dsa5-core') || false;
      const bIsCore = b.compendium?.startsWith('dsa5-core') || false;

      if (aIsCore && !bIsCore) return 1;
      if (!aIsCore && bIsCore) return -1;
      return 0;
    });

    return Promise.all(items.map(x => fromUuid(x.uuid)));
  }

  async getCategoryItems(category, asItemData = false, asItem = false) {
    await this.buildItemIndex();
    const indexResults = await this.flattenedResults(this.indexes.Item, '', { tag: [category], limit: this.filterLimit });
    const items = indexResults.map(x => this.indexes.Item.index.get(x));

    if (!asItemData && !asItem) return items;

    const documents = await Promise.all(items.map(x => fromUuid(x.uuid)));
    return asItemData ? documents.map(x => x.toObject()) : documents;
  }

  async executeAdvancedFilter(search, indexWrapper, selectSearches, textSearches, booleanSearches, rangeSearches = [], startIndex = 0) {
    const index = indexWrapper?.index || indexWrapper;
    if (!index?.store) return [];

    const searchLower = search.toLowerCase();
    const filterFunction = (item) => {
      if (searchLower && !item.name.toLowerCase().includes(searchLower)) return false;

      for (const [attr, value, isStrict] of selectSearches) {
        if (isStrict ? item[attr] != value : !item[attr]?.includes(value)) return false;
      }

      for (const [attr, value] of textSearches) {
        if (!item[attr]?.toLowerCase().includes(value)) return false;
      }

      for (const [attr, value] of booleanSearches) {
        if (item[attr] !== value) return false;
      }

      for (const [attr, min, max] of rangeSearches) {
        const val = item[attr];
        if (val < min || val > max) return false;
      }

      return true;
    };

    const allResults = Object.values(index.store)
      .filter(filterFunction)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    
    const paginatedResults = allResults.slice(
      startIndex,
      Math.min(startIndex + this.pageSize, allResults.length)
    );

    if (indexWrapper?.index) {
      indexWrapper.next = startIndex + this.pageSize < allResults.length ?
        startIndex + this.pageSize :
        undefined;
    }

    return paginatedResults;
  }

  collectDetailSearch(htmlElement) {
    const sels = [];
    const inps = [];
    const checkboxes = [];

    htmlElement.find('select').each((_, elem) => {
      const $elem = $(elem);
      const val = $elem.val();
      if (val !== '') {
        sels.push([$elem.attr('name'), val, elem.dataset.notstrict !== 'true']);
      }
    });

    htmlElement.find('input[type="text"]:not(.manualFilter)').each((_, elem) => {
      const $elem = $(elem);
      const val = $elem.val();
      if (val !== '') {
        inps.push([$elem.attr('name'), val.toLowerCase()]);
      }
    });

    htmlElement.find('input[type="checkbox"]:checked:not(.manualFilter)').each((_, elem) => {
      const $elem = $(elem);
      const val = $elem.val();
      if (val !== '') {
        checkboxes.push([$elem.attr('name'), val.toLowerCase() == 'true']);
      }
    });

    return { sels, inps, checkboxes };
  }

  async advancedFilterStuff(documentGroup, page) {
    const dataFilters = $(this.element).find('.detailFilters');
    const subcategory = dataFilters.attr('data-subc');
    const search = this.findIndex(documentGroup).search.toLowerCase();
    if (!subcategory && !search) return [];

    if (subcategory) {
      const indexWrapper = this.detailFilter[subcategory];
      const { sels: selectSearches, inps: textSearches, checkboxes: booleanSearches } = this.collectDetailSearch(dataFilters);
      const startIndex = Number(page) || 0;
      
      const result = await this.executeAdvancedFilter(search, indexWrapper, selectSearches, textSearches, booleanSearches, [], startIndex);
      this.setBGImage(result, documentGroup);
      return this.filterDuplications(result);
    } else {
      return await this.filterStuff(documentGroup, page);
    }
  }

  async findEquipmentItemDetailed(search, category, filterCompendium = true) {
    await this.buildDetailFilter('Item', category);

    let indexWrapper = this.detailFilter[category];

    let result = await this.executeAdvancedFilter(search.search || '', indexWrapper, search.selects || [], search.inputs || [], search.booleans || [], search.rangeSearches || [], 0);
    if (filterCompendium) result = result.filter((x) => x.compendium != '');

    return await Promise.all(result.map((x) => fromUuid(x.uuid)));
  }

  filterDuplications(filteredItems) {
    if (game.settings.get('dsa5', 'filterDuplicateItems'))
      filteredItems = [...new Map(filteredItems.map((item) => [`${item.name}_${item.type}`, item])).values()];

    return filteredItems;
  }

  async _openItem(ev) {
    const uuid = $(ev.currentTarget).data("uuid")
    const item = await fromUuid(uuid)
    item.sheet.render(true)
  }

  async filterStuff(category, page) {
    const { index, itemType } = this.selectIndex(category);
    const search = index.search;
    const fields = this.systemConfiguration.getSearchFields(itemType, undefined, this.fullTextSearch);
    const collectTags = this.models[category]?.filter(x => x.selected).map(x => x.key) || [];
    const startIndex = Number(page) || 0;

    const searchParams = { ...fields, limit: (page || 0) + this.pageSize + 1 };
    if (collectTags.length > 0) {
      searchParams.tag = collectTags;
    }

    const searchResults = await this.flattenedResults(
      index,
      collectTags.length > 0 && search === "" ? "" : search,
      searchParams
    );

    const paginatedResults = searchResults.slice(
      startIndex,
      Math.min(startIndex + this.pageSize, searchResults.length)
    );

    index.next = startIndex + this.pageSize < searchResults.length ?
      startIndex + this.pageSize :
      undefined;

    const filteredItems = this.filterDuplications(
      paginatedResults.map(x => index.index.get(x))
    );

    this.setBGImage(filteredItems, category);

    return filteredItems;
  }

  changeTab(tab, group, options) {
    super.changeTab(tab, group, options)

    switch (tab) {
      case "Character":
      case "Religion":
      case "Items":
        this.buildItemIndex()
        break
      case "Actors":
        this.buildActorIndex()
        break
      case "JournalEntries":
        this.buildJournalEntryIndex()
        break
    }
  }

  setBGImage(filterdItems, category) {
    $(this.element).find(`[data-tab="${category}"] .libcontainer`)[`${filterdItems.length ? "remove" : "add"}Class`]("libraryImg")
  }

  async getItemTemplate(filteredItems, itemType) {
    if (this.browseEnabled && ['Items', 'Actors', 'Character', 'Religion'].includes(itemType)) {
      return filteredItems.map(x => {
        return `<li class="uuid libItem loader col center" data-uuid="${x.uuid}"><i class="fas fa-spinner fa-spin fa-4x"></i></li>`
      }).join("")
    } else {
      const template = 'systems/dsa5/templates/system/itemlibrary/parts/libraryItem.hbs'
      return await renderTemplate(template, { items: filteredItems })
    }
  }

  getObserver(itemType) {
    const observer = this.findIndex(itemType).observer ||= new IntersectionObserver(this.intersectionObserved.bind(this), { root: $(this.element).find('.window-content')[0] });
    return observer
  }

  async renderBrowseItem(uuid) {
    const document = await fromUuid(uuid)
    const template = `systems/dsa5/templates/items/browse/${document.type}.hbs`
    const item = await renderTemplate(template, { document, isGM: game.user.isGM, ...(await document.sheet._prepareContext()) })
    return `<div class="uuid libItem ${document.type} col" draggable="true" data-uuid="${uuid}">${item}</div>`
  }

  intersectionObserved(entries, observer) {
    for (let entry of entries) {
      if (entry.isIntersecting) {
        const uuid = entry.target.dataset.uuid
        this.renderBrowseItem(uuid).then(html => {
          entry.target.outerHTML = html
        })
        observer.unobserve(entry.target)
      }
    }
  }

  async renderResult(filteredItems, category, isPaged) {
    const resultField = $(this.element).find(`[data-tab="${category}"] .searchResult .item-list`)
    const innerhtml = $(await this.getItemTemplate(filteredItems, category))

    if (!isPaged) resultField.html(innerhtml)
    else resultField.append(innerhtml)

    const items = resultField.find('.loader')
    if (items.length > 0) {
      const observer = this.getObserver(category)

      for (let item of items) observer.observe(item)
    }
  }

  async filterItems(documentGroup, page) {
    const filteredItems = this.advancedFiltering && documentGroup != "JournalEntries" ?
      await this.advancedFilterStuff(documentGroup, page) :
      await this.filterStuff(documentGroup, page);
    await this.renderResult(filteredItems, documentGroup, page);
    return filteredItems;
  }

  async _createIndex(documentName, worldItems) {
    const index = this.findIndex(documentName);
    if (index.build) return;

    index.build = true;
    const filteredCompendiums = game.settings.get("dsa5", "libraryModulsFilter");
    const progress = ui.notifications.info('Library.loading', { format: { item: "" }, progress: true });
    this.showLoading(documentName);

    const packs = game.packs.filter(p =>
      p.documentName === documentName &&
      (game.user.isGM || p.visible) &&
      !filteredCompendiums[p.metadata.packageName]
    );

    await this.indexWorldItems(worldItems, documentName);
    progress.update({
      message: 'Library.loading',
      format: { item: "world items" },
      pct: 0.1
    });

    const percentage = 0.9 / Math.max(packs.length, 1);
    let completedCount = 0;

    const getDocumentsFunction = documentName === "JournalEntry"
      ? p => p.getDocuments()
      : documentName === "Actor"
        ? p => p.getIndex({ fields: ["name", "img", "type"] })
        : p => p.getDocuments({ type__in: Object.keys(game.system.documentTypes.Item).filter(x => x != 'information') });

    await Promise.all(packs.map(async (p, i) => {
      if (i > 2) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i % 3)));
      }

      const documents = await getDocumentsFunction(p);

      for (const item of documents) {
        index.index.add(SearchDocument.toSearchableObject(item, documentName));
      }

      completedCount++;
      progress.update({
        message: 'Library.loading',
        format: { item: `${p.metadata.label} (${p.metadata.id})` },
        pct: 0.1 + (completedCount * percentage)
      });
    }));

    progress.update({ message: 'Library.loading', format: { item: "" }, pct: 1 });

    this.hideLoading(documentName);
  }

  subcategoryFields(subcategory) {
    let field = ['name', 'type'];
    const attrs = ADVANCEDFILTERS[subcategory] || [];
    for (let attr of attrs) {
      field.push(attr.attr);
    }
    return field;
  }

  async indexWorldItems(worldItems, documentName) {
    if (game.settings.get('dsa5', 'indexWorldItems')) {
      for (const item of worldItems.filter(x => x.visible)) {
        this.findIndex(documentName).index.add(SearchDocument.toSearchableObject(item, documentName))
      }
    }
    this.findIndex(documentName).worldBuild = true
  }

  selectIndex(category) {
    let itemType = 'Item';
    switch (category) {
      case 'Actor':
      case 'Actors':
        itemType = 'Actor';
        break;
      case 'JournalEntry':
      case 'JournalEntries':
        itemType = 'JournalEntry';
        break;
    }
    return { index: this.indexes[itemType], itemType };
  }

  async flattenedResults(index, search, args) {
    const searchPromise = search
      ? index.index.searchAsync(search, args)
      : index.index.searchAsync(args);

    const uniqueResults = new Set();
    const results = await searchPromise;
    results.forEach(result => result.result.forEach(item => uniqueResults.add(item)));
    return Array.from(uniqueResults);
  }

  async createDetailIndex(category, subcategory) {
    if (this.detailFilter[subcategory]) return;

    const { index, itemType } = this.selectIndex(category);
    const catName = localize(`TYPES.${itemType}.${subcategory}`);
    const progress = ui.notifications.info('Library.loading', { format: { item: catName }, progress: true });
    const fields = this.subcategoryFields(subcategory);
    const target = $(this.element).find(`*[data-tab="${category}"]`);

    target.find('.searchResult ul').html('');
    this.showLoading(target, category);

    this.detailFilter[subcategory] = {
      search: "",
      index: new FlexSearch.Document({
        tokenize: "full",
        cache: true,
        document: {
          id: "uuid",
          store: true,
          tag: "type",
          index: fields
        }
      }),
      next: undefined
    };

    const items = [];
    if (game.settings.get('dsa5', 'indexWorldItems')) {
      const worldStuff = itemType === 'Item' ? game.items : game.actors;
      items.push(
        ...worldStuff
          .filter(x => x.visible && x.type === subcategory)
          .map(x => AdvancedSearchDocument.toSearchableObject(x, subcategory))
      );
    }

    progress.update({ message: 'Library.loading', format: { item: catName }, pct: 0.1 });
    const uuids = await this.flattenedResults(index, '', { tag: [subcategory], limit: this.filterLimit });

    const BATCH_SIZE = 25;
    const compendiumUuids = uuids.filter(uuid => uuid.startsWith('Compendium'));
    const totalBatches = Math.ceil(compendiumUuids.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const batchUuids = compendiumUuids.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const batchItems = await Promise.all(batchUuids.map(uuid => fromUuid(uuid)));

      items.push(...batchItems.map(item => AdvancedSearchDocument.toSearchableObject(item, subcategory)));

      const progressPct = Math.min(0.1 + 0.8 * ((i + 1) / totalBatches), 0.9);
      progress.update({
        message: 'Library.loading',
        format: { item: `${catName} (${i * BATCH_SIZE + batchItems.length}/${compendiumUuids.length})` },
        pct: progressPct
      });

      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    for (const item of items) {
      this.detailFilter[subcategory].index.add(item);
    }
    this.hideLoading(target, category);
    progress.update({ message: 'Library.loading', format: { item: catName }, pct: 1 });
  }

  async buildDetailFilter(category, subcategory, savedSettings = undefined) {
    if (category === 'none') {
      return `<p>${localize('Library.selectAdvanced')}</p>`;
    }

    const indexPromise = this.createDetailIndex(category, subcategory);
    const fields = duplicate(ADVANCEDFILTERS[subcategory] || []);
    let moduleSelected = false;

    if (savedSettings) {
      const settingsMap = {
        'select': savedSettings.selects,
        'text': savedSettings.inputs,
        'checkbox': savedSettings.booleans
      };

      for (const field of fields) {
        const settingsArray = settingsMap[field.type];
        if (settingsArray) {
          const setting = settingsArray.find(x => x[0] === field.attr);
          if (setting) field.value = setting[1];
        }
      }

      moduleSelected = savedSettings.selects?.find(x => x[0] === 'compendium')?.[1] || false;
    }

    const moduleOptions = DSA5ItemLibrary.collectModulOptions()
    const template = await renderTemplate(
      'systems/dsa5/templates/system/itemlibrary/parts/detailFilter.hbs',
      { fields, subcategory, moduleOptions, moduleSelected }
    );
    await indexPromise;
    return template;
  }

  static collectModulOptions() {
    const options = {};
    const moduleNameCache = new Map();

    for (const pack of game.packs.filter(p => p.metadata.type === 'Item')) {
      const packageName = pack.metadata.packageName;


      if (options[packageName]) continue;

      if (moduleNameCache.has(packageName)) {
        options[packageName] = moduleNameCache.get(packageName);
      } else {
        let displayName;
        if (game.i18n.has(`${packageName}.name`)) {
          displayName = localize(`${packageName}.name`);
        } else if (packageName === 'dsa5') {
          displayName = game.system.title;
        } else {
          const module = game.modules.get(packageName);
          displayName = module?.title.replace(/The Dark Eye 5th Ed. - /i, '') || pack.metadata.label;
        }

        moduleNameCache.set(packageName, displayName);
        options[packageName] = displayName;
      }
    }

    return options;
  }

  itemDragStart(ev) {
    ev.stopPropagation()
    $(this.element).animate({ opacity: 0.2 }, 100);
    const uuid = ev.target.dataset.uuid
    const pay = ev.target.dataset.pay
    const { type } = foundry.utils.parseUuid(uuid);
    ev.dataTransfer.setData("text/plain", JSON.stringify({ type, uuid, dragSource: "itemlibrary", pay }));
    ev.target.addEventListener("dragend", () => {
      window.setTimeout(() => $(this.element).animate({ opacity: 1 }, 300, () => $(this.element).css({ pointerEvents: "" })))
    }, { once: true });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)
    tabSlider(html);
    const source = this
    html.find('.filterCategories .filter').on('change', ev => this.filterChanged(ev))
    html.find('.changeSettings').on('click', (ev) => this.onChangeSetting(ev))
    html.find(".filterBy-search").on('keyup', ev => this._onFilterBySearch(ev))
    html.on("mousedown", ".searchResult .browser-item", ev => this._onItemNameClick(ev))
    html.on("mouseenter", ".searchResult .browser-item", ev => this._onItemHover(ev))
    html.on('click', ".searchResult .browser-item", ev => this._openItem(ev))
    this.element.addEventListener("dragstart", this.itemDragStart.bind(this));
    html.find('.scrollable').on('scroll.infinit', ev => foundry.utils.debounce(this._infiniteScroll(ev, source), 100));
    this.element.addEventListener("dragover", ev => this._onDragOver(ev));
    html.on('change', '.detailFilters input, .detailFilters select', () => {
      const category = $(this.element).find('.tab.active')[0].dataset.tab;
      
      if (this.advancedFiltering) {
        const dataFilters = $(this.element).find('.detailFilters');
        const subcategory = dataFilters.attr('data-subc');
        if (subcategory && this.detailFilter[subcategory]) {
          this.detailFilter[subcategory].next = undefined;
        }
      }
      
      this.filterItems(category);
    });

    this.buildItemIndex()
  }

  async _onItemHover(ev) {
    const uuid = ev.currentTarget.dataset.uuid;
    const item = await fromUuid(uuid);

    if (item.documentName == "JournalEntry") return

    let tooltip = await item.toEmbed({}, { skipHeader: true })

    if (!tooltip) tooltip = await this.systemConfiguration.renderTooltip(item)

    game.tooltip.activate(ev.currentTarget, {
      html: tooltip,
      cssClass: 'itemLibraryTooltip',
    })
  }

  _infiniteScroll(ev, source) {
    const log = $(ev.target);
    const pct = (log.scrollTop() + log.innerHeight()) >= log[0].scrollHeight - 100;
    
    if (!pct) return;

    const category = $(this.element).find('.tab.active')[0].dataset.tab;
    
    if (source.advancedFiltering) {
      const dataFilters = $(source.element).find('.detailFilters');
      const subcategory = dataFilters.attr('data-subc');
      
      if (subcategory && source.detailFilter[subcategory]?.next) {
        source.filterItems.call(source, category, source.detailFilter[subcategory].next);
      } else {
        const documentName = source.systemConfiguration.documentNameFromGroup(category);
        if (source.indexes[documentName]?.next) {
          source.filterItems.call(source, category, source.indexes[documentName].next);
        }
      }
    } else {
      const documentName = source.systemConfiguration.documentNameFromGroup(category);
      if (source.indexes[documentName].next) {
        source.filterItems.call(source, category, source.indexes[documentName].next);
      }
    }
  }

  async _onItemNameClick(ev) {
    const uuid = ev.currentTarget.dataset.uuid
    const item = await fromUuid(uuid)
    if (ev.button == 2) DSA5_Utility.showArtwork(item)
  }

  findIndex(category) {
    return this.selectIndex(category).index
  }

  _onFilterBySearch(ev) {
    const category = $(this.element).find('.tab.active')[0].dataset.tab
    this.findIndex(category).search = ev.currentTarget.value
    
    if (this.advancedFiltering) {
      const dataFilters = $(this.element).find('.detailFilters');
      const subcategory = dataFilters.attr('data-subc');
      if (subcategory && this.detailFilter[subcategory]) {
        this.detailFilter[subcategory].next = undefined;
      }
    }
    
    this.filterItems(category);
  }

  async filterChanged(ev) {
    const { category, type } = ev.currentTarget.dataset;
    const tab = $(ev.currentTarget).closest('.tab').data('tab');
    const isChecked = ev.currentTarget.checked;

    const model = this.models[tab]?.find(x => x.key === type);
    if (model) {
      model.selected = isChecked;
    }

    if (this.advancedFiltering) {
      const dataFilters = $(this.element).find('.detailFilters');
      const subcategory = dataFilters.attr('data-subc');
      if (subcategory && this.detailFilter[subcategory]) {
        this.detailFilter[subcategory].next = undefined;
      }
      
      await this.setAdvancedFilters(category, type);
      if (isChecked) {
        const template = await this.buildDetailFilter(category, type);
        $(this.element).find('.tab.active .advancedSearch .advancedSearchContent').html(template);
        ev.currentTarget.checked = isChecked;
      }
    }

    await this.filterItems(tab);
  }

  _tearDown(options) {
    super._tearDown(options);
    for (let key in this.indexes) {
      if (this.indexes[key].observer) {
        this.indexes[key].observer.disconnect();
        this.indexes[key].observer = undefined;
      }
    }
    for (let key in this.detailFilter) {
      if (this.detailFilter[key].observer) {
        this.detailFilter[key].observer.disconnect();
        this.detailFilter[key].observer = undefined;
      }
    }
  }

  _onClickAction(event, target) {
    if (target.classList.contains("disabled")) return

    switch (target.dataset.action) {
      case "showCompendiumFilter":
        new LibraryModulsFilter().render(true)
        break
    }
  }

  _onDragOver(ev) {
    if (ev.dataTransfer?.types.includes("dragSource"))
      $(this.element).css({ pointerEvents: "none" });
  }

  showLoading(documentName) {
    this.setBGImage([1], documentName)
    const loading = $(`<div class="loader"><i class="fa fa-4x fa-spinner fa-spin"></i>${localize('Library.buildingIndex')}</div>`)
    loading.appendTo($(this.element).find('.searchResult'))
  }

  hideLoading(documentName) {
    this.setBGImage([], documentName)
    $(this.element).find('.loader').remove()
  }
}

class LibraryModulsFilter extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    id: "LibraryModulsFilter",
    position: {
      width: 600
    },
    window: {
      title: "DSASETTINGS.libraryModulsFilter",
      icon: "fa-regular fa-globe",
      minimizable: true,
      resizable: true,
    },
    classes: ["dsa5"],
  };

  static PARTS = {
    modules: {
      template: "systems/dsa5/templates/system/itemlibrary/librarymodulesfilter.hbs"
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options)

    mergeObject(data, {
      moduleOptions: DSA5ItemLibrary.collectModulOptions(),
      rejectedModules: game.settings.get('dsa5', 'libraryModulsFilter'),
    });
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    $(this.element).find('.moduleSelector').on('change', (ev) => this.moduleFilterChanged(ev));
  }

  async moduleFilterChanged(ev) {
    const module = ev.currentTarget.id;

    const data = game.settings.get('dsa5', 'libraryModulsFilter');
    if (ev.currentTarget.checked) {
      delete data[module];
    } else {
      data[module] = true;
    }

    game.settings.set('dsa5', 'libraryModulsFilter', data);
  }
}
