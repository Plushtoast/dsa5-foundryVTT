import { DefaultAppv2 } from '../../actor/baseapp.js';
import MerchantConfig from '../../config/merchant-config.js';
import MerchantStockService from './merchant-stock-service.js';
import DSA5 from '../../config/config-dsa5.js';
import { tabSlider } from '../helpers/view_helper.js';
import RuleChaos from '../rules/rule_chaos.js';
import AttrFilterUi from '../guiapps/attr-filter-ui.js';

export default class StockFillDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'stock-fill-dialog'],
    tag: 'form',
    window: {
      title: 'MERCHANT.fill.title',
      resizable: true,
      contentClasses: ['standard-form', 'flexcol', 'gap5px'],
    },
    position: {
      width: 720,
      height: 720,
    },
    actions: {
      applyPreset: this.#applyPreset,
      fill: this.#fill,
      cancel: this.#cancel,
      collapseFilterCategory: this.#collapseFilterCategory,
    },
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    config: {
      template: 'systems/dsa5/templates/dialog/stock-fill/stock-fill-config.hbs',
      scrollable: [''],
    },
    advanced: {
      template: 'systems/dsa5/templates/dialog/stock-fill/stock-fill-advanced.hbs',
      scrollable: [''],
    },
    filters: {
      template: 'systems/dsa5/templates/dialog/stock-fill/stock-fill-filters.hbs',
      scrollable: [''],
    },
    footer: {
      template: 'systems/dsa5/templates/dialog/stock-fill/stock-fill-footer.hbs',
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'config', icon: 'fas fa-boxes-stacked', label: 'MERCHANT.fill.tabConfig' },
        { id: 'advanced', icon: 'fas fa-sliders', label: 'MERCHANT.fill.advanced' },
        { id: 'filters', icon: 'fas fa-filter', label: 'MERCHANT.fill.tabFilters' },
      ],
      initial: 'config',
    },
  };

  constructor(actor, options = {}) {
    const dialogId = `dsa-stock-fill-${actor.id}`;
    super({ id: dialogId, ...options });
    this.actor = actor;
    this.sectionType = options.sectionType || null;
    if (options.advancedOpen) this.tabGroups.sheet = 'advanced';
    this.config = MerchantStockService.seedFromActor(actor, {
      presetId: options.presetId,
      sectionType: this.sectionType,
      mode: options.mode,
    });
    this.filling = false;
  }

  static show(actor, options = {}) {
    if (!actor) return;
    const dialogId = `dsa-stock-fill-${actor.id}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return existing;
    }
    const app = new this(actor, options);
    app.render(true);
    return app;
  }

  async _prepareContext(options) {
    const data = await super._prepareContext(options);
    data.config = this.config;
    data.filling = this.filling;
    data.presets = Object.values(MerchantConfig.stockFillPresets()).map((preset) => ({
      ...preset,
      active: preset.id === this.config.presetId,
    }));
    data.categoryRows = this.#categoryRows();
    data.filterRows = await this.#filterRows();
    data.modes = Object.entries(MerchantConfig.RESTOCK_MODES).map(([value, label]) => ({
      value,
      label,
      hint: `MERCHANT.restockMode.${value}Hint`,
      active: this.config.mode === value,
    }));
    data.activeModeHint = `MERCHANT.restockMode.${this.config.mode}Hint`;
    data.hygiene = this.config.hygiene;
    data.includeRestrictedBooks = !this.config.hygiene.excludeIllegalBooks;
    data.enhanceChancePercent = Math.round((Number(this.config.enhanceChance) || 0) * 100);
    data.tabs = this._prepareTabs('sheet');
    return data;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    tabSlider($(this.element));
    this.#bindQuantityClicks();
    const filterRoot = this.element.querySelector('.dsa-attr-filters');
    AttrFilterUi.initSelect2(filterRoot, this.element);
    AttrFilterUi.bindLiveRefresh(filterRoot);
    AttrFilterUi.refreshAccordions(filterRoot);
    if (options.isFirstRender) {
      this.element.addEventListener('change', (event) => this.#onFormChange(event));
      this.element.addEventListener('submit', (event) => event.preventDefault());
    }
    Hooks.callAll('dsa5.stockFillDialog.enhance', this);
  }

  #bindQuantityClicks() {
    for (const input of this.element.querySelectorAll('input.quantity-click')) {
      input.addEventListener('mousedown', (ev) => {
        if (input.disabled || (ev.button !== 0 && ev.button !== 2)) return;
        ev.preventDefault();
        RuleChaos.quantityClick(ev);
        const min = Number(input.min);
        let val = Math.floor(Number(input.value) || 0);
        if (Number.isFinite(min)) val = Math.max(min, val);
        input.value = String(val);
        input.dispatchEvent(new Event('change', { bubbles: true }));
      });
      input.addEventListener('contextmenu', (ev) => ev.preventDefault());
    }
  }

  changeTab(tab, group, options) {
    this.#readForm(this.element);
    super.changeTab(tab, group, options);
  }

  #categoryRows() {
    return Object.entries(this.config.categories).map(([key, entry]) => ({
      key,
      enabled: !!entry.enabled,
      disabled: !entry.enabled,
      number: entry.number,
      qtyEach: entry.each,
      label: `TYPES.Item.${key}`,
      types: entry.types
        ? Object.entries(entry.types).map(([type, enabled]) => ({
          key: type,
          enabled: !!enabled,
          label: DSA5.equipmentTypes[type] || type,
        }))
        : null,
    }));
  }

  async #filterRows() {
    const library = game.dsa5.itemLibrary;
    const rows = [];
    for (const key of DSA5.equipmentCategories) {
      const saved = this.config.filters?.[key];
      const activeCount = AttrFilterUi.constraintCount(saved);
      rows.push({
        key,
        label: `TYPES.Item.${key}`,
        activeCount,
        open: activeCount > 0,
        html: await library.buildDetailFilter('Item', key, saved),
      });
    }
    return rows;
  }

  #markPresetCustom() {
    this.config.presetId = 'custom';
    for (const button of this.element.querySelectorAll('[data-action="applyPreset"]')) {
      button.classList.toggle('active', button.dataset.presetId === 'custom');
    }
  }

  #syncCategoryRowDisabled(key, enabled) {
    const disabled = !enabled;
    for (const name of [`cat.${key}.number`, `cat.${key}.each`]) {
      const input = this.element.querySelector(`[name="${name}"]`);
      if (input) input.disabled = disabled;
    }
    for (const box of this.element.querySelectorAll(`[name^="cat.${key}.types."]`)) {
      box.disabled = disabled;
    }
  }

  #syncFiltersEnabledUi(enabled) {
    const host = this.element.querySelector('.dsa-attr-filters');
    host?.classList.toggle('dsa-attr-filters--disabled', !enabled);
  }

  #readDetailFilters(form) {
    if (!form) return;
    const categories = form.querySelectorAll('.stock-fill-filter-category');
    // Filters tab not in DOM yet — keep whatever is already on the config.
    if (!categories.length) return;
    const library = game.dsa5.itemLibrary;
    const filters = {};
    for (const category of categories) {
      const key = category.dataset.category;
      const panel = category.querySelector('.detailFilters');
      if (!key || !panel) continue;
      const { sels, inps, checkboxes } = library.collectDetailSearch($(panel));
      if (sels.length || inps.length || checkboxes.length) {
        filters[key] = { selects: sels, inputs: inps, booleans: checkboxes };
      }
    }
    this.config.filters = filters;
  }

  #readForm(form) {
    if (!form) return;
    for (const row of this.#categoryRows()) {
      const enabled = form.querySelector(`[name="cat.${row.key}.enabled"]`);
      const number = form.querySelector(`[name="cat.${row.key}.number"]`);
      const each = form.querySelector(`[name="cat.${row.key}.each"]`);
      const entry = this.config.categories[row.key];
      if (!entry) continue;
      if (enabled) entry.enabled = !!enabled.checked;
      if (number) entry.number = Math.max(0, Number(number.value) || 0);
      if (each) entry.each = Math.max(1, Number(each.value) || 1);
      if (entry.types) {
        for (const type of Object.keys(entry.types)) {
          const box = form.querySelector(`[name="cat.${row.key}.types.${type}"]`);
          if (box) entry.types[type] = !!box.checked;
        }
      }
    }

    const readNumber = (name, fallback) => {
      const input = form.querySelector(`[name="${name}"]`);
      return input ? Number(input.value) : fallback;
    };
    const readText = (name, fallback) => {
      const input = form.querySelector(`[name="${name}"]`);
      return input ? input.value : fallback;
    };
    const readCheck = (name, fallback) => {
      const input = form.querySelector(`[name="${name}"]`);
      return input ? !!input.checked : fallback;
    };

    this.config.mode = form.querySelector('[name="mode"]:checked')?.value || this.config.mode;
    this.config.region = readText('region', this.config.region);
    this.config.maxPrice = readNumber('maxPrice', this.config.maxPrice);
    this.config.enhanceChance = readNumber('enhanceChance', (this.config.enhanceChance || 0) * 100) / 100;
    this.config.qlBand = MerchantConfig.normalizeBand(readNumber('qlBand', this.config.qlBand));
    this.config.poisonStepBand = MerchantConfig.normalizeBand(
      readNumber('poisonStepBand', this.config.poisonStepBand),
      MerchantConfig.DEFAULT_POISON_STEP_BAND,
    );
    this.config.ammoStack = readNumber('ammoStack', this.config.ammoStack);
    this.config.allowDuplicates = readCheck('allowDuplicates', this.config.allowDuplicates);
    this.config.allowQlVariants = readCheck('allowQlVariants', this.config.allowQlVariants);
    this.config.tradeableOnly = readCheck('tradeableOnly', this.config.tradeableOnly);
    this.config.filtersEnabled = readCheck('filtersEnabled', this.config.filtersEnabled);
    this.config.hygiene.excludePriceZero = readCheck('hygiene.excludePriceZero', this.config.hygiene.excludePriceZero);
    this.config.hygiene.excludeIllegalBooks = !readCheck('includeRestrictedBooks', !this.config.hygiene.excludeIllegalBooks);
    this.config.hygiene.excludeArtifacts = readCheck('hygiene.excludeArtifacts', this.config.hygiene.excludeArtifacts);
    this.config.hygiene.excludeUniq = readCheck('hygiene.excludeUniq', this.config.hygiene.excludeUniq);
    this.config.hygiene.excludeMagical = readCheck('hygiene.excludeMagical', this.config.hygiene.excludeMagical);
    this.#readDetailFilters(form);
  }

  #onFormChange(event) {
    this.#readForm(event.currentTarget?.closest?.('form') || this.element);
    const name = event.target?.name || '';
    if (name === 'filtersEnabled') {
      this.#syncFiltersEnabledUi(!!event.target.checked);
      this.#markPresetCustom();
      return;
    }
    if (name === 'mode') {
      this.#syncModeHint();
      this.#markPresetCustom();
      return;
    }
    if (!name.startsWith('cat.')) return;

    this.#markPresetCustom();
    const enabledMatch = name.match(/^cat\.([^.]+)\.enabled$/);
    if (enabledMatch) this.#syncCategoryRowDisabled(enabledMatch[1], !!event.target.checked);
  }

  #syncModeHint() {
    const hint = this.element.querySelector('.stock-fill-mode-hint');
    if (!hint) return;
    hint.textContent = game.i18n.localize(`MERCHANT.restockMode.${this.config.mode}Hint`);
  }

  static #collapseFilterCategory(_event, target) {
    const row = target.closest('.dsa-filter-accordion');
    AttrFilterUi.toggleAccordion(row);
  }

  static #applyPreset(event, target) {
    this.#readForm(this.element);
    MerchantStockService.applyPreset(this.config, target.dataset.presetId, { keepFilters: event.shiftKey });
    this.render({ parts: ['config', 'filters'] });
  }

  static #cancel() {
    this.close();
  }

  static async #fill(event) {
    event.preventDefault();
    this.#readForm(this.element);
    this.filling = true;
    this.render({ parts: ['footer'] });
    try {
      const created = await MerchantStockService.applyFill(this.actor, this.config);
      if (created.length) await this.close();
    } finally {
      this.filling = false;
      if (this.rendered) this.render({ parts: ['footer'] });
    }
  }
}
