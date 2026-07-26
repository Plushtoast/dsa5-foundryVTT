/**
 * Named ids for the summoning (Beschwörung) creature types.
 *
 * The ids are part of the public contract between the system and the book modules, which register
 * their types by merging into `game.dsa5.apps.playerMenu.conjurationData`. Modules are separate
 * Foundry packages and cannot import this file, so everything here is re-exposed as
 * `game.dsa5.CONJURATION` during `init`.
 */
export const CONJURATION_TYPES = Object.freeze({
  DEMON: 1,
  ELEMENTAL: 2,
  GHOST: 3,
  FAIRY: 4,
  UNDEAD: 5,
  GOLEM: 6,
  CHIMERA: 7,
  DAIMONID: 8,
  GOLEMID: 14,
});

export const CONJURATION_CONTROL_MODES = Object.freeze({
  SERVICES: 'services',
  REQUESTS: 'requests',
  LOYALTY: 'loyalty',
});

/** Maps that book modules extend, keyed by conjuration type id. */
export const CONJURATION_TYPE_MAPS = Object.freeze([
  'conjurationTypes',
  'rules',
  'skills',
  'modifiers',
  'moreModifiers',
  'postFunction',
  'typeVisuals',
  'typeHints',
]);

const controlModeByType = {
  [CONJURATION_TYPES.GHOST]: CONJURATION_CONTROL_MODES.REQUESTS,
  [CONJURATION_TYPES.FAIRY]: CONJURATION_CONTROL_MODES.REQUESTS,
  [CONJURATION_TYPES.UNDEAD]: CONJURATION_CONTROL_MODES.LOYALTY,
  [CONJURATION_TYPES.GOLEM]: CONJURATION_CONTROL_MODES.LOYALTY,
  [CONJURATION_TYPES.CHIMERA]: CONJURATION_CONTROL_MODES.LOYALTY,
  [CONJURATION_TYPES.DAIMONID]: CONJURATION_CONTROL_MODES.LOYALTY,
  [CONJURATION_TYPES.GOLEMID]: CONJURATION_CONTROL_MODES.LOYALTY,
};

/**
 * @param {number|string} typeId
 * @returns {'services'|'requests'|'loyalty'}
 */
export function controlModeForType(typeId) {
  return controlModeByType[Number(typeId)] ?? CONJURATION_CONTROL_MODES.SERVICES;
}

/**
 * Lets a module declare the control mode of a type it registers, instead of patching a core list.
 * @param {number|string} typeId
 * @param {'services'|'requests'|'loyalty'} mode
 */
export function registerConjurationControlMode(typeId, mode) {
  if (!Object.values(CONJURATION_CONTROL_MODES).includes(mode)) {
    throw new Error(`Unknown conjuration control mode: ${mode}`);
  }
  controlModeByType[Number(typeId)] = mode;
}

/**
 * Drops a conjuration type from a registration payload when a more specific book module is active,
 * so the fallback rules of a magic volume do not override the dedicated book.
 * @param {string} moduleName
 * @param {object} data Registration payload about to be merged into `conjurationData`.
 * @param {number|string} id
 */
export function removePrecedence(moduleName, data, id) {
  if (!game.modules.get(moduleName)?.active) return;

  for (const map of CONJURATION_TYPE_MAPS) {
    if (data[map]) delete data[map][id];
  }
}

export const CONJURATION = Object.freeze({
  TYPES: CONJURATION_TYPES,
  CONTROL_MODES: CONJURATION_CONTROL_MODES,
  TYPE_MAPS: CONJURATION_TYPE_MAPS,
  controlModeForType,
  registerConjurationControlMode,
  removePrecedence,
});
