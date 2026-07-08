import DSA5_Utility from '../helpers/utility-dsa5.js';
import ADVANCEDFILTERS from './itemlibrary_advanced_filters.js';
import { clickableAbility, tabSlider } from '../helpers/view_helper.js';
import { applyFontSize, getFontSizeLabel, showFontSizeContextMenu } from '../helpers/font-size-picker.js';
import ItemLibraryIndexLoader from './itemlibrary/indexLoader.js';
import DSASystemConfiguration from './itemlibrary/systemConfiguration.js';
import SearchDocument, { AdvancedSearchDocument } from './itemlibrary/searchDocument.js';
import LibraryModulsFilter from './itemlibrary/libraryModulesFilter.js';
import ItemLibraryModuleOptions from './itemlibrary/moduleOptions.js';
import ItemLibraryListColumns from './itemlibrary/listColumns.js';

const { duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

const VIEW_MODES = ['compact', 'browse', 'list'];

//todo check if items on index have permission

export class ItemLibraryBase extends foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.api.ApplicationV2) {
  pageSize = 60
  filterLimit = 10000

  searchDebounceMs = 200

  viewMode = 'list'

  listSort = { column: 'name', direction: 'asc' }

  resultCounts = {}

  _hoverToken = 0

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
      height: 720,
      width: 960
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
      searchableAbility: ItemLibraryBase._onSearchableAbility,
      selectLibraryView: ItemLibraryBase.prototype._selectLibraryView,
      sortListColumn: ItemLibraryBase.prototype._sortListColumn,
      showCompendiumFilter: ItemLibraryBase._showCompendiumFilter,
      selectListFontSize: ItemLibraryBase.prototype._selectListFontSize,
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

    this.viewMode = this.getDefaultViewMode();
    if (!VIEW_MODES.includes(this.viewMode)) this.viewMode = 'list';

    this._debouncedFilterItems = foundry.utils.debounce((category) => {
      this.filterItems(category);
    }, this.searchDebounceMs);

    this.indexLoader = ItemLibraryIndexLoader.getShared();
    this._cachedListItems = {};
    this._initPromise = null;

    this._initLibrary();
  }

  _getMainItemLibrary() {
    const main = game.dsa5?.itemLibrary;
    return main && main !== this ? main : null;
  }

  _linkIndexStateFrom(source) {
    this.indexes = source.indexes;
    this.detailFilter = source.detailFilter;
    this.detailStoreBySubcategory = source.detailStoreBySubcategory;
    this.candidateUuidsBySubcategory = source.candidateUuidsBySubcategory;
  }

  _initLibrary() {
    if (!this._initPromise) {
      this._initPromise = (async () => {
        await this.loadSystemSpecificConfig();
        this.prepareDataModels();
        const owner = this._getMainItemLibrary();
        if (owner) {
          await owner.whenReady();
          this._linkIndexStateFrom(owner);
        } else {
          this.prepareIndexes();
        }
      })();
    }
    return this._initPromise;
  }

  whenReady() {
    return this._initLibrary();
  }

  get embedded() {
    return false;
  }

  getMountTarget() {
    return null;
  }

  getDefaultViewMode() {
    return game.settings.get('dsa5', 'itemLibraryViewMode') || 'list';
  }

  _attachToMountTarget() {
    const mount = this.getMountTarget();
    if (!mount || !this.element) return;
    if (this.element.parentElement !== mount) {
      mount.replaceChildren(this.element);
    }
    this.element.classList.add('itemlibrary-embedded-root');
    if (this.embedded) {
      this.element.classList.add('tooltipConnector');
      this.element.dataset.tooltipDirection = 'LEFT';
    }
  }

  _getLibraryTooltipAnchor(target) {
    if (!this.embedded) return target;
    return target.closest('.tooltipConnector') || this.element || target;
  }

  static _onSearchableAbility(ev, target) {
    clickableAbility(target);
  }

  static _showCompendiumFilter(_event, _target) {
    new LibraryModulsFilter().render(true);
  }

  _selectLibraryView(ev, target) {
    const view = target.dataset.view;
    if (!VIEW_MODES.includes(view) || this.viewMode === view) return;

    this.viewMode = view;
    game.settings.set('dsa5', 'itemLibraryViewMode', view);

    const group = target.closest('.itemlibrary-view-toggle');
    if (group) {
      for (const btn of group.querySelectorAll('[data-action="selectLibraryView"]')) {
        const active = btn.dataset.view === view;
        btn.classList.toggle('active', active);
        btn.classList.toggle('on', active);
        btn.ariaPressed = `${active}`;
      }
    }

    const category = $(this.element).find('.tab.active')[0]?.dataset.tab;
    if (category) this.filterItems(category);
    this._syncViewModeAttribute();
  }

  _syncViewModeAttribute() {
    const mode = this.getEffectiveViewMode();
    this.element?.setAttribute('data-view-mode', mode);
    for (const el of this.element?.querySelectorAll('.itemlibrary-font-size') ?? []) {
      el.hidden = mode !== 'list';
    }
  }

  applyListFontSize(root = this.element) {
    const tables = root?.querySelectorAll('.library-list-table');
    if (!tables?.length) return;
    const index = game.settings.get('dsa5', 'itemLibraryListFontSizeIndex');
    applyFontSize($(tables), index);
  }

  _updateListFontSizeLabel(index) {
    const label = getFontSizeLabel(index);
    for (const btn of this.element?.querySelectorAll('.itemlibrary-font-size__button') ?? []) {
      const tooltip = `${game.i18n.localize('Library.listFontSize')} (${label})`;
      btn.dataset.tooltip = tooltip;
      btn.setAttribute('aria-label', tooltip);
    }
  }

  async _selectListFontSize(_ev, target) {
    await showFontSizeContextMenu(
      $(this.element).find('.library-list-table'),
      'itemLibraryListFontSizeIndex',
      target,
      { onSelect: index => this._updateListFontSizeLabel(index) },
    );
  }

  _sortListColumn(ev, target) {
    const th = target.closest('th[data-sort-col]') ?? target;
    if (!th?.dataset.sortCol || th.dataset.sortable !== 'true') return;

    const column = th.dataset.sortCol;
    if (this.listSort.column === column) {
      this.listSort.direction = this.listSort.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.listSort = { column, direction: 'asc' };
    }

    const category = $(this.element).find('.tab.active')[0]?.dataset.tab;
    if (category && this._cachedListItems[category]) {
      this.renderResult(this._cachedListItems[category], category, false);
    }
  }

  getPageSize() {
    return this.getEffectiveViewMode() === 'list' ? 100 : this.pageSize;
  }

  getEffectiveViewMode(tab) {
    const activeTab = tab ?? $(this.element)?.find('.tab.active')[0]?.dataset.tab;
    if (this.viewMode === 'browse' && activeTab === 'JournalEntries') return 'compact';
    return this.viewMode;
  }

  async loadSystemSpecificConfig() {
    this.systemConfiguration = DSASystemConfiguration
    this.systemConfiguration.initialize()
    this.fullTextSearch = game.settings.get("dsa5", "indexDescription") && this.systemConfiguration.hasDescription
    try {
      this.listColumnConfig = await foundry.utils.fetchJsonWithTimeout(
        'systems/dsa5/modules/system/guiapps/itemlibrary/list_columns.json'
      );
    } catch (err) {
      console.warn('DSA5 | ItemLibrary: Could not load list_columns.json', err);
      this.listColumnConfig = {};
    }
  }

  prepareIndexes() {
    this.indexes = {}
    this.detailFilter = {}
    this.detailStoreBySubcategory = {}
    this.candidateUuidsBySubcategory = {}
    this.detailEnrichmentInFlight = {}

    for (const className of this.systemConfiguration.documentNames) {
      const fields = this.systemConfiguration.getSearchFields(className, undefined, this.fullTextSearch).index

      this.indexes[className] = {
        documentName: className,
        search: "",
        index: null,
        store: {},
        build: false,
        worldBuild: false,
        next: undefined,
        workerReady: false,
        buildToken: 0
      }
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options)
    data.isGM = game.user.isGM
    data.models = this.models
    data.viewMode = this.getEffectiveViewMode()

    data.listFontSizeLabel = getFontSizeLabel(game.settings.get('dsa5', 'itemLibraryListFontSizeIndex'));

    if (this.advancedFiltering) {
      data.advancedFilter = await this.buildDetailFilter('none', 'none');
    }

    this.prepareSettings(data)
    return data
  }

  _getExcludedTabIds() {
    if (this.embedded) return ['Actors', 'JournalEntries'];
    if (!game.user.isGM) return ['Actors'];
    return [];
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    for (const id of this._getExcludedTabIds()) delete tabs[id];
    return tabs;
  }

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    for (const id of this._getExcludedTabIds()) delete parts[id];
    return parts;
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
      filterDuplicateItems: {
        icon: "fa-filter",
        val: game.settings.get('dsa5', 'filterDuplicateItems')
      },
      moduleFilter: {
        icon: "fa-cubes",
        dialog: true,
      }
    }
  }

  async applyLibrarySetting(key) {
    let val
    const html = $(this.element)
    switch (key) {
      case "advanced":
        val = !this.advancedFiltering
        this.advancedFiltering = val
        if (this.advancedFiltering) {
          html.find('.itemlibrary-sidebar').fadeIn();
          await this.setAdvancedFilters();
        } else {
          html.find('.itemlibrary-sidebar').fadeOut();
        }
        {
          const category = html.find('.tab.active')[0]?.dataset.tab;
          if (category) this.syncCategoryChipStates(category);
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
      case "filterDuplicateItems":
        val = !game.settings.get('dsa5', 'filterDuplicateItems')
        await game.settings.set('dsa5', 'filterDuplicateItems', val)
        {
          const category = html.find('.tab.active')[0]?.dataset.tab;
          if (category) await this.filterItems(category);
        }
        break
      case "moduleFilter":
        DSA5ItemLibrary._showCompendiumFilter();
        return
      default:
        return
    }

    return { key, val }
  }

  async onChangeSetting(ev) {
    const result = await this.applyLibrarySetting(ev.currentTarget.dataset.key)
    if (!result) return

    const { val } = result
    $(ev.currentTarget).toggleClass('on', val).toggleClass('active', val)
    ev.currentTarget.ariaPressed = `${!!val}`;
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
          label: game.i18n.has(langKey) ? _loc(langKey) : key,
          selected: false,
          key
        })
      }
    }
    for (const key of Object.keys(this.models)) {
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
    for (const key in this.models) {
      for (const subkey of this.models[key]) {
        subkey.selected = false;
      }
    }
    const html = $(this.element)
    html.find('.filter[type="checkbox"]').prop('checked', false);
    html.find('.library-filter-chip').removeClass('active');
    const templ = await this.buildDetailFilter('none', 'none')
    html.find('.itemlibrary-sidebar .advancedSearchContent').html(templ);
  }

  syncCategoryChipStates(tab) {
    if (!this.element) return;
    const tabEl = $(this.element).find(`[data-tab="${tab}"]`);
    for (const chip of tabEl.find('.library-filter-chip')) {
      const input = chip.querySelector('.filter');
      const key = input?.dataset.type;
      const selected = this.models[tab]?.find(x => x.key === key)?.selected ?? false;
      input.checked = selected;
      chip.classList.toggle('active', selected);
    }
  }

  async _syncAdvancedSidebarForTab(tab) {
    if (!this.advancedFiltering) return;
    const html = $(this.element);
    const selected = this.models[tab]?.filter(x => x.selected) || [];
    if (selected.length === 1) {
      const input = html.find(`[data-tab="${tab}"] .filter[data-type="${selected[0].key}"]`)[0];
      if (input) {
        const { category, type } = input.dataset;
        const template = await this.buildDetailFilter(category, type);
        html.find(`[data-tab="${tab}"] .itemlibrary-sidebar .advancedSearchContent`).html(template);
      }
    } else {
      html.find(`[data-tab="${tab}"] .itemlibrary-sidebar .advancedSearchContent`).empty();
    }
  }

  async selectSingleCategory(category, type, tab) {
    const html = $(this.element);
    html.find(`[data-tab="${tab}"] .filterCategories .filter`).prop('checked', false);
    html.find(`[data-tab="${tab}"] .library-filter-chip`).removeClass('active');
    for (const m of this.models[tab] ?? []) {
      m.selected = false;
    }

    const input = html.find(`[data-tab="${tab}"] .filter[data-type="${type}"]`)[0];
    if (!input) return;
    input.checked = true;
    const model = this.models[tab]?.find(x => x.key === type);
    if (model) model.selected = true;
    $(input).closest('.library-filter-chip').addClass('active');

    if (this.advancedFiltering) {
      const dataFilters = this._getDetailFilters(tab);
      const subcategory = dataFilters.attr('data-subc');
      if (subcategory && this.detailFilter[subcategory]) {
        this.detailFilter[subcategory].next = undefined;
      }
      const template = await this.buildDetailFilter(category, type);
      html.find(`[data-tab="${tab}"] .itemlibrary-sidebar .advancedSearchContent`).html(template);
    }

    await this.filterItems(tab);
  }

  async _onCategoryContextMenu(ev) {
    ev.preventDefault();
    const chip = ev.currentTarget.closest?.('.library-filter-chip') ?? ev.currentTarget;
    const input = chip.querySelector?.('.filter');
    if (!input) return;
    const { category, type } = input.dataset;
    const tab = $(chip).closest('.tab').data('tab');

    input.checked = !input.checked;
    const isChecked = input.checked;
    const model = this.models[tab]?.find(x => x.key === type);
    if (model) model.selected = isChecked;
    chip.classList.toggle('active', isChecked);

    if (this.advancedFiltering) {
      const dataFilters = this._getDetailFilters(tab);
      const subcategory = dataFilters.attr('data-subc');
      if (subcategory && this.detailFilter[subcategory]) {
        this.detailFilter[subcategory].next = undefined;
      }
      await this._syncAdvancedSidebarForTab(tab);
    }

    await this.filterItems(tab);
  }

  async getRandomItems(category, limit) {
    const filteredItems = await this.flattenedResults(this.indexes.Item, '', { tag: category, limit: this.filterLimit });

    const shuffledItems = this.shuffle(filteredItems)
      .slice(0, limit + 5)
      .map(x => this._getStoredObject(this.indexes.Item, x));

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

    const result = await this.flattenedResults(this.indexes.Item, search, query);
    let items = result.map(x => this._getStoredObject(this.indexes.Item, x));

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
    const items = indexResults.map(x => this._getStoredObject(this.indexes.Item, x));

    if (!asItemData && !asItem) return items;

    const documents = await Promise.all(items.map(x => fromUuid(x.uuid)));
    return asItemData ? documents.map(x => x.toObject()) : documents;
  }

  async executeAdvancedFilter(search, indexWrapper, selectSearches, textSearches, booleanSearches, rangeSearches = [], startIndex = 0, returnAll = false) {
    const store = indexWrapper?.store || indexWrapper?.index?.store;
    if (!store) return [];

    const candidates = indexWrapper?.candidates;
    const values = candidates?.length ? candidates.map(uuid => store[uuid]).filter(Boolean) : Object.values(store);

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

    const allResults = values
      .filter(filterFunction)
      .sort((a, b) => a.name.toLowerCase().localeCompare(b.name.toLowerCase()));

    const paginatedResults = returnAll ? allResults : allResults.slice(
      startIndex,
      Math.min(startIndex + (returnAll ? allResults.length : this.getPageSize()), allResults.length)
    );

    if (indexWrapper) {
      indexWrapper.next = startIndex + this.getPageSize() < allResults.length ?
        startIndex + this.getPageSize() :
        undefined;
      indexWrapper.totalResults = allResults.length;
      indexWrapper.shownResults = Math.min(startIndex + paginatedResults.length, allResults.length);
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
    const dataFilters = this._getDetailFilters(documentGroup);
    const subcategory = dataFilters.attr('data-subc');
    const search = this._syncSearchFromInput(documentGroup).toLowerCase();

    if (!subcategory) {
      return await this.filterStuff(documentGroup, page);
    }

    if (subcategory) {
      const indexWrapper = this.detailFilter[subcategory];
      const { sels: selectSearches, inps: textSearches, checkboxes: booleanSearches } = this.collectDetailSearch(dataFilters);
      const startIndex = Number(page) || 0;

      const result = await this.executeAdvancedFilter(search, indexWrapper, selectSearches, textSearches, booleanSearches, [], startIndex);
      this.resultCounts[documentGroup] = {
        shown: indexWrapper?.shownResults ?? result.length,
        total: indexWrapper?.totalResults ?? result.length,
      };
      this.setBGImage(result, documentGroup);
      return this.filterDuplications(result);
    }
  }

  async findEquipmentItemDetailed(search, category, filterCompendium = true) {
    await this.buildDetailFilter('Item', category);

    const indexWrapper = this.detailFilter[category];

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
    item.sheet.render(true);
  }

  _syncSearchFromInput(tab) {
    const input = this.element?.querySelector('.filterBy-search');
    const query = input?.value ?? '';
    this.findIndex(tab).search = query;
    return query;
  }

  _getDetailFilters(tab) {
    const activeTab = tab ?? this.element?.querySelector('.tab.active')?.dataset?.tab;
    if (!activeTab) return $();
    return $(this.element).find(`[data-tab="${activeTab}"] .detailFilters`).first();
  }

  _beginFreshFilter(tab) {
    const { index } = this.selectIndex(tab);
    index.next = undefined;
    index._resultUuids = undefined;
    index._resultCacheKey = undefined;
    this._cachedListItems[tab] = undefined;
    this._paginationInFlight = false;
    const scrollRoot = this.getScrollRoot(tab);
    if (scrollRoot) scrollRoot.scrollTop = 0;
  }

  async _ensureSearchResults(index, search, searchParams) {
    const cacheKey = JSON.stringify({ search, tag: searchParams.tag ?? null });
    if (index._resultCacheKey !== cacheKey || !index._resultUuids) {
      index._resultUuids = await this.flattenedResults(
        index,
        search,
        { ...searchParams, limit: this.filterLimit }
      );
      index._resultCacheKey = cacheKey;
    }
    return index._resultUuids;
  }

  async filterStuff(category, page) {
    const { index, itemType } = this.selectIndex(category);
    const search = this._syncSearchFromInput(category);
    const fields = this.systemConfiguration.getSearchFields(itemType, undefined, this.fullTextSearch);
    const collectTags = this.models[category]?.filter(x => x.selected).map(x => x.key) || [];
    const startIndex = Number(page) || 0;

    const pageSize = this.getPageSize();
    const searchParams = { ...fields };
    if (collectTags.length > 0) {
      searchParams.tag = collectTags;
    }

    const searchResults = await this._ensureSearchResults(index, search, searchParams);

    const paginatedResults = searchResults.slice(
      startIndex,
      Math.min(startIndex + pageSize, searchResults.length)
    );

    index.next = startIndex + pageSize < searchResults.length ?
      startIndex + pageSize :
      undefined;

    const filteredItems = this.filterDuplications(
      paginatedResults.map(x => this._getStoredObject(index, x))
    );

    this.resultCounts[category] = {
      shown: startIndex + filteredItems.length,
      total: searchResults.length
    };

    this.setBGImage(filteredItems, category);

    return filteredItems;
  }

  async changeTab(tab, group, options) {
    await this.whenReady();
    super.changeTab(tab, group, options)

    const input = this.element?.querySelector('.filterBy-search');
    if (input) input.value = this.findIndex(tab).search ?? '';
    this._beginFreshFilter(tab);

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

    if (this.advancedFiltering) await this._syncAdvancedSidebarForTab(tab);
    await this.filterItems(tab);
    this._syncViewModeAttribute();
  }

  setBGImage(filterdItems, category) {
    $(this.element).find(`[data-tab="${category}"] .libcontainer`)[`${filterdItems.length ? "remove" : "add"}Class`]("libraryImg")
  }

  getListColumns(tab) {
    const config = ItemLibraryListColumns.getListColumnConfig();
    const defaultConfig = config._default ?? {};
    const selected = this.models[tab]?.filter(x => x.selected) || [];
    const showPrice = tab === 'Items' && (
      selected.length === 1
        ? ItemLibraryListColumns.typeHasPrice(selected[0].key)
        : selected.some(x => ItemLibraryListColumns.typeHasPrice(x.key))
    );

    const leading = (defaultConfig.leading ?? ['img', 'name']).map(id => ({ ...ItemLibraryListColumns.BUILTIN_COLUMN_DEFS[id] }));
    let middle = [];
    let tail = [];

    if (selected.length === 1) {
      const type = selected[0].key;
      middle = ItemLibraryListColumns.getTypeListColumns(type).map(col => ItemLibraryListColumns.resolveColumnFieldDef(col));
      if (showPrice) tail.push({ ...ItemLibraryListColumns.BUILTIN_COLUMN_DEFS.price });
    } else {
      let multi = [...(defaultConfig.multi ?? ['type'])].filter(id => id !== 'price');
      if (showPrice) multi.push('price');
      middle = multi.map(id => ({ ...ItemLibraryListColumns.BUILTIN_COLUMN_DEFS[id] })).filter(col => col.id);
    }

    return [...leading, ...middle, ...tail].map(col => ({
      ...col,
      sorted: this.listSort.column === col.id,
      sortDir: this.listSort.column === col.id ? this.listSort.direction : 'asc',
    }));
  }

  resolveCompendiumLabel(packId) {
    if (!packId) return _loc('Library.worldItem');
    const pack = game.packs.get(packId);
    if (pack) {
      const moduleId = pack.metadata.packageName;
      return `${pack.metadata.label} [${moduleId}]`;
    }
    const moduleId = packId.includes('.') ? packId.split('.')[0] : packId;
    return `${packId} [${moduleId}]`;
  }

  resolveTypeLabel(documentName, type) {
    const langKey = `TYPES.${documentName}.${type}`;
    return game.i18n.has(langKey) ? _loc(langKey) : type;
  }

  formatPlantTypesCell(planttype) {
    if (!planttype || typeof planttype !== 'object') return '-';
    const active = ItemLibraryListColumns.PLANT_TYPE_KEYS.filter(key => planttype[key]);
    if (!active.length) return '-';
    return active.map(name => {
      const tip = _loc(`PLANT.${name}`);
      return `<span class="plantContainer ${name} library-list-plant-type" data-tooltip="${foundry.utils.escapeHTML(tip)}"><span></span></span>`;
    }).join('');
  }

  formatListCellValue(item, column) {
    const raw = item[column.id];
    if (raw === undefined || raw === null || raw === '') return '-';

    if (column.columnType === 'plantTypes') {
      return this.formatPlantTypesCell(raw);
    }

    if (column.raw) return String(raw) || '-';

    const options = column.optionsKey ? ItemLibraryListColumns.getColumnOptions(column) : column.fieldDef?.options;
    if (options && options[raw] !== undefined) {
      const label = options[raw];
      if (typeof label === 'string' && game.i18n.has(label)) return _loc(label);
      return String(label) || '-';
    }

    if (typeof raw === 'number' && column.attr?.endsWith('mod.value')) {
      return raw > 0 ? `+${raw}` : String(raw);
    }

    return String(raw) || '-';
  }

  prepareRenderItems(items, tab) {
    const { itemType } = this.selectIndex(tab);
    const columns = this.getEffectiveViewMode(tab) === 'list' ? this.getListColumns(tab) : [];

    const prepared = items.map(item => {
      const row = {
        ...item,
        compendiumLabel: this.resolveCompendiumLabel(item.compendium),
        typeLabel: this.resolveTypeLabel(itemType, item.type),
      };

      for (const col of columns) {
        if (['img', 'name', 'type', 'compendium', 'price', 'typeLabel', 'compendiumLabel'].includes(col.id)) continue;
        row[col.id] = this.formatListCellValue(item, col);
      }
      return row;
    });

    if (this.getEffectiveViewMode(tab) === 'list' && this.listSort.column) {
      const col = this.listSort.column;
      const dir = this.listSort.direction === 'desc' ? -1 : 1;
      prepared.sort((a, b) => {
        const av = (col === 'type' ? a.typeLabel : col === 'compendium' ? a.compendiumLabel : a[col]) ?? '';
        const bv = (col === 'type' ? b.typeLabel : col === 'compendium' ? b.compendiumLabel : b[col]) ?? '';
        return String(av).localeCompare(String(bv), game.i18n.lang, { sensitivity: 'base' }) * dir;
      });
    }

    return prepared;
  }

  updateResultCount(category) {
    const counts = this.resultCounts[category];
    const el = $(this.element).find(`[data-tab="${category}"] [data-result-count]`);
    if (!el.length) return;
    if (!counts?.total) {
      el.text('');
      return;
    }
    el.text(_loc('Library.resultCount', { shown: counts.shown, total: counts.total }));
  }

  async getItemTemplate(filteredItems, itemType) {
    const viewMode = this.getEffectiveViewMode(itemType);
    const items = this.prepareRenderItems(filteredItems, itemType);

    if (viewMode === 'browse' && ['Items', 'Actors', 'Character', 'Religion'].includes(itemType)) {
      return items.map(x => {
        return `<li class="uuid libItem loader col center library-item" data-uuid="${x.uuid}"><i class="fas fa-spinner fa-spin fa-4x"></i></li>`
      }).join("")
    }

    if (viewMode === 'list') {
      const columns = this.getListColumns(itemType);
      return await renderTemplate('systems/dsa5/templates/system/itemlibrary/parts/libraryItemList.hbs', { items, columns });
    }

    return await renderTemplate('systems/dsa5/templates/system/itemlibrary/parts/libraryItem.hbs', { items });
  }

  getScrollRoot(category) {
    const tab = $(this.element).find(`[data-tab="${category}"]`);
    const results = tab.find('.dsa-choice-browser__results')[0];
    return results ?? $(this.element).find('.window-content')[0];
  }

  getObserver(itemType) {
    const root = this.getScrollRoot(itemType);
    const index = this.findIndex(itemType);
    if (index.observer) index.observer.disconnect();
    index.observer = new IntersectionObserver(this.intersectionObserved.bind(this), { root });
    return index.observer;
  }

  async renderBrowseItem(uuid) {
    const document = await fromUuid(uuid)
    const template = `systems/dsa5/templates/items/browse/${document.type}.hbs`
    const item = await renderTemplate(template, { document, isGM: game.user.isGM, ...(await document.sheet._prepareContext()) })
    return `<li class="uuid libItem ${document.type} col library-item browser-item" draggable="true" data-uuid="${uuid}">${item}</li>`
  }

  intersectionObserved(entries, observer) {
    for (const entry of entries) {
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
    if (isPaged) {
      this._cachedListItems[category] = [...(this._cachedListItems[category] || []), ...filteredItems];
    } else {
      this._cachedListItems[category] = filteredItems;
    }
    const allItems = this._cachedListItems[category];
    const tabEl = $(this.element).find(`[data-tab="${category}"]`);
    const searchResult = tabEl.find('.searchResult');
    const viewMode = this.getEffectiveViewMode(category);
    searchResult.attr('data-view-mode', viewMode);
    this.updateResultCount(category);

    const html = await this.getItemTemplate(isPaged ? filteredItems : allItems, category);

    if (viewMode === 'list') {
      if (!isPaged) searchResult.html(html);
      else searchResult.find('.library-list-table tbody').append($(html).find('tbody').children());
      this.applyListFontSize(searchResult[0]);
      return;
    }

    let resultField = searchResult.find('.item-list');
    if (!resultField.length) {
      searchResult.html(`<ul class="item-list" data-view-mode="${viewMode}"></ul>`);
      resultField = searchResult.find('.item-list');
    }
    resultField.attr('data-view-mode', viewMode);

    const innerhtml = $(html);
    if (!isPaged) resultField.html(innerhtml);
    else resultField.append(innerhtml);

    const items = resultField.find('.loader');
    if (items.length > 0) {
      const observer = this.getObserver(category);
      for (const item of items) observer.observe(item);
    }
  }

  async filterItems(documentGroup, page) {
    if (page === undefined || page === null) {
      this._beginFreshFilter(documentGroup);
    }

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
    index.store = {};
    index.buildToken = this.indexLoader?.bumpBuildToken?.() || (index.buildToken + 1);
    const filteredCompendiums = game.settings.get("dsa5", "libraryModulsFilter");
    const progress = ui.notifications.info('Library.loading', { format: { item: "" }, progress: true });
    this.showLoading(documentName);

    const packs = game.packs.filter(p =>
      p.documentName === documentName &&
      (game.user.isGM || p.visible) &&
      !filteredCompendiums[p.metadata.packageName]
    );

    index.workerReady = false;
    if (!this.indexLoader?.enabled) {
      this.hideLoading(documentName);
      index.build = false;
      ui.notifications.error('DSA5 | ItemLibrary: Worker indexing unavailable');
      return;
    }

    const fields = this.systemConfiguration.getSearchFields(documentName, undefined, this.fullTextSearch).index;
    await this.indexLoader.reset({ documentName, token: index.buildToken });
    const ok = await this.indexLoader.ensureIndex({
      documentName,
      fields,
      fullTextSearch: this.fullTextSearch,
      token: index.buildToken
    });
    index.workerReady = !!ok;
    if (!index.workerReady) {
      this.hideLoading(documentName);
      index.build = false;
      ui.notifications.error('DSA5 | ItemLibrary: Worker indexing failed');
      return;
    }

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
        ? p => p.getDocuments()
        : p => p.getDocuments({ type__in: Object.keys(game.system.documentTypes.Item).filter(x => x != 'information') });

    await Promise.all(packs.map(async (p, i) => {
      if (i > 2) {
        await new Promise(resolve => setTimeout(resolve, 50 * (i % 3)));
      }

      const documents = await getDocumentsFunction(p);

      const batch = [];
      const BATCH_SIZE = 200;
      for (const item of documents) {
        const so = SearchDocument.toSearchableObject(item, documentName);
        index.store[so.uuid] = so;
        batch.push(so);

        if (batch.length >= BATCH_SIZE) {
          await this.indexLoader.addBatch({ documentName, batch, token: index.buildToken });
          batch.length = 0;
        }
      }

      if (batch.length) {
        await this.indexLoader.addBatch({ documentName, batch, token: index.buildToken });
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
    const field = ['name', 'type'];
    const attrs = ADVANCEDFILTERS[subcategory] || [];
    for (const attr of attrs) {
      field.push(attr.attr);
    }
    return field;
  }

  async indexWorldItems(worldItems, documentName) {
    if (game.settings.get('dsa5', 'indexWorldItems')) {
      for (const item of worldItems.filter(x => x.visible)) {
        const wrapper = this.findIndex(documentName);
        const so = SearchDocument.toSearchableObject(item, documentName);
        wrapper.store[so.uuid] = so;
        if (wrapper.workerReady) await this.indexLoader.addBatch({ documentName, batch: [so], token: wrapper.buildToken });
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
    if (!this.indexes) return { index: undefined, itemType };
    return { index: this.indexes[itemType], itemType };
  }

  async flattenedResults(index, search, args) {
    if (!this.indexLoader?.enabled || !index?.workerReady) return [];
    const token = index.buildToken;
    const res = await this.indexLoader.search({
      documentName: index.documentName,
      query: search,
      args,
      token
    });
    if (index.buildToken !== token) return [];
    return res;
  }

  _getStoredObject(indexWrapper, uuid) {
    return indexWrapper?.store?.[uuid];
  }

  async createDetailIndex(category, subcategory) {
    if (this.detailEnrichmentInFlight?.[subcategory]) return this.detailEnrichmentInFlight[subcategory];
    if (this.detailFilter[subcategory]) return;

    const promise = this._createDetailIndexInternal(category, subcategory);
    this.detailEnrichmentInFlight[subcategory] = promise;
    try {
      return await promise;
    } finally {
      delete this.detailEnrichmentInFlight[subcategory];
    }
  }

  async _createDetailIndexInternal(category, subcategory) {
    const { itemType } = this.selectIndex(category);
    if (itemType === 'Item') await this.buildItemIndex();
    else if (itemType === 'Actor') await this.buildActorIndex();

    this.detailStoreBySubcategory[subcategory] = this.detailStoreBySubcategory[subcategory] || {};

    const { index } = this.selectIndex(category);
    const catName = _loc(`TYPES.${itemType}.${subcategory}`);
    const progress = ui.notifications.info('Library.loading', { format: { item: catName }, progress: true });
    const target = $(this.element).find(`*[data-tab="${category}"]`);

    target.find('.searchResult').empty().append('<ul class="item-list"></ul>');
    this.showLoading(target, category);

    this.detailFilter[subcategory] = {
      search: "",
      store: this.detailStoreBySubcategory[subcategory],
      candidates: [],
      next: undefined
    };

    // Fill world items directly (cheap) and cache.
    if (game.settings.get('dsa5', 'indexWorldItems')) {
      const worldStuff = itemType === 'Item' ? game.items : game.actors;
      for (const doc of worldStuff.filter(x => x.visible && x.type === subcategory)) {
        const enriched = AdvancedSearchDocument.toSearchableObject(doc, subcategory);
        this.detailStoreBySubcategory[subcategory][enriched.uuid] = enriched;
      }
    }

    progress.update({ message: 'Library.loading', format: { item: catName }, pct: 0.1 });
    const uuids = await this.flattenedResults(index, '', { tag: [subcategory], limit: this.filterLimit });
    this.candidateUuidsBySubcategory[subcategory] = uuids;
    this.detailFilter[subcategory].candidates = uuids;

    const BATCH_SIZE = 25;
    const compendiumUuids = uuids.filter(uuid => uuid.startsWith('Compendium'));
    const totalBatches = Math.ceil(compendiumUuids.length / BATCH_SIZE);

    for (let i = 0; i < totalBatches; i++) {
      const batchUuids = compendiumUuids.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
      const missingUuids = batchUuids.filter(uuid => !this.detailStoreBySubcategory[subcategory][uuid]);
      const batchItems = await Promise.all(missingUuids.map(uuid => fromUuid(uuid)));

      for (const item of batchItems.filter(Boolean)) {
        const enriched = AdvancedSearchDocument.toSearchableObject(item, subcategory);
        this.detailStoreBySubcategory[subcategory][enriched.uuid] = enriched;
      }

      const progressPct = Math.min(0.1 + 0.8 * ((i + 1) / totalBatches), 0.9);
      progress.update({
        message: 'Library.loading',
        format: { item: `${catName} (${Math.min((i + 1) * BATCH_SIZE, compendiumUuids.length)}/${compendiumUuids.length})` },
        pct: progressPct
      });

      if (i < totalBatches - 1) {
        await new Promise(resolve => setTimeout(resolve, 0));
      }
    }

    this.hideLoading(target, category);
    progress.update({ message: 'Library.loading', format: { item: catName }, pct: 1 });
  }

  async buildDetailFilter(category, subcategory, savedSettings = undefined) {
    if (category === 'none') {
      return `<p>${_loc('Library.selectAdvanced')}</p>`;
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

    const moduleOptions = ItemLibraryModuleOptions.collect('.')
    const template = await renderTemplate(
      'systems/dsa5/templates/system/itemlibrary/parts/detailFilter.hbs',
      { fields, subcategory, moduleOptions, moduleSelected }
    );
    await indexPromise;
    return template;
  }

  itemDragStart(ev) {
    ev.stopPropagation()
    const target = ev.target.closest('.library-item') ?? ev.target;
    if (!target?.dataset?.uuid) return;
    $(this.element).animate({ opacity: 0.2 }, 100);
    const uuid = target.dataset.uuid
    const pay = target.dataset.pay
    const { type } = foundry.utils.parseUuid(uuid);
    ev.dataTransfer.setData("text/plain", JSON.stringify({ type, uuid, dragSource: "itemlibrary", pay }));
    target.addEventListener("dragend", () => {
      window.setTimeout(() => $(this.element).animate({ opacity: 1 }, 300, () => $(this.element).css({ pointerEvents: "" })))
    }, { once: true });
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element)
    tabSlider(html);
    this._syncViewModeAttribute();
    if (this.getEffectiveViewMode() === 'list') this.applyListFontSize();
    const source = this
    this._debouncedInfiniteScroll ||= foundry.utils.debounce(ev => this._infiniteScroll(ev, source), 100);
    html.find('.filterCategories .filter').on('change', ev => this.filterChanged(ev))
    html.on('contextmenu', '.library-filter-chip', ev => this._onCategoryContextMenu(ev))
    html.find('.changeSettings').on('click', (ev) => this.onChangeSetting(ev))
    html.find(".filterBy-search").on('keyup', ev => this._onFilterBySearch(ev))
    html.on("mousedown", ".searchResult .library-item", ev => this._onItemNameClick(ev))
    html.on("mouseenter", ".searchResult .library-item", ev => this._onItemHover(ev))
    html.on("mouseleave", ".searchResult .library-item", () => this._onItemHoverLeave())
    html.on('click', ".searchResult .library-item", ev => this._openItem(ev))
    this.element.addEventListener("dragstart", this.itemDragStart.bind(this));
    html.find('.dsa-choice-browser__results.scrollable').on('scroll.infinit', this._debouncedInfiniteScroll);
    this.element.addEventListener("dragover", ev => this._onDragOver(ev));
    html.on('change', '.detailFilters input, .detailFilters select', (ev) => {
      const category = $(this.element).find('.tab.active')[0].dataset.tab;

      if (this.advancedFiltering) {
        const subcategory = $(ev.currentTarget).closest('.detailFilters').attr('data-subc');
        if (subcategory && this.detailFilter[subcategory]) {
          this.detailFilter[subcategory].next = undefined;
        }
      }

      this._debouncedFilterItems(category);
    });

    this.buildItemIndex();
    this._attachToMountTarget();
  }

  async _onItemHover(ev) {
    const target = ev.currentTarget;
    const hoverToken = ++this._hoverToken;
    const uuid = target.dataset.uuid;
    const item = await fromUuid(uuid);
    if (hoverToken !== this._hoverToken) return;

    if (item.documentName == "JournalEntry") return;

    let tooltip = await item.toEmbed({}, { skipHeader: true });
    if (hoverToken !== this._hoverToken) return;

    if (!tooltip) tooltip = await this.systemConfiguration.renderTooltip(item);
    if (hoverToken !== this._hoverToken || !target.matches(':hover')) return;

    const tooltipTarget = this._getLibraryTooltipAnchor(target);
    game.tooltip.activate(tooltipTarget, {
      html: tooltip,
      cssClass: 'itemLibraryTooltip',
    });
  }

  _onItemHoverLeave() {
    game.tooltip.deactivate();
  }

  _infiniteScroll(ev, source) {
    if (this._paginationInFlight) return;
    const log = $(ev.target);
    const pct = (log.scrollTop() + log.innerHeight()) >= log[0].scrollHeight - 100;

    if (!pct) return;

    const category = $(this.element).find('.tab.active')[0].dataset.tab;

    if (source.advancedFiltering) {
      const dataFilters = source._getDetailFilters(category);
      const subcategory = dataFilters.attr('data-subc');

      if (subcategory) {
        const next = source.detailFilter[subcategory]?.next;
        if (next === undefined) return;
        this._paginationInFlight = true;
        source.filterItems.call(source, category, next)
          .finally(() => { this._paginationInFlight = false; });
        return;
      }
      const documentName = source.systemConfiguration.documentNameFromGroup(category);
      const next = source.indexes[documentName]?.next;
      if (next === undefined) return;
      this._paginationInFlight = true;
      source.filterItems.call(source, category, next)
        .finally(() => { this._paginationInFlight = false; });
    } else {
      const documentName = source.systemConfiguration.documentNameFromGroup(category);
      const next = source.indexes[documentName].next;
      if (next === undefined) return;
      this._paginationInFlight = true;
      source.filterItems.call(source, category, next)
        .finally(() => { this._paginationInFlight = false; });
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
    this._syncSearchFromInput(category)

    if (this.advancedFiltering) {
      const dataFilters = this._getDetailFilters(category);
      const subcategory = dataFilters.attr('data-subc');
      if (subcategory && this.detailFilter[subcategory]) {
        this.detailFilter[subcategory].next = undefined;
      }
    }

    this._debouncedFilterItems(category);
  }

  async filterChanged(ev) {
    const { category, type } = ev.currentTarget.dataset;
    const tab = $(ev.currentTarget).closest('.tab').data('tab');
    const isChecked = ev.currentTarget.checked;

    if (isChecked) {
      await this.selectSingleCategory(category, type, tab);
      return;
    }

    const model = this.models[tab]?.find(x => x.key === type);
    if (model) model.selected = false;
    $(ev.currentTarget).closest('.library-filter-chip').removeClass('active');

    if (this.advancedFiltering) {
      const dataFilters = this._getDetailFilters(tab);
      const subcategory = dataFilters.attr('data-subc');
      if (subcategory && this.detailFilter[subcategory]) {
        this.detailFilter[subcategory].next = undefined;
      }
      await this._syncAdvancedSidebarForTab(tab);
    }

    await this.filterItems(tab);
  }

  _tearDown(options) {
    super._tearDown(options);
    this._hoverToken++;
    game.tooltip.deactivate();
    for (const key in this.indexes) {
      if (this.indexes[key].observer) {
        this.indexes[key].observer.disconnect();
        this.indexes[key].observer = undefined;
      }
    }
    for (const key in this.detailFilter) {
      if (this.detailFilter[key].observer) {
        this.detailFilter[key].observer.disconnect();
        this.detailFilter[key].observer = undefined;
      }
    }
  }

  _onClickAction(event, target) {
    if (target.classList.contains("disabled")) return;
    super._onClickAction(event, target);
  }

  _onDragOver(ev) {
    if (ev.dataTransfer?.types.includes("dragSource"))
      $(this.element).css({ pointerEvents: "none" });
  }

  /**
   * Show an index-building spinner.
   * @param {string|JQuery|HTMLElement} targetOrCategory
   * @param {string} [category]
   */
  showLoading(targetOrCategory, category) {
    if (!this.element) return;

    const hasTarget = targetOrCategory && typeof targetOrCategory === 'object' && (targetOrCategory instanceof HTMLElement || targetOrCategory.jquery);
    const target = hasTarget ? $(targetOrCategory) : $(this.element);
    const effectiveCategory = hasTarget ? category : targetOrCategory;

    try {
      if (typeof effectiveCategory === 'string') this.setBGImage([1], effectiveCategory);
      const loading = $(`<div class="loader"><i class="fa fa-4x fa-spinner fa-spin"></i><span class="loader-label">${_loc('Library.buildingIndex')}</span></div>`);
      loading.appendTo(target.find('.searchResult'));
    } catch (e) {
      // nothing going on here
    }
  }

  /**
   * Hide the index-building spinner.
   * @param {string|JQuery|HTMLElement} targetOrCategory
   * @param {string} [category]
   */
  hideLoading(targetOrCategory, category) {
    if (!this.element) return;

    const hasTarget = targetOrCategory && typeof targetOrCategory === 'object' && (targetOrCategory instanceof HTMLElement || targetOrCategory.jquery);
    const target = hasTarget ? $(targetOrCategory) : $(this.element);
    const effectiveCategory = hasTarget ? category : targetOrCategory;

    try {
      if (typeof effectiveCategory === 'string') this.setBGImage([], effectiveCategory);
      target.find('.loader').remove();
    } catch (e) {
      // nothing going on here
    }
  }
}

export default class DSA5ItemLibrary extends ItemLibraryBase {}
