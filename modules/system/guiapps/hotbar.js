import TokenHotbar2 from './tokenHotbar2.js';
import Riding from '../automation/riding.js';
import CombatskillData from '../../data/item/combatskill.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';
import RuleChaos from '../rules/rule_chaos.js';
import { tinyNotification } from '../helpers/view_helper.js';
import { VerticalSlider } from '../helpers/vslider.js';
import { GlobalToolTipHandler } from '../globals/tooltip.js';
import { localize } from '../helpers/localizer.js';
import Actordsa5 from '../../actor/actor-dsa5.js';
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
      weapon: this.#onRollWeapon
    },
  };

  static CONVERSION_PARTS = {
    hotbar: {
      template: 'systems/dsa5/templates/system/hud/hotbar.hbs',
      templates: [
        'systems/dsa5/templates/system/hud/actorpart.hbs',
        'systems/dsa5/templates/system/hud/actionpart.hbs',
      ],
      scrollable: ['#macro-list'],
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
    html.find('.primary,.weapon,[data-category="plain"]').on('pointerover', (ev) => this.#betterTooltip(ev));
    html.find('[data-action="quickButton"]').on('click', (ev) => this.#quickButton(ev));
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

    let category = li.closest('.hSection').dataset.category;
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
  }

  async _onDropEdit(event) {
    if (!this.editMode) return;

    event.preventDefault();
    event.stopPropagation();

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
    this.slider.setValue(value * 100);
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
    const parryText = ` ${localize('CHAR.PARRY')}`;
    const attackText = ` ${localize('CHAR.ATTACK')}`;

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

  static async #onRollWeapon(ev, target) {
    const { id, subweapon } = target.dataset;

    const options = {};

    if (!id) {
      this.actor.setupWeaponless('attack', options, this.actor.token?.id).then((setupData) => {
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
        this.actor.setupWeapon(result, 'attack', options,).then((setupData) => {
          this.actor.basicTest(setupData);
        });
        break;
      case 'trait':
        this.actor.setupWeapon(item, 'attack', options, this.actor.token?.id).then((setupData) => {
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

    const brawl = this.tokenHotbar._brawlEntry(combatskills);
    const isRiding = Riding.isRiding(actor);

    if (isRiding) {
      const ridingEntry = this.tokenHotbar._ridingEntry(actor);
      if (ridingEntry) groups.skills.skill = [ridingEntry];
    }

    if (brawl) groups.attacks.push(brawl);

    groups.functions = this.tokenHotbar?._functionEntries() || [];

    for (const x of actor.items) {
      switch (x.type) {
        case 'skill':
          this.#pushSkill(groups, 'skill', this.tokenHotbar._skillEntry(x, 'skill'));
          break;
        case 'spell':
        case 'liturgy':
          this.#pushSkill(groups, x.type, this.tokenHotbar._skillEntry(x, 'spell'));
          break;
        case 'trait':
          if (TokenHotbar2.traitTypes.has(x.system.traitType.value)) {
            groups.attacks.push(this.tokenHotbar._traitEntry(x, actor.system));
          }
          break;
        case 'consumable':
          this.#pushSkill(groups, 'consumable', this.tokenHotbar._actionEntry(x, 'consumable', { abbrev: x.system.quantity.value }));
          break;
        case 'meleeweapon':
        case 'rangeweapon': {
          const entries = this.tokenHotbar._combatEntry(x, combatskills, actor);
          for (let entry of entries) {
            if (!x.system.worn.value) entry.cssClass = 'unequipped';
            groups.attacks.push(entry);
          }
          break;
        }
        default:
          break;
      }

      if (x.getFlag('dsa5', 'onUseEffect')) {
        this.#pushSkill(groups, x.type, this.tokenHotbar._actionEntry(x, 'onUse', { subfunction: 'onUse' }));
      }
      if (x.getFlag('dsa5', 'enchantments')) {
        if (!groups.skills.enchantment) groups.skills.enchantment = [];
        for (let enchantment of x.getFlag('dsa5', 'enchantments')) {
          groups.skills.enchantment.push(this.tokenHotbar._enchantmentEntry(enchantment, 'enchantment', x, { subfunction: 'enchantment' }));
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
    if (!itemArray || !orderArray || itemArray.length === 0 || orderArray.length === 0) return itemArray;

    const itemMap = new Map();
    itemArray.forEach(item => {
      if (item.id) itemMap.set(item.id, item);
    });

    const orderedItems = [];
    const usedIds = new Set();

    orderArray.forEach(id => {
      if (itemMap.has(id) && !usedIds.has(id)) {
        orderedItems.push(itemMap.get(id));
        usedIds.add(id);
      }
    });

    itemArray.forEach(item => {
      if (item.id && !usedIds.has(item.id)) {
        orderedItems.push(item);
      } else if (!item.id) {
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

    for (let key of Object.keys(groups.skills)) {
      const i18nkey = `TYPES.Item.${key}`;
      filterCategories.push({
        key,
        tooltip: game.i18n.has(i18nkey)
          ? localize(i18nkey)
          : localize(DSA5Hotbar.FALLBACK_NAMES[key]),
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
        tooltip: localize('Combat'),
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

      for (let token of canvas.tokens.controlled) {
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
    const label = localize('CONDITION.add');
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

    context.editMode = this.editMode ? 'wiggle-animation' : '';
    const actor = this.actor;

    const groups = { skills: {}, attacks: [], functions: [] };
    let effects = [];
    let gmMode = false;
    let activeSection;

    if (actor) {
      if (!['epic', 'loot'].includes(getProperty(actor.system.merchant.merchantType))) {
        activeSection = this.activeSection;
        effects = await this.tokenHotbar._effectEntries(actor);
        this.#conditionAddEffect(effects);
        this.#prepareActorActions(actor, groups);
      }
    } else if (game.user.isGM && !game.settings.get('dsa5', 'disableTokenhotbarMaster')) {
      activeSection = this.gmFilters;
      gmMode = await this.#prepareGMActions(groups);
    }

    this.#sortSkillList(groups.skills.skill);
    this.#sortSkillList(groups.skills.skillgm);

    this.#applySavedOrdering(groups);

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
        name: game.audio.globalMute ? 'HOTBAR.UNMUTE' : 'HOTBAR.MUTE',
        icon: game.audio.globalMute ? "<i class='fa-solid fa-volume-xmark'></i>" : "<i class='fa-solid fa-volume'></i>",
        callback: () => {
          game.audio.globalMute = !game.audio.globalMute;
          this._updateToggles();
        }
      },
      {
        name: this.locked ? 'HOTBAR.UNLOCK' : 'HOTBAR.LOCK',
        icon: this.locked ? "<i class='fa-solid fa-unlock'></i>" : "<i class='fa-solid fa-lock'></i>",
        callback: async () => {
          await game.settings.set("core", "hotbarLock", !this.locked, { render: false });
          this._updateToggles();
        }
      },
      {
        name: 'SHEET.Configure',
        icon: "<i class='fa-solid fa-edit'></i>",
        callback: () => {
          this.#toggleEditMode();
        }
      },
      {
        name: 'HOTBAR.CLEAR',
        icon: "<i class='fa-solid fa-trash'></i>",
        callback: async () => {
          const proceed = await foundry.applications.api.DialogV2.confirm({
            window: {
              title: "HOTBAR.CLEAR",
              icon: "fa-solid fa-trash"
            },
            content: localize("HOTBAR.CLEAR_CONFIRM"),
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
    this.render(true);
  }

  _updateToggles() {
    if (!game.settings.get('dsa5', 'hotbarv3') || !this.actor) return super._updateToggles();
  }

  #getWeaponContextOptions(weapon, isOffHand) {
    if (weapon?.type === 'trait') return [];

    const equipableWeapons = this.actor.items.filter(i => ['meleeweapon', 'rangeweapon'].includes(i.type) && !i.system.worn.value);
    const equip = localize('SHEET.EquipItem');
    const options = equipableWeapons.reduce((acc, w) => {
      if (weapon?.id === w.id) return acc;
      acc.push({
        name: `${equip}: ${w.name}`,
        icon: "<i class='fa-solid fa-swords'></i>",
        callback: () => {
          const canOffHand = isOffHand && !RuleChaos.isYieldedTwohanded(w);
          this.actor.exclusiveEquipWeapon(w.id, canOffHand);
        }
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
    context.actorImg = this.actor.token?.img || this.actor.prototypeToken.texture.src || this.actor.img;
    context.resources = this.#prepareResources(context);
    context.defenseTooltip = this.#prepareDefenseTooltip(context);
    context.weapons = this.#weaponPositions(context);
    const token = this.actor?.isToken ? this.actor.token : this.actor.getActiveTokens()[0];
    context.turnClass = game.combat && game.combat?.current?.combatantId === token?.combatant?.id ? 'myRound' : '';
  }

  #prepareResources(context) {
    return {
      LeP: {
        value: this.actor.system.status.wounds.value,
        max: this.actor.system.status.wounds.max,
        label: localize('CHAR.LEP'),
      },
      AsP: {
        value: this.actor.system.status.astralenergy.value,
        max: this.actor.system.status.astralenergy.max,
        label: localize('CHAR.ASP'),
      },
      KaP: {
        value: this.actor.system.status.karmaenergy.value,
        max: this.actor.system.status.karmaenergy.max,
        label: localize('CHAR.KAP'),
      },
    }
  }

  #prepareDefenseTooltip(context) {
    const attributes = [
      { label: localize('actionCount'), value: this.actor.system.actionCount?.value, icon: 'fas fa-fist-raised' },
      { label: localize('speed'), value: this.actor.system.status.speed.max, icon: 'fas fa-running' },
      { label: localize('soulpower'), value: this.actor.system.status.soulpower.max, icon: 'fas fa-sun' },
      { label: localize('toughness'), value: this.actor.system.status.toughness.max, icon: 'fas fa-shield-alt' },
    ]

    const attrString = attributes.reduce((acc, b) => {
      if (b.value === undefined) return acc;

      acc.push(`<b><i class="fas ${b.icon}"></i> ${b.label}</b>: ${b.value}`);
      return acc;
    }, []).join('<br/>');

    return `<h1>${this.actor.name}</h1><p>${attrString}</p>`
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
          weapon: { name: localize('attackWeaponless') },
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
      name: localize('attackWeaponless'),
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

    const twoHanded = RuleChaos.isYieldedTwohanded(firstWeapon);
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
    const newActor = controlled.length < 2 ? (controlled[0]?.actor ?? game.user.character) : null;

    if (this.actor !== newActor && this.editMode) {
      this.editMode = false;
    }

    this.actor = newActor;

    if (this.actor && !this.actor?.isOwner) this.actor = null;
    this.showEffects = controlled.length >= 1;
  }

  #getAllMacros() {
    const hotbar = game.user?.hotbar ?? {};
    const emptyLabel = localize('HOTBAR.EMPTY');
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
