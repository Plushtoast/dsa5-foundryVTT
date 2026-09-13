import TrapAutomation from '../../system/automation/trap.js';

export default class DSATrapRegionBehaviorConfig extends foundry.applications.sheets.RegionBehaviorConfig {
  static DEFAULT_OPTIONS = {
    form: {
      closeOnSubmit: false,
      submitOnChange: true,
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
}
