const DSA5 = {}

//TODO label should not be required anymore, but foundry11 bug?
DSA5.statusEffects = [{
        icon: "icons/svg/skull.svg",
        id: "dead",
        name: "CONDITION.defeated",
        label: "CONDITION.defeated",
        description: "CONDITIONDESCRIPTION.defeated",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "inpain",
        name: "CONDITION.inpain",
        icon: "icons/svg/blood.svg",
        description: "CONDITIONDESCRIPTION.inpain",
        changes: [ { "key": "system.condition.inpain", "mode": 2, "value": 1 }],
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "prone",
        name: "CONDITION.prone",
        icon: "icons/svg/falling.svg",
        description: "CONDITIONDESCRIPTION.prone",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "unconscious",
        name: "CONDITION.unconscious",
        icon: "icons/svg/unconscious.svg",
        description: "CONDITIONDESCRIPTION.unconscious",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "rooted",
        name: "CONDITION.rooted",
        icon: "icons/svg/net.svg",
        description: "CONDITIONDESCRIPTION.rooted",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "fixated",
        name: "CONDITION.fixated",
        icon: "icons/svg/padlock.svg",
        description: "CONDITIONDESCRIPTION.fixated",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "surprised",
        name: "CONDITION.surprised",
        icon: "icons/svg/hazard.svg",
        description: "CONDITIONDESCRIPTION.surprised",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "blind",
        name: "CONDITION.blind",
        icon: "icons/svg/blind.svg",
        description: "CONDITIONDESCRIPTION.blind",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "poisoned",
        name: "CONDITION.poisoned",
        icon: "icons/svg/poison.svg",
        description: "CONDITIONDESCRIPTION.poisoned",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "sick",
        name: "CONDITION.sick",
        icon: "icons/svg/biohazard.svg",
        description: "CONDITIONDESCRIPTION.sick",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "deaf",
        name: "CONDITION.deaf",
        icon: "icons/svg/deaf.svg",
        description: "CONDITIONDESCRIPTION.deaf",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "burning",
        name: "CONDITION.burning",
        icon: "icons/svg/fire.svg",
        description: "CONDITIONDESCRIPTION.burning",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 3
            }
        }
    },
    {
        id: "invisible",
        name: "CONDITION.invisible",
        icon: "icons/svg/circle.svg",
        description: "CONDITIONDESCRIPTION.invisible",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "constricted",
        name: "CONDITION.constricted",
        icon: "icons/svg/cave.svg",
        description: "CONDITIONDESCRIPTION.constricted",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "bloodrush",
        name: "CONDITION.bloodrush",
        icon: "icons/svg/bones.svg",
        description: "CONDITIONDESCRIPTION.bloodrush",
        changes: [
            { key: "system.skillModifiers.step", mode: 0, value: "Kraftakt 2;Feat of Strength 2" }
        ],
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "mute",
        name: "CONDITION.mute",
        icon: "icons/svg/silenced.svg",
        description: "CONDITIONDESCRIPTION.mute",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "incapacitated",
        name: "CONDITION.incapacitated",
        icon: "icons/svg/sleep.svg",
        description: "CONDITIONDESCRIPTION.incapacitated",
        flags: {
            dsa5: {
                "value": null,
                "editable": true
            }
        }
    },
    {
        id: "encumbered",
        name: "CONDITION.encumbered",
        icon: "icons/svg/anchor.svg",
        changes: [ { "key": "system.condition.encumbered", "mode": 2, "value": 1 }],
        description: "CONDITIONDESCRIPTION.encumbered",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "stunned",
        name: "CONDITION.stunned",
        icon: "icons/svg/daze.svg",
        changes: [ { "key": "system.condition.stunned", "mode": 2, "value": 1 }],
        description: "CONDITIONDESCRIPTION.stunned",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "raptured",
        name: "CONDITION.raptured",
        icon: "icons/svg/ice-aura.svg",
        changes: [ { "key": "system.condition.raptured", "mode": 2, "value": 1 }],
        description: "CONDITIONDESCRIPTION.raptured",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "feared",
        name: "CONDITION.feared",
        icon: "icons/svg/terror.svg",
        description: "CONDITIONDESCRIPTION.feared",
        changes: [ { "key": "system.condition.feared", "mode": 2, "value": 1 }],
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "paralysed",
        name: "CONDITION.paralysed",
        icon: "icons/svg/paralysis.svg",
        description: "CONDITIONDESCRIPTION.paralysed",
        changes: [ { "key": "system.condition.paralysed", "mode": 2, "value": 1 }],
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "confused",
        name: "CONDITION.confused",
        icon: "icons/svg/stoned.svg",
        description: "CONDITIONDESCRIPTION.confused",
        changes: [ { "key": "system.condition.confused", "mode": 2, "value": 1 }],
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 4
            }
        }
    },
    {
        id: "minorSpirits",
        name: "CONDITION.minorSpirits",
        icon: "icons/svg/terror.svg",
        description: "CONDITIONDESCRIPTION.minorSpirits",
        changes: [
            { key: "system.skillModifiers.global", mode: 0, value: -1 }
        ],
        duration: { seconds: 600 },
        flags: {
            dsa5: {
                value: null,
                editable: true,
            }
        }
    },
    {
        id: "services",
        name: "PLAYER.services",
        icon: "icons/svg/aura.svg",
        description: "CONDITIONDESCRIPTION.services",
        flags: {
            dsa5: {
                "value": 1,
                "editable": true,
                "max": 500,
                "hideOnToken": true
            }
        }
    }
]

DSA5.armorSubcategories = {
    "0": 4,
    "1": 5,
    "2": 6,
    "3": 8,
    "4": 9,
    "5": 13,
    "6": 12,
    "7": 11,
    "8": 10
}

DSA5.weaponStabilities = {
    "Blowpipes": 10,
    "Bows": 4,
    "Brawling": 12,
    "Chain Weapons": 10,
    "Crossbows": 6,
    "Daggers": 14,
    "Discuses": 12,
    "Fans": 13,
    "Fencing Weapons": 8,
    "Impact Weapons": 12,
    "Lances": 6,
    "Pikes": 12,
    "Polearms": 12,
    "Shields": 10,
    "Slingshots": 4,
    "Swords": 13,
    "Throwing Weapons": 10,
    "Two-Handed Impact Weapons": 11,
    "Two-Handed Swords": 12,
    "Whips": 4
}

DSA5.journalFontSizes = [8, 10, 12, 14, 16, 18, 20, 24, 28, 32];

DSA5.styles = {
    "dsa5-immersive": "dsaStyle.immersive",
    "dsa5-naked": "dsaStyle.naked"
}

DSA5.fallingConditions = {
    normal: 0,
    soft1: -1,
    soft2: -2,
    soft3: -3,
    soft4: -4,
    rough1: 1,
    rough2: 2,
    rough3: 3,
    rough4: 4
},

DSA5.combatSkillSubCategories = {
    "0": "COMBATSKILLCATEGORY.0",
    "1": "COMBATSKILLCATEGORY.1",
    "2": "COMBATSKILLCATEGORY.2",
    "3": "COMBATSKILLCATEGORY.3",
    "4": "COMBATSKILLCATEGORY.4",
    "5": "COMBATSKILLCATEGORY.5"
}

DSA5.effectTextStyle = CONFIG.canvasTextStyle.clone();
DSA5.effectTextStyle.fontSize = "30";
DSA5.effectTextStyle.fontFamily = "GentiumBasic"

DSA5.knownShortcuts = {}

DSA5.gearModifyableCalculatedAttributes = ["fatePoints", "initiative", "speed", "astralenergy", "karmaenergy", "wounds", "dodge", "soulpower", "toughness"]

DSA5.defaultWeapon = {
    name: "default",
    type: "meleeweapon",
    effects: [],
    system: {
        type: "meleeweapon",
        crit: 1,
        botch: 20,
        reach: {
            value: "short"
        },
        damage: {
            value: "1d6"
        },
        atmod: {
            value: 0,
            offHandMod: 0
        },
        pamod: {
            value: 0,
            offHandMod: 0
        },
        guidevalue: {
            value: "ge/kk"
        },
        damageThreshold: {
            value: "5000"
        },
        worn: {
            offhand: false
        }
    }

}

DSA5.asyncHooks = {
    postProcessDSARoll: []
}

DSA5.characteristics = {
    "mu": "CHAR.MU",
    "kl": "CHAR.KL",
    "in": "CHAR.IN",
    "ch": "CHAR.CH",
    "ff": "CHAR.FF",
    "ge": "CHAR.GE",
    "ko": "CHAR.KO",
    "kk": "CHAR.KK"
};

DSA5.equipmentTypes = {
    "misc": "Equipment.misc",
    "clothes": "Equipment.clothes",
    "tools": "Equipment.tools",
    "light": "Equipment.light",
    "healing": "Equipment.healing",
    "bags": "Equipment.bags",
    "wealth": "Equipment.wealth",
    "writing": "Equipment.writing",
    "alchemy": "Equipment.alchemy",
    "service": "Equipment.service",
    "luxus": "Equipment.luxus",
    "blessed": "Equipment.blessed",
    "food": "Equipment.food"
};

DSA5.equipmentCategories = ["meleeweapon", "rangeweapon", "equipment", "ammunition", "armor", "poison", "consumable", "plant"]

DSA5.systemTables = [
    { name: "Defense", attrs: "data-weaponless=\"false\"", roll: "botch-roll", pack: { de: "dsa5.patzer", en: "dsa5.botch" }, setting: { module: "dsa5", key: "defenseBotchTableEnabled" } },
    { name: "Melee", attrs: "data-weaponless=\"false\"", roll: "botch-roll", pack: { de: "dsa5.patzer", en: "dsa5.botch" }, setting: { module: "dsa5", key: "meleeBotchTableEnabled" } },
    { name: "Range", attrs: "data-weaponless=\"false\"", roll: "botch-roll", pack: { de: "dsa5.patzer", en: "dsa5.botch" }, setting: { module: "dsa5", key: "rangeBotchTableEnabled" } },
    { name: "Liturgy", attrs: "", roll: "botch-roll", pack: { de: "dsa5.patzer", en: "dsa5.botch" }, setting: { module: "", key: "" } },
    { name: "Spell", attrs: "", roll: "botch-roll", pack: { de: "dsa5.patzer", en: "dsa5.botch" }, setting: { module: "", key: "" } },
]

DSA5.morePackages = {
    packages: {},
    names: {
        de: [],
        en: []
    }
 }

DSA5.narrowSpaceModifiers = {
    "weaponshort": {
        "attack": 0,
        "parry": 0,
        "label": "NarrowSpaceModifiers.weapon.short"
    },
    "weaponmedium": {
        "attack": -4,
        "parry": -4,
        "label": "NarrowSpaceModifiers.weapon.medium"
    },
    "weaponlong": {
        "attack": -8,
        "parry": -8,
        "label": "NarrowSpaceModifiers.weapon.long"
    },
    "shieldshort": {
        "attack": -2,
        "parry": -2,
        "label": "NarrowSpaceModifiers.shield.short"
    },
    "shieldmedium": {
        "attack": -4,
        "parry": -3,
        "label": "NarrowSpaceModifiers.shield.medium"
    },
    "shieldlong": {
        "attack": -6,
        "parry": -4,
        "label": "NarrowSpaceModifiers.shield.long"
    }
}

DSA5.traditionArtifacts = {
    "Animistenwaffe": 15,
    "Bannschwert": 15,
    "Druidendolch": 15,
    "Druidensichel": 12,
    "Zauberkleidung": 15,
    "Magierkugel": 12,
    "Zauberinstrument": 15,
    "Narrenkappe": 15,
    "Hexenkessel": 15,
    "Krallenkette": 12,
    "Lebensring": 12,
    "Alchimistenschale": 15,
    "Scharlatanische Zauberkugel": 15,
    "Sippenchronik": 15,
    "Schelmenspielzeug": 12,
    "Zauberstecken": 0,
    "Magierstab": 18,
    "Trinkhorn": 12,
    "Schuppenbeutel": 18,
    "Kristallomantische Kristallkugel": 15,
    "Echsenhaube": 12
}

DSA5.moneyNames = {
    "D": "Money-D",
    "S": "Money-S",
    "H": "Money-H",
    "K": "Money-K"
}

DSA5.areaTargetTypes = {
    cube: "rect",
    line: "ray",
    sphere: "circle",
    cone: "cone"
}

DSA5.rangeMods = {
    "short": {
        "damage": 1,
        "attack": 2
    },
    "medium": {
        "damage": 0,
        "attack": 0
    },
    "long": {
        "damage": -1,
        "attack": -2
    },
    "rangesense": {
        "damage": -1,
        "attack": -1
    },
    "extreme": {
        "damage": -2,
        "attack": -4
    }
}

DSA5.regnerationCampLocations = {
    "0": "regnerationCampLocations.normal",
    "-1": "regnerationCampLocations.bad",
    "1": "regnerationCampLocations.good"
}

DSA5.regenerationInterruptOptions = {
    "0": "regenerationInterruptOptions.none",
    "-1": "regenerationInterruptOptions.small",
    "-2": "regenerationInterruptOptions.big"
}

DSA5.targetMomevementOptions = {
    "0": "rangeMovementOptions.SLOW",
    "-2": "rangeMovementOptions.FAST",
    "2": "rangeMovementOptions.STATIONARY",
}

DSA5.allowedforeignfields = [
    "system.details.notes.value"
]

DSA5.shooterMovementOptions = {
    "0": "rangeMovementOptions.SHOOTERSTATIONARY",
    "-2": "rangeMovementOptions.SHOOTERMOVING",
    "-4": "rangeMovementOptions.SHOOTERRUNNING"
}

DSA5.mountedRangeOptionsSpecAb = {
    "STATIONARY": "0",
    "SCHRITT": "0",
    "TROT": "-5000",
    "GALOPP": "-4"
}

DSA5.mountedRangeOptions = {
    "STATIONARY": "0",
    "SCHRITT": "-4",
    "TROT": "-5000",
    "GALOPP": "-8",
}

DSA5.drivingArcherOptions = {
    "STATIONARY": "0",
    "SCHRITT": "-2",
    "GALOPP": "-4",
}

DSA5.aimOptions = {
    "0": "aimOptions.0",
    "2": "aimOptions.1",
    "4": "aimOptions.2"
}

DSA5.traitCategories = {
    "meleeAttack": "closeCombatAttacks",
    "rangeAttack": "rangeCombatAttacks",
    "armor": "armor",
    "general": "general",
    "familiar": "familiar",
    "trick": "trick",
    "training": "training",
    "entity": "entityAbility",
    "summoning": "summoningPackage"
}

DSA5.ritualLocationModifiers = {
    "0": "-",
    "1": "RITUALMODIFIER.holysite",
    "-3": "RITUALMODIFIER.wrongsite"
}

DSA5.ritualTimeModifiers = {
    "0": "-",
    "1": "RITUALMODIFIER.matchingConstellation",
    "-1": "RITUALMODIFIER\.wrongConstellation"
}

DSA5.ceremonyLocationModifiers = {
    "0": "-",
    "2": "CEREMONYMODIFIER.holysite",
    "1": "CEREMONYMODIFIER.temple",
    "-1": "CEREMONYMODIFIER.otherTemple",
    "-2": "CEREMONYMODIFIER.enemyGod",
    "-3": "CEREMONYMODIFIER.archDemon",
    "-4": "CEREMONYMODIFIER.nameless",
    "-5": "CEREMONYMODIFIER.nemesis"
}

DSA5.advancementCosts = {
    "A": [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
    "B": [2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28],
    "C": [3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36, 39, 42],
    "D": [4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 8, 12, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56],
    "E": [15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 15, 30, 45, 60, 75, 90, 105, 120, 135, 150, 165, 180],
}

DSA5.hooks = {}

DSA5.startXP = {
    "900": "EXP.inexperienced",
    "1000": "EXP.average",
    "1100": "EXP.experienced",
    "1200": "EXP.competent",
    "1400": "EXP.masterful",
    "1700": "EXP.brillant",
    "2100": "EXP.legendary"
}

DSA5.helpContent = [{
        name: "pay",
        command: "/pay [0-9]+",
        example: "/pay 5.03",
    }, {
        name: "getPaid",
        command: "/getPaid [0-9]+",
        example: "/getPaid 5.03",
    },
    {
        name: "quickAbility",
        command: "/sk [a-z]*, /sp [a-z]*, /li [a-z]*, /at [a-z]*, /pa [a-z]*",
        example: "/sk betören",
    },
    {
        name: "conditions",
        command: "/conditions",
        example: "/conditions"
    },
    {
        name: "tables",
        command: "/tables",
        example: "/tables"
    },
    {
        name: "request",
        command: "/rq",
        example: "/rq betören"
    },
    {
        name: "threeD20Check",
        command: "/ch",
        example: "/ch"
    },
    {
        name: "groupcheck",
        command: "/gc",
        example: "/gc"
    }
]

DSA5.ceremonyTimeModifiers = {
    "0": "-",
    "1": "CEREMONYMODIFIER.monthGod",
    "2": "CEREMONYMODIFIER.celebration",
    "-5": "CEREMONYMODIFIER.namelessDays"
}

DSA5.mageLevels = {
    "mundane": "mundane",
    "clerical": "clerical",
    "magical": "magical"
}

DSA5.specialAbilityCategories = {
    "Combat": "SpecCategory.Combat",
    "command": "SpecCategory.command",

    "general": "SpecCategory.general",
    "generalStyle": "SpecCategory.generalStyle",
    "extGeneral": "SpecCategory.extGeneral",
    
    "animal": "SpecCategory.animal",
    
    "fatePoints": "SpecCategory.fatePoints",
    "vampire": "SpecCategory.vampire",    
    "lykanthrop": "SpecCategory.lykanthrop",

    "language": "SpecCategory.language",
    "secret": "SpecCategory.secret",

    "clerical": "SpecCategory.clerical",
    "clericalStyle": "SpecCategory.clericalStyle",
    "extClericalStyle": "SpecCategory.extClericalStyle",
    "ceremonial": "SpecCategory.ceremonial",
    "vision": "SpecCategory.vision",
    "prayer": "SpecCategory.prayer",
    
    "magical": "SpecCategory.magical",
    "magicalStyle": "SpecCategory.magicalStyle",
    "extMagical": "SpecCategory.extMagical",
    "staff": "SpecCategory.staff",
    "pact": "SpecCategory.pact",
    "homunculus": "SpecCategory.homunculus"
}

DSA5.sortedSpecs = {
    combat: ["Combat", "command"],
    magical: ["magical", "magicalStyle", "extMagical", "pact", "homunculus"],
    clerical: ["clerical", "clericalStyle", "extClericalStyle", "ceremonial", "vision", "prayer"],
    unUsed: ["staff"]
}

const allSpecs = DSA5.sortedSpecs.combat.concat(DSA5.sortedSpecs.magical).concat(DSA5.sortedSpecs.clerical).concat(DSA5.sortedSpecs.unUsed)
DSA5.sortedSpecs.general = Object.keys(DSA5.specialAbilityCategories).filter(x => !allSpecs.includes(x))

DSA5.addvantageRules = {}
DSA5.removevantageRules = {}
DSA5.vantagesNeedingAdaption = {}

DSA5.addAbilityRules = {}
DSA5.removeAbilityRules = {}
DSA5.AbilitiesNeedingAdaption = {}
DSA5.addTraitRules = {}

DSA5.rangeWeaponModifiers = {
    "short": "RangeMod.short",
    "medium": "RangeMod.medium",
    "long": "RangeMod.long",
    "rangesense": "RangeMod.rangesense",
    "extreme": "RangeMod.extreme"
}

DSA5.meleeRangesArray = [
    "short",
    "medium",
    "long"
]

DSA5.meleeRanges = {
    "short": "Range-short",
    "medium": "Range-medium",
    "long": "Range-long"
};

DSA5.weapontypes = {
    "melee": "meleeweapon",
    "range": "rangeweapon"
}

DSA5.ammunitiongroups = {
    "-": "-",
    "arrow": "arrow",
    "bolt": "bolt",
    "bullet": "bullet",
    "stone": "stone",
    "dart": "dart",
    "mag": "mag",
    "infinite": "infinite"
}

DSA5.combatskillsGuidevalues = {
    "ff": "CHAR.FF",
    "ge": "CHAR.GE",
    "kk": "CHAR.KK",
    "ge/kk": "CHAR.GEKK"
}

DSA5.skillDifficultyModifiers = {
    "eeasy": 5,
    "veasy": 3,
    "easy": 1,
    "challenging": 0,
    "difficult": -1,
    "hard": -3,
    "vhard": -5
}

DSA5.magicResistanceModifiers = {
    "-": "-",
    "SK": "soulpower",
    "ZK": "toughness"
}

DSA5.sizeCategories = {
    "tiny": "SIZE.tiny",
    "small": "SIZE.small",
    "average": "SIZE.average",
    "big": "SIZE.big",
    "giant": "SIZE.giant"
}

DSA5.tokenSizeCategories = {
    "tiny": 0.5,
    "small": 0.8,
    "average": 1,
    "big": 2,
    "giant": 4
}

DSA5.rangeSizeCategories = {
    "tiny": "RANGESIZE.tiny",
    "small": "RANGESIZE.small",
    "average": "RANGESIZE.average",
    "big": "RANGESIZE.big",
    "giant": "RANGESIZE.giant"
},

DSA5.meleeSizeCategories = {
    "tiny": "MELEESIZE.tiny",
    "small": "MELEESIZE.small",
    "average": "MELEESIZE.average",
    "big": "MELEESIZE.big",
    "giant": "MELEESIZE.giant"
}

DSA5.shieldSizes = {
    "short": "SIZE.small",
    "medium": "SIZE.average",
    "long": "SIZE.big"
}

DSA5.rangeSizeModifier = {
    "tiny": -8,
    "small": -4,
    "average": 0,
    "big": 4,
    "giant": 8
}

DSA5.meleeSizeModifier = {
    "tiny": -4,
    "small": 0,
    "average": 0,
    "big": 0,
    "giant": 0
}

DSA5.rangeVision = {
    "0": "VisionDisruption.step0",
    "-2": "VisionDisruption.step1",
    "-4": "VisionDisruption.step2",
    "-6": "VisionDisruption.step3",
    "-5000": "VisionDisruption.step4"
}

DSA5.meleeRangeVision = (mode) => {
    return {
        "+0": "meleeVisionDisruption.0",
        "-1": "meleeVisionDisruption.1",
        "-2": "meleeVisionDisruption.2",
        "-3": "meleeVisionDisruption.3",
        [mode == "attack" ? "*0,5" : "-5000"]: "meleeVisionDisruption.4"
    }
}

DSA5.attributeDifficultyModifiers = {
    "eeasy": 6,
    "veasy": 4,
    "easy": 2,
    "challenging": 0,
    "difficult": -2,
    "hard": -4,
    "vhard": -6
}

DSA5.skillDifficultyLabels = {
    "eeasy": "Skill-eeasy",
    "veasy": "Skill-veasy",
    "easy": "Skill-easy",
    "challenging": "Skill-challenging",
    "difficult": "Skill-difficult",
    "hard": "Skill-hard",
    "vhard": "Skill-vhard"
}

DSA5.attributeDifficultyLabels = {
    "eeasy": "Attribute-eeasy",
    "veasy": "Attribute-veasy",
    "easy": "Attribute-easy",
    "challenging": "Attribute-challenging",
    "difficult": "Attribute-difficult",
    "hard": "Attribute-hard",
    "vhard": "Attribute-vhard"
}

DSA5.skillGroups = {
    "body": "SKILL.body",
    "social": "SKILL.social",
    "knowledge": "SKILL.knowledge",
    "trade": "SKILL.trade",
    "nature": "SKILL.nature"
};

DSA5.features = [
    "Object",
    "Spheres",
    "Influence",
    "Clairvoyance",
    "Healing",
    "Transformation",
    "Telekinesis",
    "Elemental",
    "Illusion",
    "Anti-Magic",
    "Demonic",
    "Temporal"
]

DSA5.skillBurdens = {
    "yes": "yes",
    "no": "no",
    "maybe": "maybe"
}

DSA5.StFs = {
    "A": "A",
    "B": "B",
    "C": "C",
    "D": "D"
}

DSA5.noteIcons = {
    "Griffin Shield": "systems/dsa5/icons/thirdparty/griffinshield.svg",
    "At Sea": "systems/dsa5/icons/thirdparty/at-sea.svg",
    "Medieval Gate": "systems/dsa5/icons/thirdparty/medieval-gate.svg",
    "Position Marker": "systems/dsa5/icons/thirdparty/position-marker.svg",
    "River": "systems/dsa5/icons/thirdparty/river.svg",
    "Trail": "systems/dsa5/icons/thirdparty/trail.svg",
}

CONFIG.time.roundTime = 5
CONFIG.time.turnTime = 0

export default DSA5