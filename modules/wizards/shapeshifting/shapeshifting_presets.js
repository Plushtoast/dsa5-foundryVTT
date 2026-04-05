const { deepClone, mergeObject } = foundry.utils;

const CHARACTERISTICS_MENTAL = ['mu', 'kl', 'in', 'ch'];
const CHARACTERISTICS_PHYSICAL = ['ff', 'ge', 'ko', 'kk'];
const STATUS_FIELDS = ['wounds', 'karmaenergy', 'astralenergy', 'toughness', 'soulpower'];
const SKILL_GROUPS = ['body', 'social', 'knowledge', 'trade', 'nature'];

function buildUniformRadioPreset(value) {
  const radios = {};

  for (const key of [...CHARACTERISTICS_MENTAL, ...CHARACTERISTICS_PHYSICAL]) {
    radios[`system.characteristics.${key}`] = value;
  }

  for (const key of STATUS_FIELDS) {
    radios[`system.status.${key}`] = value;
  }

  for (const key of SKILL_GROUPS) {
    radios[key] = value;
  }

  return radios;
}

export const SHAPESHIFTING_PRESETS = {
  default: {
    radios: {
      'system.characteristics.mu': 'source',
      'system.characteristics.kl': 'source',
      'system.characteristics.in': 'source',
      'system.characteristics.ch': 'source',
      'system.characteristics.ff': 'target',
      'system.characteristics.ge': 'target',
      'system.characteristics.ko': 'target',
      'system.characteristics.kk': 'target',
      'system.status.wounds': 'source',
      'system.status.karmaenergy': 'target',
      'system.status.astralenergy': 'target',
      'system.status.toughness': 'target',
      'system.status.soulpower': 'source',
      body: 'target',
      social: 'source',
      knowledge: 'source',
      trade: 'source',
      nature: 'source',
    },
    checkboxes: {
      calculateLeP: true,
      takeAdvantages: true,
      takeSkills: true,
      takeSpecAbs: false,
      takeSpells: false,
      takeLiturgies: false,
      keepToken: false,
      keepItems: false,
    },
  },
  sourceOnly: {
    radios: buildUniformRadioPreset('source'),
  },
  targetOnly: {
    radios: buildUniformRadioPreset('target'),
  },
};

export function getShapeshiftingPreset(preset = 'default', overrides = {}) {
  return mergeObject(deepClone(SHAPESHIFTING_PRESETS[preset] || SHAPESHIFTING_PRESETS.default), overrides || {});
}