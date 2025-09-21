import TokenHotbar2 from './tokenHotbar2.js';
import Riding from '../automation/riding.js';
import CombatskillData from '../../data/item/combatskill.js';
import { ITEM_CONSTANTS } from '../../config/item-constants.js';
import RuleChaos from '../rules/rule_chaos.js';
import { tinyNotification } from '../helpers/view_helper.js';
import { VerticalSlider } from '../helpers/vslider.js';
import { GlobalToolTipHandler } from '../globals/tooltip.js';
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
  
  static FALLBACK_NAMES = {
    gm: 'gmMenu',
    skillgm: 'TYPES.Item.skill',
    enchantment: 'enchantment',
  };

  static DEFAULT_OPTIONS = {
    actions: {
      categoryFilter: this.#filterCategory,
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

    if (!game.settings.get('dsa5', 'hotbarv3')) return;

    const html = $(this.element);
    this.element.classList.add('hotbarV4');
    this.element.querySelectorAll('.quantity-click').forEach(el => {
      el.addEventListener('mousedown', (ev) => RuleChaos.quantityClick(ev));
    });

    const that = this;
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
    html.find('.primary').on('pointerover', (ev) => this.#betterTooltip(ev));
    html.find('[data-action="quickButton"]').on('click', (ev) => this.#quickButton(ev));
    html.find('.itdarkness input').on('change', (ev) => this.tokenHotbar.changeDarkness(ev));

    html.find('#macro-list, .skillItems').on('wheel', e => this.#onWheel(e));


    const container = this.element.querySelector('.rangeContainer');
    if (!container) return;

    this.slider = new VerticalSlider(container, 'vSliderDarkness', {
      value: (canvas?.scene?.environment.darknessLevel || 0) * 100,
      onChange: (value) => this.onSliderChanged(value)
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
    const parryText = ` ${game.i18n.localize('CHAR.PARRY')}`;
    const attackText = ` ${game.i18n.localize('CHAR.ATTACK')}`;

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
          ? game.i18n.localize(i18nkey) 
          : game.i18n.localize(DSA5Hotbar.FALLBACK_NAMES[key]),
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
        tooltip: game.i18n.localize('Combat'),
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

    const label = game.i18n.localize('CONDITION.add');
    effects.unshift({
      name: 'CONDITION.add',
      id: '',
      icon: 'icons/svg/aura.svg',
      cssClass: 'effect',
      abbrev: label[0],
      subfunction: 'addEffect',
      indicator: '+',
    });

    return effects;
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
    this.prepareActorContext(context);
    const actor = this.actor;

    const groups = { skills: {}, attacks: [], functions: [] };
    let effects = [];
    let gmMode = false;
    let activeSection;

    if (actor) {
      if (!['epic', 'loot'].includes(getProperty(actor.system.merchant.merchantType))) {
        activeSection = this.activeSection;
        effects = await this.tokenHotbar._effectEntries(actor);
        this.#prepareActorActions(actor, groups);
      }
    } else if (game.user.isGM && !game.settings.get('dsa5', 'disableTokenhotbarMaster')) {
      activeSection = this.gmFilters;
      gmMode = await this.#prepareGMActions(groups);
    }

    this.#sortSkillList(groups.skills.skill);
    this.#sortSkillList(groups.skills.skillgm);

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

    return context;
  }

  get tokenHotbar() {
    return game.dsa5.apps.tokenHotbar;
  }

  prepareActorContext(context) {
    if (!this.actor) return;

    context.actor = this.actor;
  }

  updateHotbar(actorId, force = false) {
    if (!game.settings.get("dsa5", "hotbarv3")) return;

    if (actorId === this.actor?.id || force) this.render(true, { focus: false });
  }

  #setActor() {
    const controlled = canvas?.tokens?.controlled || [];
    this.actor = controlled.length < 2 ? (controlled[0]?.actor ?? game.user.character) : null;

    if (this.actor && !this.actor?.isOwner) this.actor = null;
    this.showEffects = controlled.length >= 1;
  }

  #getAllMacros() {
    const hotbar = game.user?.hotbar ?? {};
    const emptyLabel = game.i18n.localize('HOTBAR.EMPTY');
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
