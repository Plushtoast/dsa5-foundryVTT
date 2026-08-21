/**
 * Shared UX helpers for item-library detailFilters (merchant StockFill + MW RandomGoods).
 */
export default class AttrFilterUi {
  static constraintCount(filter = {}) {
    if (!filter || typeof filter !== 'object') return 0;
    return (filter.selects?.length || 0) + (filter.inputs?.length || 0) + (filter.booleans?.length || 0);
  }

  static constraintCountFromPanel(panel, library = game.dsa5?.itemLibrary) {
    if (!panel || !library?.collectDetailSearch) return 0;
    const { sels, inps, checkboxes } = library.collectDetailSearch($(panel));
    return sels.length + inps.length + checkboxes.length;
  }

  static refreshAccordions(root, library = game.dsa5?.itemLibrary) {
    if (!root) return;
    for (const row of root.querySelectorAll('.dsa-filter-accordion')) {
      const panel = row.querySelector('.detailFilters');
      const badge = row.querySelector('[data-filter-badge]');
      const count = this.constraintCountFromPanel(panel, library);
      row.classList.toggle('dsa-filter-accordion--active', count > 0);
      if (badge) {
        badge.hidden = count <= 0;
        badge.textContent = String(count);
      }
      for (const field of row.querySelectorAll('.dsa-attr-filter__field')) {
        const control = field.querySelector('select, input[type="text"], input[type="checkbox"]');
        let set = false;
        if (control?.tagName === 'SELECT') set = !!control.value;
        else if (control?.type === 'checkbox') set = !!control.checked;
        else if (control) set = !!String(control.value || '').trim();
        field.classList.toggle('dsa-attr-filter__field--set', set);
      }
    }
  }

  static toggleAccordion(row, force) {
    if (!row) return;
    const body = row.querySelector('.dsa-filter-accordion__body, .expandDetails');
    if (!body) return;
    const open = force ?? !body.classList.contains('shown');
    body.classList.toggle('shown', open);
    row.classList.toggle('dsa-filter-accordion--open', open);
    row.classList.toggle('groupbox', open);
    const chevron = row.querySelector('.dsa-filter-accordion__chevron');
    if (chevron) {
      chevron.classList.toggle('fa-angle-down', !open);
      chevron.classList.toggle('fa-angle-up', open);
    }
  }

  static initSelect2(root, dropdownParent) {
    if (!root || typeof $.fn?.select2 !== 'function') return;
    const $root = $(root);
    const $selects = $root.find('.detailFilters select');
    if (!$selects.length) return;
    $selects.select2({
      width: '100%',
      dropdownParent: dropdownParent ? $(dropdownParent) : $root.closest('.app, .application, .window-app').length
        ? $root.closest('.app, .application, .window-app')
        : $(document.body),
    });
  }

  static bindLiveRefresh(root, library = game.dsa5?.itemLibrary) {
    if (!root || root.dataset.attrFilterBound === '1') return;
    root.dataset.attrFilterBound = '1';
    root.addEventListener('change', (event) => {
      if (!event.target.closest('.detailFilters')) return;
      this.refreshAccordions(root, library);
    });
  }
}
