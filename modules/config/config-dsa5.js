import { SKILL } from "./skill.js";

const DSA5 = {};

DSA5.statusEffects = [
  {
    img: 'icons/svg/skull.svg',
    id: 'dead',
    name: 'CONDITION.defeated',
    description: 'CONDITIONDESCRIPTION.defeated',
  },
  {
    id: 'inpain',
    name: 'CONDITION.inpain',
    img: 'icons/svg/blood.svg',
    description: 'CONDITIONDESCRIPTION.inpain',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.inpain', type: 'add', value: 1 }],
    },
  },
  {
    id: 'prone',
    name: 'CONDITION.prone',
    img: 'icons/svg/falling.svg',
    description: 'CONDITIONDESCRIPTION.prone',
  },
  {
    id: 'unconscious',
    name: 'CONDITION.unconscious',
    img: 'icons/svg/unconscious.svg',
    description: 'CONDITIONDESCRIPTION.unconscious',
  },
  {
    id: 'rooted',
    name: 'CONDITION.rooted',
    img: 'icons/svg/net.svg',
    description: 'CONDITIONDESCRIPTION.rooted',
  },
  {
    id: 'fixated',
    name: 'CONDITION.fixated',
    img: 'icons/svg/padlock.svg',
    description: 'CONDITIONDESCRIPTION.fixated',
  },
  {
    id: 'surprised',
    name: 'CONDITION.surprised',
    img: 'icons/svg/hazard.svg',
    description: 'CONDITIONDESCRIPTION.surprised',
  },
  {
    id: 'blind',
    name: 'CONDITION.blind',
    img: 'icons/svg/blind.svg',
    description: 'CONDITIONDESCRIPTION.blind',
  },
  {
    id: 'poisoned',
    name: 'CONDITION.poisoned',
    img: 'icons/svg/poison.svg',
    description: 'CONDITIONDESCRIPTION.poisoned',
  },
  {
    id: 'sick',
    name: 'CONDITION.sick',
    img: 'icons/svg/biohazard.svg',
    description: 'CONDITIONDESCRIPTION.sick',
  },
  {
    id: 'deaf',
    name: 'CONDITION.deaf',
    img: 'icons/svg/deaf.svg',
    description: 'CONDITIONDESCRIPTION.deaf',
  },
  {
    id: 'burning',
    name: 'CONDITION.burning',
    img: 'icons/svg/fire.svg',
    description: 'CONDITIONDESCRIPTION.burning',
    system: {
      condition: {
        value: 1,
        max: 3,
      },
      changes: [{ key: 'system.condition.burning', type: 'add', value: 1 }],
    },
  },
  {
    id: 'invisible',
    name: 'CONDITION.invisible',
    img: 'icons/svg/circle.svg',
    description: 'CONDITIONDESCRIPTION.invisible',
  },
  {
    id: 'constricted',
    name: 'CONDITION.constricted',
    img: 'icons/svg/cave.svg',
    description: 'CONDITIONDESCRIPTION.constricted',
  },
  {
    id: 'bloodrush',
    name: 'CONDITION.bloodrush',
    img: 'icons/svg/bones.svg',
    description: 'CONDITIONDESCRIPTION.bloodrush',
    system: {
      changes: [
      {
        key: 'system.skillModifiers.step',
        type: 'custom',
        value: 'Kraftakt 2;Feat of Strength 2',
      },
    ],
    },
  },
  {
    id: 'mute',
    name: 'CONDITION.mute',
    img: 'icons/svg/silenced.svg',
    description: 'CONDITIONDESCRIPTION.mute',
  },
  {
    id: 'incapacitated',
    name: 'CONDITION.incapacitated',
    img: 'icons/svg/sleep.svg',
    description: 'CONDITIONDESCRIPTION.incapacitated',
  },
  {
    id: 'encumbered',
    name: 'CONDITION.encumbered',
    img: 'icons/svg/anchor.svg',
    description: 'CONDITIONDESCRIPTION.encumbered',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.encumbered', type: 'add', value: 1 }],
    },
  },
  {
    id: 'stunned',
    name: 'CONDITION.stunned',
    img: 'icons/svg/daze.svg',
    description: 'CONDITIONDESCRIPTION.stunned',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.stunned', type: 'add', value: 1 }],
    },
    duration: { value: 10800, units: 'seconds' },
  },
  {
    id: 'raptured',
    name: 'CONDITION.raptured',
    img: 'icons/svg/ice-aura.svg',   
    description: 'CONDITIONDESCRIPTION.raptured',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.raptured', type: 'add', value: 1 }],
    },
    duration: { value: 3600, units: 'seconds' },
  },
  {
    id: 'feared',
    name: 'CONDITION.feared',
    img: 'icons/svg/terror.svg',
    description: 'CONDITIONDESCRIPTION.feared',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.feared', type: 'add', value: 1 }],
    },
    duration: { value: 300, units: 'seconds' },
  },
  {
    id: 'paralysed',
    name: 'CONDITION.paralysed',
    img: 'icons/svg/paralysis.svg',
    description: 'CONDITIONDESCRIPTION.paralysed',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.paralysed', type: 'add', value: 1 }],
    },
    duration: { value: 3600, units: 'seconds' },
  },
  {
    id: 'confused',
    name: 'CONDITION.confused',
    img: 'icons/svg/stoned.svg',
    description: 'CONDITIONDESCRIPTION.confused',
    system: {
      condition: {
        value: 1,
        max: 4,
      },
      changes: [{ key: 'system.condition.confused', type: 'add', value: 1 }],
    },
    duration: { value: 3600, units: 'seconds' },
  },
  {
    id: 'minorSpirits',
    name: 'CONDITION.minorSpirits',
    img: 'icons/svg/terror.svg',
    description: 'CONDITIONDESCRIPTION.minorSpirits',
    system: {
      changes: [{ key: 'system.skillModifiers.global', type: 'custom', value: -1 }],
    },    
    duration: { value: 600, units: 'seconds' },
  },
  {
    id: 'services',
    name: 'PLAYER.services',
    img: 'icons/svg/aura.svg',
    description: 'CONDITIONDESCRIPTION.services',
    system: {
      condition: {
        value: 1,
        max: 500,
      },
      visibility: {
        hideOnToken: true,
      },
    },
  },
];

DSA5.armorSubcategories = {
  0: 4,
  1: 5,
  2: 6,
  3: 8,
  4: 9,
  5: 13,
  6: 12,
  7: 11,
  8: 10,
};

DSA5.weaponStabilities = {
  Blowpipes: 10,
  Bows: 4,
  Brawling: 12,
  'Chain Weapons': 10,
  Crossbows: 6,
  Daggers: 14,
  Discuses: 12,
  Fans: 13,
  'Fencing Weapons': 8,
  'Impact Weapons': 12,
  Lances: 6,
  Pikes: 12,
  Polearms: 12,
  Shields: 10,
  Slingshots: 4,
  Swords: 13,
  'Throwing Weapons': 10,
  'Two-Handed Impact Weapons': 11,
  'Two-Handed Swords': 12,
  Whips: 4,
};

DSA5.meleeAsRangeReach = {
  Daggers: '1/5/12',
  'Fencing Weapons': '1/3/10',
  'Impact Weapons': '1/3/10',
  'Chain Weapons': '1/3/5',
  Lances: '1/2/3',
  Brawling: '1/5/12',
  Shields: '1/3/10',
  Swords: '1/3/10',
  Polearms: '1/3/5',
  'Two-Handed Impact Weapons': '1/3/5',
  'Two-Handed Swords': '1/3/5',
  Whips: '1/3/5',
  Fans: '1/3/5',
  Pikes: '1/3/5',
};

DSA5.journalFontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32];

DSA5.styles = {
  'dsa5-immersive': 'dsaStyle.immersive',
  'dsa5-immersive dsa5-legacy': 'dsaStyle.legacy',
  'dsa5-naked': 'dsaStyle.naked',
};

DSA5.fallingConditions = {
  0: 'fallingConditions.normal',
  '-1': 'fallingConditions.soft1',
  '-2': 'fallingConditions.soft2',
  '-3': 'fallingConditions.soft3',
  '-4': 'fallingConditions.soft4',
  1: 'fallingConditions.rough1',
  2: 'fallingConditions.rough2',
  3: 'fallingConditions.rough3',
  4: 'fallingConditions.rough4',
};

DSA5.effectTextStyle = CONFIG.canvasTextStyle.clone();
DSA5.effectTextStyle.fontSize = '30';
DSA5.effectTextStyle.fontFamily = 'GentiumBasic';

DSA5.knownShortcuts = {};

DSA5.gearModifyableCalculatedAttributes = ['fatePoints', 'initiative', 'speed', 'astralenergy', 'karmaenergy', 'wounds', 'dodge', 'soulpower', 'toughness'];

DSA5.asyncHooks = {
  postProcessDSARoll: [],
  postProcessOpposedResult: [],
};

DSA5.characteristics = {
  mu: 'CHAR.MU',
  kl: 'CHAR.KL',
  in: 'CHAR.IN',
  ch: 'CHAR.CH',
  ff: 'CHAR.FF',
  ge: 'CHAR.GE',
  ko: 'CHAR.KO',
  kk: 'CHAR.KK',
};

DSA5.equipmentTypes = {
  misc: 'Equipment.misc',
  clothes: 'Equipment.clothes',
  tools: 'Equipment.tools',
  light: 'Equipment.light',
  healing: 'Equipment.healing',
  bags: 'Equipment.bags',
  wealth: 'Equipment.wealth',
  writing: 'Equipment.writing',
  alchemy: 'Equipment.alchemy',
  service: 'Equipment.service',
  luxus: 'Equipment.luxus',
  blessed: 'Equipment.blessed',
  food: 'Equipment.food',
  automat: 'Equipment.automat',
};

DSA5.equipmentCategories = new Set(['meleeweapon', 'rangeweapon', 'equipment', 'ammunition', 'armor', 'poison', 'consumable', 'plant', 'book']);
DSA5.magicCategories = new Set(['ritual', 'ceremony', 'spell', 'liturgy', 'blessing', 'magictrick', 'spellextension', 'magicalsign']);

DSA5.systemTables = [
  {
    name: 'Defense',
    attrs: 'data-weaponless="false"',
    roll: 'botch-roll',
    pack: { de: 'dsa5.patzer', en: 'dsa5.botch' },
    setting: { module: 'dsa5', key: 'defenseBotchTableEnabled' },
  },
  {
    name: 'Melee',
    attrs: 'data-weaponless="false"',
    roll: 'botch-roll',
    pack: { de: 'dsa5.patzer', en: 'dsa5.botch' },
    setting: { module: 'dsa5', key: 'meleeBotchTableEnabled' },
  },
  {
    name: 'Range',
    attrs: 'data-weaponless="false"',
    roll: 'botch-roll',
    pack: { de: 'dsa5.patzer', en: 'dsa5.botch' },
    setting: { module: 'dsa5', key: 'rangeBotchTableEnabled' },
  },
  {
    name: 'Liturgy',
    attrs: '',
    roll: 'botch-roll',
    pack: { de: 'dsa5.patzer', en: 'dsa5.botch' },
    setting: { module: '', key: '' },
  },
  {
    name: 'Spell',
    attrs: '',
    roll: 'botch-roll',
    pack: { de: 'dsa5.patzer', en: 'dsa5.botch' },
    setting: { module: '', key: '' },
  },
];

DSA5.morePackages = {
  packages: {},
  names: {
    de: [],
    en: [],
  },
};

DSA5.initDies = {
  '': '-',
  '1d6': '1d6',
  '2d6': '2d6',
  '3d6': '3d6',
  '4d6': '4d6',
};

DSA5.narrowSpaceModifiers = {
  weaponshort: {
    attack: 0,
    parry: 0,
    label: 'NarrowSpaceModifiers.weapon.short',
  },
  weaponmedium: {
    attack: -4,
    parry: -4,
    label: 'NarrowSpaceModifiers.weapon.medium',
  },
  weaponlong: {
    attack: -8,
    parry: -8,
    label: 'NarrowSpaceModifiers.weapon.long',
  },
  shieldshort: {
    attack: -2,
    parry: -2,
    label: 'NarrowSpaceModifiers.shield.short',
  },
  shieldmedium: {
    attack: -4,
    parry: -3,
    label: 'NarrowSpaceModifiers.shield.medium',
  },
  shieldlong: {
    attack: -6,
    parry: -4,
    label: 'NarrowSpaceModifiers.shield.long',
  },
};

DSA5.exemplarTypes = {
  0: 'BOOKITEM.exemplarTypes.0',
  1: 'BOOKITEM.exemplarTypes.1',
  2: 'BOOKITEM.exemplarTypes.2',
  3: 'BOOKITEM.exemplarTypes.3',
  4: 'BOOKITEM.exemplarTypes.4',
  5: 'BOOKITEM.exemplarTypes.5',
  6: 'BOOKITEM.exemplarTypes.6',
  7: 'BOOKITEM.exemplarTypes.7',
  8: 'BOOKITEM.exemplarTypes.8',
  9: 'BOOKITEM.exemplarTypes.9',
};

DSA5.legalities = {
  0: 'BOOKITEM.legalities.0',
  1: 'BOOKITEM.legalities.1',
};

DSA5.bookQualities = {
  0: 'BOOKITEM.qualities.0',
  1: 'BOOKITEM.qualities.1',
  2: 'BOOKITEM.qualities.2',
  3: 'BOOKITEM.qualities.3',
  4: 'BOOKITEM.qualities.4',
};

DSA5.bookFormats = {
  0: 'BOOKITEM.formats.0',
  1: 'BOOKITEM.formats.1',
  2: 'BOOKITEM.formats.2',
  3: 'BOOKITEM.formats.3',
  4: 'BOOKITEM.formats.4',
  5: 'BOOKITEM.formats.5',
  6: 'BOOKITEM.formats.6',
};

DSA5.traditionArtifacts = {
  Animistenwaffe: 15,
  Bannschwert: 15,
  Druidendolch: 15,
  Druidensichel: 12,
  Zauberkleidung: 15,
  Goblinkeule: 15,
  Magierkugel: 12,
  Zauberinstrument: 15,
  Narrenkappe: 15,
  Hexenkessel: 15,
  Krallenkette: 12,
  Lebensring: 12,
  Alchimistenschale: 15,
  'Scharlatanische Zauberkugel': 15,
  Sippenchronik: 15,
  Schelmenspielzeug: 12,
  Zauberstecken: 0,
  Magierstab: 18,
  Trinkhorn: 12,
  Schuppenbeutel: 18,
  'Kristallomantische Kristallkugel': 15,
  Echsenhaube: 12,
  Hauerkette: 9,
  Zauberschale: 0,
  Schweinetrommel: 12
};

DSA5.areaTargetTypes = {
  cube: 'rectangle',
  line: 'line',
  sphere: 'circle',
  cone: 'cone',
  ring: 'ring',
};

DSA5.regnerationCampLocations = {
  0: 'regnerationCampLocations.normal',
  '-1': 'regnerationCampLocations.bad',
  1: 'regnerationCampLocations.good',
};

DSA5.regenerationInterruptOptions = {
  0: 'regenerationInterruptOptions.none',
  '-1': 'regenerationInterruptOptions.small',
  '-2': 'regenerationInterruptOptions.big',
};

DSA5.merchantTypes = {
  none: 'MERCHANT.typeNone',
  merchant: 'MERCHANT.typeMerchant',
  loot: 'MERCHANT.typeLoot',
  epic: 'MERCHANT.typeEpic',
};

DSA5.locationTypes = {
  foot: 'locationTypes.foot',
  vehicle: 'locationTypes.vehicle',
  river: 'locationTypes.river',
  sea: 'locationTypes.sea',
};

DSA5.targetMovementOptions = {
  0: 'rangeMovementOptions.SLOW',
  '-2': 'rangeMovementOptions.FAST',
  2: 'rangeMovementOptions.STATIONARY',
};

DSA5.allowedforeignfields = ['system.details.notes.value'];

DSA5.shooterMovementOptions = {
  0: 'rangeMovementOptions.SHOOTERSTATIONARY',
  '-2': 'rangeMovementOptions.SHOOTERMOVING',
  '-4': 'rangeMovementOptions.SHOOTERRUNNING',
};

DSA5.mountedRangeOptionsSpecAb = {
  STATIONARY: '0',
  SCHRITT: '0',
  TROT: '-5000',
  GALOPP: '-4',
};

DSA5.mountedRangeOptions = {
  STATIONARY: '0',
  SCHRITT: '-4',
  TROT: '-5000',
  GALOPP: '-8',
};

DSA5.drivingArcherOptions = {
  STATIONARY: '0',
  SCHRITT: '-2',
  GALOPP: '-4',
  TROT: '-5000',
};

DSA5.drivingArcherOptionsSpecAb = {
  STATIONARY: '0',
  SCHRITT: '0',
  GALOPP: '-2',
  TROT: '-4',
};

DSA5.masterTokens = [];

DSA5.traitCategories = {
  meleeAttack: 'closeCombatAttacks',
  rangeAttack: 'rangeCombatAttacks',
  armor: 'armor',
  general: 'general',
  familiar: 'familiar',
  trick: 'trick',
  training: 'training',
  entity: 'entityAbility',
  summoning: 'summoningPackage',
};

DSA5.ritualLocationModifiers = {
  0: '-',
  1: 'RITUALMODIFIER.holysite',
  '-3': 'RITUALMODIFIER.wrongsite',
};

DSA5.ritualTimeModifiers = {
  0: '-',
  1: 'RITUALMODIFIER.matchingConstellation',
  '-1': 'RITUALMODIFIER.wrongConstellation',
};

DSA5.ceremonyLocationModifiers = {
  0: '-',
  2: 'CEREMONYMODIFIER.holysite',
  1: 'CEREMONYMODIFIER.temple',
  '-1': 'CEREMONYMODIFIER.otherTemple',
  '-2': 'CEREMONYMODIFIER.enemyGod',
  '-3': 'CEREMONYMODIFIER.archDemon',
  '-4': 'CEREMONYMODIFIER.nameless',
  '-5': 'CEREMONYMODIFIER.nemesis',
};

DSA5.advancementCosts = {
  A: [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
  B: [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
  C: [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42],
  D: [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56],
  E: [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180],
};

DSA5.hooks = {};

DSA5.startXP = {
  900: 'EXP.inexperienced',
  1000: 'EXP.average',
  1100: 'EXP.experienced',
  1200: 'EXP.competent',
  1400: 'EXP.masterful',
  1700: 'EXP.brillant',
  2100: 'EXP.legendary',
};

DSA5.helpContent = [
  {
    name: 'pay',
    command: '/pay [0-9]+ [description]',
    example: '/pay 5.03 Tavern bill',
  },
  {
    name: 'getPaid',
    command: '/getPaid [0-9]+ [description]',
    example: '/getPaid 5.03 Quest reward',
  },
  {
    name: 'quickAbility',
    command: '/sk [a-z]*, /sp [a-z]*, /li [a-z]*, /at [a-z]*, /pa [a-z]*',
    example: '/sk betören',
  },
  {
    name: 'conditions',
    command: '/conditions',
    example: '/conditions',
  },
  {
    name: 'tables',
    command: '/tables',
    example: '/tables',
  },
  {
    name: 'request',
    command: '/rq',
    example: '/rq betören',
  },
  {
    name: 'threeD20Check',
    command: '/ch',
    example: '/ch',
  },
  {
    name: 'groupcheck',
    command: '/gc',
    example: '/gc',
  },
  {
    name: 'packages',
    command: '/packages',
    example: '/packages',
  },
];

DSA5.ceremonyTimeModifiers = {
  0: '-',
  1: 'CEREMONYMODIFIER.monthGod',
  2: 'CEREMONYMODIFIER.celebration',
  '-5': 'CEREMONYMODIFIER.namelessDays',
};

DSA5.mageLevels = {
  mundane: 'mundane',
  clerical: 'clerical',
  magical: 'magical',
};

DSA5.speciesCombatModifiers = {
  Dwarf: {
    combatskills: new Set(['Fencing Weapons', 'Bows']),
    opposingDomains: new Set(['Elf']),
  },
  Elf: {
    combatskills: new Set(['Two-Handed Impact Weapons', 'Two-Handed Swords']),
    opposingDomains: new Set(['Dwarf']),
  },
};

DSA5.addvantageRules = {};
DSA5.removevantageRules = {};
DSA5.vantagesNeedingAdaption = {};

DSA5.addAbilityRules = {};
DSA5.removeAbilityRules = {};
DSA5.AbilitiesNeedingAdaption = {};
DSA5.addTraitRules = {};
DSA5.spellRules = {};

DSA5.meleeRangesArray = ['short', 'medium', 'long'];

DSA5.meleeRanges = {
  short: 'Range-short',
  medium: 'Range-medium',
  long: 'Range-long',
};

DSA5.weaponReachModifiers = {
  short:  { short: 0, medium: -2, long: -4 },
  medium: { short: 0, medium: 0,  long: -2 },
  long:   { short: 0, medium: 0,  long: 0  },
};

DSA5.weapontypes = {
  0: 'TYPES.Item.meleeweapon',
  1: 'TYPES.Item.rangeweapon',
};

DSA5.moneyTypes = {
  0: 'MoneyType.0',
  1: 'MoneyType.1',
};

DSA5.ammunitiongroups = {
  '-': '-',
  arrow: 'arrow',
  bolt: 'bolt',
  bullet: 'bullet',
  stone: 'stone',
  dart: 'dart',
  mag: 'mag',
  infinite: 'infinite',
};

DSA5.combatskillsGuidevalues = {
  ff: 'CHAR.FF',
  ge: 'CHAR.GE',
  kk: 'CHAR.KK',
  'ge/kk': 'CHAR.GEKK',
};

DSA5.skillDifficultyModifiers = {
  eeasy: 5,
  veasy: 3,
  easy: 1,
  challenging: 0,
  difficult: -1,
  hard: -3,
  vhard: -5,
};

DSA5.magicResistanceModifiers = {
  '-': '-',
  SK: 'soulpower',
  ZK: 'toughness',
};

DSA5.magicalActionKinds = {
  '': 'MAGICALACTION.none',
  animistenkraefte: 'MAGICALACTION.animistenkraefte',
  bannzeichen: 'MAGICALACTION.bannzeichen',
  elfenlieder: 'MAGICALACTION.elfenlieder',
  geodenritual: 'MAGICALACTION.geodenritual',
  goblinrituale: 'MAGICALACTION.goblinrituale',
  herrschaftsritual: 'MAGICALACTION.herrschaftsritual',
  hexenflueche: 'MAGICALACTION.hexenflueche',
  schelmenstreiche: 'MAGICALACTION.schelmenstreiche',
  verzerrte_elfenlieder: 'MAGICALACTION.verzerrte_elfenlieder',
  zaubermelodien: 'MAGICALACTION.zaubermelodien',
  zauberrunen: 'MAGICALACTION.zauberrunen',
  zaubertaenze: 'MAGICALACTION.zaubertaenze',
  zibiljarituale: 'MAGICALACTION.zibiljarituale',
};

DSA5.impossibleWeaponsForWater = new Set(['Chain Weapons', 'Blowpipes', 'Bows', 'Crossbows', 'Slingshots', 'Throwing Weapons']);
DSA5.goodWeaponsForWater = new Set(['Daggers', 'Fencing Weapons', 'Polearms']);

DSA5.poisonSubTypes = {
  1: 'poisonCategory.1',
  4: 'poisonCategory.4',
  5: 'poisonCategory.5',
  6: 'poisonCategory.6',
  7: 'poisonCategory.7',
  2: 'poisonCategory.2',
  3: 'poisonCategory.3',
};

DSA5.sizeCategories = {
  tiny: 'SIZE.tiny',
  small: 'SIZE.small',
  average: 'SIZE.average',
  big: 'SIZE.big',
  giant: 'SIZE.giant',
};

DSA5.tokenSizeCategories = {
  tiny: 0.5,
  small: 0.8,
  average: 1,
  big: 2,
  giant: 4,
};

DSA5.meleeSizeCategories = {
  tiny: 'MELEESIZE.tiny',
  small: 'MELEESIZE.small',
  average: 'MELEESIZE.average',
  big: 'MELEESIZE.big',
  giant: 'MELEESIZE.giant',
};

DSA5.shieldSizes = {
  short: 'SIZE.small',
  medium: 'SIZE.average',
  long: 'SIZE.big',
};

DSA5.meleeSizeModifier = {
  tiny: -4,
  small: 0,
  average: 0,
  big: 0,
  giant: 0,
};

DSA5.rangeVision = {
  0: 'VisionDisruption.step0',
  '-2': 'VisionDisruption.step1',
  '-4': 'VisionDisruption.step2',
  '-6': 'VisionDisruption.step3',
  '-5000': 'VisionDisruption.step4',
};

DSA5.skillVision = {
  0: 'VisionDisruption.step0',
  '-1': 'SkillVisionDisruption.step1',
  '-2': 'SkillVisionDisruption.step2',
  '-3': 'SkillVisionDisruption.step3',
  '-4': 'SkillVisionDisruption.step4',
};

DSA5.meleeRangeVision = (mode) => {
  return {
    '+0': 'meleeVisionDisruption.0',
    '-1': 'meleeVisionDisruption.1',
    '-2': 'meleeVisionDisruption.2',
    '-3': 'meleeVisionDisruption.3',
    [mode == 'attack' ? '*0,5' : '-5000']: 'meleeVisionDisruption.4',
  };
};

DSA5.attributeDifficultyModifiers = {
  eeasy: 6,
  veasy: 4,
  easy: 2,
  challenging: 0,
  difficult: -2,
  hard: -4,
  vhard: -6,
};

DSA5.skillDifficultyLabels = {
  eeasy: 'Skill-eeasy',
  veasy: 'Skill-veasy',
  easy: 'Skill-easy',
  challenging: 'Skill-challenging',
  difficult: 'Skill-difficult',
  hard: 'Skill-hard',
  vhard: 'Skill-vhard',
};

DSA5.attributeDifficultyLabels = {
  eeasy: 'Attribute-eeasy',
  veasy: 'Attribute-veasy',
  easy: 'Attribute-easy',
  challenging: 'Attribute-challenging',
  difficult: 'Attribute-difficult',
  hard: 'Attribute-hard',
  vhard: 'Attribute-vhard',
};

DSA5.hitboxes = {
  0: 'HITBOX.humanoid.medium',
  1: 'HITBOX.humanoid.small',
  2: 'HITBOX.humanoid.large',
  3: 'HITBOX.nonhumanoid.small',
  4: 'HITBOX.nonhumanoid.medium',
  5: 'HITBOX.nonhumanoid.large',
  6: 'HITBOX.creature.large',
  7: 'HITBOX.creature.giant',
  8: 'HITBOX.creature.kraken',
  9: 'HITBOX.creature.amorph',
};

DSA5.skillGroups = {
  body: 'SKILL.body',
  social: 'SKILL.social',
  knowledge: 'SKILL.knowledge',
  trade: 'SKILL.trade',
  nature: 'SKILL.nature',
};

DSA5.features = ['Object', 'Spheres', 'Influence', 'Clairvoyance', 'Healing', 'Transformation', 'Telekinesis', 'Elemental', 'Illusion', 'Anti-Magic', 'Demonic', 'Temporal'];

DSA5.skillBurdens = {
  yes: 'yes',
  no: 'no',
  maybe: 'maybe',
};

DSA5.StFs = {
  A: 'A',
  B: 'B',
  C: 'C',
  D: 'D',
};

DSA5.noteIcons = {
  'Griffin Shield': 'systems/dsa5/icons/thirdparty/griffinshield.svg',
  'At Sea': 'systems/dsa5/icons/thirdparty/at-sea.svg',
  'Medieval Gate': 'systems/dsa5/icons/thirdparty/medieval-gate.svg',
  'Position Marker': 'systems/dsa5/icons/thirdparty/position-marker.svg',
  River: 'systems/dsa5/icons/thirdparty/river.svg',
  Trail: 'systems/dsa5/icons/thirdparty/trail.svg',
};

DSA5.enhancementTypes = {
    material: 'Enhancement.types.material',
    creationTechnique: 'Enhancement.types.creationTechnique',
    improvement: 'Enhancement.types.improvement',
};

DSA5.SKILL = SKILL;

DSA5.NEEDS_MIGRATION_VERSION = 39;

export default DSA5;
