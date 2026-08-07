/**
 * Builds picker objects for {@link templates/system/parts/detail-select.hbs}.
 */
export default class DetailSelect {
  static TEMPLATE = 'systems/dsa5/templates/system/parts/detail-select.hbs';

  /**
   * @param {object} opts
   * @param {string} opts.field
   * @param {string} [opts.owner]
   * @param {boolean} [opts.open]
   * @param {string|number} [opts.selectedId]
   * @param {string} [opts.selectedLabel]
   * @param {string} [opts.selectedBadge]
   * @param {string} [opts.selectedBadgeClass]
   * @param {string} [opts.selectedIcon]
   * @param {string} [opts.selectedImg]
   * @param {string} [opts.selectedUuid]
   * @param {string} [opts.selectedTooltip]
   * @param {string} [opts.noneLabel]
   * @param {Array<{label?: string, options: object[]}>} [opts.groups]
   */
  static build(opts = {}) {
    return {
      field: opts.field || '',
      owner: opts.owner || '',
      open: !!opts.open,
      selectedId: opts.selectedId == null ? '' : String(opts.selectedId),
      selectedLabel: opts.selectedLabel || '',
      selectedBadge: opts.selectedBadge || '',
      selectedBadgeClass: opts.selectedBadgeClass || '',
      selectedIcon: opts.selectedIcon || '',
      selectedImg: opts.selectedImg || '',
      selectedUuid: opts.selectedUuid || '',
      selectedTooltip: opts.selectedTooltip || '',
      noneLabel: opts.noneLabel || '',
      groups: opts.groups || [],
    };
  }

  /**
   * Map a plain id→label object (Foundry selectOptions shape) into picker options.
   * @param {Record<string, string>} map
   * @param {string|number} selectedId
   */
  static optionsFromMap(map, selectedId) {
    const selected = selectedId == null ? '' : String(selectedId);
    return Object.entries(map).map(([id, name]) => ({
      id: String(id),
      name,
      selected: String(id) === selected,
    }));
  }

  static async render(picker) {
    const { renderTemplate } = foundry.applications.handlebars;
    return renderTemplate(this.TEMPLATE, { picker });
  }
}
