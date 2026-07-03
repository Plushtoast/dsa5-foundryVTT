import Actordsa5 from '../actor/actor-dsa5.js';
const { setProperty, getType, isPlainObject, hasProperty } = foundry.utils;

export default class DSAActiveEffect extends ActiveEffect {
  static itemChangeRegex = /^@/;
  static actorChangeRegex = /^@actor\./;
  static deprecatedDataRegex = /^data\./;
  static migrationConfig = {
    advancedFunction: { path: 'advancedFunction', type: 'number' },
    successEffect: { path: 'successEffect', type: 'number' },
    args0: { path: 'macroArgs.conditionId', type: 'string' },
    args1: { path: 'macroArgs.conditionValue', type: 'string' },
    args2: { path: 'macroArgs.args2', type: 'removeOnly' },
    args3: { path: 'macroArgs.macro', type: 'string' },
    args4: { path: 'macroArgs.creatureLinks', type: 'string' },
    customDuration: { path: 'customDuration', type: 'string' },
    specStep: { path: 'specStep', type: 'number' },
    applyToOwner: { path: 'applyToOwner', type: 'boolean' },
    isAura: { path: 'aura.isAura', type: 'boolean' },
    auraRadius: { path: 'aura.auraRadius', type: 'string' },
    borderColor: { path: 'aura.borderColor', type: 'string' },
    fillColor: { path: 'aura.fillColor', type: 'removeOnly' },
    borderThickness: { path: 'aura.borderThickness', type: 'removeOnly' },
    disposition: { path: 'aura.disposition', type: 'number' },
    templateSource: { path: 'aura.templateSource', type: 'removeOnly' },
    onDelayed: { path: 'macroArgs.onDelayed', type: 'string' },
    onRemove: { path: 'macroArgs.onRemove', type: 'string' },
    resistRoll: { path: 'resistRoll', type: 'string' },
    charges: { path: 'charges', type: 'charges' },
    maintain: { path: 'maintenance.cost', type: 'nullableNumber' },
    payType: { path: 'maintenance.payType', type: 'string' },
    description: { path: 'description', type: 'string', topLevel: true },
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

  static applyChange(targetDoc, change, options = {}) {
    const effect = change.effect;
    if (effect?.isDepleted?.()) return {};

    if (DSAActiveEffect.itemChangeRegex.test(change.key)) {
      const modifiedItems = effect._getModifiedItems(targetDoc, change);

      for (const item of modifiedItems.items) {
        if (!item.overrides) item.overrides = {};
        const overrides = foundry.utils.flattenObject(item.overrides);
        const newChange = {
          ...change,
          key: modifiedItems.key,
          value: modifiedItems.value,
        };
        const result = super.applyChange(item, newChange, options);
        Object.assign(overrides, result);
        item.overrides = foundry.utils.expandObject(overrides);
      }
      return {};
    } else {
      if (DSAActiveEffect.deprecatedDataRegex.test(change.key)) {
        const msg = _loc('DSAError.ActiveEffectDataChange', {
          name: targetDoc.name,
        });
        console.error(msg);
        change.key = change.key.replace(DSAActiveEffect.deprecatedDataRegex, 'system.');
      }
      return super.applyChange(targetDoc, change, options);
    }
  }

  static _applyChangeCustom(targetDoc, change, current, delta, changes) {
    const update = this._applyCustomEffect(targetDoc, change, current, delta);
    if (update !== null) {
      changes[change.key] = update;
      return;
    }

    return super._applyChangeCustom(targetDoc, change, current, delta, changes);
  }

  static _applyCustomEffect(targetDoc, change, current) {
    const currentValue = current || null;
    const currentType = getType(currentValue);
    let update = null;

    switch (currentType) {
      case 'Array': {
        const newElems = [];
        const source = change.effect.name;
        for (const elem of `${change.value}`.split(/[;,]+/)) {
          const vals = elem.split(' ');
          const value = vals.pop();
          const target = vals.join(' ');
          newElems.push({
            source,
            value,
            target,
            item: change.effect.parent?.name,
            ref: { uuid: change.effect.uuid, id: change.effect.id },
          });
        }
        update = currentValue.concat(newElems);
        break;
      }
    }

    return update;
  }

  static isEnhancementEffect(effect) {
    return effect?.type === 'enhancement';
  }

  static realyRealyEnabled(effect) {
    if (DSAActiveEffect.isEnhancementEffect(effect)) return false;

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

  static auraNeedsSync(effect, changed = {}, { parentChanged = false } = {}) {
    if (!effect?.system?.aura?.isAura) return false;

    if (parentChanged) {
      return hasProperty(changed, 'system.worn.value') || hasProperty(changed, 'system.worn.wearable');
    }

    return hasProperty(changed, 'system.aura') || hasProperty(changed, 'disabled');
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
    for (const doc of documents) {
      if (doc.parent?.documentName == 'Actor') await Actordsa5.postUpdateConditions(doc.parent);
    }
    return super._onCreateOperation(documents, operation, user);
  }

  static async _onUpdateOperation(documents, operation, user) {
    for (const doc of documents) {
      if (doc.parent?.documentName == 'Actor') await Actordsa5.postUpdateConditions(doc.parent);
    }
    return super._onUpdateOperation(documents, operation, user);
  }

  static async _onDeleteOperation(documents, operation, user) {
    for (const doc of documents) {
      if (doc.parent?.documentName == 'Actor') await Actordsa5.postUpdateConditions(doc.parent);
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
  // key: "@actor.system.status.regeneration.AsPConditional" (item enhancement → parent actor)
  static resolveActorChangeKey(key) {
    return key.replace(this.actorChangeRegex, '');
  }

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

  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    if (this.parent?.documentName !== 'Actor') return;

    const update = {};

    const onDelayed = data.system?.macroArgs?.onDelayed;
    if (onDelayed) {
      foundry.utils.mergeObject(update, {
        duration: { value: parseInt(onDelayed) || 0, units: 'seconds' },
        system: {
          delayed: {
            enabled: true,
            originalDuration: data.duration,
          },
        },
      });
    }

    // Ensure duration.value is a valid integer for v14 schema (source data may contain floats from formulas)
    const durVal = update.duration?.value ?? data.duration?.value;
    if (durVal != null && !Number.isInteger(durVal)) {
      update.duration = { ...(update.duration || {}), value: Number.isFinite(Number(durVal)) ? Math.round(Number(durVal)) : null };
    }

    if (Object.keys(update).length) this.updateSource(update);
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

  static migrateBaseActiveEffect(source) {
    // Migrate legacy duration fields to v14 schema (start + duration.value/units).
    // Replicates Foundry core #migrateDuration and start migration so the
    // backward-compat shims (removed in v16) are never triggered.
    const duration = source.duration;
    if (isPlainObject(duration)) {
      // Migrate start timing data out of duration
      if (Object.hasOwn(duration, 'startTime') && !Object.hasOwn(source, 'start')) {
        source.start = typeof duration.startTime === 'number' ? {} : null;
        if (source.start) {
          if (duration.combat !== undefined) { source.start.combat = duration.combat; delete duration.combat; }
          if (duration.startRound !== undefined) { source.start.round = duration.startRound; delete duration.startRound; }
          if (duration.startTime !== undefined) { source.start.time = duration.startTime; delete duration.startTime; }
          if (duration.startTurn !== undefined) { source.start.turn = duration.startTurn; delete duration.startTurn; }
        }
      }
      // Migrate legacy duration.rounds/turns/seconds → duration.value + duration.units
      for (const unit of ['rounds', 'turns', 'seconds']) {
        const hasRealProperty = Object.hasOwn(duration, unit) && !Object.getOwnPropertyDescriptor(duration, unit)?.get;
        if (hasRealProperty && typeof duration[unit] === 'number') {
          if (!Object.hasOwn(duration, 'value')) duration.value = duration[unit];
          if (!Object.hasOwn(duration, 'units')) duration.units = unit;
          delete duration[unit];
          break;
        }
      }
    }

    // NOTE: mode → type and top-level changes → system.changes migration is
    // handled by BaseActiveEffect.migrateData (via super.migrateData) using
    // _addDataFieldMigration which works safely on sealed source objects.
    // Do NOT duplicate that migration here — the source may be non-extensible
    // when called from EmbeddedCollectionField.clean during parent cleaning.

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

      if (config.topLevel) {
        source[config.path] = migratedValue;
      } else {
        setProperty(source, `system.${config.path}`, migratedValue);
      }
      delete flags[key];
    }

    const remainingKeys = Object.keys(flags);
    if (remainingKeys.length > 0) {
      //console.warn(`DSA5 | Active Effect ${source.name} ${source.uuid} has un-migrated keys on flags.dsa5: ${remainingKeys.join(', ')}`);
    } else {
      delete source.flags.dsa5;
    }
    return super.migrateData(source);
  }

  static migrateData(source) {
    if (!source?.type || source.type === 'base') {
      return this.migrateBaseActiveEffect(source);
    }

    return super.migrateData(source);
  }
}
