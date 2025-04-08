import DSA5_Utility from './utility-dsa5.js';
import ADVANCEDFILTERS from './itemlibrary_advanced_filters.js';
import { clickableAbility, tabSlider } from './view_helper.js';
import { DefaultAppv2 } from '../actor/baseapp.js';
const { duplicate, mergeObject } = foundry.utils;
import FlexSearch from "../../libs/flexsearch.bundle.module.min.js"
import DSA5 from './config-dsa5.js';
const { renderTemplate } = foundry.applications.handlebars;

//todo check if items on index have permission

class SearchDocument {
  static cachedKeys = {
      Item: {},
      Actor: {},
  }

  static getSearchFields(documentName, type) {
      const cached = this.cachedKeys[documentName][type]

      if(!cached) {
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
      if(documentName == "JournalEntry") return this.toJournalSearchableObject(item)

      const { descriptionKey, fields } = this.getSearchFields(documentName, item.type)
      const object = {}

      object.uuid = item.uuid
      object.compendium = item.pack || ''
      if (DSA5.equipmentCategories.has(item.type)) {
        object.price = item.system.price?.value || 0
      }

      if(descriptionKey)
          object.description = foundry.utils.getProperty(item, descriptionKey) ?? ""

      for (const field of fields)
          object[field] = foundry.utils.getProperty(item, field) ?? ""

      return object
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
    switch(documentName) {
        case "Item":
          if(DSA5.equipmentCategories.has(type) || ["trap", "money", "disease"].includes(type)) return "Items"
          if(DSA5.magicCategories.has(type)) return "Religion"
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
      const type = game.i18n.has(langKey) ? game.i18n.localize(langKey) : item.type
      return await renderTemplate("systems/dsa5/templates/system/itemlibrary/parts/itemHover.hbs", { item, description, type })
  }

  static getSearchFields(documentName, type, fullTextSearch) {
      const fields = { index: ["name"] }

      if(fullTextSearch) {
          const descriptionKey = this.getDescriptionKey({ documentName, type })

          if(descriptionKey) fields.index.push("description")
      }
      return fields
  }
}

export default class DSA5ItemLibrary extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
    pageSize = 60

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
        actions: {},
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
    switch(key) {
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
                label: game.i18n.has(langKey) ? game.i18n.localize(langKey) : key,
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
    const filteredItems = (await this.indexes.Item.index.searchAsync({ tag: category })).map(x => x.result).flat().map(x => this.indexes.Item.index.get(x))
    return (await Promise.all(this.shuffle(filteredItems).slice(0, limit + 5).map(uuid => fromUuid(uuid)))).filter((x) => {
      const enchantments = x.getFlag('dsa5', 'enchantments');
      return !enchantments || !enchantments.find((x) => x.talisman);
    }).slice(0, limit)
  }

  shuffle(array) {
    let currentIndex = array.length, temporaryValue, randomIndex;

    while (0 !== currentIndex) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
  }

  async findCompendiumItem(search, category, filterCompendium = true) {
    await this.buildItemIndex();

    const query = {
      index: ["name"],
      tag: [category],
    };
    let result = (await this.indexes.Item.index.searchAsync(search, query)).map(x => x.result).flat().map(x => this.indexes.Item.index.get(x));
    if (filterCompendium) result = result.filter((x) => x.compendium != '');

    result = result.sort((a, b) => {
      const aStartsWithCore = a.compendium.startsWith('dsa5-core');
      const bStartsWithCore = b.compendium.startsWith('dsa5-core');

      if (aStartsWithCore && bStartsWithCore) return 0;
      if (aStartsWithCore) return 1;
      if (bStartsWithCore) return -1;

      return 0;
    });

    return await Promise.all(result.map((x) => fromUuid(x.uuid)));
  }

  async getCategoryItems(category, asItemData = false, asItem = false) {
    await this.buildItemIndex();
    const res = (await this.indexes.Item.index.searchAsync({ tag: [category] })).map(x => x.result).flat().map(x => this.indexes.Item.index.get(x));
    if (asItemData) return (await Promise.all(res.map((x) => fromUuid(x)))).map((x) => x.toObject());
    else if (asItem) return await Promise.all(res.map((x) => fromUuid(x)));

    return res;
  }

  async executeAdvancedFilter(search, index, selectSearches, textSearches, booleanSearches, rangeSearches = []) {
    const selFnct = (x) => {
      for (let k of selectSearches) {
        if (k[2] ? x[k[0]] != k[1] : x[k[0]].indexOf(k[1]) == -1) return false;
      }
      return true;
    };
    const txtFnct = (x) => {
      for (let k of textSearches) {
        if (x[k[0]].toLowerCase().indexOf(k[1]) == -1) return false;
      }
      return true;
    };
    const cbFnct = (x) => {
      for (let k of booleanSearches) {
        if (x[k[0]] != k[1]) return false;
      }
      return true;
    };

    const rangeFct = (x) => {
      for (let k of rangeSearches) {
        if (x[k[0]] < k[1] || x[k[0]] > k[2]) return false;
      }
      return true;
    };
    const result = Object.values(index?.store || {}).filter((x) => (search == '' || x.name.toLowerCase().indexOf(search) != -1) && selFnct(x) && txtFnct(x) && cbFnct(x) && rangeFct(x));
    let filteredItems = result;
    filteredItems = filteredItems.sort((a, b) => (a.name.toLowerCase() > b.name.toLowerCase() ? 1 : -1));

    return filteredItems;
  }

  collectDetailSearch(htmlElement) {
    const sels = [];
    const inps = [];
    const checkboxes = [];
    for (let elem of htmlElement.find('select')) {
      let val = $(elem).val();
      if (val != '') {
        sels.push([$(elem).attr('name'), val, elem.dataset.notstrict != 'true']);
      }
    }
    for (let elem of htmlElement.find('input[type="text"]:not(.manualFilter)')) {
      let val = $(elem).val();
      if (val != '') {
        inps.push([$(elem).attr('name'), val.toLowerCase()]);
      }
    }
    for (let elem of htmlElement.find('input[type="checkbox"]:checked:not(.manualFilter)')) {
      let val = $(elem).val();
      if (val != '') {
        checkboxes.push([$(elem).attr('name'), val.toLowerCase()]);
      }
    }
    return { sels, inps, checkboxes };
  }

  async advancedFilterStuff(documentGroup, page) {
    const dataFilters = $(this.element).find('.detailFilters');
    const subcategory = dataFilters.attr('data-subc');
    const index = subcategory ? this.detailFilter[subcategory] : this.findIndex(documentGroup).index;
    const search = this.findIndex(documentGroup).search.toLowerCase();
    const { sels, inps, checkboxes } = this.collectDetailSearch(dataFilters);
    let result = await this.executeAdvancedFilter(search, index, sels, inps, checkboxes);
    this.setBGImage(result, documentGroup);
    result = this.filterDuplications(result);
    return result;
  }

  async findEquipmentItemDetailed(search, category, filterCompendium = true) {
    await this.buildDetailFilter('Item', category);

    let index = this.detailFilter[category];

    let result = await this.executeAdvancedFilter(search.search || '', index, search.selects || [], search.inputs || [], search.booleans || [], search.rangeSearches || []);
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
    const { index, itemType } = this.selectIndex(category)
    const search = index.search
    let filteredItems
    const fields = this.systemConfiguration.getSearchFields(itemType, undefined, this.fullTextSearch)
    const collectTags = this.models[category]?.filter(x => x.selected).map(x => x.key) || []
    let startIndex = Number(page) || 0

    if(collectTags.length == 0) {
      filteredItems = (await index.index.searchAsync(search, { ...fields })).map(x => x.result).flat()
    }
    else {
      filteredItems = (await (search == "" ? index.index.searchAsync({ tag: collectTags }) : index.index.searchAsync(search, { ...fields, tag: collectTags }))).map(x => x.result).flat()
    }

    filteredItems = filteredItems.slice(startIndex, Math.min(startIndex + this.pageSize, filteredItems.length))

    if (filteredItems.length == this.pageSize) startIndex += this.pageSize

    index.next = startIndex

    filteredItems = filteredItems.map(x => index.index.get(x))
    filteredItems = this.filterDuplications(filteredItems)
    this.setBGImage(filteredItems, category)
    return filteredItems
  }

  changeTab(tab, group, options) {
    super.changeTab(tab, group, options)

    switch(tab) {
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
    if (this.browseEnabled && ['Items','Actors','Character','Religion'].includes(itemType)) {
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
    const item = await renderTemplate(template, { document, isGM: game.user.isGM, ...(await document.sheet._prepareContext())})
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
    const filteredItems = this.advancedFiltering && documentGroup != "JournalEntries" ? await this.advancedFilterStuff(documentGroup, page) : await this.filterStuff(documentGroup, page)
    await this.renderResult(filteredItems, documentGroup, page)
    return filteredItems
  }

  async _createIndex(documentName, worldItems) {
    const index = this.findIndex(documentName)
    if (index.build) return

    index.build = true
    const filteredCompendiums = game.settings.get("dsa5", "libraryModulsFilter")
    const progress = ui.notifications.info('Library.loading', { format: { item: "" }, progress: true})
    this.showLoading(documentName)
    const packs = game.packs.filter(p => p.documentName == documentName && (game.user.isGM || p.visible) && !filteredCompendiums[p.metadata.packageName])
    const percentage = 100 / (packs.length + 1)
    let count = percentage
    const actorFields = ["name", "img", "type"]
    let func
    if (documentName == "Actor") {
        func = (p) => { return p.getIndex({ actorFields }) }
    } else if (documentName == "JournalEntry") {
        func = (p) => { return p.getDocuments() }
    } else {
        func = (p) => { return p.getDocuments({ type__in: Object.keys(game.system.documentTypes.Item) }) }
    }
    this.indexWorldItems(worldItems, documentName)
    progress.update({message: 'Library.loading', format: { item: "world items" }, pct: Math.round(percentage) / 100})

    const promise = packs.map(async (p) => {
        const documents = await func(p)
        count += percentage
        for(const item of documents) index.index.add(SearchDocument.toSearchableObject(item, documentName))

        progress.update({message: 'Library.loading', format: { item: `${p.metadata.label} (${p.metadata.id})` }, pct: Math.round(count) / 100})
    })

    return Promise.all(promise).then(async() => {
        progress.update({message: 'Library.loading', format: { item: "" }, pct: 1})
        this.hideLoading(documentName)
    })
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
        for(const item of worldItems.filter(x => x.visible)){
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

  async createDetailIndex(category, subcategory) {
    if (!this.detailFilter[subcategory]) {
      const { index, itemType } = this.selectIndex(category);
      const catName = game.i18n.localize(`TYPES.${itemType}.${subcategory}`);
      const progress = ui.notifications.info('Library.loading', { format: { item: catName }, progress: true})
      const fields = this.subcategoryFields(subcategory);
      const target = $(this.element).find(`*[data-tab="${category}"]`);
      target.find('.searchResult ul').html('');
      this.showLoading(target, category);
      this.detailFilter[subcategory] = new FlexSearch.Document({
        tokenize: "full",
        cache: true,
        document: {
            id: "uuid",
            store: true,
            tag: "type",
            index: fields
        }
      });      
      const worldStuff = itemType == 'Item' ? game.items : game.actors;
      const items = [];

      if (game.settings.get('dsa5', 'indexWorldItems')) {
        items.push(...worldStuff.filter((x) => x.visible && x.type == subcategory).map((x) => AdvancedSearchDocument.toSearchableObject(x, subcategory)));
      }

      const result = (await index.index.searchAsync({ tag: [subcategory] })).map(x => x.result).flat()
      progress.update({message: 'Library.loading', format: { item: catName }, pct: 0.1 })

      const promises = [];
      let percentage = 60 / result.length;
      let count = 0;
      for (const uuid of result) {
        count += 1;
        if(uuid.startsWith('Compendium')) promises.push(fromUuid(uuid));
        progress.update({message: 'Library.loading', format: { item: catName }, pct: Math.round(10 + count * percentage) / 100 })
      }
      progress.update({message: 'Library.loading', format: { item: catName }, pct: 0.7 })

      const final = await Promise.all(promises);
      percentage = 30 / final.length;
      count = 0;
      for (let k of final) {
        count += 1;
        items.push(AdvancedSearchDocument.toSearchableObject(k, subcategory));
        progress.update({message: 'Library.loading', format: { item: catName }, pct: Math.round(70 + count * percentage) / 100 })
      }

      for(const item of items) this.detailFilter[subcategory].add(item);
      this.hideLoading(target, category);
      progress.update({message: 'Library.loading', format:  { item: catName }, pct: 1 })
    }
  }

  async buildDetailFilter(category, subcategory, savedSettings = undefined) {
    if (category != 'none') {
      const fields = duplicate(ADVANCEDFILTERS[subcategory] || []);
      let moduleSelected = false;   
      if (savedSettings) {
        for (let field of fields) {
          switch (field.type) {
            case 'select':
              const sel = savedSettings.selects.find((x) => x[0] == field.attr);
              if (sel) field.value = sel[1];
              break;
            case 'text':
              const txt = savedSettings.inputs.find((x) => x[0] == field.attr);
              if (txt) field.value = txt[1];
              break;
            case 'checkbox':
              const cb = savedSettings.booleans.find((x) => x[0] == field.attr);
              if (cb) field.value = cb[1];
              break;
          }
        }
        moduleSelected = savedSettings.selects.find((x) => x[0] == 'compendium')?.[1];
      }

      const bindex = this.createDetailIndex(category, subcategory);
      const moduleOptions = DSA5ItemLibrary.collectModulOptions();
      const template = await renderTemplate('systems/dsa5/templates/system/itemlibrary/parts/detailFilter.hbs', { fields, subcategory, moduleOptions, moduleSelected });
      await bindex;
      return template;
    } else {
      return `<p>${game.i18n.localize('Library.selectAdvanced')}</p>`;
    }
  }

  static collectModulOptions() {
    return game.packs
      .filter((x) => x.metadata.type == 'Item')
      .reduce((prev, cur) => {
        if (!prev[cur.metadata.packageName]) {
          const name = game.i18n.has(`${cur.metadata.packageName}.name`)
            ? game.i18n.localize(`${cur.metadata.packageName}.name`)
            : game.modules.get(cur.metadata.packageName)?.title.replace(/The Dark Eye 5th Ed. - /i, '') || game.system.title;
          prev[cur.metadata.packageName] = name;
        }
        return prev;
      }, {});
  }

  itemDragStart (ev) {
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
      this.filterItems(category);
    }); 

    html.on('click', '.searchableAbility a', (ev) => clickableAbility(ev));

    this.buildItemIndex()
  }

  async _onItemHover(ev) {
    const uuid = ev.currentTarget.dataset.uuid
    const item = await fromUuid(uuid)
    let tooltip = await item.toEmbed({ classes: 'itemLibraryTooltip'}, { skipHeader: true })

    if(!tooltip) tooltip = await this.systemConfiguration.renderTooltip(item)

    $('#tooltip').html(tooltip)
  }

  _infiniteScroll(ev, source) {
    if (source.advancedFiltering) return

    const log = $(ev.target);
    const pct = (log.scrollTop() + log.innerHeight()) >= log[0].scrollHeight - 100;
    const category = $(this.element).find('.tab.active')[0].dataset.tab;
    const documentName = this.systemConfiguration.documentNameFromGroup(category)
    if (pct && source.indexes[documentName].next) {
        source.filterItems.call(source, category, source.indexes[documentName].next )
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
    this.filterItems(category);
  }

  async filterChanged(ev) {
    const category = ev.currentTarget.dataset.category
    const tab = $(ev.currentTarget).closest('.tab')[0].dataset.tab
    const type = ev.currentTarget.dataset.type
    const isChecked = ev.currentTarget.checked

    if (this.advancedFiltering) {
      await this.setAdvancedFilters(category, type);
      ev.currentTarget.checked = isChecked;
      
      if (isChecked) {
        const templ = await this.buildDetailFilter(category, type)
        $(this.element).find('.tab.active .advancedSearch .advancedSearchContent').html(templ);
      }
    }

    this.models[tab].find(x => x.key == type).selected = isChecked
    this.filterItems(tab)
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
    if(ev.dataTransfer?.types.includes("dragSource"))
        $(this.element).css({ pointerEvents: "none" });
  }

  showLoading(documentName) {
    this.setBGImage([1], documentName)
    const loading = $(`<div class="loader"><i class="fa fa-4x fa-spinner fa-spin"></i>${game.i18n.localize('Library.buildingIndex')}</div>`)
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
    actions: {},

    classes: ["dsa5"]
  };
  
  static PARTS = {
    modules: {
        template: "systems/dsa5/templates/system/librarymodulesfilter.hbs"
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
