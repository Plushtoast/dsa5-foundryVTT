import DSA5 from '../config/config-dsa5.js';

const { getProperty } = foundry.utils;

export const TRADITION_ITEM_KINDS = {
  magical: {
    flagField: 'isArtifact',
    typeField: 'artifact',
    abilityCategory: 'staff',
    typeList: 'traditionArtifacts',
    hasVolume: true,
    fallbackSpecCategory: 'magical',
    pickerTitle: 'SHEET.selectTraditionartifact',
  },
  ceremonial: {
    flagField: 'isCeremonial',
    typeField: 'ceremonialItem',
    abilityCategory: 'ceremonial',
    typeList: 'ceremonialItems',
    hasVolume: false,
    fallbackSpecCategory: 'clerical',
    pickerTitle: 'SHEET.selectCeremonialItem',
  },
};

const PHYSICAL_ITEM_TYPES = new Set(['rangeweapon', 'meleeweapon', 'equipment', 'armor']);

export function isWornTraditionItem(item, config) {
  if (!PHYSICAL_ITEM_TYPES.has(item.type)) return false;
  if (!getProperty(item, `system.${config.flagField}`)) return false;
  return item.system.worn?.value || (item.type === 'equipment' && !item.system.worn?.wearable);
}

export function getAppliedTraditionItems(actor, kind) {
  const config = TRADITION_ITEM_KINDS[kind];
  if (!config) return [];

  return actor.items
    .filter(x => isWornTraditionItem(x, config))
    .map(x => getProperty(x, `system.${config.typeField}`))
    .filter(Boolean);
}

export function ensureBlessedAttribute(item) {
  if (!PHYSICAL_ITEM_TYPES.has(item.type)) return {};

  const blessed = game.i18n.localize('WEAPON.clerical');
  if (!blessed) return {};

  const path = 'system.effect.attributes';
  const current = String(getProperty(item, path) || '');
  if (new RegExp(blessed, 'i').test(current)) return {};

  const trimmed = current.trim();
  const next = trimmed ? `${trimmed}, ${blessed}` : blessed;
  return { [path]: next };
}

export function buildTraditionItemUpdate(item, kind, enabled) {
  const config = TRADITION_ITEM_KINDS[kind];
  const update = { [`system.${config.flagField}`]: enabled };

  if (enabled) {
    const other = kind === 'magical' ? TRADITION_ITEM_KINDS.ceremonial : TRADITION_ITEM_KINDS.magical;
    update[`system.${other.flagField}`] = false;
    if (kind === 'ceremonial') Object.assign(update, ensureBlessedAttribute(item));
  }

  return update;
}

export function collectFlaggedTraditionItems(items, kind) {
  const config = TRADITION_ITEM_KINDS[kind];
  const typeMap = DSA5[config.typeList] || {};
  const result = [];

  for (const item of items) {
    if (!getProperty(item, `system.${config.flagField}`)) continue;

    const copy = item;
    if (config.hasVolume) {
      const typeKey = getProperty(item, `system.${config.typeField}`);
      copy.volume = typeMap[typeKey] || 0;
      copy.volumeFinal = 0;
    }
    result.push(copy);
  }

  return result;
}

export function nestTraditionAbilities(traditionItems, specAbs, kind) {
  const config = TRADITION_ITEM_KINDS[kind];
  const abilities = [...(specAbs[config.abilityCategory] || [])];
  specAbs[config.abilityCategory] = [];

  for (const ability of abilities) {
    const typeKey = getProperty(ability, `system.${config.typeField}`);
    const host = traditionItems.find(x => getProperty(x, `system.${config.typeField}`) === typeKey);

    if (host) {
      host.abilities ??= [];
      host.abilities.push(ability);

      if (config.hasVolume) {
        const vol = Number(ability.system.volume) || 0;
        const volAttr = vol > 0 ? 'volumeFinal' : 'volume';
        host[volAttr] += Math.abs(vol) * Number(ability.system.step?.value || 1);
      }
    } else {
      specAbs[config.fallbackSpecCategory].push(ability);
    }
  }
}

export function prepareTraditionItems(items, specAbs, kind) {
  const traditionItems = collectFlaggedTraditionItems(items, kind);
  nestTraditionAbilities(traditionItems, specAbs, kind);
  return traditionItems;
}
