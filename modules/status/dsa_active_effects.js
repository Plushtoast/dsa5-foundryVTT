import Actordsa5 from '../actor/actor-dsa5.js';
const { getProperty, setProperty, getType } = foundry.utils;

export default class DSAActiveEffect extends ActiveEffect {
  static itemChangeRegex = /^@/;
  static deprecatedDataRegex = /^data\./;
  static migrationConfig = {
    advancedFunction: { path: 'advancedFunction', type: 'number' },
    successEffect: { path: 'successEffect', type: 'number' },
    args0: { path: 'macroArgs.args0', type: 'string' },
    args1: { path: 'macroArgs.args1', type: 'string' },
    args2: { path: 'macroArgs.args2', type: 'string' },
    args3: { path: 'macroArgs.args3', type: 'string' },
    args4: { path: 'macroArgs.args4', type: 'string' },
    customDuration: { path: 'customDuration', type: 'string' },
    specStep: { path: 'specStep', type: 'number' },
    applyToOwner: { path: 'applyToOwner', type: 'boolean' },
    isAura: { path: 'aura.isAura', type: 'boolean' },
    auraRadius: { path: 'aura.auraRadius', type: 'string' },
    borderColor: { path: 'aura.borderColor', type: 'string' },
    fillColor: { path: 'aura.fillColor', type: 'string' },
    borderThickness: { path: 'aura.borderThickness', type: 'number' },
    disposition: { path: 'aura.disposition', type: 'number' },
    templateSource: { path: 'aura.templateSource', type: 'string' },
    onDelayed: { path: 'macroArgs.onDelayed', type: 'string' },
    onRemove: { path: 'macroArgs.onRemove', type: 'string' },
    resistRoll: { path: 'resistRoll', type: 'string' },
    charges: { path: 'charges', type: 'charges' },
    description: { path: 'description', type: 'string' },
    value: { path: 'condition.value', type: 'nullableNumber' },
    max: { path: 'condition.max', type: 'nullableNumber' },
    auto: { path: 'condition.auto', type: 'number' },
    manual: { path: 'condition.manual', type: 'number' },
    horseSpeed: { path: 'horseSpeed', type: 'nullableNumber' },
    hideOnToken: { path: 'visibility.hideOnToken', type: 'boolean' },
    hidePlayers: { path: 'visibility.hidePlayers', type: 'boolean' },
    editable: { path: 'editable', type: 'removeOnly' },
    custom: { path: 'custom', type: 'removeOnly' },
    removeMessage: { path: 'removeMessage', type: 'string' },
  };

  apply(actor, change) {
    if (this.isDepleted()) return {};

    if (DSAActiveEffect.itemChangeRegex.test(change.key)) {
      const modifiedItems = this._getModifiedItems(actor, change);

      for (let item of modifiedItems.items) {
        if (!item.overrides) item.overrides = {};
        const overrides = foundry.utils.flattenObject(item.overrides);
        const newChange = {
          ...change,
          key: modifiedItems.key,
          value: modifiedItems.value,
        };
        const result = super.apply(item, newChange);
        Object.assign(overrides, result);
        item.overrides = foundry.utils.expandObject(overrides);
      }
    } else {
      if (DSAActiveEffect.deprecatedDataRegex.test(change.key)) {
        const msg = _loc('DSAError.ActiveEffectDataChange', {
          name: actor.name,
        });
        console.error(msg);
        change.key = change.key.replace(DSAActiveEffect.deprecatedDataRegex, 'system.');
      }
      return super.apply(actor, change);
    }
  }

  static realyRealyEnabled(effect) {
    const charges = effect?.system?.charges;
    if (charges) {
      if (Number.isFinite(charges.value) && charges.value <= 0) return false;
    }

    const delayedData = effect.system?.delayed;
    const isDelayed = !!delayedData?.enabled;

    const isActorEffect = effect?.parent?.documentName === 'Actor';
    if (
      effect.disabled ||
      (!isActorEffect && !effect.transfer) ||
      isDelayed ||
      (!game.settings.get('dsa5', 'enableWeaponAdvantages') && effect.system.equipmentAdvantage)
    )
      return false;

    return true;
  }

  hasCharges() {
    const charges = this.system?.charges;
    if (!charges) return false;
    return Number.isFinite(charges.value);
  }

  getChargeData() {
    const charges = this.system?.charges;
    if (!charges) return null;

    const value = charges.value;
    if (!Number.isFinite(value)) return null;

    return {
      value: Math.max(0, value),
      max: Number.isFinite(charges.max) ? Math.max(0, charges.max) : null,
    };
  }

  getChargeValue() {
    return this.getChargeData()?.value;
  }

  isDepleted() {
    const value = this.getChargeValue();
    return Number.isFinite(value) && value <= 0;
  }

  async consumeCharges(amount = 1, options = {}) {
    const charges = this.getChargeData();
    if (!charges) return;

    const consume = Math.max(1, Number(amount) || 1);
    const oldValue = charges.value;
    const newValue = Math.max(0, charges.value - consume);

    const shouldCreateChatMessage = !!options?.createChatMessage;
    const speaker = options?.speaker;
    const extraHtml = typeof options?.chatExtraHtml === 'string' ? options.chatExtraHtml : '';

    const effectName = this.name || this.label || _loc('ActiveEffects.custom');
    const max = charges.max;
    const maxSuffix = max === null ? '' : `/${max}`;
    const changeValueDisplay = `${oldValue}${maxSuffix} <i class="fas fa-arrow-right"></i> ${newValue}${maxSuffix}`;

    const actor = this.parent?.documentName === 'Actor' ? this.parent : this.parent?.documentName === 'Item' ? this.parent?.parent : null;
    const resolvedSpeaker = speaker || ChatMessage.getSpeaker({ actor });

    if (newValue <= 0) {
      // If the effect is embedded in an Item, we disable it rather than deleting it.
      // If the effect is embedded in an Actor, we delete it.
      if (this.parent?.documentName === 'Item') {
        await this.update({
          disabled: true,
          'system.charges.value': 0,
        });

        if (shouldCreateChatMessage) {
          const chargeLabel = _loc('charges');
          const description = _loc('ActiveEffects.chargesChatDepletedDisabled');
          const content = `
          <div class="dsa5 chat-card item-card">
            <header class="card-header media">
              <h3 class="item-name">${foundry.utils.escapeHTML(effectName)}</h3>
            </header>
            <div class="card-content">
              ${extraHtml}
              <p>${description}</p>
              <p><b>${chargeLabel}:</b> ${changeValueDisplay}</p>
            </div>
          </div>`;
          await ChatMessage.create({
            content,
            speaker: resolvedSpeaker,
          });
        }
      } else {
        if (shouldCreateChatMessage) {
          const chargeLabel = _loc('charges');
          const description = _loc('ActiveEffects.chargesChatDepletedDeleted');
          const content = `
          <div class="dsa5 chat-card item-card">
            <header class="card-header media">
              <h3 class="item-name">${foundry.utils.escapeHTML(effectName)}</h3>
            </header>
            <div class="card-content">
              ${extraHtml}
              <p>${description}</p>
              <p><b>${chargeLabel}:</b> ${changeValueDisplay}</p>
            </div>
          </div>`;
          await ChatMessage.create({
            content,
            speaker: resolvedSpeaker,
          });
        }
        await this.delete();
      }
      return;
    }

    await this.update({ 'system.charges.value': newValue });

    if (shouldCreateChatMessage) {
      const chargeLabel = _loc('charges');
      const description = _loc('ActiveEffects.chargesChatConsumed');
      const content = `
      <div class="dsa5 chat-card item-card">
        <header class="card-header media">
          <h3 class="item-name">${foundry.utils.escapeHTML(effectName)}</h3>
        </header>
        <div class="card-content">
          ${extraHtml}
          <p>${description}</p>
          <p><b>${chargeLabel}:</b> ${changeValueDisplay}</p>
        </div>
      </div>`;
      await ChatMessage.create({ content, speaker: resolvedSpeaker });
    }
  }

  static async _onCreateOperation(documents, operation, user) {
    for (let doc of documents) {
      if (doc.parent.documentName == 'Actor') await Actordsa5.postUpdateConditions(doc.parent);
    }
    return super._onCreateOperation(documents, operation, user);
  }

  static async _onUpdateOperation(documents, operation, user) {
    for (let doc of documents) {
      if (doc.parent.documentName == 'Actor') await Actordsa5.postUpdateConditions(doc.parent);
    }
    return super._onUpdateOperation(documents, operation, user);
  }

  static async _onDeleteOperation(documents, operation, user) {
    for (let doc of documents) {
      if (doc.parent.documentName == 'Actor') await Actordsa5.postUpdateConditions(doc.parent);
    }
    return super._onDeleteOperation(documents, operation, user);
  }

  isVisibleEffect() {
    return !this.disabled && !this.notApplicable && (game.user.isGM || !this.system?.visibility?.hidePlayers) && !this.system?.visibility?.hideOnToken;
  }

  _displayScrollingStatus(enabled) {
    const allowedEffects = ['dead'];
    const isAllowedToSeeEffects = game.user.isGM || this.target?.testUserPermission(game.user, 'OBSERVER') || !game.settings.get('dsa5', 'hideEffects');
    const visibleEffect = isAllowedToSeeEffects ? this.isVisibleEffect() : allowedEffects.some((y) => this.statuses.has(y));

    if (!visibleEffect) return;

    super._displayScrollingStatus(enabled);
  }

  // key: "@meleeweapon.Rondrakamm (2H).system.attack.value"
  _getModifiedItems(actor, change) {
    const [type, itemName, ...keyParts] = change.key.replace(/^@/, '').split('.');
    const key = keyParts.join('.');
    const { value } = change;

    if (itemName === 'self') {
      return { items: [this.parent], key, value };
    }

    if (!actor?.items) {
      return { items: [], key, value };
    }

    const normalizedType = type.toLowerCase();
    const items = actor.items.filter((item) => {
      if (item.type !== normalizedType) return false;
      if (item.id === itemName) return true;

      try {
        const rgx = new RegExp(itemName, 'i');
        return rgx.test(item.name);
      } catch (e) {
        return item.name.toLowerCase() == itemName.toLowerCase();
      }
    });

    return { items, key, value };
  }

  async _preUpdate(changed, options, user) {
    await super._preUpdate(changed, options, user);
    //this._clearModifiedItems();
  }

  /*_clearModifiedItems() {
    let actor = this.parent;
    if(actor instanceof CONFIG.Item.documentClass) actor = actor?.parent;
    if (!(actor instanceof CONFIG.Actor.documentClass)) return;

    for (let change of this.changes) {
      if (DSAActiveEffect.itemChangeRegex.test(change.key)) {
        const itemsToClear = this._getModifiedItems(actor, change);

        for (const item of itemsToClear.items) {
          const overrides = foundry.utils.flattenObject(item.overrides || {});

          const key = itemsToClear.key;
          delete overrides[key];
          const source = getProperty(item._source, key);
          setProperty(item, key, source);

          item.overrides = foundry.utils.expandObject(overrides);
          if (item.sheet?.rendered) item.sheet.render(t.rue);
        }
      }
    }
  }*/

  async _preDelete(options, user) {
    super._preDelete(options, user);
    //this._clearModifiedItems();
  }

  static migrateData(source) {
    // Migrate legacy flat delayed fields into the nested delayed schema.
    // Old shape examples:
    // - system.delayed: true|false
    // - system.originalDuration
    // - system.macroEffect
    // - system.initialTestData
    // - system.sourceActor
    // - system.source
    const system = source.system;
    const legacyDelayed = system?.delayed;
    const hasLegacyDelayedEnabled = typeof legacyDelayed === 'boolean';
    const hasLegacyDelayedPayload =
      system?.originalDuration !== undefined ||
      system?.macroEffect !== undefined ||
      system?.initialTestData !== undefined ||
      system?.sourceActor !== undefined ||
      system?.source !== undefined;

    if (hasLegacyDelayedEnabled || hasLegacyDelayedPayload) {
      const delayed = {
        ...(typeof legacyDelayed === 'object' && legacyDelayed ? legacyDelayed : {}),
      };

      if (hasLegacyDelayedEnabled && delayed.enabled === undefined) delayed.enabled = legacyDelayed;
      if (system?.originalDuration !== undefined && delayed.originalDuration === undefined) delayed.originalDuration = system.originalDuration;
      if (system?.macroEffect !== undefined && delayed.macroEffect === undefined) delayed.macroEffect = system.macroEffect;
      if (system?.initialTestData !== undefined && delayed.initialTestData === undefined) delayed.initialTestData = system.initialTestData;
      if (system?.sourceActor !== undefined && delayed.sourceActor === undefined) delayed.sourceActor = system.sourceActor;
      if (system?.source !== undefined && delayed.source === undefined) delayed.source = system.source;

      setProperty(source, 'system.delayed', delayed);

      if (system?.originalDuration !== undefined) delete system.originalDuration;
      if (system?.macroEffect !== undefined) delete system.macroEffect;
      if (system?.initialTestData !== undefined) delete system.initialTestData;
      if (system?.sourceActor !== undefined) delete system.sourceActor;
      if (system?.source !== undefined) delete system.source;
    }

    if (!source.flags?.dsa5) return super.migrateData(source);

    const flags = source.flags.dsa5;

    for (const key of Object.keys(flags)) {
      const config = this.migrationConfig[key];
      if (!config) continue;

      const rawValue = flags[key];
      let migratedValue;

      switch (config.type) {
        case 'number': {
          const value = Number(rawValue);
          migratedValue = Number.isFinite(value) ? value : 0;
          break;
        }
        case 'nullableNumber': {
          if (rawValue === null || rawValue === undefined || rawValue === '') {
            migratedValue = null;
          } else {
            const value = Number(rawValue);
            migratedValue = Number.isFinite(value) ? value : null;
          }
          break;
        }
        case 'boolean':
          migratedValue = !!rawValue;
          break;
        case 'charges': {
          const parsedValue = rawValue?.value;
          const parsedMax = rawValue?.max;
          const value = parsedValue === '' || parsedValue === null || parsedValue === undefined ? null : Number(parsedValue);
          const max = parsedMax === '' || parsedMax === null || parsedMax === undefined ? null : Number(parsedMax);
          migratedValue = {
            value: Number.isFinite(value) ? value : null,
            max: Number.isFinite(max) ? max : null,
          };
          break;
        }
        case 'removeOnly':
          delete flags[key];
          continue;
        default:
          migratedValue = rawValue;
      }

      setProperty(source, `system.${config.path}`, migratedValue);
      delete flags[key];
    }

    const remainingKeys = Object.keys(flags);
    if (remainingKeys.length > 0) {
      console.warn(`DSA5 | Active Effect ${source.name} ${source.uuid} has un-migrated keys on flags.dsa5: ${remainingKeys.join(', ')}`);
    } else {
      delete source.flags.dsa5;
    }
    return super.migrateData(source);
  }
}

const applyCustomEffect = (elem, change) => {
  const current = getProperty(elem, change.key) || null;
  const ct = getType(current);
  let update = null;
  switch (ct) {
    case 'Array':
      let newElems = [];
      const source = change.effect.name;
      for (let elem of `${change.value}`.split(/[;,]+/)) {
        let vals = elem.split(' ');
        const value = vals.pop();
        const target = vals.join(' ');
        newElems.push({
          source,
          value,
          target,
          item: change.effect.parent?.name,
          effectId: change.effect.id,
          effectUuid: change.effect.uuid,
        });
      }
      update = current.concat(newElems);
  }
  if (update !== null) setProperty(elem, change.key, update);
  return update;
};

Hooks.on('applyActiveEffect', (actor, change) => {
  return applyCustomEffect(actor, change);
});
