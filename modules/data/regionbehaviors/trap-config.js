import TrapAutomation from '../../system/automation/trap.js';
import TrapFlow from '../../system/automation/trap-flow.js';

export default class DSATrapRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {
  static DEFAULT_OPTIONS = {
    form: {
      closeOnSubmit: false,
      submitOnChange: true,
    },
    actions: {
      addTrapFlow: this.addTrapFlow,
      deleteTrapFlow: this.deleteTrapFlow,
    },
  };

  static PARTS = {
    form: {
      template: 'templates/generic/form-fields.hbs',
      scrollable: [''],
    },
    flow: {
      template: 'systems/dsa5/templates/items/trap-region-flow.hbs',
      templates: ['systems/dsa5/templates/items/trap-flow-part.hbs'],
    },
    footer: {
      template: 'templates/generic/form-footer.hbs',
    },
  };

  _getFields() {
    const fieldsets = super._getFields();
    const hide = TrapAutomation.hiddenSystemFieldNames(this.document.system.trapType);
    if (!hide.size) return fieldsets;
    for (const set of fieldsets) {
      if (!set.fields) continue;
      set.fields = set.fields.filter((entry) => !hide.has(entry.field.name));
    }
    return fieldsets;
  }

  async _preparePartContext(partId, context, options) {
    context = await super._preparePartContext(partId, context, options);
    if (partId === 'flow') Object.assign(context, TrapFlow.sheetContext(this.document.system));
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    for (const hint of this.element.querySelectorAll('p.hint')) {
      const label = hint.closest('.form-group')?.querySelector('label');
      const text = hint.textContent.trim();
      if (label && text) label.dataset.tooltipText = text;
      hint.hidden = true;
    }
  }

  static async addTrapFlow(_event, target) {
    const kind = target.dataset.kind;
    const type = target.closest('fieldset')?.querySelector('[data-trap-add]')?.value;
    if (!kind || !type) return;
    await this.document.system.addFlowEntry(kind, type);
  }

  static async deleteTrapFlow(_event, target) {
    const { kind, key } = target.dataset;
    await this.document.system.removeFlowEntry(kind, key);
  }
}
