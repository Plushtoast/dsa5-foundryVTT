import OnUseEffect from '../system/automation/onUseEffects.js';
import EffectDropdownBuilder from './effect-dropdown-builder.js';

const { mergeObject } = foundry.utils;

export default class DSABaseEffectConfig extends foundry.applications.sheets.ActiveEffectConfig {
  wizardMode = true;
  wizardCategory = null;

  static DEFAULT_OPTIONS = {
    window: {
      resizable: true,
    },
    position: {
      width: 600,
    },
    actions: {
      toggleWizardMode: this.#toggleWizardMode,
      filterWizardCategory: this.#filterWizardCategory,
      addOnUseAction: this.#addOnUseAction,
      editOnUseAction: this.#editOnUseAction,
      deleteOnUseAction: this.#deleteOnUseAction,
    },
  };

  static PARTS = {
    header: super.PARTS.header,
    tabs: super.PARTS.tabs,
    details: super.PARTS.details,
    changes: { template: 'systems/dsa5/templates/status/changes.hbs', scrollable: [''] },
    actions: { template: 'systems/dsa5/templates/status/onuse-actions-tab.hbs' },
    footer: super.PARTS.footer,
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'details', icon: 'fa-solid fa-book' },
        { id: 'changes', icon: 'fa-solid fa-cogs' },
        { id: 'actions', icon: 'fa-solid fa-bolt' },
      ],
      initial: 'details',
      labelPrefix: 'EFFECT.TABS',
    },
  };

  static #toggleWizardMode() {
    if (this.wizardMode) {
      this.wizardMode = false;
    } else {
      this.wizardMode = EffectDropdownBuilder.supportsWizardChanges(this.document, this.document.system.changes);
    }

    this.wizardCategory = null;
    this.render({ parts: ['changes'] });
  }

  static #filterWizardCategory(ev, target) {
    const category = target.dataset.category || null;
    this.wizardCategory = this.wizardCategory === category ? null : category;
    this.render({ parts: ['changes'] });
  }

  static async #addOnUseAction() {
    await this.document.system.createOnUseAction();
  }

  static async #editOnUseAction(ev, target) {
    await this.document.system.editOnUseAction(target.dataset.id);
  }

  static async #deleteOnUseAction(ev, target) {
    await this.document.system.removeOnUseAction(target.dataset.id);
  }

  _ensureValidWizardMode() {
    if (this.wizardMode && !EffectDropdownBuilder.supportsWizardChanges(this.document, this.document.system.changes)) {
      this.wizardMode = false;
      this.wizardCategory = null;
    }

    return this.wizardMode;
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    if (partId in partContext.tabs) partContext.tab = partContext.tabs[partId];
    const document = this.document;
    switch (partId) {
      case 'changes': {
        this._ensureValidWizardMode();
        const effect = document;
        const changeFields = effect.system.schema.fields.changes.element.fields;
        const changeTypes = Object.entries(ActiveEffect.CHANGE_TYPES)
          .map(([type, { label }]) => ({ type, label: _loc(label) }))
          .sort((a, b) => a.label.localeCompare(b.label, game.i18n.lang))
          .reduce((types, { type, label }) => {
            types[type] = label;
            return types;
          }, {});
        const changePriorities = Object.fromEntries(
          Object.entries(ActiveEffect.CHANGE_TYPES).map(([type, { defaultPriority }]) => [type, defaultPriority]),
        );
        const changePhases = Object.fromEntries(
          Object.entries(ActiveEffect.CHANGE_PHASES).map(([phase, { label }]) => [phase, _loc(label)]),
        );
        const wizardMode = this.wizardMode;
        const wizardCategory = this.wizardCategory;
        const wizardCategories = wizardMode ? EffectDropdownBuilder.getWizardCategories(this.document) : [];
        mergeObject(partContext, { changeFields, changeTypes, changePriorities, changePhases, wizardMode, wizardCategory, wizardCategories });
        break;
      }
      case 'actions': {
        const onUseActions = OnUseEffect.getOnUseActions(this.document);
        mergeObject(partContext, { onUseActions });
        break;
      }
    }
    return partContext;
  }

  async _updateObject(event, formData) {
    const valueRaw = formData?.['system.charges.value'];
    const maxRaw = formData?.['system.charges.max'];

    const isEmpty = (v) => v === '' || v === null || v === undefined;

    if (isEmpty(valueRaw)) {
      delete formData['system.charges.value'];
      delete formData['system.charges.max'];
      formData['system.charges'] = _del;
    } else if (isEmpty(maxRaw)) {
      delete formData['system.charges.max'];
    }

    return super._updateObject(event, formData);
  }

  getConfig() {
    return {
      systemEffects: this.getStatusEffects(),
      canEditMacros: game.user.isGM || game.settings.get('dsa5', 'playerCanEditSpellMacro'),
    };
  }

  getStatusEffects() {
    return CONFIG.statusEffects
      .map((x) => {
        return { id: x.id, name: _loc(x.name) };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async _onRender(context, options) {
    await super._onRender(context, options);

    const html = $(this.element);

    if (this.wizardMode) {
      this._initWizardDropdowns(html);
    } else {
      this._initExpertDropdowns(html);
    }
  }

  _initExpertDropdowns(html) {
    const dropDown = EffectDropdownBuilder.buildDropdownMenu(this.document);
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

  _initWizardDropdowns(html) {
    const groupedMenu = EffectDropdownBuilder.buildGroupedDropdownMenu(this.document, this.wizardCategory);
    html.find('.changes .ol .wizardKey').each((i, el) => {
      const $el = $(el);
      const hiddenInput = $el.find('input[type="hidden"]');
      const currentKey = hiddenInput.val();

      const $wrapper = $('<div class="wizardSelectWrapper"></div>');
      $wrapper.append(groupedMenu);
      $el.prepend($wrapper);

      const $select = $wrapper.find('.wizardMenu');
      if (currentKey) $select.val(currentKey);

      $select
        .select2({ width: '100%', dropdownAutoWidth: true })
        .on('change', (ev) => {
          const $sel = $(ev.currentTarget);
          const val = $sel.val();
          hiddenInput.val(val);
          const $opt = $sel.find('option:selected');
          const exampleValue = $opt.attr('data-ph') || '';
          const row = $sel.closest('.row-section');
          row.find('input[name$=".type"]').val($opt.attr('data-type') || 'add');
          row.find('input[name$=".phase"]').val($opt.attr('data-phase') || 'initial');
          row.find('.value input').val(exampleValue).attr('placeholder', '');
          $sel.trigger('blur');
        });
    });
  }
}
