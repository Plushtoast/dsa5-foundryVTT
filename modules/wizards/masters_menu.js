import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import PaymentRequestService from '../system/queries/payment-requests.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import AdvantageRulesDSA5 from '../system/rules/advantage-rules-dsa5.js';
import { slist, tabSlider } from '../system/helpers/view_helper.js';
import PlayerMenu from './player_menu.js';
import DialogShared from '../dialog/dialog-shared.js';
import ActorPickerDialog from '../dialog/actor-picker-dialog.js';
import ChatCommandService from '../system/sidebar/chat_command_service.js';
import RollRequestService from '../system/queries/roll-request.js';
import GroupCheck from '../system/rolls/group-check.js';
import GroupActorSheet from '../actor/group-sheet.js';
import { DefaultAppv2 } from '../actor/baseapp.js';
import { FormAppv2 } from '../actor/formapp.js';
import { DragMixin } from '../actor/mixins/drag_mixin.js';
import { DICE_CONSTANTS } from '../config/dice-constants.js';

const { hasProperty, expandObject, mergeObject, duplicate, randomID } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class MastersMenu {
  static registerButtons() {
    game.dsa5.apps.playerMenu = new PlayerMenu();
    CONFIG.Canvas.layers.dsamenu = {
      layerClass: DSAMenuLayer,
      group: 'interface',
    };
  }
}

class DSAMenuLayer extends foundry.canvas.layers.InteractionLayer {
  static get layerOptions() {
    return foundry.utils.mergeObject(super.layerOptions, {
      name: 'dsamenu',
      canDragCreate: false,
      zIndex: 666,
    });
  }

  selectObjects(optns) {
    canvas.tokens.selectObjects(optns);
  }

  static prepareSceneControls() {
    const tools = {
      select: {
        name: 'select',
        title: 'CONTROLS.BasicSelect',
        icon: 'fa fa-expand',
        button: true,
      },
      JournalBrowser: {
        name: 'JournalBrowser',
        title: 'Book.Wizard',
        icon: 'fa fa-book',
        button: true,
        onChange: (a, b, c, d) => {
          DSA5_Utility.renderToggle(game.dsa5.apps.journalBrowser);
        },
      },
      Library: {
        name: 'Library',
        title: 'SHEET.Library',
        icon: 'fas fa-university',
        button: true,
        onChange: () => {
          DSA5_Utility.renderToggle(game.dsa5.itemLibrary);
        },
      },
      PlayerMenu: {
        name: 'PlayerMenu',
        title: 'PLAYER.title',
        icon: 'fas fa-dsa5-player',
        button: true,
        onChange: () => {
          DSA5_Utility.renderToggle(game.dsa5.apps.playerMenu);
        },
      },
    }
    if (game.settings.get('dsa5', 'masterCanvasControls')) {
      if (game.dsa5.apps.tokenHotbar) {
        const callbacks = game.dsa5.apps.tokenHotbar.callbackFunctions || {};
        for (const entry of game.dsa5.apps.tokenHotbar._gmEntries()) {
          if (!(entry.id in callbacks)) continue;
          tools[entry.id] = {
            name: entry.id,
            title: entry.name,
            icon: `fa-dsa5 fa-dsa5-${entry.id}`,
            button: true,
            onChange: () => callbacks[entry.id](),
          };
        }
      }
    }
    if (game.user.isGM) {
      if (!game.dsa5.apps.gameMasterMenu) game.dsa5.apps.gameMasterMenu = new GameMasterMenu();
      tools.mastersMenu = {
        name: 'mastersMenu',
        title: 'gmMenu',
        icon: 'fa fa-dsa5',
        button: true,
        onChange: () => {
          DSA5_Utility.renderToggle(game.dsa5.apps.gameMasterMenu);
        },
      };
    }
    return {
      name: 'gmMenu',
      title: 'dsamenu',
      icon: 'fas fa-dsa5',
      layer: 'dsamenu',
      activeTool: "select",
      tools,
    };
  }
}

class GameMasterMenu extends DragMixin(DefaultAppv2) {
  constructor(app) {
    super(app);
    this.heros = [];
    this.lastSkill = `${_loc('LocalizedIDs.perception')}|skill`;
    this.randomCreation = [];
    this._darknessAnimationIntervalId = null;

    if (game.user.isGM) {
      Hooks.on('updateActor', async (document, data, options, userId) => {
        if (!this.rendered) return;

        const properties = ['system.status.fatePoints', 'system.status.wounds', 'system.status.karmaenergy', 'system.status.astralenergy'];
        if (
          this.heros.some((x) => x.id == document.id) &&
          properties.reduce((a, b) => {
            return a || hasProperty(data, b);
          }, false)
        ) {
          this.render();
        }
      });
      Hooks.on('updateScene', (document, data, options) => this._onSceneDarknessUpdate(document, data, options));
      Hooks.on('canvasInit', () => {
        if (!this.rendered) return;

        this.render();
      });
    }
  }

  _canRender(options) {
    if (!game.user.isGM) {
      ui.notifications.error('DSAError.onlyGMallowed', { localize: true });
      return false;
    }
  }

  getSelectedActors() {
    const selected = game.settings.get('dsa5', 'selectedActors');
    const tracked = game.settings.get('dsa5', 'trackedActors');
    const final = {};
    for (const key of Object.keys(selected)) {
      if (tracked.actors?.includes(key)) final[key] = selected[key];
    }
    return final;
  }

  static async _heroschip(ev, target) {
    ev.stopPropagation();
    ev.preventDefault();
    const actor = game.actors.get(this.getID(target));
    if (!actor) return;
    const path = target.dataset.path || 'system.status.fatePoints.value';
    await actor.setSchipFromPip(path, target.dataset.val);
  }

  static async _groupCheck(ev, target) {
    ev.stopPropagation();
    this.doGroupCheck();
  }

  static async _changeGroupSchipCount(ev, target) {
    await this.changeGroupSchipCount(Number(target.dataset.value));
  }

  static async _requestRoll(ev, target) {
    ev.stopPropagation();
    this.rollRequest();
  }

  static _expAll(ev, target) {
    this.getExp(this.selectedIDs());
  }

  static _getPaidAll(ev, target) {
    this.doPayment(this.selectedIDs(), false);
  }

  static _payAll(ev, target) {
    this.doPayment(this.selectedIDs(), true);
  }

  static async _actorItem(ev, target) {
    ev.stopPropagation();
    const id = target.dataset.uuid;
    const document = await fromUuid(id);
    document.sheet.render(true);
  }

  static _rollAll(ev, target) {
    this.rollAbility(this.selectedIDs());
  }

  static _expandHero(ev, target) {
    ev.stopPropagation(ev);
    $(target).find('.expandDetails').fadeToggle();
  }

  static _heroLink(ev, target) {
    ev.stopPropagation();
    game.actors.get(this.getID(target)).sheet.render(true);
  }

  static async _heroActions(ev, target) {
    ev.stopPropagation();
    ev.preventDefault();
    const actorId = this.getID(target);
    const actor = game.actors.get(actorId);
    if (!actor) return;

    const menuItems = [
      {
        label: _loc('CHAT.MODES.blind'),
        icon: '<i class="fas fa-dice"></i>',
        onClick: () => this.rollAbility([actorId]),
      },
      {
        label: _loc('PAYMENT.wage'),
        icon: '<i class="fas fa-piggy-bank"></i>',
        onClick: () => this.doPayment([actorId], false),
      },
      {
        label: _loc('MASTER.payTT'),
        icon: '<i class="fas fa-coins"></i>',
        onClick: () => this.doPayment([actorId], true),
      },
      {
        label: _loc('MASTER.awardXP'),
        icon: '<i class="fas fa-trophy"></i>',
        onClick: () => this.getExp([actorId]),
      },
      {
        label: _loc('SHEET.DeleteItem'),
        icon: '<i class="fas fa-times"></i>',
        onClick: () => this._deleteHeroById(actorId),
      },
    ];

    const menu = new foundry.applications.ux.ContextMenu(this.element, '', menuItems, { jQuery: false, fixed: true, eventName: 'none' });
    ui.context?.close();
    await menu.render(target, { animate: true });
    ui.context = menu;
  }

  static async _headerActions(ev, target) {
    ev.stopPropagation();
    ev.preventDefault();

    const menuItems = [
      {
        label: _loc('CHAT.MODES.blind'),
        icon: '<i class="fas fa-dice"></i>',
        onClick: () => this.rollAbility(this.selectedIDs()),
      },
      {
        label: _loc('PAYMENT.wage'),
        icon: '<i class="fas fa-piggy-bank"></i>',
        onClick: () => this.doPayment(this.selectedIDs(), false),
      },
      {
        label: _loc('MASTER.payTT'),
        icon: '<i class="fas fa-coins"></i>',
        onClick: () => this.doPayment(this.selectedIDs(), true),
      },
      {
        label: _loc('MASTER.awardXP'),
        icon: '<i class="fas fa-trophy"></i>',
        onClick: () => this.getExp(this.selectedIDs()),
      },
      {
        label: _loc('HELP.groupcheck'),
        icon: '<i class="fas fa-users-cog"></i>',
        onClick: () => this.doGroupCheck(),
      },
    ];

    const menu = new foundry.applications.ux.ContextMenu(this.element, '', menuItems, { jQuery: false, fixed: true, eventName: 'none' });
    ui.context?.close();
    await menu.render(target, { animate: true });
    ui.context = menu;
  }

  static async _openPartySheet() {
    await GroupActorSheet.openPartySheet();
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    html.find('select.select2').select2();

    tabSlider(html);

    html.find('.globalModEnable').on('change', (ev) => this.toggleGlobalMod(ev));

    html.find('.heroSelector').on('change', (ev) => {
      ev.stopPropagation();
      const selected = this.getSelectedActors();
      selected[this.getID(ev.currentTarget)] = $(ev.currentTarget).is(':checked');
      game.settings.set('dsa5', 'selectedActors', selected);
    });
    html.find('.skillSelektor').on('change', (ev) => {
      ev.stopPropagation();
      this.lastSkill = $(ev.currentTarget).val();
    });
    html.find('.selectAll').on('change', (ev) => this._selectAll(ev, html));
    html.find('.heroSelector').on('click', (ev) => ev.stopPropagation());
    html.find('.editFolder').on('change', async (ev) => this._editFolder(ev));
    html.find('.changeSetting').on('change', async (ev) => {
      await game.settings.set('dsa5', ev.currentTarget.name, ev.currentTarget.checked);
    });
    html.find('.changeSightTreshold').on('change', async (ev) => {
      $(ev.currentTarget).closest('.row-section').find('.range-value').text(ev.currentTarget.value);
      this.updateSightThreshold(ev);
    });
    html.find('.updateDarkness').on('change', async (ev) => {
      $(ev.currentTarget).closest('.row-section').find('.range-value').text(ev.currentTarget.value);
      this.updateDarkness(ev);
    });

    html.find('[name="attackFromBehindAngle"]').on('change', (ev) => {
      game.settings.set('dsa5', 'attackFromBehindAngle', Number(ev.currentTarget.value));
    });

    for (const elem of this.randomCreation) {
      elem.activateListeners(html);
    }
    slist(html, '.heros', this.updateHeroOrder.bind(this), '.hero');
    html.find('.hero').on('dragstart', (event) => {
      event.stopPropagation();
      const a = event.currentTarget;
      const dragData = { type: 'Actor', uuid: a.dataset.uuid };
      event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    });

    html.find('.dragEveryone').each(function (i, cond) {
      cond.setAttribute('draggable', true);
    });
    html.find('.dragEveryone').on('dragstart', (ev) => this._dragEveryone(ev));

    if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.activateButtonListener(html);
  }

  async _dragEveryone(ev) {
    ev.stopPropagation();
    let ids;
    if (ev.currentTarget.dataset.folder) {
      const settings = expandObject(game.settings.get('dsa5', 'masterSettings'));
      ids = settings.folders.find((x) => x.id == ev.currentTarget.dataset.folder).content;
    } else {
      ids = this.selectedIDs();
    }
    const dragData = { type: 'GroupDrop', ids };
    ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  async _deleteHeroById(actorId) {
    const actors = game.settings.get('dsa5', 'trackedActors').actors || [];
    const index = actors.indexOf(actorId);
    if (index > -1) {
      actors.splice(index, 1);
      await this.setTrackedHeros(actors);
      this.render(true);
    }
  }

  async updateHeroOrder(target) {
    const actors = [];
    for (const elem of target.querySelectorAll('.hero')) {
      actors.push(elem.dataset.id);
    }
    await this.setTrackedHeros(actors);
  }

  async setTrackedHeros(actorIds) {
    await game.settings.set('dsa5', 'trackedActors', {
      actors: actorIds.filter((x) => game.actors.has(x)),
    });
  }

  async updateDarkness(ev) {
    if (canvas.scene) canvas.scene.update({ 'environment.darknessLevel': Number(ev.currentTarget.value) }, { animateDarkness: 2000 });
  }

  _onSceneDarknessUpdate(document, data, options) {
    if (document !== canvas.scene || !hasProperty(data, 'environment.darknessLevel')) return;

    const targetDarkness = Number(data.environment.darknessLevel);
    if (!Number.isFinite(targetDarkness)) return;

    this._syncDarknessControls(targetDarkness);
    this._triggerDarknessChangeUpdates(options.animateDarkness);
  }

  _triggerDarknessChangeUpdates(animateDarkness) {
    if (!game.dsa5.apps.LightDialog) return;

    if (this._darknessAnimationIntervalId) {
      clearInterval(this._darknessAnimationIntervalId);
      this._darknessAnimationIntervalId = null;
    }

    if (!animateDarkness) {
      game.dsa5.apps.LightDialog.onDarknessChange();
      return;
    }

    const interval = 50;
    const duration = typeof animateDarkness === 'number' ? animateDarkness : 0;
    const limit = Math.ceil(duration / interval);

    if (limit <= 1) {
      game.dsa5.apps.LightDialog.onDarknessChange();
      return;
    }

    let count = 0;
    this._darknessAnimationIntervalId = setInterval(() => {
      game.dsa5.apps.LightDialog.onDarknessChange();

      count++;
      if (count >= limit) {
        clearInterval(this._darknessAnimationIntervalId);
        this._darknessAnimationIntervalId = null;
      }
    }, interval);
  }

  _syncDarknessControls(darknessLevel) {
    if (!Number.isFinite(darknessLevel)) return;

    ui.hotbar?.updateDarknessSlider(darknessLevel);

    if (!this.rendered) return;

    this.element.querySelector('.updateDarkness').value = darknessLevel;
  }

  async updateSightThreshold(ev) {
    const index = Number(ev.currentTarget.dataset.index);
    const value = Number(ev.currentTarget.value);
    const optns = game.settings.get('dsa5', 'sightOptions').split('|');
    optns[index] = value;
    await game.settings.set('dsa5', 'sightOptions', optns.join('|'));
  }

  static async _resetSightThresholds() {
    await game.settings.set('dsa5', 'sightOptions', game.settings.settings.get('dsa5.sightOptions').default);
    this.render(true);
  }

  getGroupSchipSetting() {
    return game.settings
      .get('dsa5', 'groupschips')
      .split('/')
      .map((x) => Number(x));
  }

  async changeGroupSchipCount(value) {
    const schipSetting = this.getGroupSchipSetting();
    schipSetting[1] = Math.max(0, schipSetting[1] + value);
    schipSetting[0] = Math.min(schipSetting[1], schipSetting[0]);
    await game.settings.set('dsa5', 'groupschips', schipSetting.join('/'));
  }

  static async _changeGroupSchip(ev, target) {
    let val = Number(target.getAttribute('data-val'));
    if (val == 1 && $(target).closest('.col').find('.fullSchip').length == 1) val = 0;

    const schipSetting = this.getGroupSchipSetting();
    schipSetting[0] = val;
    await game.settings.set('dsa5', 'groupschips', schipSetting.join('/'));
  }

  async _createFolder() {
    const settings = expandObject(game.settings.get('dsa5', 'masterSettings'));
    if (!settings.folders) settings.folders = [];

    settings.folders.push({
      id: randomID(),
      name: _loc('FOLDER.ExportNewFolder'),
      content: [],
    });
    await game.settings.set('dsa5', 'masterSettings', settings);
    await this.render(true);
  }

  async _deleteFolder(target) {
    const id = target.dataset.id;
    const settings = expandObject(game.settings.get('dsa5', 'masterSettings'));
    settings.folders = settings.folders.filter((x) => x.id != id);

    await game.settings.set('dsa5', 'masterSettings', settings);
    await this.render(true);
  }

  async _editFolder(ev) {
    const id = ev.currentTarget.dataset.id;
    const settings = expandObject(game.settings.get('dsa5', 'masterSettings'));
    settings.folders.find((x) => x.id == id).name = ev.currentTarget.value;

    await game.settings.set('dsa5', 'masterSettings', settings);
  }

  static async _createFolder(ev, target) {
    switch (target.dataset.mode) {
      case 'create':
        this._createFolder();
        break;
      case 'delete':
        this._deleteFolder(target);
        break;
    }
  }

  static _addGlobalMod() {
    new GlobalModAddition().render(true);
  }

  static async _editGlobalMod(ev, target) {
    const id = target.dataset.key;
    new GlobalModAddition(id).render(true);
  }

  async toggleGlobalMod(ev) {
    const settings = game.settings.get('dsa5', 'masterSettings');
    settings.globalMods[ev.currentTarget.dataset.key].enabled = ev.currentTarget.checked;
    await game.settings.set('dsa5', 'masterSettings', settings);
  }

  static async _removeGlobalMod(ev, target) {
    const settings = game.settings.get('dsa5', 'masterSettings');
    delete settings.globalMods[target.dataset.key];
    await game.settings.set('dsa5', 'masterSettings', settings);
    this.render();
  }

  static async _randomPlayer(ev, target) {
    const result = await this.rollRandomPlayer(ev.button == 2);

    const icon = target.querySelector('i') || target;
    icon.classList.add('fa-spin');
    this.element.querySelectorAll('.hero').forEach((el) => el.classList.remove('victim'));

    setTimeout(() => {
      this.element.querySelector(`.hero[data-id="${result}"]`)?.classList.add('victim');
      icon.classList.remove('fa-spin');
    }, 500);
  }

  async rollRandomPlayer(withMisfortune) {
    const probabilities = {};
    let counter = 1;
    const selected = this.getSelectedActors();
    const anythingselected = Object.values(selected).filter((x) => x).length != 0;

    const heros = this.heros.length ? this.heros : await this.getTrackedHeros();
    if (heros.length == 0) {
      ui.notifications.warn('DIALOG.noTarget', { localize: true });
      return;
    }
    for (const hero of heros) {
      if (!selected[hero.id] && anythingselected) continue;

      probabilities[counter] = hero.id;
      counter++;
      if (withMisfortune && AdvantageRulesDSA5.hasVantage(hero, 'LocalizedIDs.misfortune')) {
        probabilities[counter] = hero.id;
        counter++;
      }
      if (withMisfortune && hero.hasCondition('badluck')) {
        probabilities[counter] = hero.id;
        counter++;
      }
    }

    const roll = (await new Roll(`1d${counter - 1}`).evaluate()).total;
    return probabilities[roll];
  }

  async doPayment(ids, pay, amount = 0) {
    const preselected = new Set(ids);
    const actors = ActorPickerDialog.buildActorPickerData().map((a) => ({ ...a, preselected: preselected.has(a.id) }));
    const header = await renderTemplate('systems/dsa5/templates/dialog/parts/payment-amount-input.hbs', {
      amount,
      description: '',
      text: _loc(pay ? 'MASTER.payText' : 'MASTER.getPaidText', { heros: _loc('MASTER.theGroup') }),
    });

    ActorPickerDialog.open({
      actors,
      title: pay ? 'MASTER.payTT' : 'PAYMENT.payButton',
      header,
      showSourceToggle: true,
      callback: ({ actorIds, form }) => {
        const number = form.querySelector('.input-text')?.value;
        const description = form.querySelector('[name="description"]')?.value;
        if (!isNaN(number)) {
          const selected = actorIds.map((id) => game.actors.get(id)).filter(Boolean);
          PaymentRequestService.createRequest({ mode: pay ? 'pay' : 'getPaid', amount: number, description, actors: selected });
        }
      },
    });
  }

  async getPaid(ids) {
    this.doPayment(ids, false);
  }

  async getExp(ids, amount = 0) {
    const preselected = new Set(ids);
    const actors = ActorPickerDialog.buildActorPickerData().map((a) => ({ ...a, preselected: preselected.has(a.id) }));
    const header = await renderTemplate('systems/dsa5/templates/dialog/parts/amount-input.hbs', {
      amount,
      text: _loc('MASTER.awardXPText', { heros: _loc('MASTER.theGroup') }),
    });

    ActorPickerDialog.open({
      actors,
      title: 'MASTER.awardXP',
      header,
      showSourceToggle: true,
      callback: async ({ actorIds, form }) => {
        const number = Number(form.querySelector('.input-text')?.value);
        if (isNaN(number)) return;

        const familiarXP = Math.max(1, Math.round(number * 0.25));
        const petXP = Math.max(1, Math.round(number * 0.1));
        const heros = [];
        const familiars = [];
        const pets = [];
        const selected = actorIds.map((id) => game.actors.get(id)).filter(Boolean);

        for (const actor of selected) {
          let xpBonus = number;
          if (actor.system.isFamiliar) {
            xpBonus = familiarXP;
            familiars.push(actor);
          } else if (actor.system.isPet) {
            xpBonus = petXP;
            pets.push(actor);
          } else {
            heros.push(actor);
          }

          await actor.update({
            'system.details.experience.total': actor.system.details.experience.total + xpBonus,
          });
        }
        const message = [];
        if (heros.length > 0)
          message.push(
            _loc('MASTER.xpMessage', {
              heros: this.getNames(heros),
              number,
            }),
          );
        if (familiars.length > 0)
          message.push(
            _loc('MASTER.xpMessage', {
              heros: this.getNames(familiars),
              number: familiarXP,
            }),
          );
        if (pets.length > 0)
          message.push(
            _loc('MASTER.xpMessage', {
              heros: this.getNames(pets),
              number: petXP,
            }),
          );

        if (message.length > 0) await ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${message.join('</p><p>')}</p>`));

        if (this.rendered) this.render(true);
      },
    });
  }

  getNames(actors) {
    return actors.map((x) => x.name).join(', ');
  }

  buildDialog(title, content, callbackFunction) {
    new DialogShared({
      window: { title },
      content,
      buttons: [
        {
          action: 'yes',
          icon: 'fa fa-check',
          label: 'yes',
          callback: (event, button, dialog) => callbackFunction($(button.form)),
        },
        {
          action: 'no',
          icon: 'fas fa-times',
          label: 'cancel',
        },
      ],
    }).render(true);
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      data = await Actor.implementation.fromDropData(data);
    } catch (err) {
      return false;
    }
    if (data.documentName == 'Actor') {
      let tracked = game.settings.get('dsa5', 'trackedActors');
      tracked = tracked.actors || [];
      if (tracked.indexOf(data.id) == -1 && !data.pack) {
        tracked.push(data.id);
        await this.setTrackedHeros(tracked);
        this.render(true);
      }
      const isFolder = $(event.target).closest('.isFolder');
      const settings = expandObject(game.settings.get('dsa5', 'masterSettings'));
      if (isFolder.length) {
        settings.folders = settings.folders.map((x) => {
          x.content = x.content.filter((y) => y != data.id);

          if (x.id == isFolder[0].dataset.id) x.content.push(data.id);
          return x;
        });
      } else {
        settings.folders =
          settings.folders?.map((x) => {
            x.content = x.content.filter((y) => y != data.id);
            return x;
          }) || [];
      }
      await game.settings.set('dsa5', 'masterSettings', settings);
      this.render(true);
    }
  }

  selectedIDs() {
    const ids = [];
    const selected = this.getSelectedActors();
    for (const [key, value] of Object.entries(selected)) {
      if (value && game.actors.has(key)) ids.push(key);
    }
    if (!ids.length) return game.settings.get('dsa5', 'trackedActors').actors || [];
    return ids;
  }

  async doGroupCheck(amount = 0) {
    const [skill, type] = this.lastSkill.split('|');
    if (type != 'skill') return;

    GroupCheck.openDialog({ name: skill, modifier: amount });
  }

  async rollRequest(amount = 0) {
    const [skill, type] = this.lastSkill.split('|');

    const skillRollCategories = ['attribute', 'skill', 'regeneration'];
    if (!skillRollCategories.includes(type)) return;

    RollRequestService.requestRoll(skill, amount);
  }

  rollAbility(actorIds) {
    const [name, type] = this.lastSkill.split('|');
    switch (type) {
      case 'skill':
        this.rollSkill(actorIds, name);
        break;
      case 'attribute':
        this.rollAttribute(actorIds, name);
        break;
      case 'regeneration':
        this.rollRegeneration(actorIds);
        break;
    }
  }

  rollRegeneration(actorIds) {
    const actors = game.actors.filter((x) => actorIds.includes(x.id));
    for (const actor of actors) {
      ChatCommandService.executeAbilityRoll(actor, null, 'regeneration', undefined, { messageMode: DICE_CONSTANTS.CHAT_MODES.BLIND, subtitle: ` (${actor.name})` });
    }
  }

  rollAttribute(actorIds, name) {
    const actors = game.actors.filter((x) => actorIds.includes(x.id));
    for (const actor of actors) {
      ChatCommandService.executeAbilityRoll(actor, name, 'attribute', undefined, { messageMode: DICE_CONSTANTS.CHAT_MODES.BLIND, subtitle: ` (${actor.name})` });
    }
  }

  rollSkill(actorIds, name) {
    const actors = game.actors.filter((x) => actorIds.includes(x.id));
    for (const actor of actors) {
      ChatCommandService.executeAbilityRoll(actor, name, 'skill', undefined, { messageMode: DICE_CONSTANTS.CHAT_MODES.BLIND, subtitle: ` (${actor.name})` });
    }
  }

  getID(target) {
    return $(target).closest('.hero').attr('data-id');
  }

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'largeDialog', 'masterMenu', 'sheet'],
    window: {
      title: 'gmMenu',
      resizable: true,
      contentClasses: ['masterMenu'],
    },
    position: {
      width: 480,
      height: 740,
    },
    actions: {
      heroLink: this._heroLink,
      addGlobalMod: this._addGlobalMod,
      removeGlobalMod: this._removeGlobalMod,
      editGlobalMod: this._editGlobalMod,
      heroActions: this._heroActions,
      actorItem: this._actorItem,
      resetSightThresholds: this._resetSightThresholds,
      requestRoll: this._requestRoll,
      addGroupSchip: this._changeGroupSchipCount,
      groupschip: this._changeGroupSchip,
      addFolder: this._createFolder,
      headerActions: this._headerActions,
      heroschip: this._heroschip,
      groupcheck: this._groupCheck,
      expandHero: this._expandHero,
      randomPlayer: { handler: this._randomPlayer, buttons: [0, 2] },
      openPartySheet: this._openPartySheet,
    }
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    generators: {
      template: 'systems/dsa5/templates/system/mastermenu/generators.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/wizard/breedcard.hbs']
    },
    settings: {
      template: 'systems/dsa5/templates/system/mastermenu/settings.hbs',
      scrollable: [''],
    },
    main: {
      template: 'systems/dsa5/templates/system/mastermenu/main.hbs',
      templates: ['systems/dsa5/templates/system/mastermenu/master_heros.hbs'],
      scrollable: [''],
    },
  };

  async getTrackedHeros(skipGroupActors = true) {
    const trackedActors = game.settings.get('dsa5', 'trackedActors');
    let heros;
    if (trackedActors.actors && trackedActors.actors.length > 0) {
      heros = game.actors
        .filter((x) => {
          return trackedActors.actors.includes(x.id) && (!skipGroupActors || x.type != "group") && x.type !== 'vehicle';
        })
        .sort((a, b) => {
          return trackedActors.actors.indexOf(a.id) - trackedActors.actors.indexOf(b.id);
        });
    } else {
      heros = game.actors.filter((x) => x.hasPlayerOwner);
      await this.setTrackedHeros(heros.map((x) => x.id));
    }
    return heros;
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'main', label: 'TYPES.Actor.character' },
        { id: 'randomGen', label: 'MASTER.randomGen' },
        { id: 'sceneConfig', label: 'MASTER.sceneConfig' },
      ],
      initial: 'main',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    this.heros = await this.getTrackedHeros();
    const groupschips = RuleChaos.getGroupSchips();

    const thresholds = game.settings.get('dsa5', 'sightOptions').split('|');
    const regex = / \[[a-zA-Zäöü\d-]+\]/;
    const visions = [1, 2, 3, 4].map((x) => {
      return {
        label: _loc(`VisionDisruption.step${x}`).replace(regex, ''),
        value: thresholds[x - 1],
      };
    });
    data.sceneConfig = {
      sceneAutomationEnabled: game.settings.get('dsa5', 'sightAutomationEnabled'),
      enableDPS: game.settings.get('dsa5', 'enableDPS'),
      lightSightCompensationEnabled: game.settings.get('dsa5', 'lightSightCompensationEnabled'),
      attackFromBehindAngle: game.settings.get('dsa5', 'attackFromBehindAngle'),
      visions,
      darkness: canvas.scene?.environment.darknessLevel || 0,
    };

    const selected = this.getSelectedActors();
    const masterSettings = expandObject(game.settings.get('dsa5', 'masterSettings'));
    const copiedHeros = [];
    const folders = (masterSettings.folders || []).map((x) => {
      x.contents = [];
      x.content = new Set(x.content);
      return x;
    });
    for (const hero of this.heros) {
      const newHero = duplicate(hero);
      const disadvantages = [];
      const advantages = [];
      const purse = [];
      for (const x of hero.items) {
        switch (x.type) {
          case 'disadvantage':
            disadvantages.push({ name: x.name, uuid: x.uuid });
            break;
          case 'advantage':
            advantages.push({ name: x.name, uuid: x.uuid });
            break;
          case 'money':
            purse.push(x);
            break;
        }
      }
      mergeObject(newHero, {
        id: hero.id,
        uuid: hero.uuid,
        selected: selected[hero.id],
        schips: hero.schipsWithExtras(),
        type: hero.type,
        purse: purse
          .sort((a, b) => b.system.price.value - a.system.price.value)
          .map((x) => `<span data-tooltip="${x.name}">${x.system.quantity.value}</span>`)
          .join(' - '),
        advantages,
        disadvantages,
        system: {
          status: {
            wounds: { max: hero.system.status?.wounds?.max },
            astralenergy: { max: hero.system.status?.astralenergy?.max },
            karmaenergy: { max: hero.system.status?.karmaenergy?.max },
          },
          isMage: hero.system.isMage,
          isPriest: hero.system.isPriest,
        },
      });

      const folder = folders.find((ff) => {
        return ff.content.has(hero.id);
      });
      if (folder) {
        folder.contents.push(newHero);
      } else {
        copiedHeros.push(newHero);
      }
    }

    if (!this.abilities) {
      const skills = await DSA5_Utility.allSkillsList();
      this.abilities = skills
        .map((x) => {
          return { name: x, type: 'skill' };
        })
        .concat(
          Object.values(game.dsa5.config.characteristics)
            .map((x) => {
              return { name: _loc(x), type: 'attribute' };
            })
            .concat({
              name: _loc('regenerate'),
              type: 'regeneration',
            }),
        )
        .map((x) => {
          x['key'] = `${x.name}|${x.type}`;
          return x;
        });
    }

    mergeObject(data, {
      hasHeros: this.heros.length > 0,
      heros: copiedHeros,
      folders,
      abilities: this.abilities,
      groupschips,
      extraSchipRows: [],
      masterSettings,
      lastSkill: this.lastSkill,
      randomCreation: this.randomCreation.map((x) => x.template),
      lightButton: game.dsa5.apps.LightDialog ? await game.dsa5.apps.LightDialog.getButtonHTML() : '',
    });
    Hooks.call('dsa5.prepareMasterMenu', data, this);
    return data;
  }

  registerRandomCreation(elem) {
    this.randomCreation.push(elem);
  }
}

Hooks.once('setup', () => {
  Hooks.call('dsa5.registerMasterMenuActions', GameMasterMenu.DEFAULT_OPTIONS.actions);
});

class GlobalModAddition extends FormAppv2 {
  constructor(id) {
    super();
    this.mod_id = id;
  }

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'largeDialog', 'generationWizard'],
    window: {
      title: 'MASTER.addGlobalMod',
      resizable: true,
    },
    position: {
      width: 400,
    },
    actions: {
      addGlobalMod: this._addGlobalMod,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/mastermenu/global-mod-addition.hbs',
    },
  };

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);

    if (this.mod_id) {
      data.config = expandObject(game.settings.get('dsa5', 'masterSettings').globalMods[this.mod_id]);
    } else {
      data.config = {
        value: 0,
        victim: {
          npc: true,
          player: true,
        },
      };
    }
    data.rootId = foundry.utils.randomID();
    data.categories = ['skill', 'spell', 'meleeweapon', 'rangeweapon', 'ritual', 'ceremony', 'liturgy', 'trait'];
    return data;
  }

  static async _addGlobalMod(ev, target) {
    ev.preventDefault();
    const settings = expandObject(game.settings.get('dsa5', 'masterSettings'));

    const data = expandObject(new foundry.applications.ux.FormDataExtended(this.element).object);
    data.enabled = true;

    if (!data.name) return;

    if (this.mod_id) {
      settings.globalMods[this.mod_id] = data;
    } else {
      mergeObject(settings, { globalMods: { [randomID()]: data } });
    }
    await game.settings.set('dsa5', 'masterSettings', settings);
    game.dsa5.apps.gameMasterMenu.render();
    this.close();
  }
}
