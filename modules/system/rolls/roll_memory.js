import DPS from '../automation/derepositioningsystem.js';
import { SituationalModifiersWidget } from '../helpers/situational-modifiers-widget.js';
const { setProperty, getProperty } = foundry.utils;

export default class RollMemory {
  constructor() {
    this.tokens = {};
    this.actors = {};
  }

  static get wantedKeys() {
    const wantedKeys = [
      'vision',
      'targetMovement',
      'shooterMovement',
      'quickChange',
      'mountOptions',
      'narrowSpace',
      'advantageousPosition',
      'doubleAttack',
      'reduceCostSpell',
      'forceSpell',
      'increaseCastingTime',
      'decreaseCastingTime',
      'removeGesture',
      'removeFormula',
      'waterOptions',
    ];
    if (!DPS.isEnabled) wantedKeys.push('distance');
    return wantedKeys;
  }

  getPath(speaker, source, mode) {
    const subMod = mode || '';
    const itemId = source._id || source.type;
    return speaker.token ? `tokens.${speaker.token || speaker.actor}.${itemId}${subMod}` : `actors.${speaker.actor}.${itemId}${subMod}`;
  }

  remember(speaker, source, mode, formData) {
    const data = this.formDataSerialize(formData);
    if (Object.entries(data).length > 0) setProperty(this, this.getPath(speaker, source, mode), data);
  }

  recall(speaker, source, mode) {
    return getProperty(this, this.getPath(speaker, source, mode));
  }

  formDataSerialize(html) {
    const form = html.find('form');
    const object = {};
    form.find('select').each(function () {
      const key = $(this).attr('name');
      if (RollMemory.wantedKeys.includes(key)) {
        object[key] = $(this).val();
      }
    });
    form.find('input[type="checkbox"]').each(function () {
      const key = $(this).attr('name');
      if (RollMemory.wantedKeys.includes(key)) {
        object[key] = this.checked;
      }
    });

    form.find('.specAbs.active').each(function () {
      if (!object.specAbs) object.specAbs = [];

      object.specAbs.push({
        id: this.dataset.id,
        step: this.dataset.step,
      });
    });

    const situationalModifiers = SituationalModifiersWidget.getStoredModifiers(html);
    if (situationalModifiers.length > 0) {
      object.situationalModifiers = situationalModifiers;
    }

    return object;
  }
}
