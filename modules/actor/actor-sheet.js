import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import DSA5 from '../config/config-dsa5.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import Itemdsa5 from '../item/item-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/rules/specialability-rules-dsa5.js';
import DSA5ChatListeners from '../system/sidebar/chat_listeners.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DialogActorConfig from '../dialog/dialog-actorConfig.js';
import Actordsa5 from './actor-dsa5.js';
import { resizeListener, tabSlider, tinyNotification } from '../system/helpers/view_helper.js';
import DSA5SoundEffect from '../system/helpers/dsa-soundeffect.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import OnUseEffect from '../system/automation/onUseEffects.js';
import { bindImgToCanvasDragStart } from '../hooks/imgTileDrop.js';
import DSA5ChatAutoCompletion from '../system/sidebar/chat_autocompletion.js';
import Riding from '../system/automation/riding.js';
import ForeignFieldEditor from '../system/helpers/foreignFieldEditor.js';
import { AddEffectDialog } from '../system/guiapps/tokenHotbar2.js';
import { RangeSelectDialog, fetchBagItems, transferBagWithContents } from '../hooks/itemDrop.js';
import DSA5Payment from '../system/payment/payment.js';
import { RollDialogBuilder } from '../dialog/dialog-builder.js';
import ActorPickerDialog from '../dialog/actor-picker-dialog.js';
import { Trade } from './trade.js';
import APTracker from '../system/orwell/ap-tracker.js';
import { DefaultAppv2 } from './baseapp.js';
import { TRADITION_ITEM_KINDS, buildTraditionItemUpdate } from './tradition-items.js';
import { AppV2Mixin } from './mixins/appv2_mixin.js';
import MoneyTracker from '../system/orwell/money-tracker.js';
import { SpeedSelector } from './speedselector.js';
import { DSA5CombatTracker } from '../combat/combat_tracker.js';
import { ItemFactory } from '../item/item-factory.js';
import GroupData from '../data/actor/group.js';
import { GlobalToolTipHandler } from '../system/globals/tooltip.js';
import { DICE_CONSTANTS } from '../config/dice-constants.js';
import { InventoryBulkActionHelper } from '../system/helpers/inventory-bulk-action.js';
import { PersonaeDramatis } from '../system/calendar/personaedramatis.js';
import CompanionHandler from './companions/companion-handler-class.js';
import CreatureDropDialog from './creature-drop-dialog.js';
import ItempackageData from '../data/item/itempackage.js';
import ActorActiveEffectValueDialog from '../dialog/actor-active-effect-value-dialog.js';
import PowersourceBar from '../system/enhancement/powersource-bar.js';
import PowersourceChargeDialog from '../dialog/powersource-charge-dialog.js';
import { combatPartTemplates } from './template-configs.js';
import { SummoningFlow } from '../wizards/summoning/summoning_flow.js';
import AmmoPicker from '../system/helpers/ammo-picker.js';

const { mergeObject, getProperty, duplicate, hasProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;
const { TextEditor, ContextMenu, SearchFilter, DragDrop } = foundry.applications.ux;

export default class ActorSheetDsa5 extends AppV2Mixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {
  static propertiesToEnrich = [
    { key: 'enrichedOwnerdescription', path: 'details.notes.ownerdescription' },
    { key: 'enrichedGmdescription', path: 'details.notes.gmdescription' },
    { key: 'enrichedNotes', path: 'details.notes.value' },
    { key: 'enrichedBiography', path: 'details.biography.value' },
  ];

  static SHEET_PART = {
    template: 'systems/dsa5/templates/actors/actorv2/sheet.hbs',
    root: true,
  };

  #talentSearch;
  #gearSearch;
  #conditionSearch;

  get title() {
    return this.actor.name;
  }

  async render(options = {}, _options = {}) {
    if (this.element) {
      this.openDetails = Array.from(this.element.querySelectorAll('.expandDetails.shown'), el => el.closest('.item')?.dataset.itemId).filter(Boolean);
    }
    return await super.render(options, _options);
  }

  _replaceHTML(result, content, options) {
    // Foundry restores root-part scroll before <template> placeholders receive their child parts, which clamps .sheet-body to 0.
    const sheetBodyScrollTop = content.querySelector('.sheet-body')?.scrollTop;
    super._replaceHTML(result, content, options);
    if (sheetBodyScrollTop) content.querySelector('.sheet-body')?.scrollTo({ top: sheetBodyScrollTop });
  }

  _preSyncPartState(partId, newElement, priorElement, state) {
    super._preSyncPartState(partId, newElement, priorElement, state);

    const focus = priorElement.querySelector(':focus');
    const itemRow = focus?.closest('[data-item-id]');
    if (itemRow) state.focusItemId = itemRow.dataset.itemId;

    state.collapsedBoxes = Array.from(priorElement.querySelectorAll('.ch-collapse i'), el => el.getAttribute('class'));
    state.openDetails = Array.from(priorElement.querySelectorAll('.expandDetails.shown'), el => el.closest('.item')?.dataset.itemId).filter(Boolean);
  }

  _syncPartState(partId, newElement, priorElement, state) {
    super._syncPartState(partId, newElement, priorElement, state);

    if (state.focusItemId) {
      const input = newElement.querySelector(`[data-item-id="${state.focusItemId}"] input`);
      if (input) {
        input.focus();
        input.select();
      }
    }

    if (state.collapsedBoxes?.length) {
      const boxes = newElement.querySelectorAll('.ch-collapse i');
      for (let i = 0; i < boxes.length; i++) {
        if (!state.collapsedBoxes[i]) continue;
        boxes[i].setAttribute('class', state.collapsedBoxes[i]);
        if (state.collapsedBoxes[i].includes('fa-angle-down')) {
          boxes[i].closest('.groupbox')?.querySelector('.row-section:nth-child(2)')?.style.setProperty('display', 'none');
        }
      }
    }
  }

  static LIMITEDPARTS = {
    sheet: this.SHEET_PART,
    header: {
      template: 'systems/dsa5/templates/actors/limited/npc-limited-header.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
      id: "tabs",
      templates: [
        "systems/dsa5/templates/actors/actorv2/tabsvertical_inner.hbs",
        "systems/dsa5/templates/system/dsatabs.hbs"
      ],
      classes: [],
    },
    main: {
      template: 'systems/dsa5/templates/actors/limited/npc-limited.hbs',
      scrollable: ['']
    },
    notes: {
      template: 'systems/dsa5/templates/actors/actor-notes.hbs',
      scrollable: [''],
    },
  }

  static PARTS = {
    sheet: this.SHEET_PART,
    header: {
      template: 'systems/dsa5/templates/actors/actorv2/header.hbs',
      templates: ['systems/dsa5/templates/actors/actorv2/avatar.hbs', 'systems/dsa5/templates/actors/parts/attributes.hbs', 'systems/dsa5/templates/actors/parts/actor-header.hbs'],
    },
    tabs: {
      template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
      id: "tabs",
      templates: [
        "systems/dsa5/templates/actors/actorv2/tabsvertical_inner.hbs",
        "systems/dsa5/templates/system/dsatabs.hbs"
      ],
      classes: [],
    },
    combat: {
      template: 'systems/dsa5/templates/actors/actor-combat.hbs',
      scrollable: [''],
      templates: [...combatPartTemplates],
    },
    skills: {
      template: 'systems/dsa5/templates/actors/actor-talents.hbs',
      templates: ['systems/dsa5/templates/actors/character/actor-aggregatedtests.hbs'],
      scrollable: [''],
    },
    magic: {
      template: 'systems/dsa5/templates/actors/character/actor-magic.hbs',
      templates: ['systems/dsa5/templates/actors/parts/spells.hbs', 'systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/magicalSigns.hbs'],
      scrollable: [''],
    },
    religion: {
      template: 'systems/dsa5/templates/actors/character/actor-religion.hbs',
      templates: ['systems/dsa5/templates/actors/parts/specblock.hbs', 'systems/dsa5/templates/actors/parts/liturgies.hbs'],
      scrollable: [''],
    },
    companion: {
      template: 'systems/dsa5/templates/actors/companions/actor-companion.hbs',
      scrollable: [''],
      templates: [
        'systems/dsa5/templates/actors/parts/horse.hbs',
        'systems/dsa5/templates/actors/companions/companion-card.hbs',
        'systems/dsa5/templates/actors/parts/member-card-header.hbs',
      ],
    },
    status: {
      template: 'systems/dsa5/templates/actors/parts/status_effects.hbs',
      scrollable: [''],
    },
    notes: {
      template: 'systems/dsa5/templates/actors/actor-notes.hbs',
      scrollable: [''],
    },
  }

  static DEFAULT_OPTIONS = {
    position: {
      width: 770,
      height: 740,
    },
    classes: ['dsa5', 'actor'],
    actions: {
      itemCreate: this._onItemCreate,
      playerview: this._togglePlayerview,
      addToPersonae: this._addToPersonae,
      actorConfig: this._configActor,
      library: this._openLibrary,
      locksheet: this._changeAdvanceLock,
      skillSelect: { handler: this._skillSelect, buttons: [0, 2] },
      conditionEdit: this._conditionEdit,
      chCollapse: this._chCollapse,
      statusCreate: this._statusCreate,
      itemDropdown: this._itemDropdown,
      itemEdit: this._itemEdit,
      itemContextMenu: this._itemContextMenu,
      weaponContextMenu: this._weaponContextMenu,
      statusContextMenu: this.#statusContextMenu,
      bulkInventoryContextMenu: this._bulkInventoryContextMenu,
      filterTalents: this._filterTalents,
      combatRules: this._combatRules,
      collapseHeader: this._collapseHeader,
      conditionShow: { handler: this._conditionShow, buttons: [0, 2] },
      editKeepField: this._editKeepField,
      ...CompanionHandler.getSheetActions(),
    },
    ownerRollActions: {
      rollDisease: this._rollDisease,
      chValue: this._chValue,
      chStatus: this._chStatus,
      chRegenerate: this._chRegenerate,
      chWeaponless: this._chWeaponless,
      chFallingDamage: this._chFallingDamage,
      chRollCombat: this._chRollCombat,
      rollAggregatedProbe: { handler: this._handleAggregatedProbe, buttons: [0, 2] },
      rollAnySkill: this._rollAnySkill,
    },
    ownerActions: {
      schipUpdate: this._schipUdate,
      extraSchipUpdate: this._extraSchipUpdate,
      startCharacterBuilder: this._startCharacterBuilder,
      deleteItem: this._deleteItemAction,
      defenseToggle: this._defenseToggle,
      chargeSpell: { handler: this._chargeSpell, buttons: [0, 2] },
      loadWeapon: { handler: this._loadWeapon, buttons: [0, 2] },
      pickAmmo: this._pickAmmo,
      selectAmmo: this._selectAmmo,
      itemSwapMag: this._itemSwapMag,
      itemToggle: this._itemToggle,
      traditionPayCost: { handler: this._payAeSpecialAbilityCost, buttons: [0, 2] },
      traditionDelete: this._deleteTraditionArtifact,
      traditionItemDelete: this._deleteTraditionItem,
      swapWeaponHand: this._swapWeaponHand,
      swapWeaponHandSlot: this._swapWeaponHandSlot,
      toggleWeaponOffHand: this._toggleWeaponOffHand,
      toggleIgnoreWeaponHandLimits: this._toggleIgnoreWeaponHandLimits,
      selectTraditionartifact: this._selectTraditionArtifact,
      selectTraditionItem: this._selectTraditionItem,
      statusAdd: { handler: this._statusAdd, buttons: [0, 2] },
      disableRegeneration: this._disableRegeneration,
      conditionValue: { handler: this._conditionValue, buttons: [0, 2] },
      advanceWrapper: this._advanceWrapper,
      addSpeedCategory: this._addSpeedCategory,
      onUseItem: { handler: this._onMacroUseItem, buttons: [0, 2] },
      onUseEffect: { handler: this._onMacroUseEffect, buttons: [0, 2] },
      quantityClick: { handler: this._quantityClick, buttons: [0, 2] },
      unequippedWeaponMenu: { handler: this._unequippedWeaponMenu, buttons: [0] },
      configureActorEffect: this._configureActorEffect,
      powersourceEdit: this._powersourceEdit,
      ...CompanionHandler.getOwnerSheetActions(),
    },
    form: {
      submitOnChange: true,
    },
    majorButtons: [
      {
        action: 'playerview',
        icon: function () {
          return `fas fa-toggle-${this.actor.system.playerView ? 'on' : 'off'}`;
        },
        label: 'SHEET.switchLimited',
        visible: function () {
          return this.actor.isOwner;
        },
      },
      {
        action: 'locksheet',
        label: 'SHEET.Lock',
        icon: function () {
          return `fas fa-${this.actor.system.sheetLocked.value ? '' : 'un'}lock`;
        },
        visible: function () {
          return this.canLockSheet;
        },
      },
    ],
    window: {
      resizable: true,
      contentClasses: ['standard-form'],
      controls: [
        {
          action: 'addToPersonae',
          label: 'PERSONAE.addActor',
          icon: 'fas fa-address-book',
          visible: function () {
            return game.user.isGM && this.actor.type !== 'group';
          },
        },
        {
          action: 'actorConfig',
          label: 'Migrakel.Migration',
          icon: 'fas fa-link',
          visible: function () {
            return this.actor.isOwner;
          },
        },
        {
          action: 'library',
          label: 'SHEET.Library',
          icon: 'fas fa-university',
        },
      ],
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'skills', label: 'skills', img: 'systems/dsa5/icons/categories/Skill.webp' },
        { id: 'combat', label: 'Combat', img: 'systems/dsa5/icons/categories/ability_combat.webp' },
        { id: 'magic', label: 'Magic', img: 'systems/dsa5/icons/categories/Spell.webp' },
        { id: 'religion', label: 'Religion', img: 'systems/dsa5/icons/categories/Liturgy.webp' },
        { id: 'main', label: 'attributes', img: 'systems/dsa5/icons/categories/DSA-Auge.webp' },
        { id: 'inventory', label: 'TYPES.Item.equipment', img: 'systems/dsa5/icons/categories/Equipment.webp' },
        { id: 'status', label: 'status', img: 'systems/dsa5/icons/categories/ability_ceremonial.webp' },
        { id: 'companion', label: 'COMPANIONS.Companion', icon: 'fas fa-paw' },
        { id: 'notes', label: 'Notes', img: 'systems/dsa5/icons/categories/Ability_Language.webp' },
      ],
      initial: 'skills',
    },
  };

  get canLockSheet() {
    return this.actor.system.canAdvance
  }

  _configureRenderParts(options) {
    if (this.constructor.LIMITEDPARTS && this.showLimited()) {
      return foundry.utils.deepClone(this.constructor.LIMITEDPARTS);
    }
    return super._configureRenderParts(options);
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.actor.system.isMage) delete tabs.magic;
    if (!this.actor.system.isPriest) delete tabs.religion;
    CompanionHandler.prepareTabVisibility(this.actor, tabs);

    this.cleanTabs(tabs);
    return tabs;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === CompanionHandler.COMPANION_TAB_ID) await this.prepareCompanionTab(context);
    return context;
  }

  async prepareCompanionTab(context) {
    await CompanionHandler.prepareCompanionPartContext(this, context);
  }

  _attachPartListeners(partId, element, options) {
    super._attachPartListeners(partId, element, options);
    if (partId === CompanionHandler.COMPANION_TAB_ID) this.attachCompanionTabListeners(element);
  }

  attachCompanionTabListeners(element) {
    CompanionHandler.attachCompanionPartListeners(this, element);
  }

  cleanTabs(tabs) {
    if (this.constructor.LIMITEDPARTS && this.showLimited()) {
      for (const key of Object.keys(tabs)) {
        if (!['main', 'notes'].includes(key)) {
          delete tabs[key];
        }
      }
    }

    const tabKeys = Object.keys(tabs);
    const hasActive = tabKeys.some(key => tabs[key].active);

    if (!hasActive && tabKeys.length > 0) {
      const firstTab = tabs[tabKeys[0]];
      firstTab.active = true;
      firstTab.cssClass = 'active';
    }
  }

  #dispatchContextMenu(target, event, options = {}) {
    if (!target) return;

    event.preventDefault();
    event.stopPropagation();

    target.dispatchEvent(
      new PointerEvent('contextmenu', {
        view: window,
        bubbles: true,
        cancelable: true,
        clientX: event.clientX,
        clientY: event.clientY,
        ...options,
      }),
    );
  }

  static _itemContextMenu(event, target) {
    const contextTarget = target.closest('[data-item-id]')?.querySelector('.withContext');
    this.#dispatchContextMenu(contextTarget, event);
  }

  static _bulkInventoryContextMenu(event, target) {
    const contextTarget = target.closest('.inventory-bulk-actions-menu');
    this.#dispatchContextMenu(contextTarget, event);
  }

  static _weaponContextMenu(event, target) {
    const contextTarget = target.closest('.combat-weapon') || target.closest('[data-item-id]')?.querySelector('.combat-weapon');
    this.#dispatchContextMenu(contextTarget, event);
  }

  static _unequippedWeaponMenu(event, target) {
    this.#dispatchContextMenu(target, event, { button: 2, buttons: 2, });
  }

  static #statusContextMenu(event, target) {
    const contextTarget = target.closest('[data-id]')?.querySelector('.effectConfig');
    this.#dispatchContextMenu(contextTarget, event);
  }

  async _prepareContext(options) {
    const sheetData = await super._prepareContext(options);
    this.wrapperLocked = false;
    sheetData.verticalTabs = game.settings.get("dsa5", "tabsOutsideSheet");
    sheetData.systemFields = this.document.system.schema?.fields;
    sheetData.limited = this.actor.limited;
    sheetData.owner = this.actor.isOwner;
    sheetData.notesReadOnly = this.showLimited() && !this.isEditable;
    sheetData.notesInlineEditable = sheetData.owner && !sheetData.notesReadOnly;
    sheetData.prepare = this.actor.prepareSheet({ details: this.openDetails });
    PowersourceBar.prepareSheetContext(this.actor, sheetData.prepare);
    sheetData.isGM = game.user.isGM;
    sheetData.isBrawling = !!game.combat?.isBrawling;
    sheetData.horseSpeeds = Object.keys(Riding.speedKeys).reduce((acc, key) => {
      acc[key] = `RIDING.speeds.${key}`;
      return acc;
    }, {});
    sheetData.ridingModes = sheetData.systemFields?.horse?.fields?.isRiding?.choices ?? {};
    await DSA5StatusEffects.prepareActiveEffects(this.actor, sheetData);
    sheetData.conditions ??= [];
    sheetData.cumulativeConditions ??= [];
    sheetData.transferedConditions ??= [];
    sheetData.manualConditions ??= [];
    sheetData.prepare.itemModifiers ??= this.actor.system.itemModifiers ?? {};
    await this.prepareEnrichedFields(sheetData, this.constructor.propertiesToEnrich);
    return sheetData;
  }

  async prepareEnrichedFields(data, propertiesToEnrich) {
    const enrichedProperties = await Promise.all(
      propertiesToEnrich.map(async (prop) => {
        return {
          [prop.key]: await TextEditor.enrichHTML(getProperty(this.actor.system, prop.path), { secrets: this.actor.isOwner }),
        };
      }),
    );
    Object.assign(data, ...enrichedProperties);
  }

  static async _onItemCreate(event, target) {
    event.preventDefault();
    let data = duplicate(target.dataset);
    if (DSA5.equipmentTypes[data.type]) {
      data.type = 'equipment';
      data = mergeObject(data, {
        'system.equipmentType.value': target.attributes['item-section'].value,
        'system.effect.value': '',
      });
    }
    if (!['aggregatedTest', 'spell', 'liturgy', 'ritual', 'ceremony'].includes(data.type)) {
      data['system.weight.value'] = 0;
      data['system.quantity.value'] = 0;
    }

    Itemdsa5.defaultIcon(data);
    data.name = DSA5_Utility.categoryLocalization(data.type);
    delete data.action;
    delete data.section;
    delete data.tooltip;
    const items = await this.actor.createEmbeddedDocuments('Item', [data]);
    items[0].sheet.render(true);
  }

  static async _handleAggregatedProbe(ev, target) {
    const itemId = this._getItemId(target);
    const aggregated = this.actor.items.get(itemId);
    if (!aggregated) return;

    await aggregated.rollAggregatedProbe(target.dataset.which, this.getTokenId());
  }

  async consumeItem(item) {
    const title = _loc('SHEET.ConsumeItem') + ': ' + item.name;
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title,
      },
      content: title,
      rejectClose: false,
      modal: true,
    });
    if (proceed) item.setupEffect(null, {}, this.getTokenId());
  }

  async _advanceAttribute(attr) {
    const previous = Number(this.actor.system.characteristics[attr].advances);
    const advances = previous + Number(this.actor.system.characteristics[attr].initial);
    const category = this.actor.system.isPet || this.actor.system.isFamiliar ? 'C' : 'E';
    const cost = DSA5_Utility._calculateAdvCost(advances, category);
    if (await this._checkEnoughXP(cost)) {
      await this._updateAPs(cost, {
        [`system.characteristics.${attr}.advances`]: previous + 1,
      });
      await APTracker.track(this.actor, { type: 'attribute', attr, previous: advances, next: advances + 1 }, cost);
      return true;
    }
  }

  async _refundAttributeAdvance(attr) {
    const previous = Number(this.actor.system.characteristics[attr].advances);
    const advances = previous + Number(this.actor.system.characteristics[attr].initial);
    if (previous > 0) {
      const category = this.actor.system.isPet || this.actor.system.isFamiliar ? 'C' : 'E';
      const cost = DSA5_Utility._calculateAdvCost(advances, category, 0) * -1;
      await this._updateAPs(cost, {
        [`system.characteristics.${attr}.advances`]: previous - 1,
      });
      await APTracker.track(this.actor, { type: 'attribute', attr, previous: advances, next: advances - 1 }, cost);
      return true;
    }
  }

  async _rebuyPC(attr) {
    if (this.actor.system.status[attr].permanentLossSum > 0) {
      if (await this._checkEnoughXP(2)) {
        const previous = Number(this.actor.system.status[attr].rebuy);
        await this._updateAPs(2, {
          [`system.status.${attr}.rebuy`]: previous + 1,
        });
        await APTracker.track(this.actor, { type: 'permanentLoss', attr, previous, next: previous + 1 }, 2);
        return true;
      }
    }
  }

  async _refundPC(attr) {
    if (this.actor.system.status[attr].rebuy > 0) {
      const previous = Number(this.actor.system.status[attr].rebuy);
      await this._updateAPs(-2, {
        [`system.status.${attr}.rebuy`]: previous - 1,
      });
      await APTracker.track(this.actor, { type: 'permanentLoss', attr, previous, next: previous - 1 }, -2);
      return true;
    }
  }

  async _advancePoints(attr) {
    const previous = Number(this.actor.system.status[attr].advances);
    const category = this.actor.system.isPet || this.actor.system.isFamiliar ? 'C' : 'D';
    const cost = DSA5_Utility._calculateAdvCost(previous, category);
    if ((await this._checkEnoughXP(cost)) && this._checkMaximumPointAdvancement(attr, previous + 1)) {
      await this._updateAPs(cost, {
        [`system.status.${attr}.advances`]: previous + 1,
      });
      await APTracker.track(this.actor, { type: 'point', attr, previous, next: previous + 1 }, cost);
      return true;
    }
  }

  async _refundPointsAdvance(attr) {
    const previous = Number(this.actor.system.status[attr].advances);
    if (previous > 0) {
      const category = this.actor.system.isPet || this.actor.system.isFamiliar ? 'C' : 'D';
      const cost = DSA5_Utility._calculateAdvCost(previous, category, 0) * -1;
      await this._updateAPs(cost, {
        [`system.status.${attr}.advances`]: previous - 1,
      });
      await APTracker.track(this.actor, { type: 'point', attr, previous, next: previous - 1 }, cost);
      return true;
    }
  }

  async _advanceItem(itemId) {
    const item = this.actor.items.get(itemId);
    return await item.sheet._advanceStep();
  }

  async _refundItemAdvance(itemId) {
    const item = this.actor.items.get(itemId);
    return await item.sheet._refundStep();
  }

  _checkMaximumPointAdvancement(attr, newValue) {
    const result = newValue <= this.actor.system.pointAdvancementLimit(attr);
    if (!result)
      ui.notifications.error('DSAError.AdvanceMaximumReached', {
        localize: true,
      });

    return result;
  }

  static async _openLibrary(ev, target) {
    game.dsa5.itemLibrary.render(true);
  }

  static async _addToPersonae() {
    await PersonaeDramatis.addActorToPersonae(this.actor);
  }

  static async _configActor(ev, target) {
    new DialogActorConfig(this.actor, {}).render(true);
  }

  static _configureActorEffect(_ev, target) {
    if (!this.isEditable) return;
    const config = ActorActiveEffectValueDialog.parseTriggerConfig(target);
    if (!config.key) return;
    ActorActiveEffectValueDialog.show(this.actor, config);
  }

  static async _changeAdvanceLock(ev, target) {
    const element = this.element.querySelector('[data-action="locksheet"]');
    element.classList.toggle('fa-lock');
    element.classList.toggle('fa-unlock');
    await this.actor.update({ 'system.sheetLocked.value': !this.actor.system.sheetLocked.value });
  }

  async _checkEnoughXP(cost) {
    return await this.actor.checkEnoughXP(cost);
  }

  async advanceWrapper(trg, funct, ...params) {
    if (this.wrapperLocked) return;

    this.wrapperLocked = true;
    const target = trg.classList.contains('fas') ? $(trg) : $(trg).find('i');
    target.addClass('fa-spin fa-spinner');
    if (await this[funct](...params)) return;

    this.wrapperLocked = false;
    target.removeClass('fa-spin fa-spinner');
  }

  playerViewEnabled() {
    return this.actor.system.playerView;
  }

  static async _togglePlayerview(ev, target) {
    await this.close()
    await this.actor.update({ 'system.playerView': !this.actor.system.playerView });
    this.render(true)
  }

  static async _toggleIgnoreWeaponHandLimits() {
    const current = !!getProperty(this.actor, 'system.config.ignoreWeaponHandLimits');
    await this.actor.update({ 'system.config.ignoreWeaponHandLimits': !current });
  }

  showLimited() {
    return (!game.user.isGM && this.actor.limited) || this.playerViewEnabled();
  }

  getTokenId() {
    return this.token?.id ?? this.actor?.getActiveTokens()[0]?.id;
  }

  static async _rollDisease(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    const SKModifier = this.actor.system.status.soulpower.max * -1;
    const ZKModifier = this.actor.system.status.toughness.max * -1;
    const setupData = await item.setupEffect(undefined, { messageMode: DICE_CONSTANTS.CHAT_MODES.GM, manualResistance: { SKModifier, ZKModifier } });
    const result = await item.itemTest(setupData);
    await this.actor.updateEmbeddedDocuments('Item', [{ _id: item.id, 'system.duration.resolved': result.result.duration }]);
  }

  static _swapWeaponHand(ev, target) {
    return this.swapWeaponHand(target);
  }

  static async _swapWeaponHandSlot(ev, target) {
    await this.swapWeaponHandSlot(target);
  }

  static async _toggleWeaponOffHand(ev, target) {
    await this.toggleWeaponOffHand(target);
  }

  async toggleWeaponOffHand(target, item = undefined) {
    const itemId = item?.id || this._getItemId(target);
    item = item || this.actor.items.get(itemId);
    if (!item || item.type !== 'meleeweapon') return;

    const wasEquipped = !!item.system.worn.value;
    const wasOffHand = !!item.system.worn.offHand;

    await this.actor.toggleWeaponOffHand(item.id);

    // Only play offhand-change sound when this was a hand-toggle on an already equipped weapon.
    if (wasEquipped) {
      const updated = this.actor.items.get(item.id);
      if (updated && wasOffHand !== !!updated.system.worn.offHand) DSA5SoundEffect.playEquipmentWearStatusChange(updated);
    }
  }

  async swapWeaponHandSlot(target, item = undefined) {
    const actualTarget = target && typeof target.closest === 'function' ? target : target?.parentElement || target;
    const itemId = item?.id || this._getItemId(actualTarget);
    item = item || this.actor.items.get(itemId);

    if (!item || !['meleeweapon', 'rangeweapon'].includes(item.type)) return;

    const clickedHand = actualTarget?.dataset?.hand || actualTarget?.closest?.('[data-hand]')?.dataset?.hand;
    const wasEquipped = !!item.system.worn.value;
    const wasOffHand = !!item.system.worn.offHand;

    await this.actor.handleWeaponHandSlotClick(item.id, clickedHand);

    // Only play offhand-change sound when this was a hand-toggle on an already equipped weapon.
    if (wasEquipped) {
      const updated = this.actor.items.get(item.id);
      if (updated && wasOffHand !== !!updated.system.worn.offHand) DSA5SoundEffect.playEquipmentWearStatusChange(updated);
    }
  }

  async swapWeaponHand(target, item = undefined) {
    const actualTarget = target && typeof target.closest === 'function' ? target : target?.parentElement || target;
    const itemId = item?.id || this._getItemId(actualTarget);
    item = item || this.actor.items.get(itemId);

    await item.system.swapNumberWeaponHands();
  }

  _toggleDisabled(disabled) {
    super._toggleDisabled(disabled);
    if (!disabled) return;
    this.element?.querySelectorAll('.keep-field-edit[data-action="editKeepField"]').forEach((button) => {
      button.disabled = false;
    });
  }

  static _editKeepField(_ev, target) {
    const groupbox = target.closest('.keepFieldsEnabled');
    if (!groupbox) return;

    const attr = groupbox.dataset.attr;
    const name = groupbox.dataset.name;
    if (!attr) return;

    const dialogId = `foreign-field-editor-${this.actor.id}-${attr.replace(/^system\./, '').replace(/\./g, '-')}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return;
    }

    new ForeignFieldEditor(this.actor.id, attr, name, { id: dialogId }).render(true);
  }

  static async _skillSelect(ev, target) {
    const itemId = this._getItemId(target);
    const skill = this.actor.items.get(itemId);

    if (ev.button == 0) {
      if (!this.isEditable) {
        ui.notifications.warn('DSAError.RollPermission', { localize: true });
        return;
      }
      if (await SummoningFlow.interceptRoll(this.actor, skill)) return;

      const setupData = await this.actor.setupSkill(skill, {}, this.getTokenId());
      this.actor.basicTest(setupData);
    } else if (ev.button == 2) skill.sheet.render(true);
  }

  static async _conditionEdit(ev, target) {
    const effect = target.dataset.uuid ? await fromUuid(target.dataset.uuid) : this.actor.effects.get(target.dataset.id);
    effect.sheet.render(true);
  }

  static _chCollapse(ev, target) {
    $(target).find('i').toggleClass('fa-angle-up fa-angle-down');
    $(target).closest('.groupbox').find('.row-section:nth-child(2)').fadeToggle();
  }

  static _statusCreate(ev, target) {
    const menu = $(target).siblings('.statusEffectMenu').find('ul');
    menu.fadeIn('fast', () => {
      menu.find('input').trigger('focus');
    });
  }

  static _itemDropdown(ev, target) {
    $(target).closest('.item').find('.expandDetails:first').toggleClass('shown');
  }

  static _conditionShow(ev, target) {
    const id = target.dataset.id;
    if (ev.button == 0) {
      this.actor.effects.get(id).sheet.render(true);
    } else if (ev.button == 2 && !target.dataset.locked) {
      this._deleteActiveEffect(id);
    }
  }

  static async _rollAnySkill(ev, target) {
    const { name, ch1, ch2, ch3 } = target.dataset;
    const attributes = { system: { characteristic1: { value: ch1 }, characteristic2: { value: ch2 }, characteristic3: { value: ch3 } } };
    this.actor.rollAnySkill(_loc(name), this.getTokenId(), attributes);
  }

  static _itemEdit(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    item.sheet.render(true);
  }

  static async _chValue(ev, target) {
    const characteristic = target.attributes['data-char'].value;
    const setupData = await this.actor.setupCharacteristic(characteristic, {}, this.getTokenId());
    this.actor.basicTest(setupData);
  }

  static async _chStatus(ev, target) {
    const setupData = await this.actor.setupDodge({}, this.getTokenId());
    this.actor.basicTest(setupData);
  }

  static async _chRegenerate(ev, target) {
    const setupData = await this.actor.setupRegeneration('regenerate', {}, this.getTokenId());
    this.actor.basicTest(setupData);
  }

  static async _chWeaponless(ev, target) {
    const characteristic = target.dataset.char;
    const setupData = await this.actor.setupWeaponless(characteristic, {}, this.getTokenId());
    this.actor.basicTest(setupData);
  }

  static _chFallingDamage(ev, target) {
    this.actor.setupFallingDamage({}, this.getTokenId());
  }

  static _combatRules() {
    DSA5CombatTracker._onCombatRulesButtonClicked();
  }

  static async _chRollCombat(ev, target) {
    const dataset = this._getItemDataset(target);
    const mode = target.dataset.mode;
    const item = Actordsa5.buildSubweapon(this.actor.items.get(dataset.itemId), dataset.subweapon);
    const setupData = await this.actor.setupWeapon(item, mode, {}, this.getTokenId());
    this.actor.basicTest(setupData);
  }

  static _schipUdate(ev, target) {
    let val = Number(target.dataset.val);
    if (val == 1 && $(this.element).find('.fullSchip.ownSchips').length == 1) val = 0;

    this.actor.update({ 'system.status.fatePoints.value': val });
  }

  static async _extraSchipUpdate(ev, target) {
    const path = target.dataset.path;
    if (!path) return;

    let val = Number(target.dataset.val);
    const current = Number(getProperty(this.actor, path)) || 0;
    if (val === 1 && current === 1) val = 0;
    await this.actor.update({ [path]: val });
  }

  static _defenseToggle(ev, target) {
    this.actor.update({ 'system.config.defense': !this.actor.system.config.defense })
  }

  static async _chargeSpell(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    const lz = Number(item.system.castingTime.modified);
    const update = {
      _id: itemId
    }
    if (ev.button == 0) update['system.castingTime.progress'] = Math.min(item.system.castingTime.progress + 1, lz);
    else if (ev.button == 2) {
      update['system.castingTime.progress'] = 0;
      update['system.castingTime.modified'] = 0;
    }
    await this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  static async _loadWeapon(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);

    if (!getProperty(item, 'system.currentAmmo.value')) return;

    const update = { _id: itemId };
    if (ev.button == 0) {
      const lz = item.type == 'trait' ? item.system.reloadTime.value : Actordsa5.calcLZ(item, this.actor);
      update['system.reloadTime.progress'] = Math.min(item.system.reloadTime.progress + 1, lz);
    } else if (ev.button == 2) {
      update['system.reloadTime.progress'] = 0;
      update['system.aimTime.progress'] = 0;
    }

    await this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  static _pickAmmo(_ev, target) {
    const itemId = this._getItemId(target);
    const weapon = this.actor.items.get(itemId);
    if (!weapon) return;

    if (!AmmoPicker.matchingAmmo(this.actor, weapon).length) {
      ui.notifications.warn('VEHICLE.noAmmunition', { localize: true });
      return;
    }

    const menu = $(target).siblings('.statusEffectMenu').find('ul');
    this.element.querySelectorAll('.statusEffectMenu ul').forEach((ul) => {
      if (ul !== menu[0]) $(ul).hide();
    });
    menu.fadeIn('fast');
  }

  static async _selectAmmo(_ev, target) {
    const itemId = this._getItemId(target);
    const pickId = target.dataset.ammoId;
    if (!itemId || pickId == null) return;

    await AmmoPicker.assign(this.actor, itemId, pickId === AmmoPicker.CLEAR ? '' : pickId);
  }

  static async _itemSwapMag(ev, target) {
    await this.actor.swapMag(this._getItemId(target));
  }

  static async _itemToggle(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);

    switch (item.type) {
      case 'rangeweapon':
      case 'meleeweapon':
        await this.actor.equipWeaponToHand(itemId, { hand: 'auto', equip: !item.system.worn.value });
        DSA5SoundEffect.playEquipmentWearStatusChange(item);
        break;
      case 'armor':
      case 'equipment':
        await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.worn.value': !item.system.worn.value }]);
        DSA5SoundEffect.playEquipmentWearStatusChange(item);
        break;
    }
  }

  static async _statusAdd(ev, target) {
    const status = target.dataset.id;
    if (status == 'custom') {
      DSA5StatusEffects.createCustomEffect(this.actor);
    } else {
      if (ev.button == 0) {
        await this.actor.addCondition(status, 1, false, false);
      } else if (ev.button == 2) {
        AddEffectDialog.modifyEffectDialog(status, async (id, options) => this.actor.addTimedCondition(id, 1, false, false, options));
      }
    }
  }

  static _disableRegeneration(ev, target) {
    const type = target.dataset.type;
    const prop = `system.repeatingEffects.disabled.${type}`;
    this.actor.update({ [prop]: !getProperty(this.actor, prop) });
  }

  static async _conditionValue(ev, target) {
    const condKey = $(target).closest('[data-descriptor]').attr('data-descriptor');
    if (ev.button == 0) await this.actor.addCondition(condKey, 1, false, false);
    else if (ev.button == 2) await this.actor.removeCondition(condKey, 1, false);
  }

  static _advanceWrapper(ev, target) {
    this.advanceWrapper(target, target.dataset.fct, target.dataset.attr);
  }

  static _quantityClick(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    const update = { _id: itemId, system: { quantity: { value: item.system.quantity.value } } };
    RuleChaos.increment(ev, update, 'system.quantity.value', 0);
    this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  static _filterTalents(ev, target) {
    const hTarget = $(target);
    hTarget.closest('.scrollable').find('.allTalents').toggleClass('showAll');
    hTarget.toggleClass('filtered');
  }

  static _postItem(ev, target) {
    this.actor.items.get(this._getItemId(target)).postItem();
  }

  async _onFirstRender(context, options) {
    await super._onFirstRender(context, options);
    const html = $(this.element);
    resizeListener(html.find('.window-content'))

    new ContextMenu(this.element, '.item .withContext', [], {
      onOpen: this._onItemContext.bind(this),
      jQuery: false,
      fixed: true
    });
    new ContextMenu(this.element, '.combat-weapon', [], {
      onOpen: this._onWeaponItemContext.bind(this),
      jQuery: false,
      fixed: true
    });

    new ContextMenu(this.element, '.unequipped-weapon-menu', [], {
      onOpen: this._onUnequippedWeaponContext.bind(this),
      jQuery: false,
      fixed: true
    });
    new ContextMenu(this.element, '.effectConfig', [], {
      onOpen: this._onStatusEffectContext.bind(this),
      jQuery: false,
      fixed: true
    });
    new ContextMenu(this.element, '.inventory-bulk-actions-menu', [], {
      onOpen: this._onBulkInventoryContext.bind(this),
      jQuery: false,
      fixed: true,
    });
  }

  static _collapseHeader(ev, target) {
    const header = this.element.querySelector('[data-application-part="header"]');
    header.classList.toggle('smallHeader');
  }

  static _startCharacterBuilder(ev, target) {
    this.actor.setFlag('core', 'sheetClass', 'dsa5.DSACharBuilder');
  }

  _onHoverCost(ev) {
    const target = ev.currentTarget;
    if (ev.currentTarget.dataset.tooltip) return;

    const isAnimal = this.actor.system.isFamiliar || this.actor.system.isPet;
    const fct = {
      _advanceAttribute: (isAnimal) => {
        const category = isAnimal ? 'C' : 'E';
        const ch = this.actor.system.characteristics[target.dataset.attr];
        return { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, category), key: 'advancementCost' }
      },
      _refundAttributeAdvance: (isAnimal) => {
        const category = isAnimal ? 'C' : 'E';
        const ch = this.actor.system.characteristics[target.dataset.attr];
        return { cost: DSA5_Utility._calculateAdvCost(ch.initial + ch.advances, category, 0), key: 'refundCost' }
      },
      _refundPointsAdvance: (isAnimal) => {
        const category = isAnimal ? 'C' : 'D';
        return { cost: DSA5_Utility._calculateAdvCost(this.actor.system.status[target.dataset.attr].advances, category, 0), key: 'refundCost' }
      },
      _advancePoints: (isAnimal) => {
        const category = isAnimal ? 'C' : 'D';
        return { cost: DSA5_Utility._calculateAdvCost(this.actor.system.status[target.dataset.attr].advances, category), key: 'advancementCost' }
      },
      _refundItemAdvance: (isAnimal) => {
        const item = this.actor.items.get(target.dataset.attr);
        return { cost: item.system.refundCost(), key: 'refundCost' }
      },
      _advanceItem: (isAnimal) => {
        const item = this.actor.items.get(target.dataset.attr);
        return { cost: item.system.advanceCost(), key: 'advancementCost' }
      },
    }[target.dataset.fct]
    if (!fct) return;

    const cost = fct(isAnimal);
    ev.currentTarget.dataset.tooltip = _loc(cost.key, cost);
    game.tooltip.activate(ev.currentTarget)
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    this.element.classList.toggle('vertical-tabs', game.settings.get('dsa5', 'tabsOutsideSheet'));
    const posthand = (ev) => {
      this.actor.items.get(this._getItemId(ev.currentTarget)).postItem();
    };

    html.find('.tabs button').prop('disabled', false);

    html.find('.gTooltip').on('pointerover', (ev) => this.#betterTooltip(ev));

    tabSlider(html);

    const autoSizings = html.find('.autosizing input')
    for (const el of autoSizings) {
      const chars = (el.value.length || el.placeholder.length) + 1;
      el.setAttribute('style', `width: ${chars}ch;`);
    }
    autoSizings.on('keydown', (ev) => {
      const input = ev.currentTarget;
      const chars = (input.value.length || input.placeholder.length) + 1;
      input.setAttribute('style', `width: ${chars}ch;`);
    });

    html.find('[data-action="editImage"]').on('mousedown', (ev) => {
      if (ev.button == 2) DSA5_Utility.showArtwork(this.actor);
    });

    html.find('.statusEffectMenu ul').on('mouseleave', (ev) => $(ev.currentTarget).fadeOut());
    html.find('[data-action="advanceWrapper"]').on('mouseenter', this._onHoverCost.bind(this));
    html.find('.chat-condition').on('click', (ev) => DSA5ChatListeners.postStatus(ev.currentTarget.dataset.id));


    const deletehand = (ev) => this._deleteItem(ev.currentTarget);

    html.find('.cards .item').on('mouseenter', (ev) => {
      if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
        const div = document.createElement('div');
        div.classList.add('hovermenu');
        const del = document.createElement('i');
        del.classList.add('fas', 'fa-times');
        del.dataset.tooltip = 'SHEET.DeleteItem';
        del.addEventListener('click', deletehand, false);
        const post = document.createElement('i');
        post.classList.add('fas', 'fa-comment');
        post.dataset.tooltip = 'SHEET.PostItem';
        post.addEventListener('click', posthand, false);
        div.appendChild(post);
        div.appendChild(del);
        ev.currentTarget.appendChild(div);
      }
    });

    html.find('.cards .item').on('mouseleave', (ev) => {
      const e = ev.toElement || ev.relatedTarget;
      if (!e || e.parentNode == this || e == this) return;

      ev.currentTarget.querySelectorAll('.hovermenu').forEach((e) => e.remove());
    });

    const uuid = this.actor.uuid;
    html.find('.actorDrag').each(function (i, cond) {
      cond.setAttribute('draggable', true);
      cond.addEventListener('dragstart', (ev) => {
        const dataTransfer = {
          type: 'Actor',
          uuid,
        };
        ev.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
      });
    });

    html.find('.charimg').on('mousedown', (ev) => {
      if (ev.button == 2) DSA5_Utility.showArtwork(this.actor, true);
    });

    DSA5ChatAutoCompletion.bindRollCommands(html);

    this.#talentSearch ??= new SearchFilter({
      inputSelector: ".talentSearch",
      contentSelector: ".allTalents",
      callback: this._filterTalents.bind(this)
    });
    this.#talentSearch.bind(this.element);
    this.#gearSearch ??= new SearchFilter({
      inputSelector: ".gearSearch",
      contentSelector: "[data-application-part=inventory]",
      callback: this._filterGear.bind(this)
    });
    this.#gearSearch.bind(this.element);
    this.#conditionSearch ??= new SearchFilter({
      inputSelector: ".conditionSearch",
      contentSelector: ".statusEffectMenu",
      callback: this._filterConditions.bind(this)
    });
    this.#conditionSearch.bind(this.element);

    bindImgToCanvasDragStart(html, 'img.charimg');

    Riding.onRender(html, this.actor);

    if (!this.isEditable) return;

    html.find('.money-change').on('change', this._onMoneyChange.bind(this));
    html.find('.skill-advances').on('change', async (ev) => {
      const itemId = this._getItemId(ev.currentTarget);
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.talentValue.value': Number(ev.target.value) }]);
    });

    //todo we could remove this if every .item is replaced with .draggable (parent class has draggable attachment listener)
    new DragDrop.implementation({
      dragSelector: ".item",
      dropSelector: null,
      permissions: {
        dragstart: this._canDragStart.bind(this),
        drop: this._canDragDrop.bind(this)
      },
      callbacks: {
        dragstart: this._onDragStart.bind(this),
        dragover: this._onDragOver.bind(this),
        drop: this._onDrop.bind(this)
      }
    }).bind(this.element);
  }

  async _onMoneyChange(ev) {
    const itemId = this._getItemId(ev.currentTarget);
    const value = Number(ev.target.value);
    const item = this.actor.items.get(itemId);
    const cost = (value - item.system.quantity.value) * 1.0 * item.system.price.value
    await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.quantity.value': value }]);
    await MoneyTracker.track(this.actor, { type: 'sheetChange' }, cost);
  }

  #betterTooltip(ev) {
    GlobalToolTipHandler.handleTooltip(ev, this.actor);
  }

  _onItemContext(target) {
    const item = this.actor.items.get($(target).closest('.item').attr('data-item-id'));

    if (!item) return;
    ui.context.menuItems = this._getItemContextOptions(item);
    Hooks.call('dsa5.getItemContextOptions', item, ui.context.menuItems);
  }

  _onBulkInventoryContext(_target) {
    ui.context.menuItems = this._getBulkInventoryContextOptions();
  }

  static _addSpeedCategory(ev, target) {
    new SpeedSelector(this.actor).render(true);
  }

  _onWeaponItemContext(target) {
    const itemId = target.dataset.itemId || target.closest('[data-item-id]')?.dataset?.itemId;
    const item = this.actor.items.get(itemId);

    if (!item) return;

    if (['meleeweapon', 'rangeweapon'].includes(item.type)) {
      ui.context.menuItems = this._getWeaponItemContextOptions(item);
    } else if (item.type === 'trait') {
      ui.context.menuItems = this._getWeaponTraitContextOptions(item);
    } else {
      return;
    }
    Hooks.call('dsa5.getWeaponItemContextOptions', item, ui.context.menuItems);
  }

  _onUnequippedWeaponContext(target) {
    const weaponType = target?.dataset?.weaponType;
    if (!['meleeweapon', 'rangeweapon'].includes(weaponType)) return;

    ui.context.menuItems = this._getUnequippedWeaponContextOptions(weaponType);
    Hooks.call('dsa5.getUnequippedWeaponContextOptions', weaponType, ui.context.menuItems);
  }

  _getUnequippedWeaponContextOptions(weaponType) {
    const equipLabel = _loc('SHEET.EquipItem');
    const icon = weaponType === 'rangeweapon' ? "<i class='fas fa-bullseye'></i>" : "<i class='fas fa-sword'></i>";

    const unequipped = this.actor.items
      .filter(i => i.type === weaponType && i.system?.worn && !i.system.worn.value)
      .slice(0, 10);

    if (!unequipped.length) {
      return [
        {
          label: _loc('SHEET.NoUnequippedWeapons'),
          icon: "<i class='fas fa-minus'></i>",
          onClick: () => {},
        },
      ];
    }

    return unequipped.map(w => ({
      label: `${equipLabel}: ${w.name}`,
      icon,
      onClick: () => this.actor.equipWeaponToHand(w.id, { hand: 'auto', equip: true }),
    }));
  }

  _getWeaponTraitContextOptions(item) {
    return [
      {
        label: 'SHEET.EditItem',
        icon: "<i class='fas fa-edit'></i>",
        onClick: () => item.sheet.render(true),
      },
      {
        label: 'SHEET.Dropdown',
        icon: "<i class='fas fa-chevron-down'></i>",
        onClick: () => {
          $(this.element).find(`[data-item-id="${item.id}"] .expandDetails:first`).toggleClass('shown');
        },
      },
      {
        label: 'SHEET.PostItem',
        icon: "<i class='fas fa-comment fa-fw'></i>",
        onClick: () => item.postItem(),
      },
    ];
  }

  _onStatusEffectContext(target) {
    const header = target.closest('[data-id]');
    const id = header.dataset.id;
    const itemId = header.dataset.itemId;
    const item = itemId ? this.actor.items.get(itemId) : null;
    const effect = item ? item.effects.get(id) : this.actor.effects.get(id);

    if (!effect) return;
    ui.context.menuItems = this._getStatusEffectContextOptions(effect, item);
    Hooks.call('dsa5.getStatusEffectContextOptions', effect, ui.context.menuItems);
  }

  _getStatusEffectContextOptions(effect, item) {
    const options = [];

    if (OnUseEffect.hasOnUseEffect(effect)) {
      options.push({
        label: 'SHEET.onUseEffect',
        icon: "<i class='fas fa-dice-six'></i>",
        onClick: () => {
          const onUse = new OnUseEffect(effect);
          onUse.executeOnUseEffect();
        }
      });
    }

    options.push(
      {
        label: 'SHEET.EditItem',
        icon: "<i class='fas fa-edit'></i>",
        onClick: () => effect.sheet.render(true)
      },
      {
        label: effect.disabled ? 'SHEET.activate' : 'SHEET.deactivate',
        icon: effect.disabled ? "<i class='far fa-circle'></i>" : "<i class='far fa-check-circle'></i>",
        onClick: () => effect.update({ 'disabled': !effect.disabled })
      },
      {
        label: 'source',
        icon: "<i class='fas fa-info'></i>",
        visible: !!item,
        onClick: () => item.sheet.render(true)
      }
    );

    return options;
  }

  _getWeaponItemContextOptions(item) {
    const options = [];

    if (['rangeweapon', 'meleeweapon'].includes(item.type)) {
      options.push(...item.system.getContextOptions());
    }

    if (item.type === 'meleeweapon') {
      options.push({
        label: 'offHand',
        icon: "<i class='fas fa-shield-halved'></i>",
        onClick: () => {
          if (RuleChaos.isWieldedTwohanded(item)) return;
          const desiredHand = item.system.worn.offHand ? 'main' : 'offhand';
          if (item.system.worn.value && this.actor.swapWeaponHandSlot) this.actor.swapWeaponHandSlot(item.id, desiredHand);
          else this.actor.equipWeaponToHand(item.id, { hand: desiredHand, equip: true });
        },
      });
    }

    options.push({
      label: 'SHEET.PostItem',
      icon: "<i class='fas fa-comment fa-fw'></i>",
      onClick: () => item.postItem(),
    });

    return options;
  }

  _getBulkInventoryContextOptions() {
    const hasItems = InventoryBulkActionHelper.hasInventoryItems(this.actor, { includeEquipped: true });

    if (!hasItems) {
      return [
        {
          label: 'INVENTORYBULK.noItems',
          icon: "<i class='fas fa-box-open fa-fw'></i>",
          onClick: () => {},
        },
      ];
    }

    return [
      {
        label: 'INVENTORYBULK.delete',
        icon: "<i class='fas fa-trash fa-fw'></i>",
        onClick: () => this._bulkDeleteInventory(),
      },
      {
        label: 'INVENTORYBULK.dropGround',
        icon: "<i class='fas fa-arrow-down-to-line fa-fw'></i>",
        visible: () => InventoryBulkActionHelper.canDropInventoryToGround(this.actor),
        onClick: () => this._bulkDropInventory(false),
      },
      {
        label: 'INVENTORYBULK.dropBag',
        icon: "<i class='fas fa-box-archive fa-fw'></i>",
        onClick: () => this._bulkDropInventory(true),
      },
    ];
  }

  async _confirmBulkInventoryAction(messageKey, formatData = {}) {
    const content = await renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.hbs', {
      message: game.i18n.format(messageKey, formatData),
    });

    return await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'INVENTORYBULK.title',
      },
      content,
      rejectClose: false,
      modal: true,
    });
  }

  async _bulkDeleteInventory() {
    const proceed = await this._confirmBulkInventoryAction('INVENTORYBULK.deleteConfirm', { name: this.actor.name });
    if (!proceed) return;

    await InventoryBulkActionHelper.deleteInventory(this.actor, { includeEquipped: true });
  }

  async _bulkDropInventory(useBag) {
    if (!useBag && !InventoryBulkActionHelper.canDropInventoryToGround(this.actor)) {
      ui.notifications.error('INVENTORYBULK.requiresToken', { localize: true });
      return;
    }

    const proceed = await this._confirmBulkInventoryAction(
      useBag ? 'INVENTORYBULK.dropBagConfirm' : 'INVENTORYBULK.dropGroundConfirm',
      { name: this.actor.name },
    );
    if (!proceed) return;

    const movedItems = useBag
      ? await InventoryBulkActionHelper.moveInventoryToBag(this.actor, { includeEquipped: true })
      : await InventoryBulkActionHelper.dropInventoryToGround(this.actor, { includeEquipped: true });

    if (!useBag && movedItems < 0) {
      ui.notifications.error('INVENTORYBULK.requiresToken', { localize: true });
    }
  }

  _getItemContextOptions(item) {
    const options = [
      {
        label: 'SHEET.EditItem',
        icon: "<i class='fas fa-edit fa-fw'></i>",
        onClick: () => item.sheet.render(true),
      },
      {
        label: 'SHEET.PostItem',
        icon: "<i class='fas fa-comment fa-fw'></i>",
        onClick: () => item.postItem(),
      },
      {
        label: 'SHEET.DuplicateItem',
        icon: "<i class='fas fa-copy fa-fw'></i>",
        onClick: () => this.handleItemCopy(item.toObject(), item.type),
      },
      {
        label: 'SHEET.ConsumeItem',
        icon: "<i class='fas fa-wine-bottle fa-fw'></i>",
        visible: () => ['consumable', 'plant'].includes(item.type),
        onClick: () => this.consumeItem(item),
      },
      {
        label: 'SHEET.onUseEffect',
        icon: "<i class='fas fa-dice-six fa-fw'></i>",
        visible: () => OnUseEffect.hasOnUseEffect(item),
        onClick: () => new OnUseEffect(item).executeOnUseEffect(),
      },
      {
        label: 'CONJURATION.startSummoning',
        icon: "<i class='fas fa-hat-wizard fa-fw'></i>",
        visible: () => SummoningFlow.isConjurationSkill(item),
        onClick: () => SummoningFlow.open(this.actor, item),
      },
      {
        label: 'SHEET.DeleteItem',
        icon: "<i class='fas fa-trash fa-fw'></i>",
        onClick: () => this._itemDeleteDialog(item),
      },
      {
        label: 'MERCHANT.exchange',
        icon: "<i class='fas fa-coins'></i>",
        visible: () => DSA5.equipmentCategories.has(item.type),
        onClick: () => this._startTrade(item),
      },
      {
        label: 'SHEET.changeMoney',
        icon: "<i class='fas fa-coins'></i>",
        visible: () => item.type == 'money',
        onClick: () => DSA5Payment._replaceMoney(this.actor),
      },
    ];

    if (hasProperty(item, 'system.worn.wearable') || ['meleeweapon', 'rangeweapon', 'armor'].includes(item.type)) {
      options.push({
        label: 'SHEET.EquipItem',
        icon: "<i class='fas fa-shield-alt fa-fw'></i>",
        onClick: async () => {
          if (['meleeweapon', 'rangeweapon'].includes(item.type)) {
            await this.actor.equipWeaponToHand(item.id, { hand: 'auto', equip: !item.system.worn.value });
            return;
          }

          await item.update({ 'system.worn.value': !item.system.worn.value });
        },
      });
    }
    if (Number(getProperty(item, 'system.quantity.value')) > 1) {
      options.push({
        label: 'SHEET.SplitItem',
        icon: "<i class='fas fa-arrows-split-up-and-left fa-fw'></i>",
        onClick: () => this._splitItem(item),
      });
    }

    if (DSA5.equipmentCategories.has(item.type)) {
      const actor = this.actor;
      options.push({
        label: 'GROUP.passToGroup',
        icon: "<i class='fas fa-arrow-right-to-bracket fa-fw'></i>",
        visible: () => {
          const partyUuid = game.settings.get('dsa5', 'primaryParty');
          if (!partyUuid) return false;
          const party = fromUuidSync(partyUuid);
          if (!party?.system?.actors) return false;
          if (!party.system.actors.has(actor)) return false;
          return GroupData.getUnlockedLootDepots(party).length > 0;
        },
        onClick: () => {
          import('./group-sheet.js').then((m) => m.default.passItemToGroup(actor, item));
        },
      });
    }

    return options;
  }

  async _startTrade(_item) {
    const actors = ActorPickerDialog.buildActorPickerData({
      actors: game.actors.filter((actor) => actor.hasPlayerOwner && actor.id !== this.actor.id),
    });
    const [targetId] = await ActorPickerDialog.open({
      actors,
      title: 'MERCHANT.exchange',
      selectionMode: 'single',
    });
    if (!targetId) return;

    const target = game.actors.get(targetId);
    if (!target) return;

    const sourceSpeaker = RollDialogBuilder.buildSpeaker(this.actor, this.actor.token?.id);
    const targetSpeaker = RollDialogBuilder.buildSpeaker(target, target.token?.id);
    new Trade(sourceSpeaker, targetSpeaker).startTrade();
  }

  _splitItem(item) {
    const callback = async (formOptions) => {
      const count = Number(formOptions.count.value);
      const itemData = item.toObject();
      itemData.system.quantity.value = count;
      await this.actor.createEmbeddedDocuments('Item', [itemData], {
        render: false,
      });
      await this.actor.updateEmbeddedDocuments('Item', [
        {
          _id: item.id,
          'system.quantity.value': item.system.quantity.value - count,
        },
      ]);
    };

    RangeSelectDialog.create(
      'SHEET.SplitItem',
      callback,
      {
        name: _loc('MERCHANT.splitItem', { name: item.name }),
        count: item.system.quantity.value - 1,
        max: item.system.quantity.value - 1,
      }
    );
  }

  static async _onMacroUseItem(ev, target) {
    const item = this.actor.items.get(this._getItemId(target));
    const onUse = new OnUseEffect(item);
    await onUse.executeOnUseEffect(OnUseEffect.buildExecutionOptions(ev));
  }

  static async _onMacroUseEffect(ev, target) {
    const effect = await fromUuid(target.dataset.uuid);
    if (!effect) return;

    const onUse = new OnUseEffect(effect);
    await onUse.executeOnUseEffect(OnUseEffect.buildExecutionOptions(ev));
  }

  static async _payAeSpecialAbilityCost(ev, target) {
    const item = this.actor.items.get(this._getItemId(target));

    const cost = Number(getProperty(item, 'system.AsPCost'));
    const paid = await this.actor.applyMana(cost, 'AsP');

    if (!paid) return;

    const msg = _loc('CHATNOTIFICATION.paysTraditionAbility', {
      name: this.actor.name,
      ability: item.name,
      cost,
    });
    if (ev.button == 2) {
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg, DICE_CONSTANTS.CHAT_MODES.GM));
    } else {
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
    }
  }

  static _powersourceEdit(ev, target) {
    PowersourceChargeDialog.show(this.actor);
  }

  static _selectTraditionArtifact(ev, target) {
    if (!this.isEditable) return;

    new TraditionItemPicker(this.actor, 'magical').render(true);
  }

  static _selectTraditionItem(ev, target) {
    if (!this.isEditable) return;

    const kind = target.dataset.traditionKind;
    if (!TRADITION_ITEM_KINDS[kind]) return;

    new TraditionItemPicker(this.actor, kind).render(true);
  }

  static _deleteTraditionArtifact(ev, target) {
    if (!this.isEditable) return;

    const item = this.actor.items.get(this._getItemId(target));
    item.update({ 'system.isArtifact': false });
  }

  static _deleteTraditionItem(ev, target) {
    if (!this.isEditable) return;

    const kind = target.dataset.traditionKind;
    const config = TRADITION_ITEM_KINDS[kind];
    if (!config) return;

    const item = this.actor.items.get(this._getItemId(target));
    item.update({ [`system.${config.flagField}`]: false });
  }

  _tearDown(options) {
    super._tearDown(options);
    this.#conditionSearch?.unbind();
    this.#gearSearch?.unbind();
    this.#talentSearch?.unbind();
  }

  _filterGear(_event, query, rgx, html) {
    for (const entry of html.querySelectorAll(".item")) {
      if (!query) {
        entry.hidden = false;
        continue;
      }

      const title = entry.querySelector('.equipment-item-name [data-action="itemEdit"]')?.textContent || '';
      if (!title) {
        entry.hidden = false;
        continue;
      }
      const isMatch = [title].some(q => rgx.test(SearchFilter.cleanQuery(q)));
      entry.hidden = !isMatch;
    }
  }

  _filterTalents(_event, query, rgx, html) {
    const show = !!query;
    html.classList.add('showAll');
    html.classList.toggle('filterfull', show);
    html.querySelectorAll('.table-header').forEach(el => el.classList.toggle('dsahidden', show));
    html.querySelectorAll('.table-title:not(:first-of-type)').forEach(el => el.classList.toggle('dsahidden', show));

    for (const entry of html.querySelectorAll(".item")) {
      if (!query) {
        entry.hidden = false;
        continue;
      }

      const title = entry.querySelector('.talentName')?.textContent || '';
      if (!title) {
        entry.hidden = false;
        continue;
      }
      const isMatch = [title].some(q => rgx.test(SearchFilter.cleanQuery(q)));
      entry.hidden = !isMatch;
    }
  }

  _filterConditions(_event, query, rgx, html) {
    for (const entry of html.querySelectorAll("li:not(.search)")) {
      if (!query) {
        entry.hidden = false;
        continue;
      }

      const title = _loc(entry.querySelector('button').dataset.tooltip) || '';
      const isMatch = [title].some(q => rgx.test(SearchFilter.cleanQuery(q)));
      entry.hidden = !isMatch;
    }
  }

  async _deleteActiveEffect(id) {
    if (!this.isEditable) return;

    if (this.actor.effects.has(id)) this.actor.deleteEmbeddedDocuments('ActiveEffect', [id]);
  }

  async _itemDeleteDialog(item) {
    const message = _loc('DIALOG.DeleteItemDetail', { item: item.name, });
    const content = await renderTemplate('systems/dsa5/templates/dialog/delete-item-dialog.hbs', { message });
    const proceed = await foundry.applications.api.DialogV2.confirm({
      window: {
        title: 'DIALOG.deleteConfirmation',
      },
      content,
      rejectClose: false,
      modal: true,
    });
    if (proceed) {
      await this._cleverDeleteItem(item.id);
    }
  }

  static _deleteItemAction(ev, target) {
    this._deleteItem(target)
  }

  async _deleteItem(target) {
    if (!this.isEditable) return;

    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    if (!item) return;
    this._itemDeleteDialog(item);
  }

  async _cleverDeleteItem(itemId) {
    const item = this.actor.items.get(itemId);
    const itemsToDelete = [itemId];
    switch (item.type) {
      case 'advantage':
      case 'disadvantage':
        await AdvantageRulesDSA5.vantageRemoved(this.actor, item, false);
        break;
      case 'specialability':
        await SpecialabilityRulesDSA5.abilityRemoved(this.actor, item, false);
        break;
      case 'blessing':
      case 'magictrick':
        await this._updateAPs(-1, {}, { render: false });
        await APTracker.track(this.actor, { type: 'item', item, state: -1 }, -1);
        break;
      case 'ritual':
      case 'ceremony':
      case 'liturgy':
      case 'spell':
        {
          let xpCost = 0;
          for (let i = 0; i <= item.system.talentValue.value; i++) {
            xpCost += DSA5_Utility._calculateAdvCost(i, item.system.StF.value, 0);
          }
          const extensions = this.actor.items.filter((i) => i.type == 'spellextension' && item.type == i.system.category && item.name == i.system.source);
          if (extensions) {
            xpCost += extensions.reduce((a, b) => {
              return a + (Number(b.system.APValue.value) || 0);
            }, 0);
            itemsToDelete.push(...extensions.map((x) => x.id));
          }
          await this._updateAPs(xpCost * -1, {}, { render: false });
          await APTracker.track(this.actor, { type: 'item', item, state: -1 }, xpCost);
        }
        break;
    }
    await this.actor.deleteEmbeddedDocuments('Item', itemsToDelete);
  }

  _getItemId(target) {
    const el = target?.closest?.('[data-item-id]');
    return el?.getAttribute('data-item-id') || target?.dataset?.itemId;
  }

  _getItemDataset(target) {
    return target.closest('.item').dataset;
  }

  async _addMoney(item) {
    const money = duplicate(this.actor.items.filter((i) => i.type == 'money'));
    const moneyItem = money.find((i) => i.name == item.name);

    if (moneyItem) {
      moneyItem.system.quantity.value += item.system.quantity.value;
      await this.actor.updateEmbeddedDocuments('Item', [moneyItem]);
    } else {
      await this.actor.createEmbeddedDocuments('Item', [item]);
    }
  }

  async _updateAPs(APValue, update = {}, options = {}) {
    await this.actor._updateAPs(APValue, update, options);
  }

  async _addVantage(item, typeClass) {
    AdvantageRulesDSA5.needsAdoption(this.actor, item, typeClass);
  }

  async _addSpecialAbility(item, typeClass) {
    SpecialabilityRulesDSA5.needsAdoption(this.actor, item, typeClass);
  }

  _onDragStart(event) {
    const li = event.currentTarget;
    if (event.target.classList.contains('content-link')) return;

    let dragData;

    if (li.dataset.itemId) {
      const item = this.actor.items.get(li.dataset.itemId);
      dragData = item.toDragData();
      if (li.dataset.mod) dragData.mod = li.dataset.mod;
    }

    if (li.dataset.id) {
      const effect = this.actor.effects.get(li.dataset.id);
      dragData = effect.toDragData();
    }

    if (!dragData) return;

    this.constructor.dragHighlightData = dragData;
    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  async _handleSpellExtension(item) {
    const res = this.actor.items.find((i) => i.type == item.type && i.name == item.name);
    if (!res) {
      item = duplicate(item);
      const spell = this.actor.items.find((i) => i.type == item.system.category && i.name == item.system.source);
      if (!spell) {
        ui.notifications.error(
          _loc('DSAError.noSpellForExtension', {
            name: item.system.source,
            category: DSA5_Utility.categoryLocalization(item.system.category),
            extension: item.name,
          }),
        );
      } else {
        if (spell.system.talentValue.value < item.system.talentValue) {
          ui.notifications.error('DSAError.talentValueTooLow', {
            localize: true,
          });
          return;
        }
        const apCost = item.system.APValue.value;
        if (await this.actor.checkEnoughXP(apCost)) {
          await this._updateAPs(apCost, {}, { render: false });
          const createdItem = (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
          await APTracker.track(this.actor, { type: 'item', item: createdItem, state: 1 }, apCost);
        }
      }
    }
  }

  async _addSpellOrLiturgy(item) {
    const res = this.actor.items.find((i) => i.type == item.type && i.name == item.name);
    let apCost;
    item = duplicate(item);
    if (!res) {
      switch (item.type) {
        case 'spell':
        case 'liturgy':
        case 'ceremony':
        case 'ritual':
          apCost = 0;
          for (let i = 0; i <= (Number(item.system.talentValue.value) || 0); i++) {
            apCost += DSA5_Utility._calculateAdvCost(i, item.system.StF.value, 0);
          }
          break;
        case 'blessing':
        case 'magictrick':
          apCost = 1;
          break;
        case 'magicalsign':
          apCost = item.system.APValue.value;
          break;
        default:
          return;
      }
      if (await this.actor.checkEnoughXP(apCost)) {
        await this._updateAPs(apCost, {}, { render: false });
        const createdItem = (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
        if (DSA5.spellRules[createdItem.name]) DSA5.spellRules[createdItem.name](this.actor, createdItem);
        await APTracker.track(this.actor, { type: 'item', item: createdItem, state: 1 }, apCost);
      }
    }
  }

  async _addLoot(item) {
    item = duplicate(item);
    const res = this.actor.items.find((i) => ItemFactory.areEquals(item, i));
    if (!res) {
      if (this.tabGroups.sheet == 'combat' && item.system.worn) item.system.worn.value = true;

      return (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
    } else {
      return (await Itemdsa5.stackItems(res, item, this.actor))[0];
    }
  }

  async _addUniqueItem(item) {
    item = duplicate(item);
    if (!this.actor.items.some((i) => ItemFactory.areEquals(item, i))) return (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
  }

  async _addDemonMarkOrPatron(item) {
    return await this._addUniqueItem(item);
  }

  async _addDisease(item) {
    item.system.duration.resolved = '?';
    return await this._addUniqueItem(item);
  }

  async handleItemCopy(item, typeClass) {
    item.name += ' (Copy)';
    this._manageDragItems(item, typeClass);
  }

  async _addFullPack(item) {
    const docs = await game.packs.get(item.name).getDocuments();
    let newAppls = docs.filter((x) => !this.actor.items.find((y) => y.type == x.type && y.name == x.name));
    if (item.onlyType) newAppls = newAppls.filter((x) => x.type == item.onlyType);

    await this.actor.createEmbeddedDocuments(
      'Item',
      newAppls.map((x) => x.toObject()),
    );
  }

  async creatureDrop(item) {
    CreatureDropDialog.show(this, item);
  }

  async _manageDragItems(item, typeClass) {
    switch (typeClass) {
      case 'disease':
        await this._addDisease(item);
        break;
      case 'meleeweapon':
      case 'rangeweapon':
      case 'equipment':
      case 'ammunition':
      case 'armor':
      case 'poison':
      case 'consumable':
      case 'book':
      case 'plant':
        return await this._addLoot(item);
      case 'disadvantage':
      case 'advantage':
        await this._addVantage(item, typeClass);
        break;
      case 'specialability':
        await this._addSpecialAbility(item, typeClass);
        break;
      case 'money':
        await this._addMoney(item);
        break;
      case 'ritual':
      case 'ceremony':
      case 'blessing':
      case 'magictrick':
      case 'liturgy':
      case 'spell':
      case 'magicalsign':
        await this._addSpellOrLiturgy(item);
        break;
      case 'effectwrapper':
        await this._handleEffectWrapper(item);
        break;
      case 'application':
        await this._handleApplication(item);
        break;
      case 'spellextension':
        await this._handleSpellExtension(item);
        break;
      case 'itempackage':
        await this._addItemPackage(item);
        break;
      case 'creature':
        this.creatureDrop(item);
        break;
      case 'skill':
      case 'imprint':
      case 'essence':
      case 'information':
        await this._addUniqueItem(item);
        break;
      case 'patron':
      case 'demonmark':
        await this._addDemonMarkOrPatron(item);
        break;
      case 'npc':
        ui.notifications.error(
          'DSAError.canNotBeAdded',
          { localize: true, format: {
            item: item.name,
            category: DSA5_Utility.categoryLocalization(item.type, 'Actor'),
          }});
        break
      default:
        ui.notifications.error(
          'DSAError.canNotBeAdded', { localize: true, format: {
            item: item.name,
            category: DSA5_Utility.categoryLocalization(item.type),
          }});
    }
  }

  async _handleEffectWrapper(item) {
    this.actor.createEmbeddedDocuments(
      'ActiveEffect',
      item.effects.map((x) => {
        x.origin = null;
        return x;
      }),
    );
  }

  async _addItemPackage(item) {
    const resolved = await ItempackageData.resolvePackage(item);
    if (resolved.length) {
      await this.actor.createEmbeddedDocuments('Item', resolved);
    } else {
      ui.notifications.error(
        'DSAError.notFound', { localize: true, format: {
          category: 'itempackage',
          name: item.name,
        }});
    }
  }

  async _handleApplication(item) {
    item = duplicate(item);
    const res = this.actor.items.find((i) => i.type == item.type && i.name == item.name && i.system.skill == item.system.skill);
    if (!res) await this.actor.createEmbeddedDocuments('Item', [item]);
  }

  async _handleRemoveSourceOnDrop(item) {
    const sourceActor = item.parent;

    if (sourceActor && sourceActor.isOwner) await sourceActor.deleteEmbeddedDocuments('Item', [item._id]);
  }

  async _onDropItemCreate(itemData) {
    if (itemData instanceof Array) {
      return this.actor.createEmbeddedDocuments('Item', itemData);
    }
    return await this._manageDragItems(itemData, itemData.type);
  }

  async _onDropActor(event, item) {
    if (item.uuid === this.actor.uuid) return false;

    const onCompanionTab = this.tabGroups?.sheet === CompanionHandler.COMPANION_TAB_ID;
    if (onCompanionTab && event.target?.closest?.('.conjuration-favorites-drop')) {
      return CompanionHandler.addConjurationFavorite(this.actor, item);
    }

    return await this._manageDragItems(item, item.type);
  }

  async _onDropActiveEffect(event, effect) {
    if (this.actor.uuid === effect.parent?.uuid) return false;

    const ef = effect.toObject();
    ef.origin = null;
    return ActiveEffect.create(ef, { parent: this.actor });
  }

  async _onDropItem(event, item) {
    if (item.type === 'itempackage') {
      await this._addItemPackage(item);
      return;
    }

    const itemData = item.toObject();
    const data = event.dsaDropData ?? {};
    RuleChaos.obfuscateDropData(itemData, data.tabsinvisible);

    let container_id;
    let mergeItems = false;
    let parentItem = $(event.target).parents('.item');

    if (parentItem && DSA5.equipmentCategories.has(item.type)) {
      const parentId = parentItem.attr('data-item-id');
      if (parentId != item.id) {
        if (parentItem.attr('data-category') == 'bags') {
          container_id = parentId;
        } else {
          parentItem = this.actor.items.get(parentId);
          mergeItems = parentItem && hasProperty(item, 'system.quantity.value') && hasProperty(parentItem, 'system.quantity.value') && ItemFactory.areEquals(item, parentItem);
        }
      }
    }

    const selfTarget = this.actor.uuid === item.parent?.uuid;
    if (selfTarget) {
      if (event.ctrlKey) {
        await this.handleItemCopy(itemData, item.type);
      } else if (mergeItems) {
        await parentItem.update(
          {
            'system.quantity.value': parentItem.system.quantity.value + item.system.quantity.value,
          },
          { render: false },
        );
        await this.actor.deleteEmbeddedDocuments('Item', [item.id]);
      } else if (container_id) {
        const upd = { _id: item.id, 'system.parent_id': container_id };
        if (item.system.worn && item.system.worn.value) upd['system.worn.value'] = false;
        await this.actor.updateEmbeddedDocuments('Item', [upd]);
      } else if (DSA5.equipmentCategories.has(item.type)) {
        await this.actor.updateEmbeddedDocuments('Item', [{ _id: item.id, system: { parent_id: 0 } }]);
      }
      //return this._onSortItem(event, itemData);
    } else {
      const hasPrice = this._itemHasPrice(data);
      if (hasPrice) {
        const price = `${item.type == 'consumable' ? ItemFactory.getSubClass(itemData.type).consumablePrice(itemData) : Number(itemData.system.price.value)}`;

        if (price && !(await DSA5Payment.payMoney(this.actor, price, true, false))) return;

        const amount = Number(itemData.system?.quantity?.value) || 1;
        await MoneyTracker.track(this.actor, { type: 'buy', name: itemData.name, amount }, Number(price) * -1);

        tinyNotification(
          _loc('PAYMENT.pay', {
            actor: this.actor.name,
            amount: price,
          }),
        );
        DSA5SoundEffect.playMoneySound();
      }

      const sourceActor = item.parent;
      const isBagWithContents = sourceActor && this.constructor.isSourceBagWithContents(item, sourceActor);
      if (isBagWithContents) {
        await transferBagWithContents(sourceActor, this.actor, itemData);
      } else if (item.type === 'species') {
        await this._manageDragItems(item, item.type);
      } else {
        await this._onDropItemCreate(itemData);
      }
    }

    if (event.altKey && !selfTarget && DSA5.equipmentCategories.has(item.type)) {
      const sourceActor = item.parent;
      const isBagWithContents = sourceActor && this.constructor.isSourceBagWithContents(item, sourceActor);
      if (!isBagWithContents) await this._handleRemoveSourceOnDrop(item);
    }
  }

  static isSourceBagWithContents(item, sourceActor) {
    return item.type === 'equipment' && getProperty(item, 'system.equipmentType.value') === 'bags' && fetchBagItems(item, sourceActor).length > 0;
  }

  _itemHasPrice(data) {
    return data.pay;
  }
}

class TraditionItemPicker extends DefaultAppv2 {
  constructor(actor, kind = 'magical', optns = {}) {
    const config = TRADITION_ITEM_KINDS[kind];
    super(foundry.utils.mergeObject({ window: { title: config.pickerTitle } }, optns, { inplace: false }));
    this.actor = actor;
    this.kind = kind;
    this.config = config;
  }

  static DEFAULT_OPTIONS = {
    position: {
      width: 440,
    },
    window: {
      title: 'SHEET.selectTraditionartifact',
      resizable: true,
    },
    actions: {
      selectAsTraditionItem: this._selectAsTraditionItem
    }
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/actors/traditionPicker.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.items = this.actor.items
      .filter((x) => ['equipment', 'armor', 'rangeweapon', 'meleeweapon'].includes(x.type))
      .map((x) => {
        const copy = x;
        copy.enchantClass = x.system[this.config.flagField] ? 'rar' : (copy.enchantClass || 'common');
        return copy;
      });
    return data;
  }

  static async _selectAsTraditionItem(ev, target) {
    const item = this.actor.items.get(target.dataset.itemId);
    const enabled = !item.system[this.config.flagField];
    await item.update(buildTraditionItemUpdate(item, this.kind, enabled));
  }
}
