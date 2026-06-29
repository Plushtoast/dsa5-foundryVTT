import { SituationalModifiersWidget } from '../../system/helpers/situational-modifiers-widget.js';

export class RollDialogBurgerMenuRule {
  constructor({ abilityNameKey } = {}) {
    this.abilityNameKey = abilityNameKey;
  }

  get abilityName() {
    return this.abilityNameKey ? _loc(this.abilityNameKey) : '';
  }

  matches(dialogState) {
    return this.hasAbility(dialogState?.actor);
  }

  hasAbility(actor, abilityName = this.abilityName) {
    if (!actor || !abilityName) return false;

    return actor.items.some(item => item.type === 'specialability' && item.name.includes(abilityName));
  }

  getMenuLabel(labelKey = 'BURGER_MENU.menuLabel') {
    return game.i18n.format(labelKey, { abilityName: this.abilityName });
  }

  getDialogElement(dialogOrElement) {
    return dialogOrElement?.dialog?.element?.[0] || dialogOrElement?.dialog?.element || dialogOrElement?.element?.[0] || dialogOrElement?.element || dialogOrElement?.[0] || dialogOrElement || null;
  }

  getForm(dialogOrElement) {
    return this.getDialogElement(dialogOrElement)?.querySelector?.('form') || null;
  }

  getCurrentFormData(dialogOrElement) {
    const form = this.getForm(dialogOrElement);
    if (!form) return {};

    return new foundry.applications.ux.FormDataExtended(form).object;
  }

  getSituationalModifiersWidget(dialogOrElement) {
    if (typeof dialogOrElement?.getSituationalModifiersWidget === 'function') {
      return dialogOrElement.getSituationalModifiersWidget();
    }

    const root = this.getDialogElement(dialogOrElement);
    return root?.querySelector?.('div[is="dsa-situationalmodifiers"]') || null;
  }

  notifyModifierChange(dialogOrElement) {
    this.getForm(dialogOrElement)?.dispatchEvent(new Event('change', { bubbles: true }));
  }

  hasModifierApplied(dialogOrElement, searchString) {
    const widget = this.getSituationalModifiersWidget(dialogOrElement);
    if (typeof widget?.getModifiers === 'function') {
      return widget.getModifiers().some(modifier => modifier.name === searchString);
    }

    const options = this.getDialogElement(dialogOrElement)?.querySelectorAll?.('select[name="situationalModifiers"] option') || [];
    return Array.from(options).some(option => option.textContent.includes(searchString));
  }

  upsertModifier(dialogOrElement, modifier) {
    const widget = this.getSituationalModifiersWidget(dialogOrElement);
    const modifierValue = modifier.value;
    const serializedValue = modifierValue == null ? '' : String(modifierValue);
    const nextModifier = {
      ...modifier,
      value: modifierValue,
      selected: modifier.selected ?? true,
    };

    if (typeof widget?.getModifiers === 'function' && typeof widget?.setModifiers === 'function') {
      const existingModifiers = widget.getModifiers();
      const updatedModifiers = existingModifiers.some(existing => existing.name === nextModifier.name)
        ? existingModifiers.map(existing => existing.name === nextModifier.name ? { ...existing, ...nextModifier } : existing)
        : [...existingModifiers, nextModifier];

      widget.setModifiers(updatedModifiers);
      this.notifyModifierChange(dialogOrElement);
      return true;
    }

    const select = this.getDialogElement(dialogOrElement)?.querySelector?.('select[name="situationalModifiers"]');
    if (!select) return false;

    const existingOption = Array.from(select.options).find(option => option.textContent.includes(nextModifier.name));
    const displayText = `${nextModifier.name} [${SituationalModifiersWidget.getOptionChangeText(nextModifier)}]`;

    if (existingOption) {
      existingOption.value = serializedValue;
      existingOption.selected = true;
      existingOption.textContent = displayText;
      if (nextModifier.type) existingOption.dataset.type = nextModifier.type;
      else delete existingOption.dataset.type;
      if (nextModifier.source) existingOption.dataset.tooltip = nextModifier.source;
      else delete existingOption.dataset.tooltip;
    } else {
      const option = document.createElement('option');
      option.value = serializedValue;
      option.selected = true;
      option.textContent = displayText;
      if (nextModifier.type) option.dataset.type = nextModifier.type;
      if (nextModifier.source) option.dataset.tooltip = nextModifier.source;
      select.appendChild(option);
    }

    this.notifyModifierChange(dialogOrElement);
    return true;
  }

  clickRollButton(dialogOrElement) {
    const root = this.getDialogElement(dialogOrElement);
    const rollButton = root?.querySelector?.('button[data-action="nonOpposedButton"], button[data-action="rollButton"]');

    if (rollButton) {
      rollButton.click();
      return true;
    }

    const form = this.getForm(dialogOrElement);
    if (!form) return false;

    if (typeof form.requestSubmit === 'function') {
      form.requestSubmit();
      return true;
    }

    form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    return true;
  }
}