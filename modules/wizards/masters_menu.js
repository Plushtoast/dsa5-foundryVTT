import DSA5_Utility from '../system/utility-dsa5.js';
import DSA5Payment from '../system/payment.js';
import RuleChaos from '../system/rule_chaos.js';
import AdvantageRulesDSA5 from '../system/advantage-rules-dsa5.js';
import { slist, tabSlider } from '../system/view_helper.js';
import PlayerMenu from './player_menu.js';
import RequestRoll from '../system/request-roll.js';
import DialogShared from '../dialog/dialog-shared.js';
import { DefaultAppv2 } from '../actor/baseapp.js';
import { FormAppv2 } from '../actor/formapp.js';
const { hasProperty, expandObject, mergeObject, duplicate, randomID } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

export default class MastersMenu {
  static registerButtons() {
    game.dsa5.apps.playerMenu = new PlayerMenu();
    CONFIG.Canvas.layers.dsamenu = {
      layerClass: DSAMenuLayer,
      group: 'interface',
    };
    Hooks.on('getSceneControlButtons', (btns) => {
      const dasMenuOptions = [
        {
          name: 'JournalBrowser',
          title: 'Book.Wizard',
          icon: 'fa fa-book',
          button: true,
          onChange: () => {
            DSA5_Utility.renderToggle(game.dsa5.apps.journalBrowser);
          },
        },
        {
          name: 'Library',
          title: 'SHEET.Library',
          icon: 'fas fa-university',
          button: true,
          onChange: () => {
            DSA5_Utility.renderToggle(game.dsa5.itemLibrary);
          },
        },
        {
          name: 'PlayerMenu',
          title: 'PLAYER.title',
          icon: 'fas fa-dsa5-player',
          button: true,
          onChange: () => {
            DSA5_Utility.renderToggle(game.dsa5.apps.playerMenu);
          },
        },
      ];
      if (game.settings.get('dsa5', 'masterCanvasControls')) {
        if (game.dsa5.apps.tokenHotbar) {
          for (let i = 3; i < game.dsa5.apps.tokenHotbar._gmEntries().length; i++) {
            const entry = game.dsa5.apps.tokenHotbar._gmEntries()[i];
            dasMenuOptions.push({
              name: entry.id,
              title: entry.name,
              icon: `fa-dsa5 fa-dsa5-${entry.id}`,
              button: true,
              onChange: () => game.dsa5.apps.tokenHotbar.callbackFunctions[entry.id](),
            });
          }
        }
      }
      if (game.user.isGM) {
        if (!game.dsa5.apps.gameMasterMenu) game.dsa5.apps.gameMasterMenu = new GameMasterMenu();
        dasMenuOptions.push({
          name: 'mastersMenu',
          title: 'gmMenu',
          icon: 'fa fa-dsa5',
          button: true,
          onChange: () => {
            DSA5_Utility.renderToggle(game.dsa5.apps.gameMasterMenu);
          },
        });
      }
      btns.gmMenu = {
        name: 'gmMenu',
        title: 'dsamenu',
        icon: 'fas fa-dsa5',
        layer: 'dsamenu',
        tools: dasMenuOptions.reduce((a, b) => {
          a[b.name] = b;
          return a;
        }, {}),
      };
    });
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
}

class GameMasterMenu extends DefaultAppv2 {
  constructor(app) {
    super(app);
    this.heros = [];
    this.lastSkill = `${game.i18n.localize('LocalizedIDs.perception')}|skill`;
    this.randomCreation = [];

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
      Hooks.on('updateScene', async (document, data, options, userId) => {
        const properties = ['environment.darknessLevel'];
        if (
          game.canvas.id == document.id &&
          properties.reduce((a, b) => {
            return a || hasProperty(data, b);
          }, false)
        ) {
          if (game.dsa5.apps.LightDialog) game.dsa5.apps.LightDialog.onDarknessChange();

          if (!this.rendered) return;

          this.render();
        }
      });
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
    for (let key of Object.keys(selected)) {
      if (tracked.actors?.includes(key)) final[key] = selected[key];
    }
    return final;
  }

  static async _heroschip(ev, target) {
    console.log("wuuz")
    ev.stopPropagation();
    ev.preventDefault();
    let val = Number(target.dataset.val);
    if (val == 1 && $(target).closest('.hero').find('.fullSchip').length == 1) val = 0;

    game.actors.get(this.getID(target)).update({ 'system.status.fatePoints.value': val });
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

  static _getExp(ev, target) {
    ev.stopPropagation();
    this.getExp([this.getID(target)]);
  }

  static _getPaidAll(ev, target) {
    this.doPayment(this.selectedIDs(), false);
  }

  static _payAll(ev, target) {
    this.doPayment(this.selectedIDs(), true);
  }

  static _getPaid(ev, target) {
    ev.stopPropagation();
    this.doPayment([this.getID(target)], false);
  }

  static async _actorItem(ev, target) {
    ev.stopPropagation();
    const id = target.dataset.uuid;
    const document = await fromUuid(id);
    document.sheet.render(true);
  }

  static _pay(ev, target) {
    ev.stopPropagation();
    this.doPayment([this.getID(target)], true);
  }

  static _rollAll(ev, target) {
    this.rollAbility(this.selectedIDs());
  }

  static _rollChar(ev, target) {
    ev.stopPropagation();
    this.rollAbility([this.getID(target)]);
  }

  static _expandHero(ev, target) {
    ev.stopPropagation(ev);
    $(target).find('.expandDetails').fadeToggle();
  }

  static _heroLink(ev, target) {
    ev.stopPropagation();
    game.actors.get(this.getID(target)).sheet.render(true);
  }

  async _onRender(context, options) {
    await super._onRender((context, options));
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
    html.find('.randomPlayer').on('mousedown', (ev) => {
      ev.stopPropagation();
      this._randomPlayer(html, ev);
    });
    html.find('.heroSelector').on('click', (ev) => ev.stopPropagation());

    let deletehand = (ev) => this._deleteHero(ev);

    html.find('.hero').on('mouseenter', (ev) => {
      if (ev.currentTarget.getElementsByClassName('hovermenu').length == 0) {
        let div = document.createElement('div');
        div.classList.add('hovermenu');
        let del = document.createElement('i');
        del.classList.add('fas', 'fa-times');
        del.dataset.tooltip = 'SHEET.DeleteItem';
        del.addEventListener('click', deletehand, false);
        div.appendChild(del);
        ev.currentTarget.appendChild(div);
      }
    });
    html.find('.hero').on('mouseleave', (ev) => {
      let e = ev.toElement || ev.relatedTarget;
      if (!e || e.parentNode == this || e == this) return;

      ev.currentTarget.querySelectorAll('.hovermenu').forEach((e) => e.remove());
    });
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

    for (let elem of this.randomCreation) {
      elem.activateListeners(html);
    }
    slist(html, '.heros', this.updateHeroOrder, '.hero');
    html.on('dragstart', '.hero', (event) => {
      event.stopPropagation();
      const a = event.currentTarget;
      let dragData = { type: 'Actor', uuid: a.dataset.uuid };
      event.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
    });

    html.find('.dragEveryone').each(function (i, cond) {
      cond.setAttribute('draggable', true);
    });
    html.on('dragstart', '.dragEveryone', (ev) => this._dragEveryone(ev));

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
    let dragData = { type: 'GroupDrop', ids };
    ev.originalEvent.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  async _selectAll(ev, html) {
    ev.stopPropagation();
    let selector = '.heroSelector';
    if (ev.currentTarget.dataset.folder) selector = `[data-id="${ev.currentTarget.dataset.folder}"] .heroSelector`;

    const allHeros = html.find(selector);
    allHeros.prop('checked', $(ev.currentTarget).is(':checked'));
    allHeros.on('change');
  }

  async _deleteHero(ev) {
    ev.stopPropagation();
    ev.preventDefault();
    const toRemove = $(ev.currentTarget).closest('.hero').attr('data-id');
    const actors = game.settings.get('dsa5', 'trackedActors').actors || [];
    const index = actors.indexOf(toRemove);
    if (index > -1) {
      actors.splice(index, 1);
      await this.setTrackedHeros(actors);
      this.render(true);
    }
  }

  async updateHeroOrder(target) {
    const actors = [];
    for (let elem of target.querySelectorAll('.hero')) {
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
    if (canvas.scene) canvas.scene.update({ 'environment.darknessLevel': Number(ev.currentTarget.value) }, { animateDarkness: 3000 });
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
      name: game.i18n.localize('FOLDER.ExportNewFolder'),
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

  async _randomPlayer(html, ev) {
    const heros = html.find('.hero');
    const result = await this.rollRandomPlayer(ev.button == 2);

    $(ev.currentTarget).find('i').addClass('fa-spin');
    heros.removeClass('victim');

    setTimeout(() => {
      $(this.element).find(`.hero[data-id="${result}"]`).addClass('victim');
      $(ev.currentTarget).find('i').removeClass('fa-spin');
    }, 500);
  }

  async rollRandomPlayer(withMisfortune) {
    let probabilities = {};
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
    const tracked = await this.getTrackedHeros();
    const template = await renderTemplate('systems/dsa5/templates/dialog/master-ap-award.hbs', {
      selected: ids,
      amount,
      tracked,
      text: game.i18n.localize(
        game.i18n.format(pay ? 'MASTER.payText' : 'MASTER.getPaidText', {
          heros: game.i18n.localize('MASTER.theGroup'),
        }),
      ),
    });
    const callback = (dlg) => {
      const number = dlg.find('.input-text').val();
      if (!isNaN(number)) {
        const actors = [];
        dlg.find('.heroSelector:checked').each((i, elem) => actors.push(game.actors.get(elem.value)));
        for (let hero of actors) DSA5Payment.handlePayAction(undefined, pay, number, hero);
      }
    };
    this.buildDialog(game.i18n.localize(pay ? 'MASTER.payTT' : 'PAYMENT.payButton'), template, callback);
  }

  async getPaid(ids) {
    this.doPayment(ids, false);
  }

  async getExp(ids, amount = 0) {
    const tracked = await this.getTrackedHeros();
    const template = await renderTemplate('systems/dsa5/templates/dialog/master-ap-award.hbs', {
      selected: ids,
      tracked,
      amount,
      text: game.i18n.localize(
        game.i18n.format('MASTER.awardXPText', {
          heros: game.i18n.localize('MASTER.theGroup'),
        }),
      ),
    });
    const callback = async (dlg) => {
      const number = Number(dlg.find('.input-text').val());
      const familiarXP = Math.max(1, Math.round(number * 0.25));
      const petXP = Math.max(1, Math.round(number * 0.1));
      const heros = [];
      const familiars = [];
      const pets = [];
      const actors = [];
      dlg.find('.heroSelector:checked').each((i, elem) => actors.push(game.actors.get(elem.value)));

      if (!isNaN(number)) {
        for (const actor of actors) {
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
            game.i18n.format('MASTER.xpMessage', {
              heros: this.getNames(heros),
              number,
            }),
          );
        if (familiars.length > 0)
          message.push(
            game.i18n.format('MASTER.xpMessage', {
              heros: this.getNames(familiars),
              number: familiarXP,
            }),
          );
        if (pets.length > 0)
          message.push(
            game.i18n.format('MASTER.xpMessage', {
              heros: this.getNames(pets),
              number: petXP,
            }),
          );

        if (message.length > 0) await ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${message.join('</p><p>')}</p>`));

        if (this.rendered) this.render(true);
      }
    };
    this.buildDialog(game.i18n.localize('MASTER.awardXP'), template, callback);
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
    let ids = [];
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

    const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.hbs', {
      amount,
      text: game.i18n.localize(game.i18n.format('MASTER.doGroupCheck', { skill })),
    });
    const callback = (dlg) => {
      const number = Number(dlg.find('.input-text').val());
      const [skill, type] = this.lastSkill.split('|');
      if (type != 'skill') return;

      RequestRoll.showGCMessage(skill, number);
    };
    this.buildDialog(game.i18n.localize('HELP.groupcheck'), template, callback);
  }

  async rollRequest(amount = 0) {
    const [skill, type] = this.lastSkill.split('|');

    const skillRollCategories = ['attribute', 'skill', 'regeneration'];
    if (!skillRollCategories.includes(type)) return;

    const template = await renderTemplate('systems/dsa5/templates/dialog/master-dialog-award.hbs', {
      amount,
      text: game.i18n.localize(game.i18n.format('MASTER.doRequestRoll', { skill })),
    });
    const callback = (dlg) => {
      const number = Number(dlg.find('.input-text').val());
      const [skill, type] = this.lastSkill.split('|');
      if (!skillRollCategories.includes(type)) return;

      RequestRoll.showRQMessage(skill, number);
    };
    this.buildDialog(game.i18n.localize('HELP.request'), template, callback);
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
      actor.setupRegeneration('regenerate', { rollMode: 'blindroll', subtitle: ` (${actor.name})` }, undefined).then((setupData) => {
        actor.basicTest(setupData);
      });
    }
  }

  rollAttribute(actorIds, name) {
    const actors = game.actors.filter((x) => actorIds.includes(x.id));
    let characteristic = Object.keys(game.dsa5.config.characteristics).find((key) => game.i18n.localize(game.dsa5.config.characteristics[key]) == name);
    for (const actor of actors) {
      actor.setupCharacteristic(characteristic, { rollMode: 'blindroll', subtitle: ` (${actor.name})` }, undefined).then((setupData) => {
        actor.basicTest(setupData);
      });
    }
  }

  rollSkill(actorIds, name) {
    const actors = game.actors.filter((x) => actorIds.includes(x.id));
    for (const actor of actors) {
      let skill = actor.items.find((x) => x.name == name && x.type == 'skill');
      actor.setupSkill(skill, { rollMode: 'blindroll', subtitle: ` (${actor.name})` }, undefined).then((setupData) => {
        actor.basicTest(setupData);
      });
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
      rollChar: this._rollChar,
      rollAll: this._rollAll,
      pay: this._pay,
      actorItem: this._actorItem,
      getPaid: this._getPaid,
      resetSightThresholds: this._resetSightThresholds,
      payAll: this._payAll,
      getPaidAll: this._getPaidAll,
      exp: this._getExp,
      expAll: this._expAll,
      requestRoll: this._requestRoll,
      addGroupSchip: this._changeGroupSchipCount,
      groupschip: this._changeGroupSchip,
      addFolder: this._createFolder,
      heroschip: this._heroschip,
      groupcheck: this._groupCheck,
      expandHero: this._expandHero,
    }
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    generators: {
      template: 'systems/dsa5/templates/system/mastermenu/generators.hbs',
      scrollable: [''],
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

  async getTrackedHeros() {
    const trackedActors = game.settings.get('dsa5', 'trackedActors');
    let heros;
    if (trackedActors.actors && trackedActors.actors.length > 0) {
      heros = game.actors
        .filter((x) => trackedActors.actors.includes(x.id))
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
        label: game.i18n.localize(`VisionDisruption.step${x}`).replace(regex, ''),
        value: thresholds[x - 1],
      };
    });
    data.sceneConfig = {
      sceneAutomationEnabled: game.settings.get('dsa5', 'sightAutomationEnabled'),
      enableDPS: game.settings.get('dsa5', 'enableDPS'),
      lightSightCompensationEnabled: game.settings.get('dsa5', 'lightSightCompensationEnabled'),
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
    for (let hero of this.heros) {
      let newHero = duplicate(hero);
      const disadvantages = [];
      const advantages = [];
      const purse = [];
      for (let x of hero.items) {
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
        schips: hero.schipshtml(),
        purse: purse
          .sort((a, b) => b.system.price.value - a.system.price.value)
          .map((x) => `<span data-tooltip="${x.name}">${x.system.quantity.value}</span>`)
          .join(' - '),
        advantages,
        disadvantages,
        system: {
          status: {
            wounds: { max: hero.system.status.wounds.max },
            astralenergy: { max: hero.system.status.astralenergy.max },
            karmaenergy: { max: hero.system.status.karmaenergy.max },
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
              return { name: game.i18n.localize(x), type: 'attribute' };
            })
            .concat({
              name: game.i18n.localize('regenerate'),
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
      masterSettings,
      lastSkill: this.lastSkill,
      randomCreation: this.randomCreation.map((x) => x.template),
      lightButton: game.dsa5.apps.LightDialog ? await game.dsa5.apps.LightDialog.getButtonHTML() : '',
    });
    return data;
  }

  registerRandomCreation(elem) {
    this.randomCreation.push(elem);
  }
}

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
