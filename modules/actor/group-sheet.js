import DSA5 from '../config/config-dsa5.js';
import GroupAPI from './group-api.js';
import GroupData from '../data/actor/group.js';
import { AppV2Mixin } from './mixins/appv2_mixin.js';
import { DSACalendarEntry } from '../data/journal/dsacalendar.js';
import PaymentRequestService from '../system/queries/payment-requests.js';
import ActorPickerDialog from '../dialog/actor-picker-dialog.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import ChatCommandService from '../system/sidebar/chat_command_service.js';
import RollRequestService from '../system/queries/roll-request.js';
import { DICE_CONSTANTS } from '../config/dice-constants.js';
import MerchantSheetDSA5 from './merchant-sheet.js';

const { renderTemplate } = foundry.applications.handlebars;
const { escapeHTML } = foundry.utils;

const { TextEditor } = foundry.applications.ux;

export default class GroupActorSheet extends AppV2Mixin(foundry.applications.api.HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2)) {
  static PRIMARY_PARTY_DIALOG_TEMPLATE = 'systems/dsa5/templates/dialog/group-primary-party-dialog.hbs';
  static DEPOT_PERMISSIONS_TEMPLATE = 'systems/dsa5/templates/dialog/group-depot-permissions.hbs';

  static TRAVEL_ICONS = {
    foot: 'fa-person-walking',
    vehicle: 'fa-horse',
    river: 'fa-sailboat',
    sea: 'fa-ship',
  };

  static async openPartySheet() {
    const party = await this.#resolvePrimaryParty();

    DSA5_Utility.renderToggle(party?.sheet);
  }

  static async #resolvePrimaryParty() {
    const partyId = game.settings.get('dsa5', 'primaryParty');
    const party = partyId ? fromUuidSync(partyId) : null;
    if (party) return party;
    if (!game.user.isGM) return null;

    return await this.#promptPrimaryPartySelection();
  }

  static #availablePartyGroups() {
    return game.actors.filter((actor) => actor.type === 'group').sort((left, right) => left.name.localeCompare(right.name, game.i18n.lang));
  }

  static async #promptPrimaryPartySelection() {
    const groups = this.#availablePartyGroups();
    const hasGroups = groups.length > 0;
    const content = await renderTemplate(this.PRIMARY_PARTY_DIALOG_TEMPLATE, {
      groups: groups.map((group) => ({ id: group.id, name: group.name })),
      hasGroups,
      selectedGroupId: groups[0]?.id ?? '',
    });

    let result;
    try {
      result = await foundry.applications.api.DialogV2.wait({
        window: {
          title: 'GROUP.openGroupSheet',
        },
        content,
        buttons: [
          ...(hasGroups ? [
            {
              action: 'select',
              icon: 'fas fa-users',
              label: 'GROUP.useExistingGroup',
              default: true,
              callback: (_event, button, dialog) => ({
                action: 'select',
                groupId: (button.form || dialog.form || dialog.element)?.querySelector('[name="groupId"]')?.value,
              }),
            },
          ] : []),
          {
            action: 'create',
            icon: 'fas fa-plus',
            label: 'GROUP.createNewGroup',
            default: !hasGroups,
            callback: () => ({ action: 'create' }),
          },
          {
            action: 'cancel',
            icon: 'fas fa-times',
            label: 'cancel',
            callback: () => null,
          },
        ],
      });
    } catch {
      return null;
    }

    if (!result) return null;

    let party;
    if (result.action === 'select') {
      party = game.actors.get(result.groupId);
      if (!party) return null;
    } else {
      party = await Actor.create({ name: _loc('GROUP.members'), type: 'group' });
    }

    await game.settings.set('dsa5', 'primaryParty', party.uuid);
    return party;
  }

  static propertiesToEnrich = [
    { key: 'enrichedBiography', path: 'details.biography' },
    { key: 'enrichedNotes', path: 'details.notes' },
  ];

  get title() {
    return this.actor.name;
  }

  static PARTS = {
    sheet: {
      template: 'systems/dsa5/templates/actors/group/group-sheet.hbs',
      root: true,
    },
    header: {
      template: 'systems/dsa5/templates/actors/group/group-header.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/actors/actorv2/tabsvertical.hbs',
      id: 'tabs',
      templates: [
        'systems/dsa5/templates/actors/actorv2/tabsvertical_inner.hbs',
        'systems/dsa5/templates/system/dsatabs.hbs',
      ],
      classes: [],
    },
    members: {
      template: 'systems/dsa5/templates/actors/group/group-members.hbs',
      scrollable: [''],
      templates: [
        'systems/dsa5/templates/actors/parts/member-card-header.hbs',
      ],
    },
    skills: {
      template: 'systems/dsa5/templates/actors/group/group-skills.hbs',
      scrollable: [''],
    },
    inventory: {
      template: 'systems/dsa5/templates/actors/group/group-inventory.hbs',
      scrollable: [''],
    },
    travel: {
      template: 'systems/dsa5/templates/actors/group/group-travel.hbs',
      scrollable: [''],
    },
    gmTools: {
      template: 'systems/dsa5/templates/actors/group/group-gm-tools.hbs',
      scrollable: [''],
      templates: ['systems/dsa5/templates/actors/group/parts/group-helpers.hbs'],
    },
    notes: {
      template: 'systems/dsa5/templates/actors/group/group-notes.hbs',
      scrollable: [''],
    },
  };

  static DEFAULT_OPTIONS = {
    position: {
      width: 770,
      height: 740,
    },
    classes: ['dsa5', 'actor', 'group-sheet', 'character-sheet'],
    actions: {
      removeMember: this.#removeMember,
      heroLink: this.#heroLink,
      heroSchip: this.#heroSchip,
      heroContextMenu: this.#heroContextMenu,
      memberContextMenu: this.#heroContextMenu,
      memberCardLink: this.#heroLink,
      addLocation: this.#addLocation,
      removeLocation: this.#removeLocation,
      openLocationSheet: this.#openLocationSheet,
      toggleLocationLock: this.#toggleLocationLock,
      rollGroupCheck: this.#rollGroupCheck,
      requestSkillRoll: this.#requestSkillRoll,
      createEventsJournal: this.#createEventsJournal,
      groupHelperAction: this.#groupHelperAction,
      awardAP: this.#awardAP,
      groupPayment: this.#groupPayment,
      groupGetPaid: this.#groupGetPaid,
      setPrimaryParty: this.#setPrimaryParty,
      randomMember: { handler: this.#randomMember, buttons: [0, 2] },
      chCollapse: this.#chCollapse,
      shareOwnership: this.#shareOwnership,
      openItem: this.#openItem,
      openLocationItem: this.#openLocationItem,
      locationItemContextMenu: this._locationItemContextMenu,
      changeGroupSchip: this.#changeGroupSchip,
      addGroupSchipCount: this.#addGroupSchipCount,
      rollAllBlind: this.#rollAllBlind,
      rollRegeneration: this.#rollRegeneration,
      requestAttributeRoll: this.#requestAttributeRoll,
      tradeWithDepot: this.#tradeWithDepot,
      depotPermissions: this.#depotPermissions,
      setLocationType: this.#setLocationType,
      resetTravelMode: this.#resetTravelMode,
    },
    form: {
      submitOnChange: true,
    },
    window: {
      resizable: true,
      contentClasses: ['standard-form'],
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'members', label: 'GROUP.members', icon: 'fas fa-users' },
        { id: 'skills', label: 'GROUP.skills', icon: 'fas fa-graduation-cap' },
        { id: 'inventory', label: 'GROUP.inventory', icon: 'fas fa-suitcase' },
        { id: 'travel', label: 'GROUP.travel', icon: 'fas fa-route' },
        { id: 'gmTools', label: 'GROUP.gmTools', icon: 'fas fa-mask' },
        { id: 'notes', label: 'GROUP.notes', icon: 'fas fa-book' },
      ],
      initial: 'members',
    },
  };

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (!game.user.isGM || GroupAPI.getGmToolEntries(this.actor).length === 0) {
      delete tabs.gmTools;
    }
    const tabKeys = Object.keys(tabs);
    const hasActive = tabKeys.some((key) => tabs[key].active);
    if (!hasActive && tabKeys.length > 0) {
      const firstTab = tabs[tabKeys[0]];
      firstTab.active = true;
      firstTab.cssClass = 'active';
    }
    return tabs;
  }

  #skillSearch;
  #inventorySearch;
  #hookIds = [];

  async _onRender(context, options) {
    await super._onRender(context, options);
    this.element.classList.toggle('vertical-tabs', game.settings.get('dsa5', 'tabsOutsideSheet'));

    if (this.#hookIds.length === 0) {
      const rerenderBound = this.#onRelatedActorUpdate.bind(this);
      this.#hookIds.push(
        Hooks.on('updateActor', rerenderBound),
        Hooks.on('createItem', rerenderBound),
        Hooks.on('updateItem', rerenderBound),
        Hooks.on('deleteItem', rerenderBound),
      );
    }

    this.#skillSearch ??= new foundry.applications.ux.SearchFilter({
      inputSelector: '.skillSearch',
      contentSelector: '.allSkills',
      callback: this._filterSkills.bind(this),
    });
    this.#skillSearch.bind(this.element);

    this.#inventorySearch ??= new foundry.applications.ux.SearchFilter({
      inputSelector: '.inventorySearch',
      contentSelector: '.allLocations',
      callback: this._filterInventory.bind(this),
    });
    this.#inventorySearch.bind(this.element);

    for (const input of this.element.querySelectorAll('.group-money-change')) {
      input.addEventListener('change', (ev) => this._onGroupMoneyChange(ev));
    }

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: '.location-item-row',
      dropSelector: '.group-location',
      permissions: {
        dragstart: () => this.isEditable,
        drop: () => this.isEditable,
      },
      callbacks: {
        dragstart: this.#onLocationItemDragStart.bind(this),
        drop: this.#onLocationItemDrop.bind(this),
      },
    }).bind(this.element);
  }

  static #findResolvedLocation(groupActor, depotActor) {
    if (!depotActor) return undefined;
    return (groupActor.system.resolvedLocations ?? []).find((entry) => entry.actor?.id === depotActor.id);
  }

  static #prepareDepotWeight(actor) {
    const totalWeight = parseFloat(actor.system.totalWeight?.toFixed(3) ?? 0);
    const carrycapacity = actor.system.carrycapacity ?? 0;
    const encumbrance = actor.system.condition?.encumbered || 0;
    let moneyWeight = actor.system.moneyWeight || 0;
    moneyWeight = moneyWeight > 0 ? `<br>${_loc('purse')}: ${parseFloat(moneyWeight.toFixed(2))}` : '';
    return {
      totalWeight,
      carrycapacity,
      encumbrance,
      encumbranceTooltip: _loc('encumbranceTooltip', {
        totalWeight,
        carrycapacity,
        encumbrance,
        moneyWeight,
      }),
    };
  }

  static #getLocationItemContextOptions(groupActor, uuid) {
    const item = fromUuidSync(uuid);
    const locActor = item?.parent;
    if (!item || !locActor) return [];

    const loc = GroupActorSheet.#findResolvedLocation(groupActor, locActor);
    if (!game.user.isGM && loc?.locked) return [];

    const options = [{
      label: _loc('SHEET.PostItem'),
      icon: '<i class="fas fa-comment"></i>',
      onClick: () => item.postItem(),
    }];

    if (GroupData.isLootDepotActor(locActor)) {
      options.push({
        label: _loc('GROUP.takeItem'),
        icon: '<i class="fas fa-hand-holding"></i>',
        onClick: () => GroupActorSheet.takeLocationItem(groupActor, uuid),
      });
    }

    return options;
  }

  #onLocationItemDragStart(event) {
    const row = event.currentTarget;
    const locKey = row.dataset.locationKey;
    const itemId = row.dataset.itemId;
    const loc = this.actor.system.resolvedLocations.find((l) => l.key === locKey);
    if (!loc || loc.locked) {
      event.preventDefault();
      return;
    }
    const item = loc.actor?.items.get(itemId);
    if (!item) return;
    event.dataTransfer.setData('text/plain', JSON.stringify({
      type: 'Item',
      uuid: item.uuid,
      fromLocationKey: locKey,
    }));
  }

  async #onLocationItemDrop(event) {
    const targetEl = event.currentTarget.closest('[data-location-key]');
    if (!targetEl) return;
    const targetKey = targetEl.dataset.locationKey;

    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
    } catch {
      return;
    }
    if (data.type !== 'Item' || !data.fromLocationKey) return;
    if (data.fromLocationKey === targetKey) return;

    const system = this.actor.system;
    const sourceLoc = system.resolvedLocations.find((l) => l.key === data.fromLocationKey);
    const targetLoc = system.resolvedLocations.find((l) => l.key === targetKey);
    if (!sourceLoc?.actor || !targetLoc?.actor) return;

    if (sourceLoc.locked || targetLoc.locked) {
      ui.notifications.warn('GROUP.locationLocked', { localize: true });
      return;
    }

    const item = sourceLoc.actor.items.get(data.uuid.split('.').pop());
    if (!item) return;

    const itemData = item.toObject();
    await targetLoc.actor.createEmbeddedDocuments('Item', [itemData]);
    await sourceLoc.actor.deleteEmbeddedDocuments('Item', [item.id]);
  }

  #onRelatedActorUpdate(doc) {
    const actor = doc instanceof Item ? doc.parent : doc;
    if (!actor || actor === this.actor) return;
    const system = this.actor.system;
    const isMember = Object.values(system.members).some((m) => fromUuidSync(m.uuid)?.id === actor.id);
    const isLocation = system.resolvedLocations.some((l) => l.actor?.id === actor.id);
    if (isMember || isLocation) this.render();
  }

  _tearDown(options) {
    super._tearDown(options);
    const hookNames = ['updateActor', 'createItem', 'updateItem', 'deleteItem'];
    for (let i = 0; i < this.#hookIds.length; i++) {
      Hooks.off(hookNames[i], this.#hookIds[i]);
    }
    this.#hookIds.length = 0;
    this.#skillSearch?.unbind();
    this.#inventorySearch?.unbind();
  }

  async _onGroupMoneyChange(ev) {
    const itemId = ev.target.closest('[data-item-id]')?.dataset.itemId;
    if (!itemId) return;
    const value = Math.max(0, Math.round(Number(ev.target.value) || 0));
    await this.actor.updateEmbeddedDocuments('Item', [{ _id: itemId, 'system.quantity.value': value }]);
  }

  _filterSkills(_event, query, rgx, html) {
    const show = !!query;
    html.classList.add('showAll');
    html.querySelectorAll('.table-header').forEach((el) => el.classList.toggle('dsahidden', show));
    html.querySelectorAll('.table-title').forEach((el) => el.classList.toggle('dsahidden', show));

    for (const entry of html.querySelectorAll('.item')) {
      if (!query) {
        entry.hidden = false;
        continue;
      }
      const title = entry.querySelector('.talentName')?.textContent || '';
      entry.hidden = !rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(title));
    }
  }

  _filterInventory(_event, query, rgx, html) {
    for (const entry of html.querySelectorAll('.location-item-row')) {
      if (!query) {
        entry.hidden = false;
        continue;
      }
      const title = entry.querySelector('.ellipsis')?.textContent || '';
      entry.hidden = !rgx.test(foundry.applications.ux.SearchFilter.cleanQuery(title));
    }
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const system = this.actor.system;

    context.isGM = game.user.isGM;
    context.isOwner = this.actor.isOwner;
    context.verticalTabs = game.settings.get('dsa5', 'tabsOutsideSheet');
    context.systemFields = this.document.system.schema?.fields;

    context.members = this._prepareMembersData();
    context.aggregateStats = system.aggregateStats;
    context.memberCount = system.memberCount;
    context.groupCoins = this._prepareGroupCoins();

    context.groupSkills = this._prepareGroupSkillsData();
    context.skillCategories = this._groupSkillsByCategory(context.groupSkills);

    context.locations = system.resolvedLocations.map((loc) => ({
      ...loc,
      permissionWarning: GroupData.playersMissingDepotPermission(loc.actor),
      ...GroupActorSheet.#prepareDepotWeight(loc.actor),
      items: loc.actor.items
        .filter((i) => DSA5.equipmentCategories.has(i.type))
        .map((i) => {
          const item = i.system.prepareEmbeddedItemSheet();
          item._id = i.id;
          item.id = i.id;
          item.uuid = i.uuid;
          item.locationKey = loc.key;
          item.calculatedPrice = DSA5_Utility.itemPrice(i);
          return item;
        }),
      coins: loc.actor.items
        .filter((i) => i.type === 'money')
        .sort((a, b) => b.system.price.value - a.system.price.value)
        .map((i) => ({ name: i.name, img: i.img, quantity: i.system.quantity.value })),
    }));
    context.vehicleTypes = Object.fromEntries(
      Object.entries(DSA5.locationTypes)
        .filter(([key]) => key !== 'foot')
        .map(([key, label]) => [key, { label, icon: GroupActorSheet.TRAVEL_ICONS[key] }])
    );

    context.travel = system.travel;
    context.travelSpeeds = Object.fromEntries(
      Object.entries(system.travelSpeeds).map(([mode, spd]) => [mode, { ...spd, icon: GroupActorSheet.TRAVEL_ICONS[mode] }])
    );
    context.groupSchips = RuleChaos.getGroupSchips();
    context.abilities = await this._prepareAbilities();
    context.characteristics = Object.entries(game.dsa5.config.characteristics).map(([key, label]) => ({
      key,
      abbr: _loc(`CHARAbbrev.${key.toUpperCase()}`),
      name: _loc(label),
    }));

    context.isPrimaryParty = game.settings.get('dsa5', 'primaryParty') === this.actor.uuid;

    context.gmTools = game.user.isGM ? await GroupAPI.prepareGmToolEntries(this.actor) : [];
    context.helpers = {
      members: GroupAPI.getHelperEntries('members', this.actor),
      custom: GroupAPI.getHelperEntries('custom', this.actor),
    };

    await this._prepareEnrichedFields(context);
    return context;
  }

  _prepareMembersData() {
    const members = [];
    const system = this.actor.system;

    const sorted = Object.entries(system.members)
      .sort(([, a], [, b]) => a.sort - b.sort);

    for (const [key, member] of sorted) {
      const actor = fromUuidSync(member.uuid);
      if (!actor) continue;

      const s = actor.system;
      const vantages = [];
      const purse = [];
      const canViewPrivateDetails = game.user.isGM || actor.isOwner;

      if (canViewPrivateDetails) {
        for (const item of actor.items) {
          switch (item.type) {
            case 'advantage':
            case 'disadvantage':
              vantages.push({ name: item.name, uuid: item.uuid, step: item.system.step?.value, max: item.system.max?.value });
              break;
            case 'money':
              purse.push(item);
              break;
          }
        }
      }

      const owner = game.users.find((u) => u.character?.id === actor.id);

      members.push({
        key,
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        img: actor.img,
        type: actor.type,
        ownerName: owner?.name ?? null,
        ownerColor: owner?.color ?? null,
        canViewPrivateDetails,
        schips: actor.schipshtml?.() || [],
        prepare: {
          money: {
            coins: purse
              .sort((a, b) => b.system.price.value - a.system.price.value)
              .map((x) => ({
                _id: x.id,
                name: x.name,
                img: x.img,
                system: {
                  quantity: {
                    value: x.system.quantity.value,
                  },
                },
              })),
          },
        },
        system: {
          status: {
            wounds: { value: s.status?.wounds?.value ?? 0, max: s.status?.wounds?.max ?? 0 },
            astralenergy: { value: s.status?.astralenergy?.value ?? 0, max: s.status?.astralenergy?.max ?? 0 },
            karmaenergy: { value: s.status?.karmaenergy?.value ?? 0, max: s.status?.karmaenergy?.max ?? 0 },
          },
          isMage: !!s.isMage,
          isPriest: !!s.isPriest,
          details: {
            species: s.details?.species?.value ?? '',
            culture: s.details?.culture?.value ?? '',
            career: s.details?.career?.value ?? '',
            experience: {
              total: s.details?.experience?.total ?? 0,
              spent: s.details?.experience?.spent ?? 0,
            },
          },
          creatureClass: s.creatureClass?.value ?? '',
        },
        vantages,
      });
    }

    return members;
  }

  _prepareGroupCoins() {
    return this.actor.items
      .filter((i) => i.type === 'money')
      .sort((a, b) => b.system.price.value - a.system.price.value)
      .map((i) => ({ _id: i.id, name: i.name, img: i.img, quantity: i.system.quantity.value }));
  }

  _prepareGroupSkillsData() {
    const groupSkills = this.actor.system.groupSkills;
    return Object.values(groupSkills).sort((a, b) => a.name.localeCompare(b.name)).map((skill) => {
      const all = [skill.best, ...skill.others].sort((a, b) => b.value - a.value);
      const visible = all.filter((entry) => this.constructor.canViewActorSkillValues(entry.actor));
      const values = visible.map((entry) => entry.value);
      const tooltipHtml = `<table><tbody>${all.map((entry) => {
        const canViewValue = this.constructor.canViewActorSkillValues(entry.actor);
        const value = canViewValue ? `<b>${entry.value}</b>` : '?';
        return `<tr><td>${escapeHTML(entry.actor.name)}</td><td style="text-align:right;padding-left:8px">${value}</td></tr>`;
      }).join('')}</tbody></table>`;

      return {
        name: skill.name,
        icon: skill.icon,
        category: skill.category,
        valueDisplay: this.constructor.groupSkillValueDisplay(values),
        tooltipHtml,
      };
    });
  }

  static groupSkillValueDisplay(values) {
    if (!values.length) return '?';

    const min = Math.min(...values);
    const max = Math.max(...values);
    return min === max ? `${max}` : `${min}/${max}`;
  }

  static canViewActorSkillValues(actor) {
    return game.user.isGM || actor.testUserPermission(game.user, 'OBSERVER');
  }

  _groupSkillsByCategory(skills) {
    const leftCats = ['body', 'social', 'nature'];
    const rightCats = ['knowledge', 'trade'];
    const left = {};
    const right = {};
    for (const cat of leftCats) left[cat] = [];
    for (const cat of rightCats) right[cat] = [];
    for (const skill of skills) {
      const cat = skill.category || 'other';
      if (left[cat]) left[cat].push(skill);
      else if (right[cat]) right[cat].push(skill);
      else {
        right[cat] ??= [];
        right[cat].push(skill);
      }
    }
    for (const cat of Object.keys(left)) { if (!left[cat].length) delete left[cat]; }
    for (const cat of Object.keys(right)) { if (!right[cat].length) delete right[cat]; }
    return { left, right };
  }

  async _prepareEnrichedFields(context) {
    for (const { key, path } of this.constructor.propertiesToEnrich) {
      const value = foundry.utils.getProperty(this.actor.system, path);
      context[key] = await TextEditor.enrichHTML(value || '', {
        secrets: game.user.isGM,
        relativeTo: this.actor,
      });
    }
  }

  async _onDropActor(event, data) {
    const actor = await fromUuid(data.uuid);
    if (!actor) return;

    if (GroupData.isValidLocation(actor)) {
      await this.actor.system.addLocation(actor);
    } else {
      await this.actor.system.addMember(actor);
    }
  }

  async _onDropItem(event, data) {
    if (data.fromLocationKey) return;

    const system = this.actor.system;
    if (system.resolvedLocations.length === 0) {
      ui.notifications.warn('GROUP.noLocations', { localize: true });
      return;
    }

    const locationEl = event.target.closest('[data-location-key]');
    let targetLoc;
    if (locationEl) {
      const key = locationEl.dataset.locationKey;
      targetLoc = system.resolvedLocations.find((l) => l.key === key);
    }
    targetLoc ??= system.resolvedLocations[0];

    if (targetLoc?.locked) {
      ui.notifications.warn('GROUP.locationLocked', { localize: true });
      return;
    }

    if (targetLoc?.actor) {
      await targetLoc.actor.sheet._onDropItem(event, data);
    }
  }

  static #removeMember(event, target) {
    const key = target.closest('[data-member-key]')?.dataset.memberKey;
    if (key) this.actor.system.removeMember(key);
  }

  static #heroLink(event, target) {
    const uuid = target.closest('[data-uuid]')?.dataset.uuid;
    if (uuid) {
      const actor = fromUuidSync(uuid);
      actor?.sheet?.render(true);
    }
  }

  static async #addLocation(event, target) {
    if (!game.user.isGM) return;
    const defaultName = `${this.actor.name} — ${_loc('GROUP.inventory')}`;
    const content = `<form>
      <p class="hint">${_loc('GROUP.depotHint')}</p>
      <div class="form-group">
        <label>${_loc('Name')}</label>
        <input type="text" name="name" value="${defaultName}" autofocus />
      </div>
    </form>`;

    const name = await foundry.applications.api.DialogV2.prompt({
      window: { title: 'GROUP.addLocation' },
      content,
      ok: {
        label: _loc('ok'),
        callback: (event, button) => button.form.elements.name.value.trim(),
      },
    });
    if (!name) return;
    await this.actor.system.createAndLinkLocation(name, '', 'loot');
  }

  static #removeLocation(event, target) {
    if (!game.user.isGM) return;
    const key = target.closest('[data-location-key]')?.dataset.locationKey;
    if (key) this.actor.system.removeLocation(key);
  }

  static #openLocationSheet(event, target) {
    const key = target.closest('[data-location-key]')?.dataset.locationKey;
    if (key) {
      const actor = this.actor.system.locationActors.get(key);
      actor?.sheet?.render(true);
    }
  }

  static #toggleLocationLock(event, target) {
    const key = target.closest('[data-location-key]')?.dataset.locationKey ?? target.dataset.locationKey;
    if (!key) return;
    const loc = this.actor.system.locations[key];
    if (!loc) return;
    const locked = !loc.locked;
    this.actor.update({ [`system.locations.${key}.locked`]: locked });
    const actor = this.actor.system.locationActors.get(key);
    if (actor?.isMerchant()) {
      actor.update({
        'system.merchant.locked': locked,
        'system.merchant.hidePlayer': locked,
      });
    }
  }

  static #setLocationType(event, target) {
    const key = target.dataset.locationKey;
    const type = target.dataset.type;
    if (!key || !type) return;
    const current = this.actor.system.locations[key]?.type;
    this.actor.system.setLocationType(key, current === type ? '' : type);
  }

  static #resetTravelMode(event, target) {
    const mode = target.dataset.mode;
    if (!mode) return;
    const updates = {};
    for (const [key, loc] of Object.entries(this.actor.system.locations)) {
      if (loc.type === mode) updates[`system.locations.${key}.type`] = '';
    }
    if (Object.keys(updates).length) this.actor.update(updates);
  }

  static async #rollGroupCheck(event, target) {
    const skill = target.closest('[data-skill]')?.dataset.skill;
    if (!skill) return;
    ChatCommandService.groupCheck(skill, 0);
  }

  static #requestSkillRoll(event, target) {
    const skill = target.closest('[data-skill]')?.dataset.skill;
    if (!skill) return;
    RollRequestService.requestRoll(skill, 0);
  }

  static async #createEventsJournal() {
    const dateContext = game.time.calendar.timeToComponents(game.time.worldTime);
    await DSACalendarEntry.startCreation(null, dateContext);
  }

  static #groupHelperAction(event, target) {
    const trigger = target.closest('[data-group-helper]');
    const helperId = trigger?.dataset?.groupHelper;
    if (!helperId) return;
    const helper = GroupAPI.helpers.get(helperId);
    helper?.execute(this.actor, event, trigger.dataset);
  }

  static async #awardAP() {
    GroupActorSheet.doGroupAwardAP(this.actor);
  }

  static async #groupPayment(event, target) {
    if (!game.user.isGM) return;
    GroupActorSheet.doGroupPayment(this.actor, true);
  }

  static async doGroupPayment(groupActor, pay, amount = 0, preselectActors = null) {
    if (!game.user.isGM) return;
    const preselected = preselectActors
      ? ActorPickerDialog.buildActorPickerData({
          actors: (Array.isArray(preselectActors) ? preselectActors : [preselectActors]).filter(Boolean),
        }).map((a) => ({ ...a, preselected: true }))
      : [];

    const header = await renderTemplate('systems/dsa5/templates/dialog/parts/payment-amount-input.hbs', {
      amount,
      description: '',
      text: _loc(pay ? 'MASTER.payText' : 'MASTER.getPaidText', { heros: _loc('MASTER.theGroup') }),
    });

    ActorPickerDialog.open({
      groupActor,
      actors: preselected,
      showSourceToggle: true,
      title: pay ? 'MASTER.payTT' : 'PAYMENT.payButton',
      header,
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

  static async doGroupAwardAP(groupActor, amount = 0, preselectActors = null) {
    const preselected = preselectActors
      ? ActorPickerDialog.buildActorPickerData({
          actors: (Array.isArray(preselectActors) ? preselectActors : [preselectActors]).filter(Boolean),
        }).map((a) => ({ ...a, preselected: true }))
      : [];

    const header = await renderTemplate('systems/dsa5/templates/dialog/parts/amount-input.hbs', {
      amount,
      text: _loc('MASTER.awardXPText', { heros: _loc('MASTER.theGroup') }),
    });

    ActorPickerDialog.open({
      groupActor,
      actors: preselected,
      showSourceToggle: true,
      title: 'MASTER.awardXP',
      header,
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
        if (heros.length > 0) message.push(_loc('MASTER.xpMessage', { heros: heros.map((x) => x.name).join(', '), number }));
        if (familiars.length > 0) message.push(_loc('MASTER.xpMessage', { heros: familiars.map((x) => x.name).join(', '), number: familiarXP }));
        if (pets.length > 0) message.push(_loc('MASTER.xpMessage', { heros: pets.map((x) => x.name).join(', '), number: petXP }));

        if (message.length > 0) await ChatMessage.create(DSA5_Utility.chatDataSetup(`<p>${message.join('</p><p>')}</p>`));
      },
    });
  }

  static async #setPrimaryParty() {
    const current = game.settings.get('dsa5', 'primaryParty');
    const newValue = current === this.actor.uuid ? '' : this.actor.uuid;
    await game.settings.set('dsa5', 'primaryParty', newValue);
    this.render();
  }

  static async #randomMember(event, target) {
    const actors = [...this.actor.system.actors];
    const resultId = await GroupData.pickRandomMember(actors, { withMisfortune: event.button === 2 });
    if (!resultId) return;

    const icon = target.querySelector('i') || target;
    icon.classList.add('fa-spin');
    this.element.querySelectorAll('.hero').forEach((el) => el.classList.remove('victim'));

    setTimeout(() => {
      this.element.querySelector(`.hero[data-id="${resultId}"]`)?.classList.add('victim');
      icon.classList.remove('fa-spin');
    }, 500);
  }

  static #chCollapse(event, target) {
    $(target).find('i').toggleClass('fa-angle-up fa-angle-down');
    $(target).closest('.groupbox').find('.row-section:nth-child(2)').fadeToggle();
  }

  static async #shareOwnership() {
    const ownership = { ...this.actor.ownership };
    for (const user of game.users) {
      if (!user.isGM) ownership[user.id] = CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER;
    }
    await this.actor.update({ ownership });
    ui.notifications.info('GROUP.ownershipShared', { localize: true });
  }

  static async #openItem(event, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const item = await fromUuid(uuid);
    item?.sheet?.render(true);
  }

  static async #openLocationItem(event, target) {
    const locKey = target.dataset.locationKey || target.closest('[data-location-key]')?.dataset.locationKey;
    if (locKey) {
      const loc = this.actor.system.locations[locKey];
      if (loc?.locked && !game.user.isGM) return;
    }
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const item = await fromUuid(uuid);
    item?.sheet?.render(true);
  }

  static async _locationItemContextMenu(event, target) {
    event.preventDefault();
    event.stopPropagation();

    const row = target.closest('.location-item-row');
    if (!row) return;

    const app = this;
    const uuid = row.dataset.uuid;
    if (!uuid) return;

    const menuItems = GroupActorSheet.#getLocationItemContextOptions(app.actor, uuid);
    if (!menuItems.length) {
      const item = fromUuidSync(uuid);
      const loc = GroupActorSheet.#findResolvedLocation(app.actor, item?.parent);
      if (loc?.locked && !game.user.isGM) {
        ui.notifications.warn('GROUP.locationLocked', { localize: true });
      }
      return;
    }

    const menu = new foundry.applications.ux.ContextMenu(app.element, '', menuItems, { jQuery: false, fixed: true, eventName: 'none' });
    ui.context?.close();
    await menu.render(target, { animate: true });
    ui.context = menu;
  }

  #bindDepotPermissionDialog(dialog, locActor, refreshContent) {
    const el = dialog.element;
    const app = this;
    if (el.dataset.depotPermBound) return;
    el.dataset.depotPermBound = 'true';
    el.addEventListener('click', async (ev) => {
      const allowBtn = ev.target.closest('[data-action="depotAllowUser"]');
      if (allowBtn) {
        ev.preventDefault();
        await GroupData.setDepotUserPermission(
          locActor,
          [allowBtn.dataset.userId],
          !allowBtn.classList.contains('fa-check-circle'),
        );
        await refreshContent(dialog);
        app.render();
        return;
      }
      const allBtn = ev.target.closest('[data-action="depotAllowAll"]');
      if (allBtn) {
        ev.preventDefault();
        const allow = allBtn.dataset.lock === 'true';
        const ids = game.users.filter((user) => !user.isGM).map((user) => user.id);
        await GroupData.setDepotUserPermission(locActor, ids, allow);
        await refreshContent(dialog);
        app.render();
      }
    });
  }

  static async #depotPermissions(event, target) {
    if (!game.user.isGM) return;
    const locKey = target.closest('[data-location-key]')?.dataset.locationKey ?? target.dataset.locationKey;
    const locActor = this.actor.system.locationActors.get(locKey);
    if (!locActor) return;
    const app = this;

    const refreshContent = async (dialog) => {
      const container = dialog.element.querySelector('.depot-permissions-content');
      if (!container) return;
      container.innerHTML = await renderTemplate(GroupActorSheet.DEPOT_PERMISSIONS_TEMPLATE, {
        document: locActor,
        players: GroupData.getDepotPermissionPlayers(locActor),
      });
    };

    await foundry.applications.api.DialogV2.wait({
      window: { title: 'GROUP.depotPermissions' },
      content: '<div class="depot-permissions-content"></div>',
      buttons: [
        {
          action: 'close',
          icon: 'fas fa-times',
          label: 'close',
          callback: () => null,
        },
      ],
      render: async (_event, dialog) => {
        app.#bindDepotPermissionDialog(dialog, locActor, refreshContent);
        await refreshContent(dialog);
      },
    });
    app.render();
  }

  static transferLootItem(source, target, item, buy) {
    const amount = Number(item.system.quantity?.value) || 1;
    if (game.user.isGM) {
      return MerchantSheetDSA5.finishTransaction(source, target, 0, item.id, buy, amount);
    }
    game.socket.emit('system.dsa5', {
      type: 'trade',
      payload: {
        target: MerchantSheetDSA5.transferTokenData(target),
        source: MerchantSheetDSA5.transferTokenData(source),
        price: 0,
        itemId: item.id,
        buy,
        amount,
      },
    });
  }

  static async takeLocationItem(groupActor, itemUuid) {
    const character = game.user.character;
    if (!character) {
      ui.notifications.warn('DIALOG.noTarget', { localize: true });
      return;
    }
    const item = fromUuidSync(itemUuid);
    const locActor = item?.parent;
    if (!item || !GroupData.isLootDepotActor(locActor)) return;

    const loc = GroupActorSheet.#findResolvedLocation(groupActor, locActor);
    if (loc?.locked) {
      ui.notifications.warn('GROUP.locationLocked', { localize: true });
      return;
    }

    this.transferLootItem(locActor, character, item, true);
  }

  static async passItemToGroup(actor, item) {
    const partyUuid = game.settings.get('dsa5', 'primaryParty');
    if (!partyUuid) return;
    const party = fromUuidSync(partyUuid);
    if (!party) return;

    const unlockedLoot = GroupData.getUnlockedLootDepots(party);
    if (unlockedLoot.length === 0) {
      ui.notifications.warn('GROUP.noLootDepots', { localize: true });
      return;
    }

    let targetLoc;
    if (unlockedLoot.length === 1) {
      targetLoc = unlockedLoot[0];
    } else {
      const options = unlockedLoot.map((l) => `<option value="${l.key}">${l.name}</option>`).join('');
      const content = `<form><div class="form-group"><label>${_loc('GROUP.selectLocation')}</label><select name="locKey">${options}</select></div></form>`;
      const key = await foundry.applications.api.DialogV2.prompt({
        window: { title: 'GROUP.passToGroup' },
        content,
        ok: {
          label: _loc('ok'),
          callback: (event, button) => button.form.elements.locKey.value,
        },
      });
      if (!key) return;
      targetLoc = unlockedLoot.find((l) => l.key === key);
    }

    if (!targetLoc?.actor || !actor.isOwner) return;
    this.transferLootItem(actor, targetLoc.actor, item, false);
  }

  static async #tradeWithDepot(event, target) {
    const locKey = target.closest('[data-location-key]')?.dataset.locationKey;
    if (!locKey) return;
    const loc = this.actor.system.locations[locKey];
    if (loc?.locked) return;

    const locActor = this.actor.system.locationActors.get(locKey);
    if (!locActor) return;

    const ownedMembers = [...this.actor.system.actors].filter((a) => a.isOwner);
    if (!ownedMembers.length) {
      ui.notifications.warn('DIALOG.noTarget', { localize: true });
      return;
    }

    const openMerchant = async (actor) => {
      if (!locActor.getFlag('core', 'sheetClass')) {
        await locActor.setFlag('core', 'sheetClass', 'dsa5.MerchantSheetDSA5');
      }
      locActor.sheet.setTradeFriend(actor);
      locActor.sheet.render(true);
    };

    if (ownedMembers.length === 1) {
      openMerchant(ownedMembers[0]);
    } else {
      ActorPickerDialog.open({
        groupActor: this.actor,
        showSourceToggle: true,
        title: 'GROUP.tradeWithDepot',
        selectionMode: 'single',
        callback: ({ actorIds }) => {
          const actor = game.actors.get(actorIds[0]);
          if (actor) openMerchant(actor);
        },
      });
    }
  }

  static async #groupGetPaid(event, target) {
    if (!game.user.isGM) return;
    GroupActorSheet.doGroupPayment(this.actor, false);
  }

  static #heroSchip(event, target) {
    const memberEl = target.closest('[data-uuid]');
    if (!memberEl) return;
    const actor = fromUuidSync(memberEl.dataset.uuid);
    if (!actor) return;
    const clickedVal = Number(target.dataset.val);
    const current = actor.system.status.fatePoints.value;
    const newVal = clickedVal === current && clickedVal === 1 ? 0 : clickedVal;
    actor.update({ 'system.status.fatePoints.value': newVal });
  }

  static async #heroContextMenu(event, target) {
    const memberEl = target.closest('[data-id]');
    if (!memberEl) return;
    const uuid = memberEl.dataset.uuid;
    const actor = fromUuidSync(uuid);
    if (!actor) return;

    const app = this;
    const menu = new foundry.applications.ux.ContextMenu(this.element, '', [
      {
        label: _loc('CHAT.MODES.blind'),
        icon: '<i class="fas fa-dice"></i>',
        onClick: () => GroupActorSheet.rollBlindForActor(actor),
      },
      {
        label: _loc('PAYMENT.wage'),
        icon: '<i class="fas fa-piggy-bank"></i>',
        onClick: () => GroupActorSheet.doGroupPayment(app.actor, false, 0, actor),
      },
      {
        label: _loc('MASTER.payTT'),
        icon: '<i class="fas fa-coins"></i>',
        onClick: () => GroupActorSheet.doGroupPayment(app.actor, true, 0, actor),
      },
      {
        label: _loc('MASTER.awardXP'),
        icon: '<i class="fas fa-trophy"></i>',
        onClick: () => GroupActorSheet.doGroupAwardAP(app.actor, 0, actor),
      },
      {
        label: _loc('SHEET.DeleteItem'),
        icon: '<i class="fas fa-trash"></i>',
        onClick: () => {
          const key = memberEl.dataset.memberKey;
          if (key) app.actor.system.removeMember(key);
        },
      },
    ], { jQuery: false, fixed: true, eventName: 'none' });
    ui.context?.close();
    await menu.render(target, { animate: true });
    ui.context = menu;
  }

  static async #changeGroupSchip(event, target) {
    const clickedVal = Number(target.dataset.val);
    const raw = game.settings.get('dsa5', 'groupschips');
    const [currentStr, maxStr] = raw.split('/');
    let current = Number(currentStr);
    const max = Number(maxStr);
    if (clickedVal === current && clickedVal === 1) current = 0;
    else current = clickedVal;
    await game.settings.set('dsa5', 'groupschips', `${current}/${max}`);
    this.render();
  }

  static async #addGroupSchipCount(event, target) {
    const delta = Number(target.dataset.value);
    const raw = game.settings.get('dsa5', 'groupschips');
    const [currentStr, maxStr] = raw.split('/');
    let current = Number(currentStr);
    let max = Number(maxStr) + delta;
    if (max < 0) max = 0;
    if (current > max) current = max;
    await game.settings.set('dsa5', 'groupschips', `${current}/${max}`);
    this.render();
  }

  static async rollBlindForActor(actor) {
    const actors = ActorPickerDialog.buildActorPickerData({ actors: [actor] }).map((a) => ({ ...a, preselected: true }));
    ChatCommandService.openSkillActorDialog('CHAT.MODES.blind', {
      actors,
      onSubmit: (name, type, modifier, actorIds) => {
        for (const id of actorIds) {
          const a = game.actors.get(id);
          if (a) {
            ChatCommandService.executeAbilityRoll(a, name, type, undefined, {
              messageMode: DICE_CONSTANTS.CHAT_MODES.BLIND,
              subtitle: ` (${a.name})`,
              modifier,
            });
          }
        }
      },
    });
  }

  static async #rollAllBlind(event, target) {
    const groupActors = [...this.actor.system.actors];
    if (!groupActors.length) return;
    const actors = ActorPickerDialog.buildActorPickerData({ actors: groupActors }).map((a) => ({ ...a, preselected: true }));
    ChatCommandService.openSkillActorDialog('CHAT.MODES.blind', {
      actors,
      onSubmit: (name, type, modifier, actorIds) => {
        for (const id of actorIds) {
          const a = game.actors.get(id);
          if (a) {
            ChatCommandService.executeAbilityRoll(a, name, type, undefined, {
              messageMode: DICE_CONSTANTS.CHAT_MODES.BLIND,
              subtitle: ` (${a.name})`,
              modifier,
            });
          }
        }
      },
    });
  }

  static #rollRegeneration(event, target) {
    RollRequestService.requestRoll(_loc('regenerate'), 0);
  }

  static #requestAttributeRoll(event, target) {
    const attr = target.dataset.attr;
    if (!attr) return;
    const name = _loc(game.dsa5.config.characteristics[attr]);
    RollRequestService.requestRoll(name, 0);
  }

  async _prepareAbilities() {
    if (!this._abilities) {
      const skills = await DSA5_Utility.allSkillsList();
      this._abilities = skills
        .map((x) => ({ name: x, type: 'skill' }))
        .concat(
          Object.values(game.dsa5.config.characteristics)
            .map((x) => ({ name: _loc(x), type: 'attribute' })),
          { name: _loc('regenerate'), type: 'regeneration' },
        )
        .map((x) => {
          x.key = `${x.name}|${x.type}`;
          return x;
        });
    }
    return this._abilities;
  }
}
