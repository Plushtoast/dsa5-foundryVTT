import Itemdsa5 from '../item/item-dsa5.js';
import RuleChaos from './rule_chaos.js';
import { tinyNotification } from '../system/view_helper.js';
import Actordsa5 from '../actor/actor-dsa5.js';
import TokenHotbar2 from './tokenHotbar2.js';
import Riding from './riding.js';
const { getProperty, mergeObject } = foundry.utils;

export default class DSA5Hotbar extends foundry.applications.ui.Hotbar {
  async _onRender(context, options) {
    await super._onRender((context, options));
    this.addContextColor();
    if (game.settings.get('dsa5', 'hotbarv3')) {
      const html = $(this.element);
      html.find('.quantity-click').on('mousedown', (ev) => RuleChaos.quantityClick(ev));
      html.on('mousedown', 'li.primary', async (ev) => {
        game.tooltip.deactivate();

        if (ev.currentTarget.classList.contains('macro')) return false;

        ev.stopPropagation();
        await this.tokenHotbar.executeQuickButton(ev);
        return false;
      });
      html.find('.categoryFilter').on('click', (ev) => {
        this.filterCategory(ev, html);
      });
      const that = this;
      const fn = function (ev) {
        if (!html.find('.sections').is(':hover')) return;

        that.filterSections(ev, html);
        return false;
      };
      const filterOff = function () {
        $(document).off('keydown.sectionFilter', fn);
        that.searching = '';
        html.find('.macro,.primary,.sections .skillItems').removeClass('dsahidden');
        html.find('.longLayout').removeClass('longLayout');
      };
      html.find('.sections').on('hover', () => {
        $(document).off('keydown.sectionFilter', fn).on('keydown.sectionFilter', fn);
      }, filterOff);

      html.find('.primary').on('hover', (ev) => this._betterTooltip(ev));

      html.find('.itdarkness input').on('change', (ev) => this.tokenHotbar.changeDarkness(ev));
    }
  }

  async updateDSA5Hotbar() {
    if (!game.settings.get('dsa5', 'hotbarv3')) return;

    const controlled = canvas.tokens.controlled;
    this.token = undefined;
    this.showEffects = false;
    if (controlled.length === 1) {
      const actor = controlled[0].actor;
      if (actor && actor.isOwner) {
        this.token = controlled[0];
      }
    }

    if (controlled.length >= 1) {
      this.showEffects = true;
    }

    await this.render(true, { focus: false });
  }

  addContextColor() {
    const parry = new RegExp(` ${game.i18n.localize('CHAR.PARRY')}$`);
    const attack = new RegExp(` ${game.i18n.localize('CHAR.ATTACK')}$`);
    const macroList = $(this.element).find('#macro-list');
    for (const macro of this.slots) {
      if (!macro.macro) continue;

      if (parry.test(macro.macro.name)) {
        macroList.find(`[data-macro-id="${macro.macro.id}"]`).addClass('parry');
      } else if (attack.test(macro.macro.name)) {
        macroList.find(`[data-macro-id="${macro.macro.id}"]`).addClass('attack');
      }
    }
  }

  _contextMenu(html) {
    if (game.settings.get('dsa5', 'hotbarv3')) {
      HotbarV3ContextMenu.create(this, html, '.macro', this._getEntryContextOptions());
    } else {
      foundry.applications.ui.ContextMenu.create(this, html, '.macro', this._getEntryContextOptions());
    }
  }

  constructor(options) {
    super(options);

    if(game.settings.get('dsa5', 'hotbarv3')) {
      this.constructor.PARTS = {
        hotbar: {
          root: true,
          template: 'systems/dsa5/templates/system/hud/hotbar.html',
          scrollable: ["#macro-list"]
        },
      }
    }    
  }

  static PARTS = {    
    hotbar: {
      root: true,
      template: "templates/ui/hotbar.hbs"
    }
  }

  async _betterTooltip(ev) {
    const target = ev.currentTarget;
    const data = target.dataset;

    if ('tooltipClass' in target.dataset) return;

    let tooltip;
    let item;
    let description;

    const category = data.category?.split(' ')[0];

    switch (category) {
      case 'skillgm':
        tooltip = game.i18n.format('TT.skillgm', { name: data.name });
        break;
      case 'effect':
        const effect = this.token.actor?.effects.get(data.id);
        if (effect) description = game.i18n.has(effect.description) ? game.i18n.localize(effect.description) : effect.description;

        break;
      case 'onUse':
        item = this.token.actor?.items.get(data.id);
        switch (item.type) {
          case 'specialability':
            description = item.system.rule?.value;
            break;
          case 'advantage':
          case 'disadvantage':
            break;
          default:
            description = item.system.description?.value;
        }
        break;
      case 'unequipped':
      case 'consumable':
      case 'weapon':
      case 'spell':
        item = this.token.actor?.items.get(data.id);
        const itemData = await item.sheet._prepareContext();

        if (!game.user.isGM && itemData.item.system.obfuscation?.details) {
          description = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.hbs', itemData);
        } else {
          description = $(
            await renderTemplate(`systems/dsa5/templates/items/browse/${item.type}.html`, {
              isGM: game.user.isGM,
              ...itemData,
              document: item,
              skipHeader: true,
              hint: true,
            }),
          )
            .find('.groupbox')
            .html();
        }
        break;
      case 'enchantment':
        const ids = data.id.split('_');
        item = this.token.actor?.items.get(ids[0]);
        if (item.system.obfuscation?.enchantment) {
          description = await renderTemplate('systems/dsa5/templates/items/obfuscatedItem.hbs', item);
          data.name = `${game.i18n.localize('enchantment')} (${item.name})`;
        } else {
          const enchantment = item.getFlag('dsa5', 'enchantments').find((x) => x.id == ids[1]);
          data.name = `${enchantment.name} (${item.name})`;
          description = await renderTemplate('systems/dsa5/templates/items/enchantment-preview.hbs', { enchantment, document: item });
        }
        break;
      default:
        return;
    }

    if (description) {
      tooltip = `<div class="itemTooltip"><h1>${data.name}</h1>${description}</div>`;
    }

    if (!tooltip) return;

    $('#tooltip').addClass('dsatooltip').html(tooltip);
    target.dataset.tooltip = tooltip;
    target.dataset.tooltipClass = 'dsatooltip';
  }

  filterCategory(ev, html) {
    const category = ev.currentTarget.dataset.filter;

    if (category) {
      html.find('.skillItems').addClass('collapsed');
      html.find(`.skillItems[data-category="${category}"]`).removeClass('collapsed');
      html.find('.categoryFilter').removeClass('active');
      html.find(`.categoryFilter[data-filter="${category}"]`).addClass('active');
      if (this.token?.actor) this.activeFilters = [category];
      else this.gmFilters = [category];
    } else {
      html.find('.skillItems').removeClass('collapsed');
      html.find('.categoryFilter').removeClass('active');
      if (this.token?.actor) {
        this.activeFilters = [];
      } else {
        this.gmFilters = [];
      }
    }
  }

  filterSections(ev, html) {
    this.searching = this.searching || '';
    switch (ev.which) {
      case 8:
        this.searching = this.searching.slice(0, -1);
        break;
      default:
        if (!ev.key.match(/^[a-zA-Z0-9öäüÖÄÜ]$/)) return;

        this.searching += ev.key;
    }
    ev.preventDefault();
    ev.stopPropagation();
    const search = this.searching.toLowerCase();
    tinyNotification(search);

    const sections = html.find('.sections');
    if (search) {
      sections.addClass('longLayout');
    } else {
      sections.removeClass('longLayout');
    }
    html
      .find('.primary')
      .removeClass('dsahidden')
      .filter(function () {
        const find = this.dataset?.name?.toLowerCase().trim();
        if (find) return find.indexOf(search) == -1;

        return true;
      })
      .addClass('dsahidden');

    for (let sec of sections.find('.skillItems')) {
      const category = sec.dataset.category;
      const section = $(sec);
      section.toggleClass('dsahidden', section.find(`li.${category}.dsahidden`).length == section.find(`li.${category}`).length);
    }
    return false;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    if (game.settings.get('dsa5', 'hotbarv3')) {
      await this._h3Data(data);
    }
    return data;
  }

  get tokenHotbar() {
    return game.dsa5.apps.tokenHotbar;
  }

  async _h3Data(data) {
    const groups = {
      skills: {},
      attacks: [],
    };
    const filterCategories = [];
    let effects = [];
    let gmMode = false;
    let activeFilters = [];
    const actor = this.token?.actor;
    if (actor) {
      if (!['epic', 'loot'].includes(getProperty(actor, 'system.merchant.merchantType'))) {
        activeFilters = (this.activeFilters || []).filter((x) => x != 'gm');
        const combatskills = actor.items.filter((x) => x.type == 'combatskill').map((x) => Actordsa5._calculateCombatSkillValues(x.toObject(), actor.system));
        effects = await this.tokenHotbar._effectEntries(actor);
        const brawl = this.tokenHotbar._brawlEntry(combatskills);
        const isRiding = Riding.isRiding(actor);

        if (isRiding) {
          const ridingEnttry = this.tokenHotbar._ridingEntry(actor);

          if (ridingEnttry) groups.skills.skill = [ridingEnttry];
        }

        if (brawl) groups.attacks.push(brawl);

        groups.functions = this.tokenHotbar?._functionEntries() || [];

        for (const x of actor.items) {
          switch (x.type) {
            case 'skill':
              if (!groups.skills[x.type]) groups.skills[x.type] = [];

              groups.skills[x.type].push(this.tokenHotbar._skillEntry(x, 'skill'));
              break;
            case 'spell':
            case 'liturgy':
              if (!groups.skills[x.type]) groups.skills[x.type] = [];

              groups.skills[x.type].push(this.tokenHotbar._skillEntry(x, 'spell'));
              break;
            case 'trait':
              if (TokenHotbar2.traitTypes.has(x.system.traitType.value)) groups.attacks.push(this.tokenHotbar._traitEntry(x, actor.system));
              break;
            case 'consumable':
              if (!groups.skills[x.type]) groups.skills[x.type] = [];

              groups.skills[x.type].push(
                this.tokenHotbar._actionEntry(x, 'consumable', {
                  abbrev: x.system.quantity.value,
                }),
              );
              break;
            case 'meleeweapon':
            case 'rangeweapon':
              const entries = this.tokenHotbar._combatEntry(x, combatskills, actor);
              for (let entry of entries) {
                if (!x.system.worn.value) {
                  entry.cssClass = 'unequipped';
                }
                groups.attacks.push(entry);
              }
            default:
              if (x.getFlag('dsa5', 'onUseEffect')) {
                if (!groups.skills[x.type]) groups.skills[x.type] = [];

                groups.skills[x.type].push(
                  this.tokenHotbar._actionEntry(x, 'onUse', {
                    subfunction: 'onUse',
                  }),
                );
              }
              if (x.getFlag('dsa5', 'enchantments')) {
                if (!groups.skills['enchantment']) groups.skills['enchantment'] = [];

                for (let enchantment of x.getFlag('dsa5', 'enchantments')) {
                  groups.skills['enchantment'].push(this.tokenHotbar._enchantmentEntry(enchantment, 'enchantment', x, { subfunction: 'enchantment' }));
                }
              }
              break;
          }
        }
      }
    } else if (game.user.isGM && !game.settings.get('dsa5', 'disableTokenhotbarMaster')) {
      activeFilters = this.gmFilters || [];
      groups.skills.gm = this.tokenHotbar?._gmEntries() || [];
      const skills = this.tokenHotbar?.skills || (await this.tokenHotbar?.prepareSkills()) || [];

      groups.skills.skillgm = skills;
      gmMode = true;
    }

    const baseBarHeight = 45;
    const rows = 2;

    const fallbacks = {
      gm: 'systems/dsa5/icons/categories/DSA-Auge.webp',
      skillgm: 'systems/dsa5/icons/categories/Skill.webp',
      enchantment: 'systems/dsa5/icons/categories/enchantment.webp',
    };
    const fallbackNames = {
      gm: 'gmMenu',
      skillgm: 'TYPES.Item.skill',
      enchantment: 'enchantment',
    };

    for (let key of Object.keys(groups.skills)) {
      const i18nkey = `TYPES.Item.${key}`;
      filterCategories.push({
        key,
        tooltip: game.i18n.has(i18nkey) ? game.i18n.localize(i18nkey) : game.i18n.localize(fallbackNames[key]),
        img: Itemdsa5.defaultImages[key] || fallbacks[key],
      });
    }

    const orderGroups = ['body', 'social', 'nature', 'knowledge', 'trade'];
    groups.skills.skill?.sort((a, b) => {
      return orderGroups.indexOf(a.addClass) - orderGroups.indexOf(b.addClass) || a.name.localeCompare(b.name);
    });
    groups.skills.skillgm?.sort((a, b) => {
      return orderGroups.indexOf(a.addClass) - orderGroups.indexOf(b.addClass) || a.name.localeCompare(b.name);
    });

    if (groups.attacks.length > 0) {
      groups.attacks.sort((a, b) => {
        return (b.cssClass || '').localeCompare(a.cssClass || '') || a.name.localeCompare(b.name);
      });

      filterCategories.unshift({
        key: 'attacks',
        tooltip: game.i18n.localize('Combat'),
        img: 'systems/dsa5/icons/categories/Meleeweapon.webp',
      });
    }

    if (this.showEffects) {
      if (canvas.tokens.controlled.length > 1) {
        let sharedEffects = await this.tokenHotbar._effectEntries(canvas.tokens.controlled[0].actor, { subfunction: 'sharedEffect' });

        for (let token of canvas.tokens.controlled) {
          const tokenEffects = (await token.actor.actorEffects()).map((x) => x.name);
          sharedEffects = sharedEffects.filter((x) => tokenEffects.includes(x.name));
        }
        effects = sharedEffects;
      }

      const label = game.i18n.localize('CONDITION.add');
      const effect = {
        name: 'CONDITION.add',
        id: '',
        icon: 'icons/svg/aura.svg',
        cssClass: 'effect',
        abbrev: label[0],
        subfunction: 'addEffect',
        indicator: '+',
      };

      effects.unshift(effect);
    }

    if (activeFilters.length > 0) {
      activeFilters = Object.keys(groups.skills)
        .concat(['macro', 'attacks'])
        .filter((x) => !activeFilters.includes(x));
    }
    mergeObject(data, {
      token: {
        groups,
        effects,
      },
      darkness: canvas?.scene?.environment.darknessLevel || 0,
      hotBarcssClass: 'hotbarV3',
      barWidth: `${527}px`,
      baseBarHeight: `${baseBarHeight}px`,
      barHeight: `${(baseBarHeight + 7) * rows + 30}px`,
      filterCategories,
      selectedCategories: (actor ? this.activeFilters : this.gmFilters) || [],
      showEffects: this.showEffects,
      activeFilters,
      gmMode,
      macros: this._getAllMacros(),
    });
  }

  _getAllMacros() {
    let macros = Array.from({ length: 50 }, () => '');
    for (let [k, v] of Object.entries(game.user.hotbar)) {
      macros[parseInt(k) - 1] = v;
    }
    return macros.map((m, i) => {
      const macro = m ? game.macros.get(m) : null;
      return {
        slot: i + 1,
        key: i + 1,
        icon: macro?.img || null,
        cssClass: macro ? 'active' : 'inactive',
        tooltip: macro ? macro.name : null,
        macro,
      };
    });
  }
}

class HotbarV3ContextMenu extends foundry.applications.ui.ContextMenu {
  _setPosition(html, target) {
    target = target.closest('.flexrow');
    super._setPosition(html, target);
  }

  static create(app, html, selector, menuItems, { hookName = 'EntryContext', ...options } = {}) {
    // FIXME APPV13
    for (const cls of app.constructor._getInheritanceChain()) {
      Hooks.call(`get${cls.name}${hookName}`, html, menuItems);
    }
    if (menuItems) return new HotbarV3ContextMenu(html, selector, menuItems, options);
  }
}
