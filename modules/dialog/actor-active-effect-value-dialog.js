import { DefaultAppv2 } from '../actor/baseapp.js';

const { getProperty } = foundry.utils;

export default class ActorActiveEffectValueDialog extends DefaultAppv2 {
  static DEFAULT_OPTIONS = {
    window: { title: 'ActiveEffects.valueDialog.title' },
    position: { width: 400 },
    classes: ['dsa5', 'actor-active-effect-value-dialog'],
    tag: 'form',
    actions: {
      save: this.#save,
      deleteEffect: this.#deleteEffect,
      cancel: this.#cancel,
    },
  };

  static PARTS = {
    main: {
      template: 'systems/dsa5/templates/dialog/actor-active-effect-value-dialog.hbs',
    },
  };

  constructor({ actor, config, id }) {
    const label = config.label || config.key;
    super({
      id,
      window: {
        title: game.i18n.format('ActiveEffects.valueDialog.title', { label }),
      },
    });
    this.actor = actor;
    this.config = config;
    this.managedEffect = this.constructor.findManagedEffect(actor, config);
  }

  /**
   * Reads reusable active-effect configuration from trigger element data attributes.
   * @param {HTMLElement} element
   * @returns {object}
   */
  static parseTriggerConfig(element) {
    const source = element.closest('[data-ae-key]') ?? element;
    const ds = source.dataset;

    return {
      key: ds.aeKey,
      type: ds.aeType || 'add',
      label: ds.aeLabel || '',
      effectName: ds.aeEffectName || ds.aeLabel || '',
      valueMode: ds.aeValueMode || 'direct',
      basePath: ds.aeBasePath || '',
      baseFactor: Number(ds.aeBaseFactor) || 1,
      icon: ds.aeIcon || 'icons/svg/aura.svg',
    };
  }

  static show(actor, config) {
    if (!actor || !config?.key) return;
    if (!actor.isOwner && !game.user.isGM) return;

    const dialogId = `dsa-actor-ae-value-${actor.id}-${config.key.replace(/\./g, '-')}`;
    const existing = foundry.applications.instances.get(dialogId);
    if (existing) {
      existing.bringToTop();
      return;
    }

    new this({ id: dialogId, actor, config }).render(true);
  }

  static findManagedEffect(actor, config) {
    const { key, effectName } = config;
    const candidates = actor.effects.filter(
      (effect) => !effect.disabled && effect.system?.changes?.some((change) => change.key === key),
    );
    if (!candidates.length) return null;

    if (effectName) {
      const named = candidates.find((effect) => effect.name === effectName);
      if (named) return named;
    }

    if (candidates.length === 1) return candidates[0];

    return (
      candidates.find(
        (effect) =>
          effect.system.changes.length === 1 && effect.system.changes.some((change) => change.key === key),
      ) ?? candidates[0]
    );
  }

  static getManagedChangeValue(effect, key) {
    const change = effect?.system?.changes?.find((entry) => entry.key === key);
    return change ? Number(change.value) || 0 : 0;
  }

  static computeValues(actor, config, effect) {
    const managedValue = effect ? this.getManagedChangeValue(effect, config.key) : 0;
    const systemPath = config.key.startsWith('system.') ? config.key.slice('system.'.length) : config.key;
    const totalFromSystem = Number(getProperty(actor.system, systemPath)) || 0;

    if (config.valueMode === 'derived-total' && config.basePath) {
      const baseValue = (Number(getProperty(actor.system, config.basePath)) || 0) * config.baseFactor;
      const otherModifier = totalFromSystem - managedValue;
      const currentTotal = baseValue + totalFromSystem;

      return {
        baseValue,
        managedValue,
        otherModifier,
        currentTotal,
        displayValue: currentTotal,
      };
    }

    return {
      baseValue: 0,
      managedValue,
      otherModifier: totalFromSystem - managedValue,
      currentTotal: totalFromSystem,
      displayValue: managedValue || totalFromSystem,
    };
  }

  static computeChangeValue(config, displayValue, values) {
    if (config.valueMode === 'derived-total' && config.basePath) {
      return displayValue - values.baseValue - values.otherModifier;
    }
    return displayValue;
  }

  async _prepareContext() {
    const values = this.constructor.computeValues(this.actor, this.config, this.managedEffect);
    const effectName = this.managedEffect?.name || this.config.effectName;

    return {
      config: this.config,
      values,
      effectName,
      hasEffect: !!this.managedEffect,
      label: this.config.label || this.config.key,
    };
  }

  #readFormData() {
    const form = this.element?.tagName === 'FORM' ? this.element : this.element?.querySelector('form');
    if (!form) return null;

    const displayValue = Number(form.elements.displayValue?.value);
    const effectName = `${form.elements.effectName?.value || ''}`.trim();

    if (!Number.isFinite(displayValue)) return null;

    return { displayValue, effectName: effectName || this.config.effectName };
  }

  static async #save(event) {
    event?.preventDefault();
    const formData = this.#readFormData();
    if (!formData) return;

    const values = this.constructor.computeValues(this.actor, this.config, this.managedEffect);
    const changeValue = this.constructor.computeChangeValue(this.config, formData.displayValue, values);
    const effectName = formData.effectName || this.config.effectName;

    if (changeValue === 0) {
      if (this.managedEffect) await this.managedEffect.delete();
      await this.close();
      return;
    }

    if (this.managedEffect) {
      const changeIndex = this.managedEffect.system.changes.findIndex((change) => change.key === this.config.key);
      const updateData = { name: effectName };

      if (changeIndex >= 0) {
        updateData[`system.changes.${changeIndex}.value`] = String(changeValue);
        updateData[`system.changes.${changeIndex}.type`] = this.config.type;
      } else {
        const changes = foundry.utils.duplicate(this.managedEffect.system.changes);
        changes.push({
          key: this.config.key,
          type: this.config.type,
          value: String(changeValue),
          phase: 'initial',
        });
        updateData['system.changes'] = changes;
      }

      await this.managedEffect.update(updateData);
    } else {
      await this.actor.createEmbeddedDocuments('ActiveEffect', [
        {
          name: effectName,
          icon: this.config.icon,
          description: effectName,
          disabled: false,
          duration: {},
          system: {
            changes: [
              {
                key: this.config.key,
                type: this.config.type,
                value: String(changeValue),
                phase: 'initial',
              },
            ],
            visibility: { hideOnToken: true },
          },
        },
      ]);
    }

    await this.close();
  }

  static async #deleteEffect(event) {
    event?.preventDefault();
    if (!this.managedEffect) return;
    await this.managedEffect.delete();
    await this.close();
  }

  static async #cancel(event) {
    event?.preventDefault();
    await this.close();
  }
}
