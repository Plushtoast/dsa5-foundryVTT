import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5 from '../system/config-dsa5.js';
import AdvantageRulesDSA5 from '../system/advantage-rules-dsa5.js';
import Itemdsa5 from '../item/item-dsa5.js';
import SpecialabilityRulesDSA5 from '../system/specialability-rules-dsa5.js';
import DSA5ChatListeners from '../system/chat_listeners.js';
import DSA5StatusEffects from '../status/status_effects.js';
import DialogActorConfig from '../dialog/dialog-actorConfig.js';
import Actordsa5 from './actor-dsa5.js';
import { tabSlider, tinyNotification } from '../system/view_helper.js';
import DSA5SoundEffect from '../system/dsa-soundeffect.js';
import RuleChaos from '../system/rule_chaos.js';
import OnUseEffect from '../system/onUseEffects.js';
import { bindImgToCanvasDragStart } from '../hooks/imgTileDrop.js';
import DSA5ChatAutoCompletion from '../system/chat_autocompletion.js';
import Riding from '../system/riding.js';
import ForeignFieldEditor from '../system/foreignFieldEditor.js';
import { AddEffectDialog } from '../system/tokenHotbar2.js';
import { RangeSelectDialog } from '../hooks/itemDrop.js';
import DSA5Payment from '../system/payment.js';
import { TradeOptions } from './trade.js';
import APTracker from '../system/ap-tracker.js';
import { DefaultAppv2 } from './baseapp.js';
import { AppV2Mixin } from './appv2_mixin.js';
const { mergeObject, getProperty, duplicate, hasProperty } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class ActorSheetDsa5 extends AppV2Mixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {
  static propertiesToEnrich = [
    { key: 'enrichedOwnerdescription', path: 'details.notes.ownerdescription' },
    { key: 'enrichedGmdescription', path: 'details.notes.gmdescription' },
    { key: 'enrichedNotes', path: 'details.notes.value' },
    { key: 'enrichedBiography', path: 'details.biography.value' },
  ];

  get title() {
    return this.actor.name;
  }

  async _render(force = false, options = {}) {
    this._saveSearchFields();
    this._saveCollapsed();
    await super._render(force, options);
    this._setCollapsed();
    this._restoreSeachFields();

    let elem = $(this.element);

    const tooltips = {
      '.close': 'SHEET.Close',
      '.configure-sheet': 'SHEET.Configure',
      '.configure-token': 'SHEET.Token',
      '.import': 'SHEET.Import',
    };
    for (let key of Object.keys(tooltips)) {
      elem.find(key).attr('data-tooltip', tooltips[key]);
    }

    if (this.currentFocus) {
      elem
        .find('[data-item-id="' + this.currentFocus + '"] input')
        .trigger('focus')
        .trigger('select');
      this.currentFocus = null;
    }
  }

  static DEFAULT_OPTIONS = {
    position: {
      width: 770,
      height: 740,
    },
    actions: {
      itemCreate: this._onItemCreate,
      playerview: this._togglePlayerview,
      actorConfig: this._configActor,
      library: this._openLibrary,
      locksheet: this._changeAdvanceLock,
      skillSelect: { handler: this._skillSelect, buttons: [0, 2] },
      rollDisease: this._rollDisease,
      conditionEdit: this._conditionEdit,
      chCollapse: this._chCollapse,
      statusCreate: this._statusCreate,
      itemDropdown: this._itemDropdown,
      itemEdit: this._itemEdit,
      chValue: this._chValue,
      chStatus: this._chStatus,
      chRegenerate: this._chRegenerate,
      chWeaponless: this._chWeaponless,
      chFallingDamage: this._chFallingDamage,
      chRollCombat: this._chRollCombat,
      rollAggregatedProbe: { handler: this._handleAggregatedProbe, buttons: [0, 2] },
      showApplication: { handler: this._showApplication, buttons: [0, 2] },
      conditionShow: { handler: this._conditionShow, buttons: [0, 2] },
    },
    ownerActions: {
      schipUpdate: this._schipUdate,
      defenseToggle: this._defenseToggle,
      chargeSpell: { handler: this._chargeSpell, buttons: [0, 2] },
      loadWeapon: { handler: this._loadWeapon, buttons: [0, 2] },
      itemSwapMag: this._itemSwapMag,
      itemToggle: this._itemToggle,
      traditionPayCost: { handler: this._payAeSpecialAbilityCost, buttons: [0, 2] },
      conditionToggle: this._conditionToggle,
      traditionDelete: this._deleteTraditionArtifact,
      selectTraditionartifact: this._selectTraditionArtifact,
      statusAdd: { handler: this._statusAdd, buttons: [0, 2] },
      disableRegeneration: this._disableRegeneration,
      conditionValue: this._conditionValue,
      advanceWrapper: this._advanceWrapper,
      onUseItem: { handler: this._onMacroUseItem, buttons: [0, 2] },
      quantityClick: { handler: this._quantityClick, buttons: [0, 2] },
    },
    form: {
      submitOnChange: true,
    },
    majorButtons: [
      {
        action: 'playerview',
        icon: function() {
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
        icon:  function() {
          return `fas fa-${this.actor.system.sheetLocked.value ? '' : 'un'}lock`; 
        },
        visible: function () {
          return this.actor.system.canAdvance;
        },
      },
    ],
    window: {
      resizable: true,
      contentClasses: ["standard-form"],
      controls: [        
        {
          action: 'actorConfig',
          label: 'SHEET.actorConfig',
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
        { id: 'skills', label: 'skills' },
        { id: 'combat', label: 'Combat' },
        { id: 'magic', label: 'Magic' },
        { id: 'religion', label: 'Religion' },
        { id: 'main', label: 'attributes' },
        { id: 'inventory', label: 'TYPES.Item.equipment' },
        { id: 'status', label: 'status' },
        { id: 'notes', label: 'Notes' },
      ],
      initial: 'skills',
    },
  };

  _saveSearchFields() {
    if (this.form === null) return;

    const html = $(this.form);
    this.searchFields = {
      talentFiltered: html.find('.filterTalents').hasClass('filtered'),
      searchText: html.find('.talentSearch').val(),
      gearSearch: html.find('.gearSearch').val(),
    };
  }

  _restoreSeachFields() {
    if (this.searchFields != undefined) {
      const html = $(this.form);
      if (this.searchFields.talentFiltered) {
        html.find('.filterTalents').addClass('filtered');
        html.find('.allTalents').removeClass('showAll');
      }
      const talentSearchInput = html.find('.talentSearch');
      talentSearchInput.val(this.searchFields.searchText);
      if (this.searchFields.searchText != '') {
        this._filterTalents(talentSearchInput);
      }
      const gearSearchInput = html.find('.gearSearch');
      gearSearchInput.val(this.searchFields.gearSearch);
      if (this.searchFields.searchText != '') {
        this._filterGear(gearSearchInput);
      }
    }
  }

  _configureRenderParts(options) {
    if (this.constructor.LIMITEDPARTS && this.showLimited()) {
      return foundry.utils.deepClone(this.constructor.LIMITEDPARTS);
    }
    return super._configureRenderParts(options);
  }

  _saveCollapsed() {
    if (this.form === null) return;

    const html = $(this.form);
    this.collapsedBoxes = [];
    this.openDetails = [];
    let boxes = html.find('.ch-collapse i');
    for (let box of boxes) {
      this.collapsedBoxes.push($(box).attr('class'));
    }
    for (const detail of html.find('.expandDetails.shown')) {
      this.openDetails.push($(detail).closest('.item').attr('data-item-id'));
    }
  }

  _setCollapsed() {
    const html = $(this.form);
    if (this.collapsedBoxes) {
      let boxes = html.find('.ch-collapse i');
      for (let i = 0; i < boxes.length; i++) {
        $(boxes[i]).attr('class', this.collapsedBoxes[i]);
        if (this.collapsedBoxes[i] && this.collapsedBoxes[i].indexOf('fa-angle-down') != -1) $(boxes[i]).closest('.groupbox').find('.row-section:nth-child(2)').hide();
      }
    }
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!this.actor.system.isMage) delete tabs.magic;
    if (!this.actor.system.isPriest) delete tabs.religion;

    if(this.constructor.LIMITEDPARTS && this.showLimited()) {
      for(let key of Object.keys(tabs)) {
        if(!['main', 'notes'].includes(key)) {
          delete tabs[key];
        }
      }
    }

    return tabs;
  }

  async _prepareContext(_options) {
    const sheetData = await super._prepareContext(_options);
    this.wrapperLocked = false;
    sheetData.systemFields = this.document.system.schema?.fields;
    sheetData.limited = this.actor.limited;
    sheetData.owner = this.actor.isOwner;
    sheetData.prepare = this.actor.prepareSheet({ details: this.openDetails });
    sheetData.isGM = game.user.isGM;
    sheetData.horseSpeeds = Object.keys(Riding.speedKeys).reduce((acc, key) => {
      acc[key] = `RIDING.speeds.${key}`;
      return acc;
    }, {});
    DSA5StatusEffects.prepareActiveEffects(this.actor, sheetData);
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

  static _onItemCreate(event, target) {
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
    this.actor.createEmbeddedDocuments('Item', [data]);
  }

  static _handleAggregatedProbe(ev, target) {
    const itemId = this._getItemId(target);
    let aggregated = this.actor.items.get(itemId).toObject();
    const attr = aggregated.system.talent[`value${target.dataset.which}`];
    let skill = this.actor.items.find((i) => i.name == attr && i.type == 'skill');
    let infoMsg = `<h3 class="center"><b>${game.i18n.localize('TYPES.Item.aggregatedTest')}</b></h3>`;
    if (aggregated.system.usedTestCount.value >= aggregated.system.allowedTestCount.value) {
      infoMsg += `${game.i18n.localize('Aggregated.noMoreAllowed')}`;
      ChatMessage.create(DSA5_Utility.chatDataSetup(infoMsg));
    } else {
      this.actor
        .setupSkill(
          skill,
          {
            moreModifiers: [
              {
                name: game.i18n.localize('failedTests'),
                value: -1 * aggregated.system.previousFailedTests.value,
                selected: true,
              },
              {
                name: game.i18n.localize('Modifier'),
                value: aggregated.system.baseModifier,
                selected: true,
              },
            ],
          },
          this.getTokenId(),
        )
        .then((setupData) => {
          this.actor.basicTest(setupData).then((res) => {
            if (res.result.successLevel > 0) {
              aggregated.system.cummulatedQS.value = res.result.qualityStep + aggregated.system.cummulatedQS.value;
              aggregated.system.cummulatedQS.value = Math.min(10, aggregated.system.cummulatedQS.value);
            } else {
              aggregated.system.previousFailedTests.value += 1;
            }
            aggregated.system.usedTestCount.value += 1;
            this.actor.updateEmbeddedDocuments('Item', [aggregated]).then(() => {
              const updated = this.actor.items.get(itemId);
              updated.postItem();

              if (aggregated.system.cummulatedQS.value >= 10) {
                updated.sheet.postFinishedItem();
              }
            });
          });
        });
    }
  }

  async consumeItem(item) {
    const title = game.i18n.localize('SHEET.ConsumeItem') + ': ' + item.name;
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
    const value = Number(item.system.talentValue.value);
    const category = this.actor.system.isPet || this.actor.system.isFamiliar ? 'C' : item.system.StF.value;
    const cost = DSA5_Utility._calculateAdvCost(value, category);
    if ((await this._checkEnoughXP(cost)) && this.actor._checkMaximumItemAdvancement(item, value + 1)?.result) {
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.talentValue.value': value + 1 }]);
      await this._updateAPs(cost);
      await APTracker.track(this.actor, { type: 'item', item, previous: value, next: value + 1 }, cost);
      return true;
    }
  }

  async _refundItemAdvance(itemId) {
    const item = this.actor.items.get(itemId);
    const minValue = item.type == 'combatskill' ? 6 : 0;
    const value = Number(item.system.talentValue.value);
    if (value > minValue) {
      const category = this.actor.system.isPet || this.actor.system.isFamiliar ? 'C' : item.system.StF.value;
      const cost = DSA5_Utility._calculateAdvCost(value, category, 0) * -1;
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.talentValue.value': value - 1 }]);
      await this._updateAPs(cost);
      await APTracker.track(this.actor, { type: 'item', item, previous: value, next: value - 1 }, cost);
      return true;
    }
  }

  _checkMaximumPointAdvancement(attr, newValue) {
    let result = false;
    switch (attr) {
      case 'wounds':
        result = newValue <= this.actor.system.characteristics.ko.value;
        break;
      case 'astralenergy':
        result =
          newValue <=
          (this.actor.system.characteristics[this.actor.system.guidevalue.magical] == undefined
            ? 0
            : this.actor.system.characteristics[this.actor.system.guidevalue.magical].value * this.actor.system.energyfactor.magical);
        break;
      case 'karmaenergy':
        result =
          newValue <=
          (this.actor.system.characteristics[this.actor.system.guidevalue.clerical] == undefined
            ? 0
            : this.actor.system.characteristics[this.actor.system.guidevalue.clerical].value * this.actor.system.energyfactor.clerical);
        break;
    }
    if (!result)
      ui.notifications.error('DSAError.AdvanceMaximumReached', {
        localize: true,
      });

    return result;
  }

  static async _openLibrary(ev, target) {
    game.dsa5.itemLibrary.render(true);
  }

  static async _configActor(ev, target) {
    new DialogActorConfig(this.actor, {}).render(true);
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
    const target = $(trg).find('i');
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

  showLimited() {
    return (!game.user.isGM && this.actor.limited) || this.playerViewEnabled();
  }

  getTokenId() {
    return this.token?.id;
  }

  static async _rollDisease(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    const SKModifier = this.actor.system.status.soulpower.max * -1;
    const ZKModifier = this.actor.system.status.toughness.max * -1;
    const setupData = await item.setupEffect(undefined, { rollMode: 'gmroll', manualResistance: { SKModifier, ZKModifier } });
    const result = await item.itemTest(setupData);
    await this.actor.updateEmbeddedDocuments('Item', [{ _id: item.id, 'system.duration.resolved': result.result.duration }]);
  }

  async swapWeaponHand(ev, item = undefined) {
    const itemId = item?.id || this._getItemId(ev.currentTarget);
    item = item || this.actor.items.get(itemId);

    if (!['Daggers', 'Fencing Weapons'].includes(game.i18n.localize(`LocalizedCTs.${item.system.combatskill.value}`))) {
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.worn.wrongGrip': !item.system.worn.wrongGrip }]);
    }
  }

  static async _skillSelect(ev, target) {
    const itemId = this._getItemId(target);
    let skill = this.actor.items.get(itemId);

    if (ev.button == 0) {
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
    let menu = $(target).closest('.statusEffectMenu').find('ul');
    menu.fadeIn('fast', () => {
      menu.find('input').trigger('focus');
    });
  }

  static _itemDropdown(ev, target) {
    $(target).closest('.item').find('.expandDetails:first').toggleClass('shown');
  }

  static _conditionShow(ev, target) {
    const id = target.dataset.id;
    const statusEffects = $(target).closest('.statusEffect')[0];
    const descriptor = statusEffects.dataset.descriptor;
    if (ev.button == 0) {
      const origin = statusEffects.dataset.origin;
      if (origin) {
        fromUuid(origin).then((document) => document.sheet.render(true));
      } else {
        let effect;
        let text;
        if (descriptor) {
          effect = CONFIG.statusEffects.find((x) => x.id == descriptor);
          text = effect.description;
        } else {
          //search temporary effects
          effect = this.actor.effects.find((x) => x.id == id);
          if (effect) text = effect.flags.dsa5.description;
        }

        if (effect) {
          text = `<div style="padding:5px;"><b><a class="chat-condition chatButton" data-id="${effect.id}"><img src="${effect.img}"/>${game.i18n.localize(effect.name)}</a></b>: ${game.i18n.localize(text)}</div>`;
        }

        const elem = $(target).closest('.groupbox').find('.effectDescription');
        elem.fadeOut('fast', () => {
          elem.html($(text)).fadeIn('fast');
        });
      }
    } else if (ev.button == 2 && !target.dataset.locked) {
      this._deleteActiveEffect(id);
    }
  }

  static _itemEdit(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);
    item.sheet.render(true);
  }

  static _showApplication(ev, target) {
    if (ev.button == 2) {
      this._deleteItem(ev);
    } else {
      const itemId = this._getItemId(target);
      const item = this.actor.items.get(itemId);
      item.sheet.render(true);
    }
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

  static async _chRollCombat(ev, target) {
    const dataset = this._getItemDataset(target);
    const mode = target.dataset.mode;
    const item = Actordsa5.buildSubweapon(this.actor.items.get(dataset.itemId), dataset.subweapon);
    const setupData = await this.actor.setupWeapon(item, mode, {}, this.getTokenId());
    this.actor.basicTest(setupData);
  }

  static _schipUdate(ev, target) {
    let val = Number(target.dataset.val);
    if (val == 1 && $(this.form).find('.fullSchip').length == 1) val = 0;

    this.actor.update({ 'system.status.fatePoints.value': val });
  }

  static _defenseToggle(ev, target) {
    this.actor.update({ 'system.config.defense': !this.actor.system.config.defense })
  }

  static async _chargeSpell(ev, target) {
      const itemId = this._getItemId(target);
      const item = this.actor.items.get(itemId);
      const lz = Number(item.system.castingTime.modified);
      let update = {
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
    } else if (ev.button == 2) update['system.reloadTime.progress'] = 0;

    await this.actor.updateEmbeddedDocuments('Item', [update]);
  }

  static async _itemSwapMag(ev, target) {
    await this.actor.swapMag(this._getItemId(target));
  }

  static _itemToggle(ev, target) {
    const itemId = this._getItemId(target);
    const item = this.actor.items.get(itemId);

    switch (item.type) {
      case 'armor':
      case 'rangeweapon':
      case 'meleeweapon':
      case 'equipment':
        this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.worn.value': !item.system.worn.value }]);
        DSA5SoundEffect.playEquipmentWearStatusChange(item);
        break;
    }
  }

  static async _conditionToggle(ev, target) {
    let condKey = $(target).closest('.statusEffect').attr('data-id');
    let ef = this.actor.effects.get(condKey);
    await ef.update({ disabled: !ef.disabled });
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
    let condKey = $(target).closest('.statusEffect').attr('data-descriptor');
    if (ev.button == 0) await this.actor.addCondition(condKey, 1, false, false);
    else if (ev.button == 2) await this.actor.removeCondition(condKey, 1, false);
  }

  static _advanceWrapper(ev, target) {
    this.advanceWrapper(target, target.dataset.fct, target.dataset.attr);
  }

  static _quantityClick(ev, target) {
    const itemId = this._getItemId(target);
    let item = this.actor.items.get(itemId);
    const update = { _id: itemId, system: { quantity: { value: item.system.quantity.value}} };
    RuleChaos.increment(ev, update, 'system.quantity.value', 0);
    this.actor.updateEmbeddedDocuments('Item', [update]);
  }


  async _onRender(context, options) {
    await super._onRender((context, options));

    const html = $(this.element);
    const posthand = (ev) => {
      this.actor.items.get(this._getItemId(ev.currentTarget)).postItem();
    };

    tabSlider(html);

    html.find('.statusEffectMenu ul').on('mouseleave', (ev) => $(ev.currentTarget).fadeOut());

    html.find('.item-post').on('click', (ev) => posthand(ev));

    html.on('click', '.chat-condition', (ev) => DSA5ChatListeners.postStatus(ev.currentTarget.dataset.id));
    html.find('.money-change, .skill-advances').on('focusin', (ev) => {
      this.currentFocus = $(ev.currentTarget).closest('[data-item-id]').attr('data-item-id');
    });

    const deletehand = (ev) => this._deleteItem(ev);

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
      let e = ev.toElement || ev.relatedTarget;
      if (!e || e.parentNode == this || e == this) return;

      ev.currentTarget.querySelectorAll('.hovermenu').forEach((e) => e.remove());
    });

    const uuid = this.actor.uuid;
    html.find('.actorDrag').each(function (i, cond) {
      cond.setAttribute('draggable', true);
      cond.addEventListener('dragstart', (ev) => {
        let dataTransfer = {
          type: 'Actor',
          uuid,
        };
        ev.dataTransfer.setData('text/plain', JSON.stringify(dataTransfer));
      });
    });

    html.find('.filterTalents').on('click', (ev) => {
      $(ev.currentTarget).closest('.scrollable').find('.allTalents').toggleClass('showAll');
      $(ev.currentTarget).toggleClass('filtered');
    });

    html.find('.charimg').on('mousedown', (ev) => {
      if (ev.button == 2) DSA5_Utility.showArtwork(this.actor, true);
    });

    DSA5ChatAutoCompletion.bindRollCommands(html);

    let filterTalents = (ev) => this._filterTalents($(ev.currentTarget));
    let talSearch = html.find('.talentSearch');
    talSearch.on('keyup', (event) => this._filterTalents($(event.currentTarget)));
    talSearch[0] && talSearch[0].addEventListener('search', filterTalents, false);

    let filterConditions = (ev) => this._filterConditions($(ev.currentTarget));
    let condSearch = html.find('.conditionSearch');
    condSearch.on('keyup', (event) => this._filterConditions($(event.currentTarget)));
    condSearch[0] && condSearch[0].addEventListener('search', filterConditions, false);

    let filterGear = (ev) => this._filterGear($(ev.currentTarget));
    let gearSearch = html.find('.gearSearch');
    gearSearch.on('keyup', (event) => this._filterGear($(event.currentTarget)));
    gearSearch[0] && gearSearch[0].addEventListener('search', filterGear, false);

    bindImgToCanvasDragStart(html, 'img.charimg');

    Riding.onRender(html, this.actor);

    this._bindKeepFieldsEnabled(html);

    if (!this.isEditable) return;

    new foundry.applications.ui.ContextMenu(this.element, '.item .withContext', [], {
      onOpen: this._onItemContext.bind(this),
      jQuery: false,
    });
    new foundry.applications.ui.ContextMenu(this.element, '.combat-weapon', [], {
      onOpen: this._onWeaponItemContext.bind(this),
      jQuery: false,
    });

    html.find('.startCharacterBuilder').on('click', () => this.actor.setFlag('core', 'sheetClass', 'dsa5.DSACharBuilder'));

    html.find('.swapWeaponHand').on('click', (ev) => this.swapWeaponHand(ev));

    html.find('.ammo-selector').on('change', async (ev) => {
      ev.preventDefault();
      const itemId = this._getItemId(ev.currentTarget);
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.currentAmmo.value': $(ev.currentTarget).val() }]);
    });

    html.find('.money-change').on('change', async (ev) => {
      const itemId = this._getItemId(ev.currentTarget);
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.quantity.value': Number(ev.target.value) }]);
    });
    html.find('.skill-advances').on('change', async (ev) => {
      const itemId = this._getItemId(ev.currentTarget);
      await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.talentValue.value': Number(ev.target.value) }]);
    });
    
    html.find('.item-delete').on('click', (ev) => this._deleteItem(ev))

    //todo we could remove this if every .item is replaced with .draggable (parent has draggable attachment listener)
    new foundry.applications.ux.DragDrop.implementation({
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

  _onItemContext(target) {
    const item = this.actor.items.get($(target).closest('.item').attr('data-item-id'));

    if (!item) return;
    ui.context.menuItems = this._getItemContextOptions(item);
    Hooks.call('dsa5.getItemContextOptions', item, ui.context.menuItems);
  }

  _onWeaponItemContext(target) {
    const item = this.actor.items.get(target.dataset.itemId);

    if (!item || item?.type != 'meleeweapon') return;
    ui.context.menuItems = this._getWeaponItemContextOptions(item);
    Hooks.call('dsa5.getWeaponItemContextOptions', item, ui.context.menuItems);
  }

  _getWeaponItemContextOptions(item) {
    const options = [];

    if (item.type == 'meleeweapon') {
      const localizedCT = game.i18n.localize(`LocalizedCTs.${item.system.combatskill.value}`);
      if (!['Daggers', 'Fencing Weapons'].includes(localizedCT)) {
        const weaponYield = item.system.getGripInfo().wrongGripLabel;

        options.push({
          name: weaponYield,
          icon: "<i class='fas fa-comment fa-hand'></i>",
          callback: (ev) => this.swapWeaponHand(ev, item),
        });
      }
      const hasWeaponThrow =
        ['Daggers', 'Fencing Weapons', 'Impact Weapons', 'Swords', 'Polearms'].includes(localizedCT) && SpecialabilityRulesDSA5.hasAbility(this.actor, 'LocalizedIDs.weaponThrow');
      const throwLabel = `${game.i18n.localize('TYPES.Item.rangeweapon')} ${game.i18n.localize('CHARAbbrev.AT')} -${hasWeaponThrow ? 4 : 8} ${game.i18n.localize('CHARAbbrev.RW')} ${DSA5.meleeAsRangeReach[localizedCT]}`;
      options.push(
        {
          name: throwLabel,
          icon: "<i class='fas fa-trowel'></i>",
          callback: () => this.actor.throwMelee(item, this.getTokenId()),
        },
        {
          name: 'SHEET.EquipItem',
          icon: "<i class='fas fa-shield-alt fa-fw'></i>",
          callback: () => item.update({ 'system.worn.value': !item.system.worn.value }),
        },
      );
    } else if (item.type == 'rangeweapon') {
      options.push({
        name: 'SHEET.EquipItem',
        icon: "<i class='fas fa-shield-alt fa-fw'></i>",
        callback: () => item.update({ 'system.worn.value': !item.system.worn.value }),
      });
    }

    options.push({
      name: 'SHEET.PostItem',
      icon: "<i class='fas fa-comment fa-fw'></i>",
      callback: () => item.postItem(),
    });

    return options;
  }

  _getItemContextOptions(item) {
    const options = [
      {
        name: 'SHEET.EditItem',
        icon: "<i class='fas fa-edit fa-fw'></i>",
        callback: () => item.sheet.render(true),
      },
      {
        name: 'SHEET.PostItem',
        icon: "<i class='fas fa-comment fa-fw'></i>",
        callback: () => item.postItem(),
      },
      {
        name: 'SHEET.DuplicateItem',
        icon: "<i class='fas fa-copy fa-fw'></i>",
        callback: () => this.handleItemCopy(item.toObject(), item.type),
      },
      {
        name: 'SHEET.ConsumeItem',
        icon: "<i class='fas fa-wine-bottle fa-fw'></i>",
        condition: () => item.type == 'consumable',
        callback: () => this.consumeItem(item),
      },
      {
        name: 'SHEET.onUseEffect',
        icon: "<i class='fas fa-dice-six fa-fw'></i>",
        condition: () => getProperty(item, 'flags.dsa5.onUseEffect'),
        callback: () => new OnUseEffect(item).executeOnUseEffect(),
      },
      {
        name: 'SHEET.DeleteItem',
        icon: "<i class='fas fa-trash fa-fw'></i>",
        callback: () => this._itemDeleteDialog(item),
      },
      {
        name: 'MERCHANT.exchange',
        icon: "<i class='fas fa-coins'></i>",
        condition: () => DSA5.equipmentCategories.has(item.type),
        callback: () => this._startTrade(item),
      },
      {
        name: 'SHEET.changeMoney',
        icon: "<i class='fas fa-coins'></i>",
        condition: () => item.type == 'money',
        callback: () => DSA5Payment._replaceMoney(this.actor),
      },
    ];

    if (hasProperty(item, 'system.worn.wearable') || ['meleeweapon', 'rangeweapon', 'armor'].includes(item.type)) {
      options.push({
        name: 'SHEET.EquipItem',
        icon: "<i class='fas fa-shield-alt fa-fw'></i>",
        callback: () => item.update({ 'system.worn.value': !item.system.worn.value }),
      });
    }
    if (Number(getProperty(item, 'system.quantity.value')) > 1) {
      options.push({
        name: 'SHEET.SplitItem',
        icon: "<i class='fas fa-arrows-split-up-and-left fa-fw'></i>",
        callback: () => this._splitItem(item),
      });
    }

    return options;
  }

  async _startTrade(item) {
    new TradeOptions(this.actor).render(true);
  }

  _splitItem(item) {
    const callback = async (count) => {
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
      game.i18n.format('MERCHANT.splitItem', { name: item.name }),
      item.system.quantity.value - 1,
      callback,
      1,
      item.system.quantity.value - 1,
    );
  }

  _bindKeepFieldsEnabled(html) {
    if (!this.isEditable) {
      const keepFields = html.find('.keepFieldsEnabled');
      for (let k of keepFields) {
        const attr = k.dataset.attr;
        const name = k.dataset.name;
        $(k).find('.editor').append(`<a data-attr="${attr}" data-name="${name}" class="editor-edit"><i class="fas fa-edit"></i></a>`);
        $(k)
          .find('.editor-edit')
          .on('click', (ev) => this._openKeepFieldEditpage(ev));
      }
    }
  }

  _openKeepFieldEditpage(ev) {
    const attr = ev.currentTarget.dataset.attr;
    const name = ev.currentTarget.dataset.name;
    const editor = new ForeignFieldEditor(this.actor.id, attr, name);
    editor.render(true);
  }

  static async _onMacroUseItem(ev, target) {
    const item = this.actor.items.get(this._getItemId(target));
    const onUse = new OnUseEffect(item);
    await onUse.executeOnUseEffect();
  }

 static async _payAeSpecialAbilityCost(ev, target) {
    const item = this.actor.items.get(this._getItemId(target));

    const cost = Number(getProperty(item, 'system.AsPCost'));
    const paid = this.actor.applyMana(cost, 'AsP');

    if (!paid) return;

    const msg = game.i18n.format('CHATNOTIFICATION.paysTraditionAbility', {
      name: this.actor.name,
      ability: item.name,
      cost,
    });
    if (ev.button == 2) {
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg, 'gmroll'));
    } else {
      ChatMessage.create(DSA5_Utility.chatDataSetup(msg));
    }
  }

  _filterGear(tar) {
    if (tar.val() != undefined) {
      let val = tar.val().toLowerCase().trim();
      let gear = $(this.element).find('.inventory .item');
      gear.removeClass('filterHide');
      gear
        .filter(function () {
          return $(this).find('a[data-action="itemEdit"]').text().toLowerCase().trim().indexOf(val) == -1;
        })
        .addClass('filterHide');
    }
  }

  static async _selectTraditionartifact(ev, target) {
    if (!this.isEditable) return;

    new TraditionArtifactpicker(this.actor).render(true);
  }

  static _deleteTraditionArtifact(ev, target) {
    if (!this.isEditable) return;

    const item = this.actor.items.get(this._getItemId(target));
    item.update({ 'system.isArtifact': false });
  }

  //TODO replace this with foundry SearchFilter
  _filterTalents(tar) {
    if (tar.val() != undefined) {
      let val = tar.val().toLowerCase().trim();
      let talents = $(this.form).parent().find('.allTalents');
      talents.find('.item, .table-header, .table-title').removeClass('filterHide');
      talents
        .addClass('showAll')
        .find('.item')
        .filter(function () {
          return $(this).find('.talentName').text().toLowerCase().trim().indexOf(val) == -1;
        })
        .addClass('filterHide');
      if (val.length > 0) {
        talents.find('.table-header, .table-title:not(:eq(0))').addClass('filterHide');
        talents.addClass('filterfull');
      } else talents.removeClass('filterfull');
    }
  }

  _filterConditions(tar) {
    if (tar.val() != undefined) {
      const val = tar.val().toLowerCase().trim();
      const conditions = $(this.form).find('.statusEffectMenu li:not(.search)');
      conditions.removeClass('filterHide');
      conditions
        .filter(function () {
          return game.i18n.localize($(this).find('button').attr('data-tooltip')).toLowerCase().trim().indexOf(val) == -1;
        })
        .addClass('filterHide');
    }
  }

  async _deleteActiveEffect(id) {
    if (!this.isEditable) return;

    const item = this.actor.effects.get(id);

    if (item) this.actor.deleteEmbeddedDocuments('ActiveEffect', [item.id]);
  }

  async _itemDeleteDialog(item) {
    const message = game.i18n.format('DIALOG.DeleteItemDetail', {
      item: item.name,
    });
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

  async _deleteItem(ev) {
    if (!this.isEditable) return;

    const itemId = this._getItemId(ev.currentTarget);
    let item = this.actor.items.get(itemId);
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
    return $(target).closest('.item').attr('data-item-id');
  }

  _getItemDataset(target) {
    return $(target).closest('.item')[0].dataset;
  }

  async _addMoney(item) {
    let money = duplicate(this.actor.items.filter((i) => i.type == 'money'));
    let moneyItem = money.find((i) => i.name == item.name);

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

    event.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  async _handleSpellExtension(item) {
    let res = this.actor.items.find((i) => i.type == item.type && i.name == item.name);
    if (!res) {
      item = duplicate(item);
      let spell = this.actor.items.find((i) => i.type == item.system.category && i.name == item.system.source);
      if (!spell) {
        ui.notifications.error(
          game.i18n.format('DSAError.noSpellForExtension', {
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
        let apCost = item.system.APValue.value;
        if (await this.actor.checkEnoughXP(apCost)) {
          await this._updateAPs(apCost, {}, { render: false });
          const createdItem = (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
          await APTracker.track(this.actor, { type: 'item', item: createdItem, state: 1 }, apCost);
        }
      }
    }
  }

  async _addSpellOrLiturgy(item) {
    let res = this.actor.items.find((i) => i.type == item.type && i.name == item.name);
    let apCost;
    item = duplicate(item);
    if (!res) {
      switch (item.type) {
        case 'spell':
        case 'liturgy':
        case 'ceremony':
        case 'ritual':
          apCost = DSA5_Utility._calculateAdvCost(0, item.system.StF.value, 0);
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
    let res = this.actor.items.find((i) => Itemdsa5.areEquals(item, i));
    if (!res) {
      if (this._tabs[0].active == 'combat' && item.system.worn) item.system.worn.value = true;

      return (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
    } else {
      return (await Itemdsa5.stackItems(res, item, this.actor))[0];
    }
  }

  async _addUniqueItem(item) {
    item = duplicate(item);
    if (!this.actor.items.some((i) => Itemdsa5.areEquals(item, i))) return (await this.actor.createEmbeddedDocuments('Item', [item]))[0];
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
    let docs = await game.packs.get(item.name).getDocuments();
    let newAppls = docs.filter((x) => !this.actor.items.find((y) => y.type == x.type && y.name == x.name));
    if (item.onlyType) newAppls = newAppls.filter((x) => x.type == item.onlyType);

    await this.actor.createEmbeddedDocuments(
      'Item',
      newAppls.map((x) => x.toObject()),
    );
  }

  async creatureDrop(item) {
    if (game.dsa5.config.hooks.shapeshift) {
      new foundry.applications.api.DialogV2({
        window: {
          title: game.i18n.localize('DIALOG.ItemRequiresAdoption') + ': ' + item.name,
        },
        content: `<p>${game.i18n.localize('DIALOG.whichFunction') + ': ' + item.name}</p>`,
        buttons: [
          {
            action: 'shapeshift',
            icon: 'fas fa-paw',
            label: 'CONDITION.shapeshift',
            callback: () => {
              const shapeshift = game.dsa5.config.hooks.shapeshift;
              shapeshift.setShapeshift(this.actor, item);
              shapeshift.render(true);
            },
          },
          {
            action: 'horse',
            icon: 'fas fa-horse',
            label: 'RIDING.horse',
            default: true,
            callback: () => {
              Riding.setHorse(this.actor, item, this.token);
            },
          },
        ],
      }).render(true);
    } else {
      Riding.setHorse(this.actor, item, this.token);
    }
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
      default:
        ui.notifications.error(
          game.i18n.format('DSAError.canNotBeAdded', {
            item: item.name,
            category: DSA5_Utility.categoryLocalization(item.type),
          }),
        );
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

  async _handleLookup(item) {
    let lookup = await DSA5_Utility.findAnyItem(item.items);
    if (lookup) {
      for (let thing of item.items) {
        if (thing.count) {
          let elem = lookup.find((x) => x.name == thing.name && x.type == thing.type);
          if (elem) {
            elem.system.quantity.value = thing.count;
            if (thing.qs && thing.type == 'consumable') elem.system.QL = thing.qs;
          } else {
            ui.notifications.warn(
              game.i18n.format('DSAError.notFound', {
                category: thing.type,
                name: thing.name,
              }),
            );
          }
        }
      }
      //we should improve that so it stacks items
      await this.actor.createEmbeddedDocuments('Item', lookup);
      //for (let thing of lookup) {
      //    await this._manageDragItems(thing, thing.type)
      //}
    } else {
      ui.notifications.error(
        game.i18n.format('DSAError.notFound', {
          category: thing.type,
          name: thing.name,
        }),
      );
    }
  }

  async _handleApplication(item) {
    item = duplicate(item);
    let res = this.actor.items.find((i) => i.type == item.type && i.name == item.name);
    if (!res) await this.actor.createEmbeddedDocuments('Item', [item]);
  }

  async _handleRemoveSourceOnDrop(item) {
    let sourceActor = item.parent;

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

    return await this._manageDragItems(item, item.type);
  }

  async _onDropActiveEffect(event, effect) {
    if (this.actor.uuid === effect.parent?.uuid) return false;

    const ef = effect.toObject();
    ef.origin = null;
    return ActiveEffect.create(ef, { parent: this.actor });
  }

  async _onDropItem(event, item) {
    const itemData = item.toObject();
    const data = JSON.parse(event.dataTransfer.getData('text/plain'));
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
          mergeItems = parentItem && hasProperty(item, 'system.quantity.value') && hasProperty(parentItem, 'system.quantity.value') && Itemdsa5.areEquals(item, parentItem);
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
        const price = `${item.type == 'consumable' ? Itemdsa5.getSubClass(itemData.type).consumablePrice(itemData) : Number(itemData.system.price.value)}`;

        if (price && !(await DSA5Payment.payMoney(this.actor, price, true, false))) return;

        tinyNotification(
          game.i18n.format('PAYMENT.pay', {
            actor: this.actor.name,
            amount: price,
          }),
        );
        DSA5SoundEffect.playMoneySound();
      }
      await this._onDropItemCreate(itemData);
    }

    if (event.altKey && !selfTarget && DSA5.equipmentCategories.has(item.type)) await this._handleRemoveSourceOnDrop(item);
  }

  _itemHasPrice(data) {
    return data.pay;
  }
}

class TraditionArtifactpicker extends DefaultAppv2 {
  constructor(actor, optns = {}) {
    super(optns);
    this.actor = actor;
  }

  static DEFAULT_OPTIONS = {
    position: {
      width: 440,
    },
    window: {
      title: 'SHEET.selectTraditionartifact',
      resizable: true,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/actors/traditionPicker.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    data.items = this.actor.items.filter((x) => ['equipment', 'armor', 'rangeweapon', 'meleeweapon'].includes(x.type));
    return data;
  }

  async _onRender(context, options) {
    await super._onRender((context, options));
    const html = $(this.element);
    html.find('.slot').on('click', async (ev) => {
      const item = this.actor.items.get(ev.currentTarget.dataset.itemId);
      await item.update({ 'system.isArtifact': !item.system.isArtifact });
    });
  }
}
