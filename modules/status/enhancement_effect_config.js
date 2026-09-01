import DSABaseEffectConfig from './base_effect_config.js';
import DSAEnhancementEffectDataModel from '../data/activeeffect/enhancement-effect.js';
import EffectDropdownBuilder from './effect-dropdown-builder.js';
import { bindItemHeaderTitle, tabSlider } from '../system/helpers/view_helper.js';

const { mergeObject } = foundry.utils;
const { TextEditor } = foundry.applications.ux;

export default class DSAEnhancementEffectConfig extends DSABaseEffectConfig {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5', 'item', 'item-sheet'],
    window: {
      contentClasses: ['standard-form', 'gap5px'],
    },
    form: {
      submitOnChange: true,
      closeOnSubmit: false,
    },
  };

  static PARTS = {
    header: { template: 'systems/dsa5/templates/items/item-header.hbs' },
    stat: { template: 'systems/dsa5/templates/status/enhancement-effect-stat.hbs' },
    tabs: { template: 'systems/dsa5/templates/system/dsatabs.hbs' },
    description: { template: 'systems/dsa5/templates/status/enhancement-effect-description.hbs', scrollable: [''] },
    details: {
      template: 'systems/dsa5/templates/status/enhancement-effect-details.hbs',
      scrollable: [''],
      templates: [
        'systems/dsa5/templates/status/parts/enhancement-effect-powersource-fields.hbs',
        'systems/dsa5/templates/status/parts/enhancement-effect-crafting-fields.hbs',
        'systems/dsa5/templates/status/parts/enhancement-effect-treatment-fields.hbs',
      ],
    },
    duration: foundry.applications.sheets.ActiveEffectConfig.PARTS.duration,
    changes: super.PARTS.changes,
    actions: super.PARTS.actions,
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'description', label: 'Description' },
        { id: 'details', label: 'Details' },
        { id: 'duration', icon: 'fa-solid fa-clock', label: 'EFFECT.TABS.duration' },
        { id: 'changes', label: 'EFFECT.TABS.changes' },
        { id: 'actions', label: 'EFFECT.TABS.actions' },
      ],
      initial: 'description',
    },
  };

  get _targetType() {
    return this.document.system.targetType;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    const html = $(this.element);
    tabSlider(html);

    const renderedParts = options.parts;
    if (!renderedParts || renderedParts.includes('header')) {
      bindItemHeaderTitle(html);
    }
  }

  _ensureValidWizardMode() {
    if (this.wizardMode && !EffectDropdownBuilder.supportsEnhancementWizardChanges(this._targetType, this.document.system.changes)) {
      this.wizardMode = false;
      this.wizardCategory = null;
    }
    return this.wizardMode;
  }

  async _preparePartContext(partId, context) {
    const partContext = await super._preparePartContext(partId, context);
    switch (partId) {
      case 'description': {
        const enrichedDescription = await TextEditor.enrichHTML(this.document.description, { secrets: this.document.isOwner });
        mergeObject(partContext, { enrichedDescription });
        break;
      }
      case 'details': {
        const targetTypes = Object.entries(DSAEnhancementEffectDataModel.TARGET_TYPES).reduce((obj, [key, label]) => {
          obj[key] = _loc(label);
          return obj;
        }, {});
        const availableTypes = DSAEnhancementEffectDataModel.getAvailableEnhancementTypes(this._targetType, {
          item: this.document.parent,
          exclude: this.document,
          slotCost: this.document.system.slotCost,
        });
        const enhancementTypes = Object.entries(availableTypes).reduce((obj, [key, entry]) => {
          obj[key] = {
            label: entry.disabled
              ? _loc('Enhancement.typeUnavailable', { type: _loc(entry.label) })
              : entry.label,
            disabled: entry.disabled,
          };
          return obj;
        }, {});
        const slotLimits = DSAEnhancementEffectDataModel.getSlotLimits(this._targetType);
        mergeObject(partContext, {
          targetTypes,
          enhancementTypes,
          slotLimits,
        });
        break;
      }
      case 'changes': {
        const wizardCategories = this.wizardMode ? EffectDropdownBuilder.getEnhancementWizardCategories(this._targetType) : [];
        mergeObject(partContext, { wizardCategories });
        break;
      }
    }
    return partContext;
  }

  _initExpertDropdowns(html) {
    const dropDown = EffectDropdownBuilder.buildEnhancementDropdownMenu(this._targetType);
    html.find('.changes .ol .key').append(dropDown);
    html
      .find('.changes .selMenu')
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
    html.find('.changes .select2').each((i, el) => {
      $(el)[0].style.removeProperty('width');
    });
  }

  _initWizardDropdowns(html) {
    const groupedMenu = EffectDropdownBuilder.buildEnhancementGroupedDropdownMenu(this._targetType, this.wizardCategory);
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
