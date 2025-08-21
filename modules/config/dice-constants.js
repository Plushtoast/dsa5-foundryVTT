/**
 * Constants for DSA5 dice rolling system
 */

export const DICE_CONSTANTS = {
  // Roll types
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

  // Success levels
  SUCCESS_LEVELS: {
    CRITICAL_FAILURE: -3,
    CRITICAL_SUCCESS: 3
  },

  // Success level descriptions (indexed by level + 3)
  SUCCESS_DESCRIPTIONS: [
    'AstoundingFailure',
    'CriticalFailure', 
    'Failure',
    '',
    'Success',
    'CriticalSuccess',
    'AstoundingSuccess'
  ],

  // Default dice values
  DICE: {
    DEFAULT_BOTCH: 20,
    DEFAULT_CRIT: 1,
    D20_FACES: 20
  },

  // Difficulty levels
  DIFFICULTY: {
    CHALLENGING: 'challenging'
  },

  // Modifier types
  MODIFIER_TYPES: {
    TPM: 'TPM',
    MULTIPLY: '*'
  },

  // Chat modes
  CHAT_MODES: {
    ROLL: 'roll',
    GMROLL: 'gmroll',
    BLINDROLL: 'blindroll',
    SELFROLL: 'selfroll'
  },

  // Template types
  TEMPLATES: {
    MANUAL_ROLL: 'systems/dsa5/templates/dialog/manualroll-dialog.hbs'
  },

  // Regex patterns
  PATTERNS: {
    DICE_NOTATION: /\d{1}[dDwW]\d/g,
    DIE_LOCALIZATION: /[Ww](?=\d)/g
  }
};

