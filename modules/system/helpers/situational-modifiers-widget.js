import DSA5 from '../../config/config-dsa5.js';

const { duplicate, escapeHTML } = foundry.utils;

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

  static modifierTypeAbbreviations = {
    defenseMalus: 'CHARAbbrev.defenseMalus',
    FW: 'CHARAbbrev.FW',
    KaPCost: 'CHARAbbrev.KaPCost',
    AsPCost: 'CHARAbbrev.AsPCost',
    FP: 'CHARAbbrev.FP',
    QL: 'CHARAbbrev.QL',
    dmg: 'CHARAbbrev.damage',
    damageBonus: 'CHARAbbrev.damage',
    TPM: 'CHARAbbrev.TPM',
    CMP: 'CHARAbbrev.CMP',
  };

  static deferredDetailTypes = new Set(['specialability', 'advantage', 'disadvantage', ...DSA5.equipmentCategories]);

  constructor() {
    super();
    this.name = SituationalModifiersWidget.NAME;
    this.actor = null;
    this.modifiers = [];
    this.select = null;
    this.tooltipCache = new Map();
    this.#isInitialized = false;
    this[SituationalModifiersWidget.INSTANCE_KEY] = this;
  }

  #isInitialized;

  static displayName(name) {
    if (game.i18n.has(name)) return _loc(name);
    return name;
  }

  static formatModifierValue(modifier) {
    if (modifier.type === 'dmg' && modifier.damageBonus !== undefined && Number(modifier.value) === 0) {
      return modifier.damageBonus;
    }

    return modifier.value;
  }

  static stripInternalFields(modifier) {
    const result = duplicate(modifier);
    delete result._defaultSelected;
    return result;
  }

  static formatSignedValue(value) {
    const numericValue = typeof value === 'number'
      ? value
      : (typeof value === 'string' && /^-?\d+$/.test(value.trim()) ? Number(value.trim()) : null);

    if (numericValue !== null && Number.isFinite(numericValue)) {
      return String(Handlebars.helpers.numberFormat(numericValue, {
        hash: {
          decimals: 0,
          sign: true,
        },
      }));
    }

    if (typeof value === 'string') {
      return value.trim();
    }

    return String(value);
  }

  static getDirection(value) {
    if (typeof value === 'number' && Number.isFinite(value)) {
      if (value > 0) return 'positive';
      if (value < 0) return 'negative';
      return 'neutral';
    }

    if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) {
      const numeric = Number(value);
      if (numeric > 0) return 'positive';
      if (numeric < 0) return 'negative';
    }

    return 'neutral';
  }

  static getModifierIcon(modifier, direction) {
    return {
      positive: 'fa-arrow-up',
      negative: 'fa-arrow-down',
      neutral: 'fa-minus',
    }[direction];
  }

  static getModifierTypeLabel(modifier, { abbreviated = false } = {}) {
    if (!modifier.type) return '';

    if (abbreviated) {
      const abbreviationKey = this.modifierTypeAbbreviations[modifier.type];
      return abbreviationKey ? _loc(abbreviationKey) : modifier.type;
    }

    return _loc(this.modifierTypes[modifier.type] || 'Modifier');
  }

  static getOptionChangeText(modifier) {
    const signedValue = this.formatSignedValue(this.formatModifierValue(modifier));
    const typeLabel = this.getModifierTypeLabel(modifier, { abbreviated: true });
    return typeLabel ? `${signedValue} ${typeLabel}` : signedValue;
  }

  static describeImpact(modifier) {
    const typeLabel = this.getModifierTypeLabel(modifier);
    const rawValue = this.formatModifierValue(modifier);
    const direction = this.getDirection(rawValue);
    const signedValue = this.formatSignedValue(rawValue);
    const effectText = modifier.type ? `${signedValue} ${typeLabel}` : signedValue;

    return {
      direction,
      directionIcon: this.getModifierIcon(modifier, direction),
      effectText,
      sourceText: modifier.source || '',
    };
  }

  setContext({ actor } = {}) {
    this.actor = actor || null;
  }

  static getSourceIdentifiers(modifier) {
    return [modifier.sourceId, modifier.itemId, modifier._id].filter(Boolean);
  }

  static canResolveDeferredDetails(item) {
    return !!item && this.deferredDetailTypes.has(item.type);
  }

  hasDeferredDetails(modifier) {
    if (modifier.specAbId || modifier.effectUuid || modifier.effectId) return true;
    if (!this.actor) return false;

    const sourceIdentifiers = SituationalModifiersWidget.getSourceIdentifiers(modifier);
    if (sourceIdentifiers.length) {
      return sourceIdentifiers.some((sourceId) => SituationalModifiersWidget.canResolveDeferredDetails(this.actor.items.get(sourceId)));
    }

    if (!modifier.source) return false;

    return this.actor.items.some((item) => modifier.source === item.name && SituationalModifiersWidget.canResolveDeferredDetails(item));
  }

  getTooltipCacheKey(modifier) {
    return JSON.stringify([
      this.actor?.uuid || '',
      modifier.specAbId || '',
      modifier.sourceId || '',
      modifier.itemId || '',
      modifier._id || '',
      modifier.effectUuid || '',
      modifier.effectId || '',
      modifier.source || '',
      modifier.name || '',
      modifier.type || '',
      modifier.value || '',
      modifier.damageBonus || '',
    ]);
  }

  getTitleText(modifier) {
    const title = SituationalModifiersWidget.displayName(modifier.name);
    return modifier._defaultSelected !== modifier.selected ? `${title} *` : title;
  }

  getSelectionStateIcon(modifier) {
    return modifier.selected ? 'fa-toggle-on' : 'fa-toggle-off';
  }

  buildLinkedDetailsBlock(modifier) {
    if (!this.hasDeferredDetails(modifier)) return '';

    const cached = this.tooltipCache.get(this.getTooltipCacheKey(modifier));
    if (cached?.state === 'loaded' && cached.body) {
      return `<div class="modifier-linked-preview"><div class="modifier-linked-body">${cached.body}</div></div>`;
    }

    if (cached?.state === 'empty' || cached?.state === 'error') return '';

    return `<div class="modifier-linked-preview loading"><div><span><i class="fas fa-spinner fa-spin"></i></span></div></div>`;
  }

  buildTooltip(modifier) {
    const impact = SituationalModifiersWidget.describeImpact(modifier);
    const sourcePill = impact.sourceText
      ? `<span class="modifier-pill modifier-source"><span class="modifier-pill-label">${escapeHTML(`${_loc('source')}:`)}</span>${escapeHTML(impact.sourceText)}</span>`
      : '';

    return `<div class="itemTooltip situationalModifierTooltip">
        <h1><span class="modifier-header-state ${modifier.selected ? 'active' : 'inactive'}"><i class="fas ${this.getSelectionStateIcon(modifier)}"></i></span><span>${escapeHTML(this.getTitleText(modifier))}</span></h1>
        <div class="modifier-pills">
            <span class="modifier-pill modifier-impact ${impact.direction}">
                <span class="modifier-pill-label">${escapeHTML(`${_loc('effect')}:`)}</span>
                <i class="fas ${impact.directionIcon}"></i> ${escapeHTML(impact.effectText)}
            </span>
            ${sourcePill}
        </div>${this.buildLinkedDetailsBlock(modifier)}</div>`;
  }

  applyTooltip(target, modifier) {
    delete target.dataset.tooltip;
    target.dataset.tooltipHtml = this.buildTooltip(modifier);
    target.dataset.tooltipClass = 'dsatooltip';
  }

  refreshActiveTooltip(target) {
    if (!target?.ownerDocument?.body?.contains(target)) return;
    if (game.tooltip?.element !== target) return;

    game.tooltip.activate(target, {
      html: target.dataset.tooltipHtml,
      cssClass: target.dataset.tooltipClass,
    });
  }

  async resolveLinkedItem(modifier) {
    if (!this.actor) return null;

    if (modifier.specAbId) {
      const item = this.actor.items.get(modifier.specAbId);
      if (SituationalModifiersWidget.canResolveDeferredDetails(item)) return item;
    }

    for (const sourceId of SituationalModifiersWidget.getSourceIdentifiers(modifier)) {
      const item = this.actor.items.get(sourceId);
      if (SituationalModifiersWidget.canResolveDeferredDetails(item)) return item;
    }

    if (!modifier.source) return null;

    return this.actor.items.find((item) => modifier.source === item.name && SituationalModifiersWidget.canResolveDeferredDetails(item)) || null;
  }

  async resolveLinkedItemDetails(modifier) {
    const item = await this.resolveLinkedItem(modifier);
    if (!item) return null;

    const rawText = {
      specialability: item.system.rule?.value,
      advantage: item.system.description?.value,
      disadvantage: item.system.description?.value,
      equipment: item.system.effect?.value,
      meleeweapon: item.system.effect?.value,
      rangeweapon: item.system.effect?.value,
      armor: item.system.effect?.value,
    }[item.type];

    if (!rawText) return null;

    return {
        body: await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawText, { secrets: item.isOwner }),
    };
  }

  async resolveLinkedEffectDetails(modifier) {
    let effect = null;

    if (modifier.effectUuid) {
      effect = await fromUuid(modifier.effectUuid);
    } else if (this.actor && modifier.effectId) {
      effect = this.actor.effects?.get(modifier.effectId) || null;
    }

    if (!effect) return null;

    const rawText = game.i18n.has(effect.description) ? _loc(effect.description) : effect.description;
    if (!rawText) return null;

    return {
        body: await foundry.applications.ux.TextEditor.implementation.enrichHTML(rawText, { secrets: this.actor?.isOwner ?? false }),
    };
  }

  async resolveLinkedDetails(modifier) {
    return (await this.resolveLinkedItemDetails(modifier)) || (await this.resolveLinkedEffectDetails(modifier));
  }

  async ensureTooltipDetails(target, modifier) {
    if (!this.hasDeferredDetails(modifier)) return;

    const cacheKey = this.getTooltipCacheKey(modifier);
    const cached = this.tooltipCache.get(cacheKey);
    if (cached?.state === 'loaded' || cached?.state === 'empty' || cached?.state === 'error' || cached?.promise) return;

    const loading = { state: 'loading' };
    this.tooltipCache.set(cacheKey, loading);
    this.applyTooltip(target, modifier);
    this.refreshActiveTooltip(target);

    loading.promise = this.resolveLinkedDetails(modifier)
      .then((details) => {
        if (details?.body) this.tooltipCache.set(cacheKey, { state: 'loaded', ...details });
        else this.tooltipCache.set(cacheKey, { state: 'empty' });
      })
      .catch(() => {
        this.tooltipCache.set(cacheKey, { state: 'error' });
      })
      .finally(() => {
        this.applyTooltip(target, modifier);
        this.refreshActiveTooltip(target);
      });
  }

  static normalizeModifier(modifier = {}) {
    const normalized = duplicate(modifier);
    normalized.name ??= '';
    normalized.selected = normalized.selected !== false;
    normalized._defaultSelected ??= normalized.selected;

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

    this.select.addEventListener('mouseover', (event) => {
      if (event.target.tagName !== 'OPTION') return;

      const index = Number(event.target.dataset.index);
      const modifier = this.modifiers[index];
      if (!modifier) return;

      this.ensureTooltipDetails(event.target, modifier);
    });

    this.select.addEventListener('mousedown', (event) => {
      if (event.target.tagName !== 'OPTION') return;

      event.preventDefault();

      const index = Number(event.target.dataset.index);
      const modifier = this.modifiers[index];
      if (!modifier) return;

      modifier.selected = !modifier.selected;
      event.target.selected = modifier.selected;
      this.applyTooltip(event.target, modifier);
        this.refreshActiveTooltip(event.target);
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
    return this.modifiers.map((modifier) => SituationalModifiersWidget.stripInternalFields(modifier));
  }

  getSelectedModifiers() {
    return this.modifiers
      .filter((modifier) => modifier.selected)
      .map((modifier) => {
        const result = SituationalModifiersWidget.stripInternalFields(modifier);
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
      this.applyTooltip(option, modifier);
      if (modifier.type) option.dataset.type = modifier.type;
      if (modifier.specAbId) option.dataset.specAbId = modifier.specAbId;
      if (modifier.armorPen) option.dataset.armorPen = modifier.armorPen;
      if (modifier.effectId) option.dataset.effectId = modifier.effectId;
      if (modifier.effectUuid) option.dataset.effectUuid = modifier.effectUuid;
      if (modifier.extension) option.dataset.extension = '1';
      option.textContent = `${SituationalModifiersWidget.displayName(modifier.name)} [${SituationalModifiersWidget.getOptionChangeText(modifier)}]`;
      this.select.appendChild(option);
    });

    this.updateVisibility();
  }

  refreshTooltips() {
    Array.from(this.select.options).forEach((option, index) => {
      this.applyTooltip(option, this.modifiers[index]);
    });
  }

  updateVisibility() {
    const group = this.closest(SituationalModifiersWidget.GROUP_SELECTOR);
    if (!group) return;

    group.classList.toggle('dsahidden', this.modifiers.length === 0);
  }

  destroy() {
    this.tooltipCache.clear();
    this.actor = null;
    delete this[SituationalModifiersWidget.INSTANCE_KEY];
  }
}

if (!customElements.get(SituationalModifiersWidget.TAG_NAME)) {
  customElements.define(SituationalModifiersWidget.TAG_NAME, SituationalModifiersWidget, { extends: 'div' });
}