import TokenHotbar2 from './tokenHotbar2.js';
import Riding from '../automation/riding.js';
import OnUseEffect from '../automation/onUseEffects.js';
import CombatskillData from '../../data/item/combatskill.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';
import RuleChaos from '../rules/rule_chaos.js';
import { isTwoHandedWeapon } from '../helpers/weapon_hands.js';
import { tinyNotification } from '../helpers/view_helper.js';
import { VerticalSlider } from '../helpers/vslider.js';
import { GlobalToolTipHandler } from '../globals/tooltip.js';
import Actordsa5 from '../../actor/actor-dsa5.js';
import { resolveHotbarActorContext } from '../helpers/hotbar_actor.js';
import HotbarSortManager from './hotbar-sort-manager.js';
const { getProperty, mergeObject } = foundry.utils;

export default class DSA5Hotbar extends foundry.applications.ui.Hotbar {
  static BASEBARHEIGHT = 45;
  static ORDER_GROUPS = ['body', 'social', 'nature', 'knowledge', 'trade'];
  static VISIBLE_ROWS = 2;
  static FALLBACK_ICONS = {
    gm: 'systems/dsa5/icons/categories/DSA-Auge.webp',
    skillgm: 'systems/dsa5/icons/categories/Skill.webp',
    enchantment: 'systems/dsa5/icons/categories/enchantment.webp',
  };
  static WEAPON_POSITIONS = [
    "left:calc(50% - 74px);top:75px;",
    "left:calc(50% + 32px);top:75px;",
    "left:calc(50% - 91px);top:40px;",
    "left:calc(50% + 48px);top:40px;",
    "left:calc(50% - 86px);top:1px;",
    "left:calc(50% + 40px);top:1px;",
  ];
  static FALLBACK_NAMES = {
    gm: 'gmMenu',
    skillgm: 'TYPES.Item.skill',
    enchantment: 'enchantment',
  };

  static DEFAULT_OPTIONS = {
    actions: {
      categoryFilter: this.#filterCategory,
      weapon: this.#onRollWeapon,
      collapseBar: this.#onCollapse,
      toggleFreeAction: this.#onToggleFreeAction,
    },
  };

  static CONVERSION_PARTS = {
    hotbar: {
      template: 'systems/dsa5/templates/system/hud/hotbar.hbs',
      templates: [
        'systems/dsa5/templates/system/hud/actorpart.hbs',
        'systems/dsa5/templates/system/hud/actionpart.hbs',
      ],
      scrollable: ['#macro-list', '.hSection'],
    },
  };

  async _onRender(context, options) {
    await super._onRender(context, options);

    this.#addContextColor();

    if (!game.settings.get('dsa5', 'hotbarv3')) {
      this.element.classList.add('withThemes');
      return;
    }

    const html = $(this.element);
    this.element.classList.add('hotbarV4');
    this.element.querySelectorAll('.quantity-click').forEach(el => {
      el.addEventListener('mousedown', (ev) => RuleChaos.quantityClick(ev));
    });

    const fn = (ev) => {
      if (!html.find('.sections').is(':hover')) return;

      this.filterSections(ev, html);
      return false;
    };
    const filterOff = () => {
      if (html.find('.sections').is(':hover')) return;

      $(document).off('keydown.sectionFilter', fn);
      this.searching = '';
      html.find('.macro,.primary,.sections .skillItems').removeClass('dsahidden');
      html.find('.longLayout').removeClass('longLayout');
    };
    html.find('.sections').on('pointerover', () => {
      $(document).off('keydown.sectionFilter', fn).on('keydown.sectionFilter', fn);
    });

    html.find('.sections').on('pointerout', filterOff);
    html.find('.primary,.weapon,[data-category="plain"],.hotbar-avatar').on('pointerover', (ev) => this.#betterTooltip(ev));

    // This can not got to actions at the moment, because event is not handled properly
    html.find('[data-action="quickButton"]').on('mousedown', (ev) => this.#quickButton(ev));

    html.find('.itdarkness input').on('change', (ev) => this.tokenHotbar.changeDarkness(ev));

    html.find('#macro-list, .skillItems').on('wheel', e => this.#onWheel(e));

    html.find('.hotbar-avatar').on('dblclick', () => this.actor.sheet.render(true));

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: ".wiggle-animation",
      dropSelector: ".wiggle-animation",
      permissions: {
        dragstart: this._canDragStartEdit.bind(this),
        drop: this._canDragDropEdit.bind(this)
      },
      callbacks: {
        dragstart: this._onDragStartEdit.bind(this),
        dragover: this._onDragOverEdit.bind(this),
        drop: this._onDropEdit.bind(this),
      }
    }).bind(this.element);

    const container = this.element.querySelector('.rangeContainer');
    if (!container) return;

    this.slider = new VerticalSlider(container, 'vSliderDarkness', {
      value: (canvas?.scene?.environment.darknessLevel || 0) * 100,
      onChange: (value) => this.onSliderChanged(value)
    });
  }

  _canDragStartEdit() {
    return this.editMode;
  }

  _canDragDropEdit() {
    return this.editMode;
  }

  async _onDragStartEdit(event) {
    const li = event.currentTarget;
    if (!li) return;

    const category = li.closest('.hSection').dataset.category;
    if (!category) {
      return;
    }

    const dragData = {
      type: 'elementResorting',
      id: li.dataset.id,
      category,
    };
    event.dataTransfer.setData("text/plain", JSON.stringify(dragData));
    event.dataTransfer.effectAllowed = 'move';
    li.classList.add('dragging');
    this.draggedElement = li;

    this.#setupAutoScroll();
  }

  #setupAutoScroll() {
    this.#clearAutoScroll();

    this.autoScrollSettings = {
      scrollZoneSize: 30,
      scrollSpeed: 2,
      scrollInterval: 100,
      isScrolling: false
    };
  }

  #clearAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
    if (this.autoScrollSettings) {
      this.autoScrollSettings.isScrolling = false;
    }
  }

  #checkAutoScroll(event, container) {
    if (!this.autoScrollSettings || !container) return;

    const containerRect = container.getBoundingClientRect();
    const mouseY = event.clientY;

    const relativeY = mouseY - containerRect.top;
    const containerHeight = containerRect.height;

    if (relativeY < 0 || relativeY > containerHeight) {
      this.#stopAutoScroll();
      return;
    }

    let scrollDirection = 0;
    let intensity = 1;

    if (relativeY < this.autoScrollSettings.scrollZoneSize) {
      scrollDirection = -1;
      intensity = Math.max(0.5, (this.autoScrollSettings.scrollZoneSize - relativeY) / this.autoScrollSettings.scrollZoneSize);
    } else if (relativeY > containerHeight - this.autoScrollSettings.scrollZoneSize) {
      scrollDirection = 1;
      const distanceFromBottom = containerHeight - relativeY;
      intensity = Math.max(0.5, (this.autoScrollSettings.scrollZoneSize - distanceFromBottom) / this.autoScrollSettings.scrollZoneSize);
    }

    if (scrollDirection !== 0) {
      this.#startAutoScroll(container, scrollDirection, intensity);
    } else {
      this.#stopAutoScroll();
    }
  }

  #startAutoScroll(container, direction, intensity = 1) {
    if (this.autoScrollSettings.isScrolling &&
      this.autoScrollSettings.currentDirection === direction &&
      Math.abs(this.autoScrollSettings.currentIntensity - intensity) < 0.1) {
      return;
    }

    this.#stopAutoScroll();

    this.autoScrollSettings.isScrolling = true;
    this.autoScrollSettings.currentDirection = direction;
    this.autoScrollSettings.currentIntensity = intensity;

    const scrollAmount = DSA5Hotbar.BASEBARHEIGHT * direction * this.autoScrollSettings.scrollSpeed * intensity;
    const intervalTime = Math.max(50, this.autoScrollSettings.scrollInterval / intensity);

    this.autoScrollInterval = setInterval(() => {
      const currentScroll = container.scrollTop;
      const maxScroll = container.scrollHeight - container.clientHeight;
      const newScroll = Math.max(0, Math.min(maxScroll, currentScroll + scrollAmount));

      if (newScroll !== currentScroll) {
        container.scrollTop = newScroll;
      } else {
        this.#stopAutoScroll();
      }
    }, intervalTime);
  }

  #stopAutoScroll() {
    if (this.autoScrollInterval) {
      clearInterval(this.autoScrollInterval);
      this.autoScrollInterval = null;
    }
    if (this.autoScrollSettings) {
      this.autoScrollSettings.isScrolling = false;
      this.autoScrollSettings.currentDirection = null;
      this.autoScrollSettings.currentIntensity = null;
    }
  }

  _onDragOverEdit(event) {
    if (!this.editMode) return;

    event.preventDefault();

    const target = event.currentTarget;
    const container = target?.closest('.hSection');

    if (!target || !container) return;

    container.querySelectorAll('.wiggle-animation').forEach(el =>
      el.classList.toggle('drag-over', el === target)
    );

    this.#checkAutoScroll(event, container);
  }

  async _onDropEdit(event) {
    if (!this.editMode) return;

    event.preventDefault();
    event.stopPropagation();

    this.#clearAutoScroll();

    const target = event.currentTarget;
    const container = target?.closest('.hSection');

    container.querySelector('.drag-over')?.classList.remove('drag-over');

    if (this.draggedElement) {
      this.draggedElement.classList.remove('dragging');
      this.draggedElement = null;
    }

    if (!target || !container) return;

    let dragData;
    try {
      dragData = JSON.parse(event.dataTransfer.getData("text/plain"));
    } catch (e) {
      return;
    }

    if (container.dataset.category != dragData.category) return;

    if (!this.actor) return;

    const slots = container.querySelectorAll('li');
    const slotArray = Array.from(slots).map(s => s.dataset.id);
    const targetId = target.dataset.id;
    const fromIndex = slotArray.indexOf(dragData.id);
    const toIndex = slotArray.indexOf(targetId);

    if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) return;

    slotArray[fromIndex] = targetId;
    slotArray[toIndex] = dragData.id;

    const currentFlags = this.actor.prototypeToken.getFlag('dsa5', 'hotbarControls') || {};
    currentFlags[dragData.category] = slotArray;

    await this.actor.prototypeToken.setFlag('dsa5', 'hotbarControls', currentFlags);
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);

    new foundry.applications.ux.ContextMenu(this.element, '[data-action="weapon"]', [], {
      onOpen: this.#onWeaponContext.bind(this),
      jQuery: false,
      fixed: true,
    });
    new foundry.applications.ux.ContextMenu(this.element, '[data-action="configMenu"]', [], {
      onOpen: this.#onConfigContext.bind(this),
      jQuery: false,
      fixed: true,
      eventName: 'click'
    });
  }

  updateDarknessSlider(value) {
    this.slider?.setValue(value * 100);
  }

  onSliderChanged(value) {
    this.tokenHotbar?.changeDarkness({ currentTarget: { value: value / 100 } })
  }

  #onWheel(e) {
    e.preventDefault();

    if (this.isScrolling) return;

    this.isScrolling = true;

    const delta = e.originalEvent.deltaY;
    const direction = delta > 0 ? 1 : -1;
    const rowsToScroll = 2;
    const scrollAmount = DSA5Hotbar.BASEBARHEIGHT * direction * rowsToScroll;
    const target = e.currentTarget;
    $(target).stop().animate({
      scrollTop: target.scrollTop + scrollAmount
    }, 100, () => {
      this.isScrolling = false;
    });
  }

  async #quickButton(ev, target) {
    game.tooltip.deactivate();
    await this.tokenHotbar.executeQuickButton(ev);
  }

  #addContextColor() {
    const parryText = ` ${_loc('CHAR.PARRY')}`;
    const attackText = ` ${_loc('CHAR.ATTACK')}`;

    for (const slot of this.slots) {
      const mac = slot.macro;
      if (!mac?.name) continue;

      const el = this.element.querySelector(`[data-slot="${slot.slot}"]`);
      if (!el) continue;

      if (mac.name.endsWith(parryText)) el.classList.add('parry');
      else if (mac.name.endsWith(attackText)) el.classList.add('attack');
    }
  }

  _configureRenderParts(options) {
    if (game.settings.get('dsa5', 'hotbarv3')) return foundry.utils.deepClone(this.constructor.CONVERSION_PARTS);

    return super._configureRenderParts(options);
  }

  async #betterTooltip(ev) {
    GlobalToolTipHandler.handleTooltip(ev, this.actor)
  }

  static #filterCategory(ev, target) {
    const category = target.dataset.filter;
    const html = this.element;

    html.querySelector('.sections')?.classList.toggle('filterOn', !!category);

    html.querySelectorAll('.skillItems').forEach(el =>
      el.classList.toggle('collapsed', el.dataset.category !== category)
    );

    html.querySelectorAll('.categoryFilter').forEach(el =>
      el.classList.toggle('active', el.dataset.filter === category)
    );

    if (this.actor) this.activeSection = category;
    else this.gmFilters = category;
  }

  static #onCollapse(ev, target) {
    this.collapseBar = !this.collapseBar;
    target.classList.toggle('fa-chevron-up', this.collapseBar);
    target.classList.toggle('fa-chevron-down', !this.collapseBar);
    this.element.classList.toggle('collapsedBar');
  }

  static #onToggleFreeAction(ev, target) {
    if (!game.combat || !this.actor) return;

    const token = this.actor?.isToken ? this.actor.token : this.actor?.getActiveTokens()[0];
    const speaker = { token: token?.id, actor: this.actor.id };
    game.combat.toggleFreeAction(speaker);
  }

  static async #onRollWeapon(ev, target) {
    const { id, subweapon } = target.dataset;

    const options = {};
    const activeTokenID = this.actor?.token?.id ?? this.actor?.getActiveTokens()[0]?.id;

    if (!id) {
      this.actor.setupWeaponless('attack', options, activeTokenID).then((setupData) => {
        this.actor.basicTest(setupData);
      });
      return;
    }

    const item = this.actor?.items.get(id);
    if (!item) return;

    switch (item.type) {
      case 'meleeweapon':
      case 'rangeweapon':
        const result = Actordsa5.buildSubweapon(item, subweapon);
        this.actor.setupWeapon(result, 'attack', options, activeTokenID).then((setupData) => {
          this.actor.basicTest(setupData);
        });
        break;
      case 'trait':
        this.actor.setupWeapon(item, 'attack', options, activeTokenID).then((setupData) => {
          this.actor.basicTest(setupData);
        });
        break;
    }
  }

  filterSections(ev, html) {
    this.searching = this.searching || '';

    const key = ev.key ?? '';
    if (key === 'Backspace' || ev.which === 8) this.searching = this.searching.slice(0, -1);
    else if (key.length === 1 && /\p{L}|\p{N}/u.test(key)) this.searching += key;
    else return;

    ev.preventDefault();
    ev.stopPropagation();

    const search = this.searching.toLowerCase();
    tinyNotification(search);

    const $sections = html.find('.sections').toggleClass('longLayout', !!search);

    $sections.find('.hSection').each((_, sec) => {
      const $primaries = $(sec).find('.primary');
      let hidden = 0;

      $primaries.each((_, el) => {
        if (el.dataset.skipfilter) {
          $(el).removeClass('dsahidden');
          return;
        }
        const name = (el.dataset.name || '').toLowerCase().trim();
        const isHidden = search && name.indexOf(search) === -1;
        $(el).toggleClass('dsahidden', isHidden);
        if (isHidden) hidden++;
      });

      $(sec).toggleClass('dsahidden', hidden === $primaries.length);
    });

    return false;
  }

  #prepareActorActions(actor, groups) {
    const combatskills = actor.items.reduce((arr, i) => {
      if (i.type === 'combatskill') arr.push(CombatskillData._calculateCombatSkillValues(i.toObject(), actor.system));
      return arr;
    }, []);

    const brawl = this.tokenHotbar?._brawlEntry(combatskills);
    const isRiding = Riding.isRiding(actor);

    if (isRiding) {
      const ridingEntry = this.tokenHotbar?._ridingEntry(actor);
      if (ridingEntry) groups.skills.skill = [ridingEntry];
    }

    if (brawl) groups.attacks.push(brawl);

    groups.functions = this.tokenHotbar?._functionEntries() || [];

    for (const x of actor.items) {
      switch (x.type) {
        case 'skill':
          this.#pushSkill(groups, 'skill', this.tokenHotbar?._skillEntry(x, 'skill'));
          break;
        case 'spell':
        case 'liturgy':
          this.#pushSkill(groups, x.type, this.tokenHotbar?._skillEntry(x, 'spell'));
          break;
        case 'trait':
          if (TokenHotbar2.traitTypes.has(x.system.traitType.value)) {
            groups.attacks.push(this.tokenHotbar?._traitEntry(x, actor.system));
          }
          break;
        case 'consumable':
          this.#pushSkill(groups, 'consumable', this.tokenHotbar?._actionEntry(x, 'consumable', { abbrev: x.system.quantity.value }));
          break;
        case 'meleeweapon':
        case 'rangeweapon': {
          const entries = this.tokenHotbar?._combatEntry(x, combatskills, actor) || [];
          for (const entry of entries) {
            if (!x.system.worn.value) entry.cssClass = 'unequipped';
            groups.attacks.push(entry);
          }
          break;
        }
        default:
          break;
      }

      if (OnUseEffect.hasOnUseEffect(x)) {
        this.#pushSkill(groups, x.type, this.tokenHotbar?._actionEntry(x, 'onUse', { subfunction: 'onUse' }));
      }
      if (x.getFlag('dsa5', 'enchantments')) {
        if (!groups.skills.enchantment) groups.skills.enchantment = [];
        for (const enchantment of x.getFlag('dsa5', 'enchantments')) {
          groups.skills.enchantment.push(this.tokenHotbar?._enchantmentEntry(enchantment, 'enchantment', x, { subfunction: 'enchantment' }));
        }
      }
    }
  }

  #pushSkill(groups, key, entry) {
    if (!groups.skills[key]) groups.skills[key] = [];
    groups.skills[key].push(entry);
  }

  #sortSkillList(list) {
    if (!list) return;
    list.sort((a, b) => DSA5Hotbar.ORDER_GROUPS.indexOf(a.addClass) - DSA5Hotbar.ORDER_GROUPS.indexOf(b.addClass) || a.name.localeCompare(b.name));
  }

  #applyHotbarSorting(groups) {
    const sortMode = game.settings.get('dsa5', 'hotbarSortMode');

    if (sortMode === 'custom') {
      this.#sortSkillList(groups.skills.skill);
      this.#sortSkillList(groups.skills.skillgm);
      this.#applySavedOrdering(groups);
    } else {
      for (const key of Object.keys(groups.skills)) {
        const list = groups.skills[key];
        if (!list) continue;

        switch (sortMode) {
          case 'alpha':
            list.sort((a, b) => a.name.localeCompare(b.name));
            break;
          case 'valueDesc':
            list.sort((a, b) => (b.tw ?? 0) - (a.tw ?? 0) || a.name.localeCompare(b.name));
            break;
          case 'valueAsc':
            list.sort((a, b) => (a.tw ?? 0) - (b.tw ?? 0) || a.name.localeCompare(b.name));
            break;
          case 'groupAlpha':
          default:
            this.#sortSkillList(list);
            break;
        }
      }
    }
  }

  #applyHotbarFilters(groups) {
    if (!this.actor) return;

    const hidden = this.actor.prototypeToken.getFlag('dsa5', 'hotbarHidden') || [];
    const hiddenGroups = this.actor.prototypeToken.getFlag('dsa5', 'hotbarHiddenGroups') || [];
    const favorites = this.actor.prototypeToken.getFlag('dsa5', 'hotbarFavorites') || [];

    if (hiddenGroups.length > 0 && groups.skills.skill) {
      groups.skills.skill = groups.skills.skill.filter((item) => !hiddenGroups.includes(item.addClass));
    }

    if (hidden.length > 0) {
      for (const key of Object.keys(groups.skills)) {
        if (!groups.skills[key]) continue;
        groups.skills[key] = groups.skills[key].filter((item) => !hidden.includes(item.id));
      }
    }

    if (favorites.length > 0 && game.settings.get('dsa5', 'hotbarSortMode') !== 'custom') {
      for (const key of Object.keys(groups.skills)) {
        if (!groups.skills[key]) continue;
        const favs = groups.skills[key].filter((item) => favorites.includes(item.id));
        const rest = groups.skills[key].filter((item) => !favorites.includes(item.id));
        groups.skills[key] = [...favs, ...rest];
      }
    }
  }

  #applySavedOrdering(groups) {
    if (!this.actor) return;

    const savedOrder = this.actor.prototypeToken.getFlag('dsa5', 'hotbarControls');
    if (!savedOrder) return;

    for (const [category, orderArray] of Object.entries(savedOrder)) {
      if (!orderArray || !Array.isArray(orderArray)) continue;

      if (groups.skills[category]) {
        groups.skills[category] = this.#reorderArrayByFlags(groups.skills[category], orderArray);
      }
    }
  }

  #reorderArrayByFlags(itemArray, orderArray) {
    if (!itemArray || itemArray.length === 0) return itemArray;

    const filteredItemArray = itemArray.filter((item) => !!item);
    if (!orderArray || orderArray.length === 0) return filteredItemArray;

    const filteredOrderArray = orderArray.filter((id) => !!id);

    const itemMap = new Map();
    filteredItemArray.forEach(item => {
      if (item?.id) itemMap.set(item.id, item);
    });

    const orderedItems = [];
    const usedIds = new Set();

    filteredOrderArray.forEach(id => {
      if (itemMap.has(id) && !usedIds.has(id)) {
        orderedItems.push(itemMap.get(id));
        usedIds.add(id);
      }
    });

    filteredItemArray.forEach(item => {
      if (item?.id && !usedIds.has(item.id)) {
        orderedItems.push(item);
      } else if (!item?.id) {
        orderedItems.push(item);
      }
    });

    return orderedItems;
  }

  async #prepareGMActions(groups) {
    groups.skills.gm = this.tokenHotbar?._gmEntries() || [];
    groups.skills.skillgm = this.tokenHotbar?.skills || (await this.tokenHotbar?.prepareSkills()) || [];
    return true;
  }

  #generateFilterCategories(groups) {
    const filterCategories = [];

    for (const key of Object.keys(groups.skills)) {
      const i18nkey = `TYPES.Item.${key}`;
      filterCategories.push({
        key,
        tooltip: game.i18n.has(i18nkey)
          ? _loc(i18nkey)
          : _loc(DSA5Hotbar.FALLBACK_NAMES[key]),
        img: ITEM_CONSTANTS.DEFAULT_IMAGES[key] || DSA5Hotbar.FALLBACK_ICONS[key],
      });
    }

    if (groups.attacks.length > 0) {
      groups.attacks.sort((a, b) =>
        (b.cssClass || '').localeCompare(a.cssClass || '') ||
        a.name.localeCompare(b.name)
      );
      filterCategories.unshift({
        key: 'attacks',
        tooltip: _loc('Combat'),
        img: 'systems/dsa5/icons/categories/Meleeweapon.webp',
      });
    }

    return filterCategories;
  }

  async #prepareEffects() {
    if (!this.showEffects) return [];

    let effects = [];

    if (canvas.tokens.controlled.length > 1) {
      let sharedEffects = await this.tokenHotbar._effectEntries(
        canvas.tokens.controlled[0].actor,
        { subfunction: 'sharedEffect' }
      );

      for (const token of canvas.tokens.controlled) {
        const tokenEffects = token.actor
          ? (await token.actor.actorEffects()).map((x) => x.name)
          : [];
        sharedEffects = sharedEffects.filter((x) =>
          tokenEffects.includes(x.name)
        );
      }
      effects = sharedEffects;
    }

    this.#conditionAddEffect(effects);
    return effects;
  }

  #conditionAddEffect(effects) {
    const label = _loc('CONDITION.add');
    effects.unshift({
      name: 'CONDITION.add',
      id: '',
      icon: 'icons/svg/aura.svg',
      cssClass: 'effect',
      abbrev: label[0],
      subfunction: 'addEffect',
      indicator: '+',
    });
  }

  #determineActiveSection(groups, currentSection) {
    const allowedKeys = Object.keys(groups.skills).concat(['attacks', 'macro']);

    if (!currentSection || !allowedKeys.includes(currentSection)) {
      return Object.keys(groups.skills)[0];
    }

    return currentSection;
  }

  async _prepareContext(_options) {
    const context = await super._prepareContext(_options);
    if (!game.settings.get("dsa5", "hotbarv3")) return context;

    this.#setActor();

    context.collapseBar = this.collapseBar;
    context.editMode = this.editMode ? 'wiggle-animation' : '';
    const actor = this.actor;

    const groups = { skills: {}, attacks: [], functions: [] };
    let effects = [];
    let gmMode = false;
    let activeSection;

    if (actor) {
      if (!['epic', 'loot'].includes(getProperty(actor.system.merchant.merchantType))) {
        activeSection = this.activeSection;
        effects = await this.tokenHotbar?._effectEntries(actor) || [];
        this.#conditionAddEffect(effects);
        this.#prepareActorActions(actor, groups);
      }
    } else if (game.user.isGM && !game.settings.get('dsa5', 'disableTokenhotbarMaster')) {
      activeSection = this.gmFilters;
      gmMode = await this.#prepareGMActions(groups);
    }

    this.#applyHotbarSorting(groups);
    this.#applyHotbarFilters(groups);

    const filterCategories = this.#generateFilterCategories(groups);

    if (this.showEffects && effects.length === 0) {
      effects = await this.#prepareEffects();
    }

    activeSection = this.#determineActiveSection(groups, activeSection);

    mergeObject(context, {
      token: { groups, effects },
      baseBarHeight: `${DSA5Hotbar.BASEBARHEIGHT}px`,
      barHeight: `${(DSA5Hotbar.BASEBARHEIGHT + 7) * DSA5Hotbar.VISIBLE_ROWS + 40}px`,
      filterCategories,
      showEffects: this.showEffects,
      activeSection,
      gmMode,
      slots: this.#getAllMacros(),
    });

    this.prepareActorContext(context);

    return context;
  }

  #onWeaponContext(target) {
    const { id, mode } = target.dataset;
    const weapon = this.actor.items.get(id);

    ui.context.menuItems = this.#getWeaponContextOptions(weapon, mode === 'offHand');
  }

  #onConfigContext() {
    const options = [
      {
        label: game.audio.globalMute ? 'HOTBAR.UNMUTE' : 'HOTBAR.MUTE',
        icon: game.audio.globalMute ? "<i class='fa-solid fa-volume-xmark'></i>" : "<i class='fa-solid fa-volume'></i>",
        onClick: () => {
          game.audio.globalMute = !game.audio.globalMute;
          this._updateToggles();
        }
      },
      {
        label: this.locked ? 'HOTBAR.UNLOCK' : 'HOTBAR.LOCK',
        icon: this.locked ? "<i class='fa-solid fa-unlock'></i>" : "<i class='fa-solid fa-lock'></i>",
        onClick: async () => {
          await game.settings.set("core", "hotbarLock", !this.locked, { render: false });
          this._updateToggles();
        }
      },
      {
        label: 'SHEET.Configure',
        icon: "<i class='fa-solid fa-edit'></i>",
        visible: () => !!this.actor,
        onClick: () => {
          this.#toggleEditMode();
        }
      },
      {
        label: 'DSA5HOTBARCONFIG.manager',
        icon: "<i class='fa-solid fa-bars-sort'></i>",
        visible: () => !!this.actor,
        onClick: () => {
          new HotbarSortManager(this.actor).render(true);
        }
      },
      {
        label: 'HOTBAR.CLEAR',
        icon: "<i class='fa-solid fa-trash'></i>",
        onClick: async () => {
          const proceed = await foundry.applications.api.DialogV2.confirm({
            window: {
              title: "HOTBAR.CLEAR",
              icon: "fa-solid fa-trash"
            },
            content: _loc("HOTBAR.CLEAR_CONFIRM"),
            modal: true
          });
          if (proceed) await game.user.update({ hotbar: {} }, { recursive: false, diff: false, noHook: true });
        }
      }
    ];
    ui.context.menuItems = options;
  }

  #toggleEditMode() {
    this.editMode = !this.editMode;

    if (!this.editMode) {
      this.#clearAutoScroll();
    }

    this.render(true);
  }

  _updateToggles() {
    if (!game.settings.get('dsa5', 'hotbarv3')) return super._updateToggles();
  }

  #getWeaponContextOptions(weapon, isOffHand) {
    if (weapon?.type === 'trait') return [];

    const equipableWeapons = this.actor.items.filter((i) => {
      if (!['meleeweapon', 'rangeweapon'].includes(i.type) || i.system.worn.value) return false;
      if (isOffHand) return this.actor.canEquipWeaponOffHand(i);
      return true;
    });
    const equip = _loc(isOffHand ? 'SHEET.EquipItemOffHand' : 'SHEET.EquipItem');
    const options = equipableWeapons.reduce((acc, w) => {
      if (weapon?.id === w.id) return acc;
      acc.push({
        label: `${equip}: ${w.name}`,
        icon: "<i class='fa-solid fa-swords'></i>",
        onClick: async () => {
          await this.actor.equipWeaponToHand(w.id, { hand: isOffHand ? 'offhand' : 'main', equip: true });
        },
      });
      return acc;
    }, []);

    if (weapon) {
      options.push(...weapon.system.getContextOptions());
    }

    return options;
  }

  get tokenHotbar() {
    return game.dsa5.apps.tokenHotbar;
  }

  prepareActorContext(context) {
    if (!this.actor) return;

    context.actor = this.actor;

    const avatarConfig = this.actor.prototypeToken.getFlag('dsa5', 'hotbarAvatar');
    if (avatarConfig?.source === 'portrait') {
      context.actorImg = this.actor.img;
      context.avatarStyle = this.#buildAvatarStyle(avatarConfig);
    } else {
      context.actorImg = this.actor.token?.img || this.actor.prototypeToken.texture.src || this.actor.img;
      context.avatarStyle = '';
    }

    context.resources = this.#prepareResources(context);
    context.weapons = this.#weaponPositions(context);
    const token = this.actor?.isToken ? this.actor.token : this.actor?.getActiveTokens()[0];
    context.inCombat = game.combat;
    context.turnClass = context.inCombat && game.combat?.current?.combatantId === token?.combatant?.id ? 'myRound' : '';

    if (context.turnClass === 'myRound') {
      const combatant = token?.combatant;
      context.actionPips = this.#prepareActionPips(combatant, token);
    }
  }

  #buildAvatarStyle(config) {
    const { offsetX = 0, offsetY = 0, zoom = 100 } = config;
    const parts = ['object-fit: cover'];
    if (offsetX || offsetY) {
      parts.push(`object-position: calc(50% + ${offsetX}px) calc(50% + ${offsetY}px)`);
    }
    if (zoom !== 100) {
      parts.push(`transform: scale(${zoom / 100})`);
    }
    return parts.join('; ');
  }

  #prepareResources(context) {
    return {
      LeP: {
        value: this.actor.system.status.wounds.value,
        max: this.actor.system.status.wounds.max,
        label: _loc('CHAR.LEP'),
      },
      AsP: {
        value: this.actor.system.status.astralenergy.value,
        max: this.actor.system.status.astralenergy.max,
        label: _loc('CHAR.ASP'),
      },
      KaP: {
        value: this.actor.system.status.karmaenergy.value,
        max: this.actor.system.status.karmaenergy.max,
        label: _loc('CHAR.KAP'),
      },
    }
  }

  #prepareActionPips(combatant, token) {
    if (!combatant) return undefined;

    const actor = combatant.actor;
    // Creatures may have actionCount > 1; characters always get 1
    const creatureActions = Math.max(Number(actor?.system.actionCount?.value) || 1, 1);
    const bonusActions = Number(actor?.system.combat?.bonusActions) || 0;
    const totalActions = creatureActions + bonusActions;
    const actionsUsed = combatant.system.actionsUsed || 0;
    const freeActionUsed = !!combatant.system.freeActionUsed;

    // Movement derived from movementHistory at render time
    const tokenObj = token?.object;
    let distance = 0;
    if (tokenObj && token.movementHistory?.length) {
      try {
        distance = tokenObj.measureMovementPath(token.movementHistory).distance;
      } catch { /* token may not be on canvas */ }
    }
    const speed = actor?.speedByMovementType?.('walk') || 0;
    const moved = distance > 0;
    const movementCostsAction = distance > speed;

    // Free action: consumed by any movement up to GS, or manually toggled
    const freeAction = {
      used: freeActionUsed || moved,
      tooltip: _loc('COMBATTRACKER.freeActionPipHint'),
    };

    // Base actions: build pip array; show overuse pips if used > total
    const baseActions = [];
    const displayCount = Math.max(totalActions, actionsUsed);
    for (let i = 0; i < displayCount; i++) {
      const used = i < actionsUsed;
      const overuse = i >= totalActions;
      let tooltip;
      if (overuse) {
        tooltip = _loc('COMBATTRACKER.overusePipHint');
      } else {
        tooltip = _loc('COMBATTRACKER.baseActionPipHint').replace('{used}', actionsUsed).replace('{total}', totalActions);
      }
      baseActions.push({ used, overuse, tooltip });
    }

    // Movement bar: 0..GS = free, GS..2*GS = costs base action, >2*GS = exceeded
    const maxMovement = speed * 2;
    const percent = maxMovement > 0 ? Math.min(100, Math.round(distance / maxMovement * 100)) : 0;
    const exceeded = maxMovement > 0 && distance > maxMovement;
    const movementTooltip = _loc('COMBATTRACKER.movementPipHint')
      .replace('{used}', Math.round(distance))
      .replace('{max}', maxMovement);

    const movement = {
      total: maxMovement,
      used: Math.round(distance),
      percent,
      exceeded,
      costsBaseAction: movementCostsAction,
      tooltip: movementTooltip,
    };

    return { baseActions, freeAction, movement };
  }

  #weaponPositions(context) {
    const weapons = context.token.groups.attacks;
    const positions = [];

    let positionIndex = 0;

    const humanoidWeapons = [];
    const animalWeapons = [];

    for (const weapon of weapons) {
      if (weapon.cssClass === 'unequipped') continue;

      const item = this.actor.items.get(weapon.id);
      if (!item) continue;

      if (item.type == 'trait') {
        animalWeapons.push(weapon);
      }
      else {
        humanoidWeapons.push(weapon);
      }
    }

    if (humanoidWeapons.length || animalWeapons.length == 0) {
      positionIndex += this.#addHumanoidWeapon(positions, humanoidWeapons, positionIndex);
    }

    positionIndex += this.#addAnimalWeapon(positions, animalWeapons, positionIndex);

    //TODO add weapon editing later
    if (this.editMode && false) {
      while (positionIndex < DSA5Hotbar.WEAPON_POSITIONS.length) {
        positions.push({
          weapon: { name: _loc('attackWeaponless') },
          style: DSA5Hotbar.WEAPON_POSITIONS[positionIndex++],
          isEmpty: true
        });
      }
    }

    return positions;
  }

  #addHumanoidWeapon(positions, humanoidWeapons, startIndex) {
    let positionIndex = startIndex;
    const emptyHands = {
      name: _loc('attackWeaponless'),
    }

    const offHandWeapons = [];
    const mainHandWeapons = [];

    for (let i = 0; i < humanoidWeapons.length; i++) {
      const w = humanoidWeapons[i];
      const item = this.actor.items.get(w.id);
      const offHand = item.system.worn.offHand;
      if (offHand) offHandWeapons.push(item);
      else {
        mainHandWeapons.push(item);
        if (item.type === 'rangeweapon') {
          offHandWeapons.push(item);
        }
      }
    }

    mainHandWeapons.sort((a, b) => {
      if (a.type === b.type) return 0;
      if (a.type === 'meleeweapon') return -1;
      if (b.type === 'meleeweapon') return 1;
      return 0;
    });

    const firstWeapon = mainHandWeapons[0] || emptyHands;
    positions.push({
      weapon: firstWeapon,
      style: DSA5Hotbar.WEAPON_POSITIONS[positionIndex++] || "display:none;",
    });

    const twoHanded = isTwoHandedWeapon(firstWeapon);
    const secondWeapon = twoHanded ? firstWeapon : (offHandWeapons.find(x => x.id !== firstWeapon.id) || emptyHands);

    positions.push({
      weapon: secondWeapon,
      style: DSA5Hotbar.WEAPON_POSITIONS[positionIndex++] || "display:none;",
      mode: 'offHand'
    });
    return positionIndex - startIndex;
  }

  #addAnimalWeapon(positions, animalWeapons, startIndex) {
    let positionIndex = startIndex;

    for (const weapon of animalWeapons) {
      if (positionIndex >= DSA5Hotbar.WEAPON_POSITIONS.length) break;

      positions.push({
        weapon: this.actor.items.get(weapon.id),
        style: DSA5Hotbar.WEAPON_POSITIONS[positionIndex++]
      });
    }
    return positionIndex - startIndex;
  }

  updateHotbar(actorId, force = false) {
    if (!game.settings.get("dsa5", "hotbarv3")) return;

    if (actorId === this.actor?.id || force) this.render(true, { focus: false });
  }

  #setActor() {
    const controlled = canvas?.tokens?.controlled || [];
    const { actor: newActor } = resolveHotbarActorContext();

    if (this.actor !== newActor && this.editMode) {
      this.editMode = false;
    }

    this.actor = newActor || null;
    this.showEffects = controlled.length >= 1;
  }

  #getAllMacros() {
    const hotbar = game.user?.hotbar ?? {};
    const emptyLabel = _loc('HOTBAR.EMPTY');
    return Array.from({ length: 50 }, (_, i) => {
      const key = i + 1;
      const id = hotbar[key] ?? '';
      const macro = id ? (game.macros.get(id) ?? null) : null;
      return {
        key,
        slot: key,
        macro,
        img: macro?.img ?? null,
        cssClass: macro ? 'full' : 'open',
        tooltip: macro?.name ?? null,
        ariaLabel: macro?.name ?? emptyLabel,
      };
    });
  }
}
