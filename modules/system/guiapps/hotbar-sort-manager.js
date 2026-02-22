import { DefaultAppv2 } from '../../actor/baseapp.js';
import { localize } from '../helpers/localizer.js';
import DSA5 from '../../config/config-dsa5.js';

const { mergeObject } = foundry.utils;

export default class HotbarSortManager extends DefaultAppv2 {
  #search;
  _draft;

  static get ORDER_GROUPS() {
    return Object.keys(DSA5.skillGroups);
  }

  static GROUP_ICONS = {
    body: 'fa-person-running',
    social: 'fa-comments',
    knowledge: 'fa-book',
    trade: 'fa-hammer',
    nature: 'fa-tree',
  };

  static SORT_MODES = {
    groupAlpha: 'DSA5HOTBARCONFIG.sortGroupAlpha',
    alpha: 'DSA5HOTBARCONFIG.sortAlpha',
    valueDesc: 'DSA5HOTBARCONFIG.sortValueDesc',
    valueAsc: 'DSA5HOTBARCONFIG.sortValueAsc',
    custom: 'DSA5HOTBARCONFIG.sortCustom',
  };

  static DEFAULT_OPTIONS = {
    id: 'hotbar-sort-manager',
    window: {
      title: 'DSA5HOTBARCONFIG.manager',
      icon: 'fa-solid fa-bars-sort',
      resizable: true,
    },
    position: { width: 760, height: 780 },
    actions: {
      toggleVisibility: this._onToggleVisibility,
      toggleGroup: this._onToggleGroup,
      toggleFavorite: this._onToggleFavorite,
      resetOrder: this._onResetOrder,
      resetAll: this._onResetAll,
      saveChanges: this._onSaveChanges,
      setDefaultSort: this._onSetDefaultSort,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/hud/hotbar-sort-manager.hbs',
      scrollable: ['.sort-manager-content'],
    },
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    this._draft = null;
  }

  get title() {
    return `${localize('DSA5HOTBARCONFIG.manager')} — ${this.actor.name}`;
  }

  #initDraft() {
    if (this._draft) return;
    this._draft = {
      hidden: [...(this.actor.prototypeToken.getFlag('dsa5', 'hotbarHidden') || [])],
      hiddenGroups: [...(this.actor.prototypeToken.getFlag('dsa5', 'hotbarHiddenGroups') || [])],
      favorites: [...(this.actor.prototypeToken.getFlag('dsa5', 'hotbarFavorites') || [])],
      customOrder: foundry.utils.deepClone(this.actor.prototypeToken.getFlag('dsa5', 'hotbarControls') || {}),
      sortMode: game.settings.get('dsa5', 'hotbarSortMode'),
      dirty: false,
    };
  }

  _markDirty() {
    this._draft.dirty = true;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;

    html.querySelector('.sort-mode-select')?.addEventListener('change', (ev) => {
      this._draft.sortMode = ev.currentTarget.value;
      this.render(true);
    });

    this.#search ??= new foundry.applications.ux.SearchFilter({
      inputSelector: 'input[type=search]',
      contentSelector: '.sort-manager-content',
      callback: this.#onSearchFilter.bind(this),
    });
    this.#search.bind(html);

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: '.sort-card[draggable]',
      dropSelector: '.sort-card[draggable]',
      permissions: {
        dragstart: () => true,
        drop: () => true,
      },
      callbacks: {
        dragstart: this._onDragStartSort.bind(this),
        dragover: this._onDragOverSort.bind(this),
        drop: this._onDropSort.bind(this),
      },
    }).bind(html);
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#search?.unbind();
    this._draft = null;
  }

  #onSearchFilter(_event, query, rgx, html) {
    for (const el of html.querySelectorAll('.sort-card')) {
      const name = el.dataset.name || '';
      el.classList.toggle('dsahidden', !!query && !(rgx ? rgx.test(name) : name.toLowerCase().includes(query.toLowerCase())));
    }
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    this.#initDraft();
    const { hidden, hiddenGroups, favorites, customOrder, sortMode, dirty } = this._draft;

    const skills = [];
    for (const item of this.actor.items) {
      if (item.type !== 'skill') continue;
      skills.push({
        id: item.id,
        name: item.name,
        img: item.img,
        tw: item.system?.talentValue?.value ?? 0,
        group: item.system?.group?.value || 'body',
        hidden: hidden.includes(item.id),
        favorite: favorites.includes(item.id),
      });
    }

    this.#sortSkills(skills, sortMode, customOrder);

    const visibleSkills = skills.filter((s) => !hiddenGroups.includes(s.group));

    const groupToggles = HotbarSortManager.ORDER_GROUPS.map((key) => ({
      key,
      label: localize(`SKILL.${key}`),
      icon: HotbarSortManager.GROUP_ICONS[key],
      active: !hiddenGroups.includes(key),
    }));

    const sortModes = {};
    for (const [key, labelKey] of Object.entries(HotbarSortManager.SORT_MODES)) {
      sortModes[key] = localize(labelKey);
    }

    const savedSortMode = game.settings.get('dsa5', 'hotbarSortMode');

    mergeObject(data, {
      skills: visibleSkills,
      groupToggles,
      sortMode,
      sortModes,
      isDirty: dirty,
      sortModeChanged: sortMode !== savedSortMode,
    });

    return data;
  }

  #sortSkills(skills, sortMode, savedOrder) {
    switch (sortMode) {
      case 'alpha':
        skills.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'valueDesc':
        skills.sort((a, b) => b.tw - a.tw || a.name.localeCompare(b.name));
        break;
      case 'valueAsc':
        skills.sort((a, b) => a.tw - b.tw || a.name.localeCompare(b.name));
        break;
      case 'custom':
        if (savedOrder?.skill?.length) {
          const orderMap = new Map(savedOrder.skill.map((id, i) => [id, i]));
          skills.sort((a, b) => {
            const ai = orderMap.has(a.id) ? orderMap.get(a.id) : 9999;
            const bi = orderMap.has(b.id) ? orderMap.get(b.id) : 9999;
            return ai - bi || a.name.localeCompare(b.name);
          });
        }
        break;
      case 'groupAlpha':
      default: {
        const orderGroups = HotbarSortManager.ORDER_GROUPS;
        skills.sort(
          (a, b) => orderGroups.indexOf(a.group) - orderGroups.indexOf(b.group) || a.name.localeCompare(b.name),
        );
        break;
      }
    }
  }

  _onDragStartSort(event) {
    const el = event.currentTarget;
    if (!el) return;
    event.dataTransfer.setData('text/plain', JSON.stringify({ type: 'hotbarSortManager', id: el.dataset.id }));
    event.dataTransfer.effectAllowed = 'move';
    el.classList.add('dragging');
    el.addEventListener('dragend', () => {
      el.classList.remove('dragging');
      this.element?.querySelectorAll('.sort-card').forEach((c) => c.classList.remove('drag-over-left', 'drag-over-right'));
    }, { once: true });
  }

  _onDragOverSort(event) {
    event.preventDefault();
    const target = event.currentTarget;
    if (!target) return;
    this.element.querySelectorAll('.sort-card').forEach((el) => el.classList.remove('drag-over-left', 'drag-over-right'));
    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    target.classList.add(event.clientX < midX ? 'drag-over-left' : 'drag-over-right');
  }

  _onDropSort(event) {
    event.preventDefault();
    event.stopPropagation();
    this.element.querySelectorAll('.sort-card').forEach((el) => el.classList.remove('drag-over-left', 'drag-over-right'));

    const target = event.currentTarget;
    if (!target) return;

    let dragData;
    try {
      dragData = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    if (dragData.type !== 'hotbarSortManager') return;

    const allCards = Array.from(this.element.querySelectorAll('.sort-card-grid .sort-card[draggable]'));
    const ids = allCards.map((el) => el.dataset.id);
    const fromIndex = ids.indexOf(dragData.id);
    const toIndex = ids.indexOf(target.dataset.id);
    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    const rect = target.getBoundingClientRect();
    const midX = rect.left + rect.width / 2;
    const draggedId = ids.splice(fromIndex, 1)[0];
    const adjustedToIndex = ids.indexOf(target.dataset.id);
    if (event.clientX >= midX) {
      ids.splice(adjustedToIndex + 1, 0, draggedId);
    } else {
      ids.splice(adjustedToIndex, 0, draggedId);
    }

    this._draft.customOrder.skill = ids;
    this._draft.sortMode = 'custom';
    this._markDirty();
    this.render(true);
  }

  static async _onSaveChanges() {
    const { hidden, hiddenGroups, favorites, customOrder } = this._draft;
    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarHidden', hidden);
    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarHiddenGroups', hiddenGroups);
    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarFavorites', favorites);
    if (customOrder?.skill?.length) {
      await this.actor.prototypeToken.setFlag('dsa5', 'hotbarControls', customOrder);
    } else {
      await this.actor.prototypeToken.unsetFlag('dsa5', 'hotbarControls');
    }
    this._draft.dirty = false;
    this.render(true);
    ui.hotbar.render(true);
  }

  static async _onSetDefaultSort() {
    await game.settings.set('dsa5', 'hotbarSortMode', this._draft.sortMode);
    this.render(true);
  }

  static _onToggleVisibility(ev, target) {
    const id = target.closest('.sort-card')?.dataset.id;
    if (!id) return;
    const { hidden } = this._draft;
    const index = hidden.indexOf(id);
    if (index === -1) hidden.push(id);
    else hidden.splice(index, 1);
    this._markDirty();
    this.render(true);
  }

  static _onToggleGroup(ev, target) {
    const groupKey = target.dataset.group || target.closest('[data-group]')?.dataset.group;
    if (!groupKey) return;
    const { hiddenGroups } = this._draft;
    const index = hiddenGroups.indexOf(groupKey);
    if (index === -1) hiddenGroups.push(groupKey);
    else hiddenGroups.splice(index, 1);
    this._markDirty();
    this.render(true);
  }

  static _onToggleFavorite(ev, target) {
    const id = target.closest('.sort-card')?.dataset.id;
    if (!id) return;
    const { favorites } = this._draft;
    const index = favorites.indexOf(id);
    if (index === -1) favorites.push(id);
    else favorites.splice(index, 1);
    this._markDirty();
    this.render(true);
  }

  static _onResetOrder() {
    this._draft.customOrder = {};
    this._draft.sortMode = 'groupAlpha';
    this._markDirty();
    this.render(true);
  }

  static async _onResetAll() {
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'DSA5HOTBARCONFIG.resetAll',
        icon: 'fa-solid fa-trash',
      },
      content: localize('DSA5HOTBARCONFIG.resetAllConfirm'),
      modal: true,
    });
    if (!proceed) return;
    this._draft.customOrder = {};
    this._draft.hidden = [];
    this._draft.hiddenGroups = [];
    this._draft.favorites = [];
    this._draft.sortMode = 'groupAlpha';
    this._markDirty();
    this.render(true);
  }
}
