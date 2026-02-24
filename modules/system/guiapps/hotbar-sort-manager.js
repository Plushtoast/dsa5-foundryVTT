import { DefaultAppv2 } from '../../actor/baseapp.js';
import { localize } from '../helpers/localizer.js';
import { tabSlider } from '../helpers/view_helper.js';
import DSA5 from '../../config/config-dsa5.js';

const { mergeObject } = foundry.utils;

export default class HotbarSortManager extends DefaultAppv2 {
  #search;
  _draft;
  #previewMouseMove;
  #previewMouseUp;

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

  static DEFAULT_AVATAR = { source: 'token', offsetX: 0, offsetY: 0, zoom: 100 };

  static DEFAULT_OPTIONS = {
    id: 'hotbar-sort-manager',
    window: {
      title: 'DSA5HOTBARCONFIG.manager',
      icon: 'fa-solid fa-bars-sort',
      resizable: true,
      contentClasses: ['hotbar-sort-manager'],
    },
    position: { width: 760, height: 780 },
    actions: {
      toggleVisibility: this._onToggleVisibility,
      toggleGroup: this._onToggleGroup,
      toggleFavorite: this._onToggleFavorite,
      resetOrder: this._onResetOrder,
      resetAll: this._onResetAll,
      saveSkills: this._onSaveSkills,
      saveAvatar: this._onSaveAvatar,
      setDefaultSort: this._onSetDefaultSort,
      setAvatarSource: this._onSetAvatarSource,
      resetAvatar: this._onResetAvatar,
    },
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    skills: {
      template: 'systems/dsa5/templates/system/hud/hotbar-sort-manager-skills.hbs',
      scrollable: [''],
    },
    avatar: {
      template: 'systems/dsa5/templates/system/hud/hotbar-sort-manager-avatar.hbs',
      scrollable: [''],
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'skills', icon: 'fa-solid fa-bars-sort', label: 'DSA5HOTBARCONFIG.tabSkills' },
        { id: 'avatar', icon: 'fa-solid fa-user-circle', label: 'DSA5HOTBARCONFIG.tabAvatar' },
      ],
      initial: 'skills',
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
      avatar: mergeObject(
        foundry.utils.deepClone(HotbarSortManager.DEFAULT_AVATAR),
        this.actor.prototypeToken.getFlag('dsa5', 'hotbarAvatar') || {},
      ),
      skillsDirty: false,
      avatarDirty: false,
    };
  }

  _markSkillsDirty() {
    this._draft.skillsDirty = true;
  }

  _markAvatarDirty() {
    this._draft.avatarDirty = true;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = this.element;

    tabSlider($(html));

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

    this.#bindAvatarPreview(html);
    this.#bindAvatarSliders(html);
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#search?.unbind();
    this.#removePreviewListeners();
    this._draft = null;
  }

  #removePreviewListeners() {
    if (this.#previewMouseMove) {
      window.removeEventListener('mousemove', this.#previewMouseMove);
      this.#previewMouseMove = null;
    }
    if (this.#previewMouseUp) {
      window.removeEventListener('mouseup', this.#previewMouseUp);
      this.#previewMouseUp = null;
    }
  }

  #bindAvatarPreview(html) {
    const preview = html.querySelector('.avatar-preview');
    if (!preview) return;

    // Remove any previously attached window-level listeners
    this.#removePreviewListeners();

    let dragging = false;
    let startX, startY, startOffsetX, startOffsetY;

    preview.addEventListener('mousedown', (ev) => {
      if (this._draft.avatar.source !== 'portrait') return;
      ev.preventDefault();
      dragging = true;
      startX = ev.clientX;
      startY = ev.clientY;
      startOffsetX = this._draft.avatar.offsetX;
      startOffsetY = this._draft.avatar.offsetY;
      preview.style.cursor = 'grabbing';
    });

    this.#previewMouseMove = (ev) => {
      if (!dragging) return;
      const dx = ev.clientX - startX;
      const dy = ev.clientY - startY;
      this._draft.avatar.offsetX = Math.round(Math.max(-100, Math.min(100, startOffsetX + dx)));
      this._draft.avatar.offsetY = Math.round(Math.max(-100, Math.min(100, startOffsetY + dy)));
      this._markAvatarDirty();
      this.#updateAvatarPreview();
      this.#syncAvatarSliders();
    };
    window.addEventListener('mousemove', this.#previewMouseMove);

    this.#previewMouseUp = () => {
      if (!dragging) return;
      dragging = false;
      preview.style.cursor = '';
    };
    window.addEventListener('mouseup', this.#previewMouseUp);

    preview.addEventListener('wheel', (ev) => {
      if (this._draft.avatar.source !== 'portrait') return;
      ev.preventDefault();
      const delta = ev.deltaY > 0 ? -5 : 5;
      this._draft.avatar.zoom = Math.max(50, Math.min(300, this._draft.avatar.zoom + delta));
      this._markAvatarDirty();
      this.#updateAvatarPreview();
      this.#syncAvatarSliders();
    });
  }

  #bindAvatarSliders(html) {
    html.querySelectorAll('.avatar-slider').forEach((slider) => {
      slider.addEventListener('input', (ev) => {
        const prop = ev.target.dataset.prop;
        this._draft.avatar[prop] = Number(ev.target.value);
        this._markAvatarDirty();
        this.#updateAvatarPreview();
      });
    });
  }

  #updateAvatarPreview() {
    const img = this.element?.querySelector('.avatar-preview-img');
    if (!img) return;
    const { source, offsetX, offsetY, zoom } = this._draft.avatar;
    img.src = source === 'portrait' ? this.actor.img : this.actor.prototypeToken.texture.src;
    if (source === 'portrait') {
      img.style.objectFit = 'cover';
      img.style.objectPosition = `calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`;
      img.style.transform = `scale(${zoom / 100})`;
    } else {
      img.style.objectFit = 'contain';
      img.style.objectPosition = '';
      img.style.transform = '';
    }
  }

  #syncAvatarSliders() {
    const html = this.element;
    if (!html) return;
    for (const prop of ['offsetX', 'offsetY', 'zoom']) {
      const slider = html.querySelector(`.avatar-slider[data-prop="${prop}"]`);
      if (slider) slider.value = this._draft.avatar[prop];
    }
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
    const { hidden, hiddenGroups, favorites, customOrder, sortMode, skillsDirty, avatarDirty } = this._draft;

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
      isSkillsDirty: skillsDirty,
      isAvatarDirty: avatarDirty,
      sortModeChanged: sortMode !== savedSortMode,
      avatar: this._draft.avatar,
      previewImg: this._draft.avatar.source === 'portrait'
        ? this.actor.img
        : this.actor.prototypeToken.texture.src,
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
    this._markSkillsDirty();
    this.render(true);
  }

  static async _onSaveSkills() {
    const { hidden, hiddenGroups, favorites, customOrder } = this._draft;
    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarHidden', hidden);
    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarHiddenGroups', hiddenGroups);
    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarFavorites', favorites);
    if (customOrder?.skill?.length) {
      await this.actor.prototypeToken.setFlag('dsa5', 'hotbarControls', customOrder);
    } else {
      await this.actor.prototypeToken.unsetFlag('dsa5', 'hotbarControls');
    }
    this._draft.skillsDirty = false;
    this.render(true);
    ui.hotbar.render(true);
  }

  static async _onSaveAvatar() {
    const { avatar } = this._draft;
    const defaultAvatar = HotbarSortManager.DEFAULT_AVATAR;
    if (avatar.source !== defaultAvatar.source || avatar.offsetX !== defaultAvatar.offsetX || avatar.offsetY !== defaultAvatar.offsetY || avatar.zoom !== defaultAvatar.zoom) {
      await this.actor.prototypeToken.setFlag('dsa5', 'hotbarAvatar', avatar);
    } else {
      await this.actor.prototypeToken.unsetFlag('dsa5', 'hotbarAvatar');
    }
    this._draft.avatarDirty = false;
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
    this._markSkillsDirty();
    this.render(true);
  }

  static _onToggleGroup(ev, target) {
    const groupKey = target.dataset.group || target.closest('[data-group]')?.dataset.group;
    if (!groupKey) return;
    const { hiddenGroups } = this._draft;
    const index = hiddenGroups.indexOf(groupKey);
    if (index === -1) hiddenGroups.push(groupKey);
    else hiddenGroups.splice(index, 1);
    this._markSkillsDirty();
    this.render(true);
  }

  static _onToggleFavorite(ev, target) {
    const id = target.closest('.sort-card')?.dataset.id;
    if (!id) return;
    const { favorites } = this._draft;
    const index = favorites.indexOf(id);
    if (index === -1) favorites.push(id);
    else favorites.splice(index, 1);
    this._markSkillsDirty();
    this.render(true);
  }

  static _onResetOrder() {
    this._draft.customOrder = {};
    this._draft.sortMode = 'groupAlpha';
    this._markSkillsDirty();
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
    this._draft.avatar = foundry.utils.deepClone(HotbarSortManager.DEFAULT_AVATAR);
    this._markSkillsDirty();
    this._markAvatarDirty();
    this.render(true);
  }

  static _onSetAvatarSource(ev, target) {
    const source = target.dataset.source;
    if (!source) return;
    this._draft.avatar.source = source;
    this._markAvatarDirty();
    this.render(true);
  }

  static _onResetAvatar() {
    this._draft.avatar.offsetX = 0;
    this._draft.avatar.offsetY = 0;
    this._draft.avatar.zoom = 100;
    this._markAvatarDirty();
    this.render(true);
  }
}
