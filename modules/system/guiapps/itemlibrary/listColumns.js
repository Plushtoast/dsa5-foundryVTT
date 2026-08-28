import DSA5 from '../../../config/config-dsa5.js';
import ADVANCEDFILTERS from '../itemlibrary_advanced_filters.js';
import SpecialabilityData from '../../../data/item/specialability.js';
import DSAEnhancementEffectDataModel from '../../../data/activeeffect/enhancement-effect.js';

export default class ItemLibraryListColumns {
  static BUILTIN_COLUMN_DEFS = {
    img: { id: 'img', label: '', sortable: false },
    name: { id: 'name', label: 'Name', sortable: true, includesImg: true, includesSource: true },
    type: { id: 'type', label: 'Type', sortable: true },
    compendium: { id: 'compendium', label: 'Library.source', sortable: true },
    price: { id: 'price', label: 'price', sortable: true },
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

  static getColumnOptions(col) {
    if (col.optionsKey && this.#COLUMN_OPTION_MAPS[col.optionsKey]) {
      return this.#COLUMN_OPTION_MAPS[col.optionsKey];
    }
    return col.optionsKey ? DSA5[col.optionsKey] : undefined;
  }

  static getTypeListColumns(type) {
    const config = this.getListColumnConfig();
    const columns = [...(config[type]?.columns ?? [])];
    const apTypes = config._default?.apTypes ?? [];
    const apColumn = config._default?.apColumn;
    if (apColumn && apTypes.includes(type) && !columns.some(col => col.attr === apColumn.attr)) {
      columns.unshift(apColumn);
    }
    return columns;
  }

  static getListDisplayFields(type) {
    const typeColumns = this.getTypeListColumns(type);
    if (typeColumns.length) {
      return typeColumns.map(col => ({
        label: col.label,
        attr: col.attr,
        type: col.optionsKey ? 'select' : 'text',
        options: ItemLibraryListColumns.getColumnOptions(col),
        optionsKey: col.optionsKey,
        columnType: col.columnType,
        raw: col.raw,
      }));
    }

    return (ADVANCEDFILTERS[type] || [])
      .filter(f => f.type === 'select' || f.type === 'text');
  }

  static resolveColumnFieldDef(col) {
    return {
      id: col.attr,
      label: col.label,
      sortable: col.columnType !== 'plantTypes',
      attr: col.attr,
      optionsKey: col.optionsKey,
      columnType: col.columnType,
      raw: col.raw,
      fieldDef: {
        label: col.label,
        attr: col.attr,
        type: col.optionsKey ? 'select' : 'text',
        options: ItemLibraryListColumns.getColumnOptions(col),
      },
    };
  }

  static getSystemAttrValue(item, attrPath) {
    if (item?.system) {
      const value = foundry.utils.getProperty(item.system, attrPath);
      if (value !== undefined && value !== null) return value;
    }
    return foundry.utils.getProperty(item, `system.${attrPath}`);
  }
}
