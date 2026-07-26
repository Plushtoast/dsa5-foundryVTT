import Actordsa5 from '../actor/actor-dsa5.js';
import CompanionHandler from '../actor/companions/companion-handler-class.js';
import { DefaultAppv2 } from '../actor/baseapp.js';
import OpposedDsa5 from '../system/rolls/opposed-dsa5.js';
import RuleChaos from '../system/rules/rule_chaos.js';
import TraitRulesDSA5 from '../system/rules/trait-rules-dsa5.js';
import DSA5_Utility from '../system/helpers/utility-dsa5.js';
import CreatureType from '../system/automation/creature-type.js';
import { tabSlider } from '../system/helpers/view_helper.js';
import { PlayerMenuSubApp } from './player_menu_subapps.js';
import { CONJURATION_TYPES, CONJURATION_CONTROL_MODES, controlModeForType } from '../config/conjuration-constants.js';

const { getProperty, setProperty, mergeObject, duplicate } = foundry.utils;
const { renderTemplate } = foundry.applications.handlebars;

/** Partial chain shared by the Beschwörung tab and the GM confirmation dialog. */
const conjurationPartTemplates = [
  'systems/dsa5/templates/system/conjuration/parts/summary.hbs',
  'systems/dsa5/templates/system/conjuration/parts/creature-card.hbs',
  'systems/dsa5/templates/system/conjuration/parts/type-picker.hbs',
  'systems/dsa5/templates/system/conjuration/parts/rituals.hbs',
  'systems/dsa5/templates/system/conjuration/parts/extensions.hbs',
  'systems/dsa5/templates/system/conjuration/parts/selection-list.hbs',
];

//TODO magical weapon resistance

export default class PlayerMenu extends DefaultAppv2 {
  constructor(app) {
    super(app);
    this.entityAbilities = [];
    this.summoningPhase = 'ritual';

    game.dsa5.apps.PlayerMenuSubApp = PlayerMenuSubApp;
    this.summoningModifiers = [
      {
        id: 1,
        name: 'CONJURATION.offensiveImprovement',
        descr: 'CONJURATION.offensiveImprovementDescr',
        changes: [
          { key: 'system.meleeStats.attack', type: 'add', value: 2 },
          { key: 'system.meleeStats.damage', type: 'add', value: 4 },
          { key: 'system.rangeStats.attack', type: 'add', value: 2 },
          { key: 'system.rangeStats.damage', type: 'add', value: 4 },
        ],
      },
      {
        id: 2,
        name: 'CONJURATION.defensiveImprovement',
        descr: 'CONJURATION.defensiveImprovementDescr',
        changes: [
          { key: 'system.meleeStats.parry', type: 'add', value: 2 },
          { key: 'system.totalArmor', type: 'add', value: 2 },
          { key: 'system.status.wounds.gearmodifier', type: 'add', value: 10 },
        ],
      },
      {
        id: 3,
        name: 'CONJURATION.speedImprovement',
        descr: 'CONJURATION.speedImprovementDescr',
        changes: [
          { key: 'system.status.speed.gearmodifier', type: 'add', value: 2 },
          { key: 'system.status.dodge.gearmodifier', type: 'add', value: 2 },
        ],
      },
      {
        id: 4,
        name: 'CONJURATION.magicalImprovement',
        descr: 'CONJURATION.magicalImprovementDescr',
        changes: [],
        fun: RuleChaos.magicalImprovement,
      },
      {
        id: 5,
        name: 'CONJURATION.resistanceImprovement',
        descr: 'CONJURATION.resistanceImprovementDescr',
        changes: [
          { key: 'system.status.soulpower.gearmodifier', type: 'add', value: 2 },
          { key: 'system.status.toughness.gearmodifier', type: 'add', value: 2 },
        ],
      },
      {
        id: 6,
        name: 'CONJURATION.mentalImprovement',
        descr: 'CONJURATION.mentalImprovementDescr',
        changes: [
          { key: 'system.characteristics.mu.gearmodifier', type: 'add', value: 2 },
          { key: 'system.characteristics.kl.gearmodifier', type: 'add', value: 2 },
          { key: 'system.characteristics.in.gearmodifier', type: 'add', value: 2 },
          { key: 'system.characteristics.ch.gearmodifier', type: 'add', value: 2 },
        ],
      },
      {
        id: 7,
        name: 'CONJURATION.physicalImprovement',
        descr: 'CONJURATION.physicalImprovementDescr',
        changes: [
          { key: 'system.characteristics.ff.gearmodifier', type: 'add', value: 2 },
          { key: 'system.characteristics.ge.gearmodifier', type: 'add', value: 2 },
          { key: 'system.characteristics.ko.gearmodifier', type: 'add', value: 2 },
          { key: 'system.characteristics.kk.gearmodifier', type: 'add', value: 2 },
        ],
      },
    ];

    (this.conjurationData = {
      qs: 0,
      consumedQS: 0,
      packageModifier: 0,
      rollAttempted: false,
      selectedIds: [],
      selectedEntityIds: [],
      selectedPackageIds: [],
      conjurationTypes: {
        [CONJURATION_TYPES.DEMON]: _loc('CONJURATION.demon'),
        [CONJURATION_TYPES.ELEMENTAL]: _loc('CONJURATION.elemental'),
      },
      rules: {
        [CONJURATION_TYPES.DEMON]: {
          de: { pack: 'dsa5-core.corerules', name: 'Beschwörungen' },
          en: { pack: 'dsa5-core.coreenrules', name: 'Summoning' },
        },
        [CONJURATION_TYPES.ELEMENTAL]: {
          de: { pack: 'dsa5-core.corerules', name: 'Beschwörungen' },
          en: { pack: 'dsa5-core.coreenrules', name: 'Summoning' },
        },
      },
      conjurationType: CONJURATION_TYPES.DEMON,
      skills: {
        [CONJURATION_TYPES.DEMON]: ['invocatioMinima', 'invocatioMinor', 'invocatioMaior'].map((x) => _loc(`LocalizedIDs.${x}`)),
        [CONJURATION_TYPES.ELEMENTAL]: [
          'manifesto',
          'elementalServant',
          'callDjinn',
          'elementalAlly',
          'servantEarth',
          'servantFlame',
          'servantCold',
          'servantWave',
          'servantCloud',
          'servantOre',
        ].map((x) => _loc(`LocalizedIDs.${x}`)),
      },
      modifiers: {
        [CONJURATION_TYPES.DEMON]: this.summoningModifiers,
        [CONJURATION_TYPES.ELEMENTAL]: this.summoningModifiers,
      },
      moreModifiers: {
        [CONJURATION_TYPES.ELEMENTAL]: [
          {
            name: _loc('CONJURATION.groupSummoning'),
            options: [1, 2, 3, 4, 5, 6, 7, 8].map((x) => {
              return { name: x, val: x * -2 + 2 };
            }),
          },
        ],
      },
      // Placeholder visuals: `img` stays null until creature art is available, the icon is the fallback.
      typeVisuals: {
        [CONJURATION_TYPES.DEMON]: { icon: 'fas fa-fire-flame-curved', img: null },
        [CONJURATION_TYPES.ELEMENTAL]: { icon: 'fas fa-wind', img: null },
      },
      typeHints: {
        [CONJURATION_TYPES.DEMON]: 'CONJURATION.hint.demon',
        [CONJURATION_TYPES.ELEMENTAL]: 'CONJURATION.hint.elemental',
      },
      postFunction: {},
    }),
      (this.subApps = []);
  }

  registerSubApp(app) {
    this.subApps.push(app);
  }

  /**
   * Capability badges under the actor name. Built-in Beschwörer plus every registered subapp's
   * {@link PlayerMenuSubApp.addBadge} result (so badges only appear while that subapp is loaded).
   */
  #prepareActorBadges() {
    if (!this.actor) return [];

    const badges = [];
    if (this.#actorHasConjurationSkills()) {
      badges.push({
        label: 'PLAYER.badge.conjurer',
        icon: 'fas fa-hat-wizard',
        tooltip: 'PLAYER.badge.conjurer',
        tab: 'elementals',
      });
    }

    for (const app of this.subApps) {
      const badge = app.addBadge?.(this.actor);
      if (!badge) continue;
      badges.push({
        label: badge.label,
        icon: badge.icon || 'fas fa-tag',
        tooltip: badge.tooltip || badge.label,
        tab: badge.tab || app.tabName,
      });
    }

    return badges;
  }

  #actorHasConjurationSkills() {
    const ritualTypes = ['spell', 'ritual', 'liturgy', 'ceremony'];
    const skillNames = Object.values(this.conjurationData.skills || {}).flat();
    return this.actor.items.some((item) => ritualTypes.includes(item.type) && skillNames.includes(item.name));
  }

  /** @param {number|string} typeId */
  static controlModeForType(typeId) {
    return controlModeForType(typeId);
  }

  /** @param {number|string} typeId */
  static serviceCounterLabelKey(typeId) {
    return PlayerMenu.controlModeForType(typeId) === CONJURATION_CONTROL_MODES.REQUESTS ? 'PLAYER.requests' : 'PLAYER.services';
  }

  /** Rules explanation shown next to the Dienste/Bitten/Loyalität counter. @param {number|string} typeId */
  static controlModeHintKey(typeId) {
    return `CONJURATION.controlMode.${PlayerMenu.controlModeForType(typeId)}Hint`;
  }

  /** @param {number|string} typeId */
  static controlModeLabelKey(typeId) {
    return `CONJURATION.controlMode.${PlayerMenu.controlModeForType(typeId)}`;
  }

  /**
   * Card art for a conjuration type. Unregistered ids (from modules that only add skills) still render.
   * @param {number|string} typeId
   * @returns {{img: string|null, icon: string}}
   */
  static typeVisual(typeId) {
    const visual = game.dsa5.apps.playerMenu?.conjurationData?.typeVisuals?.[typeId] ?? {};
    return { img: visual.img ?? null, icon: visual.icon || 'fas fa-hat-wizard' };
  }

  /**
   * Überreden difficulty for Bitten (niedere −2, mittlere −4) from Mächtigkeit moreModifier if present.
   * @param {Array<{name: string, selected?: number|string}>} [moreModifiers]
   */
  static requestModifierFromMoreModifiers(moreModifiers = []) {
    const mightName = _loc('CONJURATION.mightyness');
    const might = moreModifiers.find((m) => m.name === mightName);
    if (!might) return -2;
    return Number(might.selected ?? 0) <= -2 ? -4 : -2;
  }

  /**
   * Summoning-scoped AE mods matched via CreatureType ids (Elemental, Demon, …).
   * @param {'services'|'difficulty'|'AsPCost'} key
   * @returns {Array<{name: string, value: number, source?: string, type?: string, selected?: boolean}>}
   */
  getConjurationModifiers(key) {
    if (!this.actor || !this.conjuration) return [];
    const mods = getProperty(this.actor.system, `skillModifiers.conjuration.${key}`) || [];
    return CreatureType.matchConjurationModifiers(this.conjuration, mods).map((m) => ({
      name: m.source || m.item || key,
      value: Number(m.value) || 0,
      source: m.source,
      type: key === 'AsPCost' ? 'AsPCost' : undefined,
      selected: true,
    }));
  }

  /** Base QS+1 services plus Affinity/Meister/etc. and optional Mehr Dienste extension. */
  calculateConjurationServices(qs = this.conjurationData.qs, consumedQS = this.conjurationData.consumedQS) {
    let services = Number(qs) - Number(consumedQS) + 1;
    for (const mod of this.getConjurationModifiers('services')) {
      services += mod.value;
    }
    if (this.actor && this.hasMoreServicesExtension()) services += 1;
    return services;
  }

  hasMoreServicesExtension() {
    if (!this.actor) return false;
    const label = _loc('CONJURATION.moreServices');
    const requiredSkills = this.conjurationData.skills[this.conjurationData.conjurationType] || [];
    return requiredSkills.some((skillName) => this.actor.items.find((x) => x.name === `${skillName} - ${label}`));
  }

  static async rollConjuration(ev, target) {
    if (!this.conjuration)
      return ui.notifications.warn('CONJURATION.dragConjuration', {
        localize: true,
      });

    const itemId = $(target).closest('.item').attr('data-item-id');
    const skill = this.actor.items.get(itemId);
    const moreModifiers = [
      {
        name: _loc('conjuringDifficulty'),
        value: getProperty(this.conjuration, 'system.conjuringDifficulty.value') || 0,
        selected: true,
      },
    ];
    // Difficulty/AsP from conjuration AEs are shown in the helper UI.
    // Roll ease/cost still come from skillModifiers.step / conditional|feature.AsPCost on the ritual.

    if (this.conjurationData.packageModifier)
      moreModifiers.push({
        name: _loc('summoningPackage'),
        value: this.conjurationData.packageModifier,
        selected: true,
      });

    if (this.conjurationData.moreModifiers[this.conjurationData.conjurationType]) {
      const mods = this.conjurationData.moreModifiers[this.conjurationData.conjurationType].filter((x) => x.selected);
      for (const mod of mods) {
        moreModifiers.push({
          name: mod.name,
          value: Number(mod.selected),
          selected: true,
        });
      }
    }

    const options = {
      moreModifiers,
      subtitle: ` (${this.conjuration.name})`,
      postFunction: {
        functionName: 'game.dsa5.apps.playerMenu.postConjurationRoll',
      },
    };
    this.actor.setupSkill(skill, options, undefined).then(async (setupData) => {
      const res = await this.actor.basicTest(setupData);
      this.#applyConjurationRollResult(res.result);
    });
  }

  postConjurationRoll(postFunction, result) {
    const menu = game.dsa5.apps.playerMenu;
    if (menu) {
      menu.#applyConjurationRollResult(result.result);
    }
  }

  #applyConjurationRollResult(result = {}) {
    this.conjurationData.rollAttempted = true;
    this.conjurationData.qs = Number(result.qualityStep) || 0;
    this.render(true);
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);

    tabSlider(html);

    html.find('.conjurationData').on('change', (ev) => {
      const elem = $(ev.currentTarget);
      const name = elem.attr('name');
      setProperty(this.conjurationData, name, elem.val());
      if (name === 'qs' && Number(elem.val()) > 0) this.conjurationData.rollAttempted = true;

      if (elem.attr('data-refresh')) this.render();
    });

    html.find('.item-edit').on('click', (ev) => {
      const itemId = $(ev.currentTarget).closest('.item').attr('data-item-id');
      const item = this.actor.items.get(itemId);
      item.sheet.render(true);
    });
    html.find('.selectableRow').on('click', (ev) => this.selectImprovement(ev));
    html.find('.finalizeConjuration').on('click', () => this.finalizeConjuration());

    html.find('.showCC').on('click', () => {
      const cc = new game.dsa5.apps.DSACharacterCalculator();
      cc.actor = this.actor;
      cc.render(true);
    });
    html.find('.showEntity').on('click', (ev) => {
      ev.stopPropagation();
      fromUuid(ev.currentTarget.dataset.uuid).then(itm => itm.sheet.render(true));
    });
    html.find('.moreModifiers').on('change', (ev) => {
      const mod = this.conjurationData.moreModifiers[this.conjurationData.conjurationType].find((x) => x.name == ev.currentTarget.dataset.name);
      mod.selected = $(ev.currentTarget).val();
    });

    new foundry.applications.ux.DragDrop.implementation({
      dropSelector: '.window-content',
      permissions: {
        drop: this._canDragDrop.bind(this)
      },
      callbacks: {
        drop: this._onDrop.bind(this)
      }
    }).bind(this.element);

    for (const app of this.subApps) {
      app._onRender(html);
    }
  }

  _canDragDrop() {
    return true;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);

    const subApp = this.subApps.find((x) => x.tabName == partId);
    if (subApp) {
      const data = await subApp._getData(context);
      Object.assign(context, data);
    }

    // Bind after subapp data so each tab part gets cssClass/group for its root .tab div.
    if (context.tabs?.[partId]) context.tab = context.tabs[partId];

    return context;
  }

  static async openRules(ev, target) {
    const subapp = target.dataset.subapp;
    const rule = (subapp ? this.subApps.find((x) => x.constructor.name == subapp).constructor.rulePath : this.conjurationData.rules[this.conjurationData.conjurationType])[
      game.i18n.lang
    ];
    const fun = async () => {
      const pack = game.packs.get(rule.pack);
      if (!pack) return ui.notifications.warn('DSAError.notFound', { format: { category: 'Pack', name: rule.pack }, localize: true });
      const docs = await pack.getDocuments({ name: rule.name });
      for (const doc of docs) {
        doc.sheet.render(true);
      }
    };
    fun();
  }

  finalizeConjuration() {
    if (!this.conjurationData) return;

    if (!this.conjuration)
      return ui.notifications.warn('DSAError.noConjurationActive', {
        localize: true,
      });

    if (Number(this.conjurationData.consumedQS) > Number(this.conjurationData.qs)) {
      return ui.notifications.warn('CONJURATION.blocker.overspent', { localize: true });
    }

    const modifiers = [];
    for (const sel of this.conjurationData.selectedIds) {
      modifiers.push(this.conjurationData.modifiers[this.conjurationData.conjurationType].find((x) => x.id == sel));
    }
    const moreModifiers = this.conjurationData.moreModifiers[this.conjurationData.conjurationType] || [];
    const payload = {
      source: this.conjuration.toObject(),
      creationData: {
        type: this.conjurationData.conjurationType,
        typeName: this.conjurationData.conjurationTypes[this.conjurationData.conjurationType],
        qs: this.conjurationData.qs,
        consumedQS: this.conjurationData.consumedQS,
        services: this.calculateConjurationServices(),
        controlMode: PlayerMenu.controlModeForType(this.conjurationData.conjurationType),
        requestModifier: PlayerMenu.requestModifierFromMoreModifiers(moreModifiers),
        modifiers,
        entityIds: this.conjurationData.selectedEntityIds,
        packageIds: this.conjurationData.selectedPackageIds,
      },
      summoner: { name: this.actor.name, img: this.actor.img, uuid: this.actor.uuid },
    };

    if (game.user.isGM) {
      PlayerMenu.createConjuration(payload);
    } else {
      game.socket.emit('system.dsa5', {
        type: 'summonCreature',
        payload,
      });
      ui.notifications.info('CONJURATION.requestSend', { localize: true });
    }
  }

  static createConjuration({ source, creationData, summoner }) {
    new ConjurationRequest(source, summoner, creationData).render(true);
  }

  selectImprovement(ev) {
    const max = Number(ev.currentTarget.dataset.max) || 1;
    const selected = Number(ev.currentTarget.dataset.selected) || 0;

    if (selected >= max) {
      $(ev.currentTarget).removeClass('selected');
    } else {
      $(ev.currentTarget).addClass('selected');
      ev.currentTarget.dataset.selected = selected + 1;
    }
    const selectedIds = [];
    const selectedEntityIds = [];
    const selectedPackageIds = [];
    let entityCost = 0;
    let packageModifier = 0;
    $(this.element)
      .find('.selectableRow.selected')
      .each((index, element) => {
        for (let i = 0; i < Number(element.dataset.selected); i++) {
          if (element.dataset.entityid) {
            selectedEntityIds.push(element.dataset.id);
            entityCost += (Number(element.dataset.qs) || 0) * -1;
          } else if (element.dataset.packageid) {
            selectedPackageIds.push(element.dataset.id);
            packageModifier += Number(element.dataset.mod) || 0;
          } else {
            selectedIds.push(Number(element.dataset.id));
          }
        }
      });
    this.conjurationData.selectedIds = selectedIds;
    this.conjurationData.selectedEntityIds = selectedEntityIds;
    this.conjurationData.selectedPackageIds = selectedPackageIds;
    this.conjurationData.consumedQS = selectedIds.length + entityCost;
    this.conjurationData.packageModifier = packageModifier;
    this.render();
  }

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'largeDialog', 'playerMenu', 'sheet'],
    window: {
      title: 'PLAYER.title',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: {
      width: 940,
      height: 820,
    },
    actions: {
      skillSelect: this.rollConjuration,
      ruleLink: this.openRules,
      openChar: this._onOpenChar,
      unhidePossibleSpells: this._unhidePossibleSpells,
      initLibrary: this._onInitLibrary,
      quickSelectActor: this.#quickSelectActor,
      unselectActor: this.#unselectActor,
      selectConjurationType: this.#selectConjurationType,
      openConjurationTypeMenu: this.#openConjurationTypeMenu,
      showEntity: this._onShowEntity,
      setSummoningPhase: this.#setSummoningPhase,
      openActorBadge: this.#openActorBadge,
      clearConjuration: this.#clearConjuration,
      selectFavoriteCreature: this.#selectFavoriteCreature,
    }
  };

  static #openActorBadge(ev, target) {
    const tab = target.dataset.tab;
    if (!tab) return;
    this.changeTab(tab, 'sheet');
  }

  static #clearConjuration() {
    this.conjuration = null;
    this.conjurationData.selectedIds = [];
    this.conjurationData.selectedEntityIds = [];
    this.conjurationData.selectedPackageIds = [];
    this.conjurationData.consumedQS = 0;
    this.conjurationData.packageModifier = 0;
    this.render(true);
  }

  static async #selectFavoriteCreature(ev, target) {
    const uuid = target.dataset.uuid;
    if (!uuid) return;
    const actor = await fromUuid(uuid);
    if (!actor) {
      ui.notifications.warn('DSAError.notFound', { format: { category: 'Actor', name: uuid }, localize: true });
      return;
    }
    PlayerMenu.#applyConjurationActor.call(this, actor);
  }

  /** @param {Actor} actor */
  static #applyConjurationActor(actor) {
    this.conjuration = actor;
    this.conjurationData.selectedIds = [];
    this.conjurationData.selectedEntityIds = [];
    this.conjurationData.selectedPackageIds = [];
    this.conjurationData.consumedQS = 0;
    this.conjurationData.packageModifier = 0;
    if (actor.type === 'creature') {
      for (const key of Object.keys(this.conjurationData.conjurationTypes)) {
        if (actor.system.creatureClass?.value?.includes(this.conjurationData.conjurationTypes[key])) {
          this.conjurationData.conjurationType = key;
          break;
        }
      }
    }
    this.render(true);
  }

  static #setSummoningPhase(ev, target) {
    const phase = target.dataset.phase;
    if (!phase || phase === this.summoningPhase) return;
    this.summoningPhase = phase;
    this.render(true);
  }

  static #selectConjurationType(ev, target) {
    const typeId = target.dataset.typeId;
    if (typeId === undefined || typeId === null) return;
    if (typeId === String(this.conjurationData.conjurationType)) return;

    this.conjurationData.conjurationType = typeId;
    this.conjurationData.selectedIds = [];
    this.conjurationData.selectedEntityIds = [];
    this.conjurationData.selectedPackageIds = [];
    this.conjurationData.consumedQS = 0;
    this.conjurationData.packageModifier = 0;
    this.conjurationData.rollAttempted = false;
    this.conjurationData.qs = 0;
    this.render(true);
  }

  static async #openConjurationTypeMenu(ev, target) {
    const app = this;
    const items = app.#prepareTypeCards().map((card) => ({
      label: card.name,
      icon: card.img
        ? `<img src="${card.img}" alt="" style="width:1em;height:1em;object-fit:contain" />`
        : `<i class="${card.icon}"></i>`,
      onClick: () => {
        PlayerMenu.#selectConjurationType.call(app, ev, { dataset: { typeId: String(card.id) } });
      },
    }));

    const contextMenu = new foundry.applications.ux.ContextMenu(this.element, '', items, {
      jQuery: false,
      fixed: true,
      eventName: 'none',
    });
    ui.context?.close();
    await contextMenu.render(target, { animate: true });
    ui.context = contextMenu;
  }

  static async _onShowEntity(ev, target) {
    const entity = await fromUuid(target.dataset.uuid);
    entity?.sheet.render(true);
  }

  static _onOpenChar(ev, target) {
    this.actor?.sheet.render(true);
  }

  static #quickSelectActor(ev, target) {
    const actorId = target.dataset.actorId;
    const actor = game.actors.get(actorId);
    if (actor) {
      this.trackedId = actor.id;
      this.actor = actor;
      this.render(true);
    }
  }

  static #unselectActor(ev, target) {
    this.actor = null;
    this.trackedId = null;
    this.render(true);
  }

  static TABS = {
    sheet: {
      tabs: [
        { id: 'elementals', label: 'PLAYER.conjuration' }
      ],
      initial: 'elementals',
    },
  }

  static PARTS = {
    header: {
      template: 'systems/dsa5/templates/system/playermenu/header.hbs',
    },
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs'
    },
    elementals: {
      template: 'systems/dsa5/templates/system/playermenu/summoning.hbs',
      templates: [...conjurationPartTemplates, 'systems/dsa5/templates/actors/parts/skillselect.hbs'],
      scrollable: ['']
    },
  };

  _configureRenderParts(options) {
    const parts = super._configureRenderParts(options);
    for (const app of this.subApps) {
      parts[app.tabName] = app.part;
    }
    return parts;
  }

  async _onDrop(event) {
    let data;
    try {
      data = JSON.parse(event.dataTransfer.getData('text/plain'));
      switch (data.type) {
        case 'Actor':
          data = await Actor.implementation.fromDropData(data);
          break;
        case 'Item':
          data = await Item.implementation.fromDropData(data);
          break;
      }
    } catch (err) {
      return false;
    }
    if (data.documentName == 'Actor') {
      const actor = data;

      if (actor.type == 'creature' || $(event.target).closest('.summoningArea').length > 0) {
        PlayerMenu.#applyConjurationActor.call(this, actor);
      } else {
        this.trackedId = data.id;
        this.actor = actor;
        this.render(true);
      }
    } else {
      for (const app of this.subApps) {
        const res = await app._onDrop(data);
        if (res === true) break;
      }
    }
  }

  async prepareEntityAbilities() {
    const data = { entityAbilities: [], entityPackages: [] };
    if (game.dsa5.itemLibrary.indexes.Item.build) {
      const entitiesToSearch = [_loc('LocalizedIDs.all'), this.conjurationData.conjurationTypes[this.conjurationData.conjurationType]];
      const items = await Promise.all((await game.dsa5.itemLibrary.getCategoryItems('trait', false, true)));

      const entitySet = new Set();
      const packageSet = new Set();
      for (const x of items) {
        if (x.system.distribution && entitiesToSearch.some((y) => x.system.distribution.includes(y))) {
          if (x.system.traitType.value == 'entity' && !entitySet.has(x.name)) {
            entitySet.add(x.name);
            data.entityAbilities.push(x);
            x.count = this.conjurationData.selectedEntityIds.filter((y) => y == x.uuid).length;
            x.max = x.system.at.value || 1;
          } else if (x.system.traitType.value == 'summoning' && !packageSet.has(x.name)) {
            packageSet.add(x.name);
            x.count = this.conjurationData.selectedPackageIds.filter((y) => y == x.uuid).length;
            data.entityPackages.push(x);
          }
        }
      }
    }
    return data;
  }

  async getAvailableActors() {
    const trackedActors = game.settings.get('dsa5', 'trackedActors');
    let actors;
    if (trackedActors.actors?.length > 0) {
      actors = game.actors
        .filter((x) => trackedActors.actors.includes(x.id))
        .sort((a, b) => trackedActors.actors.indexOf(a.id) - trackedActors.actors.indexOf(b.id));
    } else {
      actors = game.actors.filter((x) => x.hasPlayerOwner);
    }
    if (!game.user.isGM) actors = actors.filter((a) => a.isOwner);
    return actors;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    // Always rebuild sheet tabs (including registered subapps) so cssClass/group stay correct on re-render.
    data.tabs = this._prepareTabs('sheet');

    const availableActors = await this.getAvailableActors();
    if (!game.user.isGM && !this.actor) {
      if (availableActors.length === 1) this.actor = availableActors[0];
      else this.actor = game.user.character;
    }

    if (this.actor) {
      const services = this.calculateConjurationServices();
      const equipmentIndexLoaded = game.dsa5.itemLibrary.indexes.Item.build;
      const { entityAbilities, entityPackages } = await this.prepareEntityAbilities();
      const requiredSkills = this.conjurationData.skills[this.conjurationData.conjurationType]
      const conjurationskills = this.actor.items
        .filter((x) => requiredSkills.includes(x.name) && ['liturgy', 'ceremony', 'spell', 'ritual'].includes(x.type))
        .map((x) => x.toObject());
      const missingConjurationSkills = requiredSkills.filter((x) => !conjurationskills.some((y) => y.name == x));

      let hasMighty = false;
      for (const skill of conjurationskills) {
        skill.hasMighty = this.actor.items.find((x) => x.name == `${skill.name} - ${_loc('CONJURATION.powerfulCreature')}`);
        hasMighty ||= skill.hasMighty;
      }
      const conjurationModifiers = this.conjurationData.modifiers[this.conjurationData.conjurationType];
      const max = hasMighty ? 2 : 1;
      for (const mod of conjurationModifiers) {
        mod.max = max;
        mod.count = this.conjurationData.selectedIds.filter((x) => x == mod.id).length;
      }

      let moreModifiers = this.conjurationData.moreModifiers[this.conjurationData.conjurationType];

      if (moreModifiers) {
        moreModifiers = duplicate(moreModifiers);
        for (const item of moreModifiers) {
          item.options = item.options.map((x) => {
            x.label = `${x.name} (${x.val})`;
            return x;
          });
        }
      }

      const difficultyMods = this.getConjurationModifiers('difficulty');
      const aspMods = this.getConjurationModifiers('AsPCost');
      const serviceMods = this.getConjurationModifiers('services');
      if (this.hasMoreServicesExtension()) {
        serviceMods.push({ name: _loc('CONJURATION.moreServices'), value: 1 });
      }

      mergeObject(data, {
        conjurationskills,
        missingConjurationSkills,
        conjurationModifiers,
        entityAbilities,
        entityPackages,
        equipmentIndexLoaded,
        moreModifiers,
        hasMighty,
        summary: this.#prepareSummary({
          services,
          serviceMods,
          difficultyMods,
          aspMods,
          conjurationModifiers,
          entityAbilities,
          conjurationskills,
        }),
      });
    }

    const conjurationTypeCards = this.#prepareTypeCards();
    const phase = this.summoningPhase === 'extensions' ? 'extensions' : 'ritual';
    mergeObject(data, {
      actor: this.actor || {
        name: _loc('CONJURATION.dragActor'),
        img: 'icons/svg/mystery-man-black.svg',
      },
      conjurationData: this.conjurationData,
      conjurationTypes: this.conjurationData.conjurationTypes,
      conjurationTypeCards,
      selectedConjurationType: conjurationTypeCards.find((c) => c.selected),
      summoningPhase: phase,
      showRitualPhase: phase === 'ritual',
      showExtensionsPhase: phase === 'extensions',
      summoningPhases: [
        { id: 'ritual', label: 'CONJURATION.phase.ritual', icon: 'fas fa-scroll', active: phase === 'ritual' },
        { id: 'extensions', label: 'CONJURATION.phase.extensions', icon: 'fas fa-sparkles', active: phase === 'extensions' },
      ],
      canCalculate: DSA5_Utility.moduleEnabled('dsa5-core') && this.actor?.type == 'character',
      availableActors: availableActors.map((a) => ({ id: a.id, name: a.name, img: a.img })),
      showActorSwitcher: availableActors.length > 1 || game.user.isGM,
      actorBadges: this.#prepareActorBadges(),
      favoriteCreatures: CompanionHandler.listConjurationFavorites(this.actor),
    });
    return data;
  }

  /** Selectable creature-type cards for the Beschwörung tab. */
  #prepareTypeCards() {
    const selectedId = String(this.conjurationData.conjurationType);
    return Object.entries(this.conjurationData.conjurationTypes).map(([id, name]) => {
      const hintKey = this.conjurationData.typeHints?.[id];
      return {
        id,
        name,
        ...PlayerMenu.typeVisual(id),
        controlModeLabel: PlayerMenu.controlModeLabelKey(id),
        hint: hintKey ? _loc(hintKey) : '',
        selected: id === selectedId,
      };
    });
  }

  /**
   * Everything the summary rail needs: QS budget breakdown, difficulty, resulting services and
   * the reasons why finalizing is not possible yet. Shared shape with {@link ConjurationRequest}.
   */
  #prepareSummary({ services, serviceMods, difficultyMods, aspMods, conjurationModifiers, entityAbilities, conjurationskills }) {
    const typeId = this.conjurationData.conjurationType;
    const rawDifficulty = getProperty(this.conjuration, 'system.conjuringDifficulty.value') || 0;
    const difficultyTotal = difficultyMods.reduce((sum, m) => sum + m.value, 0);

    const costs = [];
    for (const id of this.conjurationData.selectedIds) {
      const mod = conjurationModifiers.find((x) => x.id == id);
      costs.push({ label: _loc(mod?.name ?? 'extensions'), cost: 1 });
    }
    for (const uuid of this.conjurationData.selectedEntityIds) {
      const ability = entityAbilities.find((x) => x.uuid == uuid);
      costs.push({ label: ability?.name ?? _loc('entityAbility'), cost: Number(ability?.system?.AsPCost?.value) || 0 });
    }

    const blockers = [];
    if (!this.conjuration) blockers.push('CONJURATION.blocker.noCreature');
    if (!conjurationskills.length) blockers.push('CONJURATION.blocker.noRitual');
    if (Number(this.conjurationData.qs) <= 0) {
      blockers.push(this.conjurationData.rollAttempted ? 'CONJURATION.blocker.failed' : 'CONJURATION.blocker.noQs');
    }

    const budget = PlayerMenu.buildBudget(this.conjurationData.qs, costs);
    if (budget.over) blockers.push('CONJURATION.blocker.overspent');

    const canFinalize = blockers.length === 0;
    return {
      typeId,
      typeName: this.conjurationData.conjurationTypes[typeId],
      serviceLabel: PlayerMenu.serviceCounterLabelKey(typeId),
      controlModeLabel: PlayerMenu.controlModeLabelKey(typeId),
      controlModeHintKey: PlayerMenu.controlModeHintKey(typeId),
      showServiceCounter: PlayerMenu.controlModeForType(typeId) !== CONJURATION_CONTROL_MODES.LOYALTY,
      services,
      serviceMods,
      aspMods,
      creature: {
        img: this.conjuration?.img || 'icons/svg/mystery-man-black.svg',
        name: this.conjuration?.name || _loc('CONJURATION.dragConjuration'),
        uuid: this.conjuration?.uuid,
        creatureClass: this.conjuration?.system?.creatureClass?.value,
        empty: !this.conjuration,
      },
      difficulty: {
        raw: rawDifficulty,
        effective: rawDifficulty + difficultyTotal + Number(this.conjurationData.packageModifier || 0),
        mods: difficultyMods,
      },
      budget,
      blockers,
      canFinalize,
      editableQs: true,
      readonly: false,
      hideCreature: false,
      rollAttempted: !!this.conjurationData.rollAttempted,
      nextStep: PlayerMenu.resolveNextStep({
        hasCreature: !!this.conjuration,
        hasRitual: conjurationskills.length > 0,
        qs: Number(this.conjurationData.qs) || 0,
        rollAttempted: !!this.conjurationData.rollAttempted,
        overspent: budget.over,
        remaining: budget.remaining,
        canFinalize,
      }),
    };
  }

  /**
   * Contextual next-step hint for the summoning summary avatar column.
   * @param {{hasCreature: boolean, hasRitual: boolean, qs: number, rollAttempted: boolean, overspent: boolean, remaining: number, canFinalize: boolean}} state
   * @returns {string|null}
   */
  static resolveNextStep({ hasCreature, hasRitual, qs, rollAttempted, overspent, remaining, canFinalize }) {
    if (!hasCreature) return 'CONJURATION.nextStep.pickCreature';
    if (!hasRitual) return 'CONJURATION.nextStep.needRitual';
    if (qs <= 0) return rollAttempted ? 'CONJURATION.nextStep.reroll' : 'CONJURATION.nextStep.rollSpell';
    if (overspent) return 'CONJURATION.nextStep.reduceMods';
    if (canFinalize) {
      return remaining > 0 ? 'CONJURATION.nextStep.pickModsOrFinalize' : 'CONJURATION.nextStep.finalize';
    }
    return 'CONJURATION.nextStep.pickMods';
  }

  /**
   * Turns the rolled QS and the QS cost of every selection into budget-bar segments.
   * @param {number|string} qs Rolled quality level.
   * @param {Array<{label: string, cost: number}>} costs
   */
  static buildBudget(qs, costs) {
    const total = Number(qs) || 0;
    const used = costs.reduce((sum, x) => sum + x.cost, 0);
    const remaining = total - used;
    const segments = [];

    for (const entry of costs) {
      if (entry.cost <= 0) continue;
      segments.push({
        kind: 'spent',
        span: entry.cost,
        short: entry.cost > 1 ? entry.cost : '',
        tooltip: `${entry.label} (${entry.cost} ${_loc('CHARAbbrev.QS')})`,
      });
    }

    if (remaining > 0) {
      segments.push({
        kind: 'free',
        span: remaining,
        short: remaining,
        tooltip: `${_loc('CONJURATION.budget.remaining')}: ${remaining}`,
      });
    } else if (remaining < 0) {
      segments.push({
        kind: 'over',
        span: Math.abs(remaining),
        short: remaining,
        tooltip: _loc('CONJURATION.blocker.overspent'),
      });
    }

    if (!segments.length) {
      segments.push({ kind: 'empty', span: 1, short: '', tooltip: _loc('CONJURATION.budget.empty') });
    }

    // Compact used/free bar for the Erweiterungen row (same numbers, alternate palette).
    const extensionSegments = [];
    if (used > 0) {
      extensionSegments.push({
        kind: 'spent',
        span: Math.min(used, Math.max(total, used)),
        short: used,
        tooltip: `${_loc('extensions')}: ${used}`,
      });
    }
    if (remaining > 0) {
      extensionSegments.push({
        kind: 'free',
        span: remaining,
        short: '',
        tooltip: `${_loc('CONJURATION.budget.remaining')}: ${remaining}`,
      });
    } else if (remaining < 0) {
      extensionSegments.push({
        kind: 'over',
        span: Math.abs(remaining),
        short: remaining,
        tooltip: _loc('CONJURATION.blocker.overspent'),
      });
    }
    if (!extensionSegments.length) {
      extensionSegments.push({ kind: 'empty', span: 1, short: '0', tooltip: _loc('CONJURATION.budget.empty') });
    }

    return { total, used, remaining, over: remaining < 0, segments, extensionSegments };
  }

  _prepareTabs(group) {
    const tabs = super._prepareTabs(group);
    if (group === 'sheet') {
      for (const app of this.subApps) {
        app.addTab(tabs, this.tabGroups.sheet, group);
      }
    }
    return tabs;
  }

  static async _onInitLibrary(ev, target) {
    $(target).html('<i class="fas fa-spin fa-spinner"></i>');
    await game.dsa5.itemLibrary.buildEquipmentIndex();
    this.render(true);
  }

  static _unhidePossibleSpells(ev, target) {
    this.element.querySelectorAll('.possibleSpell').forEach((x) => {
      x.classList.toggle('dsahidden');;
    });
  }
}

class ConjurationRequest extends DefaultAppv2 {
  constructor(conjuration, summoner, creationData) {
    super({
      window: { title: `${_loc('CONJURATION.request')} (${summoner.name})` },
    });
    this.conjuration = conjuration;
    this.summoner = summoner;
    this.creationData = creationData;
    this.confirmed = false;
  }

  async _prepareContext(_options) {
    const data = await super._prepareContext(_options);
    const uniqueIds = this.uniqueCountIds(this.creationData.entityIds);
    const controlMode = this.creationData.controlMode || PlayerMenu.controlModeForType(this.creationData.type);
    const typeId = this.creationData.type;

    const entityModifiers = await Promise.all(
      Object.keys(uniqueIds).map(async (x) => {
        const res = (await fromUuid(x)).toObject(false);
        res.uuid = x;
        res.count = uniqueIds[x];
        res.cost = Number(res.system.AsPCost.value) * uniqueIds[x];
        return res;
      }),
    );

    const packageModifiers = await Promise.all(this.creationData.packageIds.map((x) => fromUuid(x)));
    const costs = [
      ...this.creationData.modifiers.map((x) => ({ label: _loc(x.name), cost: 1 })),
      ...entityModifiers.map((x) => ({ label: x.name, cost: x.cost })),
    ];
    const services = this.creationData.services ?? this.creationData.qs - this.creationData.consumedQS + 1;

    mergeObject(data, {
      conjuration: this.conjuration,
      summoner: this.summoner,
      summonerImg: this.summoner.img,
      confirmed: this.confirmed,
      creationData: this.creationData,
      conjurationModifiers: this.creationData.modifiers,
      entityModifiers,
      packageModifiers,
      actor: this.actor,
      extensionEntries: this.creationData.modifiers.map((x) => ({ label: _loc(x.name), descr: _loc(x.descr), badge: 1 })),
      entityEntries: entityModifiers.map((x) => ({ label: x.name, uuid: x.uuid, badge: x.cost })),
      packageEntries: packageModifiers.map((x) => ({
        label: x.name,
        uuid: x.uuid,
        badge: new Intl.NumberFormat(game.i18n.lang, { signDisplay: 'exceptZero' }).format(Number(x.system.at.value) || 0),
      })),
      summary: {
        typeId,
        typeName: this.creationData.typeName,
        serviceLabel: PlayerMenu.serviceCounterLabelKey(typeId),
        controlModeLabel: PlayerMenu.controlModeLabelKey(typeId),
        controlModeHintKey: PlayerMenu.controlModeHintKey(typeId),
        showServiceCounter: controlMode !== CONJURATION_CONTROL_MODES.LOYALTY,
        services,
        serviceMods: [],
        aspMods: [],
        creature: {
          img: this.conjuration.img,
          name: this.conjuration.name,
          creatureClass: this.conjuration.system?.creatureClass?.value,
          empty: false,
        },
        difficulty: {
          raw: this.conjuration.system?.conjuringDifficulty?.value ?? 0,
          effective: this.conjuration.system?.conjuringDifficulty?.value ?? 0,
          mods: [],
        },
        budget: PlayerMenu.buildBudget(this.creationData.qs, costs),
        blockers: [],
        canFinalize: true,
        editableQs: false,
        readonly: true,
        hideCreature: true,
      },
    });
    return data;
  }

  static DEFAULT_OPTIONS = {
    window: {
      title: 'DIALOG.setTargetToUser',
      resizable: true,
      contentClasses: ['standard-form'],
    },
    position: {
      width: 760,
    },
    classes: ['dsa5', 'largeDialog'],
    actions: {      
      createActor: this.createActor,
      declineConjuration: this.declineConjuration,
      showEntity: this._onShowEntity,
      newNPC: { handler: this._onNewNPC, buttons: [0, 2] },
    }
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/system/conjuration/request.hbs',
      templates: conjurationPartTemplates,
    },
  };

  uniqueCountIds(uids) {
    return uids.reduce((acc, curr) => {
      return acc[curr] ? ++acc[curr] : (acc[curr] = 1), acc;
    }, {});
  }

  static declineConjuration() {
    game.socket.emit('system.dsa5', {
      type: 'summonCreatureDeclined',
      payload: { summonerUuid: this.summoner?.uuid, creatureName: this.conjuration.name },
    });
    ui.notifications.info('CONJURATION.declined', { format: { name: this.conjuration.name }, localize: true });
    this.close();
  }

  static async createActor(ev, target) {
    this.confirmed = true;
    const head = await DSA5_Utility.getFolderForType('Actor', null, _loc('PLAYER.conjuration'));
    const folder = await DSA5_Utility.getFolderForType('Actor', head.id, this.creationData.typeName);
    const services = this.creationData.services ?? this.creationData.qs - this.creationData.consumedQS + 1;
    const controlMode = this.creationData.controlMode || PlayerMenu.controlModeForType(this.creationData.type);
    const serviceLabelKey = PlayerMenu.serviceCounterLabelKey(this.creationData.type);
    this.conjuration.folder = folder.id;
    if (!this.conjuration.effects) this.conjuration.effects = [];
    this.conjuration.flags ??= {};
    this.conjuration.flags.dsa5 ??= {};
    this.conjuration.flags.dsa5.summonedCompanion = true;
    this.conjuration.flags.dsa5.conjurationControlMode = controlMode;
    this.conjuration.flags.dsa5.conjurationType = Number(this.creationData.type);
    if (controlMode === CONJURATION_CONTROL_MODES.REQUESTS) {
      this.conjuration.flags.dsa5.requestModifier = Number(this.creationData.requestModifier ?? -2);
    }

    for (const modifier of this.creationData.modifiers) {
      this.conjuration.effects.push({
        system: {
          description: `${_loc('PLAYER.conjuration')} ${_loc('extensions')}`,
          visibility: {
            hideOnToken: true,
            hidePlayers: false,
          },
          changes: modifier.changes,
        },
        duration: {},
        img: 'icons/svg/aura.svg',
        name: _loc(modifier.name),
      });
      if (modifier.fun) {
        modifier.fun(this.conjuration, this.creationData);
      }
    }

    const uniqueIds = this.uniqueCountIds(this.creationData.entityIds);
    const entityAbilities = (await Promise.all(Object.keys(uniqueIds).map((x) => fromUuid(x)))).map((x) => {
      const res = x.toObject(false);

      if (uniqueIds[x.uuid] > 1) res.system.step = { value: uniqueIds[x.uuid] };
      return res;
    });

    const entityPackages = (await Promise.all(this.creationData.packageIds.map((x) => fromUuid(x)))).map((x) => x.toObject(false));
    if (controlMode !== CONJURATION_CONTROL_MODES.LOYALTY) {
      this.conjuration.effects.push({
        system: {
          description: `${_loc('PLAYER.conjuration')} ${_loc(serviceLabelKey)}`,
          condition: {
            value: services,
            max: 500,
            manual: services,
            auto: 0,
          },
          visibility: {
            hideOnToken: true,
            hidePlayers: false,
          },
          changes: [],
        },
        duration: {},
        img: 'icons/svg/aura.svg',
        statuses: ['services'],
        name: _loc(serviceLabelKey),
      });
    }

    if (game.dsa5.apps.playerMenu.conjurationData.postFunction[this.creationData.type]) {
      await game.dsa5.apps.playerMenu.conjurationData.postFunction[this.creationData.type](
        this.conjuration,
        this.creationData.qs - this.creationData.consumedQS,
        this.creationData.type,
      );
    }

    if (this.conjuration.type == 'creature' && !this.conjuration.system.creatureClass.value.includes(this.creationData.typeName)) {
      this.conjuration.system.creatureClass.value += `, ${this.creationData.typeName}`;
    }

    this.actor = await Actordsa5.create(this.conjuration);

    const itemsToAdd = [...entityAbilities, ...entityPackages].filter((x) => !this.conjuration.items.find((y) => y.type == x.type && x.name == y.name));
    await this.actor.createEmbeddedDocuments('Item', itemsToAdd);

    for (const item of entityPackages) await TraitRulesDSA5.traitAdded(this.actor, item);

    for (const item of entityAbilities) await TraitRulesDSA5.traitAdded(this.actor, item);

    await this.actor.update({ 'system.status.wounds.value': this.actor.system.status.wounds.max, });

    const summonerActor = this.summoner?.uuid ? await fromUuid(this.summoner.uuid) : null;
    if (summonerActor) {
      await CompanionHandler.linkSummonedCompanion(summonerActor, this.actor, {
        controlMode,
        conjurationType: this.creationData.type,
        requestModifier: this.creationData.requestModifier,
      });
    }

    const chatmsg = await renderTemplate('systems/dsa5/templates/system/conjuration/chat.hbs', {
      actor: this.actor,
      modifiers: this.creationData.modifiers,
      summoner: this.summoner,
      summonerImg: OpposedDsa5.videoOrImgTag(this.summoner.img),
      conjureImg: OpposedDsa5.videoOrImgTag(this.actor.img),
      services,
      serviceLabel: serviceLabelKey,
      controlModeLabel: PlayerMenu.controlModeLabelKey(this.creationData.type),
      controlModeHintKey: PlayerMenu.controlModeHintKey(this.creationData.type),
      showServiceCounter: controlMode !== CONJURATION_CONTROL_MODES.LOYALTY,
    });
    await ChatMessage.create(DSA5_Utility.chatDataSetup(chatmsg));
    this.render();
  }

  static async _onNewNPC(ev, target) {
    const id = target.dataset.id;
    if (ev.button == 2) {
      game.actors.get(id).delete();
      $(target).remove();
    } else {
      game.actors.get(id).sheet.render(true);
    }
  }

  static async _onShowEntity(ev, target) {
    fromUuid(target.dataset.uuid).then(itm => itm.sheet.render(true));
  }

  _canDrag() {
    return true;
  }

  _dragStart(ev) {
    ev.stopPropagation();
    const a = ev.currentTarget;
    const dragData = { type: 'Actor', uuid: a.dataset.uuid };
    ev.dataTransfer.setData('text/plain', JSON.stringify(dragData));
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    new foundry.applications.ux.DragDrop.implementation({
      dragSelector: ".newNPC",
      permissions: {
        dragstart: this._canDrag.bind(this),
      },
      callbacks: {
        dragstart: this._dragStart.bind(this),
      }
    }).bind(this.element);
  }
}

