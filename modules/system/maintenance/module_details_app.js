import { DefaultAppv2 } from '../../actor/baseapp.js';
import { clickableAbility } from '../helpers/view_helper.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';
import ModuleDetailsDataLoader from './module_details_loader.js';

const { mergeObject } = foundry.utils;
const ACTOR_DEFAULT_IMAGE = 'icons/svg/mystery-man-black.svg';

export default class ModuleDetailsApp extends DefaultAppv2 {
  #search;
  activeCategoryId = null;

  constructor(moduleId, moduleData = {}, app) {
    super(app);
    this.moduleId = moduleId;
    this.moduleData = moduleData;
    this.options.window.title = moduleData?.label || _loc('DSA5.patchViewer.moduleDetails.windowTitle');
  }

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'sheet', 'patchviewer'],
    position: {
      width: 1000,
      height: 860,
    },
    window: {
      title: 'DSA5.patchViewer.moduleDetails.windowTitle',
      resizable: true,
      contentClasses: ['scrollable'],
    },
    actions: {
      searchableAbility: this.#onSearchableAbility,
      switchCategoryTab: this.#onSwitchCategoryTab,
    },
  };

  static PARTS = {
    content: {
      template: 'systems/dsa5/templates/system/patchviewer/module-details.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);

    try {
      const payload = await ModuleDetailsDataLoader.loadData();
      const details = payload?.modules?.[this.moduleId];
      if (!details) {
        return mergeObject(data, {
          module: this.moduleData,
          missingDetails: true,
        });
      }

      const lang = game.i18n.lang;
      const categories = details.categories
        .map((category) => this.#prepareCategory(category, lang))
        .sort((left, right) => left.displayLabel.localeCompare(right.displayLabel, lang, { sensitivity: 'base' }));

      if (!this.activeCategoryId || !categories.some((category) => category.tabId === this.activeCategoryId)) {
        this.activeCategoryId = categories[0]?.tabId ?? null;
      }

      const categoryTabs = categories.map((category) => ({
        id: category.tabId,
        group: 'categories',
        label: category.displayLabelWithCount,
        cssClass: category.tabId === this.activeCategoryId ? 'active' : '',
      }));

      return mergeObject(data, {
        module: this.moduleData,
        details,
        categories,
        categoryTabs,
        activeCategoryId: this.activeCategoryId,
        overallStats: details.stats?.tracked ? this.#prepareAutomationStats(details.stats) : null,
        missingDetails: false,
      });
    } catch (error) {
      console.error('DSA5 | Failed to prepare module details app', error);
      return mergeObject(data, {
        module: this.moduleData,
        missingDetails: true,
        loadError: true,
      });
    }
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.#search ??= new foundry.applications.ux.SearchFilter({
      inputSelector: 'input[type=search]',
      contentSelector: '.module-details',
      callback: this._onSearchFilter.bind(this),
    });
    this.#search.bind(this.element);
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#search?.unbind();
  }

  #categoryLabel(category, lang) {
    if (category.labelKey && game.i18n.has(category.labelKey)) {
      return _loc(category.labelKey);
    }

    return category.label?.[lang] || category.label?.de || category.rawCategory;
  }

  #entryDisplayName(entry, lang) {
    if (lang === 'en' && entry.nameEn) {
      return entry.nameEn;
    }

    return entry.nameDe;
  }

  #entrySearchText(entry, lang) {
    const localizedName = lang === 'de' ? entry.nameDe || entry.nameEn : entry.nameEn || entry.nameDe;
    return [localizedName].filter(Boolean).join(' ');
  }

  #prepareCategory(category, lang) {
    const preparedEntries = category.entries.map((entry) => this.#prepareEntry(entry, category, lang));
    const sortedEntries = this.#preserveEntryOrder(category, preparedEntries)
      ? preparedEntries
      : preparedEntries.sort((left, right) => left.displayName.localeCompare(right.displayName, lang, { sensitivity: 'base' }));
    const displayLabel = this.#categoryLabel(category, lang);
    const displayLabelWithCount = `${displayLabel} (${category.entries.length})`;

    return {
      ...category,
      tabId: `category-${category.id}`,
      displayLabel,
      displayLabelWithCount,
      stats: category.automationTracked ? this.#prepareAutomationStats(category.stats) : category.stats,
      entryGroups: this.#prepareEntryGroups(category, sortedEntries),
    };
  }

  #preserveEntryOrder(category, entries) {
    return category.id === 'journal' || entries.every((entry) => entry.documentGroup === 'JournalEntries');
  }

  #prepareAutomationStats(stats = {}) {
    const percentage = Math.max(0, Math.min(Number(stats.percentage) || 0, 100));

    return {
      ...stats,
      percentage,
      barValue: percentage,
      label: `${stats.automated} / ${stats.tracked} (${percentage}%)`,
      tooltip: `${stats.automated} / ${stats.tracked} (${percentage}%)`,
    };
  }

  #prepareEntry(entry, category, lang) {
    const displayName = this.#entryDisplayName(entry, lang);
    const automationLabel = _loc(
      entry.automation
        ? 'DSA5.patchViewer.moduleDetails.automatedTooltip'
        : 'DSA5.patchViewer.moduleDetails.notAutomatedTooltip',
    );

    return {
      ...entry,
      displayName,
      automationLabel,
      automationTooltip: automationLabel,
      automationIconClass: entry.automation ? 'fa-check' : 'fa-minus',
      automationBadgeClass: entry.automation
        ? 'module-details__automation-badge module-details__automation-badge--automated'
        : 'module-details__automation-badge module-details__automation-badge--neutral',
      searchText: this.#entrySearchText(entry, lang),
      clickCategory: Array.isArray(entry.clickCategories) ? entry.clickCategories.join(' ') : '',
      icon: this.#entryIcon(entry, category),
      isClickable: !!entry.documentGroup || (Array.isArray(entry.clickCategories) && entry.clickCategories.length > 0),
    };
  }

  #prepareEntryGroups(category, entries) {
    switch (category.id) {
      case 'career':
        return this.#prepareCareerGroups(entries, game.i18n.lang);
      default:
        return entries.map((entry) => ({
          key: entry.nameDe,
          entry,
          variants: [],
          searchText: entry.searchText,
        }));
    }
  }

  #prepareCareerGroups(entries, lang) {
    const groups = [];
    const groupLookup = new Map();

    for (const entry of entries) {
      const { baseName, variantName, baseNameDe, baseNameEn } = this.#splitCareerEntry(entry);
      let group = groupLookup.get(baseNameDe);

      if (!group) {
        group = {
          key: baseNameDe,
          entry: null,
          variants: [],
          searchText: '',
          fallbackName: baseName,
          fallbackNameDe: baseNameDe,
          fallbackNameEn: baseNameEn,
        };
        groupLookup.set(baseNameDe, group);
        groups.push(group);
      }

      if (variantName) {
        group.variants.push({
          ...entry,
          variantDisplayName: variantName,
        });
      } else {
        group.entry = entry;
      }
    }

    for (const group of groups) {
      if (!group.entry) {
        const fallbackSearchText = lang === 'de'
          ? group.fallbackNameDe || group.fallbackNameEn
          : group.fallbackNameEn || group.fallbackNameDe;

        group.entry = {
          nameDe: group.fallbackNameDe,
          nameEn: group.fallbackNameEn,
          displayName: group.fallbackName,
          searchText: [fallbackSearchText].filter(Boolean).join(' '),
          clickCategories: [],
          clickCategory: '',
          icon: ITEM_CONSTANTS.DEFAULT_IMAGES.career || null,
          isClickable: false,
          documentGroup: null,
        };
      }

      group.searchText = [group.entry.searchText, ...group.variants.map((variant) => variant.searchText)].filter(Boolean).join(' ');
    }

    return groups;
  }

  #splitCareerEntry(entry) {
    const deParts = String(entry.nameDe || '').split(' - ');
    const enParts = String(entry.nameEn || '').split(' - ');
    const displayParts = String(entry.displayName || '').split(' - ');

    return {
      baseName: displayParts[0]?.trim() || entry.displayName,
      variantName: displayParts.length > 1 ? displayParts.slice(1).join(' - ').trim() : '',
      baseNameDe: deParts[0]?.trim() || entry.nameDe,
      baseNameEn: enParts[0]?.trim() || entry.nameEn,
    };
  }

  #entryIcon(entry, category) {
    if (entry.documentGroup === 'JournalEntries') {
      return ITEM_CONSTANTS.DEFAULT_IMAGES.book;
    }

    if (['beasts', 'character'].includes(category.id)) {
      return ACTOR_DEFAULT_IMAGE;
    }

    const clickCategory = Array.isArray(entry.clickCategories) ? entry.clickCategories.find((candidate) => ITEM_CONSTANTS.DEFAULT_IMAGES[candidate]) : null;
    if (clickCategory) {
      return ITEM_CONSTANTS.DEFAULT_IMAGES[clickCategory];
    }

    return ITEM_CONSTANTS.DEFAULT_IMAGES[category.id] || null;
  }

  _onSearchFilter(_event, query, rgx, html) {
    this._applySearchState(query, rgx, html);
  }

  _applySearchState(query = '', rgx = null, html = this.element?.querySelector('.module-details')) {
    if (!html) return;

    const cleanQuery = query?.trim() || '';
    const searchRegex = rgx || (cleanQuery ? new RegExp(foundry.applications.ux.SearchFilter.cleanQuery(cleanQuery), 'i') : null);

    for (const category of html.querySelectorAll('.module-details__category')) {
      let visibleGroups = 0;

      for (const group of category.querySelectorAll('.module-details__group')) {
        const entry = group.querySelector('.module-details__entry');
        const entryText = entry?.dataset.search || entry?.textContent || '';
        const entryMatch = !cleanQuery || (searchRegex && searchRegex.test(foundry.applications.ux.SearchFilter.cleanQuery(entryText)));

        let variantMatches = 0;
        for (const variant of group.querySelectorAll('.module-details__variant')) {
          const variantText = variant.dataset.search || variant.textContent || '';
          const variantMatch = !cleanQuery || entryMatch || (searchRegex && searchRegex.test(foundry.applications.ux.SearchFilter.cleanQuery(variantText)));
          variant.hidden = !variantMatch;
          if (variantMatch) variantMatches += 1;
        }

        const groupMatch = !cleanQuery || entryMatch || variantMatches > 0;
        group.hidden = !groupMatch;
        if (groupMatch) visibleGroups += 1;
      }

      category.querySelector('.module-details__empty')?.toggleAttribute('hidden', visibleGroups > 0);

      const categoryLink = html.querySelector(`.module-details__sidebar [data-tab="${CSS.escape(category.dataset.tab)}"]`);
      categoryLink?.classList.toggle('searchMatch', !!cleanQuery && visibleGroups > 0);
    }
  }

  static async #onSearchableAbility(_event, target) {
    const found = await clickableAbility(target);
    if (!found) {
      ui.notifications.warn('DSA5.patchViewer.moduleDetails.entryNotFound', {
        localize: true,
        format: { name: target.textContent.trim() },
      });
    }
  }

  static #onSwitchCategoryTab(_event, target) {
    const tabId = target?.dataset?.tab;
    if (!tabId || this.activeCategoryId === tabId) return;

    this.activeCategoryId = tabId;

    for (const element of this.element.querySelectorAll('.module-details__sidebar [data-tab]')) {
      element.classList.toggle('active', element.dataset.tab === tabId);
    }

    for (const element of this.element.querySelectorAll('.module-details__category')) {
      element.classList.toggle('active', element.dataset.tab === tabId);
    }

    const searchInput = this.element.querySelector('input[type=search]');
    if (searchInput) {
      const cleanQuery = foundry.applications.ux.SearchFilter.cleanQuery(searchInput.value?.trim() || '');
      const rgx = cleanQuery ? new RegExp(cleanQuery, 'i') : null;
      this._applySearchState(searchInput.value?.trim() || '', rgx);
    }
  }
}