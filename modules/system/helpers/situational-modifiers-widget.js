const { duplicate } = foundry.utils;

export class SituationalModifiersWidget extends HTMLDivElement {
  static NAME = 'situationalModifiers';

  static TAG_NAME = 'dsa-situationalmodifiers';

  static SELECTOR = `div[is="${SituationalModifiersWidget.TAG_NAME}"]`;

  static GROUP_SELECTOR = '[data-situational-modifiers-group]';

  static INSTANCE_KEY = '__dsa5SituationalModifiersWidget';

  static modifierTypes = {
    '': 'Modifier',
    defenseMalus: 'MODS.defenseMalus',
    FW: 'MODS.FW',
    KaPCost: 'CHAR.KaPCost',
    AsPCost: 'CHAR.AsPCost',
    FP: 'MODS.FP',
    QL: 'MODS.QS',
    dmg: 'MODS.damage',
    damageBonus: 'MODS.damage',
    armorPen: 'MODS.armorPen',
    TPM: 'MODS.partChecks',
    CMP: 'MODS.compensation',
  };

  constructor() {
    super();
    this.name = SituationalModifiersWidget.NAME;
    this.modifiers = [];
    this.select = null;
    this.#isInitialized = false;
    this[SituationalModifiersWidget.INSTANCE_KEY] = this;
  }

  #isInitialized;

  static displayName(name) {
    if (game.i18n.has(name)) return _loc(name);
    return name;
  }

  static buildTooltip(modifier) {
    const key = _loc(this.modifierTypes[modifier.type] || 'Modifier');
    const value = modifier.type === 'dmg' && modifier.damageBonus !== undefined && Number(modifier.value) === 0 ? modifier.damageBonus : modifier.value;
    let result = `${this.displayName(modifier.name)}<br/>${key}: ${value}`;

    if (modifier.source) {
      result += `<br/>${_loc('source')}: ${modifier.source}`;
    }

    return result;
  }

  static normalizeModifier(modifier = {}) {
    const normalized = duplicate(modifier);
    normalized.name ??= '';
    normalized.selected = normalized.selected !== false;

    if (normalized.type === 'dmg' && normalized.damageBonus !== undefined && (normalized.value === undefined || Number(normalized.value) === 0)) {
      normalized.value = normalized.damageBonus;
    }

    if (typeof normalized.value === 'string') {
      const trimmed = normalized.value.trim();
      if (trimmed !== '' && /^-?\d+(?:\.\d+)?$/.test(trimmed)) {
        normalized.value = Number(trimmed);
      }
    }

    if (normalized.value === undefined) normalized.value = 0;

    return normalized;
  }

  static normalizeModifiers(modifiers = []) {
    return modifiers.map((modifier) => this.normalizeModifier(modifier));
  }

  static renderFormGroup({
    label = 'DIALOG.SituationalModifiers',
  } = {}) {
    const wrapperClasses = ['modifiers', 'form-group', 'dsahidden'];

    const fieldClasses = ['form-fields', 'height100'];

    return `
<div class="${wrapperClasses.join(' ')}" data-situational-modifiers-group style="flex-grow: 1;">
  <label>${_loc(label)}</label>
  <div class="${fieldClasses.join(' ')}">
    <div is="${SituationalModifiersWidget.TAG_NAME}"></div>
  </div>
</div>`;
  }

  static getWidget(root) {
    const container = this.getContainer(root);
    return container?.[SituationalModifiersWidget.INSTANCE_KEY] || null;
  }

  static getContainer(root) {
    const element = this.resolveRoot(root);
    if (!element) return null;

    if (element.matches?.(SituationalModifiersWidget.SELECTOR)) {
      return element;
    }

    return element.querySelector?.(SituationalModifiersWidget.SELECTOR) || null;
  }

  static resolveRoot(root) {
    if (!root) return null;
    if (root.jquery) return root[0];
    return root;
  }

  static getStoredModifiers(root) {
    return this.getWidget(root)?.getModifiers() || [];
  }

  static getSelectedModifiers(root) {
    return this.getWidget(root)?.getSelectedModifiers() || [];
  }

  static collectFormModifiers(root) {
    const html = root.jquery ? root : $(root);
    const situationalModifiers = this.getSelectedModifiers(html);
    const focusRuleModifiers = html
      .find('.focusMods input')
      .map(function () {
        return {
          name: _loc(this.name),
          value: Number(this.value),
        };
      })
      .get();

    const manualModifier = {
      name: _loc('manual'),
      value: Number(html.find('[name="testModifier"]').val() || 0),
      type: '',
    };

    return [...situationalModifiers, ...focusRuleModifiers, manualModifier];
  }

  connectedCallback() {
    this.ensureInitialized();
    this.refresh();
  }

  ensureInitialized() {
    if (this.#isInitialized) return;
    this.render();
    this.bindEvents();
    this.#isInitialized = true;
  }

  bindEvents() {
    if (!this.select) return;

    this.select.addEventListener('mousedown', (event) => {
      if (event.target.tagName !== 'OPTION') return;

      event.preventDefault();

      const index = Number(event.target.dataset.index);
      const modifier = this.modifiers[index];
      if (!modifier) return;

      modifier.selected = !modifier.selected;
      event.target.selected = modifier.selected;
      event.target.dataset.tooltip = SituationalModifiersWidget.buildTooltip(modifier);
      this.dispatchChange();
    });
  }

  render() {
    this.innerHTML = '';

    this.select = document.createElement('select');
    this.select.name = this.name;
    this.select.multiple = true;

    this.appendChild(this.select);
  }

  dispatchChange() {
    this.updateVisibility();
    this.select.dispatchEvent(new Event('change', { bubbles: true }));
    this.dispatchEvent(new CustomEvent('dsa5:situational-modifiers-change', {
      bubbles: true,
      detail: {
        widget: this,
        modifiers: this.getModifiers(),
      },
    }));
  }

  getModifiers() {
    return duplicate(this.modifiers);
  }

  getSelectedModifiers() {
    return this.modifiers
      .filter((modifier) => modifier.selected)
      .map((modifier) => {
        const result = duplicate(modifier);
        if (result.type === 'dmg') {
          result.damageBonus = result.value;
          result.value = 0;
        }
        return result;
      });
  }

  setModifiers(modifiers = []) {
    this.ensureInitialized();
    this.modifiers = SituationalModifiersWidget.normalizeModifiers(modifiers);
    this.refresh();
  }

  addModifier(modifier) {
    this.ensureInitialized();
    this.modifiers.push(SituationalModifiersWidget.normalizeModifier(modifier));
    this.refresh();
  }

  updateModifier(predicateOrId, patch) {
    const predicate = typeof predicateOrId === 'function'
      ? predicateOrId
      : (modifier) => modifier.effectUuid === predicateOrId || modifier.effectId === predicateOrId || modifier.name === predicateOrId;

    let changed = false;
    this.modifiers = this.modifiers.map((modifier) => {
      if (!predicate(modifier)) return modifier;
      changed = true;
      return SituationalModifiersWidget.normalizeModifier({ ...modifier, ...patch });
    });

    if (changed) this.refresh();
  }

  removeModifier(predicateOrId) {
    const predicate = typeof predicateOrId === 'function'
      ? predicateOrId
      : (modifier) => modifier.effectUuid === predicateOrId || modifier.effectId === predicateOrId || modifier.name === predicateOrId;

    const next = this.modifiers.filter((modifier) => !predicate(modifier));
    if (next.length === this.modifiers.length) return;
    this.modifiers = next;
    this.refresh();
  }

  refresh() {
    this.ensureInitialized();
    this.select.innerHTML = '';

    this.modifiers.forEach((modifier, index) => {
      const option = document.createElement('option');
      option.value = modifier.value;
      option.selected = !!modifier.selected;
      option.dataset.index = String(index);
      option.dataset.tooltip = SituationalModifiersWidget.buildTooltip(modifier);
      if (modifier.type) option.dataset.type = modifier.type;
      if (modifier.specAbId) option.dataset.specAbId = modifier.specAbId;
      if (modifier.armorPen) option.dataset.armorPen = modifier.armorPen;
      if (modifier.effectId) option.dataset.effectId = modifier.effectId;
      if (modifier.effectUuid) option.dataset.effectUuid = modifier.effectUuid;
      if (modifier.extension) option.dataset.extension = '1';
      option.textContent = `${SituationalModifiersWidget.displayName(modifier.name)} [${modifier.value}]`;
      this.select.appendChild(option);
    });

    this.updateVisibility();
  }

  refreshTooltips() {
    Array.from(this.select.options).forEach((option, index) => {
      option.dataset.tooltip = SituationalModifiersWidget.buildTooltip(this.modifiers[index]);
    });
  }

  updateVisibility() {
    const group = this.closest(SituationalModifiersWidget.GROUP_SELECTOR);
    if (!group) return;

    group.classList.toggle('dsahidden', this.modifiers.length === 0);
  }

  destroy() {
    delete this[SituationalModifiersWidget.INSTANCE_KEY];
  }
}

if (!customElements.get(SituationalModifiersWidget.TAG_NAME)) {
  customElements.define(SituationalModifiersWidget.TAG_NAME, SituationalModifiersWidget, { extends: 'div' });
}