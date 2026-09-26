import TrapAutomation from '../../system/automation/trap.js';
import TrapFlow from '../../system/automation/trap-flow.js';
import { tabSlider } from '../../system/helpers/view_helper.js';

export default class DSATrapRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {
  static DEFAULT_OPTIONS = {
    classes: ['dsa5'],
    position: { height: 720 },
    window: {
      resizable: true,
    },
    form: {
      closeOnSubmit: false,
      submitOnChange: true,
    },
    actions: {
      addTrapFlow: this.addTrapFlow,
      deleteTrapFlow: this.deleteTrapFlow,
    },
  };

  static TABS = {
    sheet: {
      tabs: [
        { id: 'form', icon: 'fa-solid fa-gear', label: 'REGIONBEHAVIOR_DSATrap.TABS.form' },
        { id: 'flow', icon: 'fa-solid fa-diagram-project', label: 'REGIONBEHAVIOR_DSATrap.TABS.flow' },
      ],
      initial: 'form',
    },
  };

  static PARTS = {
    tabs: {
      template: 'systems/dsa5/templates/system/dsatabs.hbs',
    },
    form: {
      template: 'systems/dsa5/templates/items/trap-region-form.hbs',
      classes: ['scrollable'],
      scrollable: [''],
    },
    flow: {
      template: 'systems/dsa5/templates/items/trap-region-flow.hbs',
      classes: ['scrollable'],
      scrollable: [''],
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
    if (partId === 'tabs') context.tabClasses = 'top-tabs';
    if (partId in (context.tabs || {})) context.tab = context.tabs[partId];
    if (partId === 'flow') Object.assign(context, await TrapFlow.sheetContext(this.document.system, this.tabGroups));
    return context;
  }

  async _onRender(context, options) {
    await super._onRender(context, options);
    tabSlider($(this.element));
    for (const hint of this.element.querySelectorAll('p.hint')) {
      const label = hint.closest('.form-group')?.querySelector('label');
      const text = hint.textContent.trim();
      if (label && text) label.dataset.tooltipText = text;
      hint.hidden = true;
    }
  }

  _onChangeForm(formConfig, event) {
    if (TrapFlow.isTransientControl(event)) return;
    return super._onChangeForm(formConfig, event);
  }

  _onClickTab(event) {
    const button = event.target.closest?.('[data-action="tab"]');
    if (!button) return;
    const tab = button.dataset.tab;
    if (!tab || button.classList.contains('active') || event.button !== 0) return;
    this.changeTab(tab, button.dataset.group, {
      event,
      navElement: button.closest('.tabs'),
      updatePosition: !button.dataset.group?.startsWith('trap-'),
    });
  }

  static async addTrapFlow(_event, target) {
    const kind = target.dataset.kind;
    const type = target.closest('fieldset')?.querySelector('[data-trap-add]')?.value;
    if (!kind || !type) return;
    const id = await this.document.system.addFlowEntry(kind, type);
    if (id) this.tabGroups[TrapFlow.tabGroup(kind)] = id;
  }

  static async deleteTrapFlow(_event, target) {
    const { kind, key } = target.dataset;
    const group = TrapFlow.tabGroup(kind);
    if (this.tabGroups[group] === key) this.tabGroups[group] = '';
    await this.document.system.removeFlowEntry(kind, key);
  }
}
