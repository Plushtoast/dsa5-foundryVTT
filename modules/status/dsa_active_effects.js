import Actordsa5 from '../actor/actor-dsa5.js';
const { getProperty, setProperty, getType } = foundry.utils;

export default class DSAActiveEffect extends ActiveEffect {
  static itemChangeRegex = /^@/;
  static deprecatedDataRegex = /^data\./;

  apply(actor, change) {
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
    if (effect.disabled || !effect.transfer || effect.system.delayed || (!game.settings.get('dsa5', 'enableWeaponAdvantages') && effect.system.equipmentAdvantage)) return false;

    return true;
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
          if (item.sheet?.rendered) item.sheet.render(true);
        }
      }
    }
  }*/

  async _preDelete(options, user) {
    super._preDelete(options, user);
    //this._clearModifiedItems();
  }

  static customAttributeEffect = /^system\.(vulnerabilities|resistances)/;
}

const applyCustomEffect = (elem, change) => {
  let current = getProperty(elem, change.key) || null;
  if (current == null && DSAActiveEffect.customAttributeEffect.test(change.key)) {
    current = [];
    setProperty(elem, change.key, current);
  }
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
        newElems.push({ source, value, target, item: change.effect.parent?.name });
      }
      update = current.concat(newElems);
  }
  if (update !== null) setProperty(elem, change.key, update);
  return update;
};

Hooks.on('applyActiveEffect', (actor, change) => {
  return applyCustomEffect(actor, change);
});
