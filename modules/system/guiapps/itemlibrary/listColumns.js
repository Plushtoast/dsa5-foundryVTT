import DSA5 from '../../../config/config-dsa5.js';
import ADVANCEDFILTERS from '../itemlibrary_advanced_filters.js';
import SpecialabilityData from '../../../data/item/specialability.js';
import DSAEnhancementEffectDataModel from '../../../data/activeeffect/enhancement-effect.js';

export default class ItemLibraryListColumns {
  static SORT_TYPE_NUMBER = 'number';
  static SORT_TYPE_STRING = 'string';

  static BUILTIN_COLUMN_DEFS = {
    img: { id: 'img', label: '', sortable: false },
    name: { id: 'name', label: 'Name', sortable: true, includesImg: true, includesSource: true },
    type: { id: 'type', label: 'Type', sortable: true },
    compendium: { id: 'compendium', label: 'Library.source', sortable: true },
    price: { id: 'price', label: 'price', sortable: true, attr: 'price.value', sortType: 'number' },
  };

  static PLANT_TYPE_KEYS = ['healing', 'poison', 'physical', 'psychic', 'crop', 'defensive', 'supernatural'];

  static #COLUMN_OPTION_MAPS = {
    specialAbilityCategories: SpecialabilityData.specialAbilityCategories,
    patronCategories: { 0: 'PATRON.0', 1: 'PATRON.1', 2: 'PATRON.2', 3: 'PATRON.3' },
    spellextensionCategories: {
      spell: 'TYPES.Item.spell',
      liturgy: 'TYPES.Item.liturgy',
      ritual: 'TYPES.Item.ritual',
      ceremony: 'TYPES.Item.ceremony',
    },
    enhancementTargetTypes: DSAEnhancementEffectDataModel.TARGET_TYPES,
  };

  static getListColumnConfig() {
    return game.dsa5?.itemLibrary?.listColumnConfig ?? {};
  }

  static getPriceTypes() {
    const configured = this.getListColumnConfig()._default?.priceTypes;
    if (configured?.length) return new Set(configured);
    return new Set([...DSA5.equipmentCategories, 'itempackage']);
  }

  static typeHasPrice(type) {
    return this.getPriceTypes().has(type);
  }

  static #LISTABLE_FILTER_TYPES = new Set(['select', 'text', 'range']);

  static getColumnOptions(col) {
    if (col.optionsKey && this.#COLUMN_OPTION_MAPS[col.optionsKey]) {
      return this.#COLUMN_OPTION_MAPS[col.optionsKey];
    }
    if (col.options) return col.options;
    return col.optionsKey ? DSA5[col.optionsKey] : undefined;
  }

  static advancedFiltersAsColumns(type) {
    const filters = game.dsa5?.advancedFilters || ADVANCEDFILTERS || {};
    return (filters[type] || [])
      .filter(filter => filter.attr && this.#LISTABLE_FILTER_TYPES.has(filter.type))
      .map(filter => ({
        attr: filter.attr,
        label: filter.label,
        options: filter.options,
        type: filter.type,
        sortType: filter.type === 'range' ? this.SORT_TYPE_NUMBER : filter.sortType,
      }));
  }

  static getTypeListColumns(type) {
    const config = this.getListColumnConfig();
    const typeConfig = config[type];
    const columns = typeConfig
      ? [...(typeConfig.columns ?? [])]
      : this.advancedFiltersAsColumns(type);
    const apTypes = config._default?.apTypes ?? [];
    const apColumn = config._default?.apColumn;
    if (apColumn && apTypes.includes(type) && !columns.some(col => col.attr === apColumn.attr)) {
      columns.unshift(apColumn);
    }
    return columns;
  }

  static getListDisplayFields(type) {
    return this.getTypeListColumns(type).map(col => ({
      label: col.label,
      attr: col.attr,
      type: col.type ?? (col.optionsKey || col.options ? 'select' : 'text'),
      options: ItemLibraryListColumns.getColumnOptions(col),
      optionsKey: col.optionsKey,
      columnType: col.columnType,
      raw: col.raw,
      sortType: col.sortType,
    }));
  }

  static schemaFieldFor(documentName, type, attrPath) {
    if (!attrPath) return null;
    return CONFIG[documentName]?.dataModels?.[type]?.schema?.getField(attrPath) ?? null;
  }

  static resolveColumnSortType(column, { documentName, type } = {}) {
    if (column?.sortType) return column.sortType;
    if (column?.type === 'range') return this.SORT_TYPE_NUMBER;
    const field = this.schemaFieldFor(documentName, type, column?.attr);
    return field instanceof foundry.data.fields.NumberField ? this.SORT_TYPE_NUMBER : this.SORT_TYPE_STRING;
  }

  static rawSortValue(item, column) {
    const id = column?.id;
    if (id === 'type') return item?.typeLabel ?? item?.type ?? '';
    if (id === 'compendium') return item?.compendiumLabel ?? item?.compendium ?? '';
    return item?.[id];
  }

  static toSortNumber(value) {
    if (value === '' || value == null) return NaN;
    return Number(value);
  }

  static compareColumnValues(a, b, column, { direction = 'asc', locale } = {}) {
    const dir = direction === 'desc' ? -1 : 1;
    const av = this.rawSortValue(a, column);
    const bv = this.rawSortValue(b, column);

    if (column?.sortType === this.SORT_TYPE_NUMBER) {
      const an = this.toSortNumber(av);
      const bn = this.toSortNumber(bv);
      const aOk = Number.isFinite(an);
      const bOk = Number.isFinite(bn);
      if (aOk && bOk && an !== bn) return (an - bn) * dir;
      if (aOk !== bOk) return (aOk ? -1 : 1) * dir;
    }

    return String(av ?? '').localeCompare(String(bv ?? ''), locale ?? game.i18n?.lang, {
      numeric: true,
      sensitivity: 'base',
    }) * dir;
  }

  static resolveColumnFieldDef(col, context = {}) {
    const options = this.getColumnOptions(col);
    const resolved = {
      id: col.attr,
      label: col.label,
      sortable: col.columnType !== 'plantTypes',
      attr: col.attr,
      optionsKey: col.optionsKey,
      columnType: col.columnType,
      raw: col.raw,
      type: col.type,
      sortType: col.sortType,
      fieldDef: {
        label: col.label,
        attr: col.attr,
        type: col.type ?? (options ? 'select' : 'text'),
        options,
      },
    };
    resolved.sortType = this.resolveColumnSortType(resolved, context);
    return resolved;
  }

  static getSystemAttrValue(item, attrPath) {
    if (item?.system) {
      const value = foundry.utils.getProperty(item.system, attrPath);
      if (value !== undefined && value !== null) return value;
    }
    return foundry.utils.getProperty(item, `system.${attrPath}`);
  }
}
