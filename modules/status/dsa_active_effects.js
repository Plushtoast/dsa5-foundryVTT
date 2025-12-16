import Actordsa5 from '../actor/actor-dsa5.js';
const { getProperty, setProperty, getType } = foundry.utils;

export default class DSAActiveEffect extends ActiveEffect {
  static itemChangeRegex = /^@/;
  static deprecatedDataRegex = /^data\./;

  static _parseChargeNumber(raw) {
    // Empty number inputs come through as ""; treat that as "no charges configured".
    if (raw === '' || raw === null || raw === undefined) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

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
        const msg = game.i18n.format('DSAError.ActiveEffectDataChange', {
          name: actor.name,
        });
        console.error(msg);
        change.key = change.key.replace(DSAActiveEffect.deprecatedDataRegex, 'system.');
      }
      return super.apply(actor, change);
    }
  }

  static realyRealyEnabled(effect) {
    const charges = effect?.getFlag?.('dsa5', 'charges');
    if (charges) {
      const value = this._parseChargeNumber(charges.value);
      if (value !== null && value <= 0) return false;
    }

    // Actor-owned effects usually have transfer=false but are still applicable.
    // Item-owned effects require transfer=true to be applied to an actor.
    const isActorEffect = effect?.parent?.documentName === 'Actor';
    if (effect.disabled || (!isActorEffect && !effect.transfer) || effect.system.delayed || (!game.settings.get('dsa5', 'enableWeaponAdvantages') && effect.system.equipmentAdvantage)) return false;

    return true;
  }

  hasCharges() {
    const charges = this.getFlag('dsa5', 'charges');
    if (!charges) return false;
    return this.constructor._parseChargeNumber(charges.value) !== null;
  }

  getChargeData() {
    const charges = this.getFlag('dsa5', 'charges');
    if (!charges) return null;

    const value = this.constructor._parseChargeNumber(charges.value);
    const max = this.constructor._parseChargeNumber(charges.max);
    if (value === null) return null;

    return {
      value: Math.max(0, value),
      max: max === null ? null : Math.max(0, max),
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

    const effectName = this.name || this.label || game.i18n.localize('ActiveEffects.custom');
    const max = charges.max;
    const maxSuffix = max === null ? '' : `/${max}`;
    const changeValueDisplay = `${oldValue}${maxSuffix} <i class="fas fa-arrow-right"></i> ${newValue}${maxSuffix}`;

    const actor = this.parent?.documentName === 'Actor' ? this.parent : (this.parent?.documentName === 'Item' ? this.parent?.parent : null);
    const resolvedSpeaker = speaker || ChatMessage.getSpeaker({ actor });

    if (newValue <= 0) {
      // If the effect is embedded in an Item, we disable it rather than deleting it.
      // If the effect is embedded in an Actor, we delete it.
      if (this.parent?.documentName === 'Item') {
        await this.update({
          disabled: true,
          'flags.dsa5.charges.value': 0,
        });

        if (shouldCreateChatMessage) {
          const chargeLabel = game.i18n.localize('charges');
          const description = game.i18n.localize('ActiveEffects.chargesChatDepletedDisabled');
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
          const chargeLabel = game.i18n.localize('charges');
          const description = game.i18n.localize('ActiveEffects.chargesChatDepletedDeleted');
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

    await this.update({
      'flags.dsa5.charges.value': newValue,
    });

    if (shouldCreateChatMessage) {
      const chargeLabel = game.i18n.localize('charges');
      const description = game.i18n.localize('ActiveEffects.chargesChatConsumed');
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
    return !this.disabled && !this.notApplicable && (game.user.isGM || !this.getFlag('dsa5', 'hidePlayers')) && !this.getFlag('dsa5', 'hideOnToken');
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
    const items = actor.items.filter(item => {
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
