const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const { duplicate, expandObject } = foundry.utils;

import EffectDropdownBuilder from './effect-dropdown-builder.js';

export default class AfterUseEffectConfig extends HandlebarsApplicationMixin(ApplicationV2) {
  #completed = false;
  #resolve;

  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'after-use-effect-config'],
    tag: 'form',
    window: {
      title: 'SHEET.afterUseEffect',
      resizable: true,
      contentClasses: ['standard-form']
    },
    position: {
      width: 720,
    },
    actions: {
      addChange: this.#addChange,
      deleteChange: this.#deleteChange,
      save: this.#save,
      cancel: this.#cancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/after-use-effect-edit.hbs',
      templates: ['systems/dsa5/templates/status/parts/change-list-advanced.hbs'],
      scrollable: [''],
    },
  };

  static async wait(effect, followup = undefined) {
    return await new Promise((resolve) => {
      new this(effect, followup, resolve).render(true);
    });
  }

  constructor(effect, followup, resolve) {
    super();
    this.effect = effect;
    this.followup = duplicate(followup || { name: '', changes: [], duration: {} });
    this.followup.changes ??= [];
    this.followup.duration ??= {};
    this.#resolve = resolve;
    this.options.window.title = followup ? 'SHEET.editAfterUse' : 'SHEET.addAfterUse';
  }

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const changeTypes = Object.entries(ActiveEffect.CHANGE_TYPES)
      .map(([type, { label }]) => ({ type, label: _loc(label) }))
      .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
      .reduce((types, { type, label }) => {
        types[type] = label;
        return types;
      }, {});
    const changePriorities = Object.fromEntries(Object.entries(ActiveEffect.CHANGE_TYPES).map(([type, { defaultPriority }]) => [type, defaultPriority]));
    const changePhases = Object.fromEntries(Object.entries(ActiveEffect.CHANGE_PHASES).map(([phase, { label }]) => [phase, _loc(label)]));

    return foundry.utils.mergeObject(context, {
      followup: {
        name: this.followup.name || '',
        changes: this.followup.changes || [],
        seconds: this.#durationSeconds(this.followup.duration),
      },
      changeFields: this.effect.system.schema.fields.changes.element.fields,
      changeTypes,
      changePriorities,
      changePhases,
    });
  }

  static #addChange() {
    this.#syncFormData();
    this.followup.changes.push(this.#defaultChange());
    this.render({ parts: ['main'] });
  }

  static #deleteChange(_event, target) {
    const index = Number(target.closest('[data-index]')?.dataset.index);
    if (!Number.isFinite(index)) return;

    this.#syncFormData();
    this.followup.changes.splice(index, 1);
    this.render({ parts: ['main'] });
  }

  static async #save(event) {
    event?.preventDefault();
    this.#syncFormData();
    this.#completed = true;
    this.#resolve?.(this.followup);
    await this.close();
  }

  static async #cancel(event) {
    event?.preventDefault();
    await this.close();
  }

  _onClose(options) {
    super._onClose(options);
    if (this.#completed) return;

    this.#completed = true;
    this.#resolve?.(undefined);
  }

  #syncFormData() {
    const form = this.element?.tagName == 'FORM' ? this.element : this.element?.querySelector('form');
    if (!form) return;

    const data = expandObject(new foundry.applications.ux.FormDataExtended(form).object);
    const seconds = Number(data.seconds);
    this.followup = {
      name: data.name || '',
      changes: Object.values(data.changes || {}).map((change) => this.#normalizeChange(change)).filter((change) => change.key),
      duration: Number.isFinite(seconds) && seconds > 0 ? { seconds } : {},
    };
  }

  #normalizeChange(change) {
    const normalized = {
      key: change.key || '',
      type: change.type || 'custom',
      value: change.value ?? '',
    };
    if (change.phase) normalized.phase = change.phase;
    if (change.priority !== '' && change.priority !== undefined && change.priority !== null) normalized.priority = Number(change.priority);
    return normalized;
  }

  #defaultChange() {
    return {
      key: '',
      type: ActiveEffect.CHANGE_TYPES.custom ? 'custom' : Object.keys(ActiveEffect.CHANGE_TYPES)[0],
      value: '',
      phase: Object.keys(ActiveEffect.CHANGE_PHASES)[0],
    };
  }

  #durationSeconds(duration = {}) {
    const seconds = Number(duration.seconds);
    return Number.isFinite(seconds) && seconds > 0 ? seconds : '';
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);
    const dropDown = EffectDropdownBuilder.buildDropdownMenu(this.effect);
    html.find('.changes .ol .key').append(dropDown);
    html
      .find('.selMenu')
      .select2({ width: 'element' })
      .on('change', (ev) => {
        const elem = $(ev.currentTarget);
        elem.siblings('input').val(elem.val());
        const parent = elem.closest('.row-section');
        const data = elem.find('option:selected');
        const exampleValue = data.attr('data-ph') || '';
        parent.find('.type select').val(data.attr('data-type'));
        parent.find('.phase select').val(data.attr('data-phase') || 'initial');
        parent.find('.value input').val(exampleValue).attr('placeholder', '');
        elem.trigger('blur');
      });
    html.find('.select2').each((i, el) => {
      $(el)[0].style.removeProperty('width');
    });
  }
}