/**
 * Constants for DSA5 dice rolling system
 */

export const DICE_CONSTANTS = {
  ROLL_TYPES: {
    SPELL: 'spell',
    RITUAL: 'ritual',
    LITURGY: 'liturgy',
    CEREMONY: 'ceremony',
    SKILL: 'skill',
    COMBATSKILL: 'combatskill',
    TRAIT: 'trait',
    REGENERATE: 'regenerate',
    MELEEWEAPON: 'meleeweapon',
    RANGEWEAPON: 'rangeweapon',
    DODGE: 'dodge',
    POISON: 'poison',
    DISEASE: 'disease',
    FALLING_DAMAGE: 'fallingDamage',
    WEAPONLESS: 'weaponless'
  },

  SUCCESS_LEVELS: {
    CRITICAL_FAILURE: -3,
    CRITICAL_SUCCESS: 3
  },

  SUCCESS_DESCRIPTIONS: [
    'AstoundingFailure',
    'CriticalFailure',
    'Failure',
    '',
    'Success',
    'CriticalSuccess',
    'AstoundingSuccess'
  ],

  DICE: {
    DEFAULT_BOTCH: 20,
    DEFAULT_CRIT: 1,
    D20_FACES: 20
  },

  DIFFICULTY: {
    CHALLENGING: 'challenging'
  },

  MODIFIER_TYPES: {
    TPM: 'TPM',
    MULTIPLY: '*'
  },

  CHAT_MODES: {
    ROLL: 'roll',
    GMROLL: 'gmroll',
    BLINDROLL: 'blindroll',
    SELFROLL: 'selfroll'
  },

  TEMPLATES: {
    MANUAL_ROLL: 'systems/dsa5/templates/dialog/manualroll-dialog.hbs'
  },

  PATTERNS: {
    DICE_NOTATION: /\d{1}[dDwW]\d/g,
    DIE_LOCALIZATION: /[Ww](?=\d)/g
  }
};

